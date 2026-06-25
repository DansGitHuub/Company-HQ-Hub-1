import { pool } from "./db";
import { log } from "./index";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

/**
 * Mark invoices as overdue when:
 *  - due_date is set AND in the past
 *  - balance_due > 0
 *  - status is one of sent/viewed/accepted (not already overdue/paid/draft/declined/void)
 *
 * Idempotent — safe to run repeatedly.
 */
async function markOverdueInvoices(): Promise<void> {
  try {
    const result = await pool.query(`
      UPDATE invoices
      SET status = 'overdue', updated_at = NOW()
      WHERE due_date IS NOT NULL
        AND due_date < CURRENT_DATE
        AND balance_due > 0
        AND status IN ('sent', 'viewed', 'accepted', 'changes_requested')
    `);
    const updated = result.rowCount ?? 0;
    if (updated > 0) {
      log(`Invoice overdue sweep: marked ${updated} invoice(s) as overdue`, "scheduler");
    }
  } catch (err: any) {
    log(`Invoice overdue sweep error: ${err.message}`, "scheduler");
  }
}

let overdueInterval: ReturnType<typeof setInterval> | null = null;

export function startInvoiceOverdueScheduler() {
  if (overdueInterval) {
    clearInterval(overdueInterval);
  }

  log("Invoice overdue scheduler started (running daily)", "scheduler");

  // Run once shortly after boot, then every 24 h
  setTimeout(markOverdueInvoices, 30 * 1000);
  overdueInterval = setInterval(markOverdueInvoices, CHECK_INTERVAL_MS);
}

export function stopInvoiceOverdueScheduler() {
  if (overdueInterval) {
    clearInterval(overdueInterval);
    overdueInterval = null;
    log("Invoice overdue scheduler stopped", "scheduler");
  }
}
