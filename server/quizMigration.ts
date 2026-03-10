import { pool } from "./db";

export async function runQuizAdaptiveMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE sop_quiz_questions
        ADD COLUMN IF NOT EXISTS difficulty_level integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS audience_roles jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await client.query(`
      ALTER TABLE user_quiz_attempts
        ADD COLUMN IF NOT EXISTS questions_served jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS current_difficulty integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS highest_level_passed integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS final_score_label text
    `);

    await client.query(`
      ALTER TABLE sop_quizzes
        ADD COLUMN IF NOT EXISTS min_pass_level integer NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS is_safety_critical boolean NOT NULL DEFAULT false
    `);

    console.log("[migration] Quiz adaptive difficulty migration completed");
  } catch (err: any) {
    if (err.code === "42701") {
      console.log("[migration] Quiz adaptive columns already exist");
    } else {
      console.error("[migration] Quiz adaptive migration error:", err);
      throw err;
    }
  } finally {
    client.release();
  }
}
