import type { Express } from "express";
import { pool } from "./db";
import { v4 as uuidv4 } from "uuid";
import { notifyStaff } from "./notificationService";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

export function registerMyDayRoutes(app: Express) {
  // ── GET /api/my-day — today's scheduled jobs for the logged-in user ──────────
  app.get("/api/my-day", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
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
           j.safety_notes,
           j.estimated_hours,
           j.crew_lead_id,
           EXISTS(
             SELECT 1 FROM employees emp
             WHERE emp.id = j.crew_lead_id AND emp.user_id = $2
           ) AS is_crew_lead,
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
           AND j.status NOT IN ('cancelled', 'invoiced')
           AND ($1::text IS NULL OR ja.employee_id = $1)
         GROUP BY j.id, c.first_name, c.last_name, c.company_name, p.address, p.access_notes, p.gate_code, p.has_pets, cp.phone
         ORDER BY j.scheduled_start_time NULLS LAST, j.created_at`,
        [employeeId, userId]
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

  // ── GET /api/my-day/jobs/:id/expected-items — equipment & materials ──────────
  app.get("/api/my-day/jobs/:id/expected-items", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT
           jli.id,
           COALESCE(ci.name, jli.item_name) AS name,
           jli.quantity::text                AS quantity,
           jli.unit,
           jwa.name                          AS work_area_name,
           CASE
             WHEN ci.class = 'Equipment' OR lower(jli.item_type) = 'equipment' THEN 'equipment'
             WHEN ci.class = 'Materials' OR lower(jli.item_type) IN ('material','materials') THEN 'material'
             ELSE NULL
           END AS item_class
         FROM job_line_items jli
         LEFT JOIN catalog_items    ci  ON ci.id  = jli.catalog_item_id
         LEFT JOIN job_work_areas   jwa ON jwa.id = jli.job_work_area_id
         WHERE jli.job_id      = $1
           AND jli.is_optional = false
           AND (
             ci.class IN ('Equipment','Materials')
             OR lower(jli.item_type) IN ('equipment','material','materials')
           )
         ORDER BY jli.sort_order, jli.item_name`,
        [id]
      );

      if (rows.length > 0) {
        return res.json({
          equipment: rows.filter((r: any) => r.item_class === "equipment"),
          materials: rows.filter((r: any) => r.item_class === "material"),
          source: "job_line_items",
        });
      }

      const { rows: estRows } = await pool.query(
        `SELECT
           eli.id,
           COALESCE(ci.name, eli.description) AS name,
           eli.quantity::text                  AS quantity,
           eli.unit,
           ewa.name                            AS work_area_name,
           CASE
             WHEN ci.class = 'Equipment' THEN 'equipment'
             WHEN ci.class = 'Materials' THEN 'material'
             ELSE NULL
           END AS item_class
         FROM jobs j
         JOIN sales_estimates    se  ON se.id  = j.source_estimate_id::uuid
         JOIN estimate_work_areas ewa ON ewa.estimate_id = se.id
         JOIN estimate_line_items eli ON eli.estimate_work_area_id = ewa.id
         LEFT JOIN catalog_items ci  ON ci.id  = eli.catalog_item_id
         WHERE j.id             = $1
           AND eli.is_optional  = false
           AND ci.class IN ('Equipment','Materials')
         ORDER BY eli.sort_order, eli.description`,
        [id]
      );

      return res.json({
        equipment: estRows.filter((r: any) => r.item_class === "equipment"),
        materials: estRows.filter((r: any) => r.item_class === "material"),
        source: "estimate",
      });
    } catch (err) {
      console.error("[my-day/expected-items]", err);
      return res.json({ equipment: [], materials: [], source: "none" });
    }
  });

  // ── GET /api/my-day/jobs/:id/crew-members — crew for bulk clock-in ───────────
  app.get("/api/my-day/jobs/:id/crew-members", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { id: jobId } = req.params;
    try {
      // Verify caller is the crew lead for this job
      const leadCheck = await pool.query(
        `SELECT 1 FROM jobs j
         JOIN employees e ON e.id = j.crew_lead_id AND e.user_id = $1
         WHERE j.id = $2 LIMIT 1`,
        [userId, jobId]
      );
      if (leadCheck.rows.length === 0) {
        return res.status(403).json({ message: "Only the crew lead can view crew clock-in status." });
      }

      const { rows } = await pool.query(
        `SELECT
           e.id AS employee_id,
           e.user_id,
           u.name,
           te.id IS NOT NULL AS already_clocked_in,
           te.id AS active_entry_id,
           te.work_area_name AS active_work_area
         FROM job_assignments ja
         JOIN employees e ON e.id = ja.employee_id
         JOIN users u ON u.id = e.user_id
         LEFT JOIN time_entries te
           ON te.user_id = e.user_id
           AND te.clock_out IS NULL
           AND te.clock_in::date = CURRENT_DATE
         WHERE ja.job_id = $1
         ORDER BY u.name`,
        [jobId]
      );
      return res.json(rows);
    } catch (err) {
      console.error("[my-day/crew-members]", err);
      return res.status(500).json({ message: "Error fetching crew members" });
    }
  });

  // ── POST /api/my-day/bulk-clock-in — crew lead clocks in selected crew ───────
  app.post("/api/my-day/bulk-clock-in", requireAuth, async (req, res) => {
    const leadUserId = (req.user as any).id;
    const { job_id, employee_ids } = req.body;

    if (!job_id || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      return res.status(400).json({ message: "job_id and employee_ids[] are required" });
    }

    try {
      // Verify caller is the crew lead
      const leadCheck = await pool.query(
        `SELECT j.title, j.client FROM jobs j
         JOIN employees e ON e.id = j.crew_lead_id AND e.user_id = $1
         WHERE j.id = $2 LIMIT 1`,
        [leadUserId, job_id]
      );
      if (leadCheck.rows.length === 0) {
        return res.status(403).json({ message: "Only the crew lead can bulk clock in the crew." });
      }
      const jobTitle = leadCheck.rows[0].title || leadCheck.rows[0].client || "the job";

      // Fetch user_ids for the selected employee_ids
      const empResult = await pool.query(
        `SELECT e.id AS employee_id, e.user_id, u.name
         FROM employees e
         JOIN users u ON u.id = e.user_id
         WHERE e.id = ANY($1::text[])`,
        [employee_ids]
      );

      const clockedIn: string[] = [];
      const skipped: string[] = [];

      for (const emp of empResult.rows) {
        // Check if already clocked in
        const existing = await pool.query(
          `SELECT id FROM time_entries WHERE user_id = $1 AND clock_out IS NULL AND clock_in::date = CURRENT_DATE LIMIT 1`,
          [emp.user_id]
        );
        if (existing.rows.length > 0) {
          skipped.push(emp.name);
          continue;
        }

        // Clock them in
        await pool.query(
          `INSERT INTO time_entries (id, user_id, job_id, entry_type, clock_in, clocked_in_by_user_id)
           VALUES ($1, $2, $3, 'billable', NOW(), $4)`,
          [uuidv4(), emp.user_id, job_id, leadUserId]
        );

        // Notify the employee
        notifyStaff({
          userId: emp.user_id,
          type: "bulk_clock_in",
          title: "Clocked in by crew lead",
          message: `Your crew lead clocked you in for ${jobTitle}.`,
          channels: ["inApp"],
        }).catch(() => {});

        clockedIn.push(emp.name);
      }

      // Notify crew lead with summary
      if (clockedIn.length > 0) {
        notifyStaff({
          userId: leadUserId,
          type: "bulk_clock_in_summary",
          title: "Crew clocked in",
          message: `Clocked in ${clockedIn.length} crew member${clockedIn.length !== 1 ? "s" : ""} for ${jobTitle}${skipped.length > 0 ? `. ${skipped.length} already clocked in.` : "."}`,
          channels: ["inApp"],
        }).catch(() => {});
      }

      return res.json({ clocked_in: clockedIn, skipped });
    } catch (err: any) {
      console.error("[my-day/bulk-clock-in]", err);
      return res.status(500).json({ message: err.message });
    }
  });
}
