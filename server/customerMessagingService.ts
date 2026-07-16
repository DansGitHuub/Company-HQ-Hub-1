import { pool } from "./db";
import { sendEmail, getAppUrl } from "./emailService";
import { sendSms } from "./smsService";
import { storage } from "./storage";

export type MessageChannel = "portal" | "email" | "sms" | "none";

export interface ReachableCustomer {
  customerId: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  channel: MessageChannel;
  portalUserId: string | null;
  email: string | null;
  phone: string | null;
  hasSmsConsent: boolean;
}

/**
 * Resolve the best available channel for a CRM customer (customers.id):
 *   1. portal — has a logged-in customer account (users.role = 'Customer' matched by email)
 *   2. email — has a primary email on file
 *   3. sms — has a primary phone on file
 *   4. none — unreachable
 */
export async function resolveCustomerChannel(customerId: string): Promise<ReachableCustomer | null> {
  const { rows } = await pool.query(
    `
    SELECT
      c.id, c.first_name, c.last_name, c.company_name,
      ce.email AS primary_email,
      cp.phone AS primary_phone,
      pu.id AS portal_user_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM sms_opt_ins so
        WHERE REGEXP_REPLACE(so.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(cp.phone, '[^0-9]', '', 'g')
          AND so.promotional_consent = true
      ) THEN true ELSE false END AS has_sms_consent
    FROM customers c
    LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
    LEFT JOIN customer_phones cp ON cp.customer_id = c.id AND cp.is_primary = true
    LEFT JOIN users pu ON LOWER(pu.email) = LOWER(ce.email) AND pu.role = 'Customer'
    WHERE c.id = $1
    LIMIT 1
    `,
    [customerId]
  );

  if (!rows.length) return null;
  const row = rows[0];

  let channel: MessageChannel = "none";
  if (row.portal_user_id) channel = "portal";
  else if (row.primary_email) channel = "email";
  else if (row.primary_phone) channel = "sms";

  return {
    customerId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    companyName: row.company_name,
    channel,
    portalUserId: row.portal_user_id ?? null,
    email: row.primary_email ?? null,
    phone: row.primary_phone ?? null,
    hasSmsConsent: !!row.has_sms_consent,
  };
}

