import { Express } from "express";
import { pool } from "./db";
import { requireAuth } from "./auth";

// ── Duplicate-pair detection SQL ──────────────────────────────────────────────
// Finds active customer pairs that share name, company, address, or primary email.
// Excludes pairs the admin has already dismissed.
const DUPLICATE_PAIRS_SQL = `
  WITH name_pairs AS (
    SELECT a.id AS low_id, b.id AS high_id, 'Same name' AS reason
    FROM customers a
    JOIN customers b ON b.id > a.id
    WHERE a.is_active AND b.is_active
      AND TRIM(a.first_name) != '' AND TRIM(a.last_name) != ''
      AND LOWER(TRIM(a.first_name)) = LOWER(TRIM(b.first_name))
      AND LOWER(TRIM(a.last_name))  = LOWER(TRIM(b.last_name))
  ),
  company_pairs AS (
    SELECT a.id AS low_id, b.id AS high_id, 'Same company' AS reason
    FROM customers a
    JOIN customers b ON b.id > a.id
    WHERE a.is_active AND b.is_active
      AND a.company_name IS NOT NULL AND TRIM(a.company_name) != ''
      AND LOWER(TRIM(a.company_name)) = LOWER(TRIM(b.company_name))
  ),
  address_pairs AS (
    SELECT a.id AS low_id, b.id AS high_id, 'Same address' AS reason
    FROM customers a
    JOIN customers b ON b.id > a.id
    WHERE a.is_active AND b.is_active
      AND a.billing_zip IS NOT NULL AND TRIM(a.billing_zip) != ''
      AND a.billing_address IS NOT NULL AND TRIM(a.billing_address) != ''
      AND LOWER(TRIM(a.billing_zip))     = LOWER(TRIM(b.billing_zip))
      AND LOWER(TRIM(a.billing_address)) = LOWER(TRIM(b.billing_address))
  ),
  email_pairs AS (
    SELECT ea.customer_id AS low_id, eb.customer_id AS high_id, 'Same email' AS reason
    FROM customer_emails ea
    JOIN customer_emails eb
      ON LOWER(TRIM(ea.email)) = LOWER(TRIM(eb.email))
     AND ea.customer_id < eb.customer_id
    JOIN customers ca ON ca.id = ea.customer_id AND ca.is_active
    JOIN customers cb ON cb.id = eb.customer_id AND cb.is_active
    WHERE ea.email IS NOT NULL AND TRIM(ea.email) != ''
  ),
  all_pairs AS (
    SELECT * FROM name_pairs
    UNION ALL SELECT * FROM company_pairs
    UNION ALL SELECT * FROM address_pairs
    UNION ALL SELECT * FROM email_pairs
  ),
  grouped AS (
    SELECT low_id, high_id,
           array_agg(DISTINCT reason ORDER BY reason) AS reasons
    FROM all_pairs
    GROUP BY low_id, high_id
  )
  SELECT
    a.id            AS id_a,
    a.first_name    AS first_name_a,
    a.last_name     AS last_name_a,
    a.company_name  AS company_name_a,
    a.billing_address AS billing_address_a,
    a.billing_city  AS billing_city_a,
    a.billing_zip   AS billing_zip_a,
    a.created_at    AS created_at_a,
    (SELECT email FROM customer_emails WHERE customer_id = a.id AND is_primary = true LIMIT 1) AS email_a,
    (SELECT phone FROM customer_phones WHERE customer_id = a.id AND is_primary = true LIMIT 1) AS phone_a,
    (SELECT COUNT(*)::int FROM jobs          WHERE customer_id = a.id) AS job_count_a,
    (SELECT COUNT(*)::int FROM sales_estimates WHERE customer_id = a.id) AS estimate_count_a,

    b.id            AS id_b,
    b.first_name    AS first_name_b,
    b.last_name     AS last_name_b,
    b.company_name  AS company_name_b,
    b.billing_address AS billing_address_b,
    b.billing_city  AS billing_city_b,
    b.billing_zip   AS billing_zip_b,
    b.created_at    AS created_at_b,
    (SELECT email FROM customer_emails WHERE customer_id = b.id AND is_primary = true LIMIT 1) AS email_b,
    (SELECT phone FROM customer_phones WHERE customer_id = b.id AND is_primary = true LIMIT 1) AS phone_b,
    (SELECT COUNT(*)::int FROM jobs          WHERE customer_id = b.id) AS job_count_b,
    (SELECT COUNT(*)::int FROM sales_estimates WHERE customer_id = b.id) AS estimate_count_b,

    g.reasons
  FROM grouped g
  JOIN customers a ON a.id = g.low_id
  JOIN customers b ON b.id = g.high_id
  WHERE NOT EXISTS (
    SELECT 1 FROM customer_duplicate_dismissals d
    WHERE (d.customer_id_a = g.low_id  AND d.customer_id_b = g.high_id)
       OR (d.customer_id_a = g.high_id AND d.customer_id_b = g.low_id)
  )
  ORDER BY array_length(g.reasons, 1) DESC, a.last_name
  LIMIT 100
`;

