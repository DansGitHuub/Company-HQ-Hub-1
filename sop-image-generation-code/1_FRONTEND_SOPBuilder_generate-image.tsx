// ============================================================
// FILE: client/src/components/SOPBuilder.tsx
// SECTION: AI Image Generation (lines ~860-930)
// PURPOSE: Runs when user clicks "Generate" button in SOP Builder
// ============================================================

const [isGenerating, setIsGenerating] = useState(false);

const pollForResult = useCallback(async (jobId: string) => {
  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await fetch(`/api/sop-media/ai-generate/status/${jobId}`, { credentials: "include" });
      const data = await res.json();
      if (data.status === "completed") {
        setPreview({
          id: data.result.id,
          url: data.result.url,
          alt: data.result.alt || prompt,
          source: "ai_generated",
          aiPrompt: prompt,
          aiStyle: style,
        });
        toast({ title: "Image generated successfully" });
        setIsGenerating(false);
        return;
      } else if (data.status === "failed") {
        const code = data.errorCode || "IMG-001";
        showErrorToast(new ApiError(500, data.error || "Image generation failed", code, data.error), "Generation failed");
        setIsGenerating(false);
        return;
      } else if (data.status === "not_found") {
        showErrorToast(new ApiError(404, "Job expired or not found. Please try again.", "IMG-008"), "Generation failed");
        setIsGenerating(false);
        return;
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }
  toast({ title: "Generation timed out", description: "The image took too long to generate. Please try again.", variant: "destructive", duration: 15000 });
  setIsGenerating(false);
}, [prompt, style, toast]);

const generateMutation = useMutation({
  mutationFn: async () => {
    const res = await apiRequest("POST", "/api/sop-media/ai-generate", {
      targetType,
      stepIndex,
      prompt,
      negativePrompt: negativePrompt || undefined,
      style,
    });
    return await res.json();
  },
  onSuccess: (data) => {
    if (data.jobId) {
      setIsGenerating(true);
      pollForResult(data.jobId);
    } else if (data.id) {
      setPreview({
        id: data.id,
        url: data.url,
        alt: data.alt || prompt,
        source: "ai_generated",
        aiPrompt: prompt,
        aiStyle: style,
      });
      toast({ title: "Image generated successfully" });
    }
  },
  onError: (err: any) => {
    showErrorToast(err, "Generation failed");
  },
});
