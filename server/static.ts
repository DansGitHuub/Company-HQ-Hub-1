import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function getDistPath() {
  return path.resolve(__dirname, "public");
}

// Paths that must NOT receive index.html — server handles them directly.
// Any request whose path equals one of these or starts with one of them
// followed by "/" is passed through to the next middleware instead of being
// served the React SPA shell.
const SPA_BYPASS_PREFIXES = [
  "/api",         // REST API routes
  "/auth",        // OAuth callbacks (e.g. /auth/google/callback)
  "/objects",     // object-storage file downloads (/objects/:path*)
  "/privacy",     // server-rendered public page
  "/terms",       // server-rendered public page
  "/sms-consent", // server-rendered public page (GET + POST)
];

// Serves actual built files (index.html, assets/*).
// express.static() only intercepts paths that map to existing files;
// /api/* and any non-existent path fall through via next().
// Safe to register BEFORE API routes.
export function serveStaticFiles(app: Express) {
  const distPath = getDistPath();
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Vite's build outputs hashed, content-addressed filenames only under
        // /assets/* (e.g. assets/index-abc123.js) — the hash changes on every
        // rebuild, so these specific files are safe to cache forever.
        // Everything else (index.html, favicon, manifest.json, sw.js, images,
        // pdf worker, etc.) is NOT hashed and keeps the default caching
        // behavior untouched.
        const relativePath = path.relative(distPath, filePath);
        if (relativePath.startsWith(`assets${path.sep}`)) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
      },
    }),
  );
}

// React client-side routing catch-all.
//
// Registered in Step 1 (BEFORE listen()) so it is active from the very first
// request — including during the ~35-second migration window.  Without this
// early registration, GET /admin (and every other SPA route) would hit
// Express's finalhandler and return "Cannot GET /admin" for the entire boot
// period.
//
// The bypass guard passes non-SPA paths through to the next matching handler
// so that API routes, OAuth callbacks, object-storage downloads, and
// server-rendered public pages all work correctly even though they are
// registered later in the middleware stack.
export function serveStaticCatchAll(app: Express) {
  const distPath = getDistPath();
  const indexPath = path.resolve(distPath, "index.html");
  console.log(`[spa] catch-all will serve: ${indexPath} (exists: ${fs.existsSync(indexPath)})`);
  app.use((req, res, next) => {
    const p = req.path;
    if (SPA_BYPASS_PREFIXES.some(
      (prefix) => p === prefix || p.startsWith(prefix + "/"),
    )) {
      return next();
    }
    console.log(`[spa] catch-all hit: ${req.method} ${req.path} → serving index.html`);
    res.sendFile(indexPath);
  });
}

// Legacy combined helper (kept for any external callers).
export function serveStatic(app: Express) {
  serveStaticFiles(app);
  serveStaticCatchAll(app);
}
