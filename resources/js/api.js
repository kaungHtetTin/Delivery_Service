const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = new Error(`API request failed with status ${response.status}`);
    error.response = response;
    throw error;
  }

  return response.json();
}

const humanize = (value) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function mapOrder(order) {
  return {
    _apiId: order.id,
    id: order.code,
    createdAt: order.created_at ? new Date(order.created_at).toLocaleString() : "Just now",
    updatedAt: order.updated_at ? new Date(order.updated_at).toLocaleString() : "Just now",
    client: order.client_name,
    clientPhone: order.client_phone,
    pickup: order.pickup_address,
    pickupContact: order.pickup_contact_name,
    pickupPhone: order.pickup_phone,
    destination: order.receiver_address,
    receiver: order.receiver_name,
    receiverPhone: order.receiver_phone,
    product: order.product_name,
    category: order.product_category || "Package",
    quantity: order.quantity,
    fragile: order.is_fragile,
    note: order.client_note || order.special_handling_note || "",
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: humanize(order.delivery_fee_payment_method),
    paymentId: order.payments?.[0]?.id || null,
    paymentScreenshot: order.payments?.[0]?.screenshot_path || null,
    paymentReviewedAt: order.payments?.[0]?.reviewed_at
      ? new Date(order.payments[0].reviewed_at).toLocaleString()
      : null,
    paymentNote: order.payments?.[0]?.note || "",
    cod: Number(order.cod_amount),
    fee: Number(order.delivery_fee),
    riderId: order.rider?.code || null,
  };
}

export function mapRider(rider) {
  return {
    _apiId: rider.id,
    id: rider.code,
    name: rider.name,
    initials: initials(rider.name),
    phone: rider.phone,
    status: rider.status,
    activeOrders: rider.active_orders_count || 0,
    area: rider.current_area || "Area unavailable",
    lastSeen: rider.last_active_at
      ? new Date(rider.last_active_at).toLocaleString()
      : "No recent update",
    cashHeld: Number(rider.cash_held),
    vehicle: humanize(rider.vehicle_type),
  };
}

export async function fetchOrders() {
  const response = await request("/delivery-orders?per_page=100");
  return response.data.map(mapOrder);
}

export async function fetchRiders() {
  const response = await request("/riders");
  return response.data.map(mapRider);
}

export async function createDeliveryOrder(order) {
  const response = await request("/delivery-orders", {
    method: "POST",
    body: JSON.stringify({
      client_name: order.client,
      client_phone: order.clientPhone,
      pickup_contact_name: order.pickupContact,
      pickup_phone: order.pickupPhone,
      pickup_address: order.pickup,
      receiver_name: order.receiver,
      receiver_phone: order.receiverPhone,
      receiver_address: order.destination,
      product_name: order.product,
      product_category: order.category,
      quantity: Number(order.quantity || 1),
      is_fragile: order.fragile,
      delivery_fee_payment_method: order.paymentMethod
        .toLowerCase()
        .replaceAll(" ", "_"),
      product_payment_method: Number(order.cod) > 0 ? "rider_collects" : "already_paid",
      cod_amount: Number(order.cod || 0),
      delivery_fee: Number(order.fee || 0),
      client_note: order.note,
    }),
  });

  if (order.paymentScreenshot && response.payments?.[0]?.id) {
    const formData = new FormData();
    formData.append("screenshot", order.paymentScreenshot);

    const uploadResponse = await request(`/payments/${response.payments[0].id}/screenshot`, {
      method: "POST",
      body: formData,
    });

    return mapOrder({
      ...uploadResponse.delivery_order,
      payments: [uploadResponse],
    });
  }

  return mapOrder(response);
}

export async function fetchReportSummary() {
  return request("/reports/summary");
}

export async function assignDeliveryOrder(order, rider) {
  const response = await request(`/delivery-orders/${order._apiId}/assign`, {
    method: "POST",
    body: JSON.stringify({ rider_id: rider._apiId }),
  });

  return mapOrder(response);
}

export async function updateDeliveryOrderStatus(order, status) {
  const response = await request(`/delivery-orders/${order._apiId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      actor_type: "rider",
    }),
  });

  return mapOrder(response);
}

export async function reviewPayment(paymentId, status, note = "") {
  const response = await request(`/payments/${paymentId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });

  return mapOrder({
    ...response.delivery_order,
    payments: [response],
  });
}
