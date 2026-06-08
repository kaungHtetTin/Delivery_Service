import { useEffect, useMemo, useState } from "react";
import {
  assignDeliveryOrder,
  configureApi,
  createDeliveryOrder,
  fetchCurrentUser,
  fetchNotifications,
  fetchOrders,
  fetchReportSummary,
  fetchRiders,
  login,
  logout,
  markNotificationRead as markNotificationReadRequest,
  registerClient,
  reviewPayment,
  updateDeliveryOrderStatus,
} from "./api";
import { Icon } from "./icons";
import { ClientPortal } from "./portals/ClientPortal";
import { RiderPortal } from "./portals/RiderPortal";
import { AdminPortal } from "./portals/AdminPortal";
import { useStoredState } from "./utils";

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
  const [notifications, setNotifications] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(Boolean(auth?.token));
  const [error, setError] = useState("");
  const [theme, setTheme] = useStoredState("flowdrop.theme", "light");
  const [brand, setBrand] = useStoredState("flowdrop.brand", "#087f74");
  const themeStyle = useMemo(() => ({ "--color-primary": brand }), [brand]);
  const themeProps = { theme, setTheme, brand, setBrand };
  const requiredRoles = portalRoles[portal];
  const hasPortalAccess = auth?.user && requiredRoles.includes(auth.user.role);

  const clearAuth = () => {
    setAuth(null);
    setOrders([]);
    setRiders([]);
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

  const loadData = async () => {
    if (!hasPortalAccess) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const nextOrders = await fetchOrders();
      setOrders(nextOrders);
      setNotifications(await fetchNotifications());

      if (portal !== "client") {
        setRiders(await fetchRiders());
      }

      if (portal === "admin") {
        setReportData(await fetchReportSummary());
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hasPortalAccess, portal]);

  const submitOrder = async (order) => {
    const submittedOrder = await createDeliveryOrder(order);

    setOrders((current) => [
      submittedOrder,
      ...current.filter((item) => item.id !== submittedOrder.id),
    ]);
    setNotifications(await fetchNotifications());

    return submittedOrder;
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
  };

  const progressOrder = async (orderId, status) => {
    const order = orders.find((item) => item.id === orderId);

    if (!order?._apiId) {
      return;
    }

    const updatedOrder = await updateDeliveryOrderStatus(order, status);

    setOrders((current) => current.map((item) => item.id === orderId ? updatedOrder : item));
    setNotifications(await fetchNotifications());
  };

  const reviewPaymentStatus = async (orderId, status) => {
    const order = orders.find((item) => item.id === orderId);

    if (!order?.paymentId) {
      return;
    }

    const reviewedOrder = await reviewPayment(order.paymentId, status, status === "rejected" ? "Payment proof did not match the expected amount." : "");

    setOrders((current) => current.map((item) => item.id === orderId ? reviewedOrder : item));
    setNotifications(await fetchNotifications());
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
    return <LoadingScreen theme={theme} themeStyle={themeStyle} />;
  }

  if (!auth?.token) {
    return (
      <AuthScreen
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
      {portal === "client" && <ClientPortal markNotificationRead={markNotificationRead} notifications={notifications} orders={orders} submitOrder={submitOrder} themeProps={themeProps} user={auth.user} />}
      {portal === "rider" && <RiderPortal markNotificationRead={markNotificationRead} notifications={notifications} orders={orders} progressOrder={progressOrder} riders={riders} themeProps={themeProps} />}
      {portal === "admin" && <AdminPortal assignRider={assignRider} orders={orders} reportData={reportData} reviewPaymentStatus={reviewPaymentStatus} riders={riders} selectedOrderId={selectedOrderId} setSelectedOrderId={setSelectedOrderId} themeProps={themeProps} />}
      <button className="session-btn glass" onClick={handleLogout} type="button">
        <Icon name="user" size={15} />
        {auth.user.name}
      </button>
    </div>
  );
}

function LoadingScreen({ theme, themeStyle }) {
  return (
    <div className="app-root auth-page" data-theme={theme} style={themeStyle}>
      <section className="auth-panel glass">
        <div className="auth-brand">
          <span><Icon name="navigation" /></span>
          <div><strong>FlowDrop</strong><small>Checking session</small></div>
        </div>
      </section>
    </div>
  );
}

function AuthScreen({ onLogin, onRegister, portal, theme, themeStyle }) {
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
            <strong>FlowDrop {portalNames[portal]}</strong>
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

function RoleMismatch({ onLogout, portal, theme, themeStyle, user }) {
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
