import type { Express } from "express";
import { pool } from "./db";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

export function registerSchedulingRoutes(app: Express) {
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
           COALESCE(
             json_agg(
               DISTINCT jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name)
             ) FILTER (WHERE e.id IS NOT NULL),
             '[]'
           ) AS assigned_crew
         FROM jobs j
         LEFT JOIN customers c ON c.id = j.customer_id
         LEFT JOIN properties p ON p.id = j.property_id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id
         LEFT JOIN employees e ON e.id = ja.employee_id
         WHERE j.scheduled_date IS NOT NULL
           AND j.scheduled_date::date BETWEEN $1 AND $2
         GROUP BY j.id, c.first_name, c.last_name, p.address
         ORDER BY j.scheduled_date, j.scheduled_start_time NULLS LAST`,
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
           p.address AS property_address
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
  app.patch("/api/scheduling/jobs/:id/schedule", requireAuth, async (req, res) => {
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
  app.patch("/api/scheduling/jobs/:id/unschedule", requireAuth, async (req, res) => {
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
