import { pool } from "./db";
import type { Express } from "express";

// ── Local copies of dailyPlanRoutes.ts overlap helpers ──────────────────────
// (duplicated intentionally so this read-only aggregation route never has to
// modify server/dailyPlanRoutes.ts; logic must stay in lockstep with that file)
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
  if (s1 === null || s2 === null) return true;
  const end1 = e1 ?? s1 + 480;
  const end2 = e2 ?? s2 + 480;
  return s1 < end2 && s2 < end1;
}

export function registerAdminDashboardRoutes(app: Express, requireAuth: any) {
  app.get("/api/admin/daily-pulse", requireAuth, async (req: any, res) => {
    const user = req.user;
    if (user?.role !== "Admin" && !user?.isMasterAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      // ── 1. Missing daily worksheets (crew scheduled today, no submitted worksheet) ──
      const { rows: missingWorksheets } = await pool.query(`
        SELECT DISTINCT
          e.user_id AS user_id,
          TRIM(e.first_name || ' ' || COALESCE(e.last_name, '')) AS employee_name
        FROM job_assignments ja
        JOIN employees e ON e.id = ja.employee_id
        LEFT JOIN route_days rd
          ON rd.employee_id = e.user_id
          AND rd.date = CURRENT_DATE
        WHERE ja.scheduled_date = CURRENT_DATE
          AND e.user_id IS NOT NULL
          AND (rd.id IS NULL OR rd.status NOT IN ('submitted', 'approved'))
        ORDER BY employee_name
      `);

      // ── 2. Jobs ready for invoice (closeout approved, not yet invoiced) ──
      const { rows: readyForInvoice } = await pool.query(`
        SELECT jc.job_id AS id, j.client, j.title
        FROM job_closeouts jc
        JOIN jobs j ON j.id = jc.job_id
        WHERE jc.ready_for_invoice = true
          AND jc.invoice_created = false
        ORDER BY jc.approved_at ASC NULLS LAST
      `);

      // ── 3. Overdue jobs (mirrors Overdue.tsx / ManagerDashboard.tsx logic) ──
      const { rows: overdueJobs } = await pool.query(`
        SELECT id, client, title, scheduled_date, status
        FROM jobs
        WHERE scheduled_date IS NOT NULL
          AND DATE(scheduled_date) < CURRENT_DATE
          AND status IN ('scheduled', 'in_progress', 'sold', 'active')
        ORDER BY scheduled_date ASC
      `);

      // ── 4. Schedule conflicts today (crew / equipment double-booking) ──
      const today = new Date().toISOString().slice(0, 10);
      const { rows: todaysJobs } = await pool.query(`
        SELECT j.id, j.title, j.client, j.scheduled_start_time, j.scheduled_end_time,
               j.crew_lead_id, j.crew_lead_name,
               TRIM(e.first_name || ' ' || COALESCE(e.last_name, '')) AS crew_lead_display_name
        FROM jobs j
        LEFT JOIN employees e ON e.id = j.crew_lead_id
        WHERE DATE(j.scheduled_date) = $1
          AND j.status NOT IN ('completed', 'invoiced', 'cancelled')
      `, [today]);

      const jobIds: string[] = todaysJobs.map((j: any) => j.id);

      let crewRows: any[] = [];
      let equipRows: any[] = [];
      if (jobIds.length) {
        const [{ rows: cRows }, { rows: eRows }] = await Promise.all([
          pool.query(`
            SELECT ja.job_id, ja.employee_id,
                   TRIM(e.first_name || ' ' || COALESCE(e.last_name, '')) AS employee_name
            FROM job_assignments ja
            JOIN employees e ON e.id = ja.employee_id
            WHERE ja.job_id = ANY($1)
          `, [jobIds]),
          pool.query(`
            SELECT jea.job_id, jea.equipment_id, eq.name AS equipment_name
            FROM job_equipment_assignments jea
            JOIN equipment eq ON eq.id = jea.equipment_id
            WHERE jea.job_id = ANY($1)
          `, [jobIds]),
        ]);
        crewRows = cRows;
        equipRows = eRows;
      }

      type EnrichedJob = typeof todaysJobs[0] & {
        crew: { employee_id: string; employee_name: string }[];
        equipment: { equipment_id: string; equipment_name: string }[];
      };
      const jobMap = new Map<string, EnrichedJob>();
      todaysJobs.forEach((j: any) => jobMap.set(j.id, { ...j, crew: [], equipment: [] }));
      crewRows.forEach((row: any) => {
        jobMap.get(row.job_id)?.crew.push({ employee_id: row.employee_id, employee_name: row.employee_name });
      });
      equipRows.forEach((row: any) => {
        jobMap.get(row.job_id)?.equipment.push({ equipment_id: row.equipment_id, equipment_name: row.equipment_name });
      });
      const enrichedJobs = Array.from(jobMap.values());

      const conflicts: { type: "crew" | "equipment"; name: string; description: string }[] = [];

      const empJobMap = new Map<string, { name: string; jobs: EnrichedJob[] }>();
      enrichedJobs.forEach((job) => {
        job.crew.forEach((cm) => {
          if (!empJobMap.has(cm.employee_id)) empJobMap.set(cm.employee_id, { name: cm.employee_name, jobs: [] });
          empJobMap.get(cm.employee_id)!.jobs.push(job);
        });
        if (job.crew_lead_id) {
          const alreadyListed = job.crew.some((c) => c.employee_id === job.crew_lead_id);
          if (!alreadyListed) {
            if (!empJobMap.has(job.crew_lead_id)) {
              empJobMap.set(job.crew_lead_id, { name: job.crew_lead_display_name || job.crew_lead_name || "Unknown", jobs: [] });
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
            if (rangesOverlap(
              timeToMinutes(a.scheduled_start_time), timeToMinutes(a.scheduled_end_time),
              timeToMinutes(b.scheduled_start_time), timeToMinutes(b.scheduled_end_time)
            )) {
              conflicts.push({
                type: "crew",
                name,
                description: `${name} is assigned to ${empJobs.length} jobs today with overlapping times`,
              });
              break outer;
            }
          }
        }
      });

      const eqJobMap = new Map<string, { name: string; jobs: EnrichedJob[] }>();
      enrichedJobs.forEach((job) => {
        job.equipment.forEach((eq) => {
          if (!eqJobMap.has(eq.equipment_id)) eqJobMap.set(eq.equipment_id, { name: eq.equipment_name, jobs: [] });
          eqJobMap.get(eq.equipment_id)!.jobs.push(job);
        });
      });
      eqJobMap.forEach(({ name, jobs: eqJobs }) => {
        if (eqJobs.length < 2) return;
        outer: for (let i = 0; i < eqJobs.length; i++) {
          for (let k = i + 1; k < eqJobs.length; k++) {
            const a = eqJobs[i], b = eqJobs[k];
            if (rangesOverlap(
              timeToMinutes(a.scheduled_start_time), timeToMinutes(a.scheduled_end_time),
              timeToMinutes(b.scheduled_start_time), timeToMinutes(b.scheduled_end_time)
            )) {
              conflicts.push({
                type: "equipment",
                name,
                description: `${name} is assigned to ${eqJobs.length} jobs today with overlapping times`,
              });
              break outer;
            }
          }
        }
      });

      // ── 5. Open work requests needing action ──
      const { rows: openWorkRequests } = await pool.query(`
        SELECT wr.id, wr.title, wr.urgency, wr.created_at,
               COALESCE(u.name, u.username) AS customer_name
        FROM work_requests wr
        LEFT JOIN users u ON u.id = wr.customer_id
        WHERE wr.status = 'pending'
        ORDER BY wr.created_at ASC
      `);

      // ── 6. Behind-schedule jobs ──
      const { rows: behindScheduleJobs } = await pool.query(`
        SELECT id, client, title, scheduled_date, status, progress,
               scheduled_start_time, scheduled_end_time
        FROM jobs
        WHERE (
          (status = 'in_progress' AND COALESCE(progress, 0) < 100
           AND scheduled_date IS NOT NULL
           AND (CASE WHEN scheduled_end_time IS NOT NULL
                     THEN (scheduled_date::date::text || ' ' || scheduled_end_time)::timestamp < NOW()
                     ELSE scheduled_date::date < CURRENT_DATE END))
          OR
          (status = 'scheduled'
           AND scheduled_date IS NOT NULL
           AND (CASE WHEN scheduled_start_time IS NOT NULL
                     THEN (scheduled_date::date::text || ' ' || scheduled_start_time)::timestamp < NOW()
                     ELSE scheduled_date::date < CURRENT_DATE END))
        )
        ORDER BY scheduled_date ASC
      `);

      // ── 7. Overdue follow-ups (customers + leads) ──
      const { rows: overdueFollowUpRows } = await pool.query(`
        SELECT id,
               COALESCE(company_name, first_name || ' ' || last_name) AS name,
               next_follow_up_date,
               'customer' AS type
        FROM customers
        WHERE next_follow_up_date IS NOT NULL
          AND next_follow_up_date < CURRENT_DATE
          AND is_active = true
        UNION ALL
        SELECT id,
               COALESCE(contact_name, 'Unknown Lead') AS name,
               next_follow_up_date,
               'lead' AS type
        FROM consultations
        WHERE next_follow_up_date IS NOT NULL
          AND next_follow_up_date < CURRENT_DATE
          AND pipeline_stage NOT IN ('closed_won', 'closed_lost', 'closed')
        ORDER BY next_follow_up_date ASC
      `);

      res.json({
        date: today,
        missingWorksheets: { count: missingWorksheets.length, items: missingWorksheets },
        readyForInvoice: { count: readyForInvoice.length, items: readyForInvoice },
        overdueJobs: { count: overdueJobs.length, items: overdueJobs },
        scheduleConflicts: { count: conflicts.length, items: conflicts },
        openWorkRequests: { count: openWorkRequests.length, items: openWorkRequests },
        behindScheduleJobs: { count: behindScheduleJobs.length, items: behindScheduleJobs },
        overdueFollowUps: { count: overdueFollowUpRows.length, items: overdueFollowUpRows },
      });
    } catch (err: any) {
      console.error("[admin/daily-pulse]", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
