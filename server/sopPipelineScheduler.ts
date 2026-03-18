import { storage } from "./storage";
import crypto from "crypto";

const FREQUENCY_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

function getNextRunTime(frequency: string): Date {
  const intervalMs = FREQUENCY_MS[frequency] || FREQUENCY_MS.daily;
  return new Date(Date.now() + intervalMs);
}

async function generateSopFromPipelineItem(itemId: string): Promise<boolean> {
  try {
    const item = await storage.getSopPipelineItem(itemId);
    if (!item || item.status !== "approved") return false;

    await storage.updateSopPipelineItem(item.id, { status: "generating" } as any);
    console.log(`[SOP-Scheduler] Starting auto-generation for: "${item.title}"`);

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
    });

    const existingSops = await storage.getSops();
    const sampleTitles = existingSops.slice(0, 5).map(s => s.title).join(", ");

    const contentCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are an expert technical writer specializing in landscape installation and maintenance SOPs for "Chapin Landscapes". Write comprehensive, practical SOPs that field crews can actually follow.

Your SOPs must include:
- A clear desired outcome
- Required tools, materials, and PPE (personal protective equipment)
- Detailed step-by-step instructions (5-8 steps typically)
- Each step needs: a title, detailed instruction, why it matters, success criteria, and common mistakes to avoid
- Safety notes relevant to the procedure
- Appropriate audience and skill level

The company already has these SOPs: ${sampleTitles}

Write content that matches professional landscaping industry standards. Be specific with measurements, techniques, and safety requirements.

Respond with valid JSON matching this exact structure:
{
  "outcome": "What the completed procedure should look like",
  "outcomeType": "completion|quality|safety",
  "audience": "Who should follow this SOP",
  "skillLevel": "beginner|intermediate|advanced|all",
  "timingTarget": "Estimated time",
  "timingMax": "Maximum time allowed",
  "tools": "Tool 1\\nTool 2\\nTool 3",
  "materials": "Material 1\\nMaterial 2",
  "ppe": "PPE item 1\\nPPE item 2",
  "safetyNotes": "Important safety information",
  "complianceNotes": "Any regulatory or compliance notes",
  "steps": [
    {
      "title": "Step title",
      "instruction": "Detailed step instructions",
      "why": "Why this step matters",
      "successCriteria": "How to know this step is done correctly",
      "commonMistakes": "What to watch out for",
      "proofRequired": false,
      "isQCCheckpoint": false
    }
  ],
  "imagePrompts": {
    "header": "Detailed image prompt for the SOP header image",
    "steps": ["Detailed image prompt for step 1...", "step 2..."]
  }
}`
        },
        {
          role: "user",
          content: `Write a complete ${item.sopType} SOP for: "${item.title}"
