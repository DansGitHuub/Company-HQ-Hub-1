import { Express } from "express";
import { pool } from "./db";
import { sendEmail } from "./emailService";

export function registerJobCrewRoutes(app: Express, requireAuth: any) {

  // ── GET crew for a job ────────────────────────────────────────────────────────
  app.get("/api/jobs/:id/crew", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          ja.id,
          ja.job_id,
          ja.employee_id,
          ja.scheduled_date,
          ja.sort_order,
          ja.created_at,
          e.first_name,
          e.last_name,
          e.job_title,
          e.profile_photo,
          e.personal_email,
          u.email AS work_email,
          CASE WHEN j.crew_lead_id = e.id THEN true ELSE false END AS is_lead
        FROM job_assignments ja
        JOIN employees e ON e.id = ja.employee_id
        JOIN jobs j ON j.id = ja.job_id
        LEFT JOIN users u ON u.id = e.user_id
        WHERE ja.job_id = $1
        ORDER BY ja.sort_order, ja.created_at
      `, [req.params.id]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST assign crew member ───────────────────────────────────────────────────
  app.post("/api/jobs/:id/crew", requireAuth, async (req: any, res) => {
    const { employee_id, scheduled_date, set_as_lead } = req.body;
    if (!employee_id) return res.status(400).json({ message: "employee_id is required" });
    try {
      // Prevent duplicates
      const existing = await pool.query(
        `SELECT id FROM job_assignments WHERE job_id = $1 AND employee_id = $2`,
        [req.params.id, employee_id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: "This crew member is already assigned to this job" });
      }

      const inserted = await pool.query(`
        INSERT INTO job_assignments (id, job_id, employee_id, scheduled_date, sort_order, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, (
          SELECT COALESCE(MAX(sort_order), 0) + 1 FROM job_assignments WHERE job_id = $1
        ), NOW())
        RETURNING *
      `, [req.params.id, employee_id, scheduled_date || null]);

      // Optionally set as crew lead
      if (set_as_lead) {
        await pool.query(`UPDATE jobs SET crew_lead_id = $1 WHERE id = $2`, [employee_id, req.params.id]);
      }

      // Fetch job + employee info for email
      const jobRes = await pool.query(`
        SELECT j.title, j.scheduled_date, j.address, j.city, j.state
        FROM jobs j WHERE j.id = $1
      `, [req.params.id]);
      const empRes = await pool.query(`
        SELECT e.first_name, e.last_name, u.email AS work_email, e.personal_email
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE e.id = $1
      `, [employee_id]);

      const job = jobRes.rows[0];
      const emp = empRes.rows[0];
      const recipientEmail = emp?.work_email || emp?.personal_email;

      if (job && emp && recipientEmail) {
        const jobDate = job.scheduled_date
          ? new Date(job.scheduled_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
          : "TBD";
        const address = [job.address, job.city, job.state].filter(Boolean).join(", ");
        await sendEmail({
          to: recipientEmail,
          subject: `You've been assigned to a job: ${job.title}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#2d5a27">Job Assignment</h2>
              <p>Hi ${emp.first_name},</p>
              <p>You've been assigned to the following job:</p>
              <table style="border-collapse:collapse;width:100%;margin:16px 0">
                <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd">Job</td><td style="padding:6px 12px;border:1px solid #ddd">${job.title}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd">Date</td><td style="padding:6px 12px;border:1px solid #ddd">${jobDate}</td></tr>
                ${address ? `<tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd">Location</td><td style="padding:6px 12px;border:1px solid #ddd">${address}</td></tr>` : ""}
                ${set_as_lead ? `<tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd">Role</td><td style="padding:6px 12px;border:1px solid #ddd">Crew Lead</td></tr>` : ""}
              </table>
              <p>Log in to CompanyHQ to view full job details.</p>
              <p style="color:#666;font-size:0.85em;margin-top:24px">Chapin Landscapes · CompanyHQ</p>
            </div>
          `,
        }).catch(() => {}); // don't fail the request if email fails
      }

      return res.status(201).json(inserted.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH set / unset crew lead ───────────────────────────────────────────────
  app.patch("/api/jobs/:id/crew/lead", requireAuth, async (req, res) => {
    const { employee_id } = req.body;
    try {
      // null clears it
      await pool.query(
        `UPDATE jobs SET crew_lead_id = $1 WHERE id = $2`,
        [employee_id || null, req.params.id]
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE remove crew member ─────────────────────────────────────────────────
  app.delete("/api/jobs/:id/crew/:assignmentId", requireAuth, async (req, res) => {
    try {
      // If removing the crew lead, also clear crew_lead_id
      const row = await pool.query(
        `SELECT employee_id FROM job_assignments WHERE id = $1 AND job_id = $2`,
        [req.params.assignmentId, req.params.id]
      );
      if (row.rows.length) {
        await pool.query(
          `UPDATE jobs SET crew_lead_id = NULL WHERE id = $1 AND crew_lead_id = $2`,
          [req.params.id, row.rows[0].employee_id]
        );
      }
      await pool.query(`DELETE FROM job_assignments WHERE id = $1 AND job_id = $2`, [
        req.params.assignmentId, req.params.id,
      ]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET all employees (for picker) ───────────────────────────────────────────
  app.get("/api/employees-list", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT e.id, e.first_name, e.last_name, e.job_title, e.status, e.profile_photo
        FROM employees e
        WHERE e.status = 'active'
        ORDER BY e.first_name, e.last_name
      `);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
