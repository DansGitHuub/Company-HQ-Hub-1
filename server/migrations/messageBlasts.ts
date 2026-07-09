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
  await pool.query(`ALTER TABLE message_blasts ADD COLUMN IF NOT EXISTS name TEXT`);
  await pool.query(`ALTER TABLE message_blasts ADD COLUMN IF NOT EXISTS recipient_count INTEGER`);
  await pool.query(`ALTER TABLE message_blast_recipients ADD COLUMN IF NOT EXISTS customer_name TEXT`);

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

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE message_blast_recipients
        ADD CONSTRAINT chk_message_blast_recipients_channel
        CHECK (channel IN ('email', 'sms'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_blast_recipients_customer_id
    ON message_blast_recipients(customer_id)
  `);

  console.log("[migration] Message blasts constraints ready (customer FK, channel check, name/recipient_count/customer_name columns)");
}
