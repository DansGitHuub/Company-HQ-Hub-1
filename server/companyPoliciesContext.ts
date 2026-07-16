import { pool } from "./db";

/**
 * Loads all answered company policies and formats them as a concise
 * context block for injection into AI system prompts.
 *
 * Returns an empty string if nothing has been answered yet so that
 * callers can guard with a simple truthiness check.
 */
export async function buildCompanyPolicyContext(): Promise<string> {
  try {
    const { rows } = await pool.query(
      `SELECT question, answer, category
       FROM company_policies
       WHERE is_active = true
         AND answer IS NOT NULL
         AND answer != ''
       ORDER BY category, sort_order`
    );
    if (!rows.length) return "";

    const lines = rows.map((r: any) => `- ${r.question} → ${r.answer}`);
    return `Company Policies & Preferences (apply these when relevant):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}
