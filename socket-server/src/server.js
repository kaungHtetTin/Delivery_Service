import "dotenv/config";
import http from "node:http";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { emitDomainEvent } from "./events.js";
import { normalizeAuthPayload, parseOrigins, signRealtimeToken, verifyRealtimeToken } from "./auth.js";
import { logger } from "./logger.js";
import { createRateLimiter } from "./rate-limit.js";

export function loadConfig(env = process.env) {
  return {
    host: env.HOST || "0.0.0.0",
    port: Number(env.PORT || 4100),
    corsOrigins: parseOrigins(env.CORS_ORIGIN || ""),
    internalApiKey: env.INTERNAL_API_KEY || "",
    socketAuthSecret: env.SOCKET_AUTH_SECRET || "",
    allowUnsignedAuth: env.ALLOW_UNSIGNED_AUTH === "true",
    nodeEnv: env.NODE_ENV || "development",
    publishRateLimit: Number(env.PUBLISH_RATE_LIMIT || 120),
    publishRateWindowMs: Number(env.PUBLISH_RATE_WINDOW_MS || 60_000),
  };
}

export function validateConfig(config) {
  const problems = [];

  if (!config.internalApiKey) {
    problems.push("INTERNAL_API_KEY is required.");
  }

  if (!config.socketAuthSecret) {
    problems.push("SOCKET_AUTH_SECRET is required.");
  }

  if (config.nodeEnv === "production" && config.allowUnsignedAuth) {
    problems.push("ALLOW_UNSIGNED_AUTH must be false in production.");
  }

  if (config.nodeEnv === "production" && !config.corsOrigins.length) {
    problems.push("CORS_ORIGIN should be set in production.");
  }

  return problems;
}

export function createRealtimeServer(config = loadConfig()) {
  const app = express();
  const server = http.createServer(app);
  const corsOptions = createCorsOptions(config);
  const io = new Server(server, {
    cors: corsOptions,
  });
  const publishRateLimiter = createRateLimiter({
    limit: config.publishRateLimit,
    windowMs: config.publishRateWindowMs,
  });

  app.set("trust proxy", true);
  app.use(logHttpRequest);
  app.use(cors(corsOptions));
  app.use(handleCorsError);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (request, response) => {
    response.json({
      ok: true,
      service: "flowdrop-socket-server",
      sockets: io.engine.clientsCount,
      uptime: process.uptime(),
      env: config.nodeEnv,
    });
  });

  app.post("/tokens/development", requireDevelopmentMode(config), (request, response) => {
    const payload = normalizeAuthPayload(request.body);

    if (!payload) {
      logger.warn("development_token_rejected", { ip: request.ip, reason: "invalid_payload" });
      response.status(422).json({ message: "Valid role is required." });
      return;
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60;
    const token = signRealtimeToken({ ...payload, exp }, config.socketAuthSecret);

    logger.info("development_token_created", { role: payload.role, userId: payload.userId });
    response.json({ token, expires_at: exp });
  });

  const publishMiddlewares = [publishRateLimiter, requireInternalApiKey(config)];

  app.post("/events", ...publishMiddlewares, (request, response) => {
    publishEvent(io, request, response);
  });

  app.post("/events/order-updated", ...publishMiddlewares, (request, response) => {
    publishEvent(io, request, response, "order.updated");
  });

  app.post("/events/payment", ...publishMiddlewares, (request, response) => {
    publishEvent(io, request, response, "payment.updated");
  });

  app.post("/events/cash-collection", ...publishMiddlewares, (request, response) => {
    publishEvent(io, request, response, "cash.collection.updated");
  });

  app.post("/events/rider-location", ...publishMiddlewares, (request, response) => {
    publishEvent(io, request, response, "rider.location.updated");
  });

  app.post("/events/notification", ...publishMiddlewares, (request, response) => {
    publishEvent(io, request, response, "notification.created");
  });

  io.use((socket, next) => {
    const payload = readSocketAuth(socket, config);

    if (!payload) {
      logger.warn("socket_auth_failed", {
        socketId: socket.id,
        ip: socket.handshake.address,
        origin: socket.handshake.headers.origin,
        transport: socket.conn.transport.name,
      });
      next(new Error("Unauthorized socket connection."));
      return;
    }

    socket.data.auth = payload;
    next();
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;

    joinBaseRooms(socket, auth);

    logger.info("socket_connected", {
      socketId: socket.id,
      role: auth.role,
      userId: auth.userId,
      riderId: auth.riderId,
      ip: socket.handshake.address,
      origin: socket.handshake.headers.origin,
      transport: socket.conn.transport.name,
      rooms: [...socket.rooms].filter((room) => room !== socket.id),
    });

    socket.emit("socket:ready", {
      socketId: socket.id,
      role: auth.role,
      rooms: [...socket.rooms].filter((room) => room !== socket.id),
    });

    socket.on("order:watch", (orderId, acknowledge) => {
      const allowed = auth.role === "office" || auth.orderIds.includes(String(orderId));

      if (!allowed) {
        logger.warn("order_watch_rejected", {
          socketId: socket.id,
          role: auth.role,
          orderId: String(orderId),
        });
        acknowledge?.({ ok: false, message: "Not allowed to watch this order." });
        return;
      }

      socket.join(`order:${orderId}`);
      logger.info("order_watch_started", {
        socketId: socket.id,
        role: auth.role,
        orderId: String(orderId),
      });
      acknowledge?.({ ok: true, room: `order:${orderId}` });
    });

    socket.on("order:unwatch", (orderId, acknowledge) => {
      socket.leave(`order:${orderId}`);
      logger.info("order_watch_stopped", {
        socketId: socket.id,
        role: auth.role,
        orderId: String(orderId),
      });
      acknowledge?.({ ok: true, room: `order:${orderId}` });
    });

    socket.on("disconnect", (reason) => {
      logger.info("socket_disconnected", {
        socketId: socket.id,
        role: auth.role,
        userId: auth.userId,
        reason,
      });
    });
  });

  io.engine.on("connection_error", (error) => {
    logger.warn("socket_connection_error", {
      code: error.code,
      message: error.message,
      context: error.context,
      ip: error.req?.socket?.remoteAddress,
      origin: error.req?.headers?.origin,
    });
  });

  return { app, server, io, config };
}

