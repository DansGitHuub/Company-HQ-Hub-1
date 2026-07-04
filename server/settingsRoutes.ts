import type { Express } from "express";
import { pool } from "./db";
import { logAuditEvent } from "./securityAuditLog";

export function registerSettingsRoutes(app: Express, requireAuth: any, requireRole: any) {

  // ── GET /api/settings/terms — list all T&C records ────────────────────────
  app.get("/api/settings/terms", requireAuth, requireRole(["Admin", "Manager"]), async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM terms_and_conditions ORDER BY
           CASE type WHEN 'install' THEN 1 WHEN 'maintenance' THEN 2 WHEN 'snow' THEN 3 ELSE 4 END`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/settings/terms/:id — update a T&C record ─────────────────────
  app.put("/api/settings/terms/:id", requireAuth, requireRole(["Admin", "Manager"]), async (req: any, res) => {
    try {
      const { content, title, is_active } = req.body;
      const { rows: beforeRows } = await pool.query(
        `SELECT * FROM terms_and_conditions WHERE id=$1`,
        [req.params.id]
      );
      const before = beforeRows[0];
      const { rows } = await pool.query(
        `UPDATE terms_and_conditions
         SET content=$1, title=COALESCE($2, title), is_active=COALESCE($3, is_active), updated_at=NOW()
         WHERE id=$4 RETURNING *`,
        [content ?? "", title ?? null, is_active ?? null, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "T&C not found" });

      const actor = req.user;
      logAuditEvent({
        eventType: "settings_change",
        actorUserId: actor?.id ?? null,
        actorName: actor?.name ?? actor?.username ?? "Unknown",
        targetLabel: `Terms & Conditions (${before?.type ?? rows[0].type})`,
        description: `${actor?.name ?? "A user"} updated the "${before?.type ?? rows[0].type}" Terms & Conditions`,
        oldValue: before ? { content: before.content, title: before.title, is_active: before.is_active } : undefined,
        newValue: { content: rows[0].content, title: rows[0].title, is_active: rows[0].is_active },
        ipAddress: req.ip,
      });

      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/settings/terms/active/:type — public, get active T&C for a type
  app.get("/api/settings/terms/active/:type", async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM terms_and_conditions WHERE type=$1 AND is_active=true LIMIT 1`,
        [req.params.type]
      );
      res.json(rows[0] || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

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
  app.put("/api/settings/:key", requireAuth, requireRole(["Admin", "Manager"]), async (req: any, res) => {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ message: "value is required" });
    try {
      const { rows: beforeRows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = $1`,
        [req.params.key]
      );
      const oldValue = beforeRows[0]?.value ?? null;

      const { rows } = await pool.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
         RETURNING *`,
        [req.params.key, typeof value === "string" ? value : JSON.stringify(value)]
      );

      const actor = req.user;
      logAuditEvent({
        eventType: "settings_change",
        actorUserId: actor?.id ?? null,
        actorName: actor?.name ?? actor?.username ?? "Unknown",
        targetLabel: `Setting: ${req.params.key}`,
        description: `${actor?.name ?? "A user"} updated the "${req.params.key}" setting`,
        oldValue: { value: oldValue },
        newValue: { value: rows[0].value },
        ipAddress: req.ip,
      });

      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
