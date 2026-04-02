import { Express } from "express";
import { pool } from "./db";

export function registerWorkAreaRoutes(app: Express, requireAuth: any, requireRole: any) {

  // ── GET /api/work-area-types ─────────────────────────────────────────────
  app.get("/api/work-area-types", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM work_area_types WHERE is_active = true ORDER BY division, sort_order, name`
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/work-area-types ────────────────────────────────────────────
  app.post("/api/work-area-types", requireAuth, requireRole(["Admin"]), async (req, res) => {
    const { name, division, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    try {
      const { rows } = await pool.query(
        `INSERT INTO work_area_types (name, division, sort_order) VALUES ($1, $2, $3) RETURNING *`,
        [name, division || null, sort_order]
      );
      return res.status(201).json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/work-area-types/:id ─────────────────────────────────────────
  app.put("/api/work-area-types/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    const { name, division, sort_order, is_active } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE work_area_types SET
           name       = COALESCE($1, name),
           division   = COALESCE($2, division),
           sort_order = COALESCE($3, sort_order),
           is_active  = COALESCE($4, is_active)
         WHERE id = $5 RETURNING *`,
        [name ?? null, division ?? null, sort_order ?? null, is_active ?? null, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/jobs/:id/work-areas ─────────────────────────────────────────
  app.get("/api/jobs/:id/work-areas", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT jwa.*,
                COALESCE(
                  (SELECT SUM(duration_minutes)::decimal / 60
                   FROM time_entries
                   WHERE job_work_area_id = jwa.id AND clock_out IS NOT NULL), 0
                ) AS actual_hours_computed
         FROM job_work_areas jwa
         WHERE jwa.job_id = $1
         ORDER BY jwa.sort_order, jwa.name`,
        [req.params.id]
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/jobs/:id/work-areas ────────────────────────────────────────
  app.post("/api/jobs/:id/work-areas", requireAuth, async (req, res) => {
    const { work_area_type_id, estimated_hours, name: customName } = req.body;
    if (!work_area_type_id && !customName) {
      return res.status(400).json({ message: "work_area_type_id or name is required" });
    }
    try {
      let areaName = customName;
      if (work_area_type_id && !areaName) {
        const { rows: typeRows } = await pool.query(
          `SELECT name FROM work_area_types WHERE id = $1`, [work_area_type_id]
        );
        if (typeRows.length === 0) return res.status(404).json({ message: "Work area type not found" });
        areaName = typeRows[0].name;
      }
      const { rows } = await pool.query(
        `INSERT INTO job_work_areas (job_id, work_area_type_id, name, estimated_hours)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.params.id, work_area_type_id || null, areaName, estimated_hours || null]
      );
      return res.status(201).json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/job-work-areas/:id ──────────────────────────────────────────
  app.put("/api/job-work-areas/:id", requireAuth, async (req, res) => {
    const { estimated_hours, status, notes } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE job_work_areas SET
           estimated_hours = COALESCE($1, estimated_hours),
           status          = COALESCE($2, status),
           notes           = COALESCE($3, notes)
         WHERE id = $4 RETURNING *`,
        [estimated_hours ?? null, status ?? null, notes ?? null, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/job-work-areas/:id ──────────────────────────────────────
  app.delete("/api/job-work-areas/:id", requireAuth, async (req, res) => {
    try {
      await pool.query(`DELETE FROM job_work_areas WHERE id = $1`, [req.params.id]);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
