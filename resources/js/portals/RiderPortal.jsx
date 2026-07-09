import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "../icons";
import { deliveryFeeCashDue, formatDeliveryFeeLabel, money, useStoredState } from "../utils";
import { nextRiderActions } from "../data";
import { AddressBlock, MobileNav, MobilePlaceholder, MobileTopbar, NotificationList, StatusBadge } from "../components/shared";
import { bumpQueuedLocationRetry, countQueuedRiderLocations, enqueueRiderLocation, getQueuedRiderLocations, removeQueuedLocation } from "../offlineLocationQueue";

const historyStatuses = new Set(["completed", "failed", "cancelled"]);
const dutyActiveStatuses = new Set(["online", "available", "busy"]);
const gpsLinkedOrderStatuses = new Set([
  "picked_up",
  "going_to_delivery",
  "arrived_at_delivery",
  "delivered",
  "rider_accepted",
  "going_to_pickup",
  "arrived_at_pickup",
  "rider_assigned",
]);

const gpsErrorMessages = {
  1: "Location permission was denied. You can continue working, but office cannot see your live position.",
  2: "Location is unavailable right now. Move outside or check GPS/network settings.",
  3: "Location request timed out. Tracking will retry automatically.",
};

function distanceMeters(from, to) {
  if (!from || !to) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadius = 6371000;
  const latitudeA = from.latitude * Math.PI / 180;
  const latitudeB = to.latitude * Math.PI / 180;
  const deltaLatitude = (to.latitude - from.latitude) * Math.PI / 180;
  const deltaLongitude = (to.longitude - from.longitude) * Math.PI / 180;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function getBatteryPercent() {
  if (!navigator.getBattery) {
    return null;
  }

  try {
    const battery = await navigator.getBattery();
    return Math.round(battery.level * 100);
  } catch {
    return null;
  }
}

function shouldDropQueuedLocation(error) {
  if (error?.response?.status !== 422) {
    return false;
  }

  const validationErrors = error?.payload?.errors || {};
  const discardableFields = ["recorded_at", "delivery_order_id", "latitude", "longitude", "source"];

  return discardableFields.some((field) => validationErrors[field]);
}

export function RiderPortal({ appIconUrl = "", appName, mapTileUrl, markNotificationRead, notifications = [], onGpsEvent, onLocation, onLogout, onStartActive, onStopActive, onThemeChange, orders, progressOrder, riders, saveProfile, socketStatus = "disconnected", theme, user }) {
  const [page, setPage] = useStoredState("flowdrop.rider.page", "jobs");
  const [selectedId, setSelectedId] = useStoredState("flowdrop.rider.selectedOrder", null);
  const rider = riders[0];
  const riderOrders = rider ? orders.filter((order) => order.riderId === rider.id) : [];
  const activeOrders = riderOrders.filter((order) => !historyStatuses.has(order.status));
  const historyOrders = riderOrders.filter((order) => historyStatuses.has(order.status));
  const selectedOrder = riderOrders.find((order) => order.id === selectedId);
  const incompleteOrderCount = activeOrders.length;
  const gpsTracking = useRiderGpsTracking({
    activeOrders,
    onGpsEvent,
    onLocation,
    onStartActive,
    onStopActive,
    rider,
  });

  if (!rider) {
    return (
      <div className="mobile-app rider-app">
        <MobileTopbar appIconUrl={appIconUrl} appName={appName} onThemeChange={onThemeChange} socketStatus={socketStatus} theme={theme} unreadCount={incompleteOrderCount} />
        <main className="mobile-content">
          <MobilePlaceholder icon="bike" title="No rider profile" />
        </main>
      </div>
    );
  }

  if (selectedOrder) {
    const isHistory = historyStatuses.has(selectedOrder.status);

    return (
      <div className="mobile-app rider-app">
        <MobileTopbar appIconUrl={appIconUrl} appName={appName} onThemeChange={onThemeChange} socketStatus={socketStatus} theme={theme} unreadCount={incompleteOrderCount} />
        <main className="mobile-content">
          <RiderJobDetail
            gpsTracking={gpsTracking}
            history={isHistory}
            onBack={() => setSelectedId(null)}
            onComplete={() => {
              setSelectedId(null);
              setPage("history");
            }}
            onProgress={progressOrder}
            order={selectedOrder}
          />
        </main>
      </div>
    );
  }
  return (
    <div className="mobile-app rider-app">
      <MobileTopbar appIconUrl={appIconUrl} appName={appName} onThemeChange={onThemeChange} socketStatus={socketStatus} theme={theme} unreadCount={incompleteOrderCount} />
      <main className="mobile-content">
        {page === "jobs" && <RiderJobs gpsTracking={gpsTracking} onOpen={setSelectedId} orders={activeOrders} rider={rider} />}
        {page === "history" && <RiderHistory onOpen={setSelectedId} orders={historyOrders} />}
        {page === "gps" && <GpsStatus activeOrders={activeOrders} gpsTracking={gpsTracking} mapTileUrl={mapTileUrl} rider={rider} />}
        {page === "notifications" && <NotificationList notifications={notifications} onRead={markNotificationRead} title="Notifications" />}
        {page === "account" && <RiderAccount onLogout={onLogout} rider={rider} saveProfile={saveProfile} user={user} />}
      </main>
      <MobileNav
        active={page}
        items={[
          ["jobs", "box", "Jobs"],
          ["history", "clock", "History"],
          ["gps", "location", "GPS"],
          ["notifications", "bell", "Alerts", false, incompleteOrderCount],
          ["account", "user", "Account"],
        ]}
        onNavigate={setPage}
      />
    </div>
  );
}

function riderUserInitials(user, rider) {
  const name = user?.name || rider?.name || "Rider";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function RiderProfileAvatar({ previewUrl = "", rider, user }) {
  const photoUrl = previewUrl || user?.profile_photo_url;

  return photoUrl
    ? <img alt="" className="profile-avatar large" src={photoUrl} />
    : <span className="profile-avatar large">{riderUserInitials(user, rider)}</span>;
}

function RiderAccount({ onLogout, rider, saveProfile, user }) {
  const [form, setForm] = useState({
    name: user?.name || rider?.name || "",
    email: user?.email || rider?.email || "",
    phone: user?.phone || rider?.phone || "",
    currentPassword: "",
    password: "",
    passwordConfirmation: "",
    photoFile: null,
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: user?.name || rider?.name || "",
      email: user?.email || rider?.email || "",
      phone: user?.phone || rider?.phone || "",
    }));
  }, [rider?.email, rider?.name, rider?.phone, user?.email, user?.name, user?.phone]);

  useEffect(() => {
    if (!form.photoFile) {
      setPhotoPreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(form.photoFile);
    setPhotoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [form.photoFile]);

  const update = (key, value) => {
    setSaved(false);
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const errorMessage = (profileError) =>
    profileError?.payload?.message ||
    Object.values(profileError?.payload?.errors || {})?.[0]?.[0] ||
    profileError?.message ||
    "Could not save profile.";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    if (form.password && form.password !== form.passwordConfirmation) {
      setError("New password and confirmation do not match.");
      setSaving(false);
      return;
    }

    try {
      await saveProfile?.(form);
      setForm((current) => ({
        ...current,
        currentPassword: "",
        password: "",
        passwordConfirmation: "",
        photoFile: null,
      }));
      setSaved(true);
    } catch (profileError) {
      setError(errorMessage(profileError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-section rider-account-page">
      <p className="eyebrow">ACCOUNT</p>
      <h1>Rider profile</h1>
      <form className="account-panel glass rider-account-form" onSubmit={handleSubmit}>
        <div className="profile-summary glass">
          <RiderProfileAvatar previewUrl={photoPreview} rider={rider} user={user} />
          <div>
            <strong>{form.name || "Rider"}</strong>
            <small>{rider?.id || "Rider account"} - {rider?.status?.replaceAll("_", " ") || "active"}</small>
          </div>
        </div>
        <label className="photo-upload glass">
          <RiderProfileAvatar previewUrl={photoPreview} rider={rider} user={user} />
          <span><strong>Profile photo</strong><small>JPG or PNG up to 2 MB</small></span>
          <input
            accept="image/*"
            onChange={(event) => update("photoFile", event.target.files?.[0] || null)}
            type="file"
          />
        </label>
        <RiderProfileField label="Full name" onChange={(value) => update("name", value)} required value={form.name} />
        <RiderProfileField inputMode="tel" label="Phone number" onChange={(value) => update("phone", value)} required value={form.phone} />
        <RiderProfileField label="Email" onChange={(value) => update("email", value)} required type="email" value={form.email} />
        <div className="rider-password-group">
          <span className="eyebrow">PASSWORD</span>
          <RiderProfileField label="Current password" onChange={(value) => update("currentPassword", value)} type="password" value={form.currentPassword} />
          <RiderProfileField label="New password" onChange={(value) => update("password", value)} type="password" value={form.password} />
          <RiderProfileField label="Confirm new password" onChange={(value) => update("passwordConfirmation", value)} type="password" value={form.passwordConfirmation} />
        </div>
        {error && <p className="auth-error">{error}</p>}
        {saved && <p className="profile-success">Profile saved.</p>}
        <button className="btn primary full" disabled={saving} type="submit">{saving ? "Saving..." : "Save profile"}</button>
      </form>
      <button className="btn secondary full account-logout" onClick={onLogout} type="button">
        <Icon name="lock" size={16} /> Logout
      </button>
    </section>
  );
}

function RiderProfileField({ inputMode, label, onChange, required = false, type = "text", value }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input inputMode={inputMode} onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} />
    </label>
  );
}

function useRiderGpsTracking({ activeOrders, onGpsEvent, onLocation, onStartActive, onStopActive, rider }) {
  const [permission, setPermission] = useState("unknown");
  const [trackingState, setTrackingState] = useState("idle");
  const [message, setMessage] = useState("");
  const [lastPosition, setLastPosition] = useState(rider?.currentLocation || null);
  const [lastSentAt, setLastSentAt] = useState(rider?.currentLocation?.recordedAt || "");
  const [queuedCount, setQueuedCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [sending, setSending] = useState(false);
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(null);
  const lastForegroundRefreshRef = useRef(0);
  const riderRef = useRef(rider);
  const ordersRef = useRef(activeOrders);
  const onGpsEventRef = useRef(onGpsEvent);
  const onLocationRef = useRef(onLocation);
  const lastGpsEventRef = useRef({});
  const dutyActive = Boolean(rider && dutyActiveStatuses.has(rider.status));

  useEffect(() => {
    riderRef.current = rider;
    ordersRef.current = activeOrders;
    onGpsEventRef.current = onGpsEvent;
    onLocationRef.current = onLocation;
  }, [activeOrders, onGpsEvent, onLocation, rider]);

  useEffect(() => {
    if (rider?.currentLocation) {
      setLastPosition(rider.currentLocation);
      setLastSentAt(rider.currentLocation.recordedAt || "");
      lastSentRef.current = {
        latitude: rider.currentLocation.latitude,
        longitude: rider.currentLocation.longitude,
        sentAt: rider.currentLocation.recordedAt ? new Date(rider.currentLocation.recordedAt).getTime() : Date.now(),
      };
    }
  }, [rider?.currentLocation]);

  useEffect(() => {
    if (!navigator.permissions?.query) {
      return undefined;
    }

    let cancelled = false;
    let permissionStatus = null;

    navigator.permissions.query({ name: "geolocation" })
      .then((status) => {
        if (cancelled) {
          return;
        }

        permissionStatus = status;
        setPermission(status.state);
        status.onchange = () => setPermission(status.state);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    refreshQueuedCount();
  }, [rider?._apiId]);

  const stopWatcher = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const refreshQueuedCount = async () => {
    setQueuedCount(await countQueuedRiderLocations(riderRef.current));
  };

  const queueLocation = async (payload, queueMessage) => {
    await enqueueRiderLocation(riderRef.current, payload);
    await refreshQueuedCount();
    setTrackingState("warning");
    setMessage(queueMessage);
  };

  const reportGpsEvent = async (event, details = {}) => {
    const activeRider = riderRef.current;

    if (!activeRider?._apiId || !onGpsEventRef.current) {
      return;
    }

    const now = Date.now();
    const lastReportedAt = lastGpsEventRef.current[event] || 0;

    if (now - lastReportedAt < 60000) {
      return;
    }

    lastGpsEventRef.current[event] = now;

    try {
      await onGpsEventRef.current(activeRider, {
        event,
        message: details.message || message || "",
        permission: details.permission || permission,
        trackingState: details.trackingState || trackingState,
        queuedCount: details.queuedCount ?? queuedCount,
        accuracy: details.accuracy ?? null,
        occurredAt: new Date(now).toISOString(),
      });
    } catch (error) {
      console.warn("[gps] event_report_failed", {
        event,
        message: error?.message,
      });
    }
  };

  const flushQueuedLocations = async () => {
    const activeRider = riderRef.current;

    if (!activeRider?._apiId || !onLocationRef.current || !navigator.onLine) {
      await refreshQueuedCount();
      return;
    }

    const queuedLocations = await getQueuedRiderLocations(activeRider);

    if (queuedLocations.length === 0) {
      setQueuedCount(0);
      return;
    }

    setFlushing(true);

    try {
      for (const record of queuedLocations) {
        try {
          await onLocationRef.current(activeRider, record.payload);
          await removeQueuedLocation(record.id);
        } catch (error) {
          if (shouldDropQueuedLocation(error)) {
            await removeQueuedLocation(record.id);
            continue;
          }

          await bumpQueuedLocationRetry(record);
          break;
        }
      }
    } finally {
      await refreshQueuedCount();
      setFlushing(false);
    }
  };

  const handleGpsError = (error) => {
    const nextPermission = error.code === 1 ? "denied" : permission;
    const eventByCode = {
      1: "permission_denied",
      2: "position_unavailable",
      3: "timeout",
    };
    const nextMessage = gpsErrorMessages[error.code] || "Could not read GPS location.";

    setPermission(nextPermission);
    setTrackingState("warning");
    setMessage(nextMessage);
    reportGpsEvent(eventByCode[error.code] || "position_unavailable", {
      message: nextMessage,
      permission: nextPermission,
      trackingState: "warning",
    });
  };

  const requestCurrentPosition = () => {
    if (!navigator.geolocation) {
      const unsupportedMessage = "This browser does not support GPS tracking.";

      setTrackingState("warning");
      setMessage(unsupportedMessage);
      reportGpsEvent("unsupported", {
        message: unsupportedMessage,
        trackingState: "warning",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => sendPosition(position, { force: true }),
      handleGpsError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  const startWatcher = () => {
    if (!navigator.geolocation) {
      const unsupportedMessage = "This browser does not support GPS tracking.";

      setTrackingState("warning");
      setMessage(unsupportedMessage);
      reportGpsEvent("unsupported", {
        message: unsupportedMessage,
        trackingState: "warning",
      });
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setTrackingState("starting");
    setMessage("");
    requestCurrentPosition();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => sendPosition(position),
      handleGpsError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  const resumeForegroundTracking = () => {
    if (!dutyActive) {
      refreshQueuedCount();
      return;
    }

    const now = Date.now();

    if (now - lastForegroundRefreshRef.current < 3000) {
      return;
    }

    lastForegroundRefreshRef.current = now;
    flushQueuedLocations();

    if (watchIdRef.current === null) {
      startWatcher();
      return;
    }

    requestCurrentPosition();
  };

  const sendPosition = async (position, { force = false } = {}) => {
    const activeRider = riderRef.current;

    if (!activeRider?._apiId || !onLocationRef.current) {
      return;
    }

    const coords = position.coords;
    const now = Date.now();
    const nextPoint = {
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    const lastSent = lastSentRef.current;
    const distance = distanceMeters(lastSent, nextPoint);
    const moving = Number(coords.speed || 0) > 0.5 || distance >= 15;
    const minInterval = moving ? 15000 : 45000;
    const elapsed = lastSent?.sentAt ? now - lastSent.sentAt : Number.POSITIVE_INFINITY;

    if (!force && lastSent && elapsed < minInterval && distance < 15) {
      setLastPosition((current) => ({
        ...current,
        ...nextPoint,
        accuracy: coords.accuracy ?? current?.accuracy ?? null,
        speed: coords.speed ?? current?.speed ?? null,
        heading: coords.heading ?? current?.heading ?? null,
      }));
      return;
    }

    const activeDelivery = ordersRef.current.find((order) => gpsLinkedOrderStatuses.has(order.status)) || ordersRef.current[0];
    const recordedAt = new Date(position.timestamp || now).toISOString();
    const batteryPercent = await getBatteryPercent();
    const locationPayload = {
      deliveryOrderApiId: activeDelivery?._apiId || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? null,
      speed: coords.speed ?? null,
      heading: coords.heading ?? null,
      batteryPercent,
      recordedAt,
      source: "browser",
    };

    setLastPosition({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? null,
      speed: coords.speed ?? null,
      heading: coords.heading ?? null,
      batteryPercent,
      recordedAt,
      source: "browser",
    });

    if (!navigator.onLine) {
      lastSentRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        sentAt: now,
      };
      const queueMessage = "Network is offline. GPS is active and this location was queued.";

      await queueLocation(locationPayload, queueMessage);
      reportGpsEvent("offline_queued", {
        message: queueMessage,
        queuedCount: queuedCount + 1,
        trackingState: "warning",
      });
      return;
    }

    setSending(true);

    try {
      await flushQueuedLocations();
      await onLocationRef.current(activeRider, locationPayload);
      lastSentRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        sentAt: now,
      };
      setPermission("granted");
      setTrackingState(coords.accuracy && coords.accuracy > 100 ? "warning" : "active");
      setMessage(coords.accuracy && coords.accuracy > 100 ? "GPS accuracy is weak, but tracking is still running." : "");
      if (coords.accuracy && coords.accuracy > 100) {
        reportGpsEvent("poor_accuracy", {
          message: "GPS accuracy is weak, but tracking is still running.",
          permission: "granted",
          trackingState: "warning",
          accuracy: coords.accuracy,
        });
      }
      setLastSentAt(recordedAt);
    } catch (error) {
      lastSentRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        sentAt: now,
      };
      await queueLocation(
        locationPayload,
        error?.payload?.message ||
          Object.values(error?.payload?.errors || {})?.[0]?.[0] ||
          error?.message ||
          "Could not send GPS location. This location was queued for retry.",
      );
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!dutyActive) {
      stopWatcher();
      setTrackingState("idle");
      return undefined;
    }

    startWatcher();

    return stopWatcher;
  }, [dutyActive, permission, rider?._apiId]);

  useEffect(() => {
    const handleOnline = () => resumeForegroundTracking();
    const handleFocus = () => resumeForegroundTracking();
    const handlePageShow = () => resumeForegroundTracking();
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        resumeForegroundTracking();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisible);

    if (dutyActive) {
      flushQueuedLocations();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dutyActive, rider?._apiId]);

  const startDuty = async () => {
    setTrackingState("starting");
    setMessage("");

    try {
      await onStartActive?.(rider);
      await flushQueuedLocations();
    } catch (error) {
      setTrackingState("warning");
      setMessage(
        error?.payload?.message ||
        Object.values(error?.payload?.errors || {})?.[0]?.[0] ||
        error?.message ||
        "Could not start active duty.",
      );
    }
  };

  const stopDuty = async () => {
    stopWatcher();
    setTrackingState("idle");
    setMessage("");

    try {
      await onStopActive?.(rider);
    } catch (error) {
      setTrackingState("warning");
      setMessage(
        error?.payload?.message ||
        Object.values(error?.payload?.errors || {})?.[0]?.[0] ||
        error?.message ||
        "Could not stop active duty.",
      );
    }
  };

  return {
    dutyActive,
    flushing,
    lastPosition,
    lastSentAt,
    message,
    permission,
    queuedCount,
    refreshPosition: requestCurrentPosition,
    sending,
    startDuty,
    stopDuty,
    trackingState,
  };
}

function RiderJobs({ gpsTracking, onOpen, orders, rider }) {
  const gpsLabel = gpsTracking.dutyActive
    ? (gpsTracking.lastSentAt ? `GPS active - ${new Date(gpsTracking.lastSentAt).toLocaleTimeString()}` : "GPS starting")
    : "GPS inactive";
  const queueLabel = gpsTracking.queuedCount > 0
    ? `, ${gpsTracking.queuedCount} queued`
    : "";

  return (
    <>
      <section className="rider-hero">
        <div>
          <p className="eyebrow">RIDER WORKSPACE</p>
          <h1>Good evening, {rider.name.split(" ")[0]}</h1>
          <p><span className={`online-dot ${gpsTracking.dutyActive ? "" : "offline"}`} /> {gpsLabel}{queueLabel}</p>
        </div>
        <label className="availability">
          <small>{gpsTracking.dutyActive ? "ACTIVE" : "OFFLINE"}</small>
          <input checked={gpsTracking.dutyActive} onChange={(event) => (event.target.checked ? gpsTracking.startDuty() : gpsTracking.stopDuty())} type="checkbox" />
          <i />
        </label>
      </section>
      <section className="mini-metrics">
        <div className="glass"><small>ACTIVE JOBS</small><strong>{orders.length}</strong></div>
        <div className="glass"><small>CASH HELD</small><strong>{money(rider.cashHeld)}</strong></div>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">TODAY</span><h2>Active assignments</h2></div></div>
        <div className="delivery-list">
          {orders.length === 0 && <MobilePlaceholder icon="box" title="No active assignments" />}
          {orders.map((order) => (
            <button className="delivery-list-card rider-job glass" key={order.id} onClick={() => onOpen(order.id)} type="button">
              <div className="card-row"><span className="order-code">{order.id}</span><StatusBadge status={order.status} /></div>
              <AddressBlock from={order.pickup} to={order.destination} />
              <div className="job-meta">
                <span><Icon name="wallet" size={14} /> Delivery fee {formatDeliveryFeeLabel(order)}</span>
                <span><Icon name="clock" size={14} /> {order.updatedAt}</span>
              </div>
              <span className="btn primary full">View next action <Icon name="arrowRight" size={16} /></span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function RiderHistory({ onOpen, orders }) {
  const [filter, setFilter] = useStoredState("flowdrop.rider.historyFilter", "all");
  const filteredOrders = filter === "all" ? orders : orders.filter((order) => order.status === filter);
  const completedCount = orders.filter((order) => order.status === "completed").length;
  const deliveryFeesTotal = filteredOrders.reduce((total, order) => total + deliveryFeeCashDue(order), 0);

  return (
    <section className="page-section">
      <p className="eyebrow">PAST ASSIGNMENTS</p>
      <h1>Job history</h1>
      <section className="mini-metrics history-metrics">
        <div className="glass"><small>TOTAL JOBS</small><strong>{orders.length}</strong></div>
        <div className="glass"><small>COMPLETED</small><strong>{completedCount}</strong></div>
        <div className="glass"><small>DELIVERY FEES</small><strong>{money(deliveryFeesTotal)}</strong></div>
      </section>
      <div className="filter-pills">
        {[
          ["all", "All"],
          ["completed", "Completed"],
          ["failed", "Failed"],
          ["cancelled", "Cancelled"],
        ].map(([value, label]) => (
          <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)} type="button">{label}</button>
        ))}
      </div>
      <div className="delivery-list">
        {filteredOrders.length === 0 && <MobilePlaceholder icon="clock" title="No matching history" />}
        {filteredOrders.map((order) => (
          <button className="delivery-list-card rider-job glass" key={order.id} onClick={() => onOpen(order.id)} type="button">
            <div className="card-row"><span className="order-code">{order.id}</span><StatusBadge status={order.status} /></div>
            <AddressBlock from={order.pickup} to={order.destination} />
            <div className="job-meta">
              <span><Icon name="wallet" size={14} /> Delivery fee {formatDeliveryFeeLabel(order)}</span>
              <span><Icon name="clock" size={14} /> {order.updatedAt}</span>
            </div>
            <span className="history-detail-link">View delivery details <Icon name="chevronRight" size={15} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function RiderJobDetail({ gpsTracking, history = false, onComplete, order, onBack, onProgress }) {
  const [completing, setCompleting] = useState(false);
  const [feeInput, setFeeInput] = useState("");
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupForm, setPickupForm] = useState({
    receiver: order.receiver || "",
    receiverPhone: order.receiverPhone || "",
    destination: order.destination || "",
    codEnabled: Boolean(order.codEnabled),
    cod: order.cod ?? "",
  });
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueNote, setIssueNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [progressing, setProgressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const action = nextRiderActions[order.status];
  const isCompleteStep = action?.[1] === "completed";
  const canReportIssue = !history && !["delivered", "completed", "failed", "cancelled"].includes(order.status);
  const pickupPhoneHref = order.pickupPhone ? `tel:${order.pickupPhone.replace(/[^\d+]/g, "")}` : "";
  const receiverPhoneHref = order.receiverPhone ? `tel:${order.receiverPhone.replace(/[^\d+]/g, "")}` : "";
  const pickupMapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.pickup)}`;
  const deliveryMapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.destination)}`;

  const errorMessage = (error) =>
    error?.payload?.message ||
    Object.values(error?.payload?.errors || {})?.[0]?.[0] ||
    error?.message ||
    "Could not update this delivery.";

  const handleAction = async () => {
    if (!action) {
      return;
    }

    setActionError("");

    if (isCompleteStep) {
      setCompleting(true);
      return;
    }

    if (action[1] === "picked_up") {
      setPickupOpen(true);
      return;
    }

    setProgressing(true);

    try {
      await onProgress(order.id, action[1]);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setProgressing(false);
    }
  };

  const confirmPickup = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError("");

    try {
      await onProgress(order.id, "picked_up", undefined, "", {
        receiver_name: pickupForm.receiver,
        receiver_phone: pickupForm.receiverPhone,
        receiver_address: pickupForm.destination,
        product_payment_method: pickupForm.codEnabled ? "rider_collects" : "already_paid",
        cod_amount: pickupForm.codEnabled ? Number(pickupForm.cod || 0) : 0,
      });
      gpsTracking?.refreshPosition?.();
      setPickupOpen(false);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmComplete = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError("");

    try {
      await onProgress(order.id, "completed", Number(feeInput || 0));
      setCompleting(false);
      onComplete?.();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const reportIssue = async (status) => {
    setSubmitting(true);
    setActionError("");

    try {
      await onProgress(order.id, status, undefined, issueNote);
      setIssueOpen(false);
      onComplete?.();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section rider-detail">
      <button className="back-btn" onClick={onBack} type="button"><Icon name="chevronLeft" size={17} /> {history ? "Job history" : "Active assignments"}</button>
      <div className="card-row">
        <div><p className="eyebrow">{history ? "DELIVERY RECORD" : "ACTIVE ASSIGNMENT"}</p><h1>{order.id}</h1></div>
        <StatusBadge status={order.status} />
      </div>
      <section className="stop-card glass">
        <div className="stop-heading"><span className="route-marker pickup" /><p className="eyebrow">PICKUP</p></div>
        <h3>{order.pickupContact}</h3><p>{order.pickup}</p>
        <div className="action-grid">
          <a className="btn secondary" href={pickupPhoneHref || undefined}><Icon name="phone" size={15} /> Call</a>
          <a className="btn primary" href={pickupMapHref} rel="noreferrer" target="_blank"><Icon name="navigation" size={15} /> Navigate</a>
        </div>
      </section>
      <section className="stop-card glass">
        <div className="stop-heading"><span className="route-marker destination" /><p className="eyebrow">DELIVERY</p></div>
        <h3>{order.receiver}</h3><p>{order.destination}</p>
        <div className="action-grid">
          <a className="btn secondary" href={receiverPhoneHref || undefined}><Icon name="phone" size={15} /> Call</a>
          <a className="btn primary" href={deliveryMapHref} rel="noreferrer" target="_blank"><Icon name="navigation" size={15} /> Navigate</a>
        </div>
      </section>
      <section className="order-summary glass">
        <div><small>PRODUCT</small><strong>{order.product}</strong></div>
        <div><small>DELIVERY FEE</small><strong>{formatDeliveryFeeLabel(order)}</strong></div>
        <div><small>PRODUCT COD</small><strong>{order.codEnabled ? (Number(order.cod) > 0 ? `On - ${money(order.cod)}` : "On") : "Off"}</strong></div>
        {history && <div><small>LAST UPDATED</small><strong>{order.updatedAt}</strong></div>}
        {order.codEnabled && (
          <p className="cod-warning-note">
            <Icon name="wallet" size={15} />
            Cash on delivery: collect product payment from receiver.
          </p>
        )}
        {order.fragile && <p className="warning-note">Fragile item - Handle with care</p>}
      </section>
      {!history && isCompleteStep && (
        <section className="cash-note glass">
          <span><Icon name="wallet" size={18} /></span>
          <div>
            <strong>Collect delivery fee in cash</strong>
            <small>Enter the final amount when you complete this order.</small>
          </div>
        </section>
      )}
      {actionError && <p className="auth-error request-error">{actionError}</p>}
      {!history && (
        <div className="sticky-actions glass">
          <button className="btn secondary" disabled={!canReportIssue || progressing} onClick={() => setIssueOpen(true)} type="button"><Icon name="more" size={16} /> Issue</button>
          <button className="btn primary grow" disabled={!action || progressing} onClick={handleAction} type="button">
            {progressing ? "Saving..." : action ? action[0] : "Workflow complete"} <Icon name="arrowRight" size={16} />
          </button>
        </div>
      )}
      {pickupOpen && (
        <div className="modal-backdrop">
          <form className="operation-modal glass rider-complete-modal rider-pickup-modal" onSubmit={confirmPickup}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">PICK UP</p>
                <h2>Destination and COD</h2>
              </div>
              <button className="icon-btn" onClick={() => setPickupOpen(false)} type="button"><Icon name="close" /></button>
            </div>
            <p className="muted">Confirm destination details and product payment before pickup.</p>
            {actionError && <p className="auth-error">{actionError}</p>}
            <div className="rider-pickup-fields">
              <label className="form-field">
                <span>Destination name</span>
                <input
                  onChange={(event) => setPickupForm((current) => ({ ...current, receiver: event.target.value }))}
                  value={pickupForm.receiver}
                />
              </label>
              <label className="form-field">
                <span>Destination phone</span>
                <input
                  inputMode="tel"
                  onChange={(event) => setPickupForm((current) => ({ ...current, receiverPhone: event.target.value }))}
                  required
                  value={pickupForm.receiverPhone}
                />
              </label>
              <label className="form-field">
                <span>Destination address</span>
                <input
                  onChange={(event) => setPickupForm((current) => ({ ...current, destination: event.target.value }))}
                  required
                  value={pickupForm.destination}
                />
              </label>
              <label className="switch-row glass">
                <span><strong>Product COD</strong><small>Collect product payment from receiver</small></span>
                <input
                  checked={pickupForm.codEnabled}
                  onChange={(event) => setPickupForm((current) => ({ ...current, codEnabled: event.target.checked }))}
                  type="checkbox"
                />
                <i />
              </label>
              {pickupForm.codEnabled && (
                <label className="form-field">
                  <span>COD amount (MMK)</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    onChange={(event) => setPickupForm((current) => ({ ...current, cod: event.target.value }))}
                    required
                    type="number"
                    value={pickupForm.cod}
                  />
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPickupOpen(false)} type="button">Cancel</button>
              <button className="btn primary grow" disabled={submitting} type="submit">
                {submitting ? "Saving..." : "Pick up"} <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
      {completing && (
        <div className="modal-backdrop">
          <form className="operation-modal glass rider-complete-modal" onSubmit={confirmComplete}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">COMPLETE DELIVERY</p>
                <h2>Final delivery fee</h2>
              </div>
              <button className="icon-btn" onClick={() => setCompleting(false)} type="button"><Icon name="close" /></button>
            </div>
            <p className="muted">Enter the cash amount collected from the client for this delivery.</p>
            <div className={`complete-cod-summary ${order.codEnabled ? "active" : ""}`}>
              <span><Icon name="wallet" size={16} /></span>
              <div>
                <small>Product COD</small>
                <strong>{order.codEnabled ? "On" : "Off"}</strong>
              </div>
              {order.codEnabled && (
                <div>
                  <small>COD amount</small>
                  <strong>{money(order.cod)}</strong>
                </div>
              )}
            </div>
            {actionError && <p className="auth-error">{actionError}</p>}
            <label className="field-label">Delivery fee (MMK)</label>
            <div className="fee-amount-input">
              <Icon name="wallet" size={18} />
              <input
                autoFocus
                className="text-input"
                inputMode="numeric"
                min="0"
                onChange={(event) => setFeeInput(event.target.value)}
                placeholder="3000"
                required
                type="number"
                value={feeInput}
              />
              <span>MMK</span>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setCompleting(false)} type="button">Cancel</button>
              <button className="btn primary grow" disabled={submitting} type="submit">
                {submitting ? "Saving..." : "Complete order"} <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
      {issueOpen && (
        <div className="modal-backdrop">
          <form className="operation-modal glass rider-complete-modal" onSubmit={(event) => event.preventDefault()}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">DELIVERY ISSUE</p>
                <h2>Report problem</h2>
              </div>
              <button className="icon-btn" onClick={() => setIssueOpen(false)} type="button"><Icon name="close" /></button>
            </div>
            <p className="muted">Use this when the delivery cannot continue. The order will move to history.</p>
            {actionError && <p className="auth-error">{actionError}</p>}
            <label className="form-field">
              <span>Issue note</span>
              <input onChange={(event) => setIssueNote(event.target.value)} placeholder="Receiver unavailable, package problem..." value={issueNote} />
            </label>
            <div className="modal-actions">
              <button className="btn secondary" disabled={submitting} onClick={() => setIssueOpen(false)} type="button">Cancel</button>
              <button className="btn danger" disabled={submitting} onClick={() => reportIssue("failed")} type="button">Mark failed</button>
              <button className="btn primary" disabled={submitting} onClick={() => reportIssue("cancelled")} type="button">Cancel job</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function GpsStatus({ activeOrders, gpsTracking, mapTileUrl, rider }) {
  const position = gpsTracking.lastPosition;
  const queuedLabel = gpsTracking.queuedCount > 0
    ? `${gpsTracking.queuedCount} location update${gpsTracking.queuedCount === 1 ? "" : "s"} waiting to sync`
    : "No queued GPS updates";
  const trackingStatus = gpsTracking.trackingState === "active"
    ? "available"
    : gpsTracking.trackingState === "warning"
      ? "pending_approval"
      : gpsTracking.dutyActive
        ? "online"
        : "offline";

  return (
    <section className="page-section">
      <p className="eyebrow">TRACKING STATUS</p><h1>GPS location</h1>
      <div className={`gps-visual glass ${gpsTracking.dutyActive ? "active" : ""}`}>
        <span><Icon name="location" size={28} /></span>
        <h2>{gpsTracking.dutyActive ? "Active duty tracking" : "GPS tracking is off"}</h2>
        <p>{gpsTracking.dutyActive ? "Your working-hours location is shared with office operations." : "Tap Start active when you are ready to receive assignments."}</p>
      </div>
      {gpsTracking.dutyActive && <RiderGpsMap mapTileUrl={mapTileUrl} position={position} />}
      <div className="privacy-note glass">
        <span><Icon name="lock" size={16} /></span>
        <p>
          <strong>{gpsTracking.dutyActive ? "Location sharing is on" : "Location sharing is off"}</strong>
          <small>Office can see your live position only while you are active. Clients see only their assigned rider after pickup. Stop active turns rider location sharing off.</small>
        </p>
      </div>
      {gpsTracking.message && (
        <p className="gps-warning"><Icon name="location" size={15} /> {gpsTracking.message}</p>
      )}
      <div className="action-grid gps-actions">
        <button className="btn primary" disabled={gpsTracking.dutyActive || gpsTracking.trackingState === "starting"} onClick={gpsTracking.startDuty} type="button">
          <Icon name="navigation" size={15} /> Start active
        </button>
        <button className="btn secondary" disabled={!gpsTracking.dutyActive} onClick={gpsTracking.stopDuty} type="button">
          <Icon name="close" size={15} /> Stop active
        </button>
      </div>
      <div className="compact-list glass">
        <div className="compact-row"><span className="row-icon"><Icon name="bike" size={16} /></span><span className="row-content"><strong>Rider status</strong><small>{rider.status.replaceAll("_", " ")}</small></span><StatusBadge status={rider.status} /></div>
        <div className="compact-row"><span className="row-icon"><Icon name="location" size={16} /></span><span className="row-content"><strong>Location permission</strong><small>{gpsTracking.permission === "unknown" ? "Waiting for browser permission" : gpsTracking.permission}</small></span><StatusBadge status={trackingStatus} /></div>
        <div className="compact-row"><span className="row-icon"><Icon name="clock" size={16} /></span><span className="row-content"><strong>Adaptive update frequency</strong><small>15s while moving, 45-60s when stationary</small></span>{gpsTracking.sending && <small>Sending...</small>}</div>
        <div className="compact-row"><span className="row-icon"><Icon name="upload" size={16} /></span><span className="row-content"><strong>Offline queue</strong><small>{queuedLabel}</small></span>{gpsTracking.flushing && <small>Syncing...</small>}</div>
        <div className="compact-row"><span className="row-icon"><Icon name="box" size={16} /></span><span className="row-content"><strong>Active assignments</strong><small>{activeOrders.length} current job{activeOrders.length === 1 ? "" : "s"}</small></span></div>
        <div className="compact-row"><span className="row-icon"><Icon name="mapPin" size={16} /></span><span className="row-content"><strong>Current position</strong><small>{position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : "No GPS point sent yet"}</small></span></div>
        <div className="compact-row"><span className="row-icon"><Icon name="filter" size={16} /></span><span className="row-content"><strong>Accuracy</strong><small>{position?.accuracy ? `${Math.round(position.accuracy)} meters` : "Unknown"}</small></span></div>
        <div className="compact-row"><span className="row-icon"><Icon name="clock" size={16} /></span><span className="row-content"><strong>Last sent</strong><small>{gpsTracking.lastSentAt ? new Date(gpsTracking.lastSentAt).toLocaleString() : "Not sent yet"}</small></span></div>
      </div>
    </section>
  );
}

function RiderGpsMap({ mapTileUrl, position }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const hasPosition = Number.isFinite(position?.latitude) && Number.isFinite(position?.longitude);

  useEffect(() => {
    if (!hasPosition || !mapNodeRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(mapNodeRef.current, {
      attributionControl: false,
      zoomControl: false,
    }).setView([position.latitude, position.longitude], 16);

    L.tileLayer(mapTileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ prefix: false }).addTo(map);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [hasPosition]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !hasPosition) {
      return;
    }

    const latLng = [position.latitude, position.longitude];
    map.setView(latLng, Math.max(map.getZoom(), 16), { animate: true });

    const icon = L.divIcon({
      className: "rider-own-marker active",
      html: '<span></span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { icon }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
      markerRef.current.setIcon(icon);
    }

    window.setTimeout(() => map.invalidateSize(), 0);
  }, [hasPosition, position?.latitude, position?.longitude]);

  if (!hasPosition) {
    return (
      <div className="rider-gps-map unavailable glass">
        <span><Icon name="mapPin" size={22} /></span>
        <strong>Waiting for your GPS position</strong>
        <small>Start active and allow location permission to show your current point on the map.</small>
      </div>
    );
  }

  return (
    <div className="rider-gps-map glass">
      <div className="rider-gps-map-canvas" ref={mapNodeRef} />
      <div className="rider-gps-map-status">
        <span><Icon name="navigation" size={15} /></span>
        <div>
          <strong>Your live position</strong>
          <small>{position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}{position.accuracy ? ` - ${Math.round(position.accuracy)}m accuracy` : ""}</small>
        </div>
      </div>
    </div>
  );
}
