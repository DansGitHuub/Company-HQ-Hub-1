import { pool } from "./db";

export async function runNotificationMigration() {
  const client = await pool.connect();
  try {
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
    console.log("[migration] Staff notifications table ready");
  } catch (err: any) {
    if (err.code === "42P07") {
      console.log("[migration] Staff notifications table already exists");
    } else {
      console.error("[migration] Staff notifications migration error:", err);
      throw err;
    }
  } finally {
    client.release();
  }
}
