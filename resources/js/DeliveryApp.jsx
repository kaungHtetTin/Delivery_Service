import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignDeliveryOrder,
  collectRiderHeldFees,
  configureApi,
  createClientAddress,
  createClientShop,
  createCommissionRule,
  createDeliveryOrder,
  createFinanceCategory,
  createFinanceTransaction,
  createSetting,
  createShop,
  createCustomer,
  createUser,
  createRider,
  deleteClientAddress,
  deleteClientShop,
  deleteCommissionRule,
  deleteDeliveryOrder,
  deleteFinanceCategory,
  deleteFinanceTransaction,
  deleteSetting,
  deleteShop,
  deleteCustomer,
  deleteUser,
  deleteRider,
  fetchClientAddresses,
  fetchClientShops,
  fetchCommissionRules,
  fetchCustomers,
  fetchCurrentUser,
  fetchFinanceCategories,
  fetchFinanceSummary,
  fetchFinanceTransactions,
  fetchNotifications,
  fetchOrders,
  fetchRealtimeToken,
  fetchReportSummary,
  fetchRiders,
  fetchSettings,
  fetchSystemHealth,
  fetchPublicSettings,
  fetchShops,
  fetchUsers,
  login,
  logout,
  makeClientAddressDefault,
  makeClientShopDefault,
  markNotificationRead as markNotificationReadRequest,
  mapLocation,
  reportRiderGpsEvent as reportRiderGpsEventRequest,
  registerClient,
  sendRiderLocation,
  startRiderActive,
  stopRiderActive,
  updateClientAddress,
  updateClientShop,
  updateCommissionRule,
  updateClientProfile,
  updateCurrentUserProfile,
  updateDeliveryOrderStatus,
  updateDeliveryOrder,
  updateFinanceCategory,
  updateFinanceTransaction,
  updateSetting,
  uploadSettingAsset,
  updateShop,
  updateCustomer,
  updateUser,
  updateRider,
} from "./api";
import { Icon } from "./icons";
import { ClientPortal } from "./portals/ClientPortal";
import { RiderPortal } from "./portals/RiderPortal";
import { AdminPortal } from "./portals/AdminPortal";
import { disablePushNotifications, enablePushNotifications, getBrowserPushPermissionStatus, syncPushNotifications } from "./pushNotifications";
import { createRealtimeConnection } from "./realtime";
import { playWorkflowAlert, unlockAlertAudio } from "./alertAudio";
import { applyPublicSettings, currentMonthDateRange, useStoredState } from "./utils";

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
const emptyRealtimeRecords = [];
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

const alertCooldownMs = 2500;

function showForegroundPushNotification(payload, appBaseUrl = "") {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const notification = payload?.notification || {};
  const data = payload?.data || {};
  const title = notification.title || data.title || "Delivery update";
  const body = notification.body || data.body || "";
  const link = data.link || window.location.href;
  const icon = new URL("pwa-icon-192.png", `${(appBaseUrl || window.location.origin).replace(/\/$/, "")}/`).toString();
  const tag = data.notification_id || data.order_id || undefined;

  try {
    const browserNotification = new Notification(title, {
      body,
      icon,
      tag,
      renotify: false,
      data: { link },
    });

    browserNotification.onclick = () => {
      window.focus();
      if (link) {
        window.location.href = link;
      }
      browserNotification.close();
    };
  } catch {
    // Foreground browser notifications are a best-effort enhancement.
  }
}

