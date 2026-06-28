import { pool } from "../db";

export async function runCandidateGradeStatusMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE candidates
        ADD COLUMN IF NOT EXISTS grade text,
        ADD COLUMN IF NOT EXISTS candidate_status text NOT NULL DEFAULT 'Active';
    `);
    console.log("[migration] candidates grade + candidate_status columns ready");
  } catch (err: any) {
    console.error("[migration] candidateGradeStatus migration error:", err.message);
  } finally {
    client.release();
  }
}
