import { pool } from "./db";
import type { Express } from "express";
import { logChange } from "./auditLog";

export function registerJobEquipmentRoutes(app: Express, requireAuth: any) {

  // ── List equipment assigned to a job ─────────────────────────────────────
  app.get("/api/jobs/:jobId/equipment", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT jea.*,
                e.name AS equipment_name, e.type AS equipment_type,
                e.make, e.model, e.year, e.asset_id, e.status AS equipment_status,
                u.first_name || ' ' || u.last_name AS created_by_name
         FROM job_equipment_assignments jea
         LEFT JOIN equipment e ON e.id = jea.equipment_id
         LEFT JOIN users u ON u.id = jea.created_by
         WHERE jea.job_id = $1
         ORDER BY jea.assigned_date DESC, jea.created_at DESC`,
        [req.params.jobId]
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Get all equipment (for picker dropdown) ───────────────────────────────
  app.get("/api/equipment-list", requireAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, type, make, model, year, asset_id, status
         FROM equipment
         WHERE status = 'Active'
         ORDER BY name`
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Assign equipment to a job ─────────────────────────────────────────────
  app.post("/api/jobs/:jobId/equipment", requireAuth, async (req: any, res) => {
    const {
      equipment_id, assigned_date, hours_used = 0,
      operator_user_id, operator_name, notes,
    } = req.body;
    if (!equipment_id) return res.status(400).json({ message: "equipment_id required" });
    try {
      const { rows: jobRows } = await pool.query(
        `SELECT title FROM jobs WHERE id = $1`, [req.params.jobId]
      );
      if (!jobRows.length) return res.status(404).json({ message: "Job not found" });

      const { rows: eqRows } = await pool.query(
        `SELECT name FROM equipment WHERE id = $1`, [equipment_id]
      );

      const { rows } = await pool.query(
        `INSERT INTO job_equipment_assignments
           (job_id, equipment_id, assigned_date, hours_used, operator_user_id, operator_name, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [req.params.jobId, equipment_id,
         assigned_date || new Date().toISOString().slice(0, 10),
         hours_used, operator_user_id || null, operator_name || null,
         notes || null, req.user?.id ?? null]
      );

      await logChange({
        entityType: "job",
        entityId: req.params.jobId,
        entityLabel: jobRows[0].title,
        fieldChanged: "equipment",
        newValue: eqRows[0]?.name ?? equipment_id,
        action: "update",
        changedById: req.user?.id,
        changedByName: req.user ? `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() : null,
        notes: `Equipment assigned: ${eqRows[0]?.name ?? equipment_id}${hours_used ? `, ${hours_used} hrs` : ""}`,
      });

      return res.status(201).json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Update an assignment (hours, notes, date) ────────────────────────────
  app.patch("/api/jobs/:jobId/equipment/:id", requireAuth, async (req: any, res) => {
    const { hours_used, assigned_date, operator_name, notes } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE job_equipment_assignments SET
           hours_used = COALESCE($1, hours_used),
           assigned_date = COALESCE($2, assigned_date),
           operator_name = COALESCE($3, operator_name),
           notes = COALESCE($4, notes),
           updated_at = NOW()
         WHERE id = $5 AND job_id = $6
         RETURNING *`,
        [hours_used ?? null, assigned_date ?? null, operator_name ?? null,
         notes ?? null, req.params.id, req.params.jobId]
      );
      if (!rows.length) return res.status(404).json({ message: "Assignment not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Remove equipment from a job ───────────────────────────────────────────
  app.delete("/api/jobs/:jobId/equipment/:id", requireAuth, async (req: any, res) => {
    try {
      await pool.query(
        `DELETE FROM job_equipment_assignments WHERE id = $1 AND job_id = $2`,
        [req.params.id, req.params.jobId]
      );
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Equipment utilization summary (admin) ─────────────────────────────────
  app.get("/api/admin/equipment-utilization", requireAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           e.id, e.name, e.type, e.make, e.model, e.year,
           COUNT(jea.id) AS job_count,
           SUM(jea.hours_used) AS total_hours,
           MAX(jea.assigned_date) AS last_used_date
         FROM equipment e
         LEFT JOIN job_equipment_assignments jea ON jea.equipment_id = e.id
         WHERE e.status = 'Active'
         GROUP BY e.id, e.name, e.type, e.make, e.model, e.year
         ORDER BY total_hours DESC NULLS LAST`
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
