// 4 Spadellate — Service Worker PRO Versioning

const VERSION = "v3"; // 🔁 AUMENTA AD OGNI DEPLOY IMPORTANTE
const CACHE_NAME = `4spadellate-${VERSION}`;
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// INSTALL
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH STRATEGY
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo GET
  if (request.method !== "GET") return;

  // HTML → sempre NETWORK FIRST (mai stale)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() =>
        caches.match("/manifest.webmanifest")
      )
    );
    return;
  }

  // Asset same-origin → CACHE FIRST
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache =>
              cache.put(request, clone)
            );
          }
          return response;
        });
      })
    );
  }
});