export function registerDuplicateCustomerRoutes(app: Express) {
  // GET /api/admin/customers/duplicate-pairs
  // Returns up to 100 likely-duplicate pairs, with similarity reasons and basic stats.
  app.get("/api/admin/customers/duplicate-pairs", requireAuth, async (_req: any, res: any) => {
    try {
      const { rows } = await pool.query(DUPLICATE_PAIRS_SQL);
      return res.json(rows);
    } catch (err: any) {
      console.error("[duplicate-pairs] query error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/customers/duplicate-pairs/dismiss
  // Body: { customer_id_a, customer_id_b }
  // Records that these two customers are NOT duplicates and should be hidden from the queue.
  app.post("/api/admin/customers/duplicate-pairs/dismiss", requireAuth, async (req: any, res: any) => {
    const { customer_id_a, customer_id_b } = req.body ?? {};
    if (!customer_id_a || !customer_id_b) {
      return res.status(400).json({ message: "customer_id_a and customer_id_b are required" });
    }
    // Always store with the smaller UUID first for consistent uniqueness
    const [low, high] = [customer_id_a, customer_id_b].sort();
    try {
      await pool.query(
        `INSERT INTO customer_duplicate_dismissals (customer_id_a, customer_id_b, dismissed_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (customer_id_a, customer_id_b) DO NOTHING`,
        [low, high, req.user?.id ?? null]
      );
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[duplicate-dismiss] error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/customers/merge
  // Body: { keep_id, merge_id }
  // Merges merge_id INTO keep_id: all linked records are reassigned to keep_id,
  // data fields are coalesced, and merge_id is soft-deleted (is_active = false).
  app.post("/api/admin/customers/merge", requireAuth, async (req: any, res: any) => {
    const { keep_id, merge_id } = req.body ?? {};
    if (!keep_id || !merge_id) {
      return res.status(400).json({ message: "keep_id and merge_id are required" });
    }
    if (keep_id === merge_id) {
      return res.status(400).json({ message: "keep_id and merge_id must be different customers" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify both exist and are active
      const { rows: both } = await client.query(
        `SELECT id FROM customers WHERE id = ANY($1::uuid[]) AND is_active = true`,
        [[keep_id, merge_id]]
      );
      if (both.length < 2) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "One or both customers not found or already inactive" });
      }

      // ── Reassign simple FK tables ─────────────────────────────────────────
      const simpleFkTables: [string, string][] = [
        ["jobs",              "customer_id"],
        ["sales_estimates",   "customer_id"],
        ["invoices",          "customer_id"],
        ["payments",          "customer_id"],
        ["consultations",     "customer_id"],
        ["companycam_projects","customer_id"],
        ["voice_transcripts", "customer_id"],
        ["properties",        "customer_id"],
        ["customer_contacts", "customer_id"],
        ["customer_documents","customer_id"],
      ];
      for (const [table, col] of simpleFkTables) {
        try {
          await client.query(
            `UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`,
            [keep_id, merge_id]
          );
        } catch {
          // table may not exist in all deployments — skip gracefully
        }
      }

      // voice_transcripts.suggested_customer_id
      await client.query(
        `UPDATE voice_transcripts SET suggested_customer_id = $1 WHERE suggested_customer_id = $2`,
        [keep_id, merge_id]
      );

      // ── Emails: dedup then reassign ───────────────────────────────────────
      // Delete merge_id emails that already exist on keep_id
      await client.query(
        `DELETE FROM customer_emails me
         WHERE me.customer_id = $1
           AND EXISTS (
             SELECT 1 FROM customer_emails ke
             WHERE ke.customer_id = $2 AND LOWER(TRIM(ke.email)) = LOWER(TRIM(me.email))
           )`,
        [merge_id, keep_id]
      );
      // Reassign remaining (mark non-primary so keep's primary wins)
      await client.query(
        `UPDATE customer_emails SET customer_id = $1, is_primary = false WHERE customer_id = $2`,
        [keep_id, merge_id]
      );

      // ── Phones: dedup then reassign ───────────────────────────────────────
      await client.query(
        `DELETE FROM customer_phones mp
         WHERE mp.customer_id = $1
           AND EXISTS (
             SELECT 1 FROM customer_phones kp
             WHERE kp.customer_id = $2 AND kp.phone = mp.phone
           )`,
        [merge_id, keep_id]
      );
      await client.query(
        `UPDATE customer_phones SET customer_id = $1, is_primary = false WHERE customer_id = $2`,
        [keep_id, merge_id]
      );

      // ── Coalesce non-null fields from merge into keep ─────────────────────
      await client.query(
        `UPDATE customers SET
           notes                 = COALESCE(NULLIF(TRIM(notes), ''),
                                    (SELECT NULLIF(TRIM(notes), '') FROM customers WHERE id = $2)),
           billing_address       = COALESCE(NULLIF(TRIM(billing_address), ''),
                                    (SELECT NULLIF(TRIM(billing_address), '') FROM customers WHERE id = $2)),
           billing_city          = COALESCE(NULLIF(TRIM(billing_city), ''),
                                    (SELECT NULLIF(TRIM(billing_city), '') FROM customers WHERE id = $2)),
           billing_state         = COALESCE(NULLIF(TRIM(billing_state), ''),
                                    (SELECT NULLIF(TRIM(billing_state), '') FROM customers WHERE id = $2)),
           billing_zip           = COALESCE(NULLIF(TRIM(billing_zip), ''),
                                    (SELECT NULLIF(TRIM(billing_zip), '') FROM customers WHERE id = $2)),
           companycam_project_id = COALESCE(companycam_project_id,
                                    (SELECT companycam_project_id FROM customers WHERE id = $2)),
           qb_customer_id        = COALESCE(qb_customer_id,
                                    (SELECT qb_customer_id FROM customers WHERE id = $2)),
           source                = COALESCE(NULLIF(TRIM(source), ''),
                                    (SELECT NULLIF(TRIM(source), '') FROM customers WHERE id = $2)),
           updated_at            = NOW()
         WHERE id = $1`,
        [keep_id, merge_id]
      );

      // ── Soft-delete merge_id ──────────────────────────────────────────────
      await client.query(
        `UPDATE customers SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [merge_id]
      );

      // ── Remove any dismissal records involving merge_id ───────────────────
      await client.query(
        `DELETE FROM customer_duplicate_dismissals
          WHERE customer_id_a = $1 OR customer_id_b = $1`,
        [merge_id]
      );

      await client.query("COMMIT");
      console.log(`[customer-merge] Merged ${merge_id} → ${keep_id}`);
      return res.json({ ok: true });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[customer-merge] Error:", err.message);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });
}
