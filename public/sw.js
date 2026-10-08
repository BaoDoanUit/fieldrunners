/* FieldRunner service worker.
 *
 * Strategy:
 *   - Cache-first for hashed static assets under /assets/ and /fonts/.
 *   - Network-first for /api/* (config, leaderboard, telemetry).
 *   - Bumped CACHE_NAME invalidates the old cache on each deploy.
 */

const CACHE_NAME = "fieldrunner-v1";
const ASSET_PREFIXES = ["/assets/", "/fonts/", "/icons/"];

self.addEventListener("install", (event) => {
  // Activate the new service worker immediately on install.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isApi = url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/");
  const isAsset = ASSET_PREFIXES.some((p) => url.pathname.startsWith(p));
  const isNavigation = req.mode === "navigate";

  // Network-first for API + navigation requests.
  if (isApi || isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && isNavigation) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, res.clone());
          }
          return res;
        } catch (err) {
          if (isNavigation) {
            const cached = await caches.match(req);
            if (cached) return cached;
          }
          throw err;
        }
      })()
    );
    return;
  }

  // Cache-first for static assets.
  if (isAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          // If we have a stale entry, return it as a last resort.
          if (cached) return cached;
          throw err;
        }
      })()
    );
  }
});
