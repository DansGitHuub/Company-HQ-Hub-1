import { pool } from "./db";
import { v4 as uuidv4 } from "uuid";
import { log } from "./index";

// ── Constants ─────────────────────────────────────────────────────────────────

const LOOKAHEAD_DAYS = 14;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteRow {
  id: string;
  cadence: string;
  interval_days: number | null;
  days_of_week: string[] | null;
  season_start: string | null;
  season_end: string | null;
  assigned_crew_id: string | null;
  created_at: Date;
}

// ── Cadence helpers ───────────────────────────────────────────────────────────

function inSeason(d: Date, seasonStart: string | null, seasonEnd: string | null): boolean {
  if (!seasonStart && !seasonEnd) return true;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mmdd = `${mm}-${dd}`;
  const start = seasonStart ?? "01-01";
  const end = seasonEnd ?? "12-31";
  if (start <= end) {
    return mmdd >= start && mmdd <= end;
  }
  // Year-wrap (e.g., season Nov–Mar)
  return mmdd >= start || mmdd <= end;
}

function matchesDayOfWeek(d: Date, daysOfWeek: string[] | null): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) return false;
  const name = DAY_NAMES[d.getDay()];
  return daysOfWeek.some(
    (day) => day === name || day.toLowerCase() === name.toLowerCase()
  );
}

function getWeekMonday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  r.setDate(r.getDate() + (dow === 0 ? -6 : 1 - dow));
  return r;
}

function isOnBiWeeklySlot(d: Date, ref: Date): boolean {
  const refMonday = getWeekMonday(ref);
  const thisMonday = getWeekMonday(d);
  const msDiff = thisMonday.getTime() - refMonday.getTime();
  const weeksDiff = Math.round(msDiff / (7 * 24 * 60 * 60 * 1000));
  return weeksDiff % 2 === 0;
}

function getVisitDatesInWindow(
  route: RouteRow,
  windowStart: Date,
  windowEnd: Date,
  lastVisitDate: Date | null
): string[] {
  const dates: string[] = [];
  const cadence = route.cadence || "weekly";
  const daysOfWeek = route.days_of_week;

  const ref = new Date(lastVisitDate ?? route.created_at);
  ref.setHours(0, 0, 0, 0);

  const current = new Date(windowStart);
  current.setHours(0, 0, 0, 0);

  while (current <= windowEnd) {
    if (inSeason(current, route.season_start, route.season_end)) {
      let include = false;

      if (cadence === "weekly") {
        include = matchesDayOfWeek(current, daysOfWeek);
      } else if (cadence === "bi-weekly") {
        include = matchesDayOfWeek(current, daysOfWeek) && isOnBiWeeklySlot(current, ref);
      } else if (cadence === "custom" && route.interval_days && route.interval_days > 0) {
        const daysDiff = Math.round(
          (current.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000)
        );
        include = daysDiff >= 0 && daysDiff % route.interval_days === 0;
      }

      if (include) {
        dates.push(current.toISOString().slice(0, 10));
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * For every active maintenance route, materialise maintenance_route_visits rows
 * covering today through today + LOOKAHEAD_DAYS.
 *
 * Idempotent: the unique constraint on (route_id, visit_date) means
 * ON CONFLICT DO NOTHING skips rows that already exist.
 * Re-running is always safe.
 */
export async function generateUpcomingVisits(): Promise<{ inserted: number; routes: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + LOOKAHEAD_DAYS - 1);

  const { rows: routes } = await pool.query<RouteRow>(`
    SELECT id, cadence, interval_days, days_of_week,
           season_start, season_end, assigned_crew_id, created_at
    FROM maintenance_routes
    WHERE is_active = true
  `);

  let totalInserted = 0;

  for (const route of routes) {
    // Latest existing visit date — anchor for bi-weekly/custom alignment
    const { rows: lastRows } = await pool.query<{ visit_date: string }>(
      `SELECT visit_date FROM maintenance_route_visits
       WHERE route_id = $1
       ORDER BY visit_date DESC
       LIMIT 1`,
      [route.id]
    );
    const lastVisitDate = lastRows[0]?.visit_date ? new Date(lastRows[0].visit_date) : null;

    const visitDates = getVisitDatesInWindow(route, today, windowEnd, lastVisitDate);

    for (const dateStr of visitDates) {
      const result = await pool.query(
        `INSERT INTO maintenance_route_visits
           (id, route_id, visit_date, assigned_crew_id, status)
         VALUES ($1, $2, $3, $4, 'scheduled')
         ON CONFLICT (route_id, visit_date) DO NOTHING`,
        [uuidv4(), route.id, dateStr, route.assigned_crew_id]
      );
      totalInserted += result.rowCount ?? 0;
    }
  }

  return { inserted: totalInserted, routes: routes.length };
}

// ── Daily cron ────────────────────────────────────────────────────────────────

async function runVisitGeneration(): Promise<void> {
  try {
    const { inserted, routes } = await generateUpcomingVisits();
    if (routes > 0) {
      log(
        `Maintenance visit generator: ${routes} active route(s), ${inserted} new visit(s) created`,
        "scheduler"
      );
    }
  } catch (err: any) {
    log(`Maintenance visit generator error: ${err.message}`, "scheduler");
  }
}

let visitInterval: ReturnType<typeof setInterval> | null = null;

export function startMaintenanceVisitScheduler() {
  if (visitInterval) clearInterval(visitInterval);

  log(
    `Maintenance visit scheduler started (daily, ${LOOKAHEAD_DAYS}-day look-ahead)`,
    "scheduler"
  );

  // Run 45 s after boot so DB is fully ready, then every 24 h
  setTimeout(runVisitGeneration, 45_000);
  visitInterval = setInterval(runVisitGeneration, CHECK_INTERVAL_MS);
}

export function stopMaintenanceVisitScheduler() {
  if (visitInterval) {
    clearInterval(visitInterval);
    visitInterval = null;
    log("Maintenance visit scheduler stopped", "scheduler");
  }
}
