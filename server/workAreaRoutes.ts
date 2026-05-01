import { Express } from "express";
import { z } from "zod";
import { pool } from "./db";

const VALID_STATUSES = ["pending", "active", "on_hold", "completed"] as const;

const createWorkAreaSchema = z.object({
  work_area_type_id: z.string().optional().nullable(),
  name:              z.string().min(1).optional(),
  estimated_hours:   z.number().positive().optional().nullable(),
  sort_order:        z.number().int().default(0),
  notes:             z.string().optional().nullable(),
}).refine((d) => d.work_area_type_id || d.name, {
  message: "work_area_type_id or name is required",
});

const patchWorkAreaSchema = z.object({
  name:            z.string().min(1).optional(),
  estimated_hours: z.number().positive().optional().nullable(),
  sort_order:      z.number().int().optional(),
  notes:           z.string().optional().nullable(),
  status:          z.enum(VALID_STATUSES).optional(),
}).strict();

export function registerWorkAreaRoutes(app: Express, requireAuth: any, requireRole: any) {

  // ── Migrate: is_active column on job_work_areas (fire-and-forget) ─────────
  pool.query(`ALTER TABLE job_work_areas ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`)
    .catch((err: any) => console.error("[workAreaRoutes] is_active migration:", err.message));

  // ── Migrate: cost_code + qb_service_name on work_area_types (fire-and-forget) ──
  pool.query(`
    ALTER TABLE work_area_types
      ADD COLUMN IF NOT EXISTS cost_code      TEXT,
      ADD COLUMN IF NOT EXISTS qb_service_name TEXT
  `).catch((err: any) => console.error("[workAreaRoutes] cost_code migration:", err.message));

  // ── Migrate: cost_code on estimate_work_areas (fire-and-forget) ────────────
  pool.query(`ALTER TABLE estimate_work_areas ADD COLUMN IF NOT EXISTS cost_code TEXT`)
    .catch((err: any) => console.error("[workAreaRoutes] estimate_work_areas cost_code migration:", err.message));

  // ── Seed: ensure "On Site" exists as the first General work area type ─────
  pool.query(`
    INSERT INTO work_area_types (name, division, sort_order, is_active)
    SELECT 'On Site', 'General', 0, true
    WHERE NOT EXISTS (
      SELECT 1 FROM work_area_types WHERE name = 'On Site' AND division = 'General'
    )
  `).catch((err: any) => console.error("[workAreaRoutes] On Site seed:", err.message));

  // ── GET /api/work-area-types ─────────────────────────────────────────────
  // ?all=true returns inactive items too (used by settings page)
  app.get("/api/work-area-types", requireAuth, async (req, res) => {
    try {
      const showAll = req.query.all === "true";
      const { rows } = await pool.query(
        showAll
          ? `SELECT * FROM work_area_types ORDER BY division, sort_order, name`
          : `SELECT * FROM work_area_types WHERE is_active = true ORDER BY division, sort_order, name`
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

  // ── DELETE /api/work-area-types/:id ──────────────────────────────────────
  app.delete("/api/work-area-types/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const inUse = await pool.query(
        `SELECT 1 FROM job_work_areas WHERE work_area_type_id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (inUse.rows.length > 0) {
        return res.status(409).json({ message: "Cannot delete — this type is in use by one or more jobs." });
      }
      await pool.query(`DELETE FROM work_area_types WHERE id = $1`, [req.params.id]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/work-areas?jobId=X ─────────────────────────────────────────
  // Unified endpoint returns three fields:
  //   globalAreas  – General-division types only (On Site, Drive Time, etc.), sorted by sort_order
  //   jobAreas     – job-specific work areas when jobId is provided, else []
  //   allTypes     – all active work_area_types (used as fallback when job has no areas)
  app.get("/api/work-areas", requireAuth, async (req, res) => {
    const jobId = req.query.jobId as string | undefined;
    try {
      const [allTypesRes, jobRes] = await Promise.all([
        pool.query(
          `SELECT id, name, division, sort_order FROM work_area_types WHERE is_active = true ORDER BY division, sort_order, name`
        ),
        jobId
          ? pool.query(
              `SELECT id, name, estimated_hours, status FROM job_work_areas WHERE job_id = $1 AND is_active = true ORDER BY sort_order, name`,
              [jobId]
            )
          : Promise.resolve({ rows: [] as any[] }),
      ]);

      const globalAreas = allTypesRes.rows
        .filter((r: any) => r.division === "General")
        .sort((a: any, b: any) => a.sort_order - b.sort_order);

      return res.json({
        globalAreas,
        jobAreas: jobRes.rows,
        allTypes: allTypesRes.rows,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/jobs/:id/work-areas ─────────────────────────────────────────
  // Soft-deleted rows (is_active=false) are always excluded.
  // ?active=true        → also exclude completed areas
  // ?status=pending,active  → comma-separated status filter
  // ?includeDeleted=true    → admin only: include soft-deleted rows
  app.get("/api/jobs/:id/work-areas", requireAuth, async (req, res) => {
    try {
      const { active, status, includeDeleted } = req.query as Record<string, string | undefined>;
      const userRole: string = (req.user as any)?.role ?? "";

      const params: any[] = [req.params.id];
      const extraClauses: string[] = [];

      // Soft-delete visibility
      if (!(includeDeleted === "true" && userRole === "Admin")) {
        extraClauses.push(`jwa.is_active = true`);
      }

      // Status filter
      if (active === "true") {
        extraClauses.push(`jwa.status != 'completed'`);
      } else if (status) {
        const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          params.push(statuses);
          extraClauses.push(`jwa.status = ANY($${params.length}::text[])`);
        }
      }

      const whereExtra = extraClauses.length ? "AND " + extraClauses.join(" AND ") : "";

      const { rows } = await pool.query(
        `SELECT jwa.*,
                COALESCE(
                  (SELECT SUM(duration_minutes)::decimal / 60
                   FROM time_entries
                   WHERE job_work_area_id = jwa.id AND clock_out IS NOT NULL), 0
                ) AS actual_hours_computed,
                (SELECT ewa.area_description
                 FROM   sales_estimates se
                 JOIN   estimate_work_areas ewa
                        ON  ewa.estimate_id = se.id
                        AND ewa.name = jwa.name
                 WHERE  se.converted_job_id = jwa.job_id
                 LIMIT 1
                ) AS area_description
         FROM job_work_areas jwa
         WHERE jwa.job_id = $1
         ${whereExtra}
         ORDER BY
           CASE jwa.status
             WHEN 'active'    THEN 0
             WHEN 'pending'   THEN 1
             WHEN 'completed' THEN 2
             ELSE 3
           END,
           jwa.sort_order, jwa.name`,
        params
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/jobs/:jobId/work-areas ─────────────────────────────────────
  // Admin only. Accepts:
  //   work_area_type_id – pulls name from the type catalog
  //   name              – custom name (required if no type id)
  //   estimated_hours   – optional
  //   sort_order        – optional, default 0
  //   notes             – optional
  app.post("/api/jobs/:jobId/work-areas", requireAuth, requireRole(["Admin"]), async (req, res) => {
    const parsed = createWorkAreaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid body" });
    }

    const { work_area_type_id, name: customName, estimated_hours, sort_order, notes } = parsed.data;

    try {
      // Validate job exists
      const jobCheck = await pool.query(`SELECT id FROM jobs WHERE id = $1`, [req.params.jobId]);
      if (jobCheck.rows.length === 0) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Resolve display name from catalog if not provided directly
      let areaName = customName ?? null;
      if (work_area_type_id && !areaName) {
        const { rows: typeRows } = await pool.query(
          `SELECT name FROM work_area_types WHERE id = $1`,
          [work_area_type_id]
        );
        if (typeRows.length === 0) {
          return res.status(404).json({ message: "Work area type not found" });
        }
        areaName = typeRows[0].name;
      }

      const { rows } = await pool.query(
        `INSERT INTO job_work_areas
           (job_id, work_area_type_id, name, estimated_hours, sort_order, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          req.params.jobId,
          work_area_type_id ?? null,
          areaName,
          estimated_hours ?? null,
          sort_order,
          notes ?? null,
        ]
      );
      return res.status(201).json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/jobs/:jobId/work-areas/:id ────────────────────────────────
  // Any authenticated user may update status (crew route mode). Admin/Manager
  // may update any subset of: name, estimated_hours, sort_order, notes, status.
  // Valid status values: pending | active | on_hold | completed
  app.patch("/api/jobs/:jobId/work-areas/:id", requireAuth, async (req, res) => {
    const parsed = patchWorkAreaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid body" });
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    try {
      // Confirm the work area belongs to the specified job
      const check = await pool.query(
        `SELECT id FROM job_work_areas WHERE id = $1 AND job_id = $2`,
        [req.params.id, req.params.jobId]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ message: "Work area not found on this job" });
      }

      // Build dynamic SET clause — only touch fields that were sent
      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      const fieldMap: Record<string, string> = {
        name:            "name",
        estimated_hours: "estimated_hours",
        sort_order:      "sort_order",
        notes:           "notes",
        status:          "status",
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in data) {
          setClauses.push(`${col} = $${idx}`);
          values.push((data as any)[key] ?? null);
          idx++;
        }
      }

      values.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE job_work_areas SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );

      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/jobs/:jobId/work-areas/:id ───────────────────────────────
  // Admin only. Soft-deletes the work area (sets is_active = false).
  // The work area is hidden from all field-worker views immediately.
  app.delete("/api/jobs/:jobId/work-areas/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE job_work_areas
         SET is_active = false
         WHERE id = $1 AND job_id = $2
         RETURNING *`,
        [req.params.id, req.params.jobId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Work area not found on this job" });
      }
      return res.json({ success: true, deactivated: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/job-work-areas/:id ── legacy alias (auth only, no admin gate)
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
