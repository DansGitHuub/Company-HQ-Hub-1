const CACHE_NAME = "companyhq-v1";
const PRECACHE_URLS = ["/", "/index.html", "/my-day", "/time"];

// ── Install: precache app shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
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

  if (isApi) {
    // Network-first for all API calls
    event.respondWith(
      fetch(request.clone()).catch(() => {
        // Offline fallback for clock endpoints — return queued stub
        if (isClockEndpoint && request.method === "POST") {
          return new Response(JSON.stringify({ status: "queued", offline: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Generic offline API response
        return new Response(JSON.stringify({ error: "offline", message: "No network connection" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful GET responses for static assets
        if (request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: serve index.html for navigation requests
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});
