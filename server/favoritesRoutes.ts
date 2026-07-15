import { pool } from "./db";
import { Express } from "express";

export async function registerFavoritesRoutes(app: Express, requireAuth: any) {
  await pool.query(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS measurement_unit TEXT NOT NULL DEFAULT 'imperial'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS larger_text BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS high_contrast BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('report','customer','job')),
      entity_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, entity_type, entity_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS user_favorites_user_entity_idx ON user_favorites(user_id, entity_type)`);

  app.get("/api/favorites", requireAuth, async (req: any, res: any) => {
    try {
      const { entity_type } = req.query;
      const userId = req.user.id;
      let q = "SELECT * FROM user_favorites WHERE user_id = $1";
      const params: any[] = [userId];
      if (entity_type) {
        params.push(entity_type);
        q += ` AND entity_type = $${params.length}`;
      }
      q += " ORDER BY created_at DESC";
      const result = await pool.query(q, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/favorites", requireAuth, async (req: any, res: any) => {
    try {
      const { entity_type, entity_id } = req.body;
      if (!entity_type || !entity_id)
        return res.status(400).json({ error: "entity_type and entity_id required" });
      if (!["report", "customer", "job"].includes(entity_type))
        return res.status(400).json({ error: "Invalid entity_type" });
      const userId = req.user.id;
      const result = await pool.query(
        `INSERT INTO user_favorites (user_id, entity_type, entity_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING
         RETURNING *`,
        [userId, entity_type, entity_id]
      );
      if (result.rows.length === 0) {
        const existing = await pool.query(
          `SELECT * FROM user_favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
          [userId, entity_type, entity_id]
        );
        return res.json(existing.rows[0]);
      }
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/favorites/by-entity", requireAuth, async (req: any, res: any) => {
    try {
      const { entity_type, entity_id } = req.query as Record<string, string>;
      if (!entity_type || !entity_id)
        return res.status(400).json({ error: "entity_type and entity_id required" });
      const userId = req.user.id;
      await pool.query(
        `DELETE FROM user_favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [userId, entity_type, entity_id]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/favorites/:id", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      await pool.query(
        `DELETE FROM user_favorites WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
