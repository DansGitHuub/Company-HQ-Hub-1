import type { Express } from "express";
import { pool } from "./db";

interface FeatureFlagSeed {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

// Add new flags here as future unfinished modules need to be gated.
// ON CONFLICT (key) DO NOTHING keeps any admin-edited values untouched
// on restart, so this list is additive-only.
const FEATURE_FLAG_SEED: FeatureFlagSeed[] = [
  {
    key: "translation_toggle",
    label: "Language / Translation Toggle",
    description: "Shows the English/Spanish language switcher in the top-right corner for regular (non-admin) users. Admins can always see it regardless of this setting. The translation feature is still a work in progress, so this defaults to Off.",
    enabled: false,
  },
];

async function migrateFeatureFlags() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key          VARCHAR(100) NOT NULL UNIQUE,
      label        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      enabled      BOOLEAN NOT NULL DEFAULT false,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by   TEXT
    )
  `);

  for (const f of FEATURE_FLAG_SEED) {
    await pool.query(
      `INSERT INTO feature_flags (key, label, description, enabled)
       VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING`,
      [f.key, f.label, f.description, f.enabled]
    );
  }
  console.log("[migration] feature_flags table ready");
}

export async function registerFeatureFlagsRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  await migrateFeatureFlags();

  // ── LIST all (admin only) — full detail for the management screen ──────
  app.get("/api/feature-flags", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM feature_flags ORDER BY label`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PUBLIC read (any authenticated user) — lightweight key->enabled map
  // used by the client to decide whether to show/hide gated UI elements.
  app.get("/api/feature-flags/public", requireAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(`SELECT key, enabled FROM feature_flags`);
      const map: Record<string, boolean> = {};
      for (const r of rows) map[r.key] = r.enabled;
      res.json(map);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE a single flag's enabled state (admin only) ───────────────────
  app.patch("/api/feature-flags/:key", requireAuth, requireAdmin, async (req, res) => {
    const { key } = req.params;
    const { enabled } = req.body ?? {};
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }
    try {
      const existing = await pool.query(`SELECT * FROM feature_flags WHERE key = $1`, [key]);
      if (!existing.rows[0]) return res.status(404).json({ error: "Feature flag not found" });

      const updatedByName = req.user?.name || req.user?.username || req.user?.email || null;

      const { rows } = await pool.query(
        `UPDATE feature_flags SET enabled = $1, updated_at = NOW(), updated_by = $2 WHERE key = $3 RETURNING *`,
        [enabled, updatedByName, key]
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
