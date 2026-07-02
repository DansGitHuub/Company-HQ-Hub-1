import { pool } from "./db";
import type { Express } from "express";

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function rangesOverlap(
  s1: number | null, e1: number | null,
  s2: number | null, e2: number | null
): boolean {
  if (s1 === null || s2 === null) return true; // no time info → treat as potential conflict
  const end1 = e1 ?? s1 + 480;
  const end2 = e2 ?? s2 + 480;
  return s1 < end2 && s2 < end1;
}

export function registerDailyPlanRoutes(app: Express, requireAuth: any) {
  app.get("/api/daily-plan", requireAuth, async (req: any, res) => {
    try {
      // Default to tomorrow; accept ?date=YYYY-MM-DD to view any day
      let planDate: string;
      if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date as string)) {
        planDate = req.query.date as string;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        planDate = d.toISOString().slice(0, 10);
      }

      // ── 1. Jobs scheduled on planDate ────────────────────────────────────
      const { rows: jobs } = await pool.query(`
        SELECT
          j.id, j.title, j.client, j.address, j.city, j.state,
          j.status, j.division, j.scheduled_date,
          j.scheduled_start_time, j.scheduled_end_time,
          j.estimated_hours, j.crew_lead_id,
          j.crew_lead_name,
          e.name AS crew_lead_display_name
        FROM jobs j
        LEFT JOIN employees e ON e.id = j.crew_lead_id
        WHERE DATE(j.scheduled_date) = $1
          AND j.status NOT IN ('completed', 'invoiced', 'cancelled')
        ORDER BY j.scheduled_start_time NULLS LAST, j.client
      `, [planDate]);

      const jobIds: string[] = jobs.map((j: any) => j.id);

      // ── 2. Crew assignments for those jobs ───────────────────────────────
      let crewRows: any[] = [];
      if (jobIds.length) {
        const { rows } = await pool.query(`
          SELECT ja.job_id, ja.employee_id, ja.sort_order, e.name AS employee_name
          FROM job_assignments ja
          JOIN employees e ON e.id = ja.employee_id
          WHERE ja.job_id = ANY($1)
          ORDER BY ja.sort_order
        `, [jobIds]);
        crewRows = rows;
      }

      // ── 3. Equipment assignments for those jobs ──────────────────────────
      let equipRows: any[] = [];
      if (jobIds.length) {
        const { rows } = await pool.query(`
          SELECT jea.job_id, jea.equipment_id, eq.name AS equipment_name
          FROM job_equipment_assignments jea
          JOIN equipment eq ON eq.id = jea.equipment_id
          WHERE jea.job_id = ANY($1)
        `, [jobIds]);
        equipRows = rows;
      }

      // ── 4. Aggregated materials across those jobs ────────────────────────
      let materials: any[] = [];
      if (jobIds.length) {
        const { rows } = await pool.query(`
          SELECT
            COALESCE(NULLIF(jm.item_name,''), ci.name) AS item_name,
            jm.units,
            jm.item_number,
            SUM(jm.quantity) AS total_quantity
          FROM job_materials jm
          LEFT JOIN catalog_items ci ON ci.id = jm.catalog_item_id
          WHERE jm.job_id = ANY($1)
            AND COALESCE(NULLIF(jm.item_name,''), ci.name) IS NOT NULL
          GROUP BY COALESCE(NULLIF(jm.item_name,''), ci.name), jm.units, jm.item_number
          ORDER BY item_name
        `, [jobIds]);
        materials = rows;
      }

      // ── 5. Overdue jobs (scheduled before planDate, not done) ────────────
      const { rows: overdueJobs } = await pool.query(`
        SELECT
          j.id, j.title, j.client, j.scheduled_date, j.status,
          j.address, j.city, j.division,
          e.name AS crew_lead_display_name
        FROM jobs j
        LEFT JOIN employees e ON e.id = j.crew_lead_id
        WHERE j.scheduled_date IS NOT NULL
          AND DATE(j.scheduled_date) < $1
          AND j.status NOT IN ('completed', 'invoiced', 'cancelled')
        ORDER BY j.scheduled_date ASC
        LIMIT 50
      `, [planDate]);

      // ── Build enriched job objects ───────────────────────────────────────
      type EnrichedJob = typeof jobs[0] & {
        crew: { employee_id: string; employee_name: string; sort_order: number }[];
        equipment: { equipment_id: string; equipment_name: string }[];
      };

      const jobMap = new Map<string, EnrichedJob>();
      jobs.forEach((j: any) => jobMap.set(j.id, { ...j, crew: [], equipment: [] }));

      crewRows.forEach((row: any) => {
        jobMap.get(row.job_id)?.crew.push({
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          sort_order: row.sort_order,
        });
      });
      equipRows.forEach((row: any) => {
        jobMap.get(row.job_id)?.equipment.push({
          equipment_id: row.equipment_id,
          equipment_name: row.equipment_name,
        });
      });

      const enrichedJobs = Array.from(jobMap.values());

      // ── Group by crew lead ───────────────────────────────────────────────
      const crewGroupMap = new Map<string, {
        crewLabel: string;
        crewLeadId: string | null;
        jobs: EnrichedJob[];
      }>();

      enrichedJobs.forEach((job) => {
        const key = job.crew_lead_id ?? "unassigned";
        const label = job.crew_lead_display_name || job.crew_lead_name || "Unassigned";
        if (!crewGroupMap.has(key)) {
          crewGroupMap.set(key, { crewLabel: label, crewLeadId: job.crew_lead_id ?? null, jobs: [] });
        }
        crewGroupMap.get(key)!.jobs.push(job);
      });

      const crewGroups = Array.from(crewGroupMap.values());

      // ── Conflict detection ───────────────────────────────────────────────
      const conflicts: {
        type: "crew" | "equipment";
        name: string;
        description: string;
        jobs: { id: string; title: string; start_time: string | null; end_time: string | null }[];
      }[] = [];

      // Crew conflicts — build a map of employee_id → jobs they appear in
      const empJobMap = new Map<string, { name: string; jobs: EnrichedJob[] }>();

      enrichedJobs.forEach((job) => {
        // Explicit crew assignments
        job.crew.forEach((cm) => {
          if (!empJobMap.has(cm.employee_id)) {
            empJobMap.set(cm.employee_id, { name: cm.employee_name, jobs: [] });
          }
          empJobMap.get(cm.employee_id)!.jobs.push(job);
        });
        // Crew lead (if not already in crew list)
        if (job.crew_lead_id) {
          const alreadyListed = job.crew.some((c) => c.employee_id === job.crew_lead_id);
          if (!alreadyListed) {
            if (!empJobMap.has(job.crew_lead_id)) {
              empJobMap.set(job.crew_lead_id, {
                name: job.crew_lead_display_name || job.crew_lead_name || "Unknown",
                jobs: [],
              });
            }
            empJobMap.get(job.crew_lead_id)!.jobs.push(job);
          }
        }
      });

      empJobMap.forEach(({ name, jobs: empJobs }) => {
        if (empJobs.length < 2) return;
        outer: for (let i = 0; i < empJobs.length; i++) {
          for (let k = i + 1; k < empJobs.length; k++) {
            const a = empJobs[i], b = empJobs[k];
            const s1 = timeToMinutes(a.scheduled_start_time);
            const e1 = timeToMinutes(a.scheduled_end_time);
            const s2 = timeToMinutes(b.scheduled_start_time);
            const e2 = timeToMinutes(b.scheduled_end_time);
            if (rangesOverlap(s1, e1, s2, e2)) {
              const hasTime = s1 !== null && s2 !== null;
              conflicts.push({
                type: "crew",
                name,
                description: hasTime
                  ? `${name} is assigned to ${empJobs.length} jobs with overlapping times`
                  : `${name} is assigned to ${empJobs.length} jobs — times not set, possible overlap`,
                jobs: empJobs.map((j) => ({
                  id: j.id,
                  title: j.title || j.client || j.id,
                  start_time: j.scheduled_start_time ?? null,
                  end_time: j.scheduled_end_time ?? null,
                })),
              });
              break outer;
            }
          }
        }
      });

      // Equipment conflicts
      const eqJobMap = new Map<string, { name: string; jobs: EnrichedJob[] }>();

      enrichedJobs.forEach((job) => {
        job.equipment.forEach((eq) => {
          if (!eqJobMap.has(eq.equipment_id)) {
            eqJobMap.set(eq.equipment_id, { name: eq.equipment_name, jobs: [] });
          }
          eqJobMap.get(eq.equipment_id)!.jobs.push(job);
        });
      });

      eqJobMap.forEach(({ name, jobs: eqJobs }) => {
        if (eqJobs.length < 2) return;
        outer: for (let i = 0; i < eqJobs.length; i++) {
          for (let k = i + 1; k < eqJobs.length; k++) {
            const a = eqJobs[i], b = eqJobs[k];
            const s1 = timeToMinutes(a.scheduled_start_time);
            const e1 = timeToMinutes(a.scheduled_end_time);
            const s2 = timeToMinutes(b.scheduled_start_time);
            const e2 = timeToMinutes(b.scheduled_end_time);
            if (rangesOverlap(s1, e1, s2, e2)) {
              const hasTime = s1 !== null && s2 !== null;
              conflicts.push({
                type: "equipment",
                name,
                description: hasTime
                  ? `${name} is assigned to ${eqJobs.length} jobs with overlapping times`
                  : `${name} is assigned to ${eqJobs.length} jobs — times not set, possible overlap`,
                jobs: eqJobs.map((j) => ({
                  id: j.id,
                  title: j.title || j.client || j.id,
                  start_time: j.scheduled_start_time ?? null,
                  end_time: j.scheduled_end_time ?? null,
                })),
              });
              break outer;
            }
          }
        }
      });

      return res.json({
        date: planDate,
        jobs: enrichedJobs,
        crewGroups,
        materials,
        conflicts,
        overdueJobs,
      });
    } catch (err: any) {
      console.error("[daily-plan] error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
