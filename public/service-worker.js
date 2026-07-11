const CACHE_NAME = "flowdrop-app-v4";
const GPS_STATUS_NOTIFICATION_TAG = "flowdrop-rider-gps-status";
const scopeUrl = new URL(self.registration.scope);
const scopePath = scopeUrl.pathname.replace(/\/$/, "");
const scoped = (path) => `${scopePath}${path.startsWith("/") ? path : `/${path}`}`;
const APP_SHELL = [
  scoped("/client"),
  scoped("/rider"),
  scoped("/office"),
  scoped("/offline.html"),
  scoped("/flowdrop-icon.svg"),
  scoped("/pwa-icon-192.png"),
  scoped("/pwa-icon-512.png"),
  scoped("/app.webmanifest")
];

const isInAppScope = (url) => url.origin === self.location.origin
  && (url.pathname === scopePath || url.pathname.startsWith(`${scopePath}/`));

async function cacheIfOk(request, response) {
  if (!response?.ok) {
    return;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Cache writes are best effort; a failed write should not break a request.
  }
}

async function closeNotificationsByTag(tag) {
  if (!tag || !self.registration.getNotifications) {
    return;
  }

  const notifications = await self.registration.getNotifications({ tag });
  notifications.forEach((notification) => notification.close());
}

async function focusOrOpenWindow(link) {
  const targetUrl = new URL(link || scoped("/rider"), self.location.origin).toString();
  const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const existingClient = clientList.find((client) => {
    try {
      return new URL(client.url).pathname === new URL(targetUrl).pathname;
    } catch {
      return client.url === targetUrl;
    }
  });

  if (existingClient) {
    return existingClient.focus();
  }

  return clients.openWindow(targetUrl);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) => (
        fetch(url, { cache: "reload" })
          .then((response) => response.ok ? cache.put(url, response.clone()) : null)
          .catch(() => null)
      ))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const message = event.data || {};
  const payload = message.payload || {};

  if (message.type === "FLOWDROP_RIDER_GPS_STATUS_CLOSE") {
    event.waitUntil(closeNotificationsByTag(payload.tag || GPS_STATUS_NOTIFICATION_TAG));
    return;
  }

  if (message.type !== "FLOWDROP_RIDER_GPS_STATUS") {
    return;
  }

  event.waitUntil((async () => {
    const tag = payload.tag || GPS_STATUS_NOTIFICATION_TAG;

    await closeNotificationsByTag(tag);
    await self.registration.showNotification(payload.title || "GPS tracking ON", {
      body: payload.body || "Sending latest rider location to server.",
      badge: payload.icon || scoped("/pwa-icon-192.png"),
      data: {
        link: payload.link || scoped("/rider"),
        type: "rider_gps_status",
      },
      icon: payload.icon || scoped("/pwa-icon-192.png"),
      renotify: false,
      requireInteraction: true,
      silent: true,
      tag,
      timestamp: Date.now(),
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  const link = event.notification?.data?.link || scoped("/rider");

  event.notification.close();
  event.waitUntil(focusOrOpenWindow(link));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || !isInAppScope(url) || url.pathname.startsWith(scoped("/api"))) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          event.waitUntil(cacheIfOk(request, response));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(scoped("/offline.html"))))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => cached || fetch(request).then((response) => {
        event.waitUntil(cacheIfOk(request, response));
        return response;
      }))
  );
});
