const CACHE_NAME = "flowdrop-app-v4";
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
