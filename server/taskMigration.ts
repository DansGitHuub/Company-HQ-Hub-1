import { pool } from "./db";

export async function runTaskMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id text UNIQUE,
        title text NOT NULL,
        description text,
        type text NOT NULL DEFAULT 'standard',
        priority text NOT NULL DEFAULT 'medium',
        status text NOT NULL DEFAULT 'todo',
        created_by_user_id varchar(36) NOT NULL REFERENCES users(id),
        assigned_to_user_id varchar(36) REFERENCES users(id),
        due_date timestamp,
        start_date timestamp,
        due_time text,
        category text,
        estimated_minutes integer,
        location text,
        linked_record_type text,
        linked_record_id varchar(36),
        reminder_date timestamp,
        reminder_sent boolean DEFAULT false,
        requires_confirmation boolean DEFAULT false,
        completion_notes text,
        completion_photo_url text,
        is_recurring boolean DEFAULT false,
        recurring_config jsonb,
        parent_task_id varchar(36),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        acknowledged_at timestamp,
        started_at timestamp,
        completed_at timestamp,
        confirmed_at timestamp,
        cancelled_at timestamp
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_checklist_items (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id varchar(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        item_text text NOT NULL,
        is_completed boolean DEFAULT false,
        completed_by varchar(36) REFERENCES users(id),
        completed_at timestamp,
        sort_order integer DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id varchar(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id varchar(36) NOT NULL REFERENCES users(id),
        body text NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_custom_fields (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id varchar(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        field_name text NOT NULL,
        field_value text,
        created_at timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_history (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id varchar(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        changed_by_user_id varchar(36) REFERENCES users(id),
        old_value text,
        new_value text,
        note text,
        created_at timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_attachments (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id varchar(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        file_url text NOT NULL,
        file_type text,
        file_name text,
        file_size integer,
        uploaded_by varchar(36) REFERENCES users(id),
        uploaded_at timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_delegation_chain (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id varchar(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        from_user_id varchar(36) NOT NULL REFERENCES users(id),
        to_user_id varchar(36) NOT NULL REFERENCES users(id),
        delegated_at timestamp DEFAULT now(),
        reason text
      );
    `);

    // Add new columns to existing tasks table if they don't exist
    const newColumns = [
      { name: 'start_date', type: 'timestamp' },
      { name: 'linked_record_type', type: 'text' },
      { name: 'linked_record_id', type: 'varchar(36)' },
      { name: 'reminder_date', type: 'timestamp' },
      { name: 'reminder_sent', type: 'boolean DEFAULT false' },
      { name: 'file_size', type: 'integer' },
    ];

    for (const col of newColumns) {
      try {
        await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (e: any) {
        // Column might already exist
      }
    }

    // Add file_size to task_attachments if missing
    try {
      await client.query(`ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_size integer`);
    } catch (e: any) {}

    // Make assigned_to_user_id nullable (drop NOT NULL if present)
    try {
      await client.query(`ALTER TABLE tasks ALTER COLUMN assigned_to_user_id DROP NOT NULL`);
    } catch (e: any) {}

    // Migrate old priority values to new format
    await client.query(`UPDATE tasks SET priority = 'low' WHERE priority = 'p4_low'`);
    await client.query(`UPDATE tasks SET priority = 'medium' WHERE priority = 'p3_normal'`);
    await client.query(`UPDATE tasks SET priority = 'high' WHERE priority = 'p2_high'`);
    await client.query(`UPDATE tasks SET priority = 'urgent' WHERE priority = 'p1_urgent'`);

    // Migrate old status values to new format
    await client.query(`UPDATE tasks SET status = 'todo' WHERE status IN ('assigned', 'acknowledged')`);
    await client.query(`UPDATE tasks SET status = 'complete' WHERE status = 'completed'`);
    await client.query(`UPDATE tasks SET status = 'complete' WHERE status = 'confirmed'`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_linked ON tasks(linked_record_type, linked_record_id);
      CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_checklist_task_id ON task_checklist_items(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_custom_fields_task_id ON task_custom_fields(task_id);
    `);

    await client.query("COMMIT");
    console.log("[migration] Task system schema migration completed");
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "42P07") {
      console.log("[migration] Task tables already exist");
    } else {
      console.error("[migration] Task migration error:", err.message);
    }
  } finally {
    client.release();
  }
}

export async function getNextTaskId(): Promise<string> {
  const result = await pool.query(`SELECT task_id FROM tasks WHERE task_id IS NOT NULL ORDER BY task_id DESC LIMIT 1`);
  if (result.rows.length === 0) return "TK-0001";
  const last = result.rows[0].task_id;
  const num = parseInt(last.replace("TK-", "")) + 1;
  return `TK-${String(num).padStart(4, "0")}`;
}
