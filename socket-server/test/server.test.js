import assert from "node:assert/strict";
import { after, before, test } from "node:test";
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
