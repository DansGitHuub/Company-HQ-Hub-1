import type { Express } from "express";
import { pool } from "./db";
import { sendEmail } from "./emailService";
import { getAdminManagerEmails } from "./dailyWorksheetRoutes";
import { buildRouteDayEmail } from "./emailHelpers";

export function registerRouteRoutes(app: Express, requireAuth: any) {
  // ── GET /api/route/today ──────────────────────────────────────────────────
  // Returns the current user's route_day row for today (upserted) plus their
  // ordered stop list from job_assignments, enriched with work_areas, the
  // latest worksheet_session, and any open time_entry per job.
  app.get("/api/route/today", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      // job_assignments.employee_id → employees.id (not users.id)
      const empResult = await pool.query(
        `SELECT id FROM employees WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const employeeId: string | null = empResult.rows[0]?.id ?? null;

      // Upsert the route_days row for today.
      // route_days.employee_id references users(id) so we use userId here.
      const rdResult = await pool.query(
        `INSERT INTO route_days (id, employee_id, date)
         VALUES (gen_random_uuid()::text, $1, CURRENT_DATE)
         ON CONFLICT (employee_id, date) DO UPDATE
           SET updated_at = NOW()
         RETURNING *`,
        [userId]
      );
      const route_day = rdResult.rows[0];

      // Build the stop list only when an employee record exists.
      // $1 = employees.id  (job_assignments filter)
      // $2 = users.id      (worksheet_sessions + time_entries filter)
      let stops: any[] = [];
      if (employeeId) {
        const stopsResult = await pool.query(
          `SELECT
             ja.sort_order,
             j.id,
             j.title,
             j.status,
             j.division,
             j.color,
             j.client,
             j.scheduled_date::date  AS scheduled_date,
             j.scheduled_start_time,
             j.scheduled_end_time,
             j.address,
             COALESCE(
               c.first_name || ' ' || c.last_name,
               c.company_name
             )                       AS customer_name,
             COALESCE(p.address, j.address) AS customer_address,
             COALESCE(
               json_agg(jwa ORDER BY jwa.sort_order)
               FILTER (WHERE jwa.id IS NOT NULL),
               '[]'::json
             )                       AS work_areas,
             ws.id                   AS session_id,
             ws.status               AS session_status,
             ws.skip_reason,
             ws.skipped_at,
             te.id                   AS time_entry_id,
             te.clock_in             AS time_entry_clock_in,
             (SELECT COALESCE(
               json_agg(
                 json_build_object(
                   'id',         wp.id,
                   'photo_type', wp.photo_type,
                   'photo_url',  '/api/worksheets/photos/' || wp.id::text || '/download'
                 )
                 ORDER BY wp.created_at
               ) FILTER (WHERE wp.id IS NOT NULL),
               '[]'::json
             )
             FROM worksheet_photos wp
             WHERE ws.id IS NOT NULL AND wp.session_id = ws.id
             )                       AS photos
           FROM job_assignments ja
           JOIN  jobs j        ON j.id  = ja.job_id
           LEFT JOIN customers c  ON c.id  = j.customer_id
           LEFT JOIN properties p ON p.id  = j.property_id
           LEFT JOIN job_work_areas jwa
             ON jwa.job_id = j.id AND jwa.is_active = true
           -- latest worksheet_session for this job+date+user
           LEFT JOIN LATERAL (
             SELECT id, status, skip_reason, skipped_at
             FROM   worksheet_sessions
             WHERE  job_id      = j.id
               AND  date        = CURRENT_DATE
               AND  employee_id = $2
             ORDER  BY created_at DESC
             LIMIT  1
           ) ws ON true
           -- open time_entry for this job+user (clock_out IS NULL)
           LEFT JOIN LATERAL (
             SELECT id, clock_in
             FROM   time_entries
             WHERE  job_id    = j.id
               AND  user_id   = $2
               AND  clock_out IS NULL
             ORDER  BY clock_in DESC
             LIMIT  1
           ) te ON true
           WHERE  ja.scheduled_date = CURRENT_DATE
             AND  ja.employee_id    = $1
           GROUP BY
             ja.sort_order,
             j.id, j.title, j.status, j.division, j.color, j.client,
             j.scheduled_date, j.scheduled_start_time, j.scheduled_end_time,
             j.address,
             c.first_name, c.last_name, c.company_name,
             p.address,
             ws.id, ws.status, ws.skip_reason, ws.skipped_at,
             te.id, te.clock_in
           ORDER BY ja.sort_order, j.scheduled_start_time NULLS LAST`,
          [employeeId, userId]
        );
        stops = stopsResult.rows;
      }

      // Total clocked-in minutes for the current user today (across all jobs).
      const minResult = await pool.query(
        `SELECT COALESCE(SUM(duration_minutes), 0)::int AS total_minutes_today
         FROM time_entries
         WHERE user_id = $1
           AND DATE(clock_in AT TIME ZONE 'UTC') = CURRENT_DATE`,
        [userId]
      );
      const total_minutes_today: number = minResult.rows[0]?.total_minutes_today ?? 0;

      res.json({ route_day, stops, total_minutes_today });
    } catch (err: any) {
      console.error("[route/today]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/route/stops/:jobId/skip ───────────────────────────────────
  // Finds-or-creates the worksheet_session for (jobId, today, current user) and
  // marks it as skipped.  Body: { reason: string }.
  app.patch("/api/route/stops/:jobId/skip", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { jobId } = req.params;
    const reason: string | undefined = req.body?.reason;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "reason is required" });
    }

    try {
      // Find-or-create worksheet_session for (jobId, today, userId).
      // employee_id on worksheet_sessions stores users.id (same as userId).
      const existing = await pool.query(
        `SELECT id FROM worksheet_sessions
         WHERE job_id = $1 AND date = CURRENT_DATE AND employee_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [jobId, userId]
      );

      let sessionId: number;
      if (existing.rows.length > 0) {
        sessionId = existing.rows[0].id;
        await pool.query(
          `UPDATE worksheet_sessions
           SET status      = 'skipped',
               skip_reason = $1,
               skipped_at  = NOW()
           WHERE id = $2`,
          [reason.trim(), sessionId]
        );
      } else {
        const inserted = await pool.query(
          `INSERT INTO worksheet_sessions (job_id, date, employee_id, status, skip_reason, skipped_at)
           VALUES ($1, CURRENT_DATE, $2, 'skipped', $3, NOW())
           RETURNING id`,
          [jobId, userId, reason.trim()]
        );
        sessionId = inserted.rows[0].id;
      }

      res.json({ ok: true, session_id: sessionId });
    } catch (err: any) {
      console.error("[route/skip]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/route/start ─────────────────────────────────────────────────
  // Marks the current user's today route as started (idempotent — only sets
  // started_at once; subsequent calls are no-ops).
  app.post("/api/route/start", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      await pool.query(
        `UPDATE route_days
         SET    started_at = NOW()
         WHERE  employee_id = $1
           AND  date        = CURRENT_DATE
           AND  started_at  IS NULL`,
        [userId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[route/start]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/route/submit ────────────────────────────────────────────────
  // Marks today's route as complete, sends a summary email to admins/managers,
  // and inserts an in-app notification for each Admin/Manager.
  app.post("/api/route/submit", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;

    // 1. Validate body.
    const { summary_notes, weather } = req.body ?? {};
    if (typeof summary_notes !== "string") {
      return res.status(400).json({ error: "summary_notes must be a string" });
    }
    if (!Array.isArray(weather) || weather.some((w: any) => typeof w !== "string")) {
      return res.status(400).json({ error: "weather must be an array of strings" });
    }

    try {
      // 2. Mark route_day as submitted (weather is TEXT[] in the schema).
      const rdResult = await pool.query(
        `UPDATE route_days
         SET    completed_at  = NOW(),
                status        = 'submitted',
                summary_notes = $1,
                weather       = $2::text[],
                updated_at    = NOW()
         WHERE  employee_id = $3
           AND  date        = CURRENT_DATE
         RETURNING id, date`,
        [summary_notes, weather, userId]
      );

      if (rdResult.rowCount === 0) {
        return res.status(404).json({ error: "No active route day for today" });
      }
      const routeDay = rdResult.rows[0];
      const routeDayId: string = routeDay.id;
      const routeDate: string = routeDay.date instanceof Date
        ? routeDay.date.toISOString().slice(0, 10)
        : String(routeDay.date).slice(0, 10);

      // Format date as MM/DD/YYYY for notification message.
      const [yyyy, mm, dd] = routeDate.split("-");
      const formattedDate = `${mm}/${dd}/${yyyy}`;

      // Resolve employee name.
      const userResult = await pool.query(
        `SELECT name, username FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      const userRow = userResult.rows[0];
      const employeeName: string = userRow?.name || userRow?.username || "Employee";

      // 3. Gather today's stops with clock times for the email body.
      //    job_assignments.employee_id → employees.id; resolve it first.
      const empResult = await pool.query(
        `SELECT id FROM employees WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const employeeId: string | null = empResult.rows[0]?.id ?? null;

      let stopsForEmail: Array<{
        title: string;
        customer_name: string | null;
        address: string | null;
        session_status: string | null;
        skip_reason: string | null;
        clock_in: string | null;
        clock_out: string | null;
      }> = [];

      if (employeeId) {
        const stopsResult = await pool.query(
          `SELECT
             j.title,
             COALESCE(c.company_name, TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), NULL) AS customer_name,
             COALESCE(p.address, j.address) AS address,
             ws.status      AS session_status,
             ws.skip_reason,
             te.clock_in,
             te.clock_out
           FROM job_assignments ja
           JOIN jobs j ON j.id = ja.job_id
           LEFT JOIN customers c ON c.id = j.customer_id
           LEFT JOIN properties p ON p.id = j.property_id
           LEFT JOIN LATERAL (
             SELECT status, skip_reason
             FROM   worksheet_sessions
             WHERE  job_id      = j.id
               AND  date        = CURRENT_DATE
               AND  employee_id = $2
             ORDER  BY created_at DESC LIMIT 1
           ) ws ON true
           LEFT JOIN LATERAL (
             SELECT clock_in, clock_out
             FROM   time_entries
             WHERE  job_id  = j.id
               AND  user_id = $2
               AND  DATE(clock_in AT TIME ZONE 'UTC') = CURRENT_DATE
             ORDER  BY clock_in DESC LIMIT 1
           ) te ON true
           WHERE  ja.scheduled_date = CURRENT_DATE
             AND  ja.employee_id    = $1
           ORDER  BY ja.sort_order, j.scheduled_start_time NULLS LAST`,
          [employeeId, userId]
        );
        stopsForEmail = stopsResult.rows;
      }

      // Completed stop count (for notification message).
      const completedStatuses = ["pending_review", "submitted", "approved"];
      const completedStopCount = stopsForEmail.filter(
        (s) => s.session_status != null && completedStatuses.includes(s.session_status)
      ).length;

      // 4. Build HTML email and send to all Admin/Manager recipients.
      const htmlBody = buildRouteDayEmail({
        employeeName,
        date: routeDate,
        weather,
        summaryNotes: summary_notes,
        stops: stopsForEmail,
      });

      const subject = `Route Day Submitted — ${employeeName} (${formattedDate})`;
      const recipients = await getAdminManagerEmails();
      for (const r of recipients) {
        sendEmail(r.email, subject, htmlBody).catch((err: any) =>
          console.error("[route/submit] email error:", err.message)
        );
      }

      // 5. Insert in-app notification for each Admin/Manager user.
      const adminUsers = await pool.query(
        `SELECT id FROM users WHERE role IN ('Admin','Manager')`
      );
      for (const admin of adminUsers.rows) {
        await pool.query(
          `INSERT INTO staff_notifications
             (id, user_id, type, title, message, link, is_read, created_at)
           VALUES
             (gen_random_uuid(), $1, 'route_day', $2, $3, $4, false, NOW())`,
          [
            admin.id,
            "Route Day Submitted",
            `${employeeName} completed ${completedStopCount} stop${completedStopCount !== 1 ? "s" : ""} on ${formattedDate}`,
            `/admin/route-days/${routeDayId}`,
          ]
        );
      }

      console.log(
        `[route/submit] routeDayId=${routeDayId} employee=${employeeName} completed=${completedStopCount} emailsSent=${recipients.length}`
      );

      // 6. Return 200.
      res.json({ ok: true, route_day_id: routeDayId });
    } catch (err: any) {
      console.error("[route/submit]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/admin/route-days ─────────────────────────────────────────────
  // Returns route_days with status = 'submitted' (or optional ?status= filter)
  // enriched with employee name, total minutes, completed count, skipped stops.
  // Admin / Manager only.
  app.get("/api/admin/route-days", requireAuth, async (req: any, res) => {
    const user = req.user;
    if (user?.role !== "Admin" && user?.role !== "Manager" && !user?.isMasterAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const status = (req.query.status as string) || "submitted";
    try {
      const { rows } = await pool.query(
        `SELECT
           rd.id,
           rd.date::text                          AS date,
           rd.weather,
           rd.summary_notes,
           rd.status,
           COALESCE(u.name, u.username)           AS employee_name,
           -- total minutes clocked in for this user on this date
           (
             SELECT COALESCE(SUM(te.duration_minutes), 0)::int
             FROM   time_entries te
             WHERE  te.user_id = rd.employee_id
               AND  DATE(te.clock_in AT TIME ZONE 'UTC') = rd.date
           ) AS total_minutes,
           -- completed stop count (worksheet_sessions status in approved set)
           (
             SELECT COUNT(*)::int
             FROM   job_assignments ja
             JOIN   employees emp ON emp.id = ja.employee_id AND emp.user_id = rd.employee_id
             JOIN   jobs j         ON j.id = ja.job_id
             LEFT JOIN worksheet_sessions ws
               ON  ws.job_id = j.id
               AND ws.date = rd.date
               AND ws.employee_id = rd.employee_id
             WHERE  ja.scheduled_date = rd.date
               AND  ws.status IN ('pending_review', 'submitted', 'approved')
           ) AS completed_count,
           -- skipped stops as JSON array
           (
             SELECT COALESCE(
               json_agg(json_build_object(
                 'title',         j.title,
                 'skip_reason',   ws.skip_reason,
                 'customer_name', COALESCE(c.company_name,
                                    TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')))
               )),
               '[]'::json
             )
             FROM   job_assignments ja
             JOIN   employees emp ON emp.id = ja.employee_id AND emp.user_id = rd.employee_id
             JOIN   jobs j         ON j.id = ja.job_id
             LEFT JOIN customers c ON c.id = j.customer_id
             LEFT JOIN worksheet_sessions ws
               ON  ws.job_id = j.id
               AND ws.date = rd.date
               AND ws.employee_id = rd.employee_id
             WHERE  ja.scheduled_date = rd.date
               AND  ws.status = 'skipped'
           ) AS skipped_stops
         FROM  route_days rd
         JOIN  users u ON u.id = rd.employee_id
         WHERE rd.status = $1
         ORDER BY rd.date DESC, COALESCE(u.name, u.username)`,
        [status]
      );
      res.json(rows);
    } catch (err: any) {
      console.error("[admin/route-days]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/admin/route-days/:id/approve ───────────────────────────────
  app.patch("/api/admin/route-days/:id/approve", requireAuth, async (req: any, res) => {
    const user = req.user;
    if (user?.role !== "Admin" && user?.role !== "Manager" && !user?.isMasterAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const result = await pool.query(
        `UPDATE route_days SET status = 'approved', updated_at = NOW()
         WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Route day not found" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[admin/route-days/approve]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/admin/route-days/:id/reject ────────────────────────────────
  app.patch("/api/admin/route-days/:id/reject", requireAuth, async (req: any, res) => {
    const user = req.user;
    if (user?.role !== "Admin" && user?.role !== "Manager" && !user?.isMasterAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const result = await pool.query(
        `UPDATE route_days SET status = 'rejected', updated_at = NOW()
         WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Route day not found" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[admin/route-days/reject]", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
