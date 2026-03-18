import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Check,
  X,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Zap,
  FileText,
  AlertTriangle,
  Play,
  ExternalLink,
  Settings,
  Timer,
} from "lucide-react";
import type { SopPipeline, SopCategory, SopPipelineSettings } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  suggested: { label: "Suggested", color: "text-blue-700", bg: "bg-blue-100" },
  approved: { label: "Approved", color: "text-green-700", bg: "bg-green-100" },
  scheduled: { label: "Scheduled", color: "text-purple-700", bg: "bg-purple-100" },
  generating: { label: "Generating", color: "text-amber-700", bg: "bg-amber-100" },
  draft: { label: "Draft", color: "text-orange-700", bg: "bg-orange-100" },
  published: { label: "Published", color: "text-emerald-700", bg: "bg-emerald-100" },
  rejected: { label: "Rejected", color: "text-red-700", bg: "bg-red-100" },
};

const SOP_TYPES: Record<string, string> = {
  standard: "Standard Procedure",
  safety: "Safety Procedure",
  maintenance: "Maintenance",
  training: "Training Guide",
  quality: "Quality Control",
  emergency: "Emergency Response",
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Low", color: "text-gray-500" },
  2: { label: "Medium-Low", color: "text-blue-500" },
  3: { label: "Medium", color: "text-yellow-600" },
  4: { label: "High", color: "text-orange-500" },
  5: { label: "Critical", color: "text-red-600" },
};

