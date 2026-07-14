import type { Express } from "express";
import { pool } from "./db";

// ── Overlap-check helpers ──────────────────────────────────────────────────
// Duplicated from server/dailyPlanRoutes.ts's conflict-detection algorithm
// (same codebase convention: this small helper pair is intentionally
// duplicated rather than shared, so this read-only check route never has to
// modify or depend on the daily-plan module).
function timeToMinutesLocal(t: string | null | undefined): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function rangesOverlapLocal(
  s1: number | null, e1: number | null,
  s2: number | null, e2: number | null,
  bufferMinutes = 480
): boolean {
  if (s1 === null || s2 === null) return true; // no time info → treat as potential conflict
  const end1 = e1 ?? s1 + bufferMinutes;
  const end2 = e2 ?? s2 + bufferMinutes;
  return s1 < end2 && s2 < end1;
}

// Reads the admin-configurable "Double-Booking Warning Buffer" business rule
// (falls back to the historical 480-minute default if unset).
async function getDoubleBookingBufferMinutes(): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM business_rules WHERE key = 'double_booking_buffer_minutes'`
    );
    const parsed = rows[0] ? Number(rows[0].value) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 480;
  } catch {
    return 480;
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

function requireNonCustomer(req: any, res: any, next: any) {
  if (req.user?.role === "Customer") return res.status(403).json({ message: "Access denied" });
  next();
}

function requireScheduleWrite(req: any, res: any, next: any) {
  const role = req.user?.role;
  const isMaster = req.user?.isMasterAdmin;
  if (isMaster || role === "Admin" || role === "Manager") return next();
  return res.status(403).json({ message: "Scheduling changes require Admin or Manager role" });
}

export function registerSchedulingRoutes(app: Express) {
  app.use("/api/scheduling", requireNonCustomer);

  // ── GET /api/scheduling/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD ──────────────
  // Returns jobs scheduled within the date range, with assigned crew
  app.get("/api/scheduling/calendar", requireAuth, async (req, res) => {
    try {
      const { start, end } = req.query as { start?: string; end?: string };
      if (!start || !end) return res.status(400).json({ message: "start and end are required" });

      const { rows } = await pool.query(
        `SELECT
           j.id, j.title, j.status, j.division, j.color,
           j.scheduled_date::date AS scheduled_date,
           j.scheduled_start_time, j.scheduled_end_time,
           c.first_name || ' ' || c.last_name AS customer_name,
           p.address AS property_address,
           COALESCE(MIN(ja.sort_order), 0) AS sort_order,
           COALESCE(
             json_agg(
               DISTINCT jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name)
             ) FILTER (WHERE e.id IS NOT NULL),
             '[]'
           ) AS assigned_crew,
           MIN(j.safety_notes)        AS safety_notes,
           MIN(j.restrictions_notes)  AS restrictions_notes,
           MIN(p.access_notes)        AS access_notes,
           COALESCE((
             SELECT SUM(inv.balance_due::numeric)
             FROM invoices inv
             WHERE inv.customer_id = j.customer_id
               AND inv.status = 'overdue'
               AND inv.balance_due::numeric > 0
           ), 0) AS overdue_balance
         FROM jobs j
         LEFT JOIN customers c ON c.id = j.customer_id
         LEFT JOIN properties p ON p.id = j.property_id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id
         LEFT JOIN employees e ON e.id = ja.employee_id
         WHERE j.scheduled_date IS NOT NULL
           AND j.scheduled_date::date BETWEEN $1 AND $2
         GROUP BY j.id, c.first_name, c.last_name, p.address
         ORDER BY j.scheduled_date, COALESCE(MIN(ja.sort_order), 0), j.scheduled_start_time NULLS LAST`,
        [start, end]
      );
      res.json(rows);
    } catch (err) {
      console.error("[scheduling/calendar]", err);
      res.status(500).json({ message: "Error fetching calendar jobs" });
    }
  });

  // ── GET /api/scheduling/unscheduled ──────────────────────────────────────────
  // Returns jobs without a scheduled_date and not completed/invoiced
  app.get("/api/scheduling/unscheduled", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           j.id, j.title, j.status, j.division, j.color,
           c.first_name || ' ' || c.last_name AS customer_name,
           p.address AS property_address,
           j.safety_notes,
           j.restrictions_notes,
           p.access_notes,
           COALESCE((
             SELECT SUM(inv.balance_due::numeric)
             FROM invoices inv
             WHERE inv.customer_id = j.customer_id
               AND inv.status = 'overdue'
               AND inv.balance_due::numeric > 0
           ), 0) AS overdue_balance
         FROM jobs j
         LEFT JOIN customers c ON c.id = j.customer_id
         LEFT JOIN properties p ON p.id = j.property_id
         WHERE j.scheduled_date IS NULL
           AND j.status NOT IN ('completed', 'invoiced', 'cancelled')
         ORDER BY j.created_at DESC
         LIMIT 100`
      );
      res.json(rows);
    } catch (err) {
      console.error("[scheduling/unscheduled]", err);
      res.status(500).json({ message: "Error fetching unscheduled jobs" });
    }
  });

  // ── PATCH /api/scheduling/jobs/:id/schedule ───────────────────────────────────
  // Schedule a job and assign crew members
  app.patch("/api/scheduling/jobs/:id/schedule", requireAuth, requireScheduleWrite, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;
      const { scheduled_date, scheduled_start, scheduled_end, division, color, employee_ids = [] } = req.body;

      if (!scheduled_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "scheduled_date is required" });
      }

      // Update job scheduling columns
      await client.query(
        `UPDATE jobs SET
           scheduled_date = $1,
           scheduled_start_time = $2,
           scheduled_end_time   = $3,
           division             = COALESCE($4, division),
           color                = COALESCE($5, color),
           status               = CASE WHEN status = 'lead' THEN 'scheduled' ELSE status END,
           updated_at           = NOW()
         WHERE id = $6`,
        [
          scheduled_date,
          scheduled_start || null,
          scheduled_end   || null,
          division        || null,
          color           || null,
          id,
        ]
      );

      // Replace crew assignments
      await client.query(`DELETE FROM job_assignments WHERE job_id = $1`, [id]);
      for (const emp_id of employee_ids) {
        await client.query(
          `INSERT INTO job_assignments (job_id, employee_id, scheduled_date)
           VALUES ($1, $2, $3)
           ON CONFLICT (job_id, employee_id, scheduled_date) DO NOTHING`,
          [id, emp_id, scheduled_date]
        );
      }

      await client.query("COMMIT");

      // Return the updated job with crew
      const { rows } = await pool.query(
        `SELECT
           j.id, j.title, j.status, j.division, j.color,
           j.scheduled_date::date AS scheduled_date,
           j.scheduled_start_time, j.scheduled_end_time,
           c.first_name || ' ' || c.last_name AS customer_name,
           p.address AS property_address,
           MIN(j.safety_notes)        AS safety_notes,
           MIN(j.restrictions_notes)  AS restrictions_notes,
           MIN(p.access_notes)        AS access_notes,
           COALESCE((
             SELECT SUM(inv.balance_due::numeric)
             FROM invoices inv
             WHERE inv.customer_id = j.customer_id
               AND inv.status = 'overdue'
               AND inv.balance_due::numeric > 0
           ), 0) AS overdue_balance,
           COALESCE(
             json_agg(DISTINCT jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name))
             FILTER (WHERE e.id IS NOT NULL), '[]'
           ) AS assigned_crew
         FROM jobs j
         LEFT JOIN customers c ON c.id = j.customer_id
         LEFT JOIN properties p ON p.id = j.property_id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id
         LEFT JOIN employees e ON e.id = ja.employee_id
         WHERE j.id = $1
         GROUP BY j.id, c.first_name, c.last_name, p.address`,
        [id]
      );
      res.json(rows[0] ?? {});
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[scheduling/schedule]", err);
      res.status(500).json({ message: "Error scheduling job" });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/scheduling/jobs/:id/unschedule ─────────────────────────────────
  // Remove a job from the schedule
  app.patch("/api/scheduling/jobs/:id/unschedule", requireAuth, requireScheduleWrite, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE jobs SET
           scheduled_date       = NULL,
           scheduled_start_time = NULL,
           scheduled_end_time   = NULL,
           updated_at           = NOW()
         WHERE id = $1`,
        [req.params.id]
      );
      await client.query(`DELETE FROM job_assignments WHERE job_id = $1`, [req.params.id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[scheduling/unschedule]", err);
      res.status(500).json({ message: "Error unscheduling job" });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/scheduling/jobs/:jobId/sort-order ─────────────────────────────
  // Updates the sort_order of a job_assignment row for a specific employee+date.
  // Requires Admin or Manager role.
  app.patch("/api/scheduling/jobs/:jobId/sort-order", requireAuth, async (req: any, res) => {
    const user = req.user;
    if (user?.role !== "Admin" && user?.role !== "Manager" && !user?.isMasterAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { jobId } = req.params;
    const { employee_id, scheduled_date, sort_order } = req.body ?? {};
    if (!employee_id || !scheduled_date || typeof sort_order !== "number") {
      return res.status(400).json({ message: "employee_id, scheduled_date, and sort_order are required" });
    }
    try {
      const result = await pool.query(
        `UPDATE job_assignments
         SET sort_order = $1
         WHERE job_id = $2 AND employee_id = $3 AND scheduled_date = $4`,
        [sort_order, jobId, employee_id, scheduled_date]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "No matching job assignment found" });
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[scheduling/sort-order]", err.message);
      res.status(500).json({ message: "Error updating sort order" });
    }
  });

  // ── POST /api/scheduling/check-crew-overlap ──────────────────────────────────
  // Read-only pre-save check: does assigning these employees to a job on this
  // date/time window overlap with any of their OTHER existing assignments?
  // Does not write anything. Non-blocking — the caller decides what to do
  // with the returned conflicts.
  app.post("/api/scheduling/check-crew-overlap", requireAuth, async (req, res) => {
    try {
      const { employee_ids = [], date, start_time, end_time, exclude_job_id } = req.body ?? {};
      if (!Array.isArray(employee_ids) || employee_ids.length === 0 || !date) {
        return res.json({ conflicts: [] });
      }

      const { rows } = await pool.query(
        `SELECT ja.employee_id,
                TRIM(e.first_name || ' ' || COALESCE(e.last_name, '')) AS employee_name,
                j.id AS job_id, j.title AS job_title,
                j.scheduled_start_time, j.scheduled_end_time
         FROM job_assignments ja
         JOIN jobs j ON j.id = ja.job_id
         JOIN employees e ON e.id = ja.employee_id
         WHERE ja.employee_id = ANY($1::varchar[])
           AND ja.scheduled_date = $2
           AND j.id IS DISTINCT FROM $3`,
        [employee_ids, date, exclude_job_id || null]
      );

      const newStart = timeToMinutesLocal(start_time);
      const newEnd = timeToMinutesLocal(end_time);
      const bufferMinutes = await getDoubleBookingBufferMinutes();

      const conflicts = rows
        .filter((r: any) => rangesOverlapLocal(
          newStart, newEnd,
          timeToMinutesLocal(r.scheduled_start_time), timeToMinutesLocal(r.scheduled_end_time),
          bufferMinutes
        ))
        .map((r: any) => ({
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          job_id: r.job_id,
          job_title: r.job_title,
          start_time: r.scheduled_start_time,
          end_time: r.scheduled_end_time,
        }));

      res.json({ conflicts });
    } catch (err) {
      console.error("[scheduling/check-crew-overlap]", err);
      res.status(500).json({ message: "Error checking crew overlap" });
    }
  });

  // ── GET /api/scheduling/employees ────────────────────────────────────────────
  // Field crew list for the crew picker
  app.get("/api/scheduling/employees", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, first_name, last_name, job_title AS position, department
         FROM employees
         WHERE (status IS NULL OR status NOT IN ('inactive','terminated'))
         ORDER BY first_name, last_name`
      );
      res.json(rows);
    } catch (err) {
      console.error("[scheduling/employees]", err);
      res.status(500).json({ message: "Error fetching employees" });
    }
  });
}
