const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || "/api",
  token: null,
  onUnauthorized: null,
};

export function configureApi({ baseUrl, token, onUnauthorized } = {}) {
  if (baseUrl) {
    apiConfig.baseUrl = baseUrl;
  }

  apiConfig.token = token || null;
  apiConfig.onUnauthorized = onUnauthorized || null;
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const method = options.method || "GET";
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(apiConfig.token ? { Authorization: `Bearer ${apiConfig.token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    console.warn("[api] request_failed", {
      method,
      path,
      status: response.status,
    });
    const error = new Error(`API request failed with status ${response.status}`);
    error.response = response;
    try {
      error.payload = await response.json();
    } catch {
      error.payload = null;
    }
    if (response.status === 401 && typeof apiConfig.onUnauthorized === "function") {
      apiConfig.onUnauthorized();
    }
    throw error;
  }

  console.info("[api] request_success", {
    method,
    path,
    status: response.status,
  });

  return response.json();
}

async function requestAllPages(path, mapper, { params = {}, perPage = 100 } = {}) {
  const records = [];
  let page = 1;
  let lastPage = 1;

  do {
    const query = new URLSearchParams({
      ...params,
      page: String(page),
      per_page: String(perPage),
    });
    const separator = path.includes("?") ? "&" : "?";
    const response = await request(`${path}${separator}${query.toString()}`);

    records.push(...(response.data || []).map(mapper));
    lastPage = Number(response.last_page || 1);
    page += 1;
  } while (page <= lastPage);

  return records;
}

const humanize = (value) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const paymentMethodLabels = {
  cash: "Cash",
  cash_on_delivery: "Cash",
  prepaid: "Prepaid",
  mobile_banking: "Banking",
};

const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const dateInputValue = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export async function login(credentials) {
  return request("/auth/token", {
    method: "POST",
    body: JSON.stringify({ ...credentials, device_name: "FlowDrop web" }),
  });
}

export async function registerClient(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...payload, device_name: "FlowDrop web" }),
  });
}

export async function fetchCurrentUser() {
  return request("/user");
}

export async function logout() {
  return request("/auth/logout", {
    method: "POST",
  });
}

export async function updateClientProfile(profile) {
  return request("/client/profile", {
    method: "PATCH",
    body: JSON.stringify({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    }),
  });
}

export async function updateCurrentUserProfile(profile) {
  if (profile.photoFile) {
    const body = new FormData();
    body.append("name", profile.name);
    body.append("email", profile.email);
    body.append("phone", profile.phone);
    body.append("profile_photo", profile.photoFile);

    if (profile.currentPassword) {
      body.append("current_password", profile.currentPassword);
    }

    if (profile.password) {
      body.append("password", profile.password);
      body.append("password_confirmation", profile.passwordConfirmation || "");
    }

    return request("/user/profile", {
      method: "POST",
      body,
    });
  }

  return request("/user", {
    method: "PATCH",
    body: JSON.stringify({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      ...(profile.currentPassword ? { current_password: profile.currentPassword } : {}),
      ...(profile.password ? {
        password: profile.password,
        password_confirmation: profile.passwordConfirmation,
      } : {}),
    }),
  });
}

export async function fetchClientAddresses() {
  const response = await request("/client/addresses");
  return response.data.map(mapClientAddress);
}

export async function createClientAddress(address) {
  const response = await request("/client/addresses", {
    method: "POST",
    body: JSON.stringify(clientAddressPayload(address)),
  });

  return mapClientAddress(response);
}

export async function updateClientAddress(address) {
  const response = await request(`/client/addresses/${address._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(clientAddressPayload(address)),
  });

  return mapClientAddress(response);
}

export async function deleteClientAddress(address) {
  return request(`/client/addresses/${address._apiId}`, { method: "DELETE" });
}

export async function makeClientAddressDefault(address) {
  const response = await request(`/client/addresses/${address._apiId}/default`, {
    method: "PATCH",
  });

  return mapClientAddress(response);
}

export async function fetchClientShops() {
  const response = await request("/client/shops");
  return response.data.map(mapShop);
}

export async function createClientShop(shop) {
  const response = await request("/client/shops", {
    method: "POST",
    body: JSON.stringify(shopPayload(shop)),
  });

  return mapShop(response);
}

export async function updateClientShop(shop) {
  const response = await request(`/client/shops/${shop._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(shopPayload(shop)),
  });

  return mapShop(response);
}

export async function deleteClientShop(shop) {
  return request(`/client/shops/${shop._apiId}`, { method: "DELETE" });
}

export async function makeClientShopDefault(shop) {
  const response = await request(`/client/shops/${shop._apiId}/default`, {
    method: "PATCH",
  });

  return mapShop(response);
}

export function mapNotification(notification) {
  return {
    id: notification.id,
    title: notification.data?.title || "Delivery update",
    body: notification.data?.body || "",
    kind: notification.data?.kind || "activity",
    orderCode: notification.data?.order_code || "",
    status: notification.data?.status || null,
    readAt: notification.read_at,
    createdAt: notification.created_at ? new Date(notification.created_at).toLocaleString() : "Just now",
  };
}

export async function fetchNotifications() {
  const response = await request("/notifications?per_page=50");
  return response.data.map(mapNotification);
}

export async function markNotificationRead(notificationId) {
  const response = await request(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });

  return mapNotification(response);
}

export function mapOrder(order) {
  return {
    _apiId: order.id,
    id: order.code,
    createdDate: order.created_at ? dateInputValue(order.created_at) : "",
    createdAt: order.created_at ? new Date(order.created_at).toLocaleString() : "Just now",
    updatedAt: order.updated_at ? new Date(order.updated_at).toLocaleString() : "Just now",
    client: order.client_name || "",
    clientPhone: order.client_phone || "",
    creatorType: order.client_user_id ? "client" : "office",
    creatorUserId: order.client_user_id || "",
    creatorAccountName: order.client_user?.name || "",
    creatorAccountPhone: order.client_user?.phone || "",
    creatorAccountEmail: order.client_user?.email || "",
    creatorName: order.client_user?.name || order.client_name || "",
    creatorPhone: order.client_user?.phone || order.client_phone || "",
    creatorEmail: order.client_user?.email || "",
    pickup: order.pickup_address,
    pickupContact: order.pickup_contact_name,
    pickupPhone: order.pickup_phone,
    destination: order.receiver_address || "",
    receiver: order.receiver_name || "",
    receiverPhone: order.receiver_phone || "",
    product: order.product_name,
    category: order.product_category || "Package",
    quantity: order.quantity,
    fragile: order.is_fragile,
    note: order.client_note || order.special_handling_note || "",
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: paymentMethodLabels[order.delivery_fee_payment_method] || humanize(order.delivery_fee_payment_method),
    paymentId: order.payments?.[0]?.id || null,
    paymentScreenshot: order.payments?.[0]?.screenshot_path || null,
    paymentReviewedAt: order.payments?.[0]?.reviewed_at
      ? new Date(order.payments[0].reviewed_at).toLocaleString()
      : null,
    paymentNote: order.payments?.[0]?.note || "",
    cod: Number(order.cod_amount),
    codEnabled: order.product_payment_method === 'rider_collects',
    fee: Number(order.delivery_fee),
    riderId: order.rider?.code || null,
    riderApiId: order.rider_id || order.rider?.id || "",
    customerId: order.customer_id || "",
    customerName: order.customer?.name || "",
    shopId: order.shop_id || "",
    shopName: order.shop?.name || "",
  };
}

export function mapUser(user) {
  return {
    _apiId: user.id,
    id: `USR-${user.id}`,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profilePhotoUrl: user.profile_photo_url || "",
    role: user.role,
    createdAt: user.created_at ? new Date(user.created_at).toLocaleString() : "Just now",
  };
}

export function mapClientAddress(address) {
  return {
    _apiId: address.id,
    id: `ADDR-${address.id}`,
    label: address.label,
    recipientName: address.recipient_name,
    phone: address.phone,
    address: address.address,
    isDefault: Boolean(address.is_default),
    note: address.note || "",
  };
}

export function mapCustomer(customer) {
  return {
    _apiId: customer.id,
    id: `CUS-${customer.id}`,
    userId: customer.user_id || "",
    name: customer.name,
    phone: customer.phone,
    email: customer.email || "",
    type: customer.type || "individual",
    address: customer.address || "",
    note: customer.note || "",
    ordersCount: customer.delivery_orders_count || 0,
  };
}

export function mapShop(shop) {
  return {
    _apiId: shop.id,
    id: `SHP-${shop.id}`,
    customerId: shop.customer_id || "",
    customerName: shop.customer?.name || "",
    name: shop.name,
    contactName: shop.contact_name || "",
    phone: shop.phone,
    email: shop.email || "",
    address: shop.address || "",
    status: shop.status || "active",
    isDefault: Boolean(shop.is_default),
    note: shop.note || "",
    ordersCount: shop.delivery_orders_count || 0,
  };
}

export function mapSetting(setting) {
  return {
    _apiId: setting.id,
    id: setting.key,
    key: setting.key,
    value: setting.value ?? "",
    group: setting.group || "general",
    description: setting.description || "",
  };
}

export function formatSettingValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function serializeSettingValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

export function settingValueForInput(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export async function fetchPublicSettings() {
  const response = await request("/settings/public");
  return response.data.map(mapSetting);
}

export function mapPayment(payment) {
  return {
    _apiId: payment.id,
    id: `PAY-${payment.id}`,
    orderApiId: payment.delivery_order_id,
    orderCode: payment.delivery_order?.code || "",
    client: payment.delivery_order?.client_name || "",
    type: payment.type,
    method: payment.method,
    amount: Number(payment.amount),
    status: payment.status,
    note: payment.note || "",
    screenshotPath: payment.screenshot_path || "",
    reviewedAt: payment.reviewed_at ? new Date(payment.reviewed_at).toLocaleString() : "",
    createdAt: payment.created_at ? new Date(payment.created_at).toLocaleString() : "Just now",
  };
}

export function mapRider(rider) {
  return {
    _apiId: rider.id,
    userId: rider.user_id || "",
    id: rider.code,
    name: rider.name,
    initials: initials(rider.name),
    phone: rider.phone || rider.user?.phone || "",
    email: rider.email || rider.user?.email || "",
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
  return requestAllPages("/delivery-orders", mapOrder);
}

export async function updateDeliveryOrder(order) {
  const response = await request(`/delivery-orders/${order._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(orderPayload(order)),
  });

  return mapOrder(response);
}

export async function deleteDeliveryOrder(order) {
  return request(`/delivery-orders/${order._apiId}`, {
    method: "DELETE",
  });
}

export async function fetchRiders() {
  const response = await request("/riders");
  return response.data.map(mapRider);
}

export async function fetchUsers() {
  return requestAllPages("/users", mapUser);
}

export async function createUser(user) {
  const response = await request("/users", {
    method: "POST",
    body: JSON.stringify(userPayload(user)),
  });

  return mapUser(response);
}

export async function updateUser(user) {
  const response = await request(`/users/${user._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(userPayload(user)),
  });

  return mapUser(response);
}

export async function deleteUser(user) {
  return request(`/users/${user._apiId}`, { method: "DELETE" });
}

export async function fetchCustomers() {
  const response = await request("/customers?per_page=100");
  return response.data.map(mapCustomer);
}

export async function searchCustomers({ search = "", perPage = 15 } = {}) {
  const params = new URLSearchParams({ per_page: String(perPage) });
  if (search) {
    params.set("search", search);
  }
  const response = await request(`/customers?${params}`);
  return response.data.map(mapCustomer);
}

export async function searchShops({ search = "", customerId = "", perPage = 15, status = "active" } = {}) {
  const params = new URLSearchParams({ per_page: String(perPage) });
  if (search) {
    params.set("search", search);
  }
  if (customerId) {
    params.set("customer_id", String(customerId));
  }
  if (status) {
    params.set("status", status);
  }
  const response = await request(`/shops?${params}`);
  return response.data.map(mapShop);
}

export async function searchShippingAddresses({ search = "", customerId = "", perPage = 15 } = {}) {
  const params = new URLSearchParams({ per_page: String(perPage) });
  if (search) {
    params.set("search", search);
  }
  if (customerId) {
    params.set("customer_id", String(customerId));
  }
  const response = await request(`/shipping-addresses?${params}`);
  return response.data.map(mapOfficeShippingAddress);
}

export function mapOfficeShippingAddress(address) {
  return {
    _apiId: address.id,
    id: `ADDR-${address.id}`,
    label: address.label,
    recipientName: address.recipient_name,
    phone: address.phone,
    address: address.address,
    isDefault: Boolean(address.is_default),
    note: address.note || "",
    ownerName: address.user?.name || "",
    ownerPhone: address.user?.phone || "",
  };
}

export async function createCustomer(customer) {
  const response = await request("/customers", {
    method: "POST",
    body: JSON.stringify(customerPayload(customer)),
  });

  return mapCustomer(response);
}

export async function updateCustomer(customer) {
  const response = await request(`/customers/${customer._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(customerPayload(customer)),
  });

  return mapCustomer(response);
}

export async function deleteCustomer(customer) {
  return request(`/customers/${customer._apiId}`, { method: "DELETE" });
}

export async function fetchShops() {
  const response = await request("/shops?per_page=100");
  return response.data.map(mapShop);
}

export async function createShop(shop) {
  const response = await request("/shops", {
    method: "POST",
    body: JSON.stringify(shopPayload(shop)),
  });

  return mapShop(response);
}

export async function updateShop(shop) {
  const response = await request(`/shops/${shop._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(shopPayload(shop)),
  });

  return mapShop(response);
}

export async function deleteShop(shop) {
  return request(`/shops/${shop._apiId}`, { method: "DELETE" });
}

export async function fetchSettings() {
  const response = await request("/settings");
  return response.data.map(mapSetting);
}

export async function createSetting(setting) {
  const response = await request("/settings", {
    method: "POST",
    body: JSON.stringify(settingPayload(setting)),
  });

  return mapSetting(response);
}

export async function updateSetting(setting) {
  const response = await request(`/settings/${setting._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(settingPayload(setting)),
  });

  return mapSetting(response);
}

export async function deleteSetting(setting) {
  return request(`/settings/${setting._apiId}`, { method: "DELETE" });
}

export async function createRider(rider) {
  const response = await request("/riders", {
    method: "POST",
    body: JSON.stringify(riderPayload(rider)),
  });

  return mapRider(response);
}

export async function updateRider(rider) {
  const response = await request(`/riders/${rider._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(riderPayload(rider)),
  });

  return mapRider(response);
}

export async function deleteRider(rider) {
  return request(`/riders/${rider._apiId}`, {
    method: "DELETE",
  });
}

export async function collectRiderHeldFees(rider, payload) {
  const response = await request(`/riders/${rider._apiId}/settlements`, {
    method: "POST",
    body: JSON.stringify({
      amount: Number(payload.amount || 0),
      note: payload.note || null,
    }),
  });

  return {
    rider: mapRider(response.rider),
    settlement: response.settlement,
  };
}

export async function createDeliveryOrder(order) {
  const response = await request("/delivery-orders", {
    method: "POST",
    body: JSON.stringify(orderPayload(order)),
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

export async function fetchPayments() {
  const response = await request("/payments?per_page=100");
  return response.data.map(mapPayment);
}

export async function createPayment(payment) {
  const response = await request("/payments", {
    method: "POST",
    body: JSON.stringify(paymentPayload(payment)),
  });

  return mapPayment(response);
}

export async function updatePayment(payment) {
  const response = await request(`/payments/${payment._apiId}`, {
    method: "PATCH",
    body: JSON.stringify(paymentPayload(payment)),
  });

  return mapPayment(response);
}

export async function deletePayment(payment) {
  return request(`/payments/${payment._apiId}`, {
    method: "DELETE",
  });
}

export async function assignDeliveryOrder(order, rider) {
  const response = await request(`/delivery-orders/${order._apiId}/assign`, {
    method: "POST",
    body: JSON.stringify({ rider_id: rider._apiId }),
  });

  return mapOrder(response);
}

export async function updateDeliveryOrderStatus(order, status, deliveryFee, note = "", details = {}) {
  const body = {
    status,
    actor_type: "rider",
    ...details,
  };

  if (deliveryFee !== undefined && deliveryFee !== null) {
    body.delivery_fee = deliveryFee;
  }

  if (note) {
    body.note = note;
  }

  const response = await request(`/delivery-orders/${order._apiId}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
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

function orderPayload(order) {
  return {
    customer_id: order.customerId || null,
    shop_id: order.shopId || null,
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
    is_fragile: Boolean(order.fragile),
    delivery_fee_payment_method: deliveryFeePaymentMethodValue(order.paymentMethod),
    ...(order.codEnabled !== undefined
      ? {
          product_payment_method: order.codEnabled ? "rider_collects" : "already_paid",
          cod_amount: order.codEnabled ? Number(order.cod || 0) : 0,
        }
      : order._apiId
        ? {}
        : {
            product_payment_method: "already_paid",
            cod_amount: 0,
          }),
    delivery_fee: Number(order.fee || 0),
    client_note: order.note,
    internal_note: order.internalNote,
    ...(order.status ? { status: order.status } : {}),
    ...(order.paymentStatus ? { payment_status: order.paymentStatus } : {}),
  };
}

function deliveryFeePaymentMethodValue(method = "Cash") {
  const normalized = String(method).toLowerCase().replaceAll(" ", "_");

  if (["banking", "mobile_banking"].includes(normalized)) {
    return "mobile_banking";
  }

  if (["cash", "cash_on_delivery"].includes(normalized)) {
    return "cash";
  }

  return normalized;
}

function userPayload(user) {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    ...(user.password ? { password: user.password } : {}),
  };
}

function customerPayload(customer) {
  return {
    user_id: customer.userId || null,
    name: customer.name,
    phone: customer.phone,
    email: customer.email || null,
    type: customer.type || "individual",
    address: customer.address || null,
    note: customer.note || null,
  };
}

function shopPayload(shop) {
  return {
    customer_id: shop.customerId || null,
    name: shop.name,
    contact_name: shop.contactName || null,
    phone: shop.phone,
    email: shop.email || null,
    address: shop.address,
    status: shop.status || "active",
    is_default: Boolean(shop.isDefault),
    note: shop.note || null,
  };
}

function settingPayload(setting) {
  return {
    key: setting.key,
    value: serializeSettingValue(setting.value),
    group: setting.group || "general",
    description: setting.description || null,
  };
}

function riderPayload(rider) {
  return {
    code: rider.id,
    name: rider.name,
    phone: rider.phone,
    email: rider.email || null,
    ...(rider.password ? { password: rider.password } : {}),
    status: rider.status,
    vehicle_type: rider.vehicle?.toLowerCase().replaceAll(" ", "_") || "motorbike",
    current_area: rider.area,
  };
}

function paymentPayload(payment) {
  return {
    delivery_order_id: payment.orderApiId,
    type: payment.type,
    method: payment.method,
    amount: Number(payment.amount || 0),
    status: payment.status,
    note: payment.note || null,
  };
}

function clientAddressPayload(address) {
  return {
    label: address.label,
    recipient_name: address.recipientName,
    phone: address.phone,
    address: address.address,
    is_default: Boolean(address.isDefault),
    note: address.note || null,
  };
}
