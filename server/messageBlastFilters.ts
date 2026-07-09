import { pool } from "./db";

export interface MessageBlastFilters {
  service_type?: string[];
  job_status?: string[];
  scheduled_between?: { from?: string; to?: string };
  overdue_invoice?: boolean;
  division?: string[];
  customer_ids?: string[];
}

export interface ResolvedRecipient {
  id: string;
  name: string;
  email: string | null;
  job_title: string | null;
  scheduled_date: string | null;
  completion_date: string | null;
  invoice_amount: string | null;
  due_date: string | null;
}

export function resolveRecipientsQuery(filters: MessageBlastFilters): { text: string; params: any[] } {
  const conditions: string[] = ["c.is_active = true"];
  const params: any[] = [];
  let joinJobs = false;
  let joinInvoices = false;

  if (filters.customer_ids?.length) {
    params.push(filters.customer_ids);
    conditions.push(`c.id = ANY($${params.length})`);
  }
  if (filters.service_type?.length) {
    joinJobs = true;
    params.push(filters.service_type);
    conditions.push(`j.type = ANY($${params.length})`);
  }
  if (filters.job_status?.length) {
    joinJobs = true;
    params.push(filters.job_status);
    conditions.push(`j.status = ANY($${params.length})`);
  }
  if (filters.division?.length) {
    joinJobs = true;
    params.push(filters.division);
    conditions.push(`j.division = ANY($${params.length})`);
  }
  if (filters.scheduled_between?.from) {
    joinJobs = true;
    params.push(filters.scheduled_between.from);
    conditions.push(`j.scheduled_date >= $${params.length}`);
  }
  if (filters.scheduled_between?.to) {
    joinJobs = true;
    params.push(filters.scheduled_between.to);
    conditions.push(`j.scheduled_date <= $${params.length}`);
  }
  if (filters.overdue_invoice) {
    joinInvoices = true;
    conditions.push(`i.due_date < CURRENT_DATE AND i.status NOT IN ('paid','void')`);
  }

  let query = `
    SELECT DISTINCT ON (c.id)
      c.id AS id,
      COALESCE(NULLIF(c.company_name, ''), TRIM(CONCAT(c.first_name, ' ', c.last_name))) AS name,
      ce.email AS email,
      ${joinJobs ? "j.type" : "NULL"} AS job_title,
      ${joinJobs ? "j.scheduled_date" : "NULL"} AS scheduled_date,
      ${joinJobs ? "j.completion_date" : "NULL"} AS completion_date,
      ${joinInvoices ? "i.total" : "NULL"} AS invoice_amount,
      ${joinInvoices ? "i.due_date" : "NULL"} AS due_date
    FROM customers c
    LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
  `;
  if (joinJobs) query += ` LEFT JOIN jobs j ON j.customer_id = c.id `;
  if (joinInvoices) query += ` LEFT JOIN invoices i ON i.customer_id = c.id `;
  query += ` WHERE ${conditions.join(" AND ")} AND ce.email IS NOT NULL`;

  const orderTerms = ["c.id"];
  if (joinJobs) orderTerms.push("j.scheduled_date DESC NULLS LAST");
  if (joinInvoices) orderTerms.push("i.due_date DESC NULLS LAST");
  query += ` ORDER BY ${orderTerms.join(", ")}`;

  return { text: query, params };
}

export async function resolveRecipients(filters: MessageBlastFilters): Promise<ResolvedRecipient[]> {
  const { text, params } = resolveRecipientsQuery(filters);
  const { rows } = await pool.query(text, params);
  return rows;
}
