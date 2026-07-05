import { pool } from "./db";

/**
 * Central gate + hook module for the Automation Center. Every automation
 * defaults to disabled (see server/automationRoutes.ts seed), so none of
 * these hooks do anything until an admin explicitly turns them on.
 *
 * Existing business logic (invoice sending, estimate->job conversion,
 * worksheet alerts) is reused via extracted functions / lazy dynamic
 * imports rather than duplicated here. Dynamic imports are used for
 * invoiceRoutes/estimateRoutes to avoid a circular static-import cycle
 * (those files statically import this module to fire the hooks).
 */

export async function isAutomationEnabled(key: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT enabled FROM automations WHERE key = $1`, [key]);
    return rows[0]?.enabled === true;
  } catch {
    // If the automations table isn't ready yet (e.g. very early boot), fail closed.
    return false;
  }
}

export async function getAutomationConfig(key: string): Promise<Record<string, any>> {
  try {
    const { rows } = await pool.query(`SELECT config FROM automations WHERE key = $1`, [key]);
    return rows[0]?.config ?? {};
  } catch {
    return {};
  }
}

async function touchLastRun(key: string) {
  try {
    await pool.query(`UPDATE automations SET last_run_at = NOW() WHERE key = $1`, [key]);
  } catch {
    // non-critical
  }
}

async function notifyAdmins(type: string, title: string, message: string, link: string, metadata: Record<string, any> = {}) {
  try {
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
  } catch (err: any) {
    console.error(`[automation] notifyAdmins error:`, err.message);
  }
}

/**
 * Fires when a job's status is set to "completed". If the
 * job_completed_send_invoice automation is enabled, finds the job's draft
 * invoice and sends it via the existing (unmodified) send logic. Only acts
 * when there is exactly one draft invoice for the job — ambiguous cases are
 * flagged for admin review instead of guessing.
 */
export async function onJobCompleted(jobId: string): Promise<void> {
  const KEY = "job_completed_send_invoice";
  try {
    if (!(await isAutomationEnabled(KEY))) return;

    const { rows: draftInvoices } = await pool.query(
      `SELECT id, invoice_number FROM invoices WHERE job_id = $1 AND status = 'draft'`,
      [jobId]
    );

    if (draftInvoices.length === 1) {
      const { sendInvoiceById } = await import("./invoiceRoutes");
      await sendInvoiceById(draftInvoices[0].id);
      await notifyAdmins(
        "automation_invoice_sent",
        "Automation: Invoice Auto-Sent",
        `Job completion automation sent invoice ${draftInvoices[0].invoice_number}.`,
        `/invoices/${draftInvoices[0].id}`,
        { jobId, invoiceId: draftInvoices[0].id }
      );
    } else if (draftInvoices.length > 1) {
      await notifyAdmins(
        "automation_needs_review",
        "Automation: Multiple Draft Invoices",
        `Job was completed but has ${draftInvoices.length} draft invoices — please send the correct one manually.`,
        `/jobs/${jobId}`,
        { jobId }
      );
    }
    // 0 draft invoices: nothing to do, no notification needed.

    await touchLastRun(KEY);
  } catch (err: any) {
    console.error(`[automation] onJobCompleted error:`, err.message);
  }
}

/**
 * Fires when an estimate's status becomes "approved" (from either the staff
 * approve route or the public customer portal). If the
 * estimate_approved_create_job automation is enabled, converts the estimate
 * into a job using the existing (unmodified) conversion logic. Idempotent:
 * skips if the estimate has already been converted.
 */
export async function onEstimateApproved(estimateId: string, userId: string | null): Promise<void> {
  const KEY = "estimate_approved_create_job";
  try {
    if (!(await isAutomationEnabled(KEY))) return;

    const { rows } = await pool.query(
      `SELECT status, converted_job_id FROM sales_estimates WHERE id = $1`,
      [estimateId]
    );
    const est = rows[0];
    if (!est || est.status !== "approved" || est.converted_job_id) return;

    const { convertEstimateToJob } = await import("./estimateRoutes");
    const result = await convertEstimateToJob(estimateId, userId);
    if (result) {
      await notifyAdmins(
        "automation_job_created",
        "Automation: Job Auto-Created",
        `Estimate approval automation created job from a newly-approved estimate.`,
        `/jobs/${result.job_id}`,
        { estimateId, jobId: result.job_id }
      );
    }

    await touchLastRun(KEY);
  } catch (err: any) {
    console.error(`[automation] onEstimateApproved error:`, err.message);
  }
}
