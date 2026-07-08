import { io } from "socket.io-client";

const realtimeEvents = [
  "order:created",
  "order:updated",
  "order:assigned",
  "order:status-updated",
  "order.deleted",
  "payment:updated",
  "payment.deleted",
  "cash-collection:updated",
  "rider:location-updated",
  "notification:created",
];

export function createRealtimeConnection({ auth, orders = [], riders = [], onRefresh }) {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:4100";
  const enabled = import.meta.env.VITE_SOCKET_ENABLED !== "false";
  const socketAuth = buildSocketAuth(auth, orders, riders);

  if (!enabled || !socketAuth) {
    console.info("[realtime] skipped", {
      enabled,
      reason: socketAuth ? "disabled" : "missing_auth",
    });
    return () => {};
  }

  let refreshTimer = null;
  const scheduleRefresh = (eventName, payload) => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      console.info("[realtime] refetch", { eventName, payload });
      onRefresh?.();
    }, 350);
  };

  console.info("[realtime] connecting", {
    socketUrl,
    role: socketAuth.role,
    userId: socketAuth.userId,
    riderId: socketAuth.riderId,
    orderCount: socketAuth.orderIds.length,
  });

  const socket = io(socketUrl, {
    auth: socketAuth,
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.info("[realtime] connected", {
      socketId: socket.id,
      transport: socket.io.engine.transport.name,
    });
  });

  socket.on("connect_error", (error) => {
    console.warn("[realtime] connect_error", {
      message: error.message,
      description: error.description,
      context: error.context,
    });
  });

  socket.on("disconnect", (reason) => {
    console.info("[realtime] disconnected", { reason });
  });

  socket.on("socket:ready", (payload) => {
    console.info("[realtime] ready", payload);
  });

  realtimeEvents.forEach((eventName) => {
    socket.on(eventName, (payload) => {
      console.info("[realtime] event", { eventName, payload });
      scheduleRefresh(eventName, payload);
    });
  });

  return () => {
    window.clearTimeout(refreshTimer);
    realtimeEvents.forEach((eventName) => socket.off(eventName));
    socket.disconnect();
  };
}

function buildSocketAuth(auth, orders, riders) {
  const user = auth?.user;

  if (!user?.role) {
    return null;
  }

  const role = socketRole(user.role);

  if (!role) {
    return null;
  }

  const rider = riders.find((item) => String(item.userId || "") === String(user.id || ""));

  return {
    role,
    userId: user.id ? String(user.id) : "",
    riderId: rider?._apiId ? String(rider._apiId) : "",
    orderIds: orders
      .map((order) => order._apiId)
      .filter(Boolean)
      .map(String),
  };
}

function socketRole(role) {
  if (role === "client" || role === "rider") {
    return role;
  }

  if (role === "office_admin" || role === "super_admin") {
    return "office";
  }

  return null;
}
