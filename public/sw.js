/* Forchette&Polpette — SW v2 (anti-stale)
   - HTML (navigazioni) = NETWORK FIRST (non cachiamo index.html)
   - Asset same-origin (css/js/img/audio/icons) = CACHE FIRST
*/

const CACHE_NAME = "forchette-polpette-static-v2";

const PRECACHE = [
  "/manifest.webmanifest",
  "/brand/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Gestiamo solo same-origin
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";

  // HTML / navigazioni: network-first (mai cache di "/")
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          // No-store per evitare HTML “stale”
          return await fetch(req, { cache: "no-store" });
        } catch {
          // Offline: prova almeno a dare qualcosa di cachato (se c’è)
          const cached = await caches.match("/manifest.webmanifest");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Asset: cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    })()
  );
});
