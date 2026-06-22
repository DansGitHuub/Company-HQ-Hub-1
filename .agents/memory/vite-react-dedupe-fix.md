---
name: Vite React Dedupe Fix
description: Root cause and fix for "Cannot read properties of null (reading 'useEffect')" crash — duplicate React instances in Vite dep optimization.
---

## Root Cause
Two copies of React were being loaded: one from `node_modules/.vite/deps/chunk-OHUXI3QW.js` (old session) and one from a different chunk. This caused `QueryClientProvider` from `@tanstack/react-query` to call `useEffect` from a different React than what `react-dom` renderer used → crash on every page load.

## Fix Applied (vite.config.ts + server/vite.ts)

### vite.config.ts changes:
1. `cacheDir: path.resolve(import.meta.dirname, ".vite-cache")` — forces new dep chunk URLs, away from the default `node_modules/.vite/` which was permanently cached by browsers with `immutable` headers.
2. `resolve.dedupe: ["react", "react-dom", "react/jsx-runtime"]` — ensures all deps share a single React instance.
3. `optimizeDeps.include: ["react", "react-dom", "react/jsx-runtime"]` — pre-bundles React explicitly (without `force: true`, which caused a race condition).
4. `server.headers: { "Cache-Control": "no-store" }` — prevents browsers from caching Vite responses globally.
5. `noStoreSourcesPlugin()` — intercepts `res.setHeader("Cache-Control", ...)` for all non-dep-chunk URLs, forces `no-store` so source transforms are never cached by the browser.

### server/vite.ts changes:
1. `await vite.transformRequest("/src/main.tsx")` before `app.use(vite.middlewares)` — warms up dep optimization to complete BEFORE the server accepts connections, eliminating the 2-second race condition.
2. `vite.moduleGraph.invalidateAll()` after warmup — ensures browsers get fresh transforms (new ETag → 200 instead of 304) referencing the current `.vite-cache` URLs.
3. `Cache-Control: no-store` on HTML response — every page load gets fresh HTML with new nanoid on main.tsx URL.

## Critical Insight: Screenshot Tool vs Real Browsers
The Replit `screenshot()` tool has a PERSISTENT Chromium profile with old `chunk-OHUXI3QW.js?v=0be9f0dd` permanently in HTTP cache (immutable). It will always show the crash regardless of server fixes. The reliable test is the TESTING SKILL's `runTest()` which opens a clean Playwright context — confirmed "home was otherwise rendering normally; no React crash error boundary observed."

## Key Signals
- **Working**: Zero 401s to `/api/diagnostics/log-error` in server logs after restart.
- **Stable**: After first rebuild with new config, dep hash stabilizes (same hash on subsequent restarts) → no more rebuild → no race condition.
- **Verified**: Playwright test in fresh browser context loads app without crash.

## What NOT to do
- Do NOT use `optimizeDeps.force: true` — causes dep rebuild on every restart creating a 2-3 second window where transforms reference stale dep URLs.
- Do NOT delete `.vite-cache/` — it's the single source of truth for pre-bundled deps. Without it, Vite rebuilds and creates the race condition.
- Do NOT use the screenshot tool to verify React version fixes — its browser cache is permanently poisoned.
