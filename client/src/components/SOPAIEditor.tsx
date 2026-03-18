import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Loader2, Save, RotateCcw, History, X,
  ImageIcon, RefreshCw, Check, ChevronRight, Clock,
  Shield, Wrench, Package, Target, AlertTriangle, Info,
  CheckCircle2, Camera
} from "lucide-react";
import type { Sop } from "@shared/schema";
import type { SOPStructuredData, SOPTemplateStep } from "./SOPTemplateRenderer";

interface SOPAIEditorProps {
  sop: Sop;
  onSaved: () => void;
  onClose: () => void;
}

type EditableField = "outcome" | "safetyNotes" | "complianceNotes" | "ppe" | "tools" | "materials";

interface ActiveEdit {
  field: EditableField | "step";
  stepIndex?: number;
  instruction: string;
}

interface ImageEdit {
  imageType: "header" | "step";
  stepIndex?: number;
  instruction: string;
}

function parseList(text?: string): string[] {
  if (!text) return [];
  return text.split("\n").map(l => l.trim()).filter(Boolean);
}

const fieldLabels: Record<EditableField, string> = {
  outcome: "Outcome / Purpose",
  safetyNotes: "Safety Notes",
  complianceNotes: "Compliance Notes",
  ppe: "PPE Requirements",
  tools: "Tools Required",
  materials: "Materials Required",
};

const fieldIcons: Record<EditableField, typeof Target> = {
  outcome: Target,
  safetyNotes: AlertTriangle,
  complianceNotes: Info,
  ppe: Shield,
  tools: Wrench,
  materials: Package,
};

