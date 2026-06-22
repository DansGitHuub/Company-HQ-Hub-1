import type { Express } from "express";
import { pool } from "./db";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

export function registerMyDayRoutes(app: Express) {
  // ── GET /api/my-day — today's scheduled jobs for the logged-in user ──────────
  app.get("/api/my-day", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      // Find the employee record for this user (if any)
      const empResult = await pool.query(
        `SELECT id FROM employees WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const employeeId = empResult.rows[0]?.id ?? null;

      const { rows } = await pool.query(
        `SELECT
           j.id, j.title, j.status, j.division, j.color,
           j.client,
           j.scheduled_date::date AS scheduled_date,
           j.scheduled_start_time, j.scheduled_end_time,
           j.address,
           COALESCE(c.first_name || ' ' || c.last_name, c.company_name) AS customer_name,
           COALESCE(p.address, j.address) AS customer_address,
           p.access_notes,
           p.gate_code,
           p.has_pets,
           cp.phone AS customer_phone,
           COALESCE(
             json_agg(
               jwa ORDER BY jwa.sort_order, jwa.name
             ) FILTER (WHERE jwa.id IS NOT NULL),
             '[]'::json
           ) AS work_areas
         FROM jobs j
         LEFT JOIN customers c ON c.id = j.customer_id
         LEFT JOIN properties p ON p.id = j.property_id
         LEFT JOIN customer_phones cp ON cp.customer_id = c.id AND cp.is_primary = true
         LEFT JOIN job_assignments ja
           ON ja.job_id = j.id
           AND ja.scheduled_date = j.scheduled_date::date
         LEFT JOIN job_work_areas jwa ON jwa.job_id = j.id AND jwa.is_active = true
         WHERE j.scheduled_date::date = CURRENT_DATE
           AND j.status NOT IN ('cancelled', 'completed', 'invoiced')
           AND ($1::text IS NULL OR ja.employee_id = $1)
         GROUP BY j.id, c.first_name, c.last_name, c.company_name, p.address, p.access_notes, p.gate_code, p.has_pets, cp.phone
         ORDER BY j.scheduled_start_time NULLS LAST, j.created_at`,
        [employeeId]
      );

      res.json(rows);
    } catch (err) {
      console.error("[my-day]", err);
      res.status(500).json({ message: "Error fetching today's jobs" });
    }
  });

  // ── GET /api/my-day/time-entries — today's time log for the logged-in user ───
  app.get("/api/my-day/time-entries", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      const { rows } = await pool.query(
        `SELECT te.*, j.title AS job_title
         FROM time_entries te
         LEFT JOIN jobs j ON te.job_id = j.id
         WHERE te.user_id = $1
           AND te.clock_in::date = CURRENT_DATE
         ORDER BY te.clock_in DESC`,
        [userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("[my-day/time-entries]", err);
      res.status(500).json({ message: "Error fetching time entries" });
    }
  });
}
