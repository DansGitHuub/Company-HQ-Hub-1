import { pool } from "./db";
import type { Express } from "express";

const STAFF_ROLES = ["Admin", "Manager", "Master Admin"];

export function registerCheckpointRoutes(app: Express, requireAuth: any) {

  // ── Checkpoint templates ─────────────────────────────────────────────────
  app.get("/api/checkpoint-templates", requireAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM checkpoint_templates WHERE active = true ORDER BY sort_order, name`
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── List checkpoints for a job ───────────────────────────────────────────
  app.get("/api/jobs/:jobId/checkpoints", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT jc.*,
                u.first_name || ' ' || u.last_name AS completed_by_name
         FROM job_checkpoints jc
         LEFT JOIN users u ON u.id = jc.completed_by
         WHERE jc.job_id = $1
         ORDER BY jc.sort_order, jc.created_at`,
        [req.params.jobId]
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Add checkpoints to a job (from templates or custom) ─────────────────
  app.post("/api/jobs/:jobId/checkpoints", requireAuth, async (req: any, res) => {
    const { template_ids, custom } = req.body;
    const jobId = req.params.jobId;
    const created: any[] = [];
    try {
      // From templates
      if (template_ids?.length) {
        const { rows: templates } = await pool.query(
          `SELECT * FROM checkpoint_templates WHERE id = ANY($1::uuid[]) ORDER BY sort_order`,
          [template_ids]
        );
        const { rows: existing } = await pool.query(
          `SELECT sort_order FROM job_checkpoints WHERE job_id = $1 ORDER BY sort_order DESC LIMIT 1`,
          [jobId]
        );
        let nextOrder = existing[0]?.sort_order != null ? existing[0].sort_order + 1 : 0;

        for (const t of templates) {
          const { rows } = await pool.query(
            `INSERT INTO job_checkpoints
               (job_id, template_id, name, description, checkpoint_type, requires_photo,
                requires_note, requires_checkbox, assigned_role, job_stage, customer_visible, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [jobId, t.id, t.name, t.description, t.checkpoint_type, t.requires_photo,
             t.requires_note, t.requires_checkbox, t.assigned_role, t.job_stage,
             t.customer_visible, nextOrder++]
          );
          created.push(rows[0]);
        }
      }

      // Custom checkpoint
      if (custom) {
        const { rows: existing } = await pool.query(
          `SELECT sort_order FROM job_checkpoints WHERE job_id = $1 ORDER BY sort_order DESC LIMIT 1`,
          [jobId]
        );
        const nextOrder = existing[0]?.sort_order != null ? existing[0].sort_order + 1 : 0;
        const { rows } = await pool.query(
          `INSERT INTO job_checkpoints
             (job_id, name, description, checkpoint_type, requires_photo, requires_note,
              requires_checkbox, assigned_role, customer_visible, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [jobId, custom.name, custom.description || null, custom.checkpoint_type || "checkbox",
           custom.requires_photo || false, custom.requires_note || false,
           custom.requires_checkbox || false, custom.assigned_role || "Crew",
           custom.customer_visible || false, nextOrder]
        );
        created.push(rows[0]);
      }

      return res.status(201).json(created);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Complete a checkpoint ────────────────────────────────────────────────
  app.patch("/api/jobs/:jobId/checkpoints/:checkpointId", requireAuth, async (req: any, res) => {
    const { note, photo_url, checked, status } = req.body;
    const user = req.user;
    const isStaff = STAFF_ROLES.includes(user?.role);
    try {
      // Fetch first so we can enforce role-based access on assigned_role
      const { rows: existing } = await pool.query(
        `SELECT assigned_role FROM job_checkpoints WHERE id = $1 AND job_id = $2`,
        [req.params.checkpointId, req.params.jobId]
      );
      if (!existing.length) return res.status(404).json({ message: "Checkpoint not found" });

      // Manager-assigned (or any non-Crew) checkpoints require Admin/Manager/Master Admin
      if (existing[0].assigned_role !== "Crew" && !isStaff) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const newStatus = status ?? (checked !== undefined ? (checked ? "completed" : "pending") : undefined);
      const { rows } = await pool.query(
        `UPDATE job_checkpoints SET
           note = COALESCE($1, note),
           photo_url = COALESCE($2, photo_url),
           checked = COALESCE($3, checked),
           status = COALESCE($4, status),
           completed_by = CASE WHEN $4 = 'completed' THEN $5 ELSE completed_by END,
           completed_at = CASE WHEN $4 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
         WHERE id = $6 AND job_id = $7
         RETURNING *`,
        [note ?? null, photo_url ?? null, checked ?? null, newStatus ?? null,
         user?.id ?? null, req.params.checkpointId, req.params.jobId]
      );
      if (!rows.length) return res.status(404).json({ message: "Checkpoint not found" });

      // Notify linked customer when a customer-visible checkpoint is marked completed
      if (rows[0].status === "completed" && rows[0].customer_visible) {
        try {
          const { rows: custLinks } = await pool.query(
            `SELECT customer_id FROM customer_jobs WHERE job_id = $1`,
            [req.params.jobId]
          );
          for (const link of custLinks) {
            await pool.query(
              `INSERT INTO customer_notifications (customer_id, type, title, message, link)
               VALUES ($1, 'checkpoint_completed', $2, $3, $4)`,
              [
                link.customer_id,
                `Milestone completed: ${rows[0].name}`,
                `A milestone on your project has been marked complete: "${rows[0].name}".`,
                `/customer/jobs/${req.params.jobId}`,
              ]
            );
          }
        } catch (notifyErr: any) {
          console.error("[checkpoints] customer notify failed:", notifyErr.message);
        }
      }

      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Delete a checkpoint ──────────────────────────────────────────────────
  app.delete("/api/jobs/:jobId/checkpoints/:checkpointId", requireAuth, async (req: any, res) => {
    if (!STAFF_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    try {
      await pool.query(
        `DELETE FROM job_checkpoints WHERE id = $1 AND job_id = $2`,
        [req.params.checkpointId, req.params.jobId]
      );
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
