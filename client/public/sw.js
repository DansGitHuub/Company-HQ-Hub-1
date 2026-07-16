const CACHE_NAME = "companyhq-v3";
const FIELD_DATA_CACHE = "companyhq-field-v3";

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

// ── Install: precache app shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ────────────────────────────────────────────────
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

  // ── Field-critical GETs: network first, cache fallback for offline reads ───
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

  // ── SPA navigation: serve index.html, cache for offline ──────────────────
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok) {
            return caches.match("/index.html").then((cached) => {
              if (cached) return cached;
              return fetch("/index.html");
            });
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // ── Static assets: cache first ────────────────────────────────────────────
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
