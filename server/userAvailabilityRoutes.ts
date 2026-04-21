import type { Express } from "express";
import { pool } from "./db";

async function migrateUserAvailability() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_availability (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      accepts_appointments BOOLEAN NOT NULL DEFAULT FALSE,
      schedule             JSONB,
      slot_duration        INTEGER NOT NULL DEFAULT 60,
      buffer_minutes       INTEGER NOT NULL DEFAULT 0,
      timezone             VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Add new columns to existing table if needed
  await pool.query(`ALTER TABLE user_availability ADD COLUMN IF NOT EXISTS schedule JSONB`);
  await pool.query(`ALTER TABLE user_availability ADD COLUMN IF NOT EXISTS slot_duration INTEGER NOT NULL DEFAULT 60`);
  await pool.query(`ALTER TABLE user_availability ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York'`);
  console.log("[migration] user_availability table ready");
}

export async function registerUserAvailabilityRoutes(app: Express, requireAuth: any) {
  await migrateUserAvailability();

  // ── GET own availability (Settings page)
  app.get("/api/user/availability", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM user_availability WHERE user_id = $1`,
        [req.user.id]
      );
      if (!rows[0]) {
        return res.json({
          user_id: req.user.id,
          accepts_appointments: false,
          schedule: null,
          slot_duration: 60,
          buffer_minutes: 0,
          timezone: "America/New_York",
        });
      }
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPSERT own availability (Settings page)
  app.put("/api/user/availability", requireAuth, async (req: any, res) => {
    const { schedule, slot_duration, buffer_minutes, timezone } = req.body;
    try {
      const { rows } = await pool.query(`
        INSERT INTO user_availability (user_id, accepts_appointments, schedule, slot_duration, buffer_minutes, timezone)
        VALUES ($1, TRUE, $2::jsonb, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          accepts_appointments = TRUE,
          schedule             = EXCLUDED.schedule,
          slot_duration        = EXCLUDED.slot_duration,
          buffer_minutes       = EXCLUDED.buffer_minutes,
          timezone             = EXCLUDED.timezone,
          updated_at           = NOW()
        RETURNING *
      `, [
        req.user.id,
        JSON.stringify(schedule || {}),
        slot_duration || 60,
        buffer_minutes || 0,
        timezone || "America/New_York",
      ]);
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Legacy GET availability (kept for backward compat)
  app.get("/api/availability/me", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM user_availability WHERE user_id = $1`,
        [req.user.id]
      );
      res.json(rows[0] || { accepts_appointments: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET available slots for a username/date range (used by BookingPage)
  app.get("/api/availability/:username/slots", async (req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };
    try {
      const { rows: userRows } = await pool.query(
        `SELECT id, name, username FROM users WHERE username = $1`,
        [req.params.username]
      );
      if (!userRows[0]) return res.status(404).json({ error: "User not found" });

      const { rows: availRows } = await pool.query(
        `SELECT * FROM user_availability WHERE user_id = $1`,
        [userRows[0].id]
      );
      const avail = availRows[0];
      if (!avail) return res.json([]);

      res.json([]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
