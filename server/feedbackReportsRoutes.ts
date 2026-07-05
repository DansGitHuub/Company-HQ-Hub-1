import type { Express } from "express";
import { pool } from "./db";

async function migrateFeedbackReports() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback_reports (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       VARCHAR(36) NOT NULL,
      user_name     TEXT NOT NULL,
      type          VARCHAR(20) NOT NULL,
      description   TEXT NOT NULL,
      page_context  TEXT,
      status        VARCHAR(20) NOT NULL DEFAULT 'new',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migration] feedback_reports table ready");
}

const VALID_TYPES = ["Bug", "Feedback"];
const VALID_STATUSES = ["new", "in progress", "resolved"];

export async function registerFeedbackReportsRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  await migrateFeedbackReports();

  // ── CREATE a report (any authenticated user) ────────────────────────────
  app.post("/api/feedback-reports", requireAuth, async (req, res) => {
    const { type, description, page_context } = req.body ?? {};

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "type must be 'Bug' or 'Feedback'" });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: "Description is required" });
    }

    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.username || "Unknown";

    try {
      const { rows } = await pool.query(
        `INSERT INTO feedback_reports (user_id, user_name, type, description, page_context)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [userId, userName, type, String(description).trim(), page_context ? String(page_context).trim() : null]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── LIST all (admin only) ────────────────────────────────────────────────
  app.get("/api/feedback-reports", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM feedback_reports ORDER BY created_at DESC`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE status (admin only) ───────────────────────────────────────────
  app.patch("/api/feedback-reports/:id", requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body ?? {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    try {
      const { rows } = await pool.query(
        `UPDATE feedback_reports SET status = $1 WHERE id = $2 RETURNING *`,
        [status, id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Report not found" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
