import { registerPushSubscription, removePushSubscription } from "./api";

const tokenStorageKey = "flowdrop.firebase.messaging_token";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let foregroundUnsubscribe = null;
let firebaseModulesPromise = null;

function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    import.meta.env.VITE_FIREBASE_VAPID_KEY,
  );
}

function appBase(baseUrl = "") {
  return `${(baseUrl || window.location.origin).replace(/\/$/, "")}/`;
}

async function firebaseModules() {
  firebaseModulesPromise ||= Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]).then(([app, messaging]) => ({ ...app, ...messaging }));

  return firebaseModulesPromise;
}

function messagingApp({ getApp, getApps, initializeApp }) {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

async function messagingServiceWorkerRegistration(appBaseUrl) {
  const base = appBase(appBaseUrl);
  const workerUrl = new URL("firebase-messaging-sw.js", base).toString();
  const scope = new URL("firebase-cloud-messaging-push-scope/", base).toString();

  return navigator.serviceWorker.register(workerUrl, { scope });
}

function rememberToken(token, storageKey = tokenStorageKey) {
  try {
    localStorage.setItem(storageKey, token);
  } catch {
    // Browser storage is optional for push; the server still has the token.
  }
}

function storedToken(storageKey = tokenStorageKey) {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function baseCapabilityStatus() {
  if (!hasFirebaseConfig()) {
    return {
      state: "unconfigured",
      message: "Firebase web push is not configured yet. Add the VITE_FIREBASE values and rebuild the app.",
    };
  }

  if (!("serviceWorker" in navigator) || typeof Notification === "undefined") {
    return { state: "unsupported", message: "Push alerts are not available in this browser." };
  }

  if (!window.isSecureContext) {
    return { state: "unsupported", message: "Push alerts need HTTPS, or localhost while testing." };
  }

  return null;
}

export function getBrowserPushPermissionStatus({ storageKey = tokenStorageKey } = {}) {
  const unavailable = baseCapabilityStatus();

  if (unavailable) {
    return unavailable;
  }

  if (Notification.permission === "denied") {
    return { state: "blocked", message: "Push alerts are blocked in this browser." };
  }

  if (Notification.permission === "granted") {
    return storedToken(storageKey)
      ? { state: "enabled", message: "Push alerts are enabled on this device." }
      : { state: "disabled", message: "Browser permission is allowed, but alerts are off for this account." };
  }

  return { state: "default", message: "Push alerts are off on this device." };
}

export async function syncPushNotifications({ appBaseUrl = "", onForegroundMessage, storageKey = tokenStorageKey } = {}) {
  const permissionStatus = getBrowserPushPermissionStatus({ storageKey });

  if (permissionStatus.state !== "enabled") {
    return permissionStatus;
  }

  return enablePushNotifications({ appBaseUrl, onForegroundMessage, requestPermission: false, storageKey });
}

export async function enablePushNotifications({
  appBaseUrl = "",
  onForegroundMessage,
  requestPermission = true,
  storageKey = tokenStorageKey,
} = {}) {
  const unavailable = baseCapabilityStatus();

  if (unavailable) {
    return unavailable;
  }

  const firebase = await firebaseModules();

  if (!(await firebase.isSupported())) {
    return { state: "unsupported", message: "Push alerts are not available in this browser." };
  }

  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;

  if (permission !== "granted") {
    return {
      state: permission === "denied" ? "blocked" : "default",
      message: permission === "denied" ? "Push alerts are blocked in this browser." : "Push alerts are off on this device.",
    };
  }

  const app = messagingApp(firebase);
  const messaging = firebase.getMessaging(app);
  const registration = await messagingServiceWorkerRegistration(appBaseUrl);
  const token = await firebase.getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    return { state: "disabled", message: "Push alerts could not be enabled yet." };
  }

  await registerPushSubscription(token);
  rememberToken(token, storageKey);

  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
  }

  foregroundUnsubscribe = firebase.onMessage(messaging, (payload) => {
    onForegroundMessage?.(payload);
  });

  return { state: "enabled", message: "Push alerts are enabled on this device." };
}

export async function disablePushNotifications({ storageKey = tokenStorageKey } = {}) {
  const unavailable = baseCapabilityStatus();

  if (unavailable) {
    return unavailable;
  }

  const firebase = await firebaseModules();
  if (!(await firebase.isSupported())) {
    return { state: "unsupported", message: "Push alerts are not available in this browser." };
  }

  const token = storedToken(storageKey);
  const messaging = firebase.getMessaging(messagingApp(firebase));

  if (token) {
    await removePushSubscription(token);
  }

  await firebase.deleteToken(messaging);

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // No local token cache to clear.
  }

  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }

  return { state: "disabled", message: "Push alerts are disabled for this account." };
}
