const eventTypeMap = {
  "order.created": "order:created",
  "order.updated": "order:updated",
  "order.assigned": "order:assigned",
  "order.status.updated": "order:status-updated",
  "payment.updated": "payment:updated",
  "cash.collection.updated": "cash-collection:updated",
  "rider.location.updated": "rider:location-updated",
  "notification.created": "notification:created",
};

export function emitDomainEvent(io, payload) {
  const event = normalizeDomainEvent(payload);
  const rooms = resolveRooms(event);

  rooms.forEach((room) => {
    io.to(room).emit(event.name, event.data);
  });

  return {
    event: event.name,
    rooms,
  };
}

export function normalizeDomainEvent(payload = {}) {
  const type = String(payload.type || "").trim();
  const name = eventTypeMap[type] || type;

  if (!name) {
    throw new Error("Event type is required.");
  }

  return {
    name,
    type,
    data: payload.data || payload.order || payload.notification || payload.rider || {},
    recipients: payload.recipients || {},
  };
}

function resolveRooms(event) {
  if (event.type === "rider.location.updated" || event.name === "rider:location-updated") {
    return resolveRiderLocationRooms(event);
  }

  const rooms = new Set();
  const data = event.data || {};
  const recipients = event.recipients || {};

  if (recipients.office !== false) {
    rooms.add("office");
  }

  addRoom(rooms, "order", resolveOrderId(event));
  addRoom(rooms, "client", recipients.clientUserId || recipients.client_user_id || data.clientUserId || data.client_user_id);
  addRoom(rooms, "rider", recipients.riderId || recipients.rider_id || data.riderId || data.rider_id);
  addRoom(rooms, "user", recipients.userId || recipients.user_id || data.userId || data.user_id);

  (recipients.rooms || []).forEach((room) => {
    if (room) {
      rooms.add(String(room));
    }
  });

  return [...rooms];
}

function resolveRiderLocationRooms(event) {
  const rooms = new Set();
  const data = event.data || {};
  const recipients = event.recipients || {};
  const riderId = recipients.riderId || recipients.rider_id || data.riderId || data.rider_id;
  const orderId = resolveOrderId(event);
  const clientUserId = recipients.clientUserId || recipients.client_user_id || data.clientUserId || data.client_user_id;
  const clientVisible = data.client_tracking_visible === true || recipients.clientTrackingVisible === true || recipients.client_tracking_visible === true;

  if (recipients.office !== false) {
    rooms.add("office");
  }

  addRoom(rooms, "rider", riderId);

  if (clientVisible) {
    addRoom(rooms, "order", orderId);
    addRoom(rooms, "client", clientUserId);
  }

  return [...rooms];
}

function resolveOrderId(event) {
  const data = event.data || {};
  const recipients = event.recipients || {};

  return recipients.orderId ||
    recipients.order_id ||
    data.orderId ||
    data.order_id ||
    (isOrderEvent(event) ? data.id : null);
}

function isOrderEvent(event) {
  return event.type?.startsWith("order.") || event.name?.startsWith("order:");
}

function addRoom(rooms, prefix, value) {
  if (value) {
    rooms.add(`${prefix}:${value}`);
  }
}