export function start(config = loadConfig()) {
  const problems = validateConfig(config);

  if (problems.length && config.nodeEnv === "production") {
    problems.forEach((problem) => logger.error("config_invalid", { problem }));
    process.exitCode = 1;
    return null;
  }

  problems.forEach((problem) => logger.warn("config_warning", { problem }));

  const runtime = createRealtimeServer(config);

  runtime.server.listen(config.port, config.host, () => {
    logger.info("server_started", {
      url: `http://${config.host}:${config.port}`,
      corsOrigins: config.corsOrigins.length ? config.corsOrigins : ["*"],
      allowUnsignedAuth: config.allowUnsignedAuth,
      nodeEnv: config.nodeEnv,
      publishRateLimit: config.publishRateLimit,
      publishRateWindowMs: config.publishRateWindowMs,
    });
  });

  setupGracefulShutdown(runtime);

  return runtime;
}

function publishEvent(io, request, response, forcedType = null) {
  try {
    const result = emitDomainEvent(io, {
      ...request.body,
      type: forcedType || request.body.type,
    });

    logger.info("event_publish_success", {
      type: forcedType || request.body.type,
      event: result.event,
      rooms: result.rooms,
      roomSocketCounts: countSocketsByRoom(io, result.rooms),
      ip: request.ip,
    });

    response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    logger.warn("event_publish_failed", {
      type: forcedType || request.body?.type,
      message: error.message,
    });

    response.status(422).json({
      ok: false,
      message: error.message,
    });
  }
}

function createCorsOptions(config) {
  const allowedOrigins = config.corsOrigins;
  const allowAnyOrigin = !allowedOrigins.length || allowedOrigins.includes("*");

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowAnyOrigin || allowedOrigins.includes(origin)) {
        logger.debug("cors_origin_allowed", { origin, allowAnyOrigin });
        callback(null, true);
        return;
      }

      logger.warn("cors_origin_rejected", {
        origin,
        allowedOrigins,
      });
      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
  };
}

function logHttpRequest(request, response, next) {
  const startedAt = process.hrtime.bigint();

  response.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info("http_request", {
      method: request.method,
      path: request.originalUrl || request.url,
      status: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: request.ip,
      origin: request.get("origin") || "",
      userAgent: request.get("user-agent") || "",
      action: requestAction(request),
    });
  });

  next();
}

function handleCorsError(error, request, response, next) {
  if (!error?.message?.startsWith("CORS origin not allowed:")) {
    next(error);
    return;
  }

  response.status(403).json({
    ok: false,
    message: error.message,
  });
}

function requestAction(request) {
  if (request.path === "/health") {
    return "health_check";
  }

  if (request.path === "/tokens/development") {
    return "development_token_request";
  }

  if (request.path.startsWith("/events")) {
    return "event_publish_request";
  }

  return "unknown_request";
}

function countSocketsByRoom(io, rooms) {
  return Object.fromEntries(
    rooms.map((room) => [room, io.sockets.adapter.rooms.get(room)?.size || 0]),
  );
}

function readSocketAuth(socket, config) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const signedPayload = verifyRealtimeToken(token, config.socketAuthSecret);

  if (signedPayload) {
    return normalizeAuthPayload(signedPayload);
  }

  if (!config.allowUnsignedAuth) {
    return null;
  }

  return normalizeAuthPayload(socket.handshake.auth || socket.handshake.query);
}

function joinBaseRooms(socket, auth) {
  socket.join(`${auth.role}s`);

  if (auth.role === "office") {
    socket.join("office");
  }

  if (auth.userId) {
    socket.join(`user:${auth.userId}`);
  }

  if (auth.role === "client" && auth.userId) {
    socket.join(`client:${auth.userId}`);
  }

  if (auth.role === "rider" && auth.riderId) {
    socket.join(`rider:${auth.riderId}`);
  }

  auth.orderIds.forEach((orderId) => socket.join(`order:${orderId}`));
}

function requireInternalApiKey(config) {
  return function internalApiKeyMiddleware(request, response, next) {
    const headerKey = request.get("x-socket-server-key");

    if (!config.internalApiKey || headerKey !== config.internalApiKey) {
      logger.warn("publish_auth_failed", {
        ip: request.ip,
        path: request.path,
        hasConfiguredKey: Boolean(config.internalApiKey),
      });
      response.status(401).json({ message: "Invalid socket server API key." });
      return;
    }

    next();
  };
}

function requireDevelopmentMode(config) {
  return function developmentModeMiddleware(request, response, next) {
    if (config.nodeEnv === "production") {
      response.status(404).json({ message: "Not found." });
      return;
    }

    next();
  };
}

function setupGracefulShutdown({ server, io }) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("server_shutdown_started", { signal });

    io.close(() => {
      server.close((error) => {
        if (error) {
          logger.error("server_shutdown_failed", { message: error.message });
          process.exitCode = 1;
          return;
        }

        logger.info("server_shutdown_complete", { signal });
      });
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

const entryPoint = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (entryPoint) {
  start();
}
