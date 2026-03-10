import { pool } from "./db";

export async function runAssistantMigration() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assistant_conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_called TEXT,
        tool_args JSONB,
        tool_result JSONB,
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_assistant_conv_user ON assistant_conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_assistant_conv_session ON assistant_conversations(session_id);

      CREATE TABLE IF NOT EXISTS assistant_agents (
        id SERIAL PRIMARY KEY,
        agent_name TEXT NOT NULL,
        agent_key TEXT UNIQUE NOT NULL,
        system_prompt_addition TEXT,
        enabled_tools JSONB DEFAULT '[]',
        is_enabled BOOLEAN DEFAULT true,
        allowed_roles JSONB DEFAULT '[]',
        created_by VARCHAR(36),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[migration] Assistant tables migration completed");
  } catch (err) {
    console.error("[migration] Assistant migration error:", err);
  }
}
