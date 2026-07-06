import { pool } from "../db";
import { looksLikeTestAccount } from "../testAccountHeuristic";

// Adds the is_test_account safety flag used to gate the admin password-reset
// route. Defaults to false (safe) for every account. Existing accounts that
// already match the known test-account naming conventions are backfilled to
// true so history stays consistent with the new safeguard — real named
// accounts (see REAL_USERNAMES in testAccountHeuristic.ts) are never
// auto-flagged.
export async function runTestAccountFlagMigration() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT false
  `);

  const { rows } = await pool.query<{ id: string; username: string; email: string | null; is_test_account: boolean }>(
    `SELECT id, username, email, is_test_account FROM users`
  );

  for (const row of rows) {
    if (row.is_test_account) continue;
    if (looksLikeTestAccount(row.username, row.email)) {
      await pool.query(`UPDATE users SET is_test_account = true WHERE id = $1`, [row.id]);
    }
  }

  console.log("[migration] is_test_account column ready");
}
