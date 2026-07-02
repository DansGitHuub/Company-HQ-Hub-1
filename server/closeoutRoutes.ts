import { pool } from "./db";
import type { Express } from "express";
import { requireRole } from "./auth";

export function registerCloseoutRoutes(app: Express, requireAuth: any) {

  // ── Get closeout for a job ────────────────────────────────────────────────
  // Bug fix: users table has "name" (single column), not first_name/last_name
  app.get("/api/jobs/:jobId/closeout", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT jc.*,
                ma.name AS manager_approved_by_name,
                sa.name AS submitted_by_name
         FROM job_closeouts jc
         LEFT JOIN users ma ON ma.id = jc.manager_approved_by
         LEFT JOIN users sa ON sa.id = jc.submitted_by
         WHERE jc.job_id = $1`,
        [req.params.jobId]
      );
      if (!rows.length) return res.json(null);
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Create or upsert closeout ─────────────────────────────────────────────
  // Bug fix: final_scope_confirmed and materials_used_confirmed were missing
  // from the destructuring and INSERT, so toggles were never saved.
  app.post("/api/jobs/:jobId/closeout", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const jobId = req.params.jobId;
    const {
      final_scope_confirmed = false,
      final_scope_notes,
      materials_used_confirmed = false,
      materials_notes,
      remaining_issues,
      warranty_terms,
      warranty_duration_months = 12,
      customer_notes,
      internal_notes,
      customer_satisfaction,
    } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO job_closeouts
           (job_id, status,
            final_scope_confirmed, final_scope_notes,
            materials_used_confirmed, materials_notes,
            remaining_issues, warranty_terms, warranty_duration_months,
            customer_notes, internal_notes, customer_satisfaction,
            submitted_by, submitted_at)
         VALUES ($1,'draft',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (job_id) DO UPDATE SET
           final_scope_confirmed    = EXCLUDED.final_scope_confirmed,
           final_scope_notes        = COALESCE(EXCLUDED.final_scope_notes,        job_closeouts.final_scope_notes),
           materials_used_confirmed = EXCLUDED.materials_used_confirmed,
           materials_notes          = COALESCE(EXCLUDED.materials_notes,          job_closeouts.materials_notes),
           remaining_issues         = COALESCE(EXCLUDED.remaining_issues,         job_closeouts.remaining_issues),
           warranty_terms           = COALESCE(EXCLUDED.warranty_terms,           job_closeouts.warranty_terms),
           warranty_duration_months = EXCLUDED.warranty_duration_months,
           customer_notes           = COALESCE(EXCLUDED.customer_notes,           job_closeouts.customer_notes),
           internal_notes           = COALESCE(EXCLUDED.internal_notes,           job_closeouts.internal_notes),
           customer_satisfaction    = COALESCE(EXCLUDED.customer_satisfaction,    job_closeouts.customer_satisfaction),
           updated_at               = NOW()
         RETURNING *`,
        [jobId,
         final_scope_confirmed, final_scope_notes || null,
         materials_used_confirmed, materials_notes || null,
         remaining_issues || null, warranty_terms || null, warranty_duration_months,
         customer_notes || null, internal_notes || null,
         customer_satisfaction || null, req.user.id]
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
        `UPDATE job_closeouts
         SET status = 'pending_approval', submitted_by = $1, submitted_at = NOW(), updated_at = NOW()
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
  // Auto-fires: invoice draft, warranty, review follow-up task
  app.post("/api/jobs/:jobId/closeout/approve", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const jobId = req.params.jobId;
    try {
      // 1. Mark closeout approved
      const { rows } = await pool.query(
        `UPDATE job_closeouts
         SET status = 'approved', manager_approved_by = $1, manager_approved_at = NOW(),
             approved_at = NOW(), ready_for_invoice = true, updated_at = NOW()
         WHERE job_id = $2
         RETURNING *`,
        [req.user.id, jobId]
      );
      if (!rows.length) return res.status(404).json({ message: "Closeout not found" });
      const closeout = rows[0];

      // 2. Fetch job details (needed by warranty, invoice, task steps)
      const { rows: jobRows } = await pool.query(
        `SELECT customer_id, property_id, title, price FROM jobs WHERE id = $1`,
        [jobId]
      );
      const job = jobRows[0] ?? {};

      // 3. Mark job completed
      await pool.query(
        `UPDATE jobs SET status = 'completed', completion_date = NOW(), updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('completed', 'invoiced')`,
        [jobId]
      );

      // 4. Auto-create warranty (uses duration and terms from closeout form)
      if ((closeout.warranty_duration_months ?? 0) > 0) {
        try {
          const startDate = new Date().toISOString().slice(0, 10);
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + closeout.warranty_duration_months);
          // Use TEXT cast for closeout_id so node-postgres type binding is unambiguous.
          // No ON CONFLICT clause — job_warranties has no unique constraint on job_id,
          // so the old DO NOTHING was silently preventing the insert on some pg versions.
          await pool.query(
            `INSERT INTO job_warranties
               (job_id, customer_id, property_id, closeout_id, title, description,
                duration_months, start_date, end_date, status, terms, created_by)
             VALUES ($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,'active',$10,$11)`,
            [jobId, job.customer_id || null, job.property_id || null,
             String(closeout.id),
             `Warranty — ${job.title || jobId}`,
             closeout.warranty_terms || `Standard ${closeout.warranty_duration_months}-month workmanship warranty`,
             closeout.warranty_duration_months,
             startDate, endDate.toISOString().slice(0, 10),
             closeout.warranty_terms || null, req.user.id]
          );
        } catch (e: any) {
          console.error("[closeout] warranty create failed:", e.message);
        }
      }

      // 5. Auto-create invoice draft (once per job, sets invoice_created = true)
      if (!closeout.invoice_created) {
        try {
          const { rows: existingInv } = await pool.query(
            `SELECT id FROM invoices WHERE job_id = $1 LIMIT 1`, [jobId]
          );
          if (!existingInv.length) {
            const { rows: numRows } = await pool.query(
              `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1 AS next_num
               FROM invoices WHERE invoice_number ~ '^INV-[0-9]+$'`
            );
            const invoiceNumber = `INV-${String(numRows[0].next_num).padStart(4, "0")}`;
            const today = new Date().toISOString().slice(0, 10);
            const due30 = new Date(); due30.setDate(due30.getDate() + 30);
            const price = Number(job.price || 0);
            await pool.query(
              `INSERT INTO invoices
                 (id, invoice_number, customer_id, job_id, status,
                  issued_date, due_date, subtotal, total, balance_due,
                  created_at, updated_at)
               VALUES (gen_random_uuid(),$1,$2::uuid,$3,'draft',$4,$5,$6,$6,$6,NOW(),NOW())`,
              [invoiceNumber, job.customer_id || null, jobId, today,
               due30.toISOString().slice(0, 10), price]
            );
          }
          await pool.query(
            `UPDATE job_closeouts SET invoice_created = true WHERE job_id = $1`, [jobId]
          );
        } catch (e: any) {
          console.error("[closeout] invoice create:", e.message);
        }
      }

      // 6. Auto-create follow-up review task (once per job)
      if (!closeout.follow_up_task_id) {
        try {
          const { rows: taskRows } = await pool.query(
            `INSERT INTO tasks
               (id, title, description, type, priority, status,
                created_by_user_id, linked_record_type, linked_record_id,
                created_at, updated_at)
             VALUES (gen_random_uuid(),$1,$2,'follow_up','normal','open',$3,'job',$4,NOW(),NOW())
             RETURNING id`,
            [`Review follow-up — ${job.title || jobId}`,
             "Follow up with customer for a review after job completion.",
             req.user.id, jobId]
          );
          if (taskRows.length) {
            await pool.query(
              `UPDATE job_closeouts
               SET review_requested_at = NOW(), follow_up_task_id = $1
               WHERE job_id = $2`,
              [taskRows[0].id, jobId]
            );
          }
        } catch (e: any) {
          console.error("[closeout] review task create:", e.message);
        }
      }

      return res.json(rows[0]);
    } catch (err: any) {
      console.error("[closeout] approve error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
