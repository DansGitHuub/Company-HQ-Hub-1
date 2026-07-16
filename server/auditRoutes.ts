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
               AND te.entry_type NOT IN ('break', 'shop_time', 'shop')
           ), 0) AS actual_hours,
           -- Labor cost: hours × employee pay rate (mirrors /api/jobs/:id/labor-cost)
           COALESCE((
             SELECT SUM(
               EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
               * COALESCE(NULLIF(emp.pay_rate, '')::numeric, 0)
             )
             FROM time_entries te
             LEFT JOIN employees emp ON emp.user_id = te.user_id
             WHERE te.job_id = j.id AND te.clock_out IS NOT NULL
               AND te.entry_type NOT IN ('break', 'shop_time', 'shop')
           ), 0) AS labor_cost,
           -- Time entries on this job with no employee pay rate on file (labor cost may be understated)
           COALESCE((
             SELECT COUNT(*)
             FROM time_entries te
             LEFT JOIN employees emp ON emp.user_id = te.user_id
             WHERE te.job_id = j.id AND te.clock_out IS NOT NULL
               AND te.entry_type NOT IN ('break', 'shop_time', 'shop')
               AND (emp.pay_rate IS NULL OR emp.pay_rate = '')
           ), 0) AS missing_rate_count,
           -- Material cost from job_materials (mirrors the Job Costing Summary card)
           COALESCE((
             SELECT SUM(jm.quantity * jm.unit_cost)
             FROM job_materials jm
             WHERE jm.job_id = j.id::text
               AND jm.quantity IS NOT NULL AND jm.unit_cost IS NOT NULL
           ), 0) AS material_cost,
           -- Equipment cost: hours_used × hourly_rate per assignment (S16-4)
           COALESCE((
             SELECT SUM(jea.hours_used * COALESCE(jea.hourly_rate, 0))
             FROM job_equipment_assignments jea
             WHERE jea.job_id = j.id::text
           ), 0) AS equipment_cost,
           -- Equipment hours tracked on this job (shown even if rate not set)
           COALESCE((
             SELECT SUM(jea.hours_used)
             FROM job_equipment_assignments jea
             WHERE jea.job_id = j.id::text
           ), 0) AS equipment_hours
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
        const equipment_cost = Number(r.equipment_cost || 0);
        const equipment_hours = Number(r.equipment_hours || 0);
        const cogs = Number(r.labor_cost) + Number(r.material_cost) + equipment_cost;
        const gross_profit = sold - cogs;
        const margin_pct = sold > 0 ? (gross_profit / sold) * 100 : 0;
        const variance_from_estimate = sold - Number(r.estimate_value);
        const missing_rate_count = Number(r.missing_rate_count || 0);
        return { ...r, equipment_cost, equipment_hours, cogs, gross_profit, margin_pct, variance_from_estimate, missing_rate_count };
      });

      return res.json(enriched);
    } catch (err: any) {
      console.error("[profitability] query error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Work Area Budget — per-work-area estimated vs actual hours (S16-9) ──────
  app.get("/api/reports/work-area-budget", requireAuth, async (req: any, res) => {
    if (!["Admin", "Manager", "Master Admin"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Admin only" });
    }
    const { division, year, only_over_budget } = req.query as Record<string, string>;
    const conditions: string[] = ["jwa.is_active = true"];
    const params: any[] = [];
    if (division) { params.push(division); conditions.push(`j.division = $${params.length}`); }
    if (year) {
      params.push(`${year}-01-01`, `${year}-12-31`);
      conditions.push(`j.created_at BETWEEN $${params.length - 1} AND $${params.length}::date + interval '1 day'`);
    }
    const where = conditions.join(" AND ");
    try {
      const { rows } = await pool.query(
        `SELECT
           j.id AS job_id, j.title AS job_title, j.client, j.division, j.status,
           jwa.id AS work_area_id, jwa.name AS work_area_name,
           COALESCE(jwa.estimated_hours::numeric, 0) AS estimated_hours,
           COALESCE((
             SELECT SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600)
             FROM time_entries te
             WHERE te.job_work_area_id = jwa.id AND te.clock_out IS NOT NULL
               AND te.entry_type NOT IN ('break','shop_time','shop')
           ), 0) AS actual_hours
         FROM job_work_areas jwa
         JOIN jobs j ON j.id = jwa.job_id
         WHERE ${where}
         ORDER BY j.title, jwa.name
         LIMIT 1000`,
        params
      );
      const enriched = rows.map(r => {
        const est = Number(r.estimated_hours);
        const act = Number(r.actual_hours);
        const variance = act - est;
        const pct_over = est > 0 ? (variance / est) * 100 : 0;
        const is_over_budget = est > 0 && act > est;
        return { ...r, estimated_hours: est, actual_hours: act, variance, pct_over, is_over_budget };
      });
      const result = only_over_budget === "true" ? enriched.filter(r => r.is_over_budget) : enriched;
      return res.json(result);
    } catch (err: any) {
      console.error("[work-area-budget] query error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Job Comparison — side-by-side profitability for selected jobs (S16-11) ──
  app.get("/api/reports/job-comparison", requireAuth, async (req: any, res) => {
    if (!["Admin", "Manager", "Master Admin"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Admin only" });
    }
    const { ids } = req.query as Record<string, string>;
    if (!ids) return res.json([]);
    const idList = ids.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 10);
    if (!idList.length) return res.json([]);
    try {
      const { rows } = await pool.query(
        `SELECT
           j.id, j.title, j.client, j.status, j.division,
           j.created_at, j.completion_date,
           COALESCE(j.estimated_hours, 0) AS estimated_hours,
           COALESCE(j.price::numeric, 0) AS sold_value,
           COALESCE(se.total::numeric, 0) AS estimate_value,
           COALESCE((
             SELECT SUM(co.total) FROM job_change_orders co
             WHERE co.job_id = j.id AND co.status = 'approved'
           ), 0) AS approved_co_total,
           COALESCE((
             SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600)
             FROM time_entries te
             WHERE te.job_id = j.id AND te.clock_out IS NOT NULL
               AND te.entry_type NOT IN ('break','shop_time','shop')
           ), 0) AS actual_hours,
           COALESCE((
             SELECT SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
               * COALESCE(NULLIF(emp.pay_rate,'')::numeric, 0))
             FROM time_entries te
             LEFT JOIN employees emp ON emp.user_id = te.user_id
             WHERE te.job_id = j.id AND te.clock_out IS NOT NULL
               AND te.entry_type NOT IN ('break','shop_time','shop')
           ), 0) AS labor_cost,
           COALESCE((
             SELECT SUM(jm.quantity * jm.unit_cost) FROM job_materials jm
             WHERE jm.job_id = j.id::text
               AND jm.quantity IS NOT NULL AND jm.unit_cost IS NOT NULL
           ), 0) AS material_cost,
           COALESCE((
             SELECT SUM(jea.hours_used * COALESCE(jea.hourly_rate, 0))
             FROM job_equipment_assignments jea WHERE jea.job_id = j.id::text
           ), 0) AS equipment_cost,
           COALESCE((
             SELECT SUM(jea.hours_used) FROM job_equipment_assignments jea
             WHERE jea.job_id = j.id::text
           ), 0) AS equipment_hours
         FROM jobs j
         LEFT JOIN sales_estimates se ON se.id::text = j.source_estimate_id
         WHERE j.id = ANY($1::text[])
         ORDER BY j.created_at DESC`,
        [idList]
      );
      const enriched = rows.map(r => {
        const sold = Number(r.sold_value);
        const equipment_cost = Number(r.equipment_cost || 0);
        const cogs = Number(r.labor_cost) + Number(r.material_cost) + equipment_cost;
        const gross_profit = sold - cogs;
        const margin_pct = sold > 0 ? (gross_profit / sold) * 100 : 0;
        return { ...r, equipment_cost, cogs, gross_profit, margin_pct };
      });
      return res.json(enriched);
    } catch (err: any) {
      console.error("[job-comparison] query error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
