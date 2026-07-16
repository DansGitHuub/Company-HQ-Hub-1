import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";

const WIZARD_KEY = "setup_wizard_progress";

export type StepStatus = "not_started" | "complete" | "skipped";

export interface WizardProgress {
  business_info: StepStatus;
  branding: StepStatus;
  regional: StepStatus;
  employees: StepStatus;
  catalog: StepStatus;
  integrations: StepStatus;
  routes: StepStatus;
  permissions: StepStatus;
  notifications: StepStatus;
  dismissed_at: string | null;
}

const DEFAULT_PROGRESS: WizardProgress = {
  business_info: "not_started",
  branding: "not_started",
  regional: "not_started",
  employees: "not_started",
  catalog: "not_started",
  integrations: "not_started",
  routes: "not_started",
  permissions: "not_started",
  notifications: "not_started",
  dismissed_at: null,
};

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user?.role !== "Admin" && !user?.isMasterAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function seedSetupWizardProgress(): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING`,
    [WIZARD_KEY, JSON.stringify(DEFAULT_PROGRESS)]
  );
  console.log("[migration] setup_wizard_progress seeded");
}

export function registerSetupWizardRoutes(app: Express): void {
  // GET /api/setup-wizard/progress
  app.get("/api/setup-wizard/progress", requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = $1`,
        [WIZARD_KEY]
      );
      if (!rows.length) return res.json(DEFAULT_PROGRESS);
      const raw = rows[0].value;
      const progress = typeof raw === "string" ? JSON.parse(raw) : raw;
      res.json({ ...DEFAULT_PROGRESS, ...progress });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/setup-wizard/progress — merge updates into existing progress
  app.patch("/api/setup-wizard/progress", requireAdmin, async (req: any, res) => {
    try {
      const updates = req.body as Partial<WizardProgress>;

      const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = $1`,
        [WIZARD_KEY]
      );
      const existing: WizardProgress = rows.length
        ? { ...DEFAULT_PROGRESS, ...(typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value) }
        : { ...DEFAULT_PROGRESS };

      const updated: WizardProgress = { ...existing, ...updates };

      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [WIZARD_KEY, JSON.stringify(updated)]
      );

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
