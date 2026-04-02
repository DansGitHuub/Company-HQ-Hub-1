import { Express } from "express";
import { pool } from "./db";

const PAYMENT_METHODS = ["cash", "check", "card", "ach", "zelle", "other"];

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(`SELECT NEXTVAL('invoice_number_seq') AS n`);
  return `INV-${year}-${String(rows[0].n).padStart(4, "0")}`;
}

/** Recalculate totals for an invoice from its line items + payments */
async function syncInvoiceTotals(invoiceId: string) {
  await pool.query(`
    UPDATE invoices SET
      subtotal    = COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0),
      tax_amount  = ROUND((COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0) - discount_amount) * tax_rate, 2),
      total       = ROUND((COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0) - discount_amount)
                    * (1 + tax_rate), 2),
      amount_paid = COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=$1), 0),
      balance_due = ROUND((COALESCE((SELECT SUM(amount) FROM invoice_line_items WHERE invoice_id=$1), 0) - discount_amount)
                    * (1 + tax_rate), 2)
                    - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=$1), 0),
      updated_at  = NOW()
    WHERE id = $1
  `, [invoiceId]);

  // Auto-mark as paid if balance_due <= 0 and invoice was accepted/sent/viewed
  await pool.query(`
    UPDATE invoices
    SET status = 'paid', updated_at = NOW()
    WHERE id = $1
      AND balance_due <= 0
      AND status IN ('accepted','sent','viewed')
  `, [invoiceId]);
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
        `, [req.params.id]),
        pool.query(
          `SELECT * FROM invoice_line_items WHERE invoice_id=$1 ORDER BY sort_order, id`,
          [req.params.id]
        ),
        pool.query(
          `SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date DESC`,
          [req.params.id]
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
      tax_rate, discount_amount, notes, terms, customer_message, customer_response, customer_response_at, customer_response_note, line_items,
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
          updated_at             = NOW()
        WHERE id = $14
      `, [
        customer_id || null, job_id || null, status || null,
        issued_date || null, due_date ?? null,
        tax_rate ?? null, discount_amount ?? null, notes ?? null, terms ?? null,
        customer_message ?? null, customer_response ?? null, customer_response_at ?? null,
        customer_response_note ?? null, req.params.id,
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
        `UPDATE invoices SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [status, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      return res.json(rows[0]);
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

  // ── PAYMENT METHODS LIST ──────────────────────────────────────────────────────
  app.get("/api/invoices/meta/payment-methods", requireAuth, (_req, res) => {
    return res.json(PAYMENT_METHODS);
  });
}
