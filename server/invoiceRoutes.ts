import { Express } from "express";
import { pool } from "./db";
import { requireRole } from "./auth";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const PAYMENT_METHODS = ["cash", "check", "card", "ach", "zelle", "other"];

async function generateInvoiceNumber(): Promise<string> {
  const { rows } = await pool.query(`SELECT NEXTVAL('invoice_number_seq') AS n`);
  return `INV-${String(rows[0].n).padStart(4, "0")}`;
}

function logAudit(actorId: string | null, eventType: string, description: string, link = "/invoices") {
  pool.query(
    `INSERT INTO activity_log (id, user_id, event_type, description, link, seen_by, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, '[]'::jsonb, now())`,
    [actorId, eventType, description, link]
  ).catch((e: any) => console.error(`[audit] ${eventType}:`, e.message));
}

/** Recalculate totals for an invoice from its line items + payments */
async function syncInvoiceTotals(invoiceId: string) {
  // NULL-safe recompute. Wrapping discount_amount and tax_rate in COALESCE prevents
  // a single missing field from propagating NULL through the math (the bug that left
  // INV-1005 and the INV-1002 class with status=paid but balance_due > 0).
  await pool.query(`
    UPDATE invoices SET
      subtotal     = COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0),
      tax_amount   = ROUND(
                       (COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0)
                        - COALESCE(discount_amount, 0)
                       ) * COALESCE(tax_rate, 0), 2),
      total        = ROUND(
                       (COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0)
                        - COALESCE(discount_amount, 0)
                       ) * (1 + COALESCE(tax_rate, 0)), 2),
      amount_paid  = COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=$1), 0),
      balance_due  = GREATEST(
                       0,
                       ROUND(
                         (COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0)
                          - COALESCE(discount_amount, 0)
                         ) * (1 + COALESCE(tax_rate, 0)), 2)
                       - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=$1), 0)
                     ),
      updated_at   = NOW()
    WHERE id = $1
  `, [invoiceId]);

  // Auto-mark as paid if balance is now zero and there's at least one real payment.
  // Don't auto-mark drafts.
  await pool.query(`
    UPDATE invoices
    SET status = 'paid', updated_at = NOW(),
        paid_at = COALESCE(paid_at, NOW())
    WHERE id = $1
      AND balance_due <= 0
      AND amount_paid > 0
      AND status IN ('accepted','sent','viewed')
  `, [invoiceId]);

  // Inverse: if status is 'paid' but the books no longer agree (e.g. payment deleted),
  // step back to 'sent' so the user can decide what to do.
  await pool.query(`
    UPDATE invoices
    SET status = 'sent', updated_at = NOW(), paid_at = NULL
    WHERE id = $1
      AND status = 'paid'
      AND balance_due > 0
  `, [invoiceId]);

  // Production handoff: if the invoice is now paid, flip the linked job to "sold"
  // and auto-create a Work Order.
  await checkAndFlipJobSold(invoiceId);
}

/** When a down-payment (or any) invoice goes to paid status, flip the linked
 *  job to "sold" and auto-create a draft Work Order so the production handoff
 *  process can begin. Safe to call multiple times — idempotent. */
