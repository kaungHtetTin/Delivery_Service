import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignDeliveryOrder,
  configureApi,
  createCashCollection,
  createClientAddress,
  createClientShop,
  createDeliveryOrder,
  createSetting,
  createShop,
  createCustomer,
  createUser,
  createRider,
  deleteCashCollection,
  deleteClientAddress,
  deleteDeliveryOrder,
  deleteSetting,
  deleteShop,
  deleteCustomer,
  deleteUser,
  deleteRider,
  fetchCashCollections,
  fetchClientAddresses,
  fetchClientShops,
  fetchCustomers,
  fetchCurrentUser,
  fetchNotifications,
  fetchOrders,
  fetchReportSummary,
  fetchRiders,
  fetchSettings,
  fetchPublicSettings,
  fetchShops,
  fetchUsers,
  login,
  logout,
  makeClientAddressDefault,
  markNotificationRead as markNotificationReadRequest,
  registerClient,
  updateCashCollection,
  updateClientAddress,
  updateClientShop,
  updateClientProfile,
  updateDeliveryOrderStatus,
  updateDeliveryOrder,
  updateSetting,
  updateShop,
  updateCustomer,
  updateUser,
  updateRider,
} from "./api";
import { Icon } from "./icons";
import { ClientPortal } from "./portals/ClientPortal";
import { RiderPortal } from "./portals/RiderPortal";
import { AdminPortal } from "./portals/AdminPortal";
import { createRealtimeConnection } from "./realtime";
import { applyPublicSettings, useStoredState } from "./utils";

const portals = new Set(["client", "rider", "admin"]);
const portalRoles = {
  client: ["client"],
  rider: ["rider"],
  admin: ["office_admin", "super_admin"],
};
const portalNames = {
  client: "Client",
  rider: "Rider",
  admin: "Office",
};
const demoAccounts = {
  client: ["client@example.test", "Client account"],
  rider: ["rider@example.test", "Rider account"],
  admin: ["office@example.test", "Office account"],
};

const errorMessage = (error) =>
  error?.payload?.message ||
  Object.values(error?.payload?.errors || {})?.[0]?.[0] ||
  error?.message ||
  "Something went wrong.";

