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
    port: Number(env.PORT || 3000),
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
  const startedAt = new Date();
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

  app.get("/", (request, response) => {
    response
      .type("html")
      .send(renderStatusPage({ config, io, request, startedAt }));
  });

  app.get("/health", (request, response) => {
    response.json({
      ok: true,
      service: "flowdrop-socket-server",
      sockets: io.engine.clientsCount,
      uptime: process.uptime(),
      env: config.nodeEnv,
    });
  });

  app.get("/routes", (request, response) => {
    response.json({
      ok: true,
      service: "flowdrop-socket-server",
      socketPath: "/socket.io",
      routes: routeInventory(config),
      socketEvents: socketEventInventory(),
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
  if (request.path === "/") {
    return "status_page";
  }

  if (request.path === "/health") {
    return "health_check";
  }

  if (request.path === "/routes") {
    return "route_inventory";
  }

  if (request.path === "/tokens/development") {
    return "development_token_request";
  }

  if (request.path.startsWith("/events")) {
    return "event_publish_request";
  }

  return "unknown_request";
}

function routeInventory(config) {
  return [
    {
      method: "GET",
      path: "/",
      name: "Status page",
      access: "public",
      description: "Browser dashboard for confirming the socket server is active.",
    },
    {
      method: "GET",
      path: "/health",
      name: "Health check",
      access: "public",
      description: "Machine-readable uptime, environment, and connected socket count.",
    },
    {
      method: "GET",
      path: "/routes",
      name: "Route inventory",
      access: "public",
      description: "Machine-readable list of HTTP routes and socket events.",
    },
    {
      method: "POST",
      path: "/events",
      name: "Publish event",
      access: "internal key",
      description: "Publish a typed realtime event to calculated rooms.",
    },
    {
      method: "POST",
      path: "/events/order-updated",
      name: "Publish order update",
      access: "internal key",
      description: "Publish order.updated using the order event route.",
    },
    {
      method: "POST",
      path: "/events/payment",
      name: "Publish payment update",
      access: "internal key",
      description: "Publish payment.updated events.",
    },
    {
      method: "POST",
      path: "/events/cash-collection",
      name: "Publish cash collection update",
      access: "internal key",
      description: "Publish cash.collection.updated events.",
    },
    {
      method: "POST",
      path: "/events/rider-location",
      name: "Publish rider location update",
      access: "internal key",
      description: "Publish rider.location.updated events.",
    },
    {
      method: "POST",
      path: "/events/notification",
      name: "Publish notification",
      access: "internal key",
      description: "Publish notification.created events.",
    },
    {
      method: "POST",
      path: "/tokens/development",
      name: "Development auth token",
      access: config.nodeEnv === "production" ? "disabled" : "development only",
      description: "Create signed test tokens outside production.",
    },
    {
      method: "WS",
      path: "/socket.io",
      name: "Socket.IO transport",
      access: "signed auth token",
      description: "Realtime websocket and polling transport endpoint.",
    },
  ];
}

function socketEventInventory() {
  return [
    {
      direction: "server -> client",
      event: "socket:ready",
      description: "Sent after a socket connects and joins its base rooms.",
    },
    {
      direction: "client -> server",
      event: "order:watch",
      description: "Join an order room when the socket is allowed to watch it.",
    },
    {
      direction: "client -> server",
      event: "order:unwatch",
      description: "Leave an order room.",
    },
    {
      direction: "server -> client",
      event: "order:created, order:updated, order:assigned, order:status-updated, order.deleted",
      description: "Delivery order lifecycle events.",
    },
    {
      direction: "server -> client",
      event: "payment:updated, payment.deleted, cash-collection:updated",
      description: "Payment and cash collection events.",
    },
    {
      direction: "server -> client",
      event: "rider:location-updated, notification:created",
      description: "Live GPS and notification events.",
    },
  ];
}

function renderStatusPage({ config, io, request, startedAt }) {
  const routes = routeInventory(config);
  const socketEvents = socketEventInventory();
  const rooms = [...io.sockets.adapter.rooms.entries()]
    .filter(([room, sockets]) => !sockets.has(room))
    .map(([room, sockets]) => ({ room, sockets: sockets.size }))
    .sort((first, second) => first.room.localeCompare(second.room));
  const routeRows = routes.map((route) => `
    <tr>
      <td><code>${escapeHtml(route.method)}</code></td>
      <td><code>${escapeHtml(route.path)}</code></td>
      <td>${escapeHtml(route.name)}</td>
      <td><span class="pill">${escapeHtml(route.access)}</span></td>
      <td>${escapeHtml(route.description)}</td>
    </tr>
  `).join("");
  const eventRows = socketEvents.map((socketEvent) => `
    <tr>
      <td>${escapeHtml(socketEvent.direction)}</td>
      <td><code>${escapeHtml(socketEvent.event)}</code></td>
      <td>${escapeHtml(socketEvent.description)}</td>
    </tr>
  `).join("");
  const roomRows = rooms.length
    ? rooms.map((room) => `
      <tr>
        <td><code>${escapeHtml(room.room)}</code></td>
        <td>${room.sockets}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="2">No shared rooms active right now.</td></tr>';
  const origin = `${request.protocol}://${request.get("host")}`;
  const wsProtocol = request.protocol === "https" ? "wss" : "ws";
  const wsBaseUrl = `${wsProtocol}://${request.get("host")}`;
  const status = validateConfig(config);
  const statusLabel = status.length && config.nodeEnv === "production" ? "Needs attention" : "Active";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FlowDrop Socket Server</title>
    <style>
      :root { color-scheme: light; --bg: #eef4f4; --panel: #ffffffde; --text: #172033; --muted: #69768a; --primary: #087f74; --border: #dce5e5; --good: #16794c; --warn: #9a5700; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; color: var(--text); background: linear-gradient(180deg, #e7f4f3, var(--bg)); font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
      header { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
      h1, h2, p { margin: 0; }
      h1 { font-size: clamp(26px, 4vw, 40px); line-height: 1.05; letter-spacing: 0; }
      h2 { font-size: 16px; margin-bottom: 12px; }
      .eyebrow { color: var(--primary); font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
      .muted { color: var(--muted); }
      .status { display: inline-flex; gap: 8px; align-items: center; min-height: 34px; padding: 0 12px; color: #fff; background: var(--good); border-radius: 999px; font-weight: 800; }
      .status.warn { background: var(--warn); }
      .dot { width: 8px; height: 8px; background: currentColor; border-radius: 50%; box-shadow: 0 0 0 4px #ffffff42; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 12px; }
      .card, section { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 10px 25px #1e3d430f; }
      .card { min-height: 92px; padding: 14px; display: grid; align-content: center; gap: 4px; }
      .card small { color: var(--muted); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .card strong { font-size: 22px; }
      section { padding: 16px; margin-top: 12px; overflow: hidden; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 12px; text-align: left; border-top: 1px solid var(--border); vertical-align: top; }
      th { color: var(--muted); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
      code { padding: 2px 5px; background: #087f7412; border-radius: 5px; color: #075f57; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
      .pill { display: inline-flex; padding: 3px 8px; color: var(--primary); background: #087f7412; border: 1px solid #087f7420; border-radius: 999px; font-size: 11px; font-weight: 800; white-space: nowrap; }
      .links { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
      .links a { display: inline-flex; min-height: 34px; padding: 0 11px; color: #fff; background: var(--primary); border-radius: 7px; align-items: center; text-decoration: none; font-weight: 800; }
      @media (max-width: 860px) { header { align-items: flex-start; flex-direction: column; } .grid { grid-template-columns: 1fr 1fr; } table { min-width: 760px; } section { overflow-x: auto; } }
      @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="eyebrow">FlowDrop Realtime</p>
          <h1>Socket server</h1>
          <p class="muted">HTTP route and Socket.IO status for ${escapeHtml(origin)}</p>
        </div>
        <span class="status ${status.length && config.nodeEnv === "production" ? "warn" : ""}"><span class="dot"></span>${escapeHtml(statusLabel)}</span>
      </header>

      <div class="grid">
        <div class="card"><small>Environment</small><strong>${escapeHtml(config.nodeEnv)}</strong></div>
        <div class="card"><small>Connected sockets</small><strong>${io.engine.clientsCount}</strong></div>
        <div class="card"><small>Uptime</small><strong>${formatUptime(process.uptime())}</strong></div>
        <div class="card"><small>Started</small><strong>${escapeHtml(startedAt.toLocaleString())}</strong></div>
      </div>

      <section>
        <h2>Configuration</h2>
        <table>
          <tbody>
            <tr><th>Socket path</th><td><code>/socket.io</code></td></tr>
            <tr><th>WebSocket base URL</th><td><code>${escapeHtml(wsBaseUrl)}</code></td></tr>
            <tr><th>Socket.IO URL</th><td><code>${escapeHtml(`${wsBaseUrl}/socket.io`)}</code></td></tr>
            <tr><th>CORS origins</th><td>${escapeHtml(config.corsOrigins.length ? config.corsOrigins.join(", ") : "*")}</td></tr>
            <tr><th>Internal API key</th><td>${config.internalApiKey ? "Configured" : "Missing"}</td></tr>
            <tr><th>Socket auth secret</th><td>${config.socketAuthSecret ? "Configured" : "Missing"}</td></tr>
            <tr><th>Unsigned auth</th><td>${config.allowUnsignedAuth ? "Allowed" : "Disabled"}</td></tr>
            <tr><th>Publish rate limit</th><td>${config.publishRateLimit} requests / ${Math.round(config.publishRateWindowMs / 1000)}s</td></tr>
          </tbody>
        </table>
        <div class="links">
          <a href="/health">Open /health</a>
          <a href="/routes">Open /routes</a>
        </div>
      </section>

      <section>
        <h2>HTTP Routes</h2>
        <table>
          <thead><tr><th>Method</th><th>Path</th><th>Name</th><th>Access</th><th>Description</th></tr></thead>
          <tbody>${routeRows}</tbody>
        </table>
      </section>

      <section>
        <h2>Socket Events</h2>
        <table>
          <thead><tr><th>Direction</th><th>Event</th><th>Description</th></tr></thead>
          <tbody>${eventRows}</tbody>
        </table>
      </section>

      <section>
        <h2>Active Rooms</h2>
        <table>
          <thead><tr><th>Room</th><th>Sockets</th></tr></thead>
          <tbody>${roomRows}</tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

function formatUptime(seconds) {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
