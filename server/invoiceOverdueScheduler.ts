import { pool } from "./db";
import { log } from "./index";
import { sendEmail, escapeHtml } from "./emailService";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

// ── status sweep ──────────────────────────────────────────────────────────────

/**
 * Mark invoices as overdue when:
 *  - due_date is set AND in the past
 *  - balance_due > 0
 *  - status is one of sent/viewed/accepted/changes_requested
 *    (excludes already-overdue, paid, draft, declined, void)
 *
 * Idempotent — safe to run repeatedly.
 */
async function markOverdueInvoices(): Promise<number> {
  const result = await pool.query(`
    UPDATE invoices
    SET status = 'overdue', updated_at = NOW()
    WHERE due_date IS NOT NULL
      AND due_date < CURRENT_DATE
      AND balance_due > 0
      AND status IN ('sent', 'viewed', 'accepted', 'changes_requested')
  `);
  return result.rowCount ?? 0;
}

// ── overdue email notifications ───────────────────────────────────────────────

interface OverdueRow {
  id: string;
  invoice_number: string;
  balance_due: string;
  total: string;
  due_date: string;
  cust_name: string;
}

function fmtMoney(v: string) {
  const n = parseFloat(v ?? "0");
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function buildOverdueEmailHtml(inv: OverdueRow): string {
  const due = fmtDate(inv.due_date);
  const balance = fmtMoney(inv.balance_due);
  const total = fmtMoney(inv.total);
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#991b1b;padding:20px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:20px;">Company HQ</h1>
        <p style="color:#fca5a5;margin:4px 0 0;font-size:13px;">Invoice Overdue Notice</p>
      </div>
      <div style="padding:28px;background:#f9fafb;">
        <h2 style="color:#1f2937;margin:0 0 12px;">Invoice Overdue</h2>
        <p style="color:#4b5563;">The following invoice has passed its due date and has an outstanding balance:</p>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:140px;">Invoice #</td>
              <td style="padding:6px 0;color:#1f2937;font-weight:600;">${escapeHtml(inv.invoice_number)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Customer</td>
              <td style="padding:6px 0;color:#1f2937;">${escapeHtml(inv.cust_name)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Due Date</td>
              <td style="padding:6px 0;color:#dc2626;font-weight:600;">${escapeHtml(due)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Invoice Total</td>
              <td style="padding:6px 0;color:#1f2937;">${escapeHtml(total)}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="padding:10px 0 0;color:#6b7280;font-weight:600;">Balance Due</td>
              <td style="padding:10px 0 0;color:#dc2626;font-weight:700;font-size:16px;">${escapeHtml(balance)}</td>
            </tr>
          </table>
        </div>
        <p style="color:#4b5563;font-size:13px;">Please follow up with the customer at your earliest convenience.</p>
      </div>
      <div style="padding:16px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;">Company HQ · Chapin Landscapes</p>
      </div>
    </div>
  `;
}

/**
 * Send one notification email per newly-overdue invoice (no overdue_email_sent_at set).
 * Marks overdue_email_sent_at = NOW() after each send, regardless of delivery success,
 * so a transient send error doesn't flood dan with retries on the next cron run.
 * All sends go through emailService redirect/API-key guard — no real customer addresses needed.
 */
async function sendOverdueNotifications(): Promise<void> {
  const notifyTo = process.env.FROM_EMAIL || "dan@chapinlandscapes.com";

  const { rows } = await pool.query<OverdueRow>(`
    SELECT
      i.id,
      i.invoice_number,
      i.balance_due::text,
      i.total::text,
      i.due_date::text,
      COALESCE(
        NULLIF(TRIM(c.company_name), ''),
        NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''),
        'Unknown Customer'
      ) AS cust_name
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.status = 'overdue'
      AND i.overdue_email_sent_at IS NULL
    ORDER BY i.due_date ASC
  `);

  if (rows.length === 0) return;

  log(`Invoice overdue notifications: ${rows.length} invoice(s) to notify`, "scheduler");

  for (const inv of rows) {
    const subject = `Invoice Overdue — ${inv.invoice_number} · ${
      inv.cust_name
    } · Balance ${fmtMoney(inv.balance_due)}`;

    await sendEmail(notifyTo, subject, buildOverdueEmailHtml(inv));

    // Mark sent regardless of delivery — prevents re-sending on next cron run
    await pool.query(
      `UPDATE invoices SET overdue_email_sent_at = NOW() WHERE id = $1`,
      [inv.id]
    );
  }

  log(`Invoice overdue notifications: sent ${rows.length} notification(s)`, "scheduler");
}

// ── scheduler ─────────────────────────────────────────────────────────────────

async function runOverdueSweep(): Promise<void> {
  try {
    const marked = await markOverdueInvoices();
    if (marked > 0) {
      log(`Invoice overdue sweep: marked ${marked} invoice(s) as overdue`, "scheduler");
    }
    await sendOverdueNotifications();
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
  setTimeout(runOverdueSweep, 30 * 1000);
  overdueInterval = setInterval(runOverdueSweep, CHECK_INTERVAL_MS);
}

export function stopInvoiceOverdueScheduler() {
  if (overdueInterval) {
    clearInterval(overdueInterval);
    overdueInterval = null;
    log("Invoice overdue scheduler stopped", "scheduler");
  }
}
