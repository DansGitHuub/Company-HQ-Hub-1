import { Express } from "express";
import { pool } from "./db";

export function registerReportRoutes(app: Express, requireAuth: any) {

  // ── REVENUE REPORT ──────────────────────────────────────────────────────────
  app.get("/api/reports/revenue", requireAuth, async (req, res) => {
    const { date_from, date_to, division, statuses } = req.query as Record<string, string>;
    try {
      // Parse status list. "_all" → no status filter. Empty → default to realized work.
      const statusList: string[] | null =
        statuses === "_all"  ? null :
        statuses             ? statuses.split(",").map(s => s.trim()).filter(Boolean) :
                               ["Completed", "Invoiced", "Paid"];

      const params: any[] = [];
      const conditions: string[] = ["j.price IS NOT NULL", "j.price > 0"];

      if (date_from)   { params.push(date_from);  conditions.push(`j.scheduled_date >= $${params.length}`); }
      if (date_to)     { params.push(date_to);    conditions.push(`j.scheduled_date <= $${params.length}`); }
      if (division)    { params.push(division);   conditions.push(`j.division = $${params.length}`); }
      if (statusList)  { params.push(statusList); conditions.push(`j.status = ANY($${params.length})`); }

      const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

      // Monthly buckets
      const byMonth = await pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', j.scheduled_date), 'Mon YYYY') AS month,
          DATE_TRUNC('month', j.scheduled_date) AS month_start,
          COUNT(*)::int AS job_count,
          COALESCE(SUM(j.price), 0)::numeric AS revenue
        FROM jobs j
        ${where}
        GROUP BY DATE_TRUNC('month', j.scheduled_date)
        ORDER BY month_start
      `, params);

      // Division breakdown
      const byDivision = await pool.query(`
        SELECT
          COALESCE(j.division, 'Unassigned') AS division,
          COUNT(*)::int AS job_count,
          COALESCE(SUM(j.price), 0)::numeric AS revenue
        FROM jobs j
        ${where}
        GROUP BY COALESCE(j.division, 'Unassigned')
        ORDER BY revenue DESC
      `, params);

      // Totals
      const totals = await pool.query(`
        SELECT
          COUNT(*)::int AS total_jobs,
          COALESCE(SUM(j.price), 0)::numeric AS total_revenue,
          CASE WHEN COUNT(*) > 0 THEN COALESCE(AVG(j.price), 0)::numeric ELSE 0 END AS avg_job_value
        FROM jobs j
        ${where}
      `, params);

      // Prior period comparison (same date range shifted back, same status filter)
      let priorRevenue = 0;
      if (date_from && date_to) {
        const start = new Date(date_from);
        const end   = new Date(date_to);
        const diff  = end.getTime() - start.getTime();
        const priorStart = new Date(start.getTime() - diff).toISOString().split("T")[0];
        const priorEnd   = new Date(start.getTime() - 1).toISOString().split("T")[0];
        const priorParams: any[] = [priorStart, priorEnd];
        const priorStatusClause = statusList ? ` AND status = ANY($3)` : "";
        if (statusList) priorParams.push(statusList);
        const prior = await pool.query(
          `SELECT COALESCE(SUM(price), 0)::numeric AS rev FROM jobs WHERE price > 0 AND scheduled_date BETWEEN $1 AND $2${priorStatusClause}`,
          priorParams
        );
        priorRevenue = Number(prior.rows[0]?.rev ?? 0);
      }

      const totalRevenue = Number(totals.rows[0]?.total_revenue ?? 0);
      const pctChange = priorRevenue > 0
        ? ((totalRevenue - priorRevenue) / priorRevenue) * 100
        : null;

      res.json({
        summary: {
          total_revenue: totalRevenue,
          total_jobs:    totals.rows[0]?.total_jobs ?? 0,
          avg_job_value: Number(totals.rows[0]?.avg_job_value ?? 0),
          pct_vs_prior:  pctChange,
        },
        by_month: byMonth.rows.map(r => ({
          month:     r.month,
          revenue:   Number(r.revenue),
          job_count: r.job_count,
        })),
        by_division: byDivision.rows.map(r => ({
          division:  r.division,
          revenue:   Number(r.revenue),
          job_count: r.job_count,
          pct:       totalRevenue > 0 ? (Number(r.revenue) / totalRevenue) * 100 : 0,
        })),
      });
    } catch (err: any) {
      console.error("[reports/revenue]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── INVOICE AGING ───────────────────────────────────────────────────────────
  app.get("/api/reports/invoice-aging", requireAuth, async (req, res) => {
    const { as_of_date } = req.query as Record<string, string>;
    const asOf = as_of_date || new Date().toISOString().split("T")[0];
    try {
      const invoices = await pool.query(`
        SELECT
          i.id,
          i.invoice_number,
          i.status,
          i.issued_date,
          i.due_date,
          COALESCE(i.balance_due, 0)::numeric AS balance_due,
          COALESCE(i.total, 0)::numeric AS total,
          COALESCE(i.amount_paid, 0)::numeric AS amount_paid,
          c.first_name, c.last_name, c.company_name,
          ($1::date - i.due_date::date) AS days_past_due
        FROM invoices i
        LEFT JOIN customers c ON c.id::text = i.customer_id::text
        WHERE i.status NOT IN ('Paid', 'Void', 'Cancelled')
          AND i.balance_due > 0
        ORDER BY days_past_due DESC NULLS LAST
      `, [asOf]);

      const rows = invoices.rows.map(r => ({
        id:             r.id,
        invoice_number: r.invoice_number,
        customer:       r.company_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—",
        status:         r.status,
        issued_date:    r.issued_date,
        due_date:       r.due_date,
        balance_due:    Number(r.balance_due),
        days_past_due:  Number(r.days_past_due ?? 0),
        bucket: (() => {
          const d = Number(r.days_past_due ?? 0);
          if (d <= 0)  return "current";
          if (d <= 30) return "1-30";
          if (d <= 60) return "31-60";
          if (d <= 90) return "61-90";
          return "90+";
        })(),
      }));

      const bucket = (b: string) => rows.filter(r => r.bucket === b).reduce((s, r) => s + r.balance_due, 0);

      res.json({
        summary: {
          current:  bucket("current"),
          days_1_30:  bucket("1-30"),
          days_31_60: bucket("31-60"),
          days_61_90: bucket("61-90"),
          days_90plus: bucket("90+"),
          total_ar:   rows.reduce((s, r) => s + r.balance_due, 0),
          invoice_count: rows.length,
        },
        invoices: rows,
      });
    } catch (err: any) {
      console.error("[reports/invoice-aging]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── CREW HOURS ───────────────────────────────────────────────────────────────
  app.get("/api/reports/crew-hours", requireAuth, async (req, res) => {
    const { date_from, date_to, user_id } = req.query as Record<string, string>;
    try {
      const params: any[] = [];
      const conditions: string[] = [
        "te.duration_minutes IS NOT NULL",
        "te.duration_minutes > 0",
        "te.clock_in IS NOT NULL",
      ];

      if (date_from) { params.push(date_from); conditions.push(`te.clock_in::date >= $${params.length}`); }
      if (date_to)   { params.push(date_to);   conditions.push(`te.clock_in::date <= $${params.length}`); }
      if (user_id)   { params.push(user_id);   conditions.push(`te.user_id = $${params.length}`); }

      const where = "WHERE " + conditions.join(" AND ");

      // Per-employee totals
      const byEmployee = await pool.query(`
        SELECT
          te.user_id,
          u.name AS employee_name,
          COUNT(DISTINCT te.clock_in::date)::int AS days_worked,
          COALESCE(SUM(te.duration_minutes), 0)::numeric AS total_minutes,
          COUNT(*)::int AS entry_count
        FROM time_entries te
        LEFT JOIN users u ON u.id = te.user_id
        ${where}
        GROUP BY te.user_id, u.name
        ORDER BY total_minutes DESC
      `, params);

      // Weekly trend (last 12 weeks by default)
      const weeklyParams: any[] = [];
      const weeklyConditions = [
        "te.duration_minutes > 0",
        "te.clock_in IS NOT NULL",
      ];
      if (date_from) { weeklyParams.push(date_from); weeklyConditions.push(`te.clock_in::date >= $${weeklyParams.length}`); }
      if (date_to)   { weeklyParams.push(date_to);   weeklyConditions.push(`te.clock_in::date <= $${weeklyParams.length}`); }
      if (user_id)   { weeklyParams.push(user_id);   weeklyConditions.push(`te.user_id = $${weeklyParams.length}`); }

      const byWeek = await pool.query(`
        SELECT
          DATE_TRUNC('week', te.clock_in)::date AS week_start,
          TO_CHAR(DATE_TRUNC('week', te.clock_in), 'Mon DD') AS week_label,
          COALESCE(SUM(te.duration_minutes), 0)::numeric AS total_minutes,
          COUNT(DISTINCT te.user_id)::int AS crew_count
        FROM time_entries te
        WHERE ${weeklyConditions.join(" AND ")}
        GROUP BY DATE_TRUNC('week', te.clock_in)
        ORDER BY week_start
        LIMIT 12
      `, weeklyParams);

      const empRows = byEmployee.rows.map(r => {
        const totalMins = Number(r.total_minutes);
        const totalHrs  = totalMins / 60;
        // Rough OT estimate: hours > 40/week counted as OT
        const weeks     = r.days_worked > 0 ? Math.ceil(r.days_worked / 5) : 1;
        const regHrs    = Math.min(totalHrs, weeks * 40);
        const otHrs     = Math.max(0, totalHrs - regHrs);
        return {
          user_id:       r.user_id,
          employee_name: r.employee_name || "Unknown",
          days_worked:   r.days_worked,
          entry_count:   r.entry_count,
          total_hours:   Math.round(totalHrs * 10) / 10,
          regular_hours: Math.round(regHrs * 10) / 10,
          ot_hours:      Math.round(otHrs * 10) / 10,
          avg_per_day:   r.days_worked > 0 ? Math.round((totalHrs / r.days_worked) * 10) / 10 : 0,
        };
      });

      const totalHrs = empRows.reduce((s, r) => s + r.total_hours, 0);
      const totalReg = empRows.reduce((s, r) => s + r.regular_hours, 0);
      const totalOT  = empRows.reduce((s, r) => s + r.ot_hours, 0);
      const avgHrs   = empRows.length > 0 ? totalHrs / empRows.length : 0;

      res.json({
        summary: {
          total_hours:   Math.round(totalHrs * 10) / 10,
          regular_hours: Math.round(totalReg * 10) / 10,
          ot_hours:      Math.round(totalOT * 10) / 10,
          avg_hours:     Math.round(avgHrs * 10) / 10,
          employee_count: empRows.length,
        },
        by_employee: empRows,
        by_week: byWeek.rows.map(r => ({
          week_label:   r.week_label,
          total_hours:  Math.round(Number(r.total_minutes) / 60 * 10) / 10,
          crew_count:   r.crew_count,
        })),
      });
    } catch (err: any) {
      console.error("[reports/crew-hours]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── TIME BY DIVISION ─────────────────────────────────────────────────────────
  app.get("/api/reports/time-by-division", requireAuth, async (req, res) => {
    const { date_from, date_to } = req.query as Record<string, string>;
    try {
      const params: any[] = [];
      const conditions: string[] = ["te.clock_out IS NOT NULL"];
      if (date_from) { params.push(date_from); conditions.push(`te.clock_in::date >= $${params.length}`); }
      if (date_to)   { params.push(date_to);   conditions.push(`te.clock_in::date <= $${params.length}`); }
      const where = "WHERE " + conditions.join(" AND ");

      const [byDiv, byMonth, byEmployee] = await Promise.all([
        pool.query(`
          SELECT
            COALESCE(j.division, 'Unassigned') AS division,
            COUNT(DISTINCT te.user_id)::int AS crew_count,
            COUNT(*)::int AS entry_count,
            ROUND(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600)::numeric, 1) AS total_hours
          FROM time_entries te
          LEFT JOIN jobs j ON j.id = te.job_id
          ${where}
          GROUP BY COALESCE(j.division, 'Unassigned')
          ORDER BY total_hours DESC
        `, params),
        pool.query(`
          SELECT
            TO_CHAR(DATE_TRUNC('month', te.clock_in), 'Mon YYYY') AS month,
            DATE_TRUNC('month', te.clock_in) AS month_start,
            COALESCE(j.division, 'Unassigned') AS division,
            ROUND(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600)::numeric, 1) AS total_hours
          FROM time_entries te
          LEFT JOIN jobs j ON j.id = te.job_id
          ${where}
          GROUP BY DATE_TRUNC('month', te.clock_in), COALESCE(j.division, 'Unassigned')
          ORDER BY month_start, division
        `, params),
        pool.query(`
          SELECT
            COALESCE(u.name, 'Unknown') AS employee_name,
            COALESCE(j.division, 'Unassigned') AS division,
            ROUND(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600)::numeric, 1) AS total_hours
          FROM time_entries te
          LEFT JOIN jobs j ON j.id = te.job_id
          LEFT JOIN users u ON u.id = te.user_id
          ${where}
          GROUP BY u.name, COALESCE(j.division, 'Unassigned')
          ORDER BY total_hours DESC
          LIMIT 50
        `, params),
      ]);

      const totalHours = byDiv.rows.reduce((s: number, r: any) => s + Number(r.total_hours), 0);

      // Pivot monthly rows into { month, Install: X, Maintenance: Y, ... }
      const monthMap: Record<string, any> = {};
      for (const r of byMonth.rows) {
        if (!monthMap[r.month]) monthMap[r.month] = { month: r.month, month_start: r.month_start };
        monthMap[r.month][r.division] = Number(r.total_hours);
      }
      const divisions = [...new Set(byDiv.rows.map((r: any) => r.division))];

      res.json({
        summary: { total_hours: Math.round(totalHours * 10) / 10, division_count: byDiv.rows.length },
        by_division: byDiv.rows.map((r: any) => ({ ...r, total_hours: Number(r.total_hours) })),
        by_month: Object.values(monthMap).sort((a: any, b: any) => a.month_start < b.month_start ? -1 : 1),
        by_employee: byEmployee.rows.map((r: any) => ({ ...r, total_hours: Number(r.total_hours) })),
        divisions,
      });
    } catch (err: any) {
      console.error("[reports/time-by-division]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── MATERIALS SPEND ───────────────────────────────────────────────────────────
  app.get("/api/reports/materials-spend", requireAuth, async (req, res) => {
    const { date_from, date_to, division } = req.query as Record<string, string>;
    try {
      const params: any[] = [];
      const conditions: string[] = ["jm.quantity IS NOT NULL", "jm.unit_cost IS NOT NULL"];
      if (date_from) { params.push(date_from); conditions.push(`jm.created_at::date >= $${params.length}`); }
      if (date_to)   { params.push(date_to);   conditions.push(`jm.created_at::date <= $${params.length}`); }
      if (division)  { params.push(division);   conditions.push(`j.division = $${params.length}`); }
      const where = "WHERE " + conditions.join(" AND ");

      const [byMonth, byItem, byDiv, totals] = await Promise.all([
        pool.query(`
          SELECT
            TO_CHAR(DATE_TRUNC('month', jm.created_at), 'Mon YYYY') AS month,
            DATE_TRUNC('month', jm.created_at) AS month_start,
            COUNT(*)::int AS line_count,
            ROUND(SUM(jm.quantity * jm.unit_cost)::numeric, 2) AS total_spend
          FROM job_materials jm
          LEFT JOIN jobs j ON j.id = jm.job_id
          ${where}
          GROUP BY DATE_TRUNC('month', jm.created_at)
          ORDER BY month_start
        `, params),
        pool.query(`
          SELECT
            jm.item_name,
            jm.item_number,
            COUNT(*)::int AS usage_count,
            ROUND(SUM(jm.quantity)::numeric, 2) AS total_qty,
            ROUND(SUM(jm.quantity * jm.unit_cost)::numeric, 2) AS total_spend
          FROM job_materials jm
          LEFT JOIN jobs j ON j.id = jm.job_id
          ${where}
          GROUP BY jm.item_name, jm.item_number
          ORDER BY total_spend DESC
          LIMIT 20
        `, params),
        pool.query(`
          SELECT
            COALESCE(j.division, 'Unassigned') AS division,
            COUNT(DISTINCT jm.job_id)::int AS job_count,
            ROUND(SUM(jm.quantity * jm.unit_cost)::numeric, 2) AS total_spend
          FROM job_materials jm
          LEFT JOIN jobs j ON j.id = jm.job_id
          ${where}
          GROUP BY COALESCE(j.division, 'Unassigned')
          ORDER BY total_spend DESC
        `, params),
        pool.query(`
          SELECT
            COUNT(DISTINCT jm.job_id)::int AS job_count,
            COUNT(*)::int AS line_count,
            ROUND(SUM(jm.quantity * jm.unit_cost)::numeric, 2) AS total_spend,
            ROUND(AVG(jm.quantity * jm.unit_cost)::numeric, 2) AS avg_line_value
          FROM job_materials jm
          LEFT JOIN jobs j ON j.id = jm.job_id
          ${where}
        `, params),
      ]);

      res.json({
        summary: {
          total_spend:    Number(totals.rows[0]?.total_spend ?? 0),
          job_count:      totals.rows[0]?.job_count ?? 0,
          line_count:     totals.rows[0]?.line_count ?? 0,
          avg_line_value: Number(totals.rows[0]?.avg_line_value ?? 0),
        },
        by_month:    byMonth.rows.map((r: any) => ({ ...r, total_spend: Number(r.total_spend) })),
        by_item:     byItem.rows.map((r: any) => ({ ...r, total_spend: Number(r.total_spend), total_qty: Number(r.total_qty) })),
        by_division: byDiv.rows.map((r: any) => ({ ...r, total_spend: Number(r.total_spend) })),
      });
    } catch (err: any) {
      console.error("[reports/materials-spend]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── AT A GLANCE ─────────────────────────────────────────────────────────────
  // Single endpoint — 6 parallel queries, sensible defaults (YTD / 90d / 30d).
  // Win Rate uses sales_estimates.sent_at + customer_response ('accepted'/'declined').
  // Crew Utilization uses time_entries.job_id IS NOT NULL as "billable".
  // Maintenance Compliance uses jobs.division = 'Maintenance' + scheduled_date vs today.
  app.get("/api/reports/at-a-glance", requireAuth, async (req: any, res) => {
    try {
      const [revenueYtd, totalAR, winRate, utilization, jobsByStage, maintCompliance] =
        await Promise.all([

          // 1. Revenue YTD — identical filter to the Revenue Report tab (case-sensitive
          //    title-case values, same price guard, same year-of-scheduled_date scope).
          //    Previously used LOWER(status) which matched lowercase DB values that the
          //    Revenue Report's exact-case comparison misses, causing the two to diverge.
          pool.query(`
            SELECT COALESCE(SUM(price), 0)::numeric AS revenue_ytd
            FROM jobs
            WHERE EXTRACT(YEAR FROM scheduled_date) = EXTRACT(YEAR FROM CURRENT_DATE)
              AND price IS NOT NULL
              AND price > 0
              AND status = ANY(ARRAY['Completed', 'Invoiced', 'Paid'])
          `),

          // 2. Total AR — same WHERE as invoice-aging endpoint
          pool.query(`
            SELECT
              COALESCE(SUM(balance_due), 0)::numeric AS total_ar,
              COUNT(*)::int AS invoice_count
            FROM invoices
            WHERE status NOT IN ('Paid', 'Void', 'Cancelled', 'draft')
              AND balance_due > 0
          `),

          // 3. Win Rate (last 90 days)
          //    "Sent" = sent_at IS NOT NULL within window
          //    "Won"  = customer_response = 'accepted'
          //    "Lost" = customer_response IN ('declined', 'rejected')
          //    Rate   = won / (won + lost)  [excludes pending/no-response]
          pool.query(`
            SELECT
              COUNT(*) FILTER (
                WHERE LOWER(customer_response) = 'accepted'
              )::int AS won,
              COUNT(*) FILTER (
                WHERE LOWER(customer_response) IN ('declined', 'rejected')
              )::int AS lost
            FROM sales_estimates
            WHERE sent_at IS NOT NULL
              AND sent_at >= NOW() - INTERVAL '90 days'
          `),

          // 4. Crew Utilization (last 30 days)
          //    Billable = job_id IS NOT NULL; Total = all completed clock-outs
          pool.query(`
            SELECT
              COALESCE(SUM(
                COALESCE(
                  duration_minutes,
                  CASE WHEN clock_out IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60.0
                    ELSE 0 END
                )
              ), 0)::numeric AS total_minutes,
              COALESCE(SUM(
                CASE WHEN job_id IS NOT NULL THEN
                  COALESCE(
                    duration_minutes,
                    CASE WHEN clock_out IS NOT NULL
                      THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60.0
                      ELSE 0 END
                  )
                ELSE 0 END
              ), 0)::numeric AS billable_minutes
            FROM time_entries
            WHERE clock_in >= NOW() - INTERVAL '30 days'
              AND clock_out IS NOT NULL
          `),

          // 5. Active jobs grouped by status (excludes terminal statuses)
          pool.query(`
            SELECT status, COUNT(*)::int AS cnt
            FROM jobs
            WHERE LOWER(status) NOT IN ('completed', 'invoiced', 'paid', 'cancelled')
              AND status IS NOT NULL
            GROUP BY status
            ORDER BY cnt DESC
          `),

          // 6. Maintenance Compliance (current year, division = Maintenance)
          //    "Behind" = not completed AND scheduled_date has already passed
          //    "On schedule" = completed OR scheduled_date is today/future
          pool.query(`
            SELECT
              COUNT(*)::int AS total_count,
              COUNT(*) FILTER (
                WHERE LOWER(status) IN ('completed', 'invoiced', 'paid')
              )::int AS completed_count,
              COUNT(*) FILTER (
                WHERE LOWER(status) NOT IN ('completed', 'invoiced', 'paid', 'cancelled')
                  AND scheduled_date IS NOT NULL
                  AND DATE(scheduled_date) < CURRENT_DATE
              )::int AS behind_count,
              COUNT(*) FILTER (
                WHERE LOWER(status) NOT IN ('completed', 'invoiced', 'paid', 'cancelled')
                  AND (scheduled_date IS NULL OR DATE(scheduled_date) >= CURRENT_DATE)
              )::int AS on_schedule_count
            FROM jobs
            WHERE LOWER(division) = 'maintenance'
              AND EXTRACT(YEAR FROM COALESCE(scheduled_date, created_at)) = EXTRACT(YEAR FROM CURRENT_DATE)
          `),
        ]);

      const won       = Number(winRate.rows[0]?.won  ?? 0);
      const lost      = Number(winRate.rows[0]?.lost ?? 0);
      const finalized = won + lost;
      const winRatePct = finalized > 0 ? (won / finalized) * 100 : null;

      const totalMin    = Number(utilization.rows[0]?.total_minutes    ?? 0);
      const billableMin = Number(utilization.rows[0]?.billable_minutes ?? 0);
      // Require at least 6 minutes of total time so the displayed hours value
      // is >= 0.1 hrs (the minimum non-zero value at 1 decimal place).
      // When totalMin < 6 the UI would show "0.0 hrs" for both figures yet the
      // division could yield 100%, which is misleading — return null instead
      // so the tile displays "—" (no meaningful data).
      const utilizationPct = totalMin >= 6 ? (billableMin / totalMin) * 100 : null;

      const maintTotal   = Number(maintCompliance.rows[0]?.total_count     ?? 0);
      const maintBehind  = Number(maintCompliance.rows[0]?.behind_count     ?? 0);
      const maintGood    = Number(maintCompliance.rows[0]?.completed_count  ?? 0)
                         + Number(maintCompliance.rows[0]?.on_schedule_count ?? 0);
      const maintPct     = maintTotal > 0 ? (maintGood / maintTotal) * 100 : null;

      res.json({
        revenue_ytd:                 Number(revenueYtd.rows[0]?.revenue_ytd ?? 0),
        total_ar:                    Number(totalAR.rows[0]?.total_ar        ?? 0),
        ar_invoice_count:            Number(totalAR.rows[0]?.invoice_count   ?? 0),
        win_rate_pct:                winRatePct,
        win_rate_won:                won,
        win_rate_total:              finalized,
        utilization_pct:             utilizationPct,
        utilization_billable_min:    billableMin,
        utilization_total_min:       totalMin,
        jobs_by_stage:               jobsByStage.rows,
        maintenance_compliance_pct:  maintPct,
        maintenance_total:           maintTotal,
        maintenance_behind:          maintBehind,
      });
    } catch (err: any) {
      console.error("[reports/at-a-glance]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── EQUIPMENT REPAIR COST ────────────────────────────────────────────────────
  app.get("/api/reports/equipment-repair", requireAuth, async (req, res) => {
    const { date_from, date_to, equipment_id } = req.query as Record<string, string>;
    try {
      const params: any[] = [];
      const conditions: string[] = [];
      if (date_from)    { params.push(date_from);    conditions.push(`ml.completed_date::date >= $${params.length}`); }
      if (date_to)      { params.push(date_to);      conditions.push(`ml.completed_date::date <= $${params.length}`); }
      if (equipment_id) { params.push(equipment_id); conditions.push(`ml.equipment_id = $${params.length}`); }
      const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

      const [byAsset, byMonth, byType, totals] = await Promise.all([
        pool.query(`
          SELECT
            e.name AS equipment_name,
            e.asset_id,
            e.type AS equipment_type,
            COUNT(ml.id)::int AS service_count,
            ROUND(COALESCE(SUM(ml.total_cost), 0) / 100.0, 2) AS total_cost
          FROM maintenance_logs ml
          JOIN equipment e ON e.id = ml.equipment_id
          ${where}
          GROUP BY e.id, e.name, e.asset_id, e.type
          ORDER BY total_cost DESC
          LIMIT 25
        `, params),
        pool.query(`
          SELECT
            TO_CHAR(DATE_TRUNC('month', ml.completed_date), 'Mon YYYY') AS month,
            DATE_TRUNC('month', ml.completed_date) AS month_start,
            COUNT(ml.id)::int AS service_count,
            ROUND(COALESCE(SUM(ml.total_cost), 0) / 100.0, 2) AS total_cost
          FROM maintenance_logs ml
          JOIN equipment e ON e.id = ml.equipment_id
          ${where}
          GROUP BY DATE_TRUNC('month', ml.completed_date)
          ORDER BY month_start
        `, params),
        pool.query(`
          SELECT
            COALESCE(NULLIF(ml.log_type, ''), 'scheduled') AS log_type,
            COUNT(ml.id)::int AS service_count,
            ROUND(COALESCE(SUM(ml.total_cost), 0) / 100.0, 2) AS total_cost
          FROM maintenance_logs ml
          JOIN equipment e ON e.id = ml.equipment_id
          ${where}
          GROUP BY COALESCE(NULLIF(ml.log_type, ''), 'scheduled')
          ORDER BY total_cost DESC
        `, params),
        pool.query(`
          SELECT
            COUNT(ml.id)::int AS service_count,
            COUNT(DISTINCT ml.equipment_id)::int AS asset_count,
            ROUND(COALESCE(SUM(ml.total_cost), 0) / 100.0, 2) AS total_cost,
            ROUND(COALESCE(AVG(ml.total_cost), 0) / 100.0, 2) AS avg_cost_per_service
          FROM maintenance_logs ml
          JOIN equipment e ON e.id = ml.equipment_id
          ${where}
        `, params),
      ]);

      res.json({
        summary: {
          total_cost:           Number(totals.rows[0]?.total_cost ?? 0),
          service_count:        totals.rows[0]?.service_count ?? 0,
          asset_count:          totals.rows[0]?.asset_count ?? 0,
          avg_cost_per_service: Number(totals.rows[0]?.avg_cost_per_service ?? 0),
        },
        by_asset:  byAsset.rows.map((r: any) => ({ ...r, total_cost: Number(r.total_cost) })),
        by_month:  byMonth.rows.map((r: any) => ({ ...r, total_cost: Number(r.total_cost) })),
        by_type:   byType.rows.map((r: any) => ({ ...r, total_cost: Number(r.total_cost) })),
      });
    } catch (err: any) {
      console.error("[reports/equipment-repair]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── MATERIAL SHORTAGES ───────────────────────────────────────────────────────
  // Surfaces worksheets where crew flagged materials needed (checklist_materials_needed=true)
  // and any worksheet_materials entries logged that day.
  app.get("/api/reports/material-shortages", requireAuth, async (req, res) => {
    const { date_from, date_to, job_id } = req.query as Record<string, string>;
    try {
      const params: any[] = [];
      const conditions: string[] = ["w.checklist_materials_needed = true"];
      if (date_from) { params.push(date_from); conditions.push(`w.date::date >= $${params.length}`); }
      if (date_to)   { params.push(date_to);   conditions.push(`w.date::date <= $${params.length}`); }
      if (job_id)    { params.push(job_id);     conditions.push(`w.job_id = $${params.length}`); }
      const where = "WHERE " + conditions.join(" AND ");

      const [flagged, materials] = await Promise.all([
        pool.query(`
          SELECT
            w.id AS worksheet_id,
            w.date,
            w.checklist_materials_note,
            w.job_id,
            j.title AS job_title,
            j.division,
            u.first_name || ' ' || u.last_name AS crew_member,
            u.id AS user_id
          FROM worksheets w
          LEFT JOIN jobs j ON j.id = w.job_id
          LEFT JOIN users u ON u.id = w.user_id
          ${where}
          ORDER BY w.date DESC
          LIMIT 100
        `, params),
        pool.query(`
          SELECT
            wm.worksheet_id,
            wm.material_name,
            wm.quantity,
            wm.unit,
            wm.unit_cost,
            wm.notes
          FROM worksheet_materials wm
          JOIN worksheets w ON w.id = wm.worksheet_id
          ${where.replace("w.checklist_materials_needed = true", "1=1")}
          ORDER BY wm.worksheet_id, wm.id
        `, params),
      ]);

      // Group materials by worksheet_id for easy lookup
      const materialsByWorksheet: Record<string, any[]> = {};
      for (const m of materials.rows) {
        if (!materialsByWorksheet[m.worksheet_id]) materialsByWorksheet[m.worksheet_id] = [];
        materialsByWorksheet[m.worksheet_id].push(m);
      }

      const result = flagged.rows.map((r: any) => ({
        ...r,
        materials_logged: (materialsByWorksheet[r.worksheet_id] ?? []).map((m: any) => ({
          material_name: m.material_name,
          quantity:      m.quantity ? Number(m.quantity) : null,
          unit:          m.unit,
          unit_cost:     m.unit_cost ? Number(m.unit_cost) : null,
          notes:         m.notes,
        })),
      }));

      res.json({
        total: result.length,
        items: result,
      });
    } catch (err: any) {
      console.error("[reports/material-shortages]", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
