import { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";
import multerLib from "multer";
import { parse as parseCsv } from "csv-parse/sync";

const upload = multerLib({ storage: multerLib.memoryStorage() }).single("file");

function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const role = (req.user as any)?.role;
  if (!["Admin", "Manager"].includes(role) && !(req.user as any)?.isMasterAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export function registerMaintenanceRouteRoutes(app: Express) {

  // ── GET /api/maintenance-routes ──────────────────────────────────────────────
  app.get("/api/maintenance-routes", requireStaff, async (req: any, res: any) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           r.*,
           e.first_name AS crew_first_name,
           e.last_name  AS crew_last_name,
           COUNT(s.id)::int AS stop_count
         FROM maintenance_routes r
         LEFT JOIN employees e ON e.id = r.assigned_crew_id
         LEFT JOIN maintenance_route_stops s ON s.route_id = r.id
         GROUP BY r.id, e.first_name, e.last_name
         ORDER BY r.name ASC`
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/maintenance-routes ─────────────────────────────────────────────
  app.post("/api/maintenance-routes", requireStaff, async (req: any, res: any) => {
    try {
      const {
        name, description, assigned_crew_id, cadence, interval_days,
        days_of_week, season_start, season_end, is_active, notes,
      } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Route name is required" });
      const { rows } = await pool.query(
        `INSERT INTO maintenance_routes
           (name, description, assigned_crew_id, cadence, interval_days,
            days_of_week, season_start, season_end, is_active, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          name.trim(),
          description || null,
          assigned_crew_id || null,
          cadence || "weekly",
          interval_days || null,
          days_of_week?.length ? days_of_week : null,
          season_start || null,
          season_end || null,
          is_active !== false,
          notes || null,
        ]
      );
      return res.status(201).json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/maintenance-routes/:id ──────────────────────────────────────────
  app.get("/api/maintenance-routes/:id", requireStaff, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { rows: routeRows } = await pool.query(
        `SELECT r.*, e.first_name AS crew_first_name, e.last_name AS crew_last_name
         FROM maintenance_routes r
         LEFT JOIN employees e ON e.id = r.assigned_crew_id
         WHERE r.id = $1`,
        [id]
      );
      if (!routeRows.length) return res.status(404).json({ message: "Route not found" });

      const { rows: stops } = await pool.query(
        `SELECT s.*,
                p.address, p.city, p.state, p.zip,
                c.first_name AS cust_first_name, c.last_name AS cust_last_name, c.company_name
         FROM maintenance_route_stops s
         LEFT JOIN properties p ON p.id = s.property_id
         LEFT JOIN customers c  ON c.id = p.customer_id
         WHERE s.route_id = $1
         ORDER BY s.sequence_order ASC, s.created_at ASC`,
        [id]
      );
      return res.json({ ...routeRows[0], stops });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/maintenance-routes/:id ──────────────────────────────────────────
  app.put("/api/maintenance-routes/:id", requireStaff, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const {
        name, description, assigned_crew_id, cadence, interval_days,
        days_of_week, season_start, season_end, is_active, notes,
      } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Route name is required" });
      const { rows } = await pool.query(
        `UPDATE maintenance_routes SET
           name=$1, description=$2, assigned_crew_id=$3, cadence=$4, interval_days=$5,
           days_of_week=$6, season_start=$7, season_end=$8, is_active=$9, notes=$10,
           updated_at=now()
         WHERE id=$11 RETURNING *`,
        [
          name.trim(),
          description || null,
          assigned_crew_id || null,
          cadence || "weekly",
          interval_days || null,
          days_of_week?.length ? days_of_week : null,
          season_start || null,
          season_end || null,
          is_active !== false,
          notes || null,
          id,
        ]
      );
      if (!rows.length) return res.status(404).json({ message: "Route not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/maintenance-routes/:id ───────────────────────────────────────
  app.delete("/api/maintenance-routes/:id", requireStaff, async (req: any, res: any) => {
    try {
      await pool.query(`DELETE FROM maintenance_routes WHERE id=$1`, [req.params.id]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/maintenance-routes/:id/stops ────────────────────────────────────
  app.get("/api/maintenance-routes/:id/stops", requireStaff, async (req: any, res: any) => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*,
                p.address, p.city, p.state, p.zip,
                c.first_name AS cust_first_name, c.last_name AS cust_last_name, c.company_name
         FROM maintenance_route_stops s
         LEFT JOIN properties p ON p.id = s.property_id
         LEFT JOIN customers c  ON c.id = p.customer_id
         WHERE s.route_id = $1
         ORDER BY s.sequence_order ASC, s.created_at ASC`,
        [req.params.id]
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/maintenance-routes/:id/stops ───────────────────────────────────
  app.post("/api/maintenance-routes/:id/stops", requireStaff, async (req: any, res: any) => {
    try {
      const { id: route_id } = req.params;
      const { property_id, sequence_order, expected_duration_minutes, service_notes, expected_services } = req.body;

      // Auto-assign sequence_order if not provided
      let order = sequence_order;
      if (order == null) {
        const { rows: maxRow } = await pool.query(
          `SELECT COALESCE(MAX(sequence_order), 0) + 1 AS next_order FROM maintenance_route_stops WHERE route_id=$1`,
          [route_id]
        );
        order = maxRow[0].next_order;
      }

      const { rows } = await pool.query(
        `INSERT INTO maintenance_route_stops
           (route_id, property_id, sequence_order, expected_duration_minutes, service_notes, expected_services)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [route_id, property_id || null, order, expected_duration_minutes || null, service_notes || null, expected_services || null]
      );

      // Return stop with property info
      const { rows: enriched } = await pool.query(
        `SELECT s.*, p.address, p.city, p.state, p.zip,
                c.first_name AS cust_first_name, c.last_name AS cust_last_name, c.company_name
         FROM maintenance_route_stops s
         LEFT JOIN properties p ON p.id = s.property_id
         LEFT JOIN customers c  ON c.id = p.customer_id
         WHERE s.id = $1`,
        [rows[0].id]
      );
      return res.status(201).json(enriched[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/maintenance-routes/:id/stops/:stopId ────────────────────────────
  app.put("/api/maintenance-routes/:id/stops/:stopId", requireStaff, async (req: any, res: any) => {
    try {
      const { stopId } = req.params;
      const { property_id, sequence_order, expected_duration_minutes, service_notes, expected_services } = req.body;
      const { rows } = await pool.query(
        `UPDATE maintenance_route_stops SET
           property_id=$1, sequence_order=$2, expected_duration_minutes=$3,
           service_notes=$4, expected_services=$5, updated_at=now()
         WHERE id=$6 RETURNING *`,
        [property_id || null, sequence_order, expected_duration_minutes || null, service_notes || null, expected_services || null, stopId]
      );
      if (!rows.length) return res.status(404).json({ message: "Stop not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/maintenance-routes/:id/stops/:stopId ─────────────────────────
  app.delete("/api/maintenance-routes/:id/stops/:stopId", requireStaff, async (req: any, res: any) => {
    try {
      await pool.query(`DELETE FROM maintenance_route_stops WHERE id=$1 AND route_id=$2`, [req.params.stopId, req.params.id]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/maintenance-routes/:id/stops/reorder ───────────────────────────
  // Body: { order: [{ id: stopId, sequence_order: n }, ...] }
  app.post("/api/maintenance-routes/:id/stops/reorder", requireStaff, async (req: any, res: any) => {
    try {
      const { order } = req.body as { order: Array<{ id: string; sequence_order: number }> };
      if (!Array.isArray(order)) return res.status(400).json({ message: "order must be an array" });
      for (const item of order) {
        await pool.query(
          `UPDATE maintenance_route_stops SET sequence_order=$1, updated_at=now() WHERE id=$2 AND route_id=$3`,
          [item.sequence_order, item.id, req.params.id]
        );
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/maintenance-routes/import ──────────────────────────────────────
  // CSV columns: Route Name, Address, Sequence, Duration (min), Service Notes,
  //              Expected Services, Cadence, Days of Week, Season Start, Season End
  // Route dedup: name (case-insensitive). Stop dedup: route_id + property match.
  app.post("/api/maintenance-routes/import", requireStaff, upload, async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const text = req.file.buffer.toString("utf-8");
      const records: Record<string, string>[] = parseCsv(text, { columns: true, skip_empty_lines: true, trim: true });

      const results = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };

      // Load existing routes for dedup
      const { rows: existingRoutes } = await pool.query(`SELECT id, name FROM maintenance_routes`);
      const routeMap: Record<string, string> = {};
      for (const r of existingRoutes) routeMap[r.name.toLowerCase()] = r.id;

      // Load existing stops per route
      const { rows: existingStops } = await pool.query(
        `SELECT s.id, s.route_id, s.property_id, p.address
         FROM maintenance_route_stops s
         LEFT JOIN properties p ON p.id = s.property_id`
      );

      for (const row of records) {
        try {
          const routeName = (row["Route Name"] || row["route_name"] || row["Route"] || "").trim();
          const address   = (row["Address"] || row["address"] || "").trim();
          if (!routeName) { results.skipped++; results.errors.push(`Row skipped: missing Route Name`); continue; }
          if (!address)   { results.skipped++; results.errors.push(`Row "${routeName}": missing Address`); continue; }

          // Resolve or create route
          const routeKey = routeName.toLowerCase();
          let routeId = routeMap[routeKey];
          if (!routeId) {
            const cadence    = (row["Cadence"] || "weekly").trim().toLowerCase();
            const daysRaw    = row["Days of Week"] || row["days_of_week"] || "";
            const daysArr    = daysRaw ? daysRaw.split(",").map((d: string) => d.trim()).filter(Boolean) : null;
            const seasonStart = row["Season Start"] || row["season_start"] || null;
            const seasonEnd   = row["Season End"]   || row["season_end"]   || null;
            const { rows: newRoute } = await pool.query(
              `INSERT INTO maintenance_routes (name, cadence, days_of_week, season_start, season_end)
               VALUES ($1,$2,$3,$4,$5) RETURNING id`,
              [routeName, cadence, daysArr, seasonStart || null, seasonEnd || null]
            );
            routeId = newRoute[0].id;
            routeMap[routeKey] = routeId;
          }

          // Match property by address (case-insensitive, partial)
          const { rows: propMatches } = await pool.query(
            `SELECT id FROM properties WHERE LOWER(address) LIKE LOWER($1) LIMIT 1`,
            [`%${address}%`]
          );
          const propertyId = propMatches[0]?.id ?? null;

          // Dedup stop: same route + same property
          const seqRaw  = row["Sequence"] || row["sequence"] || null;
          const seqNum  = seqRaw ? parseInt(seqRaw, 10) : null;
          const duration = row["Duration (min)"] || row["Duration"] || row["duration"] || null;
          const serviceNotes    = row["Service Notes"]    || row["service_notes"]    || null;
          const expectedServices = row["Expected Services"] || row["expected_services"] || null;

          if (propertyId) {
            const existingStop = existingStops.find(
              (s: any) => s.route_id === routeId && s.property_id === propertyId
            );
            if (existingStop) {
              await pool.query(
                `UPDATE maintenance_route_stops SET
                   sequence_order=COALESCE($1, sequence_order),
                   expected_duration_minutes=COALESCE($2, expected_duration_minutes),
                   service_notes=COALESCE($3, service_notes),
                   expected_services=COALESCE($4, expected_services),
                   updated_at=now()
                 WHERE id=$5`,
                [seqNum, duration ? parseInt(duration, 10) : null, serviceNotes || null, expectedServices || null, existingStop.id]
              );
              results.updated++;
              continue;
            }
          }

          // New stop
          const { rows: maxRow } = await pool.query(
            `SELECT COALESCE(MAX(sequence_order), 0) + 1 AS next_order FROM maintenance_route_stops WHERE route_id=$1`,
            [routeId]
          );
          const order = seqNum ?? maxRow[0].next_order;
          const { rows: newStop } = await pool.query(
            `INSERT INTO maintenance_route_stops
               (route_id, property_id, sequence_order, expected_duration_minutes, service_notes, expected_services)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [routeId, propertyId, order, duration ? parseInt(duration, 10) : null, serviceNotes || null, expectedServices || null]
          );
          existingStops.push({ id: newStop[0].id, route_id: routeId, property_id: propertyId, address });
          results.imported++;
        } catch (rowErr: any) {
          results.errors.push(`Row "${row["Route Name"] || "?"}": ${rowErr.message}`);
          results.skipped++;
        }
      }
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