export default function App({ apiBaseUrl, initialPortal = "client" }) {
  const portal = portals.has(initialPortal) ? initialPortal : "client";
  const [auth, setAuth] = useStoredState("flowdrop.auth", null);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [cashCollections, setCashCollections] = useState([]);
  const [clientAddresses, setClientAddresses] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [shops, setShops] = useState([]);
  const [settings, setSettings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(Boolean(auth?.token));
  const [error, setError] = useState("");
  const [theme, setTheme] = useStoredState("flowdrop.theme", "light");
  const [brand, setBrand] = useStoredState("flowdrop.brand", "#087f74");
  const [appName, setAppName] = useState("FlowDrop Delivery");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const themeStyle = useMemo(() => ({ "--color-primary": brand }), [brand]);
  const themeProps = { theme, setTheme, brand, setBrand };
  const publicSettingsHandlers = useMemo(
    () => ({ setAppName, setBrand, setContactEmail, setContactPhone, setTheme }),
    [setAppName, setBrand, setContactEmail, setContactPhone, setTheme],
  );
  const requiredRoles = portalRoles[portal];
  const hasPortalAccess = auth?.user && requiredRoles.includes(auth.user.role);

  const clearAuth = () => {
    setAuth(null);
    setOrders([]);
    setRiders([]);
    setCashCollections([]);
    setClientAddresses([]);
    setUsers([]);
    setCustomers([]);
    setShops([]);
    setSettings([]);
    setNotifications([]);
    setReportData(null);
  };

  useEffect(() => {
    configureApi({
      baseUrl: apiBaseUrl,
      token: auth?.token,
      onUnauthorized: clearAuth,
    });
  }, [apiBaseUrl, auth?.token]);

  useEffect(() => {
    fetchPublicSettings()
      .then((loadedSettings) => applyPublicSettings(loadedSettings, publicSettingsHandlers))
      .catch(() => {});
  }, [publicSettingsHandlers]);

  useEffect(() => {
    if (!auth?.token) {
      setBooting(false);
      return;
    }

    let cancelled = false;

    fetchCurrentUser()
      .then((user) => {
        if (cancelled) {
          return;
        }

        setAuth((current) => current ? { ...current, user } : current);
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBooting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  const loadData = useCallback(async () => {
    if (!hasPortalAccess) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const nextOrders = await fetchOrders();
      setOrders(nextOrders);
      setNotifications(await fetchNotifications());

      if (portal === "client") {
        setClientAddresses(await fetchClientAddresses());
        setShops(await fetchClientShops());
      }

      if (portal !== "client") {
        setRiders(await fetchRiders());
      }

      if (portal === "admin") {
        setCashCollections(await fetchCashCollections());
        setUsers(await fetchUsers());
        setCustomers(await fetchCustomers());
        setShops(await fetchShops());
        const loadedSettings = await fetchSettings();
        setSettings(loadedSettings);
        applyPublicSettings(loadedSettings, publicSettingsHandlers);
        setReportData(await fetchReportSummary());
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [hasPortalAccess, portal, publicSettingsHandlers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!hasPortalAccess) {
      return undefined;
    }

    return createRealtimeConnection({
      auth,
      orders,
      riders,
      onRefresh: loadData,
    });
  }, [auth, hasPortalAccess, loadData, orders, riders]);

  const submitOrder = async (order) => {
    const submittedOrder = await createDeliveryOrder(order);

    setOrders((current) => [
      submittedOrder,
      ...current.filter((item) => item.id !== submittedOrder.id),
    ]);
    setNotifications(await fetchNotifications());

    return submittedOrder;
  };

  const saveClientProfile = async (profile) => {
    const user = await updateClientProfile(profile);
    setAuth((current) => current ? { ...current, user } : current);

    return user;
  };

  const saveClientAddress = async (address) => {
    const savedAddress = address._apiId
      ? await updateClientAddress(address)
      : await createClientAddress(address);

    setClientAddresses(await fetchClientAddresses());

    return savedAddress;
  };

  const removeClientAddress = async (addressId) => {
    const address = clientAddresses.find((item) => item.id === addressId);

    if (!address?._apiId) {
      return;
    }

    await deleteClientAddress(address);
    setClientAddresses(await fetchClientAddresses());
  };

  const setDefaultClientAddress = async (addressId) => {
    const address = clientAddresses.find((item) => item.id === addressId);

    if (!address?._apiId) {
      return;
    }

    await makeClientAddressDefault(address);
    setClientAddresses(await fetchClientAddresses());
  };

  const saveClientShop = async (shop) => {
    const savedShop = shop._apiId
      ? await updateClientShop(shop)
      : await createClientShop(shop);

    setShops(await fetchClientShops());

    return savedShop;
  };

  const assignRider = async (orderId, riderId) => {
    const order = orders.find((item) => item.id === orderId);
    const rider = riders.find((item) => item.id === riderId);

    if (!order?._apiId || !rider?._apiId) {
      return;
    }

    const assignedOrder = await assignDeliveryOrder(order, rider);

    setOrders((current) => current.map((item) => item.id === orderId ? assignedOrder : item));
    setRiders((current) => current.map((rider) => rider.id === riderId ? { ...rider, status: "busy", activeOrders: rider.activeOrders + 1 } : rider));
    setNotifications(await fetchNotifications());
    setReportData(await fetchReportSummary());
  };

  const saveOrder = async (order) => {
    const savedOrder = order._apiId
      ? await updateDeliveryOrder(order)
      : await createDeliveryOrder(order);

    setOrders((current) => [
      savedOrder,
      ...current.filter((item) => item.id !== savedOrder.id),
    ]);

    if (portal === "admin") {
      setReportData(await fetchReportSummary());
    }

    return savedOrder;
  };

  const removeOrder = async (orderId) => {
    const order = orders.find((item) => item.id === orderId);

    if (!order?._apiId) {
      return;
    }

    await deleteDeliveryOrder(order);
    setOrders((current) => current.filter((item) => item.id !== orderId));

    if (portal === "admin") {
      setReportData(await fetchReportSummary());
    }
  };

  const saveRider = async (rider) => {
    const savedRider = rider._apiId
      ? await updateRider(rider)
      : await createRider(rider);

    setRiders((current) => [
      savedRider,
      ...current.filter((item) => item.id !== savedRider.id),
    ]);
    setReportData(await fetchReportSummary());

    return savedRider;
  };

  const removeRider = async (riderId) => {
    const rider = riders.find((item) => item.id === riderId);

    if (!rider?._apiId) {
      return;
    }

    await deleteRider(rider);
    setRiders((current) => current.filter((item) => item.id !== riderId));
    setReportData(await fetchReportSummary());
  };

  const saveCashCollection = async (collection) => {
    const savedCollection = collection._apiId
      ? await updateCashCollection(collection)
      : await createCashCollection(collection);

    setCashCollections((current) => [
      savedCollection,
      ...current.filter((item) => item.id !== savedCollection.id),
    ]);
    setRiders(await fetchRiders());
    setReportData(await fetchReportSummary());

    return savedCollection;
  };

  const saveUser = async (user) => {
    const savedUser = user._apiId ? await updateUser(user) : await createUser(user);
    setUsers((current) => [savedUser, ...current.filter((item) => item.id !== savedUser.id)]);
    return savedUser;
  };

  const removeUser = async (userId) => {
    const user = users.find((item) => item.id === userId);
    if (!user?._apiId) return;
    await deleteUser(user);
    setUsers((current) => current.filter((item) => item.id !== userId));
  };

  const saveCustomer = async (customer) => {
    const savedCustomer = customer._apiId ? await updateCustomer(customer) : await createCustomer(customer);
    setCustomers((current) => [savedCustomer, ...current.filter((item) => item.id !== savedCustomer.id)]);
    return savedCustomer;
  };

  const removeCustomer = async (customerId) => {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer?._apiId) return;
    await deleteCustomer(customer);
    setCustomers((current) => current.filter((item) => item.id !== customerId));
  };

  const saveShop = async (shop) => {
    const savedShop = shop._apiId ? await updateShop(shop) : await createShop(shop);
    setShops((current) => [savedShop, ...current.filter((item) => item.id !== savedShop.id)]);
    return savedShop;
  };

  const removeShop = async (shopId) => {
    const shop = shops.find((item) => item.id === shopId);
    if (!shop?._apiId) return;
    await deleteShop(shop);
    setShops((current) => current.filter((item) => item.id !== shopId));
  };

  const saveSetting = async (setting) => {
    await (setting._apiId ? updateSetting(setting) : createSetting(setting));
    const loadedSettings = await fetchSettings();
    setSettings(loadedSettings);
    applyPublicSettings(loadedSettings, publicSettingsHandlers);
    return loadedSettings.find((item) => item.key === setting.key) || setting;
  };

  const removeSetting = async (settingId) => {
    const setting = settings.find((item) => item.id === settingId);
    if (!setting?._apiId) return;
    await deleteSetting(setting);
    setSettings((current) => current.filter((item) => item.id !== settingId));
  };

  const removeCashCollection = async (collectionId) => {
    const collection = cashCollections.find((item) => item.id === collectionId);

    if (!collection?._apiId) {
      return;
    }

    await deleteCashCollection(collection);
    setCashCollections((current) => current.filter((item) => item.id !== collectionId));
    setRiders(await fetchRiders());
    setReportData(await fetchReportSummary());
  };

  const progressOrder = async (orderId, status, deliveryFee, note = "", details = {}) => {
    const order = orders.find((item) => item.id === orderId);

    if (!order?._apiId) {
      return;
    }

    const updatedOrder = await updateDeliveryOrderStatus(order, status, deliveryFee, note, details);

    setOrders((current) => current.map((item) => item.id === orderId ? updatedOrder : item));
    setNotifications(await fetchNotifications());

    if (["completed", "failed", "cancelled"].includes(status)) {
      setRiders(await fetchRiders());

      if (status === "completed" && portal === "admin") {
        setCashCollections(await fetchCashCollections());
        setReportData(await fetchReportSummary());
      }
    }

    return updatedOrder;
  };

  const markNotificationRead = async (notificationId) => {
    const updatedNotification = await markNotificationReadRequest(notificationId);

    setNotifications((current) => current.map((notification) => (
      notification.id === notificationId ? updatedNotification : notification
    )));
  };

  const handleAuth = (payload) => {
    setAuth(payload);
    setError("");
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // The local token is cleared even if the server-side token is already gone.
    }

    clearAuth();
  };

  if (booting) {
    return <LoadingScreen appName={appName} theme={theme} themeStyle={themeStyle} />;
  }

  if (!auth?.token) {
    return (
      <AuthScreen
        appName={appName}
        onLogin={(payload) => login(payload).then(handleAuth)}
        onRegister={(payload) => registerClient(payload).then(handleAuth)}
        portal={portal}
        theme={theme}
        themeStyle={themeStyle}
      />
    );
  }

  if (!hasPortalAccess) {
    return (
      <RoleMismatch
        appName={appName}
        onLogout={handleLogout}
        portal={portal}
        theme={theme}
        themeStyle={themeStyle}
        user={auth.user}
      />
    );
  }

  return (
    <div className="app-root" data-theme={theme} style={themeStyle}>
      {loading && <div className="data-loading">Loading live data...</div>}
      {error && <div className="data-error">{error}</div>}
      {portal === "client" && (
          <ClientPortal
            addresses={clientAddresses}
            appName={appName}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            markNotificationRead={markNotificationRead}
            notifications={notifications}
            onLogout={handleLogout}
            orders={orders}
            removeOrder={removeOrder}
            removeAddress={removeClientAddress}
            saveAddress={saveClientAddress}
            saveOrder={saveOrder}
            saveShop={saveClientShop}
            saveProfile={saveClientProfile}
            setDefaultAddress={setDefaultClientAddress}
            shops={shops}
          submitOrder={submitOrder}
          themeProps={themeProps}
          user={auth.user}
        />
      )}
      {portal === "rider" && <RiderPortal appName={appName} markNotificationRead={markNotificationRead} notifications={notifications} orders={orders} progressOrder={progressOrder} riders={riders} themeProps={themeProps} />}
      {portal === "admin" && (
        <AdminPortal
          appName={appName}
          assignRider={assignRider}
          cashCollections={cashCollections}
          customers={customers}
          orders={orders}
          removeCashCollection={removeCashCollection}
          removeCustomer={removeCustomer}
          removeOrder={removeOrder}
          removeSetting={removeSetting}
          removeShop={removeShop}
          removeUser={removeUser}
          removeRider={removeRider}
          reportData={reportData}
          riders={riders}
          saveCashCollection={saveCashCollection}
          saveCustomer={saveCustomer}
          saveOrder={saveOrder}
          saveSetting={saveSetting}
          saveShop={saveShop}
          saveUser={saveUser}
          saveRider={saveRider}
          settings={settings}
          shops={shops}
          selectedOrderId={selectedOrderId}
          setSelectedOrderId={setSelectedOrderId}
          themeProps={themeProps}
          users={users}
        />
      )}
    </div>
  );
}

function LoadingScreen({ appName, theme, themeStyle }) {
  return (
    <div className="app-root auth-page" data-theme={theme} style={themeStyle}>
      <section className="auth-panel glass">
        <div className="auth-brand">
          <span><Icon name="navigation" /></span>
          <div><strong>{appName}</strong><small>Checking session</small></div>
        </div>
      </section>
    </div>
  );
}

function AuthScreen({ appName, onLogin, onRegister, portal, theme, themeStyle }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: demoAccounts[portal][0],
    phone: "",
    password: "password",
    password_confirmation: "password",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canRegister = portal === "client";
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "signup") {
        await onRegister(form);
      } else {
        await onLogin({ email: form.email, password: form.password });
      }
    } catch (authError) {
      setError(errorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  const useDemoAccount = () => {
    setMode("login");
    setForm((current) => ({
      ...current,
      email: demoAccounts[portal][0],
      password: "password",
      password_confirmation: "password",
    }));
  };

  return (
    <div className="app-root auth-page" data-theme={theme} style={themeStyle}>
      <section className="auth-panel glass">
        <div className="auth-brand">
          <span><Icon name="navigation" /></span>
          <div>
            <strong>{appName} {portalNames[portal]}</strong>
            <small>{mode === "signup" ? "Create your client account" : "Sign in to continue"}</small>
          </div>
        </div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">Login</button>
          {canRegister && <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">Sign up</button>}
        </div>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label className="form-field">
              <span>Name</span>
              <input onChange={(event) => update("name", event.target.value)} required value={form.name} />
            </label>
          )}
          {mode === "signup" && (
            <label className="form-field">
              <span>Phone number</span>
              <input inputMode="tel" onChange={(event) => update("phone", event.target.value)} placeholder="09 xxx xxx xxx" required value={form.phone} />
            </label>
          )}
          <label className="form-field">
            <span>Email</span>
            <input onChange={(event) => update("email", event.target.value)} required type="email" value={form.email} />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input minLength={8} onChange={(event) => update("password", event.target.value)} required type="password" value={form.password} />
          </label>
          {mode === "signup" && (
            <label className="form-field">
              <span>Confirm password</span>
              <input minLength={8} onChange={(event) => update("password_confirmation", event.target.value)} required type="password" value={form.password_confirmation} />
            </label>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button className="btn primary full" disabled={submitting} type="submit">
            {submitting ? "Please wait..." : mode === "signup" ? "Create account" : "Login"}
            <Icon name="arrowRight" size={16} />
          </button>
        </form>
        <button className="auth-demo" onClick={useDemoAccount} type="button">
          Use seeded {demoAccounts[portal][1]}: {demoAccounts[portal][0]} / password
        </button>
      </section>
    </div>
  );
}

function RoleMismatch({ appName, onLogout, portal, theme, themeStyle, user }) {
  return (
    <div className="app-root auth-page" data-theme={theme} style={themeStyle}>
      <section className="auth-panel glass">
        <div className="auth-brand">
          <span><Icon name="lock" /></span>
          <div>
            <strong>Wrong portal</strong>
            <small>{user.name} is signed in as {user.role.replaceAll("_", " ")}</small>
          </div>
        </div>
        <p className="muted">This route requires a {portalNames[portal]} account.</p>
        <button className="btn primary full" onClick={onLogout} type="button">Use another account</button>
      </section>
    </div>
  );
}
