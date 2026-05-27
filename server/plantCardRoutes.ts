import type { Express, Request, Response } from "express";
import { pool } from "./db";
import OpenAI from "openai";
import multer from "multer";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });
  return _openai;
}
const upload = multer({ storage: multer.memoryStorage() });
const SIDECAR = "http://127.0.0.1:1106";

async function uploadToObjectStorage(buffer: Buffer, mimeType: string, key: string): Promise<string> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const fullPath = `${privateDir}/plant-cards/${key}`;
  const withoutLeadingSlash = fullPath.startsWith("/") ? fullPath.slice(1) : fullPath;
  const pathParts = withoutLeadingSlash.split("/");
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");

  const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
  });

  if (!signRes.ok) {
    throw new Error("Failed to get upload URL from storage");
  }
  const { signed_url } = (await signRes.json()) as { signed_url: string };

  const putRes = await fetch(signed_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: buffer as any,
  });

  if (!putRes.ok) throw new Error("Failed to upload photo to storage");

  return `/objects/plant-cards/${key}`;
}

export function registerPlantCardRoutes(app: Express, requireAuth: any, requireAdmin: any) {

  // ── GET /api/plant-cards — published cards (any auth user) ───────────────
  app.get("/api/plant-cards", requireAuth, async (req: Request, res: Response) => {
    try {
      const { q, type } = req.query as Record<string, string>;
      const params: any[] = [];
      let where = "WHERE pc.published = true";
      if (q) {
        params.push(`%${q}%`);
        where += ` AND (pc.common_name ILIKE $${params.length} OR pc.botanical_name ILIKE $${params.length})`;
      }
      if (type) {
        params.push(type);
        where += ` AND pc.plant_type = $${params.length}`;
      }
      const result = await pool.query(
        `SELECT pc.*, ci.item_number, ci.image_url AS catalog_image_url
         FROM plant_cards pc
         LEFT JOIN catalog_items ci ON ci.id = pc.catalog_item_id
         ${where} ORDER BY pc.common_name ASC`,
        params
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/plant-cards/all — admin list (includes drafts) ─────────────
  app.get("/api/plant-cards/all", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT pc.*, ci.item_number, ci.name AS catalog_item_name, ci.image_url AS catalog_image_url
         FROM plant_cards pc
         LEFT JOIN catalog_items ci ON ci.id = pc.catalog_item_id
         ORDER BY pc.common_name ASC`
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/plant-cards/by-catalog/:catalogItemId ───────────────────────
  // Must come BEFORE /:id to avoid param collision
  app.get("/api/plant-cards/by-catalog/:catalogItemId", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT * FROM plant_cards WHERE catalog_item_id=$1 AND published=true LIMIT 1`,
        [req.params.catalogItemId]
      );
      res.json(result.rows[0] ?? null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/plant-cards/:id ─────────────────────────────────────────────
  app.get("/api/plant-cards/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT pc.*, ci.item_number, ci.image_url AS catalog_image_url
         FROM plant_cards pc
         LEFT JOIN catalog_items ci ON ci.id = pc.catalog_item_id
         WHERE pc.id = $1`,
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/plant-cards/generate — AI fill (admin) ────────────────────
  app.post("/api/plant-cards/generate", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { commonName, botanicalName, plantType } = req.body;
      if (!commonName) return res.status(400).json({ message: "commonName required" });
      const hint = [commonName, botanicalName, plantType].filter(Boolean).join(" / ");

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a professional horticulturist. Return ONLY valid JSON. Be concise and accurate for northeastern USA (zones 5–7).",
          },
          {
            role: "user",
            content: `Generate a complete plant info card for: ${hint}

Return this exact JSON (fill every field; null for truly unknown):
{
  "commonName": "",
  "botanicalName": "",
  "plantType": "Tree|Shrub|Perennial|Annual|Groundcover|Vine|Grass|Other",
  "deciduousEvergreen": "Deciduous|Evergreen|Semi-Evergreen",
  "matureSize": "e.g. 20-30 ft tall x 15-20 ft wide",
  "growthRate": "Slow|Moderate|Fast",
  "hardinessZone": "e.g. 4-8",
  "lightRequirement": "Full Sun|Part Sun|Part Shade|Full Shade|Adaptable",
  "soilMoisture": "e.g. Well-drained, tolerates clay",
  "waterNeeds": "Low|Moderate|High",
  "deerResistant": true,
  "flowering": true,
  "flowerSeason": "e.g. May-June",
  "flowerColor": "e.g. White",
  "pruningTime": "e.g. Late winter before new growth",
  "knownPestsIssues": "e.g. Aphids, fireblight",
  "specialNotes": "2-3 sentences about landscape use",
  "maintenanceNotes": "2-3 practical maintenance tips for a landscape crew"
}`,
          },
        ],
      });

      const data = JSON.parse(completion.choices[0].message.content || "{}");
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/plant-cards — create (admin) ───────────────────────────────
  app.post("/api/plant-cards", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const d = req.body;
      const result = await pool.query(
        `INSERT INTO plant_cards (
          catalog_item_id, common_name, botanical_name, plant_type, deciduous_evergreen,
          mature_size, growth_rate, hardiness_zone, light_requirement, soil_moisture,
          water_needs, deer_resistant, flowering, flower_season, flower_color,
          pruning_time, known_pests_issues, special_notes, maintenance_notes,
          photos, published, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING *`,
        [
          d.catalogItemId ?? null,
          d.commonName, d.botanicalName ?? null, d.plantType ?? null, d.deciduousEvergreen ?? null,
          d.matureSize ?? null, d.growthRate ?? null, d.hardinessZone ?? null,
          d.lightRequirement ?? null, d.soilMoisture ?? null, d.waterNeeds ?? null,
          d.deerResistant ?? false, d.flowering ?? false,
          d.flowerSeason ?? null, d.flowerColor ?? null, d.pruningTime ?? null,
          d.knownPestsIssues ?? null, d.specialNotes ?? null, d.maintenanceNotes ?? null,
          JSON.stringify(d.photos ?? []), d.published ?? true,
          user?.username ?? "admin",
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/plant-cards/:id — update (admin) ────────────────────────────
  app.put("/api/plant-cards/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const d = req.body;
      const result = await pool.query(
        `UPDATE plant_cards SET
          catalog_item_id=$1, common_name=$2, botanical_name=$3, plant_type=$4,
          deciduous_evergreen=$5, mature_size=$6, growth_rate=$7, hardiness_zone=$8,
          light_requirement=$9, soil_moisture=$10, water_needs=$11, deer_resistant=$12,
          flowering=$13, flower_season=$14, flower_color=$15, pruning_time=$16,
          known_pests_issues=$17, special_notes=$18, maintenance_notes=$19,
          photos=$20, published=$21, updated_at=NOW()
        WHERE id=$22 RETURNING *`,
        [
          d.catalogItemId ?? null, d.commonName, d.botanicalName ?? null, d.plantType ?? null,
          d.deciduousEvergreen ?? null, d.matureSize ?? null, d.growthRate ?? null,
          d.hardinessZone ?? null, d.lightRequirement ?? null, d.soilMoisture ?? null,
          d.waterNeeds ?? null, d.deerResistant ?? false, d.flowering ?? false,
          d.flowerSeason ?? null, d.flowerColor ?? null, d.pruningTime ?? null,
          d.knownPestsIssues ?? null, d.specialNotes ?? null, d.maintenanceNotes ?? null,
          JSON.stringify(d.photos ?? []), d.published ?? true,
          req.params.id,
        ]
      );
      if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/plant-cards/:id — delete (admin) ─────────────────────────
  app.delete("/api/plant-cards/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM plant_cards WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/plant-cards/:id/photos — upload photo ──────────────────────
  app.post(
    "/api/plant-cards/:id/photos",
    requireAuth,
    requireAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const cardId = req.params.id;

        // Verify card exists
        const card = await pool.query(`SELECT photos FROM plant_cards WHERE id=$1`, [cardId]);
        if (!card.rows[0]) return res.status(404).json({ message: "Card not found" });

        const ext = req.file.originalname.split(".").pop() || "jpg";
        const key = `${cardId}/${Date.now()}.${ext}`;

        let photoUrl: string;
        try {
          const storageKey = await uploadToObjectStorage(req.file.buffer, req.file.mimetype, key);
          photoUrl = `/api/object-storage${storageKey}`;
        } catch (storageErr) {
          // If object storage isn't configured, fall back gracefully
          console.warn("[plant-cards] object storage unavailable, photo not saved:", storageErr);
          return res.status(503).json({ message: "Object storage not configured" });
        }

        const photos: string[] = card.rows[0].photos ?? [];
        photos.push(photoUrl);
        await pool.query(
          `UPDATE plant_cards SET photos=$1, updated_at=NOW() WHERE id=$2`,
          [JSON.stringify(photos), cardId]
        );

        res.json({ url: photoUrl, photos });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );

  // ── DELETE /api/plant-cards/:id/photos — remove photo URL ────────────────
  app.delete("/api/plant-cards/:id/photos", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      const card = await pool.query(`SELECT photos FROM plant_cards WHERE id=$1`, [req.params.id]);
      if (!card.rows[0]) return res.status(404).json({ message: "Card not found" });
      const photos: string[] = (card.rows[0].photos ?? []).filter((p: string) => p !== url);
      await pool.query(
        `UPDATE plant_cards SET photos=$1, updated_at=NOW() WHERE id=$2`,
        [JSON.stringify(photos), req.params.id]
      );
      res.json({ photos });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
