import { pool } from "./db";
import type { Express } from "express";
import { requireRole } from "./auth";

export function registerCloseoutRoutes(app: Express, requireAuth: any) {

  // ── Get or create closeout for a job ─────────────────────────────────────
  app.get("/api/jobs/:jobId/closeout", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT jc.*,
                ma.first_name || ' ' || ma.last_name AS manager_approved_by_name,
                sa.first_name || ' ' || sa.last_name AS submitted_by_name
         FROM job_closeouts jc
         LEFT JOIN users ma ON ma.id = jc.manager_approved_by
         LEFT JOIN users sa ON sa.id = jc.submitted_by
         WHERE jc.job_id = $1`,
        [req.params.jobId]
      );
      if (!rows.length) {
        return res.json(null);
      }
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Create closeout ──────────────────────────────────────────────────────
  app.post("/api/jobs/:jobId/closeout", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const jobId = req.params.jobId;
    const {
      final_scope_notes, materials_notes, remaining_issues,
      warranty_terms, warranty_duration_months = 12,
      customer_notes, internal_notes, customer_satisfaction,
    } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO job_closeouts
           (job_id, status, final_scope_notes, materials_notes, remaining_issues,
            warranty_terms, warranty_duration_months, customer_notes, internal_notes,
            customer_satisfaction, submitted_by, submitted_at)
         VALUES ($1,'draft',$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (job_id) DO UPDATE SET
           status = EXCLUDED.status,
           final_scope_notes = COALESCE(EXCLUDED.final_scope_notes, job_closeouts.final_scope_notes),
           materials_notes = COALESCE(EXCLUDED.materials_notes, job_closeouts.materials_notes),
           remaining_issues = COALESCE(EXCLUDED.remaining_issues, job_closeouts.remaining_issues),
           warranty_terms = COALESCE(EXCLUDED.warranty_terms, job_closeouts.warranty_terms),
           warranty_duration_months = EXCLUDED.warranty_duration_months,
           customer_notes = COALESCE(EXCLUDED.customer_notes, job_closeouts.customer_notes),
           internal_notes = COALESCE(EXCLUDED.internal_notes, job_closeouts.internal_notes),
           customer_satisfaction = COALESCE(EXCLUDED.customer_satisfaction, job_closeouts.customer_satisfaction),
           updated_at = NOW()
         RETURNING *`,
        [jobId, final_scope_notes || null, materials_notes || null, remaining_issues || null,
         warranty_terms || null, warranty_duration_months, customer_notes || null,
         internal_notes || null, customer_satisfaction || null, req.user.id]
      );
      return res.status(201).json(rows[0]);
    } catch (err: any) {
      console.error("[closeout] create error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Update closeout ──────────────────────────────────────────────────────
  app.patch("/api/jobs/:jobId/closeout", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const updates: Record<string, any> = {};
    const allowed = [
      "final_scope_confirmed", "final_scope_notes", "materials_used_confirmed",
      "materials_notes", "remaining_issues", "warranty_terms", "warranty_duration_months",
      "customer_notes", "internal_notes", "customer_satisfaction",
      "ready_for_invoice", "review_requested", "status",
    ];
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: "No fields to update" });

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = Object.values(updates);
    try {
      const { rows } = await pool.query(
        `UPDATE job_closeouts SET ${setClauses}, updated_at = NOW() WHERE job_id = $1 RETURNING *`,
        [req.params.jobId, ...values]
      );
      if (!rows.length) return res.status(404).json({ message: "Closeout not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Submit for manager approval ──────────────────────────────────────────
  app.post("/api/jobs/:jobId/closeout/submit", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE job_closeouts SET status = 'pending_approval', submitted_by = $1, submitted_at = NOW(), updated_at = NOW()
         WHERE job_id = $2 RETURNING *`,
        [req.user.id, req.params.jobId]
      );
      if (!rows.length) return res.status(404).json({ message: "Closeout not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Manager approve closeout ─────────────────────────────────────────────
  app.post("/api/jobs/:jobId/closeout/approve", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE job_closeouts
         SET status = 'approved', manager_approved_by = $1, manager_approved_at = NOW(),
             approved_at = NOW(), ready_for_invoice = true, updated_at = NOW()
         WHERE job_id = $2
         RETURNING *`,
        [req.user.id, req.params.jobId]
      );
      if (!rows.length) return res.status(404).json({ message: "Closeout not found" });

      // Auto-update job status to completed if not already
      await pool.query(
        `UPDATE jobs SET status = 'completed', completion_date = NOW(), updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('completed', 'invoiced')`,
        [req.params.jobId]
      );

      // Auto-create warranty if duration > 0
      const closeout = rows[0];
      if (closeout.warranty_duration_months > 0) {
        const { rows: jobRows } = await pool.query(
          `SELECT customer_id, property_id, title FROM jobs WHERE id = $1`,
          [req.params.jobId]
        );
        if (jobRows.length) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + closeout.warranty_duration_months);

          await pool.query(
            `INSERT INTO job_warranties
               (job_id, customer_id, property_id, closeout_id, title, description,
                duration_months, start_date, end_date, status, terms, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11)
             ON CONFLICT DO NOTHING`,
            [req.params.jobId, jobRows[0].customer_id || null, jobRows[0].property_id || null,
             closeout.id,
             `Warranty — ${jobRows[0].title || req.params.jobId}`,
             closeout.warranty_terms || `Standard ${closeout.warranty_duration_months}-month workmanship warranty`,
             closeout.warranty_duration_months,
             startDate.toISOString().slice(0, 10),
             endDate.toISOString().slice(0, 10),
             closeout.warranty_terms || null,
             req.user.id]
          );
        }
      }

      return res.json(rows[0]);
    } catch (err: any) {
      console.error("[closeout] approve error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
