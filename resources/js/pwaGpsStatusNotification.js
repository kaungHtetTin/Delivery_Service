const GPS_STATUS_TAG = "flowdrop-rider-gps-status";

export function isInstalledPwa() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone === true,
  );
}

function notificationSupported() {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof Notification !== "undefined";
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString();
}

async function postGpsNotificationMessage(message) {
  if (!notificationSupported() || !isInstalledPwa() || Notification.permission !== "granted") {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active || navigator.serviceWorker.controller;

    if (!worker) {
      return false;
    }

    worker.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export async function ensureGpsNotificationPermission() {
  if (!notificationSupported() || !isInstalledPwa()) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  try {
    return await Notification.requestPermission() === "granted";
  } catch {
    return false;
  }
}

export async function showRiderGpsStatusNotification({
  accuracy = null,
  appBaseUrl = "",
  lastSentAt = "",
  queuedCount = 0,
  state = "starting",
} = {}) {
  const latestSent = formatTime(lastSentAt);
  const base = (appBaseUrl || window.location.origin).replace(/\/$/, "");
  const queued = Number(queuedCount || 0);
  const accuracyLabel = accuracy ? ` • ${Math.round(accuracy)}m accuracy` : "";
  const queueLabel = queued > 0 ? ` • ${queued} queued` : "";
  const body = latestSent
    ? `Latest server save: ${latestSent}${accuracyLabel}${queueLabel}`
    : `Waiting for first server save${queueLabel}`;

  return postGpsNotificationMessage({
    type: "FLOWDROP_RIDER_GPS_STATUS",
    payload: {
      body,
      icon: `${base}/pwa-icon-192.png`,
      link: `${base}/rider`,
      state,
      tag: GPS_STATUS_TAG,
      title: state === "warning" ? "GPS tracking needs attention" : "GPS tracking ON",
    },
  });
}

export async function closeRiderGpsStatusNotification() {
  return postGpsNotificationMessage({
    type: "FLOWDROP_RIDER_GPS_STATUS_CLOSE",
    payload: { tag: GPS_STATUS_TAG },
  });
}
