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
          // No employee record → return empty
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
}
