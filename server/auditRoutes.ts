import { pool } from "./db";
import type { Express } from "express";

export function registerAuditRoutes(app: Express, requireAuth: any) {

  // ── Get history for a specific entity ────────────────────────────────────
  app.get("/api/history/:entityType/:entityId", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM record_history
         WHERE entity_type = $1 AND entity_id = $2
         ORDER BY changed_at DESC
         LIMIT 100`,
        [req.params.entityType, req.params.entityId]
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Global audit log (admin only) ────────────────────────────────────────
  app.get("/api/admin/audit-log", requireAuth, async (req: any, res) => {
    if (!["Admin", "Manager", "Master Admin"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Admin only" });
    }
    const {
      entity_type, changed_by_id, action,
      date_from, date_to, limit = 200, offset = 0,
    } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];

    if (entity_type) { params.push(entity_type); conditions.push(`entity_type = $${params.length}`); }
    if (changed_by_id) { params.push(changed_by_id); conditions.push(`changed_by_id = $${params.length}`); }
    if (action) { params.push(action); conditions.push(`action = $${params.length}`); }
    if (date_from) { params.push(date_from); conditions.push(`changed_at >= $${params.length}`); }
    if (date_to) { params.push(date_to); conditions.push(`changed_at <= $${params.length}::date + interval '1 day'`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Number(limit), Number(offset));
    try {
      const { rows } = await pool.query(
        `SELECT * FROM record_history ${where}
         ORDER BY changed_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) FROM record_history ${where}`,
        params.slice(0, -2)
      );
      return res.json({ items: rows, total: Number(countRows[0].count) });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Job profitability data ────────────────────────────────────────────────
  app.get("/api/reports/job-profitability", requireAuth, async (req: any, res) => {
    if (!["Admin", "Manager", "Master Admin"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Admin only" });
    }
    const { status, division, year } = req.query;
    const conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (status) { params.push(status); conditions.push(`j.status = $${params.length}`); }
    if (division) { params.push(division); conditions.push(`j.division = $${params.length}`); }
    if (year) {
      params.push(`${year}-01-01`, `${year}-12-31`);
      conditions.push(`j.created_at BETWEEN $${params.length - 1} AND $${params.length}::date + interval '1 day'`);
    }

    const where = conditions.join(" AND ");
    try {
      const { rows } = await pool.query(
        `SELECT
           j.id,
           j.title,
           j.client,
           j.status,
           j.division,
           j.created_at,
           j.completion_date,
           -- Sold value
           COALESCE(j.price::numeric, 0) AS sold_value,
           -- Source estimate value
           COALESCE(se.total::numeric, 0) AS estimate_value,
           -- Approved change orders total
           COALESCE((
             SELECT SUM(co.total)
             FROM job_change_orders co
             WHERE co.job_id = j.id AND co.status = 'approved'
           ), 0) AS approved_co_total,
           -- Actual labor hours from time entries
           COALESCE((
             SELECT SUM(
               EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
             )
             FROM time_entries te
             WHERE te.job_id = j.id AND te.clock_out IS NOT NULL
               AND te.entry_type NOT IN ('break', 'shop')
           ), 0) AS actual_hours,
           -- Labor cost: hours × avg employee pay rate
           COALESCE((
             SELECT SUM(
               EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
               * COALESCE(NULLIF(emp.pay_rate, '')::numeric, 0)
             )
             FROM time_entries te
             LEFT JOIN employees emp ON emp.user_id = te.user_id
             WHERE te.job_id = j.id AND te.clock_out IS NOT NULL
               AND te.entry_type NOT IN ('break', 'shop')
           ), 0) AS labor_cost,
           -- Material cost from worksheets
           COALESCE((
             SELECT SUM(wm.quantity * COALESCE(wm.unit_cost, 0))
             FROM worksheet_materials wm
             JOIN worksheets ws ON ws.id = wm.worksheet_id
             WHERE ws.job_id = j.id
           ), 0) AS material_cost
         FROM jobs j
         LEFT JOIN sales_estimates se ON se.id::text = j.source_estimate_id
         WHERE ${where}
         ORDER BY j.created_at DESC
         LIMIT 500`,
        params
      );

      // Add computed fields
      const enriched = rows.map(r => {
        const sold = Number(r.sold_value);
        const cogs = Number(r.labor_cost) + Number(r.material_cost);
        const gross_profit = sold - cogs;
        const margin_pct = sold > 0 ? (gross_profit / sold) * 100 : 0;
        const variance_from_estimate = sold - Number(r.estimate_value);
        return { ...r, cogs, gross_profit, margin_pct, variance_from_estimate };
      });

      return res.json(enriched);
    } catch (err: any) {
      console.error("[profitability] query error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