Category: ${item.category}
Description: ${item.description || "No additional description provided"}
Generate comprehensive content with 5-8 detailed steps and image prompts.`
        }
      ],
      response_format: { type: "json_object" },
    });

    const sopContent = JSON.parse(contentCompletion.choices[0].message.content || "{}");

    const steps = (sopContent.steps || []).map((s: any, i: number) => ({
      id: crypto.randomUUID(),
      title: s.title || `Step ${i + 1}`,
      instruction: s.instruction || "",
      why: s.why || undefined,
      successCriteria: s.successCriteria || undefined,
      commonMistakes: s.commonMistakes || undefined,
      proofRequired: s.proofRequired || false,
      isQCCheckpoint: s.isQCCheckpoint || false,
    }));

    const imagePrompts = sopContent.imagePrompts || {};
    const stepImagePrompts = imagePrompts.steps || [];
    const headerPrompt = imagePrompts.header || `Professional landscaping scene showing: ${item.title}`;

    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
    const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
    const SIDECAR = "http://127.0.0.1:1106";

    async function generateAndUploadImage(prompt: string, label: string): Promise<string | null> {
      try {
        const fullPrompt = `Landscaping/outdoor work context: ${prompt}. Professional, clear, educational illustration style, high quality.`;
        const imageApiRes = await fetch(`${baseURL}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ model: "gpt-image-1", prompt: fullPrompt, size: "1024x1024" }),
        });
        if (!imageApiRes.ok) return null;
        const imageData = await imageApiRes.json() as any;
        const b64 = imageData?.data?.[0]?.b64_json;
        if (!b64) return null;

        const imageBuffer = Buffer.from(b64, "base64");
        const imageId = crypto.randomUUID();
        const objectPath = `${privateDir}/sop-media/${imageId}.png`;
        const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
        const bucketName = pathParts[0];
        const objectName = pathParts.slice(1).join("/");

        const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket_name: bucketName, object_name: objectName, method: "PUT", expires_at: new Date(Date.now() + 900 * 1000).toISOString() }),
        });
        if (!signRes.ok) return null;
        const { signed_url } = await signRes.json() as { signed_url: string };

        const uploadRes = await fetch(signed_url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: imageBuffer });
        if (!uploadRes.ok) return null;

        return `/objects/sop-media/${imageId}.png`;
      } catch (err) {
        console.error(`[SOP-Scheduler] Image error for ${label}:`, err);
        return null;
      }
    }

    let headerImageUrl: string | null = null;
    if (privateDir) {
      headerImageUrl = await generateAndUploadImage(headerPrompt, "header");
    }

    const stepImageUrls: Record<string, string> = {};
    if (privateDir) {
      for (let i = 0; i < steps.length; i++) {
        const prompt = stepImagePrompts[i] || `Landscape crew performing: ${steps[i].title}`;
        const imgUrl = await generateAndUploadImage(prompt, `step-${i + 1}`);
        if (imgUrl) stepImageUrls[steps[i].id] = imgUrl;
      }
    }

    const SOP_TYPE_LABELS: Record<string, string> = {
      standard: "Standard Procedure", safety: "Safety Procedure",
      maintenance: "Maintenance", training: "Training Guide",
      quality: "Quality Control", emergency: "Emergency Response",
    };

    let contentHtml = "";
    if (headerImageUrl) {
      contentHtml += `<div style="margin-bottom:16px;text-align:center;"><img src="${headerImageUrl}" alt="${item.title}" style="max-width:100%;max-height:300px;border-radius:8px;" /><p style="font-size:11px;color:#888;margin-top:4px;">AI Generated</p></div>`;
    }
    contentHtml += `<p><strong>Type:</strong> ${SOP_TYPE_LABELS[item.sopType] || item.sopType}</p>`;
    if (sopContent.outcome) contentHtml += `<h2>Desired Outcome</h2><p>${sopContent.outcome}</p>`;
    if (sopContent.safetyNotes) contentHtml += `<h2>Safety Notes</h2><p>${sopContent.safetyNotes}</p>`;
    contentHtml += `<h2>Procedure Steps</h2>`;
    for (let i = 0; i < steps.length; i++) {
      contentHtml += `<h3>Step ${i + 1}: ${steps[i].title}</h3><p>${steps[i].instruction}</p>`;
      const stepImg = stepImageUrls[steps[i].id];
      if (stepImg) contentHtml += `<div style="margin:8px 0;"><img src="${stepImg}" style="max-width:100%;max-height:200px;border-radius:6px;" /><p style="font-size:10px;color:#888;">AI Generated</p></div>`;
    }

    const structuredData = {
      outcome: sopContent.outcome || "",
      outcomeType: sopContent.outcomeType || "completion",
      audience: sopContent.audience || "",
      skillLevel: sopContent.skillLevel || "all",
      timingTarget: sopContent.timingTarget || "",
      timingMax: sopContent.timingMax || "",
      ppe: sopContent.ppe || "",
      tools: sopContent.tools || "",
      materials: sopContent.materials || "",
      steps: steps.map((s: any) => ({
        ...s,
        imageUrl: stepImageUrls[s.id] || undefined,
      })),
      safetyNotes: sopContent.safetyNotes || "",
      complianceNotes: sopContent.complianceNotes || "",
      headerImageUrl: headerImageUrl || undefined,
      generatedByPipeline: true,
      pipelineItemId: item.id,
    };

    const newSop = await storage.createSop({
      title: item.title,
      category: item.category,
      categoryId: item.categoryId || undefined,
      sopType: item.sopType,
      content: contentHtml,
      structuredData,
    });

    await storage.updateSopPipelineItem(item.id, {
      status: "published",
      generatedSopId: newSop.id,
      completedAt: new Date(),
    } as any);

    console.log(`[SOP-Scheduler] Auto-generated SOP: "${item.title}" (${newSop.id})`);

    try {
      const { generateQuizForSop } = await import("./sopQuizGenerator");
      const quizSuccess = await generateQuizForSop(newSop.id);
      if (quizSuccess) {
        console.log(`[SOP-Scheduler] Auto-generated quiz for "${item.title}"`);
      }
    } catch (quizErr) {
      console.error(`[SOP-Scheduler] Quiz auto-generation failed (non-blocking):`, quizErr);
    }

    return true;
  } catch (err) {
    console.error(`[SOP-Scheduler] Auto-generation failed for item ${itemId}:`, err);
    try {
      await storage.updateSopPipelineItem(itemId, { status: "approved" } as any);
    } catch {}
    return false;
  }
}

async function runScheduledGeneration() {
  if (isProcessing) {
    console.log("[SOP-Scheduler] Already processing, skipping run");
    return;
  }

  try {
    const settings = await storage.getSopPipelineSettings();
    if (!settings || !settings.autoGenerateEnabled) return;

    if (settings.nextScheduledRun && new Date(settings.nextScheduledRun) > new Date()) return;

    isProcessing = true;
    console.log(`[SOP-Scheduler] Running scheduled generation (max ${settings.maxPerRun} per run)`);

    const allItems = await storage.getSopPipelineItems();
    const approvedItems = allItems
      .filter(i => i.status === "approved")
      .sort((a, b) => b.priority - a.priority);

    const toGenerate = approvedItems.slice(0, settings.maxPerRun);

    if (toGenerate.length === 0) {
      console.log("[SOP-Scheduler] No approved items to generate");
      await storage.updateSopPipelineSettings({
        lastAutoRun: new Date(),
        nextScheduledRun: getNextRunTime(settings.generateFrequency),
      });
      isProcessing = false;
      return;
    }

    let generated = 0;
    for (const item of toGenerate) {
      const success = await generateSopFromPipelineItem(item.id);
      if (success) generated++;
    }

    await storage.updateSopPipelineSettings({
      lastAutoRun: new Date(),
      nextScheduledRun: getNextRunTime(settings.generateFrequency),
    });

    console.log(`[SOP-Scheduler] Completed: ${generated}/${toGenerate.length} SOPs generated`);
  } catch (err) {
    console.error("[SOP-Scheduler] Scheduler error:", err);
  } finally {
    isProcessing = false;
  }
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function startSopPipelineScheduler() {
  console.log("[SOP-Scheduler] Starting SOP pipeline scheduler (checking every 5 minutes)");

  setTimeout(() => {
    runScheduledGeneration().catch(err => console.error("[SOP-Scheduler] Initial run error:", err));
  }, 15000);

  schedulerInterval = setInterval(() => {
    runScheduledGeneration().catch(err => console.error("[SOP-Scheduler] Interval run error:", err));
  }, CHECK_INTERVAL_MS);
}

export function stopSopPipelineScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[SOP-Scheduler] Stopped");
  }
}
