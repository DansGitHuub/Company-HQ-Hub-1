import { Express } from "express";
import { pool } from "./db";

const PAYMENT_METHODS = ["cash", "check", "card", "ach", "zelle", "other"];

async function generateInvoiceNumber(): Promise<string> {
  const { rows } = await pool.query(`SELECT NEXTVAL('invoice_number_seq') AS n`);
  return `INV-${String(rows[0].n).padStart(4, "0")}`;
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
  app.post("/api/invoices", requireAuth, async (req, res) => {
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

      return res.status(201).json(final.rows[0]);
    } catch (err: any) {
      console.error("[invoices] POST /api/invoices:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────────
  app.put("/api/invoices/:id", requireAuth, async (req, res) => {
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
      return res.json(rows[0]);
    } catch (err: any) {
      console.error("[invoices] PUT /api/invoices/:id:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH STATUS ──────────────────────────────────────────────────────────────
  app.patch("/api/invoices/:id/status", requireAuth, async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status required" });
    try {
      const { rows } = await pool.query(
        `UPDATE invoices SET status=$1, updated_at=NOW(), amount_paid=CASE WHEN $2='paid' THEN total ELSE amount_paid END, balance_due=CASE WHEN $2='paid' THEN 0 ELSE balance_due END, paid_at=CASE WHEN $2='paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END WHERE id=$3 RETURNING *`,
        [status, status, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      await syncInvoiceTotals(req.params.id);
      const refreshed = await pool.query(`SELECT * FROM invoices WHERE id=$1`, [req.params.id]);
      return res.json(refreshed.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE (void) ─────────────────────────────────────────────────────────────
  app.delete("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      await pool.query(
        `UPDATE invoices SET status='void', updated_at=NOW() WHERE id=$1`,
        [req.params.id]
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── ADD PAYMENT ───────────────────────────────────────────────────────────────
  app.post("/api/invoices/:id/payments", requireAuth, async (req, res) => {
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
      return res.status(201).json({ payment: rows[0], invoice: updated.rows[0] });
    } catch (err: any) {
      console.error("[invoices] POST payments:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE PAYMENT ────────────────────────────────────────────────────────────
  app.delete("/api/payments/:paymentId", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `DELETE FROM payments WHERE id=$1 RETURNING invoice_id`,
        [req.params.paymentId]
      );
      if (rows.length > 0) await syncInvoiceTotals(rows[0].invoice_id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── SEND ──────────────────────────────────────────────────────────────────────
  app.patch("/api/invoices/:id/send", requireAuth, async (req, res) => {
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
  app.patch("/api/invoices/:id/response", requireAuth, async (req, res) => {
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
  app.patch("/api/invoices/:id/paid", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        UPDATE invoices
        SET status='paid', paid_at=COALESCE(paid_at, NOW()), updated_at=NOW()
        WHERE id=$1 RETURNING *
      `, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      await checkAndFlipJobSold(req.params.id);
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PAYMENT METHODS LIST ──────────────────────────────────────────────────────
  app.get("/api/invoices/meta/payment-methods", requireAuth, (_req, res) => {
    return res.json(PAYMENT_METHODS);
  });
}
