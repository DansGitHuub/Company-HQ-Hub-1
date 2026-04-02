import { pool } from "../db";

export async function runInvoicesMigration() {
  try {
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

      CREATE TABLE IF NOT EXISTS invoices (
        id             VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::text,
        invoice_number VARCHAR(50)    UNIQUE NOT NULL,
        customer_id    UUID           REFERENCES customers(id) ON DELETE SET NULL,
        job_id         VARCHAR(36)    REFERENCES jobs(id) ON DELETE SET NULL,
        status         VARCHAR(30)    NOT NULL DEFAULT 'draft',
        issued_date    DATE           NOT NULL DEFAULT CURRENT_DATE,
        due_date       DATE,
        subtotal       DECIMAL(10,2)  NOT NULL DEFAULT 0,
        tax_rate       DECIMAL(5,4)   DEFAULT 0,
        tax_amount     DECIMAL(10,2)  DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total          DECIMAL(10,2)  NOT NULL DEFAULT 0,
        amount_paid    DECIMAL(10,2)  DEFAULT 0,
        balance_due    DECIMAL(10,2)  DEFAULT 0,
        notes          TEXT,
        terms          TEXT,
        customer_message       TEXT,
        customer_response      TEXT,
        customer_response_at   TIMESTAMPTZ,
        customer_response_note TEXT,
        sent_at                TIMESTAMPTZ,
        viewed_at              TIMESTAMPTZ,
        paid_at                TIMESTAMPTZ,
        created_at     TIMESTAMPTZ    DEFAULT NOW(),
        updated_at     TIMESTAMPTZ    DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_line_items (
        id          VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::text,
        invoice_id  VARCHAR(36)    NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT           NOT NULL DEFAULT '',
        quantity    DECIMAL(10,2)  DEFAULT 1,
        unit_price  DECIMAL(10,2)  DEFAULT 0,
        amount      DECIMAL(10,2)  DEFAULT 0,
        sort_order  INTEGER        DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS payments (
        id               VARCHAR(36)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
        invoice_id       VARCHAR(36)   NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        customer_id      UUID          REFERENCES customers(id) ON DELETE SET NULL,
        amount           DECIMAL(10,2) NOT NULL,
        payment_method   VARCHAR(30)   DEFAULT 'cash',
        payment_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
        reference_number VARCHAR(100),
        notes            TEXT,
        created_at       TIMESTAMPTZ   DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_customer_id  ON invoices(customer_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_job_id       ON invoices(job_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id ON invoice_line_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_payments_invoice_id   ON payments(invoice_id);
    `);

    console.log("[migration] Invoices tables ready");
  } catch (err: any) {
    console.error("[migration] Invoices migration error:", err.message);
  }
}
