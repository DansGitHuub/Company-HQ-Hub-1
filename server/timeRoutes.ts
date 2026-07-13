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

  // ── Migrate: add approval_status + rejection_note columns ────────────────────
  pool.query(
    `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'`
  ).then(() =>
    pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS rejection_note TEXT`)
  ).catch((err) => console.error("[timeRoutes] approval migration:", err.message));

  // ── Migrate: add GPS snapshot columns ────────────────────────────────────────
  pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_lat  DOUBLE PRECISION`)
    .then(() => pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_lng  DOUBLE PRECISION`))
    .then(() => pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_lat DOUBLE PRECISION`))
    .then(() => pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_lng DOUBLE PRECISION`))
    .catch((err) => console.error("[timeRoutes] GPS columns migration:", err.message));

  // ── Clock In ─────────────────────────work-areas───────────────────────────────────────
  app.post("/api/time/clock-in", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { job_id, entry_type, job_work_area_id, work_area_name, localId, lat, lng } = req.body;

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
        `INSERT INTO time_entries (user_id, job_id, entry_type, clock_in, job_work_area_id, work_area_name, local_id, clock_in_lat, clock_in_lng)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8) RETURNING *`,
        [userId, job_id || null, resolvedEntryType, job_work_area_id || null, work_area_name || null, localId || null,
         (lat != null ? parseFloat(lat) : null), (lng != null ? parseFloat(lng) : null)]
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

      // Audit log — time entry created
      const auditDesc = job_id
        ? `Clocked in (${resolvedEntryType}) linked to job`
        : `Clocked in (${resolvedEntryType})`;
      pool.query(
        `INSERT INTO activity_log (id, user_id, event_type, description, link, seen_by, created_at)
         VALUES (gen_random_uuid(), $1, 'time_entry_create', $2, '/admin/time-reports', '[]'::jsonb, now())`,
        [userId, auditDesc]
      ).catch((e: any) => console.error("[timeRoutes] audit log clock-in:", e.message));

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
    const { time_entry_id, notes, lat, lng } = req.body;

    if (!time_entry_id) {
      return res.status(400).json({ message: "time_entry_id is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE time_entries
         SET clock_out = NOW(),
             duration_minutes = EXTRACT(EPOCH FROM (NOW() - clock_in))::integer / 60,
             notes = COALESCE($1, notes),
             clock_out_lat = $4,
             clock_out_lng = $5
         WHERE id=$2 AND user_id=$3 AND clock_out IS NULL
         RETURNING *`,
        [notes || null, time_entry_id, userId,
         (lat != null ? parseFloat(lat) : null), (lng != null ? parseFloat(lng) : null)]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Active time entry not found" });
      }

      // Update time_card and worksheet_session atomically with the time_entry close
      const tcResult = await client.query(
        `UPDATE time_cards
         SET clock_out_time = NOW(),
             total_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - clock_in_time))/60)
         WHERE employee_id = $1 AND clock_out_time IS NULL
         RETURNING session_id`,
        [userId]
      );
      if (tcResult.rows.length > 0 && tcResult.rows[0].session_id) {
        await client.query(
          `UPDATE worksheet_sessions SET status = 'pending_review', updated_at = NOW() WHERE id = $1`,
          [tcResult.rows[0].session_id]
        );
      }

      await client.query("COMMIT");

      const entryRow = result.rows[0];
      const durMin = entryRow.duration_minutes;
      const durDesc = durMin != null ? ` after ${durMin} minutes` : "";

      // Audit log — fire-and-forget outside the transaction
      pool.query(
        `INSERT INTO activity_log (id, user_id, event_type, description, link, seen_by, created_at)
         VALUES (gen_random_uuid(), $1, 'time_entry_clock_out', $2, '/admin/time-reports', '[]'::jsonb, now())`,
        [userId, `Clocked out${durDesc}`]
      ).catch((e: any) => console.error("[timeRoutes] audit log clock-out:", e.message));

      // ── Flag detection (runs outside the transaction) ───────────────────────
      let flagInfo: any = null;
      if (durMin != null) {
        const durH = durMin / 60;
        let flagType: string | null = null;
        let flagMessage = "";
        let flagThresholdHours = 0;
        let flagActualHours = Math.round(durH * 100) / 100;

        // Too short: < 15 min for billable entries
        if (!flagType && entryRow.entry_type === "billable" && durMin < 15) {
          flagType = "too_short";
          flagMessage = `Billable session was only ${durMin} min — please confirm this is correct.`;
          flagThresholdHours = 0.25;
        }

        // Too long: > max(estimated_hours × 1.5, 10 h)
        if (!flagType) {
          let threshold = 10;
          if (entryRow.job_id) {
            try {
              const jobR = await pool.query(
                `SELECT estimated_hours FROM jobs WHERE id = $1`,
                [entryRow.job_id]
              );
              const est = jobR.rows[0]?.estimated_hours;
              if (est) threshold = Math.max(threshold, Math.round(est * 1.5 * 100) / 100);
            } catch { /* non-fatal */ }
          }
          if (durH > threshold) {
            flagType = "too_long";
            flagMessage = `Session lasted ${durH.toFixed(1)}h — over the ${threshold}h threshold.`;
            flagThresholdHours = threshold;
          }
        }

        // Daily total > 12 h
        if (!flagType) {
          try {
            const dailyR = await pool.query(
              `SELECT COALESCE(SUM(duration_minutes), 0) AS total_min
               FROM time_entries
               WHERE user_id = $1 AND clock_in::date = CURRENT_DATE AND clock_out IS NOT NULL`,
              [userId]
            );
            const todayMin = Number(dailyR.rows[0].total_min);
            if (todayMin > 720) {
              const todayH = todayMin / 60;
              flagType = "daily_limit";
              flagMessage = `You've logged ${todayH.toFixed(1)}h today — over the 12h daily limit.`;
              flagThresholdHours = 12;
              flagActualHours = Math.round(todayH * 100) / 100;
            }
          } catch { /* non-fatal */ }
        }

        if (flagType) {
          pool.query(
            `UPDATE time_entries SET is_flagged = true WHERE id = $1`,
            [entryRow.id]
          ).catch(() => {});
          flagInfo = {
            flagged: true,
            type: flagType,
            message: flagMessage,
            threshold_hours: flagThresholdHours,
            actual_hours: flagActualHours,
          };
        }
      }

      const response: any = { ...entryRow };
      if (flagInfo) response._flag = flagInfo;
      return res.json(response);
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/time/entries/:id/flag-reason — store crew reason for flagged session ──
  app.patch("/api/time/entries/:id/flag-reason", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { id } = req.params;
    const { flag_reason } = req.body;
    if (!flag_reason?.trim()) {
      return res.status(400).json({ message: "flag_reason is required" });
    }
    try {
      const result = await pool.query(
        `UPDATE time_entries SET flag_reason = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
        [flag_reason.trim(), id, userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Entry not found" });
      }
      return res.json({ ok: true });
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

    const { user_id, job_id, customer, date_from, date_to, year, work_area } = req.query as Record<string, string>;

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
      if (work_area) {
        params.push(work_area);
        q += ` AND te.work_area_name = $${params.length}`;
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

      // Get distinct employees, jobs, and work areas for filter dropdowns
      const empResult = await pool.query(
        `SELECT DISTINCT u.id, u.name, u.username FROM time_entries te JOIN users u ON u.id = te.user_id ORDER BY u.name`
      );
      const jobResult = await pool.query(
        `SELECT DISTINCT j.id, j.client, j.type FROM time_entries te JOIN jobs j ON j.id = te.job_id WHERE te.job_id IS NOT NULL ORDER BY j.client`
      );
      const workAreaResult = await pool.query(
        `SELECT DISTINCT work_area_name FROM time_entries WHERE work_area_name IS NOT NULL AND work_area_name != '' ORDER BY work_area_name`
      );

      return res.json({
        entries: result.rows,
        totalMinutes,
        employees: empResult.rows,
        jobs: jobResult.rows,
        work_areas: workAreaResult.rows.map((r: any) => r.work_area_name) as string[],
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── My Hours: Pay Period Summary ────────────────────────────────────────────
  app.get("/api/time/my-hours/pay-period", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      // Current biweekly pay period — anchor-based so the result always CONTAINS today.
      // Old "last Saturday" approach showed the *previous* period on Sun–Fri because it
      // always rolled back to the most-recently-passed Saturday (the prior period's end).
      // Anchor: Apr 18 2026 (confirmed period-end Saturday from production data).
      const MS_PER_DAY    = 24 * 60 * 60 * 1000;
      const ANCHOR_MS     = Date.UTC(2026, 3, 18); // 0-indexed: 3 = April
      const daysSinceAnchor = (Date.now() - ANCHOR_MS) / MS_PER_DAY;
      const n             = Math.ceil(daysSinceAnchor / 14); // periods elapsed (ceiling = current period)
      const periodEndMs   = ANCHOR_MS + n * 14 * MS_PER_DAY;
      const periodStartMs = periodEndMs - 13 * MS_PER_DAY;

      const startStr = new Date(periodStartMs).toISOString().split("T")[0];
      const endStr   = new Date(periodEndMs).toISOString().split("T")[0];

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
    const { status, rejection_note } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be approved, rejected, or pending." });
    }

    try {
      const result = await pool.query(
        `UPDATE time_entries
         SET approval_status = $1,
             rejection_note  = $2
         WHERE id = $3
         RETURNING id, user_id, clock_in, approval_status, rejection_note`,
        [status, rejection_note ?? null, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: "Entry not found" });
      const row = result.rows[0];

      // Notify the employee when a decision is made (not when reset to pending)
      if (status !== "pending" && row.user_id) {
        const dateLabel = row.clock_in
          ? new Date(row.clock_in).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "your entry";
        const title   = status === "approved" ? "Time Entry Approved" : "Time Entry Rejected";
        const message = status === "approved"
          ? `Your time entry on ${dateLabel} has been approved.`
          : `Your time entry on ${dateLabel} was rejected.${rejection_note ? ` Note: ${rejection_note}` : ""}`;
        pool.query(
          `INSERT INTO staff_notifications (id, user_id, type, title, message, link, is_read, created_at)
           VALUES (gen_random_uuid(), $1, 'time_entry_decision', $2, $3, '/my-hours', false, now())`,
          [row.user_id, title, message]
        ).catch((e: any) => console.error("[timeRoutes] notify single approval:", e.message));
      }

      return res.json(row);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: Bulk approve / reject time entries ─────────────────────────────────
  app.post("/api/admin/time-entries/bulk-approval", requireAuth, async (req: any, res) => {
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { ids, status, rejection_note } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids must be a non-empty array" });
    }
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    try {
      const placeholders = ids.map((_: any, i: number) => `$${i + 3}`).join(", ");
      const result = await pool.query(
        `UPDATE time_entries
         SET approval_status = $1, rejection_note = $2
         WHERE id IN (${placeholders})
         RETURNING id, user_id, clock_in, approval_status, rejection_note`,
        [status, rejection_note ?? null, ...ids]
      );

      // Send one consolidated notification per affected employee (skip "pending" resets)
      if (status !== "pending") {
        const byUser = new Map<string, number>();
        for (const row of result.rows) {
          if (row.user_id) byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + 1);
        }
        const title = status === "approved" ? "Time Entries Approved" : "Time Entries Rejected";
        for (const [userId, count] of byUser) {
          const message = status === "approved"
            ? `${count} of your time ${count === 1 ? "entry has" : "entries have"} been approved.`
            : `${count} of your time ${count === 1 ? "entry was" : "entries were"} rejected.${rejection_note ? ` Note: ${rejection_note}` : ""}`;
          pool.query(
            `INSERT INTO staff_notifications (id, user_id, type, title, message, link, is_read, created_at)
             VALUES (gen_random_uuid(), $1, 'time_entry_decision', $2, $3, '/my-hours', false, now())`,
            [userId, title, message]
          ).catch((e: any) => console.error("[timeRoutes] notify bulk approval:", e.message));
        }
      }

      return res.json({ updated: result.rowCount, rows: result.rows });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: Time Card Approval List ──────────────────────────────────────────
  app.get("/api/admin/time-card-approval", requireAuth, async (req: any, res) => {
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { startDate, endDate, employeeId, status: statusFilter } = req.query as Record<string, string>;

    try {
      const params: any[] = [];
      let where = `WHERE te.clock_out IS NOT NULL`;

      if (startDate)   { params.push(startDate);   where += ` AND te.clock_in::date >= $${params.length}`; }
      if (endDate)     { params.push(endDate);     where += ` AND te.clock_in::date <= $${params.length}`; }
      if (employeeId && employeeId !== "all") { params.push(employeeId); where += ` AND te.user_id = $${params.length}`; }
      if (statusFilter && statusFilter !== "all") { params.push(statusFilter); where += ` AND te.approval_status = $${params.length}`; }

      const result = await pool.query(
        `SELECT
           te.id,
           te.user_id,
           u.name       AS employee_name,
           u.username,
           te.job_id,
           j.client     AS job_title,
           j.address    AS job_address,
           te.clock_in,
           te.clock_out,
           te.duration_minutes,
           te.entry_type,
           te.work_area_name,
           te.notes,
           te.approval_status,
           te.rejection_note,
           te.clock_in_lat,
           te.clock_in_lng,
           te.clock_out_lat,
           te.clock_out_lng
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

      const summaryParams: any[] = [];
      let summaryWhere = `WHERE te.clock_out IS NOT NULL`;
      if (startDate)                          { summaryParams.push(startDate);    summaryWhere += ` AND te.clock_in::date >= $${summaryParams.length}`; }
      if (endDate)                            { summaryParams.push(endDate);      summaryWhere += ` AND te.clock_in::date <= $${summaryParams.length}`; }
      if (employeeId && employeeId !== "all") { summaryParams.push(employeeId);   summaryWhere += ` AND te.user_id = $${summaryParams.length}`; }

      const allResult = await pool.query(
        `SELECT approval_status FROM time_entries te
         LEFT JOIN users u ON u.id = te.user_id
         ${summaryWhere}`,
        summaryParams
      );
      const allRows = allResult.rows;
      const counts = {
        pending:  allRows.filter((r: any) => r.approval_status === "pending").length,
        approved: allRows.filter((r: any) => r.approval_status === "approved").length,
        rejected: allRows.filter((r: any) => r.approval_status === "rejected").length,
      };

      return res.json({
        entries,
        employees: employeesResult.rows,
        counts,
        summary: {
          totalEntries: entries.length,
          totalHours: (totalMinutes / 60).toFixed(2),
        },
      });
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

  // ── Admin: Edit any time entry ───────────────────────────────────────────────
  app.patch("/api/admin/time-entries/:id", requireAuth, async (req, res) => {
    const actor     = req.user as any;
    const callerRole = actor?.role;
    const isMaster   = actor?.isMasterAdmin;
    if (!["Admin", "Manager"].includes(callerRole) && !isMaster) {
      return res.status(403).json({ message: "Admins only" });
    }

    const { id } = req.params;
    const { clock_in, clock_out, job_id, work_area_name, notes, entry_type } = req.body;

    if (!clock_in) return res.status(400).json({ message: "clock_in is required" });

    const cin  = new Date(clock_in);
    const cout = clock_out ? new Date(clock_out) : null;

    if (cout && cout <= cin) {
      return res.status(400).json({ message: "clock_out must be after clock_in" });
    }

    const durationMinutes = cout
      ? Math.round((cout.getTime() - cin.getTime()) / 60000)
      : null;

    try {
      // Fetch current record (with employee name) before applying changes
      const oldResult = await pool.query(
        `SELECT te.*, u.name AS employee_name
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         WHERE te.id = $1`,
        [id]
      );
      if (oldResult.rows.length === 0) return res.status(404).json({ message: "Entry not found" });
      const old = oldResult.rows[0];

      const result = await pool.query(
        `UPDATE time_entries
         SET clock_in         = $1,
             clock_out        = $2,
             duration_minutes = $3,
             job_id           = $4,
             work_area_name   = $5,
             notes            = $6,
             entry_type       = COALESCE($7, entry_type),
             updated_at       = NOW(),
             edited_by        = $9
         WHERE id = $8
         RETURNING *`,
        [cin, cout, durationMinutes, job_id ?? null, work_area_name ?? null, notes ?? null, entry_type ?? null, id, actor?.id ?? null]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Entry not found" });

      // Build a human-readable diff for the audit log
      const fmt = (d: any) => d ? new Date(d).toLocaleString("en-US", { timeZone: "UTC", hour12: false }) : "—";
      const changes: string[] = [];
      if (cin.toISOString() !== new Date(old.clock_in).toISOString())
        changes.push(`clock_in: ${fmt(old.clock_in)} → ${fmt(cin)}`);
      if ((cout?.toISOString() ?? null) !== (old.clock_out ? new Date(old.clock_out).toISOString() : null))
        changes.push(`clock_out: ${fmt(old.clock_out)} → ${fmt(cout)}`);
      if ((job_id ?? null) !== (old.job_id ?? null))
        changes.push(`job_id: ${old.job_id ?? "none"} → ${job_id ?? "none"}`);
      if ((notes ?? null) !== (old.notes ?? null))
        changes.push(`notes updated`);
      if (entry_type && entry_type !== old.entry_type)
        changes.push(`type: ${old.entry_type} → ${entry_type}`);

      const diffText = changes.length > 0 ? changes.join("; ") : "no field changes";
      const description = `${actor?.name ?? "Admin"} edited time entry for ${old.employee_name}: ${diffText}`;

      pool.query(
        `INSERT INTO activity_log (id, user_id, event_type, description, link, seen_by, created_at)
         VALUES (gen_random_uuid(), $1, 'time_entry_edit', $2, '/admin/time-reports', '[]'::jsonb, now())`,
        [actor?.id ?? null, description]
      ).catch((e: any) => console.error("[timeRoutes] audit log edit:", e.message));

      return res.status(200).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Manager: Live Crew (all currently clocked-in employees) ─────────────────
  app.get("/api/manager/live-crew", requireAuth, async (req: any, res) => {
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

    try {
      const { rows } = await pool.query(`
        SELECT
          te.id,
          te.clock_in,
          te.entry_type,
          te.work_area_name,
          te.job_id,
          te.notes,
          u.id         AS user_id,
          u.name       AS employee_name,
          u.username,
          j.client     AS job_name,
          j.title      AS job_title,
          j.address    AS job_address,
          gp.lat,
          gp.lng,
          gp.recorded_at AS last_ping_at
        FROM time_entries te
        JOIN users u ON u.id = te.user_id
        LEFT JOIN jobs j ON j.id = te.job_id
        LEFT JOIN LATERAL (
          SELECT lat, lng, recorded_at
          FROM gps_pings
          WHERE time_entry_id = te.id
          ORDER BY recorded_at DESC
          LIMIT 1
        ) gp ON true
        WHERE te.clock_out IS NULL
          AND u.role NOT IN ('Customer', 'Master Admin')
        ORDER BY te.clock_in ASC
      `);
      return res.json(rows);
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
      // Verify the time_entry_id belongs to this user and is still active
      if (time_entry_id) {
        const { rows: check } = await pool.query(
          `SELECT id FROM time_entries WHERE id = $1 AND user_id = $2 AND clock_out IS NULL LIMIT 1`,
          [time_entry_id, userId]
        );
        if (!check.length) {
          return res.status(403).json({ message: "time_entry_id is not an active entry for this user" });
        }
      }

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
