import { Express, Request, Response } from "express";
import OpenAI from "openai";
import { requireAuth } from "./auth";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are a precise translator between English (en) and Spanish (es).
Given text and a preferred target language, follow these rules:
1. Detect the language of the provided text.
2. If the text is already in the target language, translate it to the OTHER language (en↔es).
3. If the text is in a different language, translate it to the target language.
4. Preserve line breaks, paragraph structure, and tone.
5. Do not add explanations, notes, or commentary — only the translation.
6. Return ONLY valid JSON with this exact schema:
   {"detectedLanguage":"en"|"es","targetLanguage":"en"|"es","translatedText":"..."}`;

export function registerTranslateRoutes(app: Express) {
  app.post("/api/translate", requireAuth, async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage: explicitTarget } = req.body as {
        text?: string;
        targetLanguage?: string;
      };

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ message: "text is required" });
      }

      const trimmedText = text.trim().slice(0, 3000);
      const userLang = (req.user as any)?.language || "en";
      const targetLanguage = (explicitTarget === "en" || explicitTarget === "es")
        ? explicitTarget
        : userLang === "es" ? "es" : "en";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Target language: ${targetLanguage}\n\nText to translate:\n${trimmedText}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let result: { detectedLanguage?: string; targetLanguage?: string; translatedText?: string };

      try {
        result = JSON.parse(raw);
      } catch {
        return res.status(500).json({ message: "Translation parsing error" });
      }

      if (!result.translatedText) {
        return res.status(500).json({ message: "Translation failed — empty result" });
      }

      return res.json({
        translatedText: result.translatedText,
        detectedLanguage: result.detectedLanguage ?? "en",
        targetLanguage: result.targetLanguage ?? targetLanguage,
      });
    } catch (err) {
      console.error("[translate] error:", err);
      return res.status(500).json({ message: "Translation service error" });
    }
  });
}
