import { pool } from "../db";

export async function runMessageBlastsMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_blasts (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      subject TEXT,
      template_key TEXT,
      body TEXT NOT NULL,
      filters JSONB,
      created_by VARCHAR(36) REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      sent_at TIMESTAMP WITH TIME ZONE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_blast_recipients (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      blast_id VARCHAR(36) NOT NULL REFERENCES message_blasts(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      sent_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_blast_recipients_blast_id
    ON message_blast_recipients(blast_id)
  `);

  console.log("[migration] Message blasts tables ready (message_blasts, message_blast_recipients)");
}

export async function runMessageBlastsConstraintsMigration() {
  // FK: every recipient must point at a real CRM customer (customer_id is populated by
  // segmentCustomers()/sendContextualMessage() in customerMessagingService.ts, always a
  // valid customers.id). Cascade delete so removing a customer cleans up their history.
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE message_blast_recipients
        ADD CONSTRAINT fk_message_blast_recipients_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // CHECK: channel must be one of the values customerMessagingService.ts actually writes —
  // 'email'/'sms'/'portal' for a reachable send, or 'none' for a skipped/unreachable recipient.
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE message_blast_recipients
        ADD CONSTRAINT chk_message_blast_recipients_channel
        CHECK (channel IN ('email', 'sms', 'portal', 'none'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_blast_recipients_customer_id
    ON message_blast_recipients(customer_id)
  `);

  console.log("[migration] Message blasts constraints ready (customer FK, channel check)");
}