export default function SOPPipeline() {
  const { toast } = useToast();
  const [promptInput, setPromptInput] = useState("");
  const [editItem, setEditItem] = useState<SopPipeline | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSopType, setEditSopType] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SopPipeline | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SopPipeline | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [generatingJobs, setGeneratingJobs] = useState<Record<string, { jobId: string; progress: number; step: string; status: string; sopId?: string }>>({});
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const { data: items = [], isLoading } = useQuery<SopPipeline[]>({
    queryKey: ["/api/sop-pipeline"],
  });

  const { data: categories = [] } = useQuery<SopCategory[]>({
    queryKey: ["/api/sop-categories"],
  });

  const { data: pipelineSettings } = useQuery<SopPipelineSettings>({
    queryKey: ["/api/sop-pipeline/settings"],
  });

  const [showScheduleSettings, setShowScheduleSettings] = useState(false);

  const settingsMutation = useMutation({
    mutationFn: async (updates: Partial<SopPipelineSettings>) => {
      const res = await apiRequest("PATCH", "/api/sop-pipeline/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-pipeline/settings"] });
      toast({ title: "Schedule settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/sop-pipeline/suggest", { prompt: prompt || undefined });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-pipeline"] });
      toast({ title: `${data.count} topics suggested`, description: "Review and approve topics to add them to the pipeline." });
      setPromptInput("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate suggestions. Please try again.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/sop-pipeline/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-pipeline"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update item.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sop-pipeline/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-pipeline"] });
      toast({ title: "Deleted", description: "Pipeline item removed." });
    },
  });

  const handleApprove = (item: SopPipeline) => {
    updateMutation.mutate({ id: item.id, updates: { status: "approved" } });
    toast({ title: "Approved", description: `"${item.title}" has been approved for content generation.` });
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    updateMutation.mutate({ id: rejectTarget.id, updates: { status: "rejected", rejectedReason: rejectReason || "No reason provided" } });
    toast({ title: "Rejected", description: `"${rejectTarget.title}" has been rejected.` });
    setRejectTarget(null);
    setRejectReason("");
  };

  const handleEdit = (item: SopPipeline) => {
    setEditItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description || "");
    setEditCategory(item.category);
    setEditSopType(item.sopType);
    setEditPriority(item.priority);
  };

  const handleEditSave = () => {
    if (!editItem) return;
    updateMutation.mutate({
      id: editItem.id,
      updates: {
        title: editTitle,
        description: editDescription,
        category: editCategory,
        categoryId: categories.find(c => c.name === editCategory)?.id || editItem.categoryId,
        sopType: editSopType,
        priority: editPriority,
      },
    });
    toast({ title: "Updated", description: "Topic details have been saved." });
    setEditItem(null);
  };

  const startPolling = useCallback((itemId: string, jobId: string) => {
    if (pollingRef.current[itemId]) clearInterval(pollingRef.current[itemId]);
    pollingRef.current[itemId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/sop-pipeline/generate-status/${jobId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setGeneratingJobs(prev => ({ ...prev, [itemId]: { jobId, ...data } }));
        if (data.status === "complete" || data.status === "error") {
          clearInterval(pollingRef.current[itemId]);
          delete pollingRef.current[itemId];
          queryClient.invalidateQueries({ queryKey: ["/api/sop-pipeline"] });
          if (data.status === "complete") {
            toast({ title: "SOP Published!", description: "The SOP has been generated and added to your library." });
          } else {
            toast({ title: "Generation Failed", description: data.error || "An error occurred.", variant: "destructive" });
          }
        }
      } catch {}
    }, 2000);
  }, [toast]);

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(interval => clearInterval(interval));
    };
  }, []);

  const handleGenerate = async (item: SopPipeline) => {
    try {
      const res = await apiRequest("POST", `/api/sop-pipeline/${item.id}/generate`);
      const data = await res.json();
      setGeneratingJobs(prev => ({ ...prev, [item.id]: { jobId: data.jobId, progress: 0, step: "Starting...", status: "processing" } }));
      startPolling(item.id, data.jobId);
      queryClient.invalidateQueries({ queryKey: ["/api/sop-pipeline"] });
    } catch {
      toast({ title: "Error", description: "Failed to start generation.", variant: "destructive" });
    }
  };

  const filteredItems = statusFilter === "all" ? items : items.filter(i => i.status === statusFilter);

  const suggestedCount = items.filter(i => i.status === "suggested").length;
  const approvedCount = items.filter(i => i.status === "approved").length;
  const publishedCount = items.filter(i => i.status === "published").length;
  const rejectedCount = items.filter(i => i.status === "rejected").length;

  return (
    <div className="space-y-6" data-testid="sop-pipeline">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-pipeline-title">SOP Pipeline</h2>
          <p className="text-sm text-muted-foreground">AI-powered SOP topic generation and approval queue</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === "suggested" ? "all" : "suggested")} data-testid="stat-suggested">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{suggestedCount}</p>
            <p className="text-xs text-muted-foreground">Awaiting Review</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === "approved" ? "all" : "approved")} data-testid="stat-approved">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === "published" ? "all" : "published")} data-testid="stat-published">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{publishedCount}</p>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")} data-testid="stat-rejected">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-schedule-settings">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium text-sm">Auto-Generation Schedule</p>
                <p className="text-xs text-muted-foreground">
                  {pipelineSettings?.autoGenerateEnabled
                    ? `Generating ${pipelineSettings.maxPerRun} SOP(s) ${pipelineSettings.generateFrequency}${pipelineSettings.nextScheduledRun ? ` — next run: ${new Date(pipelineSettings.nextScheduledRun).toLocaleString()}` : ""}`
                    : "Disabled — approved topics require manual generation"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={pipelineSettings?.autoGenerateEnabled || false}
                  onCheckedChange={(checked) => settingsMutation.mutate({ autoGenerateEnabled: checked } as any)}
                  data-testid="switch-auto-generate"
                />
                <Label className="text-sm">{pipelineSettings?.autoGenerateEnabled ? "On" : "Off"}</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                data-testid="button-schedule-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {showScheduleSettings && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Frequency</Label>
                <Select
                  value={pipelineSettings?.generateFrequency || "daily"}
                  onValueChange={(val) => settingsMutation.mutate({ generateFrequency: val } as any)}
                >
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Once Daily</SelectItem>
                    <SelectItem value="weekly">Once Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">SOPs Per Run</Label>
                <Select
                  value={String(pipelineSettings?.maxPerRun || 1)}
                  onValueChange={(val) => settingsMutation.mutate({ maxPerRun: parseInt(val) } as any)}
                >
                  <SelectTrigger data-testid="select-max-per-run">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 SOP</SelectItem>
                    <SelectItem value="2">2 SOPs</SelectItem>
                    <SelectItem value="3">3 SOPs</SelectItem>
                    <SelectItem value="5">5 SOPs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pipelineSettings?.lastAutoRun && (
                <div className="col-span-full text-xs text-muted-foreground">
                  Last auto-run: {new Date(pipelineSettings.lastAutoRun).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-suggest-topics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Generate Topic Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Optional focus area (e.g., 'winter operations', 'customer service')..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="flex-1"
              data-testid="input-suggest-prompt"
            />
            <Button
              onClick={() => suggestMutation.mutate(promptInput)}
              disabled={suggestMutation.isPending}
              data-testid="button-generate-suggestions"
            >
              {suggestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Generate 5 Topics
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            The AI analyzes your existing SOPs and suggests new topics that fill gaps in your library.
          </p>
        </CardContent>
      </Card>

      {statusFilter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Filtering: {STATUS_CONFIG[statusFilter]?.label}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")} data-testid="button-clear-filter">
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {items.length === 0
                ? "No pipeline items yet. Generate some topic suggestions to get started!"
                : "No items match the current filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.suggested;
            const priorityCfg = PRIORITY_LABELS[item.priority] || PRIORITY_LABELS[1];
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow" data-testid={`pipeline-item-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base" data-testid={`text-title-${item.id}`}>{item.title}</h3>
                        <Badge className={`${statusCfg.bg} ${statusCfg.color} border-0 text-xs`} data-testid={`badge-status-${item.id}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2" data-testid={`text-desc-${item.id}`}>{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {item.category}
                        </span>
                        <span>{SOP_TYPES[item.sopType] || item.sopType}</span>
                        <span className={`font-medium ${priorityCfg.color}`}>
                          Priority: {priorityCfg.label}
                        </span>
                        {item.suggestedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.suggestedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {item.status === "rejected" && item.rejectedReason && (
                        <div className="mt-2 flex items-start gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{item.rejectedReason}</span>
                        </div>
                      )}
                      {(item.status === "generating" || generatingJobs[item.id]?.status === "processing") && (
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                            <span className="text-sm text-amber-700 font-medium">
                              {generatingJobs[item.id]?.step || "Generating SOP content and images..."}
                            </span>
                          </div>
                          <Progress value={generatingJobs[item.id]?.progress || 5} className="h-2" />
                        </div>
                      )}
                      {item.status === "published" && item.generatedSopId && (
                        <div className="mt-2">
                          <a
                            href={`/sops`}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            data-testid={`link-view-sop-${item.id}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View in SOP Library
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "suggested" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(item)}
                            disabled={updateMutation.isPending}
                            data-testid={`button-approve-${item.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setRejectTarget(item); setRejectReason(""); }}
                            disabled={updateMutation.isPending}
                            data-testid={`button-reject-${item.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      {item.status === "approved" && !generatingJobs[item.id] && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => handleGenerate(item)}
                          data-testid={`button-generate-${item.id}`}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Generate SOP
                        </Button>
                      )}
                      {item.status !== "generating" && !generatingJobs[item.id]?.status && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(item)}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid="input-edit-title" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} data-testid="input-edit-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">SOP Type</label>
                <Select value={editSopType} onValueChange={setEditSopType}>
                  <SelectTrigger data-testid="select-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOP_TYPES).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={String(editPriority)} onValueChange={(v) => setEditPriority(Number(v))}>
                <SelectTrigger data-testid="select-edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditItem(null)} data-testid="button-edit-cancel">Cancel</Button>
              <Button onClick={handleEditSave} disabled={!editTitle.trim()} data-testid="button-edit-save">Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Why are you rejecting "{rejectTarget?.title}"? This helps the AI generate better suggestions in the future.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Optional reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            data-testid="input-reject-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reject-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700" data-testid="button-reject-confirm">
              Reject Topic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteTarget?.title}" from the pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); } }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
