import type { Express } from "express";
import { pool } from "./db";

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
             te.clock_in             AS time_entry_clock_in
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

      res.json({ route_day, stops });
    } catch (err: any) {
      console.error("[route/today]", err.message);
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
}
