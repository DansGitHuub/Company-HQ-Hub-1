import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function getDistPath() {
  return path.resolve(__dirname, "public");
}

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
// MUST be registered AFTER all API routes so /api/* is not intercepted.
// Uses a path-less app.use() so it matches every method and path that
// reaches it, regardless of Express version wildcard syntax differences.
export function serveStaticCatchAll(app: Express) {
  const distPath = getDistPath();
  app.use((_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// Legacy combined helper (kept for any external callers).
export function serveStatic(app: Express) {
  serveStaticFiles(app);
  serveStaticCatchAll(app);
}
