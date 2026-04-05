import type { Express } from "express";
import { db, pool } from "./db";
import { catalogItems, catalogTags, catalogItemTags } from "@shared/schema";
import { eq, and, ilike, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { parse } from "csv-parse/sync";

const upload = multer({ storage: multer.memoryStorage() });

async function nextItemNumber(): Promise<string> {
  const result = await pool.query<{ max_num: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(item_number FROM 6) AS INTEGER)) AS max_num FROM catalog_items`
  );
  const max = result.rows[0]?.max_num ?? null;
  const next = max ? parseInt(max) + 1 : 1;
  return `ITEM-${String(next).padStart(6, "0")}`;
}

async function getItemWithTags(id: number) {
  const item = await db.query.catalogItems.findFirst({ where: eq(catalogItems.id, id) });
  if (!item) return null;
  const tagRows = await pool.query<{ id: number; name: string }>(
    `SELECT t.id, t.name FROM catalog_tags t JOIN catalog_item_tags cit ON cit.tag_id = t.id WHERE cit.item_id = $1`,
    [id]
  );
  return { ...item, tags: tagRows.rows };
}

async function syncItemTags(itemId: number, tagNames: string[]) {
  await pool.query(`DELETE FROM catalog_item_tags WHERE item_id = $1`, [itemId]);
  for (const name of tagNames) {
    if (!name.trim()) continue;
    const trimmed = name.trim();
    let tagRow = await pool.query<{ id: number }>(`SELECT id FROM catalog_tags WHERE name = $1`, [trimmed]);
    let tagId: number;
    if (tagRow.rows.length === 0) {
      const ins = await pool.query<{ id: number }>(`INSERT INTO catalog_tags (name) VALUES ($1) RETURNING id`, [trimmed]);
      tagId = ins.rows[0].id;
    } else {
      tagId = tagRow.rows[0].id;
    }
    await pool.query(
      `INSERT INTO catalog_item_tags (item_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [itemId, tagId]
    );
  }
}

