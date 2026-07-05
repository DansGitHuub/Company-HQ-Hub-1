import { pool } from "./db";
import { storage } from "./storage";
import { log } from "./index";

// ── Missing daily worksheet -> manager notification scheduler ─────────────
//
// Reuses the EXACT "missing worksheet" definition already used by the Daily
// Pulse admin card (server/adminDashboardRoutes.ts): a crew member is
// scheduled today (job_assignments) but has no route_day for today with
// status 'submitted' or 'approved'.
//
// Runs an hourly check, but only actually acts once per day, after a
// reasonable end-of-day cutoff (6:00 PM America/New_York) — this avoids
// alerting managers first thing in the morning before crews have had a
// chance to do the work. In-app notification only (staff_notifications /
// bell icon) — no email, no SMS, no new delivery channel.

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour
const CUTOFF_HOUR_NY = 18; // 6:00 PM America/New_York
const COMPANY_TIMEZONE = "America/New_York";

let lastRunDateStr: string | null = null;

function getNyHourAndDate(): { hour: number; dateStr: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_TIMEZONE,
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = parseInt(get("hour"), 10);
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  return { hour: hour === 24 ? 0 : hour, dateStr };
}

interface MissingWorksheetRow {
  user_id: string;
  employee_name: string;
}

interface ManagerRow {
  id: string;
  role: string;
  is_master_admin: boolean;
}

async function getMissingWorksheetEmployees(): Promise<MissingWorksheetRow[]> {
  // Duplicated intentionally from server/adminDashboardRoutes.ts so this
  // scheduler never has to modify that read-only aggregation route; logic
  // must stay in lockstep with that file's "missing worksheet" definition.
  const { rows } = await pool.query(`
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
  return rows;
}

async function getManagers(): Promise<ManagerRow[]> {
  const { rows } = await pool.query(`
    SELECT id, role, is_master_admin
    FROM users
    WHERE role IN ('Admin', 'Manager') OR is_master_admin = true
  `);
  return rows;
}

async function alreadyNotifiedToday(managerId: string, employeeUserId: string, dateStr: string): Promise<boolean> {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM staff_notifications
      WHERE user_id = $1
        AND type = 'missing_worksheet'
        AND metadata->>'employeeUserId' = $2
        AND metadata->>'date' = $3
      LIMIT 1
    `,
    [managerId, employeeUserId, dateStr],
  );
  return rows.length > 0;
}

export async function checkMissingWorksheetAlerts(force = false): Promise<{ notified: number; skippedBeforeCutoff: boolean }> {
  const { hour, dateStr } = getNyHourAndDate();

  if (!force) {
    if (hour < CUTOFF_HOUR_NY) {
      return { notified: 0, skippedBeforeCutoff: true };
    }
    if (lastRunDateStr === dateStr) {
      // Already ran today's alert pass.
      return { notified: 0, skippedBeforeCutoff: false };
    }
  }

  try {
    const [missing, managers] = await Promise.all([
      getMissingWorksheetEmployees(),
      getManagers(),
    ]);

    if (missing.length === 0 || managers.length === 0) {
      lastRunDateStr = dateStr;
      return { notified: 0, skippedBeforeCutoff: false };
    }

    let notified = 0;
    for (const employee of missing) {
      for (const manager of managers) {
        // Don't notify a manager about themselves.
        if (manager.id === employee.user_id) continue;

        const already = await alreadyNotifiedToday(manager.id, employee.user_id, dateStr);
        if (already) continue;

        await storage.createStaffNotification({
          userId: manager.id,
          type: "missing_worksheet",
          title: "Missing Daily Worksheet",
          message: `${employee.employee_name} has not submitted their daily worksheet for today.`,
          link: "/worksheet-review",
          metadata: { employeeUserId: employee.user_id, employeeName: employee.employee_name, date: dateStr },
        });
        notified++;
      }
    }

    lastRunDateStr = dateStr;
    if (notified > 0) {
      log(`Worksheet alert scheduler: sent ${notified} missing-worksheet notification(s) for ${missing.length} employee(s)`, "scheduler");
    }
    return { notified, skippedBeforeCutoff: false };
  } catch (err: any) {
    log(`Worksheet alert scheduler error: ${err.message}`, "scheduler");
    return { notified: 0, skippedBeforeCutoff: false };
  }
}

let worksheetAlertInterval: ReturnType<typeof setInterval> | null = null;

async function runIfAutomationEnabled(): Promise<void> {
  // Gated by the Automation Center's "missing_worksheet_daily_check" toggle
  // (default OFF). Does not modify checkMissingWorksheetAlerts() itself.
  try {
    const { isAutomationEnabled } = await import("./automationEngine");
    if (await isAutomationEnabled("missing_worksheet_daily_check")) {
      await checkMissingWorksheetAlerts();
    }
  } catch (err: any) {
    log(`Worksheet alert scheduler gate error: ${err.message}`, "scheduler");
  }
}

export function startWorksheetAlertScheduler(): void {
  if (worksheetAlertInterval) clearInterval(worksheetAlertInterval);

  log(`Worksheet alert scheduler started (checking every hour, fires once daily after 6:00 PM ${COMPANY_TIMEZONE}, gated by Automation Center)`, "scheduler");

  setTimeout(() => { runIfAutomationEnabled(); }, 30_000);
  worksheetAlertInterval = setInterval(() => { runIfAutomationEnabled(); }, CHECK_INTERVAL_MS);
}

export function stopWorksheetAlertScheduler(): void {
  if (worksheetAlertInterval) {
    clearInterval(worksheetAlertInterval);
    worksheetAlertInterval = null;
    log("Worksheet alert scheduler stopped", "scheduler");
  }
}