export default function SOPAIEditor({ sop, onSaved, onClose }: SOPAIEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localData, setLocalData] = useState<SOPStructuredData>(
    (sop.structuredData as SOPStructuredData) || {}
  );
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const [imageEdit, setImageEdit] = useState<ImageEdit | null>(null);
  const [rewritePreview, setRewritePreview] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const versionsQuery = useQuery({
    queryKey: ["/api/sops", sop.id, "versions"],
    queryFn: () => fetch(`/api/sops/${sop.id}/versions`, { credentials: "include" }).then(r => r.json()),
    enabled: showVersions,
  });

  const rewriteMutation = useMutation({
    mutationFn: async (edit: ActiveEdit) => {
      const res = await apiRequest("POST", `/api/sops/${sop.id}/ai-rewrite`, {
        field: edit.field,
        stepIndex: edit.stepIndex,
        instruction: edit.instruction,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setRewritePreview(data.rewritten);
    },
    onError: () => {
      toast({ title: "AI rewrite failed", variant: "destructive" });
    },
  });

  const imageRegenMutation = useMutation({
    mutationFn: async (edit: ImageEdit) => {
      const res = await apiRequest("POST", `/api/sops/${sop.id}/ai-regenerate-image`, {
        imageType: edit.imageType,
        stepIndex: edit.stepIndex,
        instruction: edit.instruction,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setNewImageUrl(data.imageUrl);
    },
    onError: () => {
      toast({ title: "Image generation failed", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (changeSummary: string) => {
      await apiRequest("POST", `/api/sops/${sop.id}/save-version`, { changeSummary });
      const res = await apiRequest("PATCH", `/api/sops/${sop.id}`, {
        structuredData: localData,
        content: sop.content,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SOP saved with version history" });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      onSaved();
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await apiRequest("POST", `/api/sops/${sop.id}/restore-version/${versionId}`);
      return res.json();
    },
    onSuccess: (data) => {
      const restored = data.structuredData as SOPStructuredData;
      if (restored) {
        setLocalData(restored);
        setHasUnsavedChanges(false);
      }
      toast({ title: "Version restored" });
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops", sop.id, "versions"] });
      setShowVersions(false);
      onSaved();
    },
    onError: () => {
      toast({ title: "Failed to restore version", variant: "destructive" });
    },
  });

  const applyRewrite = useCallback(() => {
    if (!activeEdit || !rewritePreview) return;
    const updated = { ...localData };
    if (activeEdit.field === "step" && activeEdit.stepIndex !== undefined) {
      try {
        const parsed = JSON.parse(rewritePreview);
        const steps = [...(updated.steps || [])];
        steps[activeEdit.stepIndex] = { ...steps[activeEdit.stepIndex], ...parsed };
        updated.steps = steps;
      } catch {
        toast({ title: "Could not parse AI response for step", variant: "destructive" });
        return;
      }
    } else {
      const field = activeEdit.field as EditableField;
      (updated as any)[field] = rewritePreview;
    }
    setLocalData(updated);
    setHasUnsavedChanges(true);
    setActiveEdit(null);
    setRewritePreview(null);
    toast({ title: "Changes applied — remember to save" });
  }, [activeEdit, rewritePreview, localData, toast]);

  const applyImage = useCallback(() => {
    if (!imageEdit || !newImageUrl) return;
    const updated = { ...localData };
    if (imageEdit.imageType === "header") {
      updated.headerImageUrl = newImageUrl;
    } else if (imageEdit.imageType === "step" && imageEdit.stepIndex !== undefined) {
      const steps = [...(updated.steps || [])];
      steps[imageEdit.stepIndex] = { ...steps[imageEdit.stepIndex], imageUrl: newImageUrl };
      updated.steps = steps;
    }
    setLocalData(updated);
    setHasUnsavedChanges(true);
    setImageEdit(null);
    setNewImageUrl(null);
    toast({ title: "Image updated — remember to save" });
  }, [imageEdit, newImageUrl, localData, toast]);

  const steps = localData.steps || [];
  const ppeItems = parseList(localData.ppe);
  const toolItems = parseList(localData.tools);
  const materialItems = parseList(localData.materials);

  const renderEditButton = (field: EditableField | "step", stepIndex?: number) => (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 gap-1 text-xs text-primary opacity-70 hover:opacity-100"
      onClick={() => {
        setActiveEdit({ field, stepIndex, instruction: "" });
        setRewritePreview(null);
      }}
      data-testid={`button-ai-edit-${field}${stepIndex !== undefined ? `-${stepIndex}` : ""}`}
    >
      <Sparkles className="h-3 w-3" />
      AI Edit
    </Button>
  );

  const renderImageEditButton = (imageType: "header" | "step", stepIndex?: number) => (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 gap-1 text-xs text-purple-600 opacity-70 hover:opacity-100"
      onClick={() => {
        setImageEdit({ imageType, stepIndex, instruction: "" });
        setNewImageUrl(null);
      }}
      data-testid={`button-regen-image-${imageType}${stepIndex !== undefined ? `-${stepIndex}` : ""}`}
    >
      <RefreshCw className="h-3 w-3" />
      Regenerate
    </Button>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="sop-ai-editor">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} size="sm" data-testid="button-close-ai-editor">
            <X className="h-4 w-4 mr-1" /> Close Editor
          </Button>
          <h2 className="font-semibold text-lg truncate max-w-xs">{sop.title}</h2>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Unsaved changes</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowVersions(true)} data-testid="button-version-history">
            <History className="h-4 w-4 mr-1" /> Versions
          </Button>
          <Button
            size="sm"
            disabled={!hasUnsavedChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate("AI-assisted edit")}
            data-testid="button-save-sop"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <Sparkles className="h-4 w-4 inline mr-1" />
        Click <strong>"AI Edit"</strong> on any section to rewrite it with AI, or <strong>"Regenerate"</strong> on any image to create a new one. Your changes are previewed before applying.
      </div>

      {localData.headerImageUrl && (
        <div className="text-center relative group">
          <img src={localData.headerImageUrl} alt={sop.title} className="max-w-full max-h-72 rounded-lg mx-auto border" />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {renderImageEditButton("header")}
          </div>
        </div>
      )}

      {localData.outcome && (
        <div className="border-l-4 border-green-300 bg-green-50 rounded p-4 relative group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-700" />
              <h2 className="font-semibold">Outcome / Purpose</h2>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {renderEditButton("outcome")}
            </div>
          </div>
          <p className="text-gray-700 leading-7">{localData.outcome}</p>
        </div>
      )}

      {(ppeItems.length > 0 || toolItems.length > 0 || materialItems.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ppeItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 relative group">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 font-semibold text-base">
                  <Shield className="w-5 h-5 text-amber-700" /> PPE Required
                </h2>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {renderEditButton("ppe")}
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {ppeItems.map((item, i) => <li key={i} className="flex items-start gap-2"><span className="text-amber-700 font-bold">&bull;</span>{item}</li>)}
              </ul>
            </div>
          )}
          {toolItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 relative group">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 font-semibold text-base">
                  <Wrench className="w-5 h-5 text-blue-600" /> Tools Required
                </h2>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {renderEditButton("tools")}
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {toolItems.map((item, i) => <li key={i} className="flex items-start gap-2"><span className="text-blue-600 font-bold">&bull;</span>{item}</li>)}
              </ul>
            </div>
          )}
          {materialItems.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 relative group">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 font-semibold text-base">
                  <Package className="w-5 h-5 text-green-600" /> Materials Required
                </h2>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {renderEditButton("materials")}
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {materialItems.map((item, i) => <li key={i} className="flex items-start gap-2"><span className="text-green-600 font-bold">&bull;</span>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Procedure Steps</h2>
          <div className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <div key={step.id || i} className="border border-gray-200 rounded-lg bg-white shadow-sm p-4 relative group">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{step.title || `Step ${i + 1}`}</h3>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {renderEditButton("step", i)}
                      </div>
                    </div>
                    <p className="text-gray-700 leading-7 mb-3">{step.instruction}</p>
                    {step.imageUrl && (
                      <div className="my-3 relative inline-block group/img">
                        <img src={step.imageUrl} alt={step.title} className="max-w-full max-h-48 rounded-md border" />
                        <div className="absolute top-1 right-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          {renderImageEditButton("step", i)}
                        </div>
                      </div>
                    )}
                    {step.why && (
                      <div className="bg-blue-50 border-l-2 border-blue-400 py-2 px-3 mb-3">
                        <p className="text-sm italic text-blue-900">
                          <span className="not-italic font-medium">Why it matters: </span>{step.why}
                        </p>
                      </div>
                    )}
                    {step.successCriteria && (
                      <div className="flex items-start gap-2 mb-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700"><span className="font-medium">Success: </span>{step.successCriteria}</p>
                      </div>
                    )}
                    {step.commonMistakes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-900"><span className="font-medium">Common mistake: </span>{step.commonMistakes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {localData.safetyNotes && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 relative group">
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-5 h-5 text-red-600" /> Safety Notes
            </h2>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {renderEditButton("safetyNotes")}
            </div>
          </div>
          <p className="text-gray-800 leading-7 whitespace-pre-line">{localData.safetyNotes}</p>
        </div>
      )}

      {localData.complianceNotes && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 relative group">
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Info className="w-5 h-5 text-blue-600" /> Compliance Notes
            </h2>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {renderEditButton("complianceNotes")}
            </div>
          </div>
          <p className="text-gray-700 leading-7 whitespace-pre-line">{localData.complianceNotes}</p>
        </div>
      )}

      <Dialog open={!!activeEdit} onOpenChange={(open) => { if (!open) { setActiveEdit(null); setRewritePreview(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Rewrite — {activeEdit?.field === "step" ? `Step ${(activeEdit?.stepIndex ?? 0) + 1}` : fieldLabels[(activeEdit?.field as EditableField) || "outcome"]}
            </DialogTitle>
            <DialogDescription>
              Describe what you want changed. The AI will rewrite the section based on your instruction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="e.g. Make this more specific to commercial properties, add a warning about wet conditions, shorten this..."
              value={activeEdit?.instruction || ""}
              onChange={(e) => setActiveEdit(prev => prev ? { ...prev, instruction: e.target.value } : null)}
              rows={3}
              data-testid="textarea-ai-instruction"
            />
            {!rewritePreview && (
              <Button
                onClick={() => activeEdit && rewriteMutation.mutate(activeEdit)}
                disabled={!activeEdit?.instruction || rewriteMutation.isPending}
                className="w-full"
                data-testid="button-run-ai-rewrite"
              >
                {rewriteMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rewriting...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Generate Rewrite</>
                )}
              </Button>
            )}
            {rewritePreview && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-700 mb-1">AI Suggestion:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{
                    activeEdit?.field === "step" ? (() => {
                      try {
                        const parsed = JSON.parse(rewritePreview);
                        return `Title: ${parsed.title}\n\nInstruction: ${parsed.instruction}${parsed.why ? `\n\nWhy: ${parsed.why}` : ""}${parsed.successCriteria ? `\n\nSuccess: ${parsed.successCriteria}` : ""}${parsed.commonMistakes ? `\n\nCommon mistake: ${parsed.commonMistakes}` : ""}`;
                      } catch { return rewritePreview; }
                    })() : rewritePreview
                  }</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={applyRewrite} className="flex-1" data-testid="button-apply-rewrite">
                    <Check className="h-4 w-4 mr-1" /> Apply
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setRewritePreview(null); }}
                    className="flex-1"
                    data-testid="button-try-again"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imageEdit} onOpenChange={(open) => { if (!open) { setImageEdit(null); setNewImageUrl(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-purple-600" />
              Regenerate {imageEdit?.imageType === "header" ? "Header" : `Step ${(imageEdit?.stepIndex ?? 0) + 1}`} Image
            </DialogTitle>
            <DialogDescription>
              Describe what the new image should show, or leave blank for an automatic prompt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="e.g. Show crew using a wood chipper instead of hand tools, add safety gear visible..."
              value={imageEdit?.instruction || ""}
              onChange={(e) => setImageEdit(prev => prev ? { ...prev, instruction: e.target.value } : null)}
              rows={3}
              data-testid="textarea-image-instruction"
            />
            {!newImageUrl && (
              <Button
                onClick={() => imageEdit && imageRegenMutation.mutate(imageEdit)}
                disabled={imageRegenMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700"
                data-testid="button-run-image-regen"
              >
                {imageRegenMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating image (30-45s)...</>
                ) : (
                  <><Camera className="h-4 w-4 mr-2" /> Generate New Image</>
                )}
              </Button>
            )}
            {newImageUrl && (
              <div className="space-y-3">
                <div className="border rounded-lg overflow-hidden">
                  <img src={newImageUrl} alt="New generated image" className="w-full max-h-64 object-contain" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={applyImage} className="flex-1" data-testid="button-apply-image">
                    <Check className="h-4 w-4 mr-1" /> Use This Image
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setNewImageUrl(null)}
                    className="flex-1"
                    data-testid="button-regen-again"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Generate Another
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={showVersions} onOpenChange={setShowVersions}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Version History
            </SheetTitle>
            <SheetDescription>
              Browse previous versions and restore any one with a single click.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
            {versionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !versionsQuery.data?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No versions saved yet</p>
                <p className="text-sm">Versions are created each time you save changes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(versionsQuery.data as any[]).map((version: any) => (
                  <div key={version.id} className="border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        Version {version.versionNumber}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(version.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    {version.changeSummary && (
                      <p className="text-sm text-muted-foreground mb-2">{version.changeSummary}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => restoreMutation.mutate(version.id)}
                      disabled={restoreMutation.isPending}
                      data-testid={`button-restore-version-${version.versionNumber}`}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1" />
                      )}
                      Restore This Version
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
