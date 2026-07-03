import { Express } from "express";
import { pool } from "./db";
import { requireAuth, requireRole } from "./auth";

// Structured job line items (scope/materials) copied from a converted
// estimate — separate from the pre-existing ad-hoc job_materials feature.
// Read access: all authenticated roles (Crew sees read-only in the UI).
// Write access (add/edit/delete): Admin/Manager only, enforced server-side here.
export function registerJobLineItemsRoutes(app: Express) {

  // ── GET all line items for a job ────────────────────────────────────────────
  app.get("/api/jobs/:id/line-items", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          jli.id, jli.job_id, jli.job_work_area_id,
          jli.source_estimate_id, jli.source_estimate_line_item_id,
          jli.item_type, jli.catalog_item_id, jli.class_id,
          jli.item_name, jli.quantity, jli.unit, jli.unit_price, jli.line_total,
          jli.sort_order, jli.is_optional, jli.notes, jli.created_at, jli.updated_at,
          jwa.name AS work_area_name,
          ci.item_number AS catalog_item_number,
          cc.label AS class_label
        FROM job_line_items jli
        LEFT JOIN job_work_areas jwa ON jwa.id = jli.job_work_area_id
        LEFT JOIN catalog_items ci ON ci.id = jli.catalog_item_id
        LEFT JOIN class_codes cc ON cc.id = jli.class_id
        WHERE jli.job_id = $1
        ORDER BY jwa.sort_order NULLS LAST, jli.sort_order, jli.created_at
      `, [req.params.id]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST add a line item (Admin/Manager only) ───────────────────────────────
  app.post("/api/jobs/:id/line-items", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const {
      job_work_area_id, item_type, catalog_item_id, class_id,
      item_name, quantity, unit, unit_price, is_optional, notes,
    } = req.body;
    if (!item_name) return res.status(400).json({ message: "item_name is required" });
    const qty = quantity != null ? Number(quantity) : 1;
    const price = unit_price != null ? Number(unit_price) : 0;
    try {
      const result = await pool.query(`
        INSERT INTO job_line_items
          (job_id, job_work_area_id, item_type, catalog_item_id, class_id,
           item_name, quantity, unit, unit_price, line_total, is_optional, notes, created_by_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `, [
        req.params.id,
        job_work_area_id || null,
        item_type || 'service',
        catalog_item_id || null,
        class_id || null,
        item_name,
        qty,
        unit || null,
        price,
        qty * price,
        !!is_optional,
        notes || null,
        req.user?.id ?? null,
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH update a line item (Admin/Manager only) ───────────────────────────
  // Only ever writes to job_line_items — never touches estimate_line_items.
  app.patch("/api/jobs/:id/line-items/:itemId", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const { item_name, quantity, unit, unit_price, job_work_area_id, is_optional, notes } = req.body;
    try {
      const { rows: current } = await pool.query(
        `SELECT quantity, unit_price FROM job_line_items WHERE id=$1 AND job_id=$2`,
        [req.params.itemId, req.params.id]
      );
      if (!current.length) return res.status(404).json({ message: "Not found" });

      const newQty = quantity != null ? Number(quantity) : Number(current[0].quantity);
      const newPrice = unit_price != null ? Number(unit_price) : Number(current[0].unit_price);

      const result = await pool.query(`
        UPDATE job_line_items
        SET
          item_name        = COALESCE($1, item_name),
          quantity         = $2,
          unit             = COALESCE($3, unit),
          unit_price       = $4,
          line_total       = $5,
          job_work_area_id = COALESCE($6, job_work_area_id),
          is_optional      = COALESCE($7, is_optional),
          notes            = COALESCE($8, notes),
          updated_at       = NOW()
        WHERE id = $9 AND job_id = $10
        RETURNING *
      `, [
        item_name, newQty, unit, newPrice, newQty * newPrice,
        job_work_area_id, is_optional, notes,
        req.params.itemId, req.params.id,
      ]);
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE a line item (Admin/Manager only) ─────────────────────────────────
  app.delete("/api/jobs/:id/line-items/:itemId", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      await pool.query(`DELETE FROM job_line_items WHERE id=$1 AND job_id=$2`, [
        req.params.itemId, req.params.id,
      ]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
