import { pool } from "./db";

export async function runEquipmentMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS nickname text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS asset_id text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS serial_number text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_date timestamp;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_price integer;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchased_from text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS condition_at_purchase text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS assigned_to_user_id varchar(36);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS primary_location text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS tracking_type text DEFAULT 'hours';
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS current_hours integer DEFAULT 0;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS hours_at_purchase integer DEFAULT 0;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS last_hours_update timestamp;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS registration_expiry timestamp;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS insurance_expiry timestamp;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS warranty_expiry timestamp;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS primary_photo_url text;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);
    `);

    await client.query(`
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS template_id varchar(36);
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS hours_interval integer;
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS calendar_interval_days integer;
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS last_service_hours integer;
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS last_service_date timestamp;
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS priority text DEFAULT 'p4';
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS is_overridden boolean DEFAULT false;
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS override_notes text;
      ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS task_description text;
    `);

    await client.query(`
      ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS log_type text DEFAULT 'scheduled';
      ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS service_location text;
      ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS parts_used jsonb DEFAULT '[]';
      ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS labor_cost integer DEFAULT 0;
      ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS total_cost integer DEFAULT 0;
      ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS receipt_url text;
    `);

    await client.query(`
      ALTER TABLE equipment_uploads ADD COLUMN IF NOT EXISTS folder text DEFAULT 'other';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS oem_maintenance_templates (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        brand text NOT NULL,
        category text NOT NULL,
        task_name text NOT NULL,
        task_description text,
        hours_interval integer,
        calendar_interval_days integer,
        priority_level text DEFAULT 'p3',
        notes text,
        created_at timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS repair_requests (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id varchar(36) NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        reported_by_user_id varchar(36) REFERENCES users(id),
        report_date timestamp DEFAULT now(),
        problem_description text NOT NULL,
        severity text NOT NULL DEFAULT 'minor',
        is_usable text NOT NULL DEFAULT 'yes',
        photos jsonb DEFAULT '[]',
        status text NOT NULL DEFAULT 'open',
        assigned_to_user_id varchar(36) REFERENCES users(id),
        shop_name text,
        drop_off_date timestamp,
        expected_return timestamp,
        resolution_description text,
        resolution_date timestamp,
        total_repair_cost integer DEFAULT 0,
        receipt_url text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    const assetIdCheck = await client.query(`
      SELECT COUNT(*) as cnt FROM equipment WHERE asset_id IS NULL OR asset_id = ''
    `);
    if (parseInt(assetIdCheck.rows[0].cnt) > 0) {
      const rows = await client.query(`SELECT id FROM equipment WHERE asset_id IS NULL OR asset_id = '' ORDER BY created_at`);
      const maxResult = await client.query(`SELECT asset_id FROM equipment WHERE asset_id IS NOT NULL AND asset_id != '' ORDER BY asset_id DESC LIMIT 1`);
      let nextNum = 1;
      if (maxResult.rows.length > 0) {
        const match = maxResult.rows[0].asset_id?.match(/EQ-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      for (const row of rows.rows) {
        const assetId = `EQ-${String(nextNum).padStart(4, "0")}`;
        await client.query(`UPDATE equipment SET asset_id = $1 WHERE id = $2`, [assetId, row.id]);
        nextNum++;
      }
    }

    await client.query("COMMIT");
    console.log("[migration] Equipment schema migration completed");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migration] Equipment migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
