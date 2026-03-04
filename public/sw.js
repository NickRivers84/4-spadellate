// 4 Spadellate – Safe Service Worker

const VERSION = "v1";
const CACHE_NAME = `4spadellate-${VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// NON intercettiamo più fetch degli asset JS
// Così React non viene mai servito dalla cache

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
