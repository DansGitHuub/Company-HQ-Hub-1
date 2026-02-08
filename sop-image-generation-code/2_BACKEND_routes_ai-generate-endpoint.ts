// ============================================================
// FILE: server/routes.ts
// SECTION: POST /api/sop-media/ai-generate (lines ~1038-1265)
// PURPOSE: Backend route that receives the generate request,
//          calls OpenAI, uploads to object storage, saves to DB
// ============================================================

app.post("/api/sop-media/ai-generate", requireAuth, async (req, res) => {
  try {
    const user = req.user as User;
    
    const settings = await storage.getCompanySettings();
    if (settings && !settings.aiImagesEnabled) {
      return res.status(403).json({ message: "AI image generation is disabled", errorCode: "IMG-002" });
    }

    const allowedRoles = (settings?.aiImagesAllowedRoles as string[]) || ["Admin", "Manager"];
    if (!user.isMasterAdmin && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Your role does not have permission to generate AI images", errorCode: "IMG-003" });
    }

    const parsed = aiImageGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });
    }

    const { targetType, targetId, stepIndex, prompt, negativePrompt, style, watermark } = parsed.data;

    const safetyCheck = checkPromptSafety(prompt);
    if (!safetyCheck.safe) {
      await storage.createAiGenerationEvent({
        userId: user.id,
        targetType,
        targetId: targetId || null,
        prompt,
        negativePrompt: negativePrompt || null,
        style: style || null,
        model: "gpt-image-1",
        requestedSize: "1024x1024",
        resultMediaId: null,
        status: "blocked",
        errorMessage: safetyCheck.reason || "Content policy violation",
      });
      return res.status(400).json({ message: safetyCheck.reason, errorCode: "IMG-006" });
    }

    const dailyLimit = settings?.aiImagesDailyLimit || 10;
    const monthlyLimit = settings?.aiImagesMonthlyLimit || 200;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyCount = await storage.getAiGenerationEventsCount(user.id, today);
    if (dailyCount >= dailyLimit) {
      return res.status(429).json({ message: `Daily limit reached (${dailyLimit} images/day)`, errorCode: "IMG-004" });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyCount = await storage.getAiGenerationEventsCountAll(monthStart);
    if (monthlyCount >= monthlyLimit) {
      return res.status(429).json({ message: `Monthly limit reached (${monthlyLimit} images/month)`, errorCode: "IMG-005" });
    }

    // STEP 1: Return job ID immediately (async processing)
    const jobId = crypto.randomUUID();
    imageJobs.set(jobId, { status: "processing", createdAt: Date.now() });
    res.status(202).json({ jobId, status: "processing" });

    // STEP 2: Background async — generate image, upload, save to DB
    (async () => {
      try {
        const stylePrompts: Record<string, string> = {
          photoreal: "photorealistic, high quality photography, professional, detailed",
          diagram: "technical diagram, clean lines, labeled, professional schematic",
          illustration: "simple illustration, clean, educational, clear colors",
          icon: "flat icon style, minimal, simple shapes, bold colors",
        };

        const fullPrompt = [
          `Landscaping/outdoor work context: ${prompt}`,
          style ? stylePrompts[style] : "",
          negativePrompt ? `Avoid: ${negativePrompt}` : "",
          (watermark !== false && settings?.aiImagesWatermarkDefault !== false)
            ? "Include a small subtle 'AI Generated' text watermark in the bottom-right corner"
            : "",
        ].filter(Boolean).join(". ");

        let imageBuffer: Buffer | null = null;
        let revisedPrompt: string | undefined;
        const maxRetries = 2;
        const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

        // STEP 2a: Call OpenAI image generation API
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              console.log(`[ai-image] Retry attempt ${attempt} for job ${jobId}`);
              await new Promise(r => setTimeout(r, 2000 * attempt));
            }
            const imageApiRes = await fetch(`${baseURL}/images/generations`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: "gpt-image-1",
                prompt: fullPrompt,
                size: "1024x1024",
              }),
            });
            if (!imageApiRes.ok) {
              const errBody = await imageApiRes.text();
              const statusCode = imageApiRes.status;
              if (attempt < maxRetries && (statusCode >= 500 || statusCode === 429)) {
                console.error(`[ai-image] Attempt ${attempt + 1} failed (${statusCode}), retrying...`);
                continue;
              }
              throw new Error(`Image API error ${statusCode}: ${errBody}`);
            }
            const imageResponseData = await imageApiRes.json() as any;
            const b64 = imageResponseData?.data?.[0]?.b64_json;
            revisedPrompt = imageResponseData?.data?.[0]?.revised_prompt;
            if (!b64) {
              throw new Error("No image data returned from AI");
            }
            imageBuffer = Buffer.from(b64, "base64");
            break;
          } catch (genErr: any) {
            const isRetryable = genErr.code === "ECONNREFUSED" || genErr.code === "ECONNRESET" ||
              genErr.message?.includes("fetch failed") || genErr.message?.includes("ECONNREFUSED");
            if (attempt < maxRetries && isRetryable) {
              console.error(`[ai-image] Attempt ${attempt + 1} network error, retrying...`, genErr.message);
              continue;
            }
            throw genErr;
          }
        }

        if (!imageBuffer) {
          throw new Error("No image data returned from AI");
        }

        // STEP 2b: Upload to Replit Object Storage via signed URL
        const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
        if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");
        const imageId = crypto.randomUUID();
        const objectPath = `${privateDir}/sop-media/${imageId}.png`;
        const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
        const bucketName = pathParts[0];
        const objectName = pathParts.slice(1).join("/");

        const SIDECAR = "http://127.0.0.1:1106";
        const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket_name: bucketName,
            object_name: objectName,
            method: "PUT",
            expires_at: new Date(Date.now() + 900 * 1000).toISOString(),
          }),
        });
        if (!signRes.ok) throw new Error(`Failed to get upload URL (${signRes.status})`);
        const { signed_url } = await signRes.json() as { signed_url: string };

        const uploadRes = await fetch(signed_url, {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: imageBuffer,
        });
        if (!uploadRes.ok) throw new Error(`Failed to upload image (${uploadRes.status})`);

        // STEP 2c: Save record to database
        const entityPath = `/objects/sop-media/${imageId}.png`;
        const useWatermark = watermark !== false && settings?.aiImagesWatermarkDefault !== false;

        const media = await storage.createSopMedia({
          sopId: targetId || null,
          stepIndex: stepIndex ?? null,
          placement: targetType === "sop_header" ? "header" : "step",
          url: entityPath,
          alt: prompt.slice(0, 200),
          source: "ai_generated",
          aiPrompt: prompt,
          aiStyle: style || null,
          aiNegativePrompt: negativePrompt || null,
          aiModel: "gpt-image-1",
          aiWatermarked: useWatermark,
          metadata: { revisedPrompt },
          createdBy: user.id,
        });

        await storage.createAiGenerationEvent({
          userId: user.id,
          targetType,
          targetId: targetId || null,
          prompt,
          negativePrompt: negativePrompt || null,
          style: style || null,
          model: "gpt-image-1",
          requestedSize: "1024x1024",
          resultMediaId: media.id,
          status: "success",
          errorMessage: null,
        });

        // STEP 3: Mark job as completed — frontend polls for this
        imageJobs.set(jobId, { status: "completed", result: media, createdAt: Date.now() });
      } catch (err: any) {
        console.error("AI image generation error:", err);
        try {
          await storage.createAiGenerationEvent({
            userId: user.id,
            targetType,
            targetId: targetId || null,
            prompt,
            negativePrompt: negativePrompt || null,
            style: style || null,
            model: "gpt-image-1",
            requestedSize: "1024x1024",
            resultMediaId: null,
            status: "failed",
            errorMessage: err.message,
          });
        } catch (logErr) {
          console.error("Failed to log AI generation error:", logErr);
        }
        const errorCode = err.message?.includes("No image data") ? "IMG-007" : 
                        err.message?.includes("timed out") || err.message?.includes("timeout") ? "IMG-008" :
                        err.message?.includes("save") || err.message?.includes("storage") ? "IMG-009" : "IMG-001";
        imageJobs.set(jobId, { status: "failed", error: err.message, errorCode, createdAt: Date.now() });
      }
    })();
  } catch (err: any) {
    console.error("AI image generation setup error:", err);
    res.status(500).json({ message: "AI image generation failed", error: err.message, errorCode: "IMG-001" });
  }
});

// ============================================================
// POLL ENDPOINT: GET /api/sop-media/ai-generate/status/:jobId
// PURPOSE: Frontend polls this every 3 seconds to check if done
// ============================================================

app.get("/api/sop-media/ai-generate/status/:jobId", requireAuth, async (req, res) => {
  const job = imageJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: "not_found", message: "Job not found or expired" });
  }
  if (job.status === "completed") {
    res.json({ status: "completed", result: job.result });
    imageJobs.delete(req.params.jobId);
  } else if (job.status === "failed") {
    res.json({ status: "failed", error: job.error, errorCode: (job as any).errorCode || "IMG-001" });
    imageJobs.delete(req.params.jobId);
  } else {
    res.json({ status: "processing" });
  }
});
