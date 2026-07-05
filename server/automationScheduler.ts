import { pool } from "./db";
import { log } from "./index";
import { isAutomationEnabled, getAutomationConfig } from "./automationEngine";

/**
 * Automation Center's own daily-tick scheduler for the two automations that
 * have no pre-existing home elsewhere in the codebase:
 *   - invoice_late_fee_flagging (admin-only, in-app notification, never emails a customer)
 *   - recurring_job_generation (clones a customer's prior job as a template)
 *
 * Both default OFF (see server/automationRoutes.ts seed) and are re-checked
 * every hour, but each only actually executes once per calendar day (guarded
 * by the automations.last_run_at column) so re-running the interval doesn't
 * spam duplicate notifications/jobs.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly tick, daily-guarded execution

async function hasRunToday(key: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT last_run_at FROM automations WHERE key = $1`, [key]);
  const lastRun = rows[0]?.last_run_at;
  if (!lastRun) return false;
  const today = new Date().toISOString().split("T")[0];
  const lastRunDate = new Date(lastRun).toISOString().split("T")[0];
  return today === lastRunDate;
}

async function touchLastRun(key: string) {
  await pool.query(`UPDATE automations SET last_run_at = NOW() WHERE key = $1`, [key]);
}

async function notifyAdmins(type: string, title: string, message: string, link: string, metadata: Record<string, any> = {}) {
  const { rows: admins } = await pool.query(
    `SELECT id FROM users WHERE role IN ('Admin', 'Master Admin') OR is_master_admin = true`
  );
  for (const admin of admins) {
    await pool.query(
      `INSERT INTO staff_notifications (user_id, type, title, message, link, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [admin.id, type, title, message, link, JSON.stringify(metadata)]
    );
  }
}

/**
 * Flags invoices that are past the configured late-fee grace period.
 * In-app admin notification only — never contacts the customer.
 */
export async function checkLateFeeFlagging(): Promise<void> {
  const KEY = "invoice_late_fee_flagging";
  try {
    if (!(await isAutomationEnabled(KEY))) return;
    if (await hasRunToday(KEY)) return;

    const { rows: ruleRows } = await pool.query(
      `SELECT value FROM business_rules WHERE key = 'late_fee_grace_period_days'`
    );
    const graceDays = parseInt(ruleRows[0]?.value ?? "10", 10);

    const { rows: overdue } = await pool.query(
      `SELECT i.id, i.invoice_number, i.due_date, i.balance_due,
              COALESCE(NULLIF(TRIM(c.company_name),''), NULLIF(TRIM(c.first_name || ' ' || c.last_name),''), 'Unknown Customer') AS customer_name,
              (CURRENT_DATE - i.due_date) AS days_overdue
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.status NOT IN ('paid', 'draft', 'void')
         AND COALESCE(i.balance_due, 0)::numeric > 0
         AND i.due_date IS NOT NULL
         AND (CURRENT_DATE - i.due_date) > $1`,
      [graceDays]
    );

    let flagged = 0;
    for (const inv of overdue) {
      const { rows: already } = await pool.query(
        `SELECT 1 FROM staff_notifications
         WHERE type = 'automation_late_fee_flag'
           AND metadata->>'invoiceId' = $1
           AND created_at::date = CURRENT_DATE
         LIMIT 1`,
        [inv.id]
      );
      if (already.length > 0) continue;

      await notifyAdmins(
        "automation_late_fee_flag",
        "Automation: Invoice Past Grace Period",
        `Invoice ${inv.invoice_number} (${inv.customer_name}) is ${inv.days_overdue} day(s) overdue, beyond the ${graceDays}-day grace period. Review for a late fee.`,
        `/invoices/${inv.id}`,
        { invoiceId: inv.id, daysOverdue: inv.days_overdue }
      );
      flagged++;
    }

    if (flagged > 0) log(`Automation: flagged ${flagged} invoice(s) past the late-fee grace period`, "scheduler");
    await touchLastRun(KEY);
  } catch (err: any) {
    log(`Automation late-fee flagging error: ${err.message}`, "scheduler");
  }
}

/**
 * For flagged recurring customers, clones their most recently completed job
 * (as a template) into a new job a configurable number of days before that
 * prior job's completion date. Idempotent: skips a customer if a newer job
 * already exists after the template job.
 */
