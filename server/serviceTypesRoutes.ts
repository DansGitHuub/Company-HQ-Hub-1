import type { Express } from "express";
import { pool } from "./db";

const SERVICE_TYPE_SEED = [
  { name: "Patio",           category: "Hardscape",    sort_order: 1 },
  { name: "Walkway",         category: "Hardscape",    sort_order: 2 },
  { name: "Retaining Wall",  category: "Hardscape",    sort_order: 3 },
  { name: "Landscape",       category: "Landscape",    sort_order: 4 },
  { name: "Irrigation",      category: "Irrigation",   sort_order: 5 },
  { name: "Spring Clean Up", category: "Seasonal",     sort_order: 6 },
  { name: "Summer Clean Up", category: "Seasonal",     sort_order: 7 },
  { name: "Fall Clean Up",   category: "Seasonal",     sort_order: 8 },
  { name: "Snow Removal",    category: "Snow & Ice",   sort_order: 9 },
  { name: "Salt Application",category: "Snow & Ice",   sort_order: 10 },
  { name: "Full Install",    category: "Installation", sort_order: 11 },
  { name: "Maintenance",     category: "Maintenance",  sort_order: 12 },
  { name: "Drainage",        category: "Other",        sort_order: 13 },
  { name: "Lighting",        category: "Other",        sort_order: 14 },
  { name: "Grading",         category: "Other",        sort_order: 15 },
];

async function migrateServiceTypes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_types (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(100) NOT NULL UNIQUE,
      category   VARCHAR(100) NOT NULL DEFAULT '',
      is_active  BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed if empty
  const { rows } = await pool.query("SELECT COUNT(*) AS n FROM service_types");
  if (parseInt(rows[0].n, 10) === 0) {
    for (const st of SERVICE_TYPE_SEED) {
      await pool.query(
        `INSERT INTO service_types (name, category, sort_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
        [st.name, st.category, st.sort_order]
      );
    }
    console.log("[migration] service_types seeded with", SERVICE_TYPE_SEED.length, "entries");
  }
  console.log("[migration] service_types table ready");
}

export async function registerServiceTypesRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  await migrateServiceTypes();

  // ── PUBLIC-ish: active service types (for inquiry form etc.)
  app.get("/api/service-types/active", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM service_types WHERE is_active = TRUE ORDER BY sort_order, name`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── LIST all (admin)
  app.get("/api/service-types", requireAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM service_types ORDER BY sort_order, name`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CREATE
  app.post("/api/service-types", requireAuth, requireAdmin, async (req, res) => {
    const { name, category = "", is_active = true, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    try {
      const { rows } = await pool.query(
        `INSERT INTO service_types (name, category, is_active, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
        [name.trim(), category.trim(), is_active, sort_order]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ error: "Name already exists" });
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE
  app.patch("/api/service-types/:id", requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, category, is_active, sort_order } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE service_types SET
           name       = COALESCE($1, name),
           category   = COALESCE($2, category),
           is_active  = COALESCE($3, is_active),
           sort_order = COALESCE($4, sort_order)
         WHERE id = $5 RETURNING *`,
        [name ?? null, category ?? null, is_active ?? null, sort_order ?? null, id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ error: "Name already exists" });
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE
  app.delete("/api/service-types/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM service_types WHERE id = $1", [req.params.id]);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── TOGGLE ACTIVE
  app.patch("/api/service-types/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE service_types SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
