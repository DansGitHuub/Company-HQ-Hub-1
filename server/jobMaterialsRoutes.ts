import { Express } from "express";
import { pool } from "./db";

export function registerJobMaterialsRoutes(app: Express, requireAuth: any) {

  // ── GET all materials for a job ──────────────────────────────────────────────
  app.get("/api/jobs/:id/materials", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          jm.id, jm.job_id, jm.catalog_item_id,
          jm.item_name, jm.item_number, jm.units,
          jm.quantity, jm.unit_cost, jm.notes, jm.created_at,
          ci.category, ci.class
        FROM job_materials jm
        LEFT JOIN catalog_items ci ON ci.id = jm.catalog_item_id
        WHERE jm.job_id = $1
        ORDER BY jm.created_at
      `, [req.params.id]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST add a material ───────────────────────────────────────────────────────
  app.post("/api/jobs/:id/materials", requireAuth, async (req: any, res) => {
    const { catalog_item_id, item_name, item_number, units, quantity, unit_cost, notes } = req.body;
    if (!item_name) return res.status(400).json({ message: "item_name is required" });
    try {
      const result = await pool.query(`
        INSERT INTO job_materials
          (job_id, catalog_item_id, item_name, item_number, units, quantity, unit_cost, notes, created_by_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `, [
        req.params.id,
        catalog_item_id || null,
        item_name,
        item_number || null,
        units || null,
        quantity ?? 1,
        unit_cost || null,
        notes || null,
        req.user?.id ?? null,
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH update a material line ─────────────────────────────────────────────
  app.patch("/api/jobs/:id/materials/:matId", requireAuth, async (req, res) => {
    const { quantity, unit_cost, notes, item_name, units } = req.body;
    try {
      const result = await pool.query(`
        UPDATE job_materials
        SET
          quantity  = COALESCE($1, quantity),
          unit_cost = COALESCE($2, unit_cost),
          notes     = COALESCE($3, notes),
          item_name = COALESCE($4, item_name),
          units     = COALESCE($5, units)
        WHERE id = $6 AND job_id = $7
        RETURNING *
      `, [quantity, unit_cost, notes, item_name, units, req.params.matId, req.params.id]);
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE a material line ────────────────────────────────────────────────────
  app.delete("/api/jobs/:id/materials/:matId", requireAuth, async (req, res) => {
    try {
      await pool.query(`DELETE FROM job_materials WHERE id=$1 AND job_id=$2`, [
        req.params.matId, req.params.id,
      ]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET catalog items (active only, for picker) ───────────────────────────────
  app.get("/api/catalog-items-list", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, item_number, name, class, category, units, cost, description
        FROM catalog_items
        WHERE is_active = true
        ORDER BY class, category, name
      `);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
