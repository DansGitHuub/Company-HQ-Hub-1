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

  // ── My Hours helpers ────────────────────────────────────────────────────────

  function computePayPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun … 6=Sat
    const daysSinceSat = dow === 6 ? 0 : dow + 1;
    const periodEndDate = new Date(now);
    periodEndDate.setDate(now.getDate() - daysSinceSat);
    periodEndDate.setHours(23, 59, 59, 999);
    const periodStartDate = new Date(periodEndDate);
    periodStartDate.setDate(periodEndDate.getDate() - 13);
    periodStartDate.setHours(0, 0, 0, 0);
    return { start: periodStartDate, end: periodEndDate };
  }

  function computeSummary(rows: any[]) {
    const byDay: Record<string, number> = {};
    for (const r of rows) {
      if (!r.clock_out || !r.duration_minutes) continue;
      const day = new Date(r.clock_in).toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + Number(r.duration_minutes);
    }
    let regularMinutes = 0;
    let overtimeMinutes = 0;
    for (const mins of Object.values(byDay)) {
      regularMinutes += Math.min(mins, 480);
      overtimeMinutes += Math.max(0, mins - 480);
    }
    const totalMinutes = regularMinutes + overtimeMinutes;
    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      regularHours: Math.round((regularMinutes / 60) * 100) / 100,
      overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
      daysWorked: Object.keys(byDay).length,
    };
  }

  // ── GET /api/time/my-hours ───────────────────────────────────────────────────
  app.get("/api/time/my-hours", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { startDate, endDate, page = "1", limit = "50" } = req.query as Record<string, string>;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    try {
      const entryQ = `
        SELECT
          te.id, te.clock_in, te.clock_out, te.duration_minutes,
          te.job_id, COALESCE(j.title, j.client, 'Unknown Job') AS job_title,
          te.job_work_area_id AS work_area_id, te.work_area_name,
          te.entry_type, te.status, te.notes
        FROM time_entries te
        LEFT JOIN jobs j ON j.id = te.job_id
        WHERE te.user_id = $1
          AND te.clock_in >= $2::timestamptz
          AND te.clock_in <= $3::timestamptz
        ORDER BY te.clock_in DESC
        LIMIT $4 OFFSET $5
      `;
      const countQ = `
        SELECT COUNT(*) FROM time_entries
        WHERE user_id = $1
          AND clock_in >= $2::timestamptz
          AND clock_in <= $3::timestamptz
      `;
      const summaryQ = `
        SELECT clock_in, clock_out, duration_minutes
        FROM time_entries
        WHERE user_id = $1
          AND clock_in >= $2::timestamptz
          AND clock_in <= $3::timestamptz
      `;

      const [entryRes, countRes, summaryRes] = await Promise.all([
        pool.query(entryQ, [userId, startDate, endDate + "T23:59:59", limitNum, offset]),
        pool.query(countQ, [userId, startDate, endDate + "T23:59:59"]),
        pool.query(summaryQ, [userId, startDate, endDate + "T23:59:59"]),
      ]);

      const totalCount = parseInt(countRes.rows[0].count, 10);
      const summary = computeSummary(summaryRes.rows);

      return res.json({
        entries: entryRes.rows,
        summary,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/time/my-hours/pay-period ────────────────────────────────────────
  app.get("/api/time/my-hours/pay-period", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { start, end } = computePayPeriod();
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    try {
      const result = await pool.query(
        `SELECT
           te.id, te.clock_in, te.clock_out, te.duration_minutes,
           te.job_id, COALESCE(j.title, j.client, 'Unknown Job') AS job_title,
           te.job_work_area_id AS work_area_id, te.work_area_name,
           te.entry_type, te.status, te.notes
         FROM time_entries te
         LEFT JOIN jobs j ON j.id = te.job_id
         WHERE te.user_id = $1
           AND te.clock_in >= $2::timestamptz
           AND te.clock_in <= $3::timestamptz
         ORDER BY te.clock_in DESC`,
        [userId, start.toISOString(), end.toISOString()]
      );

      const summary = computeSummary(result.rows);

      return res.json({
        entries: result.rows,
        summary,
        payPeriodStart: startStr,
        payPeriodEnd: endStr,
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
