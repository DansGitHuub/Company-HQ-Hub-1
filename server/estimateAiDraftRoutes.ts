import { Express } from "express";
import { pool } from "./db";
import { requireAuth } from "./auth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function registerEstimateAiDraftRoutes(app: Express) {
  /**
   * POST /api/estimates/:id/ai-draft-line-items
   *
   * Reads the estimate's linked CompanyCam photos and attached voice transcript,
   * sends them to gpt-4o (with vision), and returns proposed line items grouped
   * by work area.  NOTHING is written to the database — the salesperson must
   * explicitly accept the draft before anything is saved.
   */
  app.post(
    "/api/estimates/:id/ai-draft-line-items",
    requireAuth,
    async (req: any, res: any) => {
      const { id } = req.params;
      try {
        // 1. Load estimate basics
        const { rows: estRows } = await pool.query(
          `SELECT companycam_project_id, title, estimate_type
             FROM sales_estimates WHERE id = $1`,
          [id]
        );
        if (!estRows.length)
          return res.status(404).json({ message: "Estimate not found" });
        const est = estRows[0];

        // 2. Load CC photos (non-hidden, up to 12, newest first)
        let photoUrls: string[] = [];
        if (est.companycam_project_id) {
          const { rows: photoRows } = await pool.query(
            `SELECT photo_url_web
               FROM companycam_photos
              WHERE companycam_project_id = $1
                AND hidden_on_estimate IS NOT TRUE
              ORDER BY captured_at DESC NULLS LAST
              LIMIT 12`,
            [est.companycam_project_id]
          );
          photoUrls = photoRows
            .map((r: any) => r.photo_url_web as string | null)
            .filter(Boolean) as string[];
        }

        // 3. Load voice transcript
        const { rows: txRows } = await pool.query(
          `SELECT transcript_text, summary_text
             FROM voice_transcripts
            WHERE estimate_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [id]
        );
        const transcript = txRows[0] ?? null;

        const hasPhotos = photoUrls.length > 0;
        const hasTranscript = !!transcript?.transcript_text;

        if (!hasPhotos && !hasTranscript) {
          return res.status(400).json({
            message:
              "No photos or transcript attached to this estimate. " +
              "Please link a CompanyCam project or attach a Plaud transcript first.",
          });
        }

        // 4. Build the prompt
        const systemPrompt = `You are an expert landscape estimator for Chapin Landscapes, an Ohio landscaping company.
Analyze the site visit photos and/or voice transcript provided, then generate realistic estimate line items.

For every line item output these fields:
  description  – clear, professional description of the work or material
  item_type    – exactly one of: "labor", "material", "equipment", "service", "subcontractor"
  quantity     – numeric estimate; use 1 if the quantity cannot be determined
  unit         – appropriate unit such as "hr", "sf", "lf", "yard", "each", "ton", "visit", "ls"
  unit_price   – rough market price in USD; use 0 if completely unknown

Group related line items into logical work areas (e.g. "Patio Installation", "Grading", "Plant Material").

Return ONLY valid JSON with exactly this shape – no markdown, no extra keys:
{
  "work_areas": [
    {
      "name": "Work Area Name",
      "line_items": [
        {
          "description": "Excavation and grading",
          "item_type": "labor",
          "quantity": 8,
          "unit": "hr",
          "unit_price": 85.00
        }
      ]
    }
  ]
}`;

        // Build user message (text + images)
        const userParts: OpenAI.Chat.ChatCompletionContentPart[] = [];

        let textCtx = `Estimate: ${est.title || "Unnamed"}\nEstimate Type: ${est.estimate_type || "Unknown"}\n\n`;
        if (hasTranscript) {
          textCtx += `VOICE TRANSCRIPT FROM SITE VISIT:\n${transcript.transcript_text}\n\n`;
          if (transcript.summary_text) {
            textCtx += `SUMMARY / NOTES:\n${transcript.summary_text}\n\n`;
          }
        }
        if (hasPhotos) {
          textCtx += `${photoUrls.length} site photo(s) are attached below. Examine them carefully for scope, materials, existing conditions, and any visible measurements.\n`;
        }
        userParts.push({ type: "text", text: textCtx });

        // Attach up to 10 photos as vision inputs
        for (const url of photoUrls.slice(0, 10)) {
          userParts.push({
            type: "image_url",
            image_url: { url, detail: "low" },
          });
        }

        // 5. Call gpt-4o with vision + JSON mode
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userParts },
          ],
          max_tokens: 2048,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error("[ai-draft] Bad JSON from AI:", raw.slice(0, 200));
          return res
            .status(500)
            .json({ message: "AI returned invalid JSON. Please try again." });
        }

        return res.json({
          work_areas: parsed.work_areas ?? [],
          photo_count: photoUrls.length,
          has_transcript: hasTranscript,
        });
      } catch (err: any) {
        console.error("[ai-draft] generate error:", err);
        return res
          .status(500)
          .json({ message: err.message || "AI draft generation failed" });
      }
    }
  );

  /**
   * POST /api/estimates/:id/work-areas/append
   *
   * Appends one or more work areas (with their line items) to an existing
   * estimate WITHOUT touching existing work areas.  Called when the salesperson
   * accepts the AI-drafted line items.
   */
  app.post(
    "/api/estimates/:id/work-areas/append",
    requireAuth,
    async (req: any, res: any) => {
      const { id } = req.params;
      const { work_areas } = req.body as {
        work_areas: Array<{
          name: string;
          line_items: Array<{
            description: string;
            item_type?: string;
            quantity?: number | string;
            unit?: string;
            unit_price?: number | string;
          }>;
        }>;
      };

      if (!Array.isArray(work_areas) || work_areas.length === 0) {
        return res.status(400).json({ message: "work_areas array is required" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Find the next sort_order slot
        const { rows: orderRows } = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) AS max_order
             FROM estimate_work_areas
            WHERE estimate_id = $1`,
          [id]
        );
        let nextOrder: number = (orderRows[0]?.max_order ?? -1) + 1;

        for (const area of work_areas) {
          const { rows: ar } = await client.query(
            `INSERT INTO estimate_work_areas (estimate_id, name, sort_order)
             VALUES ($1, $2, $3) RETURNING id`,
            [id, area.name || "AI Draft", nextOrder++]
          );
          const areaId = ar[0].id as string;

          for (let i = 0; i < (area.line_items || []).length; i++) {
            const item = area.line_items[i];
            const qty = parseFloat(String(item.quantity)) || 1;
            const price = parseFloat(String(item.unit_price)) || 0;
            await client.query(
              `INSERT INTO estimate_line_items
                 (estimate_work_area_id, item_type, description,
                  quantity, unit, unit_price, amount, sort_order, is_optional)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)`,
              [
                areaId,
                item.item_type || "service",
                item.description,
                qty,
                item.unit || null,
                price,
                qty * price,
                i,
              ]
            );
          }
        }

        // Recompute estimate subtotal (non-optional items only)
        await client.query(
          `UPDATE sales_estimates se
              SET subtotal = (
                    SELECT COALESCE(SUM(eli.amount), 0)
                      FROM estimate_work_areas ewa
                      JOIN estimate_line_items eli
                           ON eli.estimate_work_area_id = ewa.id
                     WHERE ewa.estimate_id = se.id
                       AND eli.is_optional = false
                  ),
                  updated_at = NOW()
            WHERE se.id = $1`,
          [id]
        );

        await client.query("COMMIT");
        return res.json({ success: true });
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("[ai-draft] append error:", err);
        return res
          .status(500)
          .json({ message: err.message || "Failed to append work areas" });
      } finally {
        client.release();
      }
    }
  );
}
