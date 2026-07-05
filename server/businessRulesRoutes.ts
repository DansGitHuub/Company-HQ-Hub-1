import type { Express } from "express";
import { pool } from "./db";

interface BusinessRuleSeed {
  key: string;
  label: string;
  description: string;
  category: "Financial" | "Scheduling" | "Workflow";
  value: string;
  value_type: "percentage" | "days" | "minutes" | "currency" | "select";
  options?: string;
  sort_order: number;
}

const BUSINESS_RULE_SEED: BusinessRuleSeed[] = [
  {
    key: "late_fee_percentage",
    label: "Late Fee Percentage",
    description: "Percentage charged on invoice balances that remain unpaid past the grace period.",
    category: "Financial",
    value: "1.5",
    value_type: "percentage",
    sort_order: 1,
  },
  {
    key: "late_fee_grace_period_days",
    label: "Late Fee Grace Period",
    description: "Number of days after the due date before a late fee applies.",
    category: "Financial",
    value: "10",
    value_type: "days",
    sort_order: 2,
  },
  {
    key: "default_invoice_payment_terms",
    label: "Default Invoice Payment Terms",
    description: "Default payment terms applied to new invoices.",
    category: "Financial",
    value: "Net 30",
    value_type: "select",
    options: "Net 15,Net 30,Net 45",
    sort_order: 3,
  },
  {
    key: "default_deposit_percentage",
    label: "Default Deposit Requirement",
    description: "Default deposit percentage required on new estimates.",
    category: "Financial",
    value: "50",
    value_type: "percentage",
    sort_order: 4,
  },
  {
    key: "minimum_lead_time_days",
    label: "Minimum Lead Time",
    description: "Minimum number of days notice required before a job can be scheduled.",
    category: "Scheduling",
    value: "2",
    value_type: "days",
    sort_order: 5,
  },
  {
    key: "double_booking_buffer_minutes",
    label: "Double-Booking Warning Buffer",
    description: "Assumed job duration, in minutes, used to detect crew scheduling conflicts when no end time is set.",
    category: "Scheduling",
    value: "480",
    value_type: "minutes",
    sort_order: 6,
  },
  {
    key: "approval_threshold_dollars",
    label: "Manager Approval Threshold",
    description: "Dollar amount above which an estimate or invoice requires manager approval before it can be sent.",
    category: "Workflow",
    value: "5000",
    value_type: "currency",
    sort_order: 7,
  },
  {
    key: "require_before_after_photos",
    label: "Require Before/After Photos to Complete Jobs",
    description: "When On, a job cannot be marked Completed unless it has at least one before photo and one after photo attached. Turn Off to allow overriding this for an edge case.",
    category: "Workflow",
    value: "On",
    value_type: "select",
    options: "On,Off",
    sort_order: 8,
  },
];

async function migrateBusinessRules() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_rules (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key          VARCHAR(100) NOT NULL UNIQUE,
      label        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      category     VARCHAR(50) NOT NULL,
      value        TEXT NOT NULL,
      value_type   VARCHAR(20) NOT NULL,
      options      TEXT,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by   TEXT
    )
  `);

  // Insert any seed rules that don't exist yet (ON CONFLICT DO NOTHING keeps
  // existing rows — including any admin-edited values — untouched). This lets
  // new rules be added over time without re-running a one-time seed.
  for (const r of BUSINESS_RULE_SEED) {
    await pool.query(
      `INSERT INTO business_rules (key, label, description, category, value, value_type, options, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (key) DO NOTHING`,
      [r.key, r.label, r.description, r.category, r.value, r.value_type, r.options ?? null, r.sort_order]
    );
  }
  console.log("[migration] business_rules table ready");
}

function validateRuleValue(valueType: string, options: string | null, rawValue: string): string | null {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return "Value is required";
  }
  const value = String(rawValue).trim();

  if (valueType === "select") {
    const allowed = (options ?? "").split(",").map(o => o.trim()).filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(value)) {
      return `Value must be one of: ${allowed.join(", ")}`;
    }
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "Value must be a number";
  }
  if (num < 0) {
    return "Value must be a positive number";
  }
  if (valueType === "percentage" && num > 100) {
    return "Percentage cannot exceed 100";
  }
  return null;
}

export async function registerBusinessRulesRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  await migrateBusinessRules();

  // ── LIST all (admin only)
  app.get("/api/business-rules", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM business_rules ORDER BY category, sort_order, label`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE a single rule's value (admin only)
  app.patch("/api/business-rules/:key", requireAuth, requireAdmin, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body ?? {};
    try {
      const existing = await pool.query(`SELECT * FROM business_rules WHERE key = $1`, [key]);
      if (!existing.rows[0]) return res.status(404).json({ error: "Rule not found" });

      const rule = existing.rows[0];
      const error = validateRuleValue(rule.value_type, rule.options, value);
      if (error) return res.status(400).json({ error });

      const updatedByName = req.user?.name || req.user?.username || req.user?.email || null;

      const { rows } = await pool.query(
        `UPDATE business_rules SET value = $1, updated_at = NOW(), updated_by = $2 WHERE key = $3 RETURNING *`,
        [String(value).trim(), updatedByName, key]
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
