import { pool } from "../db";

export async function runCheckpointsMigration() {
  // Checkpoint templates (reusable across job types)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkpoint_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      checkpoint_type VARCHAR(30) NOT NULL DEFAULT 'photo',
      requires_photo BOOLEAN NOT NULL DEFAULT false,
      requires_note BOOLEAN NOT NULL DEFAULT false,
      requires_checkbox BOOLEAN NOT NULL DEFAULT false,
      assigned_role VARCHAR(30) DEFAULT 'Crew',
      job_stage VARCHAR(50),
      customer_visible BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Per-job checkpoint instances
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_checkpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id VARCHAR(36) NOT NULL,
      template_id UUID REFERENCES checkpoint_templates(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      checkpoint_type VARCHAR(30) NOT NULL DEFAULT 'photo',
      requires_photo BOOLEAN NOT NULL DEFAULT false,
      requires_note BOOLEAN NOT NULL DEFAULT false,
      requires_checkbox BOOLEAN NOT NULL DEFAULT false,
      assigned_role VARCHAR(30) DEFAULT 'Crew',
      job_stage VARCHAR(50),
      customer_visible BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      completed_by VARCHAR(36),
      completed_at TIMESTAMP,
      photo_url TEXT,
      note TEXT,
      checked BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_checkpoints_job_id ON job_checkpoints(job_id);
  `);

  // Seed default checkpoint templates
  await pool.query(`
    INSERT INTO checkpoint_templates (name, description, checkpoint_type, requires_photo, requires_note, assigned_role, customer_visible, sort_order)
    VALUES
      ('Pre-Construction Photos', 'Take photos of site before any work begins.', 'photo', true, false, 'Crew', false, 1),
      ('Base/Excavation Inspection', 'Verify excavation depth and base material before proceeding.', 'checkbox', false, true, 'Manager', false, 2),
      ('Wall Drainage Before Backfill', 'Confirm drainage pipe installed before backfilling retaining wall.', 'photo', true, true, 'Crew', false, 3),
      ('Planting Layout Approval', 'Get customer approval of plant placement before digging.', 'photo', true, true, 'Crew', true, 4),
      ('Lighting Test', 'Test all landscape lighting before final cleanup.', 'checkbox', false, true, 'Crew', false, 5),
      ('Final Cleanup', 'Site cleanup complete — no debris, tools removed, surfaces swept.', 'checkbox', true, false, 'Crew', false, 6),
      ('Customer Walkthrough', 'Walk customer through completed work and get sign-off.', 'photo', true, true, 'Manager', true, 7)
    ON CONFLICT DO NOTHING
  `);

  console.log("[migration] checkpoint_templates + job_checkpoints tables ready");
}
