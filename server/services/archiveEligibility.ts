import { pool } from "../db";

export type BlockerRecord = { id: string; label: string; href: string };

export type Blocker = {
  type: "job" | "estimate" | "consultation" | "invoice";
  count: number;
  reason: string;
  records: BlockerRecord[];
};

export type Eligibility =
  | { canArchive: true }
  | { canArchive: false; blockers: Blocker[] };

const RECORDS_LIMIT = 5;

export async function customerArchiveEligibility(
  customerId: string
): Promise<Eligibility> {
  const blockers: Blocker[] = [];

  // ── Jobs ──────────────────────────────────────────────────────────────────
  // Blocking stages: anything that is NOT a terminal state.
  // Uses both "Completed" and "Complete" because the app has used both historically.
  const { rows: jobRows } = await pool.query<{
    id: string;
    client: string;
    stage: string;
    total: string;
  }>(
    `SELECT id, client, stage, COUNT(*) OVER () AS total
     FROM jobs
     WHERE customer_id = $1
       AND stage NOT IN ('Completed', 'Complete', 'Cancelled', 'Archived')
     LIMIT $2`,
    [customerId, RECORDS_LIMIT]
  );

  const jobTotal = jobRows.length > 0 ? parseInt(jobRows[0].total, 10) : 0;
  if (jobTotal > 0) {
    blockers.push({
      type: "job",
      count: jobTotal,
      reason: "open jobs",
      records: jobRows.map((r) => ({
        id: r.id,
        label: `${r.client} (${r.stage})`,
        href: `/jobs/${r.id}`,
      })),
    });
  }

  // ── Sales Estimates ───────────────────────────────────────────────────────
  // Terminal statuses: converted, declined, expired, archived.
  // All other statuses (draft, sent, viewed, approved) are blocking.
  const { rows: estRows } = await pool.query<{
    id: string;
    estimate_number: string;
    status: string;
    total: string;
  }>(
    `SELECT id, estimate_number, status, COUNT(*) OVER () AS total
     FROM sales_estimates
     WHERE customer_id = $1
       AND status NOT IN ('converted', 'declined', 'expired', 'archived')
     LIMIT $2`,
    [customerId, RECORDS_LIMIT]
  );

  const estTotal = estRows.length > 0 ? parseInt(estRows[0].total, 10) : 0;
  if (estTotal > 0) {
    blockers.push({
      type: "estimate",
      count: estTotal,
      reason: "open estimates",
      records: estRows.map((r) => ({
        id: r.id,
        label: `${r.estimate_number} (${r.status})`,
        href: `/estimates/${r.id}`,
      })),
    });
  }

  // ── Consultations ─────────────────────────────────────────────────────────
  // DB status CHECK constraint: 'scheduled' | 'completed' | 'cancelled' | 'no_show'.
  // Only 'scheduled' consultations are open/unresolved.
  const { rows: consultRows } = await pool.query<{
    id: string;
    contact_name: string | null;
    scheduled_date: string | null;
    total: string;
  }>(
    `SELECT id, contact_name, scheduled_date::text, COUNT(*) OVER () AS total
     FROM consultations
     WHERE customer_id = $1::uuid
       AND status = 'scheduled'
     LIMIT $2`,
    [customerId, RECORDS_LIMIT]
  );

  const consultTotal =
    consultRows.length > 0 ? parseInt(consultRows[0].total, 10) : 0;
  if (consultTotal > 0) {
    blockers.push({
      type: "consultation",
      count: consultTotal,
      reason: "scheduled consultations",
      records: consultRows.map((r) => ({
        id: r.id,
        label: r.contact_name
          ? `${r.contact_name}${r.scheduled_date ? ` — ${r.scheduled_date}` : ""}`
          : `Consultation${r.scheduled_date ? ` — ${r.scheduled_date}` : ""}`,
        href: `/consultations?id=${r.id}`,
      })),
    });
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  // Blocking: any positive balance OR status still active (sent / draft).
  const { rows: invRows } = await pool.query<{
    id: string;
    invoice_number: string;
    status: string;
    balance_due: string;
    total: string;
  }>(
    `SELECT id, invoice_number, status, balance_due::text, COUNT(*) OVER () AS total
     FROM invoices
     WHERE customer_id = $1::uuid
       AND (balance_due::numeric > 0 OR status IN ('sent', 'draft'))
     LIMIT $2`,
    [customerId, RECORDS_LIMIT]
  );

  const invTotal = invRows.length > 0 ? parseInt(invRows[0].total, 10) : 0;
  if (invTotal > 0) {
    blockers.push({
      type: "invoice",
      count: invTotal,
      reason: "unpaid invoices",
      records: invRows.map((r) => ({
        id: r.id,
        label: `${r.invoice_number} — $${parseFloat(r.balance_due).toFixed(2)} due (${r.status})`,
        href: `/invoices/${r.id}`,
      })),
    });
  }

  if (blockers.length === 0) return { canArchive: true };
  return { canArchive: false, blockers };
}