/** Replace {{key}} placeholders in a template string. Unresolved keys are left blank. */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function buildTemplateVars(opts: {
  customerName?: string;
  jobTitle?: string;
  scheduledDate?: string | Date | null;
  invoiceNumber?: string;
  balanceDue?: string | number | null;
}): Record<string, string> {
  return {
    customer_name: opts.customerName ?? "",
    job_title: opts.jobTitle ?? "",
    scheduled_date: opts.scheduledDate
      ? new Date(opts.scheduledDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "",
    invoice_number: opts.invoiceNumber ?? "",
    balance_due: opts.balanceDue != null ? `$${Number(opts.balanceDue).toFixed(2)}` : "",
    portal_link: getAppUrl(),
  };
}

export interface SendResult {
  channel: MessageChannel;
  success: boolean;
  error?: string;
}

/**
 * Send a message to a single CRM customer via the best available channel (legacy single-channel send).
 * senderId is the staff user id (used as thread sender for portal messages).
 */
export async function sendToCustomer(
  customerId: string,
  subject: string,
  body: string,
  senderId: string
): Promise<SendResult> {
  const target = await resolveCustomerChannel(customerId);
  if (!target || target.channel === "none") {
    return { channel: "none", success: false, error: "No reachable channel (no portal login, email, or phone on file)" };
  }

  try {
    if (target.channel === "portal") {
      const threads = await storage.getMessagingThreads({ customerId: target.portalUserId! });
      let thread = threads.find(t => t.status !== "closed");
      if (!thread) {
        thread = await storage.createMessagingThread({
          customerId: target.portalUserId!,
          subject,
          priority: "normal",
        } as any);
      }
      await storage.createThreadMessage({
        threadId: thread.id,
        senderId,
        senderRole: "employee",
        content: body,
      } as any);
      return { channel: "portal", success: true };
    }

    if (target.channel === "email") {
      const ok = await sendEmail(target.email!, subject, body.replace(/\n/g, "<br>"));
      return { channel: "email", success: ok, error: ok ? undefined : "Email send failed" };
    }

    if (target.channel === "sms") {
      const ok = await sendSms(target.phone!, body, "customer");
      return { channel: "sms", success: ok, error: ok ? undefined : "SMS send failed" };
    }

    return { channel: "none", success: false, error: "Unresolved channel" };
  } catch (err: any) {
    return { channel: target.channel, success: false, error: err.message };
  }
}

/**
 * Send a message to a customer via ALL selected channels they support.
 * Returns one result per channel attempted (may be multiple per customer).
 * SMS is only attempted if hasSmsConsent is true.
 */
export async function sendToCustomerOnChannels(
  customer: ReachableCustomer,
  selectedChannels: string[],
  subject: string,
  body: string,
  senderId: string
): Promise<{ channel: MessageChannel; success: boolean; error?: string }[]> {
  const results: { channel: MessageChannel; success: boolean; error?: string }[] = [];

  // Portal message (customer must have a portal login)
  if (selectedChannels.includes("portal") && customer.portalUserId) {
    try {
      const threads = await storage.getMessagingThreads({ customerId: customer.portalUserId });
      let thread = threads.find((t: any) => t.status !== "closed");
      if (!thread) {
        thread = await storage.createMessagingThread({
          customerId: customer.portalUserId,
          subject,
          priority: "normal",
        } as any);
      }
      await storage.createThreadMessage({
        threadId: thread.id,
        senderId,
        senderRole: "employee",
        content: body,
      } as any);
      results.push({ channel: "portal", success: true });
    } catch (err: any) {
      results.push({ channel: "portal", success: false, error: err.message });
    }
  }

  // Email
  if (selectedChannels.includes("email") && customer.email) {
    try {
      const ok = await sendEmail(customer.email, subject, body.replace(/\n/g, "<br>"));
      results.push({ channel: "email", success: ok, error: ok ? undefined : "Email send failed" });
    } catch (err: any) {
      results.push({ channel: "email", success: false, error: err.message });
    }
  }

  // SMS — only if customer has opted in
  if (selectedChannels.includes("sms") && customer.phone && customer.hasSmsConsent) {
    try {
      const ok = await sendSms(customer.phone, body, "customer");
      results.push({ channel: "sms", success: ok, error: ok ? undefined : "SMS send failed" });
    } catch (err: any) {
      results.push({ channel: "sms", success: false, error: err.message });
    }
  }

  // Nothing sent — flag as skipped
  if (results.length === 0) {
    results.push({ channel: "none", success: false, error: "No matching channel available for selected channels" });
  }

  return results;
}

export type ContextualMessageType =
  | "start_reminder"
  | "weather_delay"
  | "completion"
  | "review_request"
  | "payment_reminder";

export const CONTEXTUAL_TEMPLATES: Record<ContextualMessageType, { subject: string; body: string }> = {
  start_reminder: {
    subject: "Your project is starting soon",
    body: "Hi {{customer_name}}, this is a reminder that your {{job_title}} project is scheduled to begin on {{scheduled_date}}. We're looking forward to it! If you have any questions before we start, just reply to this message.",
  },
  weather_delay: {
    subject: "Weather delay notice",
    body: "Hi {{customer_name}}, due to weather conditions we need to delay work on your {{job_title}} project. We'll follow up with a new schedule as soon as conditions improve. Thank you for your patience.",
  },
  completion: {
    subject: "Your project is complete!",
    body: "Hi {{customer_name}}, great news — work on your {{job_title}} project is now complete! Thank you for choosing us. Please don't hesitate to reach out if you have any questions.",
  },
  review_request: {
    subject: "How did we do?",
    body: "Hi {{customer_name}}, we hope you're loving your new {{job_title}}! We'd really appreciate it if you could take a moment to leave us a review — it helps us out a lot. You can leave one here: https://g.page/r/CTIAEga798WHEB0/review\n\nThank you for your business!",
  },
  payment_reminder: {
    subject: "Payment reminder — Invoice {{invoice_number}}",
    body: "Hi {{customer_name}}, this is a friendly reminder that invoice {{invoice_number}} for {{balance_due}} is now overdue. Please arrange payment at your earliest convenience. You can view your invoice here: {{portal_link}}",
  },
};

export interface ContextualSendResult {
  blastId: string;
  channel: MessageChannel;
  success: boolean;
  error?: string;
}

/**
 * Send a single pre-defined contextual template (start reminder, weather delay,
 * completion, review request, payment reminder) to one CRM customer, logging
 * the send through the same message_blasts / message_blast_recipients tables
 * used by bulk blasts so history + per-recipient status stay unified.
 */
export async function sendContextualMessage(opts: {
  customerId: string;
  type: ContextualMessageType;
  extraVars?: Record<string, string | number | null | undefined>;
  context: Record<string, any>;
  senderId: string;
}): Promise<ContextualSendResult> {
  const { customerId, type, extraVars, context, senderId } = opts;
  const target = await resolveCustomerChannel(customerId);
  const template = CONTEXTUAL_TEMPLATES[type];

  const vars = buildTemplateVars({
    customerName: target ? `${target.firstName} ${target.lastName}`.trim() : "",
    ...extraVars,
  });
  const renderedSubject = renderTemplate(template.subject, vars);
  const renderedBody = renderTemplate(template.body, vars);

  const { rows: blastRows } = await pool.query(
    `INSERT INTO message_blasts (subject, template_key, body, filters, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [renderedSubject, type, renderedBody, JSON.stringify({ contextType: type, ...context }), senderId]
  );
  const blastId = blastRows[0].id;

  if (!target || target.channel === "none") {
    await pool.query(
      `INSERT INTO message_blast_recipients (blast_id, customer_id, channel, status, error)
       VALUES ($1, $2, 'none', 'skipped', 'No reachable channel')`,
      [blastId, customerId]
    );
    await pool.query(`UPDATE message_blasts SET sent_at = NOW() WHERE id = $1`, [blastId]);
    return { blastId, channel: "none", success: false, error: "No reachable channel (no portal login, email, or phone on file)" };
  }

  const result = await sendToCustomer(customerId, renderedSubject, renderedBody, senderId);

  await pool.query(
    `INSERT INTO message_blast_recipients (blast_id, customer_id, channel, status, error, sent_at)
     VALUES ($1, $2, $3, $4, $5, ${result.success ? "NOW()" : "NULL"})`,
    [blastId, customerId, result.channel, result.success ? "sent" : "failed", result.error ?? null]
  );
  await pool.query(`UPDATE message_blasts SET sent_at = NOW() WHERE id = $1`, [blastId]);

  return { blastId, channel: result.channel, success: result.success, error: result.error };
}

export interface SegmentFilters {
  zone?: string;
  serviceType?: string;
  jobStage?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  overdueInvoice?: boolean;
}

/**
 * Return CRM customers matching the given filters, along with their reachable channel
 * and SMS consent status. Filters are applied via EXISTS against jobs / invoices so a
 * customer with multiple matching jobs/invoices is only returned once.
 */
export async function segmentCustomers(filters: SegmentFilters): Promise<ReachableCustomer[]> {
  const conditions: string[] = ["c.is_active = true"];
  const params: any[] = [];

  const jobConditions: string[] = ["j.customer_id = c.id"];
  if (filters.zone) {
    params.push(filters.zone);
    jobConditions.push(`j.zone = $${params.length}`);
  }
  if (filters.serviceType) {
    params.push(filters.serviceType);
    jobConditions.push(`j.type = $${params.length}`);
  }
  if (filters.jobStage) {
    params.push(filters.jobStage);
    jobConditions.push(`j.stage = $${params.length}`);
  }
  if (filters.scheduledFrom) {
    params.push(filters.scheduledFrom);
    jobConditions.push(`j.scheduled_date >= $${params.length}`);
  }
  if (filters.scheduledTo) {
    params.push(filters.scheduledTo);
    jobConditions.push(`j.scheduled_date <= $${params.length}`);
  }
  const hasJobFilter = !!(filters.zone || filters.serviceType || filters.jobStage || filters.scheduledFrom || filters.scheduledTo);
  if (hasJobFilter) {
    conditions.push(`EXISTS (SELECT 1 FROM jobs j WHERE ${jobConditions.join(" AND ")})`);
  }

  if (filters.overdueInvoice) {
    conditions.push(`EXISTS (
      SELECT 1 FROM invoices inv
      WHERE inv.customer_id = c.id
        AND inv.status NOT IN ('paid', 'void', 'draft')
        AND inv.due_date IS NOT NULL
        AND inv.due_date < CURRENT_DATE
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `
    SELECT
      c.id, c.first_name, c.last_name, c.company_name,
      ce.email AS primary_email,
      cp.phone AS primary_phone,
      pu.id AS portal_user_id,
      CASE WHEN cp.phone IS NOT NULL AND EXISTS (
        SELECT 1 FROM sms_opt_ins so
        WHERE REGEXP_REPLACE(so.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(cp.phone, '[^0-9]', '', 'g')
          AND so.promotional_consent = true
      ) THEN true ELSE false END AS has_sms_consent
    FROM customers c
    LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
    LEFT JOIN customer_phones cp ON cp.customer_id = c.id AND cp.is_primary = true
    LEFT JOIN users pu ON LOWER(pu.email) = LOWER(ce.email) AND pu.role = 'Customer'
    ${whereClause}
    ORDER BY c.last_name ASC, c.first_name ASC
    `,
    params
  );

  return rows.map((row) => {
    let channel: MessageChannel = "none";
    if (row.portal_user_id) channel = "portal";
    else if (row.primary_email) channel = "email";
    else if (row.primary_phone) channel = "sms";
    return {
      customerId: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      companyName: row.company_name,
      channel,
      portalUserId: row.portal_user_id ?? null,
      email: row.primary_email ?? null,
      phone: row.primary_phone ?? null,
      hasSmsConsent: !!row.has_sms_consent,
    };
  });
}
