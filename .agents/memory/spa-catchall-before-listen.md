---
name: SPA catch-all must be registered before listen()
description: Why the SPA catch-all must go in Step 1 (before listen()) in this project, and the bypass-guard pattern required to make that safe.
---

## Rule
Register `serveStaticCatchAll(app)` in Step 1 of the async IIFE — BEFORE `httpServer.listen()` — not after migrations.

## Why
Replit autoscale spins up fresh container instances on demand. Each instance runs 60+ DB migrations (~35 seconds) after `listen()` before API routes and the catch-all are registered. Any SPA-route request (e.g. GET /admin) during that window hits Express's empty stack and gets `Cannot GET /admin` from the finalhandler. Since autoscale cycles instances continuously, this window is hit on every scale-up event — not just initial deploy.

The workspace `dist/index.cjs` is stale relative to the live TypeScript source. `fetch_deployment_logs` returns logs from the production container, not the workspace dev server. The `[spa] registering` logs confirmed the catch-all was correctly included in the production bundle — the timing issue was the real cause, not bundle staleness or Express 5 arity behavior.

## How to apply
In `server/index.ts` Step 1 block:
```typescript
if (process.env.NODE_ENV !== "development") {
  serveStaticFiles(app);
  serveStaticCatchAll(app);   // ← before listen()
}
setupAuth(app);
httpServer.listen(...);
```

In `server/static.ts`, `serveStaticCatchAll` must use a bypass guard so that paths registered later in the stack still work:
```typescript
const SPA_BYPASS_PREFIXES = [
  "/api",         // REST API routes
  "/auth",        // OAuth callbacks
  "/objects",     // object-storage file downloads
  "/privacy",     // server-rendered public page
  "/terms",       // server-rendered public page
  "/sms-consent", // server-rendered public page
];
app.use((req, res, next) => {
  const p = req.path;
  if (SPA_BYPASS_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + "/"))) {
    return next();
  }
  res.sendFile(indexPath);
});
```

Step 5 (after migrations) only needs the Vite dev-server setup — the production else-branch is removed.

## Express 5.2.1 notes (verified)
- `app.use((req, res) => {...})` (2-arg, no path) works correctly as a catch-all in Express 5.2.1
- `app.use("/{*any}", ...)` also works
- Neither form had a bug — the timing issue was the entire root cause
