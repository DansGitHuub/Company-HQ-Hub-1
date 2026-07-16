// ─────────────────────────────────────────────────────────────────────────────
// CompanyHQ Service Worker  v4
//
// Strategy summary
//   navigate requests    → NETWORK-FIRST (cache: no-cache), offline → cache
//   /assets/* bundles    → NETWORK-FIRST, offline → cache
//   field API GETs       → NETWORK-FIRST, offline → FIELD_DATA_CACHE
//   other API calls      → NETWORK-FIRST, no cache (clock-in stubbed offline)
//   other static assets  → CACHE-FIRST (images, icons, fonts — stable)
//
// On every deploy:
//   1. Install   → precache PRECACHE_URLS, then self.skipWaiting()
//   2. Activate  → delete ALL caches except v4 names, then clients.claim()
//   A normal page reload after a new deploy will always serve fresh content.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = "companyhq-v4";
const FIELD_DATA_CACHE = "companyhq-field-v4";

const PRECACHE_URLS = ["/", "/index.html", "/my-day", "/time", "/route", "/work-orders"];

// Field-critical GET endpoints — network first, cached for offline reads
function isFieldApiGet(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return false;
  const p = url.pathname;
  return (
    p === "/api/route/today" ||
    p.startsWith("/api/route/") ||
    p.startsWith("/api/my-day/") ||
    p === "/api/worksheets/today" ||
    p.startsWith("/api/work-orders") ||
    /^\/api\/jobs\/[^/]+$/.test(p)
  );
}

// ── Install: precache app shell, then skip waiting immediately ────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge ALL stale caches, then take control of all clients ────────
//
// Because we bump the version string on every deploy, the old CACHE_NAME
// ("companyhq-v3", etc.) is NOT in KEEP and gets deleted here.  This is the
// key step that prevents stale index.html / bundle entries from persisting.
self.addEventListener("activate", (event) => {
  const KEEP = new Set([CACHE_NAME, FIELD_DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch handler ─────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const isApi = url.pathname.startsWith("/api/");
  const isClockEndpoint =
    url.pathname === "/api/time/clock-in" || url.pathname === "/api/time/clock-out";

  // ── Field-critical GETs: network first, FIELD_DATA_CACHE fallback ─────────
  if (isApi && isFieldApiGet(request)) {
    event.respondWith(
      fetch(request.clone())
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(FIELD_DATA_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: FIELD_DATA_CACHE });
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: "offline", message: "No network connection" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
    return;
  }

  // ── All other API calls: network first, no cache ──────────────────────────
  //    Clock-in/out POST is stubbed offline so the IndexedDB write-queue can
  //    pick it up and replay when connectivity returns.
  if (isApi) {
    event.respondWith(
      fetch(request.clone()).catch(() => {
        if (isClockEndpoint && request.method === "POST") {
          return new Response(JSON.stringify({ status: "queued", offline: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ error: "offline", message: "No network connection" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // ── SPA navigation: NETWORK-FIRST, bypassing the browser HTTP cache ────────
  //
  // cache: "no-cache" forces a conditional request to the server every time,
  // so index.html is ALWAYS fresh after a new deploy.  On offline/error we
  // fall back to the last cached copy of index.html.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/index.html"))
        )
    );
    return;
  }

  // ── Hashed JS/CSS app bundles (/assets/*): NETWORK-FIRST ─────────────────
  //
  // Vite outputs content-addressed files here.  We still try the network
  // first on every request so the browser always gets the bundle that matches
  // the freshly-fetched index.html.  Cache is the offline fallback only.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(request.clone())
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response("", { status: 503 });
        })
    );
    return;
  }

  // ── Other static assets (images, icons, fonts, pdf worker…): CACHE-FIRST ──
  //    These are stable between deploys and benefit from aggressive caching.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (request.method === "GET" && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => new Response("", { status: 503 }));
    })
  );
});
