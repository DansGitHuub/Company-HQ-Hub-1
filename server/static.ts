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
  app.use(express.static(distPath));
}

// React client-side routing catch-all.
// MUST be registered AFTER all API routes so /api/* is not intercepted.
export function serveStaticCatchAll(app: Express) {
  const distPath = getDistPath();
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// Legacy combined helper (kept for any external callers).
export function serveStatic(app: Express) {
  serveStaticFiles(app);
  serveStaticCatchAll(app);
}
