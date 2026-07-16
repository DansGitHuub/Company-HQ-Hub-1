/**
 * notificationTriggers.ts
 *
 * B.2 Notification Center — three new trigger implementations:
 *   1. checkJobBudget   — job_over_budget: fires when logged costs > budget_amount
 *   2. triggerWeatherDelay — weather_delay: admin marks a job weather-delayed
 *   3. dispatchToRole   — helper used by payroll_ready and other role-based triggers
 *
 * All three use the central dispatchNotification() dispatcher, which respects
 * company defaults + per-user overrides and routes to immediate/digest/off.
 */
import { pool } from "./db";
import { dispatchNotification } from "./notificationDispatcher";

// ── Helper: dispatch to all users with a given role ───────────────────────────
export async function dispatchToRole(
  type: string,
  roles: string[],
  payload: { title: string; message: string; link?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  try {
    const placeholders = roles.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: users } = await pool.query(
      `SELECT id::text AS id, email FROM users WHERE role IN (${placeholders}) OR is_master_admin = true`,
      roles
    );
    await Promise.all(
      users.map((u: any) =>
        dispatchNotification({
          type,
          userId: u.id,
          recipientEmail: u.email ?? undefined,
          ...payload,
        })
      )
    );
  } catch (e: any) {
    console.error(`[notif-trigger] dispatchToRole(${type}):`, e.message);
  }
}

// ── 1. Job Over Budget ────────────────────────────────────────────────────────
// Called after any cost-changing event on a job (materials added, time logged).
// Only fires once per day per job to avoid spam.
export async function checkJobBudget(jobId: string): Promise<void> {
  try {
    const jobR = await pool.query(
      `SELECT id, type, client, budget_amount,
              assigned_to, manager_id
       FROM jobs WHERE id = $1 LIMIT 1`,
      [jobId]
    );
    if (!jobR.rows.length) return;
    const job = jobR.rows[0];
    if (!job.budget_amount || parseFloat(job.budget_amount) <= 0) return;

    // Compute total cost: job_line_items (if exists) + job_materials + time entries
    const costsR = await pool.query(
      `SELECT
         COALESCE(
           (SELECT SUM(COALESCE(unit_cost,0) * COALESCE(quantity,1))
            FROM job_line_items WHERE job_id = $1), 0
         )
         +
         COALESCE(
           (SELECT SUM(COALESCE(cost,0) * COALESCE(quantity,1))
            FROM job_materials WHERE job_id = $1), 0
         ) AS total_cost,
         COALESCE(
           (SELECT SUM(duration_minutes) / 60.0
            FROM time_entries WHERE job_id = $1 AND clock_out IS NOT NULL), 0
         ) AS labor_hours`,
      [jobId]
    );
    const { total_cost, labor_hours } = costsR.rows[0];
    const totalCost = parseFloat(total_cost || "0");
    const totalWithLabor = totalCost; // Labor rate would need configuration; omitting for now
    if (totalWithLabor <= parseFloat(job.budget_amount)) return;

    // Deduplicate: only notify once per day per job
    const dedupR = await pool.query(
      `SELECT 1 FROM staff_notifications
       WHERE type = 'job_over_budget'
         AND metadata::jsonb->>'job_id' = $1
         AND created_at >= NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [jobId]
    );
    if (dedupR.rows.length) return;

    // Notify all Admin/Manager users
    const { rows: managers } = await pool.query(
      `SELECT id::text AS id, email FROM users
       WHERE role IN ('Admin', 'Manager') OR is_master_admin = true`
    );

    const overage = (totalWithLabor - parseFloat(job.budget_amount)).toFixed(2);
    const title = "Job Over Budget";
    const message = `Job "${job.type || `#${jobId}`}" (${job.client || "—"}) has exceeded its budget by $${overage}. Budget: $${parseFloat(job.budget_amount).toFixed(2)}, Actual: $${totalWithLabor.toFixed(2)}.`;
    const link = `/jobs/${jobId}`;

    await Promise.all(
      managers.map((u: any) =>
        dispatchNotification({
          type: "job_over_budget",
          userId: u.id,
          recipientEmail: u.email ?? undefined,
          title,
          message,
          link,
          metadata: { job_id: jobId, overage, budget: job.budget_amount },
        })
      )
    );
  } catch (e: any) {
    // Silently handle if job_line_items or job_materials tables don't exist
    if (!e.message?.includes("does not exist")) {
      console.error("[notif-trigger] checkJobBudget:", e.message);
    }
  }
}

// ── 2. Weather Delay ──────────────────────────────────────────────────────────
interface WeatherDelayOptions {
  jobId: string;
  jobTitle: string;
  notifyCustomer?: boolean;
  customMessage?: string;
  actingUserId: string;
}

export async function triggerWeatherDelay(opts: WeatherDelayOptions): Promise<void> {
  try {
    const { jobId, jobTitle, notifyCustomer, customMessage, actingUserId } = opts;
    const defaultMsg = customMessage || `${jobTitle} has been delayed due to weather conditions. We will reach out to reschedule as soon as possible.`;

    // Notify all Admin/Manager users
    const { rows: managers } = await pool.query(
      `SELECT id::text AS id, email FROM users
       WHERE role IN ('Admin', 'Manager') OR is_master_admin = true`
    );
    await Promise.all(
      managers.map((u: any) =>
        dispatchNotification({
          type: "weather_delay",
          userId: u.id,
          recipientEmail: u.email ?? undefined,
          title: "Job Weather Delay",
          message: `${jobTitle} has been marked as weather-delayed.`,
          link: `/jobs/${jobId}`,
          metadata: { job_id: jobId, acting_user: actingUserId },
        })
      )
    );

    // Optionally notify customer (uses staff_notification in-app for any linked user)
    if (notifyCustomer) {
      const custR = await pool.query(
        `SELECT u.id::text AS id, u.email
         FROM jobs j
         JOIN customers c ON c.id = j.customer_id
         JOIN users u ON u.email = c.email
         WHERE j.id = $1 LIMIT 1`,
        [jobId]
      );
      if (custR.rows[0]) {
        await dispatchNotification({
          type: "weather_delay",
          userId: custR.rows[0].id,
          recipientEmail: custR.rows[0].email ?? undefined,
          title: "Schedule Update — Weather Delay",
          message: defaultMsg,
          link: `/customer/jobs/${jobId}`,
          metadata: { job_id: jobId },
        });
      }
    }
  } catch (e: any) {
    console.error("[notif-trigger] triggerWeatherDelay:", e.message);
  }
}