export function registerCatalogRoutes(app: Express, requireAuth: any) {
  // Run migration on startup
  (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalog_items (
        id SERIAL PRIMARY KEY,
        item_number VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        class VARCHAR(50),
        category VARCHAR(100),
        units VARCHAR(50),
        cost NUMERIC(10,2) DEFAULT 0,
        taxable BOOLEAN DEFAULT FALSE,
        description TEXT,
        sku VARCHAR(100),
        other_options TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalog_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalog_item_tags (
        item_id INTEGER NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES catalog_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, tag_id)
      )
    `);
    console.log("[migration] Catalog tables ready");
  })();

  // GET /api/catalog
  app.get("/api/catalog", requireAuth, async (req, res) => {
    try {
      const { class: cls, category, search, active_only, tag } = req.query as Record<string, string>;
      let q = `SELECT ci.*, COALESCE(json_agg(json_build_object('id', ct.id, 'name', ct.name)) FILTER (WHERE ct.id IS NOT NULL), '[]') AS tags
               FROM catalog_items ci
               LEFT JOIN catalog_item_tags cit ON cit.item_id = ci.id
               LEFT JOIN catalog_tags ct ON ct.id = cit.tag_id`;
      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (active_only !== "false") { conditions.push(`ci.is_active = TRUE`); }
      if (cls) { conditions.push(`ci.class = $${idx++}`); params.push(cls); }
      if (category) { conditions.push(`ci.category = $${idx++}`); params.push(category); }
      if (search) {
        conditions.push(`(ci.name ILIKE $${idx} OR ci.item_number ILIKE $${idx} OR ci.sku ILIKE $${idx} OR ci.description ILIKE $${idx})`);
        params.push(`%${search}%`); idx++;
      }
      if (conditions.length) q += ` WHERE ` + conditions.join(" AND ");
      q += ` GROUP BY ci.id`;
      if (tag) {
        q += ` HAVING json_agg(ct.name) @> $${idx}::jsonb`;
        params.push(JSON.stringify([tag])); idx++;
      }
      q += ` ORDER BY ci.item_number`;
      const result = await pool.query(q, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/catalog
  app.post("/api/catalog", requireAuth, async (req, res) => {
    try {
      const { tags = [], ...body } = req.body;
      const itemNumber = await nextItemNumber();
      const result = await pool.query<{ id: number }>(
        `INSERT INTO catalog_items (item_number, name, class, category, units, cost, taxable, description, sku, other_options, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [itemNumber, body.name, body.class ?? null, body.category ?? null, body.units ?? null,
         body.cost ?? 0, body.taxable ?? false, body.description ?? null, body.sku ?? null,
         body.other_options ?? null, body.is_active ?? true]
      );
      const id = result.rows[0].id;
      if (Array.isArray(tags) && tags.length) await syncItemTags(id, tags);
      const item = await getItemWithTags(id);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/catalog/categories
  app.get("/api/catalog/categories", requireAuth, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT category FROM catalog_items WHERE category IS NOT NULL AND category <> '' ORDER BY category`
      );
      res.json(result.rows.map((r: any) => r.category));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/catalog/tags
  app.get("/api/catalog/tags", requireAuth, async (_req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM catalog_tags ORDER BY name`);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/catalog/tags
  app.post("/api/catalog/tags", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name required" });
      const result = await pool.query(
        `INSERT INTO catalog_tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING *`,
        [name.trim()]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/catalog/:id
  app.get("/api/catalog/:id", requireAuth, async (req, res) => {
    try {
      const item = await getItemWithTags(parseInt(req.params.id));
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/catalog/:id
  app.put("/api/catalog/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { tags = [], ...body } = req.body;
      await pool.query(
        `UPDATE catalog_items SET name=$1, class=$2, category=$3, units=$4, cost=$5, taxable=$6,
         description=$7, sku=$8, other_options=$9, is_active=$10, updated_at=NOW() WHERE id=$11`,
        [body.name, body.class ?? null, body.category ?? null, body.units ?? null,
         body.cost ?? 0, body.taxable ?? false, body.description ?? null, body.sku ?? null,
         body.other_options ?? null, body.is_active ?? true, id]
      );
      if (Array.isArray(tags)) await syncItemTags(id, tags);
      const item = await getItemWithTags(id);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/catalog/:id  (soft delete)
  app.delete("/api/catalog/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await pool.query(`UPDATE catalog_items SET is_active=FALSE, updated_at=NOW() WHERE id=$1`, [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/catalog/import  (CSV)
  app.post("/api/catalog/import", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const text = req.file.buffer.toString("utf-8");
      const records: Record<string, string>[] = parse(text, { columns: true, skip_empty_lines: true, trim: true });

      const results = { imported: 0, skipped: 0, errors: [] as string[] };

      for (const row of records) {
        try {
          const name = row["Name"] || row["name"];
          if (!name) { results.skipped++; continue; }
          const rawCost = (row["Cost"] || row["cost"] || "0").replace(/[$,]/g, "");
          const cost = parseFloat(rawCost) || 0;
          const rawTaxable = (row["Taxable"] || row["taxable"] || "").toUpperCase();
          const taxable = rawTaxable === "TRUE" || rawTaxable === "YES" || rawTaxable === "1";
          const rawTags = row["Tags"] || row["tags"] || "";
          const tagNames = rawTags.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);

          const itemNumber = await nextItemNumber();
          const ins = await pool.query<{ id: number }>(
            `INSERT INTO catalog_items (item_number, name, class, category, units, cost, taxable, description, sku, other_options)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [itemNumber, name,
             row["Class"] || row["class"] || null,
             row["Categories"] || row["Category"] || row["category"] || null,
             row["Units"] || row["units"] || null,
             cost, taxable,
             row["Description"] || row["description"] || null,
             row["SKU"] || row["sku"] || null,
             row["OtherOptions"] || row["other_options"] || null]
          );
          const id = ins.rows[0].id;
          if (tagNames.length) await syncItemTags(id, tagNames);
          results.imported++;
        } catch (rowErr: any) {
          results.errors.push(`Row "${row["Name"] || row["name"] || "?"}": ${rowErr.message}`);
          results.skipped++;
        }
      }
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
