import type { Express } from "express";
import { pool } from "./db";

export function registerSettingsRoutes(app: Express, requireAuth: any, requireRole: any) {

  // ── GET /api/settings/:key ───────────────────────────────────────────────────
  app.get("/api/settings/:key", requireAuth, requireRole(["Admin", "Manager"]), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT key, value, updated_at FROM app_settings WHERE key = $1`,
        [req.params.key]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Setting not found" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/settings/:key ───────────────────────────────────────────────────
  app.put("/api/settings/:key", requireAuth, requireRole(["Admin", "Manager"]), async (req, res) => {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ message: "value is required" });
    try {
      const { rows } = await pool.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
         RETURNING *`,
        [req.params.key, typeof value === "string" ? value : JSON.stringify(value)]
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
