import type { Express } from "express";
import { pool } from "./db";

async function migrate() {
  // Legacy conversation tables (kept to avoid data loss)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id SERIAL PRIMARY KEY,
      participant1_id VARCHAR(36) NOT NULL,
      participant2_id VARCHAR(36) NOT NULL,
      last_message_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(participant1_id, participant2_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
      sender_id VARCHAR(36) NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_reads (
      conversation_id INTEGER NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      last_read_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (conversation_id, user_id)
    )
  `);

  // Main direct_messages table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT,
      body TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT NOW(),
      read_at TIMESTAMP,
      deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);

  // Notification tracking per message per user
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_notifications (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id VARCHAR(36) NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
      seen BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Indexes for query performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id)`);

  // Star and archive columns
  await pool.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS starred_by_sender BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS starred_by_recipient BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS archived_by_sender BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS archived_by_recipient BOOLEAN NOT NULL DEFAULT FALSE`);

  console.log("[migration] DM messaging tables ready");
}

// Migration-only — all routes are in directMessageRoutes.ts
export function registerMessagesRoutes(app: Express, requireAuth: any) {
  migrate().catch(console.error);
}