export async function checkRecurringJobGeneration(): Promise<void> {
  const KEY = "recurring_job_generation";
  try {
    if (!(await isAutomationEnabled(KEY))) return;
    if (await hasRunToday(KEY)) return;

    const config = await getAutomationConfig(KEY);
    const daysBefore = Number(config.daysBefore) > 0 ? Number(config.daysBefore) : 7;
    const customerIds: string[] = Array.isArray(config.customerIds) ? config.customerIds : [];

    let generated = 0;
    for (const customerId of customerIds) {
      const { rows: templateRows } = await pool.query(
        `SELECT * FROM jobs
         WHERE customer_id = $1 AND completion_date IS NOT NULL
         ORDER BY completion_date DESC LIMIT 1`,
        [customerId]
      );
      const template = templateRows[0];
      if (!template) continue;

      const daysUntil = Math.floor(
        (new Date(template.completion_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil > daysBefore) continue; // not time yet

      // Idempotency: skip if a job already exists for this customer created after the template's completion.
      const { rows: newerJob } = await pool.query(
        `SELECT 1 FROM jobs WHERE customer_id = $1 AND created_at > $2 LIMIT 1`,
        [customerId, template.completion_date]
      );
      if (newerJob.length > 0) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows: newJobRows } = await client.query(
          `INSERT INTO jobs (title, client, type, category, customer_id, property_id, status, stage, price, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'lead', 'Lead', $7, $8, NOW(), NOW()) RETURNING id`,
          [
            template.title || template.client,
            template.client,
            template.type,
            template.category,
            template.customer_id,
            template.property_id,
            template.price,
            `Auto-generated recurring job (template: job ${template.id})`,
          ]
        );
        const newJobId = newJobRows[0].id;

        const { rows: workAreas } = await client.query(
          `SELECT * FROM job_work_areas WHERE job_id = $1`,
          [template.id]
        );
        for (const wa of workAreas) {
          const { rows: newWaRows } = await client.query(
            `INSERT INTO job_work_areas (job_id, work_area_type_id, name, estimated_hours, status, sort_order, notes, is_active)
             VALUES ($1, $2, $3, $4, 'pending', $5, $6, true) RETURNING id`,
            [newJobId, wa.work_area_type_id, wa.name, wa.estimated_hours, wa.sort_order, wa.notes]
          );
          const newWaId = newWaRows[0].id;

          const { rows: lineItems } = await client.query(
            `SELECT * FROM job_line_items WHERE job_work_area_id = $1`,
            [wa.id]
          );
          for (const li of lineItems) {
            await client.query(
              `INSERT INTO job_line_items
                 (job_id, job_work_area_id, item_type, catalog_item_id, class_id, item_name,
                  quantity, unit, unit_price, line_total, sort_order, is_optional, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [
                newJobId, newWaId, li.item_type, li.catalog_item_id, li.class_id, li.item_name,
                li.quantity, li.unit, li.unit_price, li.line_total, li.sort_order, li.is_optional,
                `Auto-generated from recurring job automation (template job ${template.id})`,
              ]
            );
          }
        }

        await client.query("COMMIT");

        await notifyAdmins(
          "automation_recurring_job_created",
          "Automation: Recurring Job Created",
          `A new recurring job was auto-created for a customer, ${daysBefore} day(s) ahead of the prior job's completion date.`,
          `/jobs/${newJobId}`,
          { customerId, newJobId, templateJobId: template.id }
        );
        generated++;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    if (generated > 0) log(`Automation: generated ${generated} recurring job(s)`, "scheduler");
    await touchLastRun(KEY);
  } catch (err: any) {
    log(`Automation recurring job generation error: ${err.message}`, "scheduler");
  }
}

let automationSchedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startAutomationScheduler(): void {
  if (automationSchedulerInterval) clearInterval(automationSchedulerInterval);

  log("Automation Center scheduler started (checking hourly, gated automations run at most once/day)", "scheduler");

  const tick = () => {
    checkLateFeeFlagging();
    checkRecurringJobGeneration();
  };

  setTimeout(tick, 45_000);
  automationSchedulerInterval = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopAutomationScheduler(): void {
  if (automationSchedulerInterval) {
    clearInterval(automationSchedulerInterval);
    automationSchedulerInterval = null;
    log("Automation Center scheduler stopped", "scheduler");
  }
}
