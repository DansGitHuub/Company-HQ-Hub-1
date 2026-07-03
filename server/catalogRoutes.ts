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
    await pool.query(`UPDATE catalog_items SET is_active = true WHERE is_active = false OR is_active IS NULL`);
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS option_images JSONB DEFAULT '{}'`);
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS image_hidden BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS option_images_hidden JSONB DEFAULT '{}'`);
    await pool.query(`ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
    await pool.query(`ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS image_hidden BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(5,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(5,2) DEFAULT NULL`);
    console.log("[migration] Catalog tables ready");
  })();

  // ── Helper: fetch class pricing defaults for current year ───────────────────
  async function getClassPricingMap(): Promise<Record<string, { overhead_pct: number; profit_margin_pct: number }>> {
    try {
      const { rows } = await pool.query(
        `SELECT cpd.overhead_pct, cpd.profit_margin_pct, cc.name AS class_name
         FROM class_pricing_defaults cpd
         JOIN class_codes cc ON cc.id = cpd.class_id
         WHERE cpd.year = DATE_PART('year', NOW())`
      );
      const byClass: Record<string, { overhead_pct: number; profit_margin_pct: number }> = {};
      for (const r of rows) {
        byClass[r.class_name] = {
          overhead_pct: parseFloat(r.overhead_pct) || 0,
          profit_margin_pct: parseFloat(r.profit_margin_pct) || 0,
        };
      }
      return byClass;
    } catch {
      return {};
    }
  }

  function applyEffectiveMarkup(
    item: Record<string, any>,
    classPricingMap: Record<string, { overhead_pct: number; profit_margin_pct: number }>
  ): Record<string, any> {
    const ownMarkup = parseFloat(item.markup_pct ?? "0") || 0;
    let effectiveMarkupPct: number;
    let markupSource: "item" | "class" = "item";
    if (ownMarkup > 0) {
      effectiveMarkupPct = ownMarkup;
    } else {
      markupSource = "class";
      const defaults = classPricingMap[item.class ?? ""] ?? { overhead_pct: 0, profit_margin_pct: 0 };
      effectiveMarkupPct = Math.round(
        ((1 + defaults.overhead_pct) * (1 + defaults.profit_margin_pct) - 1) * 10000
      ) / 100;
    }
    const cost = parseFloat(item.cost ?? "0") || 0;
    const sell_price = cost > 0 ? Math.round(cost * (1 + effectiveMarkupPct / 100) * 100) / 100 : 0;
    return { ...item, effective_markup_pct: effectiveMarkupPct, markup_source: markupSource, sell_price };
  }

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
      const classPricingMap = await getClassPricingMap();
      res.json(result.rows.map(item => applyEffectiveMarkup(item, classPricingMap)));
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
        `INSERT INTO catalog_items (item_number, name, class, category, units, cost, taxable, description, sku, other_options, is_active, markup_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [itemNumber, body.name, body.class ?? null, body.category ?? null, body.units ?? null,
         body.cost ?? 0, body.taxable ?? false, body.description ?? null, body.sku ?? null,
         body.other_options ?? null, body.is_active ?? true, body.markup_pct ?? body.markupPct ?? 0]
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
      const classPricingMap = await getClassPricingMap();
      res.json(applyEffectiveMarkup(item, classPricingMap));
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
         description=$7, sku=$8, other_options=$9, is_active=$10, markup_pct=$11, updated_at=NOW() WHERE id=$12`,
        [body.name, body.class ?? null, body.category ?? null, body.units ?? null,
         body.cost ?? 0, body.taxable ?? false, body.description ?? null, body.sku ?? null,
         body.other_options ?? body.otherOptions ?? null,
         body.is_active ?? body.isActive ?? true,
         body.markup_pct ?? body.markupPct ?? 0, id]
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

  // POST /api/catalog/:id/image — upload primary photo (Admin/Manager only)
  app.post("/api/catalog/:id/image", requireAuth, upload.single("file"), async (req: any, res) => {
    const role = req.user?.role ?? "";
    if (!["Admin", "Manager", "MasterAdmin"].includes(role)) {
      return res.status(403).json({ message: "Admin or Manager role required" });
    }
    try {
      const id = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) return res.status(500).json({ message: "Storage not configured" });
      const SIDECAR = "http://127.0.0.1:1106";
      const imageId = (await import("crypto")).randomUUID();
      const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
      const objectPath = `${privateDir}/catalog-images/${imageId}.${ext}`;
      const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket_name: bucketName, object_name: objectName, method: "PUT", expires_at: new Date(Date.now() + 900 * 1000).toISOString() }),
      });
      if (!signRes.ok) return res.status(500).json({ message: "Storage signing failed" });
      const { signed_url } = await signRes.json() as { signed_url: string };
      const uploadRes = await fetch(signed_url, { method: "PUT", headers: { "Content-Type": req.file.mimetype }, body: req.file.buffer });
      if (!uploadRes.ok) return res.status(500).json({ message: "Upload failed" });
      const imageUrl = `/objects/catalog-images/${imageId}.${ext}`;
      await pool.query(`UPDATE catalog_items SET image_url=$1, updated_at=NOW() WHERE id=$2`, [imageUrl, id]);
      res.json({ image_url: imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/catalog/:id/option-image — upload photo for a specific option
  app.post("/api/catalog/:id/option-image", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const option = req.body?.option;
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      if (!option) return res.status(400).json({ message: "option is required" });
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) return res.status(500).json({ message: "Storage not configured" });
      const SIDECAR = "http://127.0.0.1:1106";
      const imageId = (await import("crypto")).randomUUID();
      const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
      const objectPath = `${privateDir}/catalog-images/${imageId}.${ext}`;
      const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket_name: bucketName, object_name: objectName, method: "PUT", expires_at: new Date(Date.now() + 900 * 1000).toISOString() }),
      });
      if (!signRes.ok) return res.status(500).json({ message: "Storage signing failed" });
      const { signed_url } = await signRes.json() as { signed_url: string };
      const uploadRes = await fetch(signed_url, { method: "PUT", headers: { "Content-Type": req.file.mimetype }, body: req.file.buffer });
      if (!uploadRes.ok) return res.status(500).json({ message: "Upload failed" });
      const imageUrl = `/objects/catalog-images/${imageId}.${ext}`;
      await pool.query(
        `UPDATE catalog_items SET option_images = COALESCE(option_images, '{}'::jsonb) || $1::jsonb, updated_at=NOW() WHERE id=$2`,
        [JSON.stringify({ [option]: imageUrl }), id]
      );
      res.json({ option, image_url: imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/catalog/:id/option-image/:optionName — remove one option image
  app.delete("/api/catalog/:id/option-image/:optionName", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const optionName = req.params.optionName;
      await pool.query(
        `UPDATE catalog_items SET option_images = COALESCE(option_images, '{}'::jsonb) - $1, updated_at=NOW() WHERE id=$2`,
        [optionName, id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/catalog/duplicate/:id — copy all fields into a new row, returns { id }
  app.post("/api/catalog/duplicate/:id", requireAuth, async (req, res) => {
    try {
      const srcId = parseInt(req.params.id);
      const { rows } = await pool.query(`SELECT * FROM catalog_items WHERE id=$1`, [srcId]);
      if (!rows.length) return res.status(404).json({ message: "Item not found" });
      const orig = rows[0];
      const newNum = await nextItemNumber();
      const { rows: inserted } = await pool.query(
        `INSERT INTO catalog_items
           (item_number, name, class, category, units, cost, taxable, description, sku,
            other_options, image_url, option_images, image_hidden, option_images_hidden, is_active, markup_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          newNum, `Copy of ${orig.name}`, orig.class, orig.category, orig.units,
          orig.cost, orig.taxable, orig.description, orig.sku,
          orig.other_options, orig.image_url,
          orig.option_images ?? {}, orig.image_hidden ?? false,
          orig.option_images_hidden ?? {}, orig.is_active,
          orig.markup_pct ?? 0,
        ]
      );
      res.status(201).json({ id: inserted[0].id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/catalog/:id/image-visibility — toggle hidden flag for primary or option photo
  app.patch("/api/catalog/:id/image-visibility", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { type, option, hidden } = req.body;
      if (type === "primary") {
        await pool.query(
          `UPDATE catalog_items SET image_hidden=$1, updated_at=NOW() WHERE id=$2`,
          [!!hidden, id]
        );
      } else if (type === "option" && option) {
        await pool.query(
          `UPDATE catalog_items SET option_images_hidden = COALESCE(option_images_hidden, '{}'::jsonb) || $1::jsonb, updated_at=NOW() WHERE id=$2`,
          [JSON.stringify({ [option]: !!hidden }), id]
        );
      } else {
        return res.status(400).json({ message: "type must be 'primary' or 'option'" });
      }
      const item = await getItemWithTags(id);
      res.json(item);
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

      const results = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };

      for (const row of records) {
        try {
          const name = row["Name"] || row["name"];
          if (!name) { results.skipped++; continue; }
          const rawCost = (row["Cost"] || row["cost"] || "0").replace(/[$,]/g, "");
          const cost = parseFloat(rawCost) || 0;
          const rawMarkup = (row["Markup"] || row["markup"] || "").replace(/[$,%]/g, "");
          const markupPct = rawMarkup ? parseFloat(rawMarkup) : null;
          const rawTaxable = (row["Taxable"] || row["taxable"] || "").toUpperCase();
          const taxable = rawTaxable === "TRUE" || rawTaxable === "YES" || rawTaxable === "1";
          const rawTags = row["Tags"] || row["tags"] || "";
          const tagNames = rawTags.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
          const sku = row["SKU"] || row["sku"] || null;
          const cls = row["Class"] || row["class"] || null;
          const category = row["Categories"] || row["Category"] || row["category"] || null;
          const units = row["Units"] || row["units"] || row["Unit"] || row["unit"] || null;
          const description = row["Description"] || row["description"] || null;
          const otherOptions = row["OtherOptions"] || row["other_options"] || null;

          if (sku) {
            const existing = await pool.query<{ id: number }>(`SELECT id FROM catalog_items WHERE sku = $1`, [sku]);
            if (existing.rows.length > 0) {
              const id = existing.rows[0].id;
              await pool.query(
                `UPDATE catalog_items SET name=$1, class=$2, category=$3, units=$4, cost=$5, taxable=$6, description=$7, other_options=$8, markup_pct=COALESCE($9, markup_pct), updated_at=NOW() WHERE id=$10`,
                [name, cls, category, units, cost, taxable, description, otherOptions, markupPct, id]
              );
              if (tagNames.length) await syncItemTags(id, tagNames);
              results.updated++;
              continue;
            }
          }

          const itemNumber = await nextItemNumber();
          const ins = await pool.query<{ id: number }>(
            `INSERT INTO catalog_items (item_number, name, class, category, units, cost, taxable, description, sku, other_options, markup_pct)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [itemNumber, name, cls, category, units, cost, taxable, description, sku, otherOptions, markupPct ?? 0]
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
