---
name: Dev Vite catch-all must register after API routes
description: setupVite() in server/vite.ts installs a wildcard "/{*path}" handler that unconditionally serves the SPA HTML for every path, including /api/*. If it's registered before registerRoutes() runs, the entire API silently returns HTML 200 instead of JSON (login, every endpoint) with no server-side error.
---

Never call `setupVite(httpServer, app)` before `registerRoutes(httpServer, app)` in `server/index.ts`. Unlike `express.static()` (used in production, which falls through via `next()` for paths that aren't real files), Vite's dev catch-all always responds and never calls `next()` — so any Express layer registered after it is unreachable for every path, not just missed ones.

**Why:** A well-intentioned change to bind the port and start serving immediately (before ~60 sequential migrations) for faster autoscale health-check response moved `setupVite()` into that early "Step 1" block, ahead of `registerRoutes()`. This broke `/api/login` and literally every other `/api/*` route in dev mode — they all returned the frontend's `index.html` (200 OK, `Content-Type: text/html`) instead of JSON, with zero server-side errors logged. Confirmed via `curl`: even `/api/nonexistent-route-xyz` returned HTML, proving it wasn't route-specific.

**How to apply:** In `server/index.ts`, `httpServer.listen()` can safely happen early (Step 1) for both prod and dev. But `setupVite()` (dev) and `serveStaticCatchAll()` (prod) — the two wildcard SPA-fallback handlers — must both stay in "Step 5", after `registerRoutes()` and the error handler. `serveStaticFiles()` (prod, real static files only) is safe early because it calls `next()` for anything that isn't an actual file on disk. If you ever see the API acting fully dead (JSON.parse errors like "Unexpected token '<'" on every request, not just one), check this ordering first before assuming an app-level bug.
