import { Express } from "express";
import { pool } from "./db";

export function registerTimeRoutes(app: Express, requireAuth: any) {

  // ── Migrate: add local_id column for offline idempotency (fire-and-forget) ──
  pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS local_id TEXT`)
    .then(() =>
      pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS time_entries_local_id_uidx
         ON time_entries (user_id, local_id) WHERE local_id IS NOT NULL`
      )
    )
    .catch((err) => console.error("[timeRoutes] local_id migration:", err.message));

  // ── Clock In ────────────────────────────────────────────────────────────────
  app.post("/api/time/clock-in", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { job_id, entry_type, job_work_area_id, work_area_name, localId } = req.body;

    // Derive entry_type: use provided value, or fallback to "billable" when a job is given
    const resolvedEntryType = entry_type || (job_id ? "billable" : "shop_time");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Idempotency: if localId provided, return existing entry rather than duplicating
      if (localId) {
        const existing = await client.query(
          `SELECT * FROM time_entries WHERE user_id=$1 AND local_id=$2 LIMIT 1`,
          [userId, localId]
        );
        if (existing.rows.length > 0) {
          await client.query("COMMIT");
          return res.status(200).json(existing.rows[0]);
        }
      }

      // Check if already clocked in
      const active = await client.query(
        `SELECT id FROM time_entries WHERE user_id=$1 AND clock_out IS NULL LIMIT 1`,
        [userId]
      );
      if (active.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Already clocked in. Please clock out first." });
      }

      // Insert the time entry
      const entryResult = await client.query(
        `INSERT INTO time_entries (user_id, job_id, entry_type, clock_in, job_work_area_id, work_area_name, local_id)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING *`,
        [userId, job_id || null, resolvedEntryType, job_work_area_id || null, work_area_name || null, localId || null]
      );
      const timeEntry = entryResult.rows[0];

      // If a job is associated, create a worksheet session and time card
      if (job_id) {
        const sessionResult = await client.query(
          `INSERT INTO worksheet_sessions (job_id, employee_id, date, status, created_at, updated_at)
           VALUES ($1, $2, CURRENT_DATE, 'active', NOW(), NOW()) RETURNING id`,
          [job_id, userId]
        );
        const sessionId = sessionResult.rows[0].id;

        await client.query(
          `INSERT INTO time_cards (session_id, employee_id, job_id, date, clock_in_time, status, created_at)
           VALUES ($1, $2, $3, CURRENT_DATE, NOW(), 'draft', NOW())`,
          [sessionId, userId, job_id]
        );
      }

      await client.query("COMMIT");
      return res.status(201).json(timeEntry);
    } catch (err: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
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
    // Update time_card and worksheet_session on clock-out
    try {
      const tcResult = await pool.query(
        `UPDATE time_cards SET clock_out_time = NOW(), total_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - clock_in_time))/60) WHERE employee_id = $1 AND clock_out_time IS NULL RETURNING session_id`,
        [userId]
      );
      if (tcResult.rows.length > 0 && tcResult.rows[0].session_id) {
        await pool.query(
          `UPDATE worksheet_sessions SET status = 'pending_review', updated_at = NOW() WHERE id = $1`,
          [tcResult.rows[0].session_id]
        );
      }
    } catch (wsErr: any) {
      console.error('Failed to update time_card/worksheet_session on clock-out:', wsErr.message);
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

  // ── Admin: Time Reports ─────────────────────────────────────────────────────
  app.get("/api/admin/time-reports", requireAuth, async (req, res) => {
    const requestingUser = req.user as any;
    if (requestingUser.role !== "Admin" && !requestingUser.isMasterAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { user_id, job_id, customer, date_from, date_to, year } = req.query as Record<string, string>;

    try {
      let q = `
        SELECT
          te.id,
          te.clock_in,
          te.clock_out,
          te.duration_minutes,
          te.entry_type,
          te.notes,
          te.work_area_name,
          u.id        AS user_id,
          u.name      AS employee_name,
          u.username,
          j.id        AS job_id,
          j.client    AS customer,
          j.type      AS job_type
        FROM time_entries te
        JOIN users u ON u.id = te.user_id
        LEFT JOIN jobs j ON j.id = te.job_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (user_id) {
        params.push(user_id);
        q += ` AND te.user_id = $${params.length}`;
      }
      if (job_id) {
        params.push(job_id);
        q += ` AND te.job_id = $${params.length}`;
      }
      if (customer) {
        params.push(`%${customer}%`);
        q += ` AND j.client ILIKE $${params.length}`;
      }
      if (year) {
        params.push(parseInt(year));
        q += ` AND EXTRACT(YEAR FROM te.clock_in) = $${params.length}`;
      }
      if (date_from) {
        params.push(date_from);
        q += ` AND te.clock_in::date >= $${params.length}`;
      }
      if (date_to) {
        params.push(date_to);
        q += ` AND te.clock_in::date <= $${params.length}`;
      }

      q += ` ORDER BY te.clock_in DESC`;

      const result = await pool.query(q, params);

      const totalMinutes = result.rows.reduce((sum: number, row: any) => {
        if (row.duration_minutes) return sum + Number(row.duration_minutes);
        if (row.clock_in && row.clock_out) {
          const ms = new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime();
          return sum + Math.round(ms / 60000);
        }
        return sum;
      }, 0);

      // Get distinct employees and jobs for filter dropdowns
      const empResult = await pool.query(
        `SELECT DISTINCT u.id, u.name, u.username FROM time_entries te JOIN users u ON u.id = te.user_id ORDER BY u.name`
      );
      const jobResult = await pool.query(
        `SELECT DISTINCT j.id, j.client, j.type FROM time_entries te JOIN jobs j ON j.id = te.job_id WHERE te.job_id IS NOT NULL ORDER BY j.client`
      );

      return res.json({
        entries: result.rows,
        totalMinutes,
        employees: empResult.rows,
        jobs: jobResult.rows,
      });
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
