import type { Express } from "express";
import { pool } from "./db";
import { generateUpcomingVisits } from "./maintenanceVisitScheduler";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  const role = (req.user as any)?.role;
  const isMaster = (req.user as any)?.isMasterAdmin;
  if (!isMaster && role !== "Admin") return res.status(403).json({ message: "Admin only" });
  next();
}

function requireAdminOrManager(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  const role = (req.user as any)?.role;
  const isMaster = (req.user as any)?.isMasterAdmin;
  if (!isMaster && role !== "Admin" && role !== "Manager") {
    return res.status(403).json({ message: "Admin or Manager only" });
  }
  next();
}

export function registerMaintenanceVisitRoutes(app: Express) {
  /**
   * GET /api/maintenance-visits
   * Returns generated visits with route name + ordered stop list.
   *
   * Query params (one of):
   *   ?date=YYYY-MM-DD          — single day
   *   ?start=YYYY-MM-DD&end=YYYY-MM-DD — date range
   *
   * Optional filters:
   *   &mine=true   — only visits where assigned_crew_id matches the logged-in user's employee
   *   &crew_id=X   — only visits for a specific employee ID
   */
  app.get("/api/maintenance-visits", requireAuth, async (req: any, res) => {
    try {
      const { date, start, end, mine, crew_id } = req.query as Record<string, string>;

      let fromDate: string, toDate: string;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        fromDate = toDate = date;
      } else if (
        start && end &&
        /^\d{4}-\d{2}-\d{2}$/.test(start) &&
        /^\d{4}-\d{2}-\d{2}$/.test(end)
      ) {
        fromDate = start;
        toDate = end;
      } else {
        return res.status(400).json({
          message: "Provide ?date=YYYY-MM-DD or ?start=YYYY-MM-DD&end=YYYY-MM-DD",
        });
      }

      const params: any[] = [fromDate, toDate];
      let crewFilter = "";

      if (mine === "true") {
        const empResult = await pool.query(
          `SELECT id FROM employees WHERE user_id = $1 LIMIT 1`,
          [req.user.id]
        );
        const empId = empResult.rows[0]?.id;
        if (empId) {
          params.push(empId);
          crewFilter = `AND mrv.assigned_crew_id = $${params.length}`;
        } else {
          return res.json([]);
        }
      } else if (crew_id) {
        params.push(crew_id);
        crewFilter = `AND mrv.assigned_crew_id = $${params.length}`;
      }

      const { rows } = await pool.query(`
        SELECT
          mrv.id,
          mrv.visit_date::text                                      AS visit_date,
          mrv.status,
          mrv.notes,
          mrv.completed_at,
          mrv.actual_duration_minutes,
          mrv.stops_completed,
          mrv.stops_total,
          mr.id                                                     AS route_id,
          mr.name                                                   AS route_name,
          mr.description                                            AS route_description,
          mr.cadence,
          mrv.assigned_crew_id,
          TRIM(e.first_name || ' ' || COALESCE(e.last_name, ''))   AS assigned_crew_name,
          COALESCE(
            json_agg(
              jsonb_build_object(
                'id',                        mrs.id,
                'sequence_order',            mrs.sequence_order,
                'expected_duration_minutes', mrs.expected_duration_minutes,
                'service_notes',             mrs.service_notes,
                'expected_services',         mrs.expected_services,
                'property_address',          p.address,
                'property_id',              p.id::text
              ) ORDER BY mrs.sequence_order
            ) FILTER (WHERE mrs.id IS NOT NULL),
            '[]'::json
          ) AS stops
        FROM maintenance_route_visits mrv
        JOIN  maintenance_routes mr ON mr.id = mrv.route_id
        LEFT JOIN employees e ON e.id::text = mrv.assigned_crew_id
        LEFT JOIN maintenance_route_stops mrs ON mrs.route_id = mrv.route_id
        LEFT JOIN properties p ON p.id = mrs.property_id
        WHERE mrv.visit_date BETWEEN $1 AND $2
          ${crewFilter}
        GROUP BY mrv.id, mr.id, mr.name, mr.description, mr.cadence,
                 mrv.assigned_crew_id, e.first_name, e.last_name
        ORDER BY mrv.visit_date, mr.name
      `, params);

      return res.json(rows);
    } catch (err: any) {
      console.error("[maintenance-visits] GET error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  /**
   * PATCH /api/maintenance-visits/:id
   * Admin/Manager: update a visit's status, completion data, and per-stop completions.
   *
   * Body (all fields optional):
   *   status: 'scheduled'|'completed'|'missed'|'partial'
   *   completed_at: ISO string | null
   *   actual_duration_minutes: number | null
   *   notes: string | null
   *   stop_completions: Array<{ route_stop_id: string; property_id?: string; completed: boolean; notes?: string }>
   */
  app.patch("/api/maintenance-visits/:id", requireAdminOrManager, async (req: any, res) => {
    const { id } = req.params;
    const {
      status,
      completed_at,
      actual_duration_minutes,
      notes,
      stop_completions,
    } = req.body;

    const VALID_STATUSES = ["scheduled", "completed", "missed", "partial"];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    try {
      // Build SET clauses for visit-level fields
      const sets: string[] = ["updated_at = now()"];
      const vals: any[] = [];

      if (status !== undefined) { vals.push(status); sets.push(`status = $${vals.length}`); }
      if ("completed_at" in req.body) { vals.push(completed_at ?? null); sets.push(`completed_at = $${vals.length}`); }
      if ("actual_duration_minutes" in req.body) { vals.push(actual_duration_minutes ?? null); sets.push(`actual_duration_minutes = $${vals.length}`); }
      if ("notes" in req.body) { vals.push(notes ?? null); sets.push(`notes = $${vals.length}`); }

      // Derive stops_completed / stops_total from stop_completions if provided
      if (Array.isArray(stop_completions)) {
        vals.push(stop_completions.filter((s: any) => s.completed).length);
        sets.push(`stops_completed = $${vals.length}`);
        vals.push(stop_completions.length);
        sets.push(`stops_total = $${vals.length}`);
      }

      vals.push(id);
      const visitRow = await pool.query(
        `UPDATE maintenance_route_visits SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`,
        vals,
      );

      if (visitRow.rowCount === 0) {
        return res.status(404).json({ message: "Visit not found" });
      }

      // Upsert per-stop completion records
      if (Array.isArray(stop_completions) && stop_completions.length > 0) {
        for (const sc of stop_completions) {
          if (!sc.route_stop_id) continue;
          await pool.query(`
            INSERT INTO maintenance_route_visit_stops
              (visit_id, route_stop_id, property_id, completed, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (visit_id, route_stop_id)
              WHERE route_stop_id IS NOT NULL
            DO UPDATE SET completed = EXCLUDED.completed, notes = EXCLUDED.notes
          `, [id, sc.route_stop_id, sc.property_id ?? null, sc.completed ?? false, sc.notes ?? null]);
        }
      }

      return res.json({ success: true, visit: visitRow.rows[0] });
    } catch (err: any) {
      console.error("[maintenance-visits] PATCH error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  /**
   * POST /api/admin/maintenance-visits/generate
   * Admin-only manual trigger. Runs generateUpcomingVisits() immediately.
   */
  app.post("/api/admin/maintenance-visits/generate", requireAdmin, async (_req, res) => {
    try {
      const result = await generateUpcomingVisits();
      return res.json({
        success: true,
        inserted: result.inserted,
        routes_processed: result.routes,
        message: `Generated ${result.inserted} new visit(s) across ${result.routes} active route(s).`,
      });
    } catch (err: any) {
      console.error("[maintenance-visits] generate error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Reporting (Admin/Manager) ─────────────────────────────────────────────

  /**
   * GET /api/admin/maintenance-reports/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
   * Per-route rollup: visits scheduled/completed/missed, completion %, avg durations, stop hit rate.
   */
  app.get("/api/admin/maintenance-reports/summary", requireAdminOrManager, async (req: any, res) => {
    const { start, end } = req.query as Record<string, string>;
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return res.status(400).json({ message: "Provide ?start=YYYY-MM-DD&end=YYYY-MM-DD" });
    }
    try {
      const { rows } = await pool.query(`
        SELECT
          mr.id                                                        AS route_id,
          mr.name                                                      AS route_name,
          mr.cadence,
          COUNT(*)::int                                                AS visits_total,
          COUNT(*) FILTER (WHERE mrv.status = 'completed')::int        AS visits_completed,
          COUNT(*) FILTER (WHERE mrv.status = 'missed')::int           AS visits_missed,
          COUNT(*) FILTER (WHERE mrv.status = 'partial')::int          AS visits_partial,
          COUNT(*) FILTER (WHERE mrv.status = 'scheduled')::int        AS visits_scheduled,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE mrv.status = 'completed')
            / NULLIF(COUNT(*), 0), 1
          )                                                            AS completion_rate_pct,
          ROUND(
            AVG(mrv.actual_duration_minutes)
              FILTER (WHERE mrv.actual_duration_minutes IS NOT NULL), 1
          )                                                            AS avg_actual_duration_min,
          COALESCE(exp.expected_total_min, 0)                          AS expected_duration_per_visit_min,
          COALESCE(SUM(mrv.actual_duration_minutes), 0)::int           AS total_actual_minutes,
          COALESCE(SUM(mrv.stops_completed), 0)::int                   AS total_stops_hit,
          COALESCE(SUM(mrv.stops_total), 0)::int                       AS total_stops_planned
        FROM maintenance_route_visits mrv
        JOIN  maintenance_routes mr ON mr.id = mrv.route_id
        LEFT JOIN (
          SELECT route_id, COALESCE(SUM(expected_duration_minutes), 0) AS expected_total_min
          FROM  maintenance_route_stops
          GROUP BY route_id
        ) exp ON exp.route_id = mr.id
        WHERE mrv.visit_date BETWEEN $1 AND $2
        GROUP BY mr.id, mr.name, mr.cadence, exp.expected_total_min
        ORDER BY mr.name
      `, [start, end]);
      return res.json({ routes: rows, start, end });
    } catch (err: any) {
      console.error("[maintenance-reports] summary error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/admin/maintenance-reports/route/:routeId?start=YYYY-MM-DD&end=YYYY-MM-DD
   * Per-visit history for a single route with per-stop completion detail.
   */
  app.get("/api/admin/maintenance-reports/route/:routeId", requireAdminOrManager, async (req: any, res) => {
    const { routeId } = req.params;
    const { start, end } = req.query as Record<string, string>;
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return res.status(400).json({ message: "Provide ?start=YYYY-MM-DD&end=YYYY-MM-DD" });
    }
    try {
      // Route info
      const routeResult = await pool.query(
        `SELECT id, name, cadence, description FROM maintenance_routes WHERE id = $1`,
        [routeId]
      );
      if (routeResult.rowCount === 0) return res.status(404).json({ message: "Route not found" });

      const { rows } = await pool.query(`
        SELECT
          mrv.id,
          mrv.visit_date::text,
          mrv.status,
          mrv.completed_at,
          mrv.actual_duration_minutes,
          mrv.stops_completed,
          mrv.stops_total,
          mrv.notes,
          mrv.assigned_crew_id,
          TRIM(e.first_name || ' ' || COALESCE(e.last_name, '')) AS assigned_crew_name,
          COALESCE(
            json_agg(
              jsonb_build_object(
                'id',             mrvs.id,
                'route_stop_id',  mrvs.route_stop_id,
                'property_id',    mrvs.property_id,
                'completed',      mrvs.completed,
                'notes',          mrvs.notes,
                'sequence_order', mrs.sequence_order,
                'property_address', p.address
              ) ORDER BY mrs.sequence_order NULLS LAST
            ) FILTER (WHERE mrvs.id IS NOT NULL),
            '[]'::json
          ) AS stop_completions
        FROM maintenance_route_visits mrv
        LEFT JOIN employees e ON e.id::text = mrv.assigned_crew_id
        LEFT JOIN maintenance_route_visit_stops mrvs ON mrvs.visit_id = mrv.id
        LEFT JOIN maintenance_route_stops mrs ON mrs.id = mrvs.route_stop_id
        LEFT JOIN properties p ON p.id = mrvs.property_id
        WHERE mrv.route_id = $1
          AND mrv.visit_date BETWEEN $2 AND $3
        GROUP BY mrv.id, e.first_name, e.last_name
        ORDER BY mrv.visit_date DESC
      `, [routeId, start, end]);

      return res.json({ route: routeResult.rows[0], visits: rows, start, end });
    } catch (err: any) {
      console.error("[maintenance-reports] route history error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
