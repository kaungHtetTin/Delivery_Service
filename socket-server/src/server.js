import "dotenv/config";
import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { emitDomainEvent } from "./events.js";
import { normalizeAuthPayload, parseOrigins, signRealtimeToken, verifyRealtimeToken } from "./auth.js";

const config = {
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 4100),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN || ""),
  internalApiKey: process.env.INTERNAL_API_KEY || "",
  socketAuthSecret: process.env.SOCKET_AUTH_SECRET || "",
  allowUnsignedAuth: process.env.ALLOW_UNSIGNED_AUTH === "true",
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
  },
});

app.use(cors({
  origin: config.corsOrigins.length ? config.corsOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (request, response) => {
  response.json({
    ok: true,
    service: "flowdrop-socket-server",
    sockets: io.engine.clientsCount,
    uptime: process.uptime(),
  });
});

app.post("/tokens/development", requireDevelopmentMode, (request, response) => {
  const payload = normalizeAuthPayload(request.body);

  if (!payload) {
    response.status(422).json({ message: "Valid role is required." });
    return;
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const token = signRealtimeToken({ ...payload, exp }, config.socketAuthSecret);

  response.json({ token, expires_at: exp });
});

app.post("/events", requireInternalApiKey, (request, response) => {
  publishEvent(request, response);
});

app.post("/events/order-updated", requireInternalApiKey, (request, response) => {
  publishEvent(request, response, "order.updated");
});

app.post("/events/rider-location", requireInternalApiKey, (request, response) => {
  publishEvent(request, response, "rider.location.updated");
});

app.post("/events/notification", requireInternalApiKey, (request, response) => {
  publishEvent(request, response, "notification.created");
});

io.use((socket, next) => {
  const payload = readSocketAuth(socket);

  if (!payload) {
    next(new Error("Unauthorized socket connection."));
    return;
  }

  socket.data.auth = payload;
  next();
});

io.on("connection", (socket) => {
  const auth = socket.data.auth;

  joinBaseRooms(socket, auth);

  socket.emit("socket:ready", {
    socketId: socket.id,
    role: auth.role,
    rooms: [...socket.rooms].filter((room) => room !== socket.id),
  });

  socket.on("order:watch", (orderId, acknowledge) => {
    const allowed = auth.role === "office" || auth.orderIds.includes(String(orderId));

    if (!allowed) {
      acknowledge?.({ ok: false, message: "Not allowed to watch this order." });
      return;
    }

    socket.join(`order:${orderId}`);
    acknowledge?.({ ok: true, room: `order:${orderId}` });
  });

  socket.on("order:unwatch", (orderId, acknowledge) => {
    socket.leave(`order:${orderId}`);
    acknowledge?.({ ok: true, room: `order:${orderId}` });
  });
});

server.listen(config.port, config.host, () => {
  console.log(`FlowDrop socket server listening on http://${config.host}:${config.port}`);
});

function publishEvent(request, response, forcedType = null) {
  try {
    const result = emitDomainEvent(io, {
      ...request.body,
      type: forcedType || request.body.type,
    });

    response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    response.status(422).json({
      ok: false,
      message: error.message,
    });
  }
}

function readSocketAuth(socket) {
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

function requireInternalApiKey(request, response, next) {
  const headerKey = request.get("x-socket-server-key");

  if (!config.internalApiKey || headerKey !== config.internalApiKey) {
    response.status(401).json({ message: "Invalid socket server API key." });
    return;
  }

  next();
}

function requireDevelopmentMode(request, response, next) {
  if (process.env.NODE_ENV === "production") {
    response.status(404).json({ message: "Not found." });
    return;
  }

  next();
}
