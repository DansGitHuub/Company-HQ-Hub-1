import { Express } from "express";
import { pool } from "./db";
import { requireAuth } from "./auth";

/**
 * Estimate Transcript Routes
 *
 * Provides attach/view/remove of a Plaud (or any source) voice transcript
 * against a single estimate.  The underlying table is voice_transcripts which
 * was introduced in companyCamPhase1 migration.
 *
 * One-transcript-per-estimate model: POST replaces any existing transcript.
 * The external_id column (NOT NULL UNIQUE) gets a generated "manual-…" value
 * so the constraint is always satisfied for manually-pasted records.
 */
export function registerEstimateTranscriptRoutes(app: Express) {
  // ── GET /api/estimates/:id/transcript ──────────────────────────────────────
  // Returns the transcript attached to this estimate, or null if none exists.
  app.get("/api/estimates/:id/transcript", requireAuth, async (req: any, res: any) => {
    const { id } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT id, external_id, transcript_text, summary_text, source,
                recorded_at, recorded_by_email, audio_duration_seconds,
                transcript_format, created_at
           FROM voice_transcripts
          WHERE estimate_id = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [id]
      );
      return res.json(rows[0] ?? null);
    } catch (err: any) {
      console.error("[estimate-transcript] GET error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/estimates/:id/transcript ─────────────────────────────────────
  // Creates (or replaces) the transcript attached to this estimate.
  // Body: { transcript_text, recorded_at?, source?, recorded_by_email?, summary_text? }
  app.post("/api/estimates/:id/transcript", requireAuth, async (req: any, res: any) => {
    const { id } = req.params;
    const {
      transcript_text,
      recorded_at,
      source,
      recorded_by_email,
      summary_text,
    } = req.body ?? {};

    if (!transcript_text?.trim()) {
      return res.status(400).json({ message: "transcript_text is required" });
    }

    try {
      // Verify the estimate exists
      const { rows: [est] } = await pool.query(
        `SELECT id FROM sales_estimates WHERE id = $1`,
        [id]
      );
      if (!est) return res.status(404).json({ message: "Estimate not found" });

      // Replace any existing transcript for this estimate (one-per-estimate UX)
      await pool.query(
        `DELETE FROM voice_transcripts WHERE estimate_id = $1`,
        [id]
      );

      // Generate a unique external_id for manually-created records
      const externalId = `manual-${Date.now()}-${id.replace(/-/g, "").slice(0, 12)}`;

      const { rows: [row] } = await pool.query(
        `INSERT INTO voice_transcripts
           (external_id, estimate_id, transcript_text, summary_text,
            source, recorded_at, recorded_by_email, transcript_format)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'text')
         RETURNING id, external_id, transcript_text, summary_text, source,
                   recorded_at, recorded_by_email, audio_duration_seconds,
                   transcript_format, created_at`,
        [
          externalId,
          id,
          transcript_text.trim(),
          summary_text?.trim() || null,
          source?.trim() || "Plaud",
          recorded_at || null,
          recorded_by_email?.trim() || null,
        ]
      );

      console.log(`[estimate-transcript] Attached transcript to estimate ${id}`);
      return res.status(201).json(row);
    } catch (err: any) {
      console.error("[estimate-transcript] POST error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/estimates/:id/transcript/:transcriptId ────────────────────
  // Removes the specified transcript from this estimate.
  app.delete(
    "/api/estimates/:id/transcript/:transcriptId",
    requireAuth,
    async (req: any, res: any) => {
      const { id, transcriptId } = req.params;
      try {
        await pool.query(
          `DELETE FROM voice_transcripts WHERE id = $1 AND estimate_id = $2`,
          [transcriptId, id]
        );
        return res.json({ ok: true });
      } catch (err: any) {
        console.error("[estimate-transcript] DELETE error:", err.message);
        return res.status(500).json({ message: err.message });
      }
    }
  );
}