async function checkAndFlipJobSold(invoiceId: string) {
  try {
    const { rows } = await pool.query(
      `SELECT job_id, status FROM invoices WHERE id=$1`,
      [invoiceId]
    );
    if (!rows.length || !rows[0].job_id || rows[0].status !== 'paid') return;
    const job_id = rows[0].job_id;

    // Flip job → sold (skip if already at a later stage)
    await pool.query(
      `UPDATE jobs SET status='sold', updated_at=NOW()
       WHERE id=$1 AND status NOT IN ('sold','completed','invoiced','cancelled')`,
      [job_id]
    );

    // Auto-create a Work Order if one doesn't already exist for this job
    const { rows: existing } = await pool.query(
      `SELECT id FROM work_orders WHERE job_id=$1 LIMIT 1`,
      [job_id]
    );
    if (existing.length) return;

    // Pull job + customer + property info for pre-population
    const { rows: jd } = await pool.query(`
      SELECT j.title, j.client, j.type,
             COALESCE(NULLIF(TRIM(COALESCE(c.first_name,'')||' '||COALESCE(c.last_name,'')), ''), j.client) AS cust_name,
             c.phone AS cust_phone,
             NULLIF(TRIM(CONCAT_WS(', ', p.address, p.city, p.state)), '') AS cust_address,
             se.service_type_id AS est_svc_type
      FROM jobs j
      LEFT JOIN customers c ON c.id::text = j.customer_id::text
      LEFT JOIN properties p ON p.id::text = j.property_id::text
      LEFT JOIN sales_estimates se ON se.converted_job_id = j.id
      WHERE j.id = $1
      LIMIT 1
    `, [job_id]);
    if (!jd.length) return;

    const j = jd[0];
    const woType = (j.type || '').toLowerCase().includes('maintenance') ? 'maintenance' : 'installation';
    await pool.query(`
      INSERT INTO work_orders
        (job_id, title, wo_type, status, customer_name, customer_address, customer_phone,
         service_type_id, created_by, created_at, updated_at)
      VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,'system',NOW(),NOW())
    `, [
      job_id,
      j.title || `Work Order – ${j.cust_name || j.client || 'Job'}`,
      woType,
      j.cust_name || null,
      j.cust_address || null,
      j.cust_phone || null,
      j.est_svc_type || null,
    ]);
    console.log(`[work-orders] Auto-created draft WO for job ${job_id}`);
  } catch (err: any) {
    console.error('[work-orders] checkAndFlipJobSold error:', err.message);
  }
}

