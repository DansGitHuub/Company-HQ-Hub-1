import type { Express } from "express";
import { pool } from "./db";

interface AutomationSeed {
  key: string;
  label: string;
  description: string;
  category: "Status Triggers" | "Reminders & Escalations" | "Recurring Jobs";
  config: Record<string, unknown>;
  sort_order: number;
}

const AUTOMATION_SEED: AutomationSeed[] = [
  {
    key: "job_completed_send_invoice",
    label: "Auto-Send Invoice on Job Completion",
    description: "When a job is marked Completed, automatically send its draft invoice (only fires when exactly one draft invoice exists for the job).",
    category: "Status Triggers",
    config: {},
    sort_order: 1,
  },
  {
    key: "estimate_approved_create_job",
    label: "Auto-Create Job on Estimate Approval",
    description: "When an estimate is approved (by staff or by the customer through the portal), automatically convert it into a job.",
    category: "Status Triggers",
    config: {},
    sort_order: 2,
  },
  {
    key: "missing_worksheet_daily_check",
    label: "Missing Worksheet Daily Check",
    description: "Enables the existing daily check that alerts managers about crews with a missing end-of-shift worksheet. Notifications are in-app only.",
    category: "Reminders & Escalations",
    config: {},
    sort_order: 3,
  },
  {
    key: "invoice_late_fee_flagging",
    label: "Late Invoice Flagging",
    description: "Daily check that flags invoices past their late-fee grace period (from Business Rules) for admin review. In-app notification only, never emails the customer.",
    category: "Reminders & Escalations",
    config: {},
    sort_order: 4,
  },
  {
    key: "recurring_job_generation",
    label: "Recurring Job Auto-Generation",
    description: "For selected recurring customers, automatically create their next job (cloned from their most recent job) a configurable number of days before the prior job's completion date.",
    category: "Recurring Jobs",
    config: { daysBefore: 7, customerIds: [] },
    sort_order: 5,
  },
];

export async function migrateAutomations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS automations (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key          VARCHAR(100) NOT NULL UNIQUE,
      label        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      category     VARCHAR(50) NOT NULL,
      enabled      BOOLEAN NOT NULL DEFAULT false,
      config       JSONB NOT NULL DEFAULT '{}'::jsonb,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      last_run_at  TIMESTAMPTZ,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by   TEXT
    )
  `);

  const { rows } = await pool.query("SELECT COUNT(*) AS n FROM automations");
  if (parseInt(rows[0].n, 10) === 0) {
    for (const a of AUTOMATION_SEED) {
      await pool.query(
        `INSERT INTO automations (key, label, description, category, enabled, config, sort_order)
         VALUES ($1,$2,$3,$4,false,$5,$6) ON CONFLICT (key) DO NOTHING`,
        [a.key, a.label, a.description, a.category, JSON.stringify(a.config), a.sort_order]
      );
    }
    console.log("[migration] automations seeded with", AUTOMATION_SEED.length, "entries (all disabled by default)");
  }
  console.log("[migration] automations table ready");
}

function validateConfig(key: string, config: any): string | null {
  if (config === undefined || config === null) return null;
  if (typeof config !== "object" || Array.isArray(config)) {
    return "config must be an object";
  }
  if (key === "recurring_job_generation") {
    if (config.daysBefore !== undefined) {
      const n = Number(config.daysBefore);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        return "daysBefore must be a positive whole number";
      }
    }
    if (config.customerIds !== undefined) {
      if (!Array.isArray(config.customerIds) || !config.customerIds.every((c: any) => typeof c === "string")) {
        return "customerIds must be an array of customer ids";
      }
    }
  }
  return null;
}

export async function registerAutomationRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  await migrateAutomations();

  // ── LIST all (admin only) ──────────────────────────────────────────────
  app.get("/api/automations", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM automations ORDER BY category, sort_order, label`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE a single automation's enabled flag and/or config (admin only) ──
  app.patch("/api/automations/:key", requireAuth, requireAdmin, async (req, res) => {
    const { key } = req.params;
    const { enabled, config } = req.body ?? {};
    try {
      const existing = await pool.query(`SELECT * FROM automations WHERE key = $1`, [key]);
      if (!existing.rows[0]) return res.status(404).json({ error: "Automation not found" });

      if (enabled !== undefined && typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }

      const configError = validateConfig(key, config);
      if (configError) return res.status(400).json({ error: configError });

      const rule = existing.rows[0];
      const nextEnabled = enabled !== undefined ? enabled : rule.enabled;
      const nextConfig = config !== undefined ? { ...rule.config, ...config } : rule.config;
      const updatedByName = req.user?.name || req.user?.username || req.user?.email || null;

      const { rows } = await pool.query(
        `UPDATE automations SET enabled = $1, config = $2, updated_at = NOW(), updated_by = $3 WHERE key = $4 RETURNING *`,
        [nextEnabled, JSON.stringify(nextConfig), updatedByName, key]
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
