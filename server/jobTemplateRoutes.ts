import { Express } from "express";
import { pool } from "./db";

export function registerJobTemplateRoutes(app: Express, requireAuth: any) {

  // ── GET all templates ─────────────────────────────────────────────────────────
  app.get("/api/job-templates", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM job_templates
        WHERE is_active = true
        ORDER BY name
      `);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET single template ───────────────────────────────────────────────────────
  app.get("/api/job-templates/:id", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM job_templates WHERE id=$1`, [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ message: "Template not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST create template ──────────────────────────────────────────────────────
  app.post("/api/job-templates", requireAuth, async (req: any, res) => {
    const { name, description, job_type, division, estimated_hours, estimated_days, scope_of_work, crew_notes, price, checklist } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "name is required" });
    try {
      const result = await pool.query(`
        INSERT INTO job_templates
          (name, description, job_type, division, estimated_hours, estimated_days, scope_of_work, crew_notes, price, checklist, created_by_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `, [
        name.trim(), description || null, job_type || null, division || null,
        estimated_hours || null, estimated_days || null,
        scope_of_work || null, crew_notes || null,
        price || null,
        JSON.stringify(checklist ?? []),
        req.user?.id ?? null,
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST save current job as template ────────────────────────────────────────
  app.post("/api/jobs/:id/save-as-template", requireAuth, async (req: any, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Template name is required" });
    try {
      const jobRes = await pool.query(`SELECT * FROM jobs WHERE id=$1`, [req.params.id]);
      if (!jobRes.rows.length) return res.status(404).json({ message: "Job not found" });
      const j = jobRes.rows[0];
      const result = await pool.query(`
        INSERT INTO job_templates
          (name, description, job_type, division, estimated_hours, estimated_days, scope_of_work, crew_notes, price, created_by_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
      `, [
        name.trim(),
        j.description || null,
        j.job_type || j.type || null,
        j.division || null,
        j.estimated_hours || null,
        j.estimated_days || null,
        j.scope_of_work || null,
        j.crew_notes || null,
        j.price || j.value || null,
        req.user?.id ?? null,
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT update template ───────────────────────────────────────────────────────
  app.put("/api/job-templates/:id", requireAuth, async (req, res) => {
    const { name, description, job_type, division, estimated_hours, estimated_days, scope_of_work, crew_notes, price, checklist } = req.body;
    try {
      const result = await pool.query(`
        UPDATE job_templates SET
          name             = COALESCE($1, name),
          description      = $2,
          job_type         = $3,
          division         = $4,
          estimated_hours  = $5,
          estimated_days   = $6,
          scope_of_work    = $7,
          crew_notes       = $8,
          price            = $9,
          checklist        = COALESCE($10::jsonb, checklist),
          updated_at       = NOW()
        WHERE id = $11
        RETURNING *
      `, [
        name?.trim() || null, description || null, job_type || null, division || null,
        estimated_hours || null, estimated_days || null,
        scope_of_work || null, crew_notes || null, price || null,
        checklist ? JSON.stringify(checklist) : null,
        req.params.id,
      ]);
      if (!result.rows.length) return res.status(404).json({ message: "Template not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE (soft) template ────────────────────────────────────────────────────
  app.delete("/api/job-templates/:id", requireAuth, async (req, res) => {
    try {
      await pool.query(`UPDATE job_templates SET is_active=false WHERE id=$1`, [req.params.id]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
