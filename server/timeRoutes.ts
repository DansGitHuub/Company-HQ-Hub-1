import { Express } from "express";
import { pool } from "./db";

export function registerTimeRoutes(app: Express, requireAuth: any) {

  // ── Clock In ────────────────────────────────────────────────────────────────
  app.post("/api/time/clock-in", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { job_id, entry_type = "billable" } = req.body;

    try {
      // Check if already clocked in
      const active = await pool.query(
        `SELECT id FROM time_entries WHERE user_id=$1 AND clock_out IS NULL LIMIT 1`,
        [userId]
      );
      if (active.rows.length > 0) {
        return res.status(400).json({ message: "Already clocked in. Please clock out first." });
      }

      const result = await pool.query(
        `INSERT INTO time_entries (user_id, job_id, entry_type, clock_in)
         VALUES ($1, $2, $3, NOW()) RETURNING *`,
        [userId, job_id || null, entry_type]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Clock Out ───────────────────────────────────────────────────────────────
  app.post("/api/time/clock-out", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { time_entry_id, notes } = req.body;

    if (!time_entry_id) {
      return res.status(400).json({ message: "time_entry_id is required" });
    }

    try {
      const result = await pool.query(
        `UPDATE time_entries
         SET clock_out = NOW(),
             duration_minutes = EXTRACT(EPOCH FROM (NOW() - clock_in))::integer / 60,
             notes = COALESCE($1, notes)
         WHERE id=$2 AND user_id=$3 AND clock_out IS NULL
         RETURNING *`,
        [notes || null, time_entry_id, userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Active time entry not found" });
      }
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Active Entry ────────────────────────────────────────────────────────────
  app.get("/api/time/active", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      const result = await pool.query(
        `SELECT te.*, j.client AS job_name
         FROM time_entries te
         LEFT JOIN jobs j ON j.id = te.job_id
         WHERE te.user_id=$1 AND te.clock_out IS NULL
         ORDER BY te.clock_in DESC LIMIT 1`,
        [userId]
      );
      return res.json(result.rows[0] ?? null);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── List Entries ────────────────────────────────────────────────────────────
  app.get("/api/time/entries", requireAuth, async (req, res) => {
    const requestingUser = req.user as any;
    const { date, user_id } = req.query as { date?: string; user_id?: string };

    // Only admins/managers can query other users
    const targetUserId =
      (requestingUser.role === "Admin" || requestingUser.role === "Manager") && user_id
        ? user_id
        : requestingUser.id;

    try {
      let q = `
        SELECT te.*, j.client AS job_name
        FROM time_entries te
        LEFT JOIN jobs j ON j.id = te.job_id
        WHERE te.user_id = $1
      `;
      const params: any[] = [targetUserId];

      if (date) {
        params.push(date);
        q += ` AND te.clock_in::date = $${params.length}`;
      }

      q += ` ORDER BY te.clock_in DESC`;

      const result = await pool.query(q, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GPS Ping ────────────────────────────────────────────────────────────────
  app.post("/api/gps/ping", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { lat, lng, accuracy, time_entry_id } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO gps_pings (user_id, time_entry_id, lat, lng, accuracy, recorded_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
        [userId, time_entry_id || null, lat, lng, accuracy ?? null]
      );
      return res.status(201).json({ id: result.rows[0].id });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
