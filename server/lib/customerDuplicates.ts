import { pool } from "../db";

export interface CustomerDuplicate {
  id: string;
  label: string;
  matched_on: ("email" | "phone")[];
}

function buildLabel(row: {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  if (name && row.company_name) return `${name} (${row.company_name})`;
  return name || row.company_name || "Unknown";
}

// SQL fragment shared by both queries: exclude sentinel/test rows
const EXCLUSION_SQL = `
  AND c.is_active = true
  AND c.first_name NOT LIKE '*%'
  AND (c.company_name IS NULL OR c.company_name NOT LIKE '*%')
  AND c.first_name    NOT ILIKE '%TEMPLATES%'
  AND c.last_name     NOT ILIKE '%TEMPLATES%'
  AND COALESCE(c.company_name, '') NOT ILIKE '%TEMPLATES%'
  AND c.first_name    NOT ILIKE '%Test Test%'
  AND c.last_name     NOT ILIKE '%Test Test%'
  AND COALESCE(c.company_name, '') NOT ILIKE '%Test Test%'
`;

export async function findCustomerDuplicates(
  customerId: string
): Promise<CustomerDuplicate[]> {
  // Accumulate matches keyed by customer id
  const map = new Map<string, CustomerDuplicate>();

  const merge = (
    row: { id: string; first_name: string | null; last_name: string | null; company_name: string | null },
    field: "email" | "phone"
  ) => {
    const existing = map.get(row.id);
    if (existing) {
      if (!existing.matched_on.includes(field)) existing.matched_on.push(field);
    } else {
      map.set(row.id, { id: row.id, label: buildLabel(row), matched_on: [field] });
    }
  };

  // ── Email matches ─────────────────────────────────────────────────────────────
  const { rows: emailRows } = await pool.query<{
    id: string; first_name: string | null; last_name: string | null; company_name: string | null;
  }>(`
    SELECT DISTINCT c.id, c.first_name, c.last_name, c.company_name
    FROM   customer_emails  ce_target
    JOIN   customer_emails  ce_other
           ON  LOWER(ce_other.email) = LOWER(ce_target.email)
           AND ce_other.customer_id <> $1
    JOIN   customers c ON c.id = ce_other.customer_id
    WHERE  ce_target.customer_id = $1
      AND  ce_target.email IS NOT NULL
      AND  ce_target.email <> ''
      ${EXCLUSION_SQL}
  `, [customerId]);

  for (const row of emailRows) merge(row, "email");

  // ── Phone matches ─────────────────────────────────────────────────────────────
  // Normalize both sides to digits-only; skip target phones shorter than 10 digits
  const { rows: phoneRows } = await pool.query<{
    id: string; first_name: string | null; last_name: string | null; company_name: string | null;
  }>(`
    SELECT DISTINCT c.id, c.first_name, c.last_name, c.company_name
    FROM   customer_phones  cp_target
    JOIN   customer_phones  cp_other
           ON  REGEXP_REPLACE(cp_other.phone, '[^0-9]', '', 'g')
             = REGEXP_REPLACE(cp_target.phone, '[^0-9]', '', 'g')
           AND cp_other.customer_id <> $1
    JOIN   customers c ON c.id = cp_other.customer_id
    WHERE  cp_target.customer_id = $1
      AND  LENGTH(REGEXP_REPLACE(cp_target.phone, '[^0-9]', '', 'g')) >= 10
      ${EXCLUSION_SQL}
  `, [customerId]);

  for (const row of phoneRows) merge(row, "phone");

  return Array.from(map.values());
}
