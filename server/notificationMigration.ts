import { pool } from "./db";

export async function runNotificationMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Add sms_notifications column to users table if missing
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS sms_notifications boolean NOT NULL DEFAULT true
    `);
    console.log("[migration] users.sms_notifications column ready");

    // 2. Add email_notifications column if somehow missing
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true
    `);
    console.log("[migration] users.email_notifications column ready");

    // 3. Ensure staffNotifications table exists (may already exist)
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_notifications (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar(36) NOT NULL REFERENCES users(id),
        type text NOT NULL,
        title text NOT NULL,
        message text NOT NULL,
        link text,
        metadata jsonb DEFAULT '{}'::jsonb,
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now()
      )
    `);
    console.log("[migration] staff_notifications table ready");

    // 4. Ensure customerNotifications table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_notifications (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id integer NOT NULL,
        type text NOT NULL,
        title text NOT NULL,
        message text NOT NULL,
        link text,
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now()
      )
    `);
    console.log("[migration] customer_notifications table ready");

    // 5. Index for fast unread queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_unread
        ON staff_notifications(user_id, is_read)
        WHERE is_read = false
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_unread
        ON customer_notifications(customer_id, is_read)
        WHERE is_read = false
    `);
    console.log("[migration] notification indexes ready");

  } catch (err: any) {
    if (err.code === "42P07") {
      console.log("[migration] Notification tables already exist");
    } else {
      console.error("[migration] Notification migration error:", err);
      throw err;
    }
  } finally {
    client.release();
  }
}
