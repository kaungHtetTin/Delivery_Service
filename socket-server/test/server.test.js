import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { io as createSocketClient } from "socket.io-client";
import { createRealtimeServer } from "../src/server.js";
import { emitDomainEvent } from "../src/events.js";

const config = {
  host: "127.0.0.1",
  port: 0,
  corsOrigins: ["http://localhost:5173"],
  internalApiKey: "test-key",
  socketAuthSecret: "test-secret",
  allowUnsignedAuth: true,
  nodeEnv: "test",
  publishRateLimit: 2,
  publishRateWindowMs: 60_000,
};

let runtime;
let baseUrl;

before(async () => {
  runtime = createRealtimeServer(config);
  await new Promise((resolve) => runtime.server.listen(0, "127.0.0.1", resolve));
  const address = runtime.server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  runtime.io.close();
  await new Promise((resolve) => runtime.server.close(resolve));
});

test("health returns service status", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, "flowdrop-socket-server");
  assert.equal(typeof payload.sockets, "number");
});

test("status page renders server and route confirmation", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(html, /FlowDrop Realtime/);
  assert.match(html, /Socket server/);
  assert.match(html, /\/health/);
  assert.match(html, /\/socket\.io/);
  assert.match(html, /WebSocket base URL/);
  assert.match(html, /ws:\/\/127\.0\.0\.1:/);
  assert.match(html, /Connected sockets/);
});

test("routes endpoint returns route and socket event inventory", async () => {
  const response = await fetch(`${baseUrl}/routes`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.socketPath, "/socket.io");
  assert.ok(payload.routes.some((route) => route.method === "GET" && route.path === "/"));
  assert.ok(payload.routes.some((route) => route.method === "POST" && route.path === "/events/notification"));
  assert.ok(payload.socketEvents.some((socketEvent) => socketEvent.event === "socket:ready"));
});

test("unauthorized publish calls are rejected", async () => {
  const response = await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "order.updated" }),
  });

  assert.equal(response.status, 401);
});

test("valid publish calls emit expected room response", async () => {
  const response = await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-socket-server-key": "test-key",
    },
    body: JSON.stringify({
      type: "order.status.updated",
      data: {
        order_id: 22,
        client_user_id: 7,
        rider_id: 3,
      },
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.event, "order:status-updated");
  assert.deepEqual(payload.rooms.sort(), ["client:7", "office", "order:22", "rider:3"].sort());
});

test("publish endpoints are rate limited", async () => {
  const body = JSON.stringify({ type: "notification.created", data: { user_id: 9 } });
  const headers = {
    "content-type": "application/json",
    "x-socket-server-key": "test-key",
    "x-forwarded-for": "203.0.113.10",
  };

  await fetch(`${baseUrl}/events/notification`, { method: "POST", headers, body });
  await fetch(`${baseUrl}/events/notification`, { method: "POST", headers, body });
  const response = await fetch(`${baseUrl}/events/notification`, { method: "POST", headers, body });

  assert.equal(response.status, 429);
});

test("domain events resolve explicit recipient rooms", () => {
  const emissions = [];
  const fakeIo = {
    to(room) {
      return {
        emit(event, data) {
          emissions.push({ room, event, data });
        },
      };
    },
  };

  const result = emitDomainEvent(fakeIo, {
    type: "payment.updated",
    data: { id: 4 },
    recipients: {
      office: false,
      rooms: ["order:44", "client:8"],
    },
  });

  assert.equal(result.event, "payment:updated");
  assert.deepEqual(result.rooms.sort(), ["client:8", "order:44"].sort());
  assert.equal(emissions.length, 2);
});

test("rider location events are hidden from clients before pickup", () => {
  const emissions = [];
  const fakeIo = {
    to(room) {
      return {
        emit(event, data) {
          emissions.push({ room, event, data });
        },
      };
    },
  };

  const result = emitDomainEvent(fakeIo, {
    type: "rider.location.updated",
    data: {
      rider_id: 3,
      order_id: 22,
      client_user_id: 7,
      client_tracking_visible: false,
    },
    recipients: {
      rooms: ["client:7", "order:22"],
    },
  });

  assert.equal(result.event, "rider:location-updated");
  assert.deepEqual(result.rooms.sort(), ["office", "rider:3"].sort());
  assert.deepEqual(emissions.map((item) => item.room).sort(), ["office", "rider:3"].sort());
});

test("rider location events can reach client and order rooms after pickup", () => {
  const emissions = [];
  const fakeIo = {
    to(room) {
      return {
        emit(event, data) {
          emissions.push({ room, event, data });
        },
      };
    },
  };

  const result = emitDomainEvent(fakeIo, {
    type: "rider.location.updated",
    data: {
      rider_id: 3,
      order_id: 22,
      client_user_id: 7,
      client_tracking_visible: true,
    },
  });

  assert.equal(result.event, "rider:location-updated");
  assert.deepEqual(result.rooms.sort(), ["client:7", "office", "order:22", "rider:3"].sort());
  assert.deepEqual(emissions.map((item) => item.room).sort(), ["client:7", "office", "order:22", "rider:3"].sort());
});

test("connected clients can only watch authorized order rooms", async () => {
  const socket = await connectTestSocket({
    role: "client",
    userId: "7",
    orderIds: ["22"],
  });

  try {
    const allowed = await emitWithAck(socket, "order:watch", "22");
    const rejected = await emitWithAck(socket, "order:watch", "23");

    assert.deepEqual(allowed, { ok: true, room: "order:22" });
    assert.equal(rejected.ok, false);
    assert.match(rejected.message, /Not allowed/);
  } finally {
    socket.disconnect();
  }
});

test("office sockets can watch any order room", async () => {
  const socket = await connectTestSocket({
    role: "office",
    userId: "1",
  });

  try {
    const response = await emitWithAck(socket, "order:watch", "999");

    assert.deepEqual(response, { ok: true, room: "order:999" });
  } finally {
    socket.disconnect();
  }
});

function connectTestSocket(auth) {
  return new Promise((resolve, reject) => {
    const socket = createSocketClient(baseUrl, {
      auth,
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timed out."));
    }, 3000);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
}

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, resolve);
  });
}