export default function App({ appBaseUrl = "", apiBaseUrl, initialPortal = "client" }) {
  const portal = portals.has(initialPortal) ? initialPortal : "client";
  const [auth, setAuth] = useStoredState("flowdrop.auth", null);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [clientAddresses, setClientAddresses] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [shops, setShops] = useState([]);
  const [settings, setSettings] = useState([]);
  const [commissionRules, setCommissionRules] = useState([]);
  const [financeCategories, setFinanceCategories] = useState([]);
  const [financeTransactions, setFinanceTransactions] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(Boolean(auth?.token));
  const [error, setError] = useState("");
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [pushStatus, setPushStatus] = useState({ state: "default", message: "Push alerts are off on this device." });
  const [theme, setTheme] = useState("light");
  const [brand, setBrand] = useStoredState("flowdrop.brand", "#087f74");
  const [appName, setAppName] = useState("FlowDrop Delivery");
  const [appIconUrl, setAppIconUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const lastAlertSoundRef = useRef({ key: "", playedAt: 0 });
  const themeStyle = useMemo(() => ({ "--color-primary": brand }), [brand]);
  const publicSettingsHandlers = useMemo(
    () => ({ setAppIconUrl, setAppName, setBrand, setContactEmail, setContactPhone, setFaviconUrl }),
    [setAppIconUrl, setAppName, setBrand, setContactEmail, setContactPhone, setFaviconUrl],
  );
  const mapTileUrl = useMemo(() => {
    const base = appBaseUrl || window.location.origin;

    return `${base.replace(/\/$/, "")}/map-tiles/{z}/{x}/{y}`;
  }, [appBaseUrl]);
  const requiredRoles = portalRoles[portal];
  const hasPortalAccess = auth?.user && requiredRoles.includes(auth.user.role);
  const realtimeOrderIds = useMemo(
    () => orders
      .map((order) => order._apiId)
      .filter(Boolean)
      .map(String)
      .sort((first, second) => first.localeCompare(second))
      .join("|"),
    [orders],
  );
  const realtimeOrders = useMemo(
    () => realtimeOrderIds
      ? realtimeOrderIds.split("|").map((id) => ({ _apiId: id }))
      : emptyRealtimeRecords,
    [realtimeOrderIds],
  );
  const realtimeRiders = portal === "admin" || portal === "client" ? emptyRealtimeRecords : riders;
  const pushStorageKey = auth?.user?.id
    ? `flowdrop.firebase.messaging_token.user.${auth.user.id}`
    : "flowdrop.firebase.messaging_token.guest";

  const playWorkflowSound = useCallback((kind, key = kind) => {
    const now = Date.now();
    const lastAlertSound = lastAlertSoundRef.current;

    if (lastAlertSound.key === key && now - lastAlertSound.playedAt < alertCooldownMs) {
      return;
    }

    lastAlertSoundRef.current = { key, playedAt: now };
    playWorkflowAlert(kind).catch(() => {});
  }, []);

  const maybePlayPayloadSound = useCallback((payload = {}) => {
    const data = payload.data || payload;
    const orderKey = data.order_id || data.orderId || data.id || data.order_code || data.code || "";

    if (portal === "rider" && data.kind === "new_assignment") {
      playWorkflowSound("rider_assignment", `rider_assignment:${orderKey}`);
      return;
    }

    if (portal === "client" && data.kind === "status_updated" && data.status === "delivered") {
      playWorkflowSound("client_delivered", `client_delivered:${orderKey}`);
    }
  }, [playWorkflowSound, portal]);

  const handleRealtimeEvent = useCallback((eventName, payload = {}) => {
    if (portal === "rider" && eventName === "order:assigned") {
      playWorkflowSound("rider_assignment", `rider_assignment:${payload.order_id || payload.id || payload.code || ""}`);
      return;
    }

    if (portal === "client" && eventName === "order:status-updated" && payload.status === "delivered") {
      playWorkflowSound("client_delivered", `client_delivered:${payload.order_id || payload.id || payload.code || ""}`);
    }
  }, [playWorkflowSound, portal]);

  const clearAuth = () => {
    setAuth(null);
    setOrders([]);
    setRiders([]);
    setClientAddresses([]);
    setUsers([]);
    setCustomers([]);
    setShops([]);
    setSettings([]);
    setCommissionRules([]);
    setFinanceCategories([]);
    setFinanceTransactions([]);
    setFinanceSummary(null);
    setNotifications([]);
    setReportData(null);
    setSystemHealth(null);
    setSocketStatus("disconnected");
    setPushStatus({ state: "default", message: "Push alerts are off on this device." });
  };

  useEffect(() => {
    configureApi({
      baseUrl: apiBaseUrl,
      token: auth?.token,
      onUnauthorized: clearAuth,
    });
  }, [apiBaseUrl, auth?.token]);

  const userThemeKey = auth?.user?.id
    ? `flowdrop.theme.user.${auth.user.id}`
    : `flowdrop.theme.guest.${portal}`;

  useEffect(() => {
    try {
      setTheme(localStorage.getItem(userThemeKey) || "light");
    } catch {
      setTheme("light");
    }
  }, [userThemeKey]);

  useEffect(() => {
    try {
      localStorage.setItem(userThemeKey, theme);
    } catch {
      // Local theme preference is optional.
    }
  }, [theme, userThemeKey]);

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
        setUsers(await fetchUsers());
        setCustomers(await fetchCustomers());
        setShops(await fetchShops());
        const loadedSettings = await fetchSettings();
        setSettings(loadedSettings);
        applyPublicSettings(loadedSettings, publicSettingsHandlers);
        setReportData(await fetchReportSummary());
        setSystemHealth(await fetchSystemHealth());
        setCommissionRules(await fetchCommissionRules());
        setFinanceCategories(await fetchFinanceCategories());
        const financeDefaultFilters = currentMonthDateRange();
        setFinanceTransactions(await fetchFinanceTransactions(financeDefaultFilters));
        setFinanceSummary(await fetchFinanceSummary(financeDefaultFilters));
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [hasPortalAccess, portal, publicSettingsHandlers]);

  const handleForegroundPush = useCallback((payload) => {
    maybePlayPayloadSound(payload);
    showForegroundPushNotification(payload, appBaseUrl);
    loadData();
  }, [appBaseUrl, loadData, maybePlayPayloadSound]);

  const enablePushAlerts = useCallback(async () => {
    setPushStatus({ state: "working", message: "Enabling push alerts..." });

    try {
      await unlockAlertAudio();
      const status = await enablePushNotifications({
        appBaseUrl,
        onForegroundMessage: handleForegroundPush,
        storageKey: pushStorageKey,
      });
      setPushStatus(status);
      return status;
    } catch (pushError) {
      console.warn("[firebase] push_enable_failed", { message: pushError?.message });
      const status = { state: "error", message: "Push alerts could not be enabled." };
      setPushStatus(status);
      return status;
    }
  }, [appBaseUrl, handleForegroundPush, pushStorageKey]);

  const disablePushAlerts = useCallback(async () => {
    setPushStatus({ state: "working", message: "Disabling push alerts..." });

    try {
      const status = await disablePushNotifications({ storageKey: pushStorageKey });
      const nextStatus = status || getBrowserPushPermissionStatus({ storageKey: pushStorageKey });
      setPushStatus(nextStatus);
      return nextStatus;
    } catch (pushError) {
      console.warn("[firebase] push_disable_failed", { message: pushError?.message });
      const status = { state: "error", message: "Push alerts could not be disabled." };
      setPushStatus(status);
      return status;
    }
  }, [pushStorageKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!hasPortalAccess) {
      return undefined;
    }

    const unlock = () => {
      unlockAlertAudio().catch(() => {});
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [hasPortalAccess]);

  useEffect(() => {
    if (!hasPortalAccess) {
      return undefined;
    }

    let cancelled = false;
    setPushStatus(getBrowserPushPermissionStatus({ storageKey: pushStorageKey }));

    syncPushNotifications({
      appBaseUrl,
      onForegroundMessage: handleForegroundPush,
      storageKey: pushStorageKey,
    })
      .then((status) => {
        if (!cancelled && status.state !== "idle") {
          setPushStatus(status);
        }
      })
      .catch((pushError) => {
        console.warn("[firebase] push_sync_failed", { message: pushError?.message });
      });

    return () => {
      cancelled = true;
    };
  }, [appBaseUrl, handleForegroundPush, hasPortalAccess, portal, pushStorageKey]);

  useEffect(() => {
    if (!hasPortalAccess || typeof navigator === "undefined" || !navigator.permissions?.query) {
      return undefined;
    }

    let permissionStatus;
    let cancelled = false;
    const refreshPushStatus = () => setPushStatus(getBrowserPushPermissionStatus({ storageKey: pushStorageKey }));

    navigator.permissions.query({ name: "notifications" })
      .then((status) => {
        if (cancelled) {
          return;
        }

        permissionStatus = status;
        permissionStatus.onchange = refreshPushStatus;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [hasPortalAccess, portal, pushStorageKey]);

  useEffect(() => {
    if (!hasPortalAccess) {
      setSocketStatus("disconnected");
      return undefined;
    }

    let cancelled = false;
    let cleanup = () => {};

    fetchRealtimeToken()
      .then((realtimeAuth) => {
        if (cancelled) {
          return;
        }

        cleanup = createRealtimeConnection({
          auth,
          orders: realtimeOrders,
          riders: realtimeRiders,
          onEvent: handleRealtimeEvent,
          onRefresh: loadData,
          onStatusChange: setSocketStatus,
          socketToken: realtimeAuth.token,
        });
      })
      .catch((tokenError) => {
        if (cancelled) {
          return;
        }

        console.warn("[realtime] token_unavailable_using_unsigned_dev_auth", {
          message: tokenError?.message,
        });
        cleanup = createRealtimeConnection({
          auth,
          orders: realtimeOrders,
          riders: realtimeRiders,
          onEvent: handleRealtimeEvent,
          onRefresh: loadData,
          onStatusChange: setSocketStatus,
        });
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [auth, handleRealtimeEvent, hasPortalAccess, loadData, realtimeOrders, realtimeRiders]);

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

  const saveCurrentUserProfile = async (profile) => {
    const user = await updateCurrentUserProfile(profile);
    setAuth((current) => current ? { ...current, user } : current);
    setRiders((current) => current.map((item) => (
      String(item.userId || "") === String(user.id || "")
        ? {
            ...item,
            name: user.name,
            initials: user.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            email: user.email,
            phone: user.phone,
          }
        : item
    )));
    setUsers((current) => current.map((item) => (
      item._apiId === user.id
        ? {
            ...item,
            name: user.name,
            email: user.email,
            phone: user.phone,
            profilePhotoUrl: user.profile_photo_url || "",
            role: user.role,
          }
        : item
    )));

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

  const removeClientShop = async (shopId) => {
    const shop = shops.find((item) => item.id === shopId);

    if (!shop?._apiId) {
      return;
    }

    await deleteClientShop(shop);
    setShops(await fetchClientShops());
  };

  const setDefaultClientShop = async (shopId) => {
    const shop = shops.find((item) => item.id === shopId);

    if (!shop?._apiId) {
      return;
    }

    await makeClientShopDefault(shop);
    setShops(await fetchClientShops());
  };

  const assignRider = async (orderId, riderId) => {
    const order = orders.find((item) => item.id === orderId);
    const rider = riders.find((item) => item.id === riderId);

    if (!order?._apiId || !rider?._apiId) {
      return;
    }

    const assignedOrder = await assignDeliveryOrder(order, rider);

    setOrders((current) => current.map((item) => item.id === orderId ? assignedOrder : item));
    setRiders(await fetchRiders());
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

  const collectRiderFees = async (rider, settlement) => {
    if (!rider?._apiId) {
      return null;
    }

    const response = await collectRiderHeldFees(rider, settlement);

    setRiders((current) => current.map((item) => (
      item.id === response.rider.id ? response.rider : item
    )));

    if (portal === "admin") {
      setReportData(await fetchReportSummary());
      const financeDefaultFilters = currentMonthDateRange();
      setFinanceTransactions(await fetchFinanceTransactions(financeDefaultFilters));
      setFinanceCategories(await fetchFinanceCategories());
      setFinanceSummary(await fetchFinanceSummary(financeDefaultFilters));
    }

    return response;
  };

  const refreshFinanceData = async (filters = {}) => {
    const [transactions, summary] = await Promise.all([
      fetchFinanceTransactions(filters),
      fetchFinanceSummary(filters),
    ]);

    setFinanceTransactions(transactions);
    setFinanceSummary(summary);

    return { transactions, summary };
  };

  const saveFinanceCategory = async (category) => {
    const savedCategory = category._apiId
      ? await updateFinanceCategory(category)
      : await createFinanceCategory(category);

    setFinanceCategories((current) => [
      savedCategory,
      ...current.filter((item) => item.id !== savedCategory.id),
    ]);

    return savedCategory;
  };

  const removeFinanceCategory = async (categoryId) => {
    const category = financeCategories.find((item) => item.id === categoryId);

    if (!category?._apiId) {
      return;
    }

    const disabledCategory = await deleteFinanceCategory(category);

    if (disabledCategory) {
      setFinanceCategories((current) => current.map((item) => (
        item.id === disabledCategory.id ? disabledCategory : item
      )));
      return;
    }

    setFinanceCategories((current) => current.filter((item) => item.id !== categoryId));
  };

  const saveFinanceTransaction = async (transaction) => {
    const savedTransaction = transaction._apiId
      ? await updateFinanceTransaction(transaction)
      : await createFinanceTransaction(transaction);

    setFinanceTransactions((current) => [
      savedTransaction,
      ...current.filter((item) => item.id !== savedTransaction.id),
    ]);
    setFinanceSummary(await fetchFinanceSummary(currentMonthDateRange()));

    return savedTransaction;
  };

  const removeFinanceTransaction = async (transactionId) => {
    const transaction = financeTransactions.find((item) => item.id === transactionId);

    if (!transaction?._apiId) {
      return;
    }

    await deleteFinanceTransaction(transaction);
    setFinanceTransactions((current) => current.filter((item) => item.id !== transactionId));
    setFinanceSummary(await fetchFinanceSummary(currentMonthDateRange()));
  };

  const saveCommissionRule = async (rule) => {
    const savedRule = rule._apiId
      ? await updateCommissionRule(rule)
      : await createCommissionRule(rule);

    setCommissionRules((current) => [
      savedRule,
      ...current.filter((item) => item.id !== savedRule.id),
    ]);

    return savedRule;
  };

  const removeCommissionRule = async (ruleId) => {
    const rule = commissionRules.find((item) => item.id === ruleId);

    if (!rule?._apiId) {
      return;
    }

    await deleteCommissionRule(rule);
    setCommissionRules((current) => current.filter((item) => item.id !== ruleId));
  };

  const updateRiderInState = (nextRider) => {
    setRiders((current) => current.map((item) => (
      item.id === nextRider.id ? nextRider : item
    )));
  };

  const startRiderDuty = async (rider) => {
    const nextRider = await startRiderActive(rider);
    updateRiderInState(nextRider);

    return nextRider;
  };

  const stopRiderDuty = async (rider) => {
    const nextRider = await stopRiderActive(rider);
    updateRiderInState(nextRider);

    return nextRider;
  };

  const reportRiderLocation = async (rider, location) => {
    const savedLocation = await sendRiderLocation(rider, location);
    const recordedAt = savedLocation.recorded_at || location.recordedAt || new Date().toISOString();
    const riderLocation = mapLocation({
      ...savedLocation,
      recorded_at: recordedAt,
      latitude: savedLocation.latitude ?? location.latitude,
      longitude: savedLocation.longitude ?? location.longitude,
      accuracy: savedLocation.accuracy ?? location.accuracy ?? null,
      speed: savedLocation.speed ?? location.speed ?? null,
      heading: savedLocation.heading ?? location.heading ?? null,
      battery_percent: savedLocation.battery_percent ?? location.batteryPercent ?? null,
      source: savedLocation.source || location.source || "browser",
    });

    setRiders((current) => current.map((item) => (
      item.id === rider.id
        ? {
            ...item,
            status: item.status === "offline" ? "available" : item.status,
            lastSeen: recordedAt ? new Date(recordedAt).toLocaleString() : item.lastSeen,
            currentLocation: riderLocation,
          }
        : item
    )));

    if (savedLocation.delivery_order_id) {
      setOrders((current) => current.map((order) => (
        String(order._apiId) === String(savedLocation.delivery_order_id)
          ? { ...order, riderLocation }
          : order
      )));
    }

    return savedLocation;
  };

  const reportRiderGpsEvent = async (rider, event) => {
    if (!rider?._apiId) {
      return null;
    }

    return reportRiderGpsEventRequest(rider, event);
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

  const uploadSettingImage = async (key, file) => {
    const savedSetting = await uploadSettingAsset(key, file);
    const loadedSettings = await fetchSettings();
    setSettings(loadedSettings);
    applyPublicSettings(loadedSettings, publicSettingsHandlers);

    return loadedSettings.find((item) => item.key === savedSetting.key) || savedSetting;
  };

  const removeSetting = async (settingId) => {
    const setting = settings.find((item) => item.id === settingId);
    if (!setting?._apiId) return;
    await deleteSetting(setting);
    setSettings((current) => current.filter((item) => item.id !== settingId));
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
    return <LoadingScreen appIconUrl={appIconUrl} appName={appName} theme={theme} themeStyle={themeStyle} />;
  }

  if (!auth?.token) {
    return (
      <AuthScreen
        appIconUrl={appIconUrl}
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
        appIconUrl={appIconUrl}
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
            disablePushAlerts={disablePushAlerts}
            appIconUrl={appIconUrl}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            enablePushAlerts={enablePushAlerts}
            markNotificationRead={markNotificationRead}
            mapTileUrl={mapTileUrl}
            notifications={notifications}
            onLogout={handleLogout}
            onRefresh={loadData}
            onThemeChange={setTheme}
            orders={orders}
            pushStatus={pushStatus}
            removeOrder={removeOrder}
            removeAddress={removeClientAddress}
            removeShop={removeClientShop}
            saveAddress={saveClientAddress}
            saveOrder={saveOrder}
            saveShop={saveClientShop}
            saveProfile={saveClientProfile}
            setDefaultAddress={setDefaultClientAddress}
            setDefaultShop={setDefaultClientShop}
            shops={shops}
            socketStatus={socketStatus}
            submitOrder={submitOrder}
            theme={theme}
            user={auth.user}
          />
      )}
      {portal === "rider" && (
        <RiderPortal
          appBaseUrl={appBaseUrl}
          appIconUrl={appIconUrl}
          appName={appName}
          disablePushAlerts={disablePushAlerts}
          enablePushAlerts={enablePushAlerts}
          mapTileUrl={mapTileUrl}
          markNotificationRead={markNotificationRead}
          notifications={notifications}
          onGpsEvent={reportRiderGpsEvent}
          onLocation={reportRiderLocation}
          onLogout={handleLogout}
          onRefresh={loadData}
          onStartActive={startRiderDuty}
          onStopActive={stopRiderDuty}
          onThemeChange={setTheme}
          orders={orders}
          progressOrder={progressOrder}
          pushStatus={pushStatus}
          riders={riders}
          saveProfile={saveCurrentUserProfile}
          socketStatus={socketStatus}
          theme={theme}
          user={auth.user}
        />
      )}
      {portal === "admin" && (
        <AdminPortal
          appName={appName}
          appIconUrl={appIconUrl}
          assignRider={assignRider}
          commissionRules={commissionRules}
          collectRiderFees={collectRiderFees}
          customers={customers}
          financeCategories={financeCategories}
          financeSummary={financeSummary}
          financeTransactions={financeTransactions}
          disablePushAlerts={disablePushAlerts}
          enablePushAlerts={enablePushAlerts}
          markNotificationRead={markNotificationRead}
          mapTileUrl={mapTileUrl}
          notifications={notifications}
          onRefresh={loadData}
          onRefreshFinance={refreshFinanceData}
          onThemeChange={setTheme}
          orders={orders}
          removeCommissionRule={removeCommissionRule}
          removeFinanceCategory={removeFinanceCategory}
          removeFinanceTransaction={removeFinanceTransaction}
          removeCustomer={removeCustomer}
          removeOrder={removeOrder}
          removeSetting={removeSetting}
          removeShop={removeShop}
          removeUser={removeUser}
          removeRider={removeRider}
          reportData={reportData}
          pushStatus={pushStatus}
          riders={riders}
          saveCustomer={saveCustomer}
          saveCommissionRule={saveCommissionRule}
          saveFinanceCategory={saveFinanceCategory}
          saveFinanceTransaction={saveFinanceTransaction}
          saveOrder={saveOrder}
          saveSetting={saveSetting}
          uploadSettingImage={uploadSettingImage}
          saveProfile={saveCurrentUserProfile}
          saveShop={saveShop}
          saveUser={saveUser}
          saveRider={saveRider}
          settings={settings}
          shops={shops}
          selectedOrderId={selectedOrderId}
          setSelectedOrderId={setSelectedOrderId}
          socketStatus={socketStatus}
          systemHealth={systemHealth}
          theme={theme}
          onLogout={handleLogout}
          user={auth.user}
          users={users}
        />
      )}
    </div>
  );
}

function LoadingScreen({ appIconUrl = "", appName, theme, themeStyle }) {
  return (
    <div className="app-root auth-page" data-theme={theme} style={themeStyle}>
      <section className="auth-panel glass">
        <div className="auth-brand">
          <span>{appIconUrl ? <img alt="" src={appIconUrl} /> : <Icon name="navigation" />}</span>
          <div><strong>{appName}</strong><small>Checking session</small></div>
        </div>
      </section>
    </div>
  );
}

function AuthScreen({ appIconUrl = "", appName, onLogin, onRegister, portal, theme, themeStyle }) {
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
          <span>{appIconUrl ? <img alt="" src={appIconUrl} /> : <Icon name="navigation" />}</span>
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

function RoleMismatch({ appIconUrl = "", appName, onLogout, portal, theme, themeStyle, user }) {
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