export function registerInvoiceRoutes(app: Express, requireAuth: any) {

  // ── LIST ──────────────────────────────────────────────────────────────────────
  app.get("/api/invoices", requireAuth, async (req, res) => {
    const { status, customer_id, job_id, date_from, date_to, search } = req.query as Record<string, string>;

    try {
      let q = `
        SELECT
          i.id, i.invoice_number, i.status, i.issued_date, i.due_date,
          i.subtotal, i.tax_rate, i.tax_amount, i.total,
          i.amount_paid, i.balance_due, i.customer_id, i.job_id, i.created_at,
          c.first_name AS cust_first, c.last_name AS cust_last, c.company_name AS cust_company,
          j.title AS job_title, j.client AS job_client
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN jobs j ON j.id = i.job_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && status !== "all") {
        const statuses = status.split(",").map((s) => s.trim());
        params.push(statuses);
        q += ` AND i.status = ANY($${params.length})`;
      }
      if (customer_id) { params.push(customer_id); q += ` AND i.customer_id = $${params.length}`; }
      if (job_id)      { params.push(job_id);       q += ` AND i.job_id = $${params.length}`; }
      if (date_from)   { params.push(date_from);    q += ` AND i.issued_date >= $${params.length}`; }
      if (date_to)     { params.push(date_to);      q += ` AND i.issued_date <= $${params.length}`; }
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        q += ` AND (i.invoice_number ILIKE $${idx} OR c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR c.company_name ILIKE $${idx})`;
      }

      q += ` ORDER BY i.created_at DESC`;
      const { rows } = await pool.query(q, params);
      return res.json(rows);
    } catch (err: any) {
      console.error("[invoices] GET /api/invoices:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── SINGLE ────────────────────────────────────────────────────────────────────
  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      let resolvedId = req.params.id;
      if (/^INV-\d+$/i.test(resolvedId)) {
        const { rows } = await pool.query(
          `SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1`,
          [resolvedId.toUpperCase()]
        );
        if (!rows.length) return res.status(404).json({ message: "Invoice not found" });
        resolvedId = rows[0].id;
      }
      const [invRes, itemsRes, paymentsRes] = await Promise.all([
        pool.query(`
          SELECT i.*,
            c.first_name AS cust_first, c.last_name AS cust_last,
            c.company_name AS cust_company,
            j.title AS job_title, j.client AS job_client, j.address AS job_address
          FROM invoices i
          LEFT JOIN customers c ON c.id = i.customer_id
          LEFT JOIN jobs j ON j.id = i.job_id
          WHERE i.id = $1
        `, [resolvedId]),
        pool.query(
          `SELECT * FROM invoice_line_items WHERE invoice_id=$1 ORDER BY sort_order, id`,
          [resolvedId]
        ),
        pool.query(
          `SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date DESC`,
          [resolvedId]
        ),
      ]);

      if (invRes.rows.length === 0) return res.status(404).json({ message: "Invoice not found" });
      return res.json({ ...invRes.rows[0], line_items: itemsRes.rows, payments: paymentsRes.rows });
    } catch (err: any) {
      console.error("[invoices] GET /api/invoices/:id:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── CREATE ────────────────────────────────────────────────────────────────────
  app.post("/api/invoices", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const {
      customer_id, job_id, issued_date, due_date,
      tax_rate = 0, discount_amount = 0, notes, terms, customer_message, customer_response, customer_response_at, customer_response_note, line_items = [],
    } = req.body;

    try {
      const invoice_number = await generateInvoiceNumber();

      const { rows } = await pool.query(`
        INSERT INTO invoices (invoice_number, customer_id, job_id, issued_date, due_date, tax_rate, discount_amount, notes, terms, customer_message, customer_response, customer_response_at, customer_response_note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
      `, [
        invoice_number,
        customer_id || null, job_id || null,
        issued_date || new Date().toISOString().split("T")[0],
        due_date || null, tax_rate, discount_amount || 0, notes || null, terms || null,
        customer_message || null, customer_response || null, customer_response_at || null,
        customer_response_note || null,
      ]);

      const invoice = rows[0];

      // Insert line items
      if (line_items.length > 0) {
        for (let i = 0; i < line_items.length; i++) {
          const li = line_items[i];
          const amount = (parseFloat(li.quantity ?? 1) * parseFloat(li.unit_price ?? 0)).toFixed(2);
          await pool.query(`
            INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, amount, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [invoice.id, li.description ?? "", li.quantity ?? 1, li.unit_price ?? 0, amount, i]);
        }
        await syncInvoiceTotals(invoice.id);
      }

      const final = await pool.query(`SELECT * FROM invoices WHERE id=$1`, [invoice.id]);

      // A23: if this invoice is tied to a job, advance the job to "invoiced" and reflect
      // the linked-invoice total into job.price so the summary tile stops showing $0.
      if (invoice.job_id) {
        try {
          await pool.query(
            `UPDATE jobs
             SET status = CASE
                            WHEN status IN ('completed','in_progress','scheduled','lead') THEN 'invoiced'
                            ELSE status
                          END,
                 price  = (
                   SELECT COALESCE(SUM(total), 0) FROM invoices
                   WHERE job_id = $1 AND status NOT IN ('void')
                 ),
                 updated_at = NOW()
             WHERE id = $1`,
            [invoice.job_id]
          );
        } catch (e: any) {
          console.error("[A23 job-status sync]", e.message);
        }
      }

      const actor = req.user as any;
      logAudit(
        actor?.id ?? null,
        "invoice_create",
        `${actor?.name ?? "Staff"} created invoice ${final.rows[0].invoice_number} (total: $${Number(final.rows[0].total ?? 0).toFixed(2)})`,
        `/invoices/${final.rows[0].id}`
      );
      return res.status(201).json(final.rows[0]);
    } catch (err: any) {
      console.error("[invoices] POST /api/invoices:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────────
  app.put("/api/invoices/:id", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const {
      customer_id, job_id, status, issued_date, due_date,
      tax_rate, discount_amount, notes, terms, customer_message, customer_response,
      customer_response_at, customer_response_note, sent_at, viewed_at, paid_at, line_items,
    } = req.body;

    try {
      await pool.query(`
        UPDATE invoices SET
          customer_id      = COALESCE($1, customer_id),
          job_id           = COALESCE($2, job_id),
          status           = COALESCE($3, status),
          issued_date      = COALESCE($4, issued_date),
          due_date         = $5,
          tax_rate         = COALESCE($6, tax_rate),
          discount_amount  = COALESCE($7, discount_amount),
          notes            = $8,
          terms            = $9,
          customer_message       = $10,
          customer_response      = $11,
          customer_response_at   = $12,
          customer_response_note = $13,
          sent_at = CASE
            WHEN $14 IS NOT NULL THEN $14::TIMESTAMPTZ
            WHEN $3 = 'sent' AND sent_at IS NULL THEN NOW()
            ELSE sent_at
          END,
          viewed_at = CASE
            WHEN $15 IS NOT NULL THEN $15::TIMESTAMPTZ
            WHEN $3 = 'viewed' AND viewed_at IS NULL THEN NOW()
            ELSE viewed_at
          END,
          paid_at = CASE
            WHEN $16 IS NOT NULL THEN $16::TIMESTAMPTZ
            WHEN $3 = 'paid' AND paid_at IS NULL THEN NOW()
            ELSE paid_at
          END,
          updated_at = NOW()
        WHERE id = $17
      `, [
        customer_id || null, job_id || null, status || null,
        issued_date || null, due_date ?? null,
        tax_rate ?? null, discount_amount ?? null, notes ?? null, terms ?? null,
        customer_message ?? null, customer_response ?? null, customer_response_at ?? null,
        customer_response_note ?? null, sent_at ?? null, viewed_at ?? null, paid_at ?? null,
        req.params.id,
      ]);

      // Replace line items if provided
      if (Array.isArray(line_items)) {
        await pool.query(`DELETE FROM invoice_line_items WHERE invoice_id=$1`, [req.params.id]);
        for (let i = 0; i < line_items.length; i++) {
          const li = line_items[i];
          const amount = (parseFloat(li.quantity ?? 1) * parseFloat(li.unit_price ?? 0)).toFixed(2);
          await pool.query(`
            INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, amount, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [req.params.id, li.description ?? "", li.quantity ?? 1, li.unit_price ?? 0, amount, i]);
        }
      }

      await syncInvoiceTotals(req.params.id);
      const { rows } = await pool.query(`SELECT * FROM invoices WHERE id=$1`, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ message: "Invoice not found" });
      const actor = req.user as any;
      logAudit(
        actor?.id ?? null,
        "invoice_edit",
        `${actor?.name ?? "Staff"} edited invoice ${rows[0].invoice_number} (total: $${Number(rows[0].total ?? 0).toFixed(2)}, status: ${rows[0].status})`,
        `/invoices/${req.params.id}`
      );
      return res.json(rows[0]);
    } catch (err: any) {
      console.error("[invoices] PUT /api/invoices/:id:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH STATUS ──────────────────────────────────────────────────────────────
  app.patch("/api/invoices/:id/status", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status required" });
    try {
      const oldInv = await pool.query(`SELECT status, invoice_number FROM invoices WHERE id=$1`, [req.params.id]);
      const oldStatus = oldInv.rows[0]?.status ?? "unknown";
      const invoiceNumber = oldInv.rows[0]?.invoice_number ?? req.params.id;
      const { rows } = await pool.query(
        `UPDATE invoices SET status=$1, updated_at=NOW(), amount_paid=CASE WHEN $2='paid' THEN total ELSE amount_paid END, balance_due=CASE WHEN $2='paid' THEN 0 ELSE balance_due END, paid_at=CASE WHEN $2='paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END WHERE id=$3 RETURNING *`,
        [status, status, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      await syncInvoiceTotals(req.params.id);
      const refreshed = await pool.query(`SELECT * FROM invoices WHERE id=$1`, [req.params.id]);
      const actor = req.user as any;
      logAudit(
        actor?.id ?? null,
        "invoice_status_change",
        `${actor?.name ?? "Staff"} changed invoice ${invoiceNumber} status: ${oldStatus} → ${status}`,
        `/invoices/${req.params.id}`
      );
      return res.json(refreshed.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE (void) ─────────────────────────────────────────────────────────────
  app.delete("/api/invoices/:id", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      const preVoid = await pool.query(`SELECT invoice_number, total FROM invoices WHERE id=$1`, [req.params.id]);
      await pool.query(
        `UPDATE invoices SET status='void', updated_at=NOW() WHERE id=$1`,
        [req.params.id]
      );
      const actor = req.user as any;
      const inv = preVoid.rows[0];
      logAudit(
        actor?.id ?? null,
        "invoice_void",
        `${actor?.name ?? "Staff"} voided invoice ${inv?.invoice_number ?? req.params.id} (total: $${Number(inv?.total ?? 0).toFixed(2)})`,
        `/invoices/${req.params.id}`
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── ADD PAYMENT ───────────────────────────────────────────────────────────────
  app.post("/api/invoices/:id/payments", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const { amount, payment_method = "cash", payment_date, reference_number, notes } = req.body;
    if (!amount) return res.status(400).json({ message: "amount required" });

    try {
      // Get customer_id from invoice
      const inv = await pool.query(`SELECT customer_id FROM invoices WHERE id=$1`, [req.params.id]);
      if (inv.rows.length === 0) return res.status(404).json({ message: "Invoice not found" });

      const { rows } = await pool.query(`
        INSERT INTO payments (invoice_id, customer_id, amount, payment_method, payment_date, reference_number, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [
        req.params.id,
        inv.rows[0].customer_id || null,
        parseFloat(amount),
        payment_method,
        payment_date || new Date().toISOString().split("T")[0],
        reference_number || null,
        notes || null,
      ]);

      await syncInvoiceTotals(req.params.id);
      const updated = await pool.query(`SELECT * FROM invoices WHERE id=$1`, [req.params.id]);
      const actor = req.user as any;
      logAudit(
        actor?.id ?? null,
        "invoice_payment_add",
        `${actor?.name ?? "Staff"} added $${Number(rows[0].amount).toFixed(2)} ${rows[0].payment_method} payment to invoice ${updated.rows[0].invoice_number}`,
        `/invoices/${req.params.id}`
      );
      return res.status(201).json({ payment: rows[0], invoice: updated.rows[0] });
    } catch (err: any) {
      console.error("[invoices] POST payments:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE PAYMENT ────────────────────────────────────────────────────────────
  app.delete("/api/payments/:paymentId", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      const preDelete = await pool.query(
        `SELECT p.amount, p.payment_method, p.invoice_id, i.invoice_number
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         WHERE p.id = $1`,
        [req.params.paymentId]
      );
      const { rows } = await pool.query(
        `DELETE FROM payments WHERE id=$1 RETURNING invoice_id`,
        [req.params.paymentId]
      );
      if (rows.length > 0) {
        await syncInvoiceTotals(rows[0].invoice_id);
        const pd = preDelete.rows[0];
        if (pd) {
          const actor = req.user as any;
          logAudit(
            actor?.id ?? null,
            "invoice_payment_delete",
            `${actor?.name ?? "Staff"} deleted $${Number(pd.amount).toFixed(2)} ${pd.payment_method} payment from invoice ${pd.invoice_number}`,
            `/invoices/${pd.invoice_id}`
          );
        }
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── SEND ──────────────────────────────────────────────────────────────────────
  app.patch("/api/invoices/:id/send", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      const { rows } = await pool.query(`
        UPDATE invoices
        SET status='sent', sent_at=COALESCE(sent_at, NOW()), updated_at=NOW()
        WHERE id=$1 RETURNING *
      `, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── CUSTOMER RESPONSE (accept / decline / changes_requested) ──────────────────
  app.patch("/api/invoices/:id/response", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const { status, customer_response, customer_response_note } = req.body;
    const VALID = ["accepted", "declined", "changes_requested"];
    if (!status || !VALID.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${VALID.join(", ")}` });
    }
    try {
      const { rows } = await pool.query(`
        UPDATE invoices SET
          status                 = $1,
          customer_response      = $2,
          customer_response_at   = NOW(),
          customer_response_note = $3,
          paid_at = CASE WHEN $1 = 'paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
          updated_at             = NOW()
        WHERE id = $4 RETURNING *
      `, [status, customer_response || null, customer_response_note || null, req.params.id]);
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── MARK PAID ─────────────────────────────────────────────────────────────────
  app.patch("/api/invoices/:id/paid", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      const { rows } = await pool.query(`
        UPDATE invoices
        SET status='paid', paid_at=COALESCE(paid_at, NOW()), updated_at=NOW()
        WHERE id=$1 RETURNING *
      `, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      await checkAndFlipJobSold(req.params.id);
      const actor = req.user as any;
      logAudit(
        actor?.id ?? null,
        "invoice_mark_paid",
        `${actor?.name ?? "Staff"} marked invoice ${rows[0].invoice_number} as paid (total: $${Number(rows[0].total ?? 0).toFixed(2)})`,
        `/invoices/${req.params.id}`
      );
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PDF GENERATION ────────────────────────────────────────────────────────────
  app.get("/api/invoices/:id/pdf", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      let resolvedId = req.params.id;
      if (/^INV-\d+$/i.test(resolvedId)) {
        const { rows } = await pool.query(
          `SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1`,
          [resolvedId.toUpperCase()]
        );
        if (!rows.length) return res.status(404).json({ message: "Invoice not found" });
        resolvedId = rows[0].id;
      }

      const [invRes, itemsRes] = await Promise.all([
        pool.query(`
          SELECT i.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS cust_name,
            c.company_name  AS cust_company,
            c.billing_address AS cust_address,
            c.billing_city    AS cust_city,
            c.billing_state   AS cust_state,
            c.billing_zip     AS cust_zip,
            j.title AS job_title
          FROM invoices i
          LEFT JOIN customers c ON c.id = i.customer_id
          LEFT JOIN jobs j ON j.id = i.job_id
          WHERE i.id = $1
        `, [resolvedId]),
        pool.query(
          `SELECT * FROM invoice_line_items WHERE invoice_id=$1 ORDER BY sort_order, id`,
          [resolvedId]
        ),
      ]);

      if (!invRes.rows.length) return res.status(404).json({ message: "Invoice not found" });
      const inv = invRes.rows[0];
      const lineItems = itemsRes.rows;

      // ── helpers ──────────────────────────────────────────────────────────────
      const fmt$ = (v: any) =>
        "$" + parseFloat(v ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const fmtD = (d: string | null) => {
        if (!d) return "—";
        const [yr, mo, dy] = d.slice(0, 10).split("-").map(Number);
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${months[mo - 1]} ${dy}, ${yr}`;
      };

      const wrapText = (text: string, font: any, size: number, maxW: number): string[] => {
        const words = (text || "").split(" ");
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) > maxW && cur) {
            lines.push(cur);
            cur = w;
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);
        return lines;
      };

      // ── create document ───────────────────────────────────────────────────────
      const pdfDoc = await PDFDocument.create();
      const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const GREEN  = rgb(0.13, 0.31, 0.15);
      const LGREY  = rgb(0.96, 0.96, 0.96);
      const GREY   = rgb(0.48, 0.48, 0.48);
      const BLACK  = rgb(0.10, 0.10, 0.10);
      const WHITE  = rgb(1,    1,    1);
      const RED    = rgb(0.72, 0.10, 0.10);

      const PW = 612, PH = 792;
      const ML = 48, MR = PW - 48, CW = MR - ML;

      // Table column x positions
      const cDesc = ML;
      const cQty  = ML + CW * 0.55;
      const cRate = ML + CW * 0.70;
      const cAmt  = ML + CW * 0.84;

      // ── page factory ─────────────────────────────────────────────────────────
      let page = pdfDoc.addPage([PW, PH]);
      let y = PH;

      const ensureSpace = (needed: number) => {
        if (y - needed < 80) {
          // Footer on current page
          page.drawRectangle({ x: 0, y: 0, width: PW, height: 30, color: GREEN });
          const ft = "Chapin Landscapes  ·  chapinlandscapes.com";
          page.drawText(ft, { x: (PW - regular.widthOfTextAtSize(ft, 8)) / 2, y: 10, size: 8, font: regular, color: WHITE });
          page = pdfDoc.addPage([PW, PH]);
          y = PH - 20;
        }
      };

      // ── header band ──────────────────────────────────────────────────────────
      page.drawRectangle({ x: 0, y: PH - 76, width: PW, height: 76, color: GREEN });

      page.drawText("CHAPIN LANDSCAPES", { x: ML, y: PH - 34, size: 22, font: bold, color: WHITE });
      page.drawText("Professional Landscape Installation & Maintenance", {
        x: ML, y: PH - 50, size: 8.5, font: regular, color: rgb(0.75, 0.90, 0.76),
      });

      const invNumW  = regular.widthOfTextAtSize(inv.invoice_number, 10);
      const invLblW  = bold.widthOfTextAtSize("INVOICE", 24);
      page.drawText("INVOICE",           { x: MR - invLblW, y: PH - 38, size: 24, font: bold,    color: WHITE });
      page.drawText(inv.invoice_number,  { x: MR - invNumW, y: PH - 54, size: 10, font: regular, color: rgb(0.78, 0.91, 0.79) });

      y = PH - 96;

      // ── Bill To / Invoice Details ────────────────────────────────────────────
      const colMid = ML + CW * 0.50;

      page.drawText("BILL TO",          { x: ML,      y, size: 7.5, font: bold, color: GREY });
      page.drawText("INVOICE DETAILS",  { x: colMid,  y, size: 7.5, font: bold, color: GREY });
      y -= 13;

      const custDisplay = inv.cust_company || (inv.cust_name?.trim() || "—");
      page.drawText(custDisplay, { x: ML, y, size: 10.5, font: bold, color: BLACK });

      let billY = y;
      if (inv.cust_company && inv.cust_name?.trim()) {
        billY -= 13;
        page.drawText(inv.cust_name.trim(), { x: ML, y: billY, size: 9, font: regular, color: GREY });
      }
      if (inv.cust_address) {
        billY -= 12;
        page.drawText(inv.cust_address, { x: ML, y: billY, size: 9, font: regular, color: BLACK });
      }
      const cityLine = [inv.cust_city, inv.cust_state, inv.cust_zip].filter(Boolean).join(", ");
      if (cityLine) {
        billY -= 12;
        page.drawText(cityLine, { x: ML, y: billY, size: 9, font: regular, color: BLACK });
      }

      // Right column — details
      const statusLabel = (inv.status as string)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const detRows: [string, string][] = [
        ["Status",  statusLabel],
        ["Issued",  fmtD(inv.issued_date)],
      ];
      if (inv.due_date)  detRows.push(["Due",  fmtD(inv.due_date)]);
      if (inv.job_title) detRows.push(["Job",  inv.job_title]);

      let detY = y;
      for (const [lbl, val] of detRows) {
        page.drawText(lbl + ":", { x: colMid,      y: detY, size: 8.5, font: bold,    color: GREY  });
        page.drawText(val,        { x: colMid + 56, y: detY, size: 8.5, font: regular, color: BLACK });
        detY -= 13;
      }

      y = Math.min(billY, detY) - 18;

      // ── divider ──────────────────────────────────────────────────────────────
      page.drawRectangle({ x: ML, y: y + 4, width: CW, height: 1, color: rgb(0.80, 0.80, 0.80) });
      y -= 8;

      // ── line items header ────────────────────────────────────────────────────
      ensureSpace(22);
      page.drawRectangle({ x: ML, y: y - 5, width: CW, height: 21, color: GREEN });
      page.drawText("DESCRIPTION", { x: cDesc + 4, y: y + 3, size: 7.5, font: bold, color: WHITE });
      page.drawText("QTY",          { x: cQty,      y: y + 3, size: 7.5, font: bold, color: WHITE });
      page.drawText("UNIT PRICE",   { x: cRate,      y: y + 3, size: 7.5, font: bold, color: WHITE });
      page.drawText("AMOUNT",       { x: cAmt,       y: y + 3, size: 7.5, font: bold, color: WHITE });
      y -= 16;

      // ── line items rows ──────────────────────────────────────────────────────
      for (let i = 0; i < lineItems.length; i++) {
        ensureSpace(18);
        const li = lineItems[i];
        const rowBg = i % 2 === 1 ? LGREY : WHITE;
        page.drawRectangle({ x: ML, y: y - 5, width: CW, height: 18, color: rowBg });
        const desc = (li.description ?? "").slice(0, 72);
        page.drawText(desc,                 { x: cDesc + 4, y: y + 2, size: 8.5, font: regular, color: BLACK });
        page.drawText(String(parseFloat(li.quantity ?? "1")), {
          x: cQty, y: y + 2, size: 8.5, font: regular, color: BLACK,
        });
        page.drawText(fmt$(li.unit_price), { x: cRate, y: y + 2, size: 8.5, font: regular, color: BLACK });
        const amtW = regular.widthOfTextAtSize(fmt$(li.amount), 8.5);
        page.drawText(fmt$(li.amount), { x: MR - amtW, y: y + 2, size: 8.5, font: regular, color: BLACK });
        y -= 17;
      }

      y -= 6;

      // ── totals ────────────────────────────────────────────────────────────────
      ensureSpace(100);
      page.drawRectangle({ x: ML, y: y + 4, width: CW, height: 1, color: rgb(0.80, 0.80, 0.80) });
      y -= 8;

      const totL = MR - 200;

      const totRow = (label: string, value: string, isBold = false, color = GREY) => {
        ensureSpace(16);
        const f = isBold ? bold : regular;
        const vW = f.widthOfTextAtSize(value, 9);
        page.drawText(label, { x: totL, y, size: 9, font: f, color: isBold ? BLACK : GREY });
        page.drawText(value, { x: MR - vW, y, size: 9, font: f, color });
        y -= 13;
      };

      totRow("Subtotal", fmt$(inv.subtotal));
      if (parseFloat(inv.discount_amount ?? "0") > 0)
        totRow("Discount", "−" + fmt$(inv.discount_amount), false, rgb(0.18, 0.55, 0.28));
      if (parseFloat(inv.tax_amount ?? "0") > 0)
        totRow(`Tax (${(parseFloat(inv.tax_rate ?? "0") * 100).toFixed(1)}%)`, fmt$(inv.tax_amount));

      // Total row
      y -= 2;
      ensureSpace(22);
      page.drawRectangle({ x: totL, y: y - 4, width: MR - totL, height: 1, color: GREEN });
      y -= 8;
      const totW  = bold.widthOfTextAtSize(fmt$(inv.total), 10.5);
      page.drawText("TOTAL",         { x: totL, y, size: 10.5, font: bold, color: GREEN });
      page.drawText(fmt$(inv.total), { x: MR - totW, y, size: 10.5, font: bold, color: GREEN });
      y -= 14;

      if (parseFloat(inv.amount_paid ?? "0") > 0)
        totRow("Paid", "−" + fmt$(inv.amount_paid), false, rgb(0.18, 0.55, 0.28));

      // Balance due band
      y -= 2;
      ensureSpace(26);
      const balance = parseFloat(inv.balance_due ?? "0");
      const bandColor = balance > 0 ? GREEN : rgb(0.18, 0.55, 0.28);
      page.drawRectangle({ x: totL, y: y - 6, width: MR - totL, height: 24, color: bandColor });
      const balStr = fmt$(inv.balance_due);
      const balW   = bold.widthOfTextAtSize(balStr, 11);
      page.drawText("BALANCE DUE", { x: totL + 6, y: y + 5, size: 9.5, font: bold, color: WHITE });
      page.drawText(balStr,         { x: MR - balW, y: y + 5, size: 11,  font: bold, color: WHITE });
      y -= 30;

      // ── notes / terms ─────────────────────────────────────────────────────────
      const noteSize = 8.5;
      const noteMaxW = CW;

      if (inv.notes) {
        ensureSpace(30);
        y -= 8;
        page.drawText("Notes", { x: ML, y, size: 8.5, font: bold, color: GREY });
        y -= 12;
        for (const ln of wrapText(inv.notes.slice(0, 500), regular, noteSize, noteMaxW)) {
          ensureSpace(12);
          page.drawText(ln, { x: ML, y, size: noteSize, font: regular, color: BLACK });
          y -= 12;
        }
      }

      if (inv.terms) {
        ensureSpace(30);
        y -= 8;
        page.drawText("Terms & Conditions", { x: ML, y, size: 8.5, font: bold, color: GREY });
        y -= 12;
        for (const ln of wrapText(inv.terms.slice(0, 500), regular, noteSize, noteMaxW)) {
          ensureSpace(12);
          page.drawText(ln, { x: ML, y, size: noteSize, font: regular, color: BLACK });
          y -= 12;
        }
      }

      // ── footer on last page ───────────────────────────────────────────────────
      page.drawRectangle({ x: 0, y: 0, width: PW, height: 30, color: GREEN });
      const ft = "Thank you for your business!  ·  Chapin Landscapes  ·  chapinlandscapes.com";
      page.drawText(ft, { x: (PW - regular.widthOfTextAtSize(ft, 8)) / 2, y: 10, size: 8, font: regular, color: WHITE });

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${inv.invoice_number}.pdf"`);
      res.setHeader("Content-Length", String(pdfBytes.length));
      return res.end(Buffer.from(pdfBytes));
    } catch (err: any) {
      console.error("[invoices] PDF generation error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PAYMENT METHODS LIST ──────────────────────────────────────────────────────
  app.get("/api/invoices/meta/payment-methods", requireAuth, (_req, res) => {
    return res.json(PAYMENT_METHODS);
  });
}
