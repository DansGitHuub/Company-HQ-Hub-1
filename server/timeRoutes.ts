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

  // ── Migrate: add approval_status column ──────────────────────────────────────
  pool.query(
    `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'`
  ).catch((err) => console.error("[timeRoutes] approval_status migration:", err.message));

  // ── Clock In ─────────────────────────work-areas───────────────────────────────────────
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

  // ── My Hours: Pay Period Summary ────────────────────────────────────────────
  app.get("/api/time/my-hours/pay-period", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      // Current biweekly pay period ending last Saturday
      const now = new Date();
      const dow = now.getDay(); // 0=Sun … 6=Sat
      const daysSinceSat = dow === 6 ? 0 : dow + 1;
      const periodEnd = new Date(now);
      periodEnd.setDate(now.getDate() - daysSinceSat);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodEnd.getDate() - 13);

      const startStr = periodStart.toISOString().split("T")[0];
      const endStr   = periodEnd.toISOString().split("T")[0];

      const result = await pool.query(
        `SELECT duration_minutes, clock_in
         FROM time_entries
         WHERE user_id = $1
           AND clock_in::date >= $2
           AND clock_in::date <= $3
           AND clock_out IS NOT NULL`,
        [userId, startStr, endStr]
      );

      const rows = result.rows;
      const totalMinutes = rows.reduce((s: number, r: any) => s + (Number(r.duration_minutes) || 0), 0);
      const regularMinutes = Math.min(totalMinutes, 80 * 60); // 80h per 2-week period
      const overtimeMinutes = Math.max(0, totalMinutes - 80 * 60);
      const uniqueDays = new Set(rows.map((r: any) => new Date(r.clock_in).toISOString().split("T")[0]));

      return res.json({
        payPeriodStart: startStr,
        payPeriodEnd: endStr,
        summary: {
          totalHours: (totalMinutes / 60).toFixed(2),
          regularHours: (regularMinutes / 60).toFixed(2),
          overtimeHours: overtimeMinutes > 0 ? (overtimeMinutes / 60).toFixed(2) : null,
          daysWorked: uniqueDays.size,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── My Hours: Paginated Entry List ──────────────────────────────────────────
  app.get("/api/time/my-hours", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { startDate, endDate, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset   = (pageNum - 1) * limitNum;

    try {
      const params: any[] = [userId];
      let where = `WHERE te.user_id = $1`;

      if (startDate) { params.push(startDate); where += ` AND te.clock_in::date >= $${params.length}`; }
      if (endDate)   { params.push(endDate);   where += ` AND te.clock_in::date <= $${params.length}`; }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM time_entries te ${where}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0].count) || 0;

      params.push(limitNum, offset);
      const result = await pool.query(
        `SELECT
           te.id, te.clock_in, te.clock_out, te.duration_minutes,
           te.entry_type, te.work_area_name, te.notes, te.approval_status,
           j.client AS job_title
         FROM time_entries te
         LEFT JOIN jobs j ON j.id = te.job_id
         ${where}
         ORDER BY te.clock_in DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const allForSummary = await pool.query(
        `SELECT duration_minutes, clock_in FROM time_entries te ${where} AND te.clock_out IS NOT NULL`,
        params.slice(0, params.length - 2)
      );
      const totalMinutes = allForSummary.rows.reduce((s: number, r: any) => s + (Number(r.duration_minutes) || 0), 0);
      const uniqueDays = new Set(allForSummary.rows.map((r: any) => new Date(r.clock_in).toISOString().split("T")[0]));

      return res.json({
        entries: result.rows,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        summary: {
          totalHours: (totalMinutes / 60).toFixed(2),
          daysWorked: uniqueDays.size,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: Approve / Reject single time entry ────────────────────────────────
  app.patch("/api/admin/time-entries/:id/approval", requireAuth, async (req: any, res) => {
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be approved, rejected, or pending." });
    }

    try {
      const result = await pool.query(
        `UPDATE time_entries SET approval_status = $1 WHERE id = $2 RETURNING id, approval_status`,
        [status, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: "Entry not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: Bulk approve / reject time entries ─────────────────────────────────
  app.post("/api/admin/time-entries/bulk-approval", requireAuth, async (req: any, res) => {
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids must be a non-empty array" });
    }
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    try {
      const placeholders = ids.map((_: any, i: number) => `$${i + 2}`).join(", ");
      const result = await pool.query(
        `UPDATE time_entries SET approval_status = $1 WHERE id IN (${placeholders}) RETURNING id, approval_status`,
        [status, ...ids]
      );
      return res.json({ updated: result.rowCount, rows: result.rows });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: Worksheet Review ──────────────────────────────────────────────────
  app.get("/api/admin/worksheet-review", requireAuth, async (req: any, res) => {
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { startDate, endDate, employeeId } = req.query as Record<string, string>;

    try {
      const params: any[] = [];
      let where = `WHERE te.clock_out IS NOT NULL`;

      if (startDate) { params.push(startDate); where += ` AND te.clock_in::date >= $${params.length}`; }
      if (endDate)   { params.push(endDate);   where += ` AND te.clock_in::date <= $${params.length}`; }
      if (employeeId && employeeId !== "all") { params.push(employeeId); where += ` AND te.user_id = $${params.length}`; }

      const result = await pool.query(
        `SELECT
           te.id,
           te.user_id,
           u.name   AS employee_name,
           u.username,
           te.job_id,
           j.client AS job_title,
           j.address AS job_address,
           te.clock_in,
           te.clock_out,
           te.duration_minutes,
           te.entry_type,
           te.work_area_name,
           te.notes,
           te.approval_status
         FROM time_entries te
         LEFT JOIN users u ON u.id = te.user_id
         LEFT JOIN jobs  j ON j.id = te.job_id
         ${where}
         ORDER BY te.clock_in DESC`,
        params
      );

      const employeesResult = await pool.query(
        `SELECT DISTINCT te.user_id AS id, u.name, u.username
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         WHERE te.clock_out IS NOT NULL
         ORDER BY u.name`
      );

      const entries = result.rows;
      const totalMinutes = entries.reduce((s: number, r: any) => s + (Number(r.duration_minutes) || 0), 0);
      const uniqueEmployees = new Set(entries.map((r: any) => r.user_id)).size;
      const uniqueDays = new Set(entries.map((r: any) => new Date(r.clock_in).toISOString().split("T")[0])).size;

      return res.json({
        entries,
        employees: employeesResult.rows,
        summary: {
          totalEntries: entries.length,
          totalHours: (totalMinutes / 60).toFixed(2),
          uniqueEmployees,
          uniqueDays,
        },
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
