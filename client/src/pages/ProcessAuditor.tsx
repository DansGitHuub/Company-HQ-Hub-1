import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ClipboardCheck,
  Play,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  TrendingUp,
  Users,
  Shield,
  Loader2,
  RefreshCw,
  Info,
  ArrowRight,
  Plus,
  Trash2,
  MoreHorizontal,
  Pencil,
  Calendar,
  Zap,
  XCircle,
  Link2,
  BookOpen,
  Star,
  ChevronRight,
  Bell,
  GripVertical,
} from "lucide-react";
import type { BusinessProcess, ProcessAuditResult, ProcessAuditSchedule } from "@shared/schema";

const ROLES = ["Admin", "Manager", "Crew", "Customer"] as const;
const CATEGORIES = [
  { value: "customer_facing", label: "Customer Facing" },
  { value: "internal", label: "Internal Operations" },
  { value: "hiring", label: "Hiring & HR" },
  { value: "jobs", label: "Jobs & Estimates" },
  { value: "maintenance", label: "Maintenance" },
  { value: "general", label: "General" },
];

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function severityColor(s: string) {
  switch (s) {
    case "critical": return "bg-red-100 text-red-900 border-red-200";
    case "high": return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default: return "bg-blue-50 text-blue-800 border-blue-200";
  }
}

function severityIcon(s: string) {
  switch (s) {
    case "critical":
    case "high": return <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
    case "medium": return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />;
    default: return <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
  }
}

function priorityBadge(p: string) {
  switch (p) {
    case "high": return "bg-red-100 text-red-800";
    case "medium": return "bg-yellow-100 text-yellow-800";
    default: return "bg-green-100 text-green-800";
  }
}

function gapBadge(g: string) {
  switch (g) {
    case "major": return "bg-red-100 text-red-800";
    case "minor": return "bg-yellow-100 text-yellow-800";
    default: return "bg-green-100 text-green-800";
  }
}

function AuditPhaseIndicator({ phase }: { phase: string }) {
  const phases = [
    { key: "researching", label: "Researching" },
    { key: "analyzing", label: "Analyzing" },
    { key: "checking", label: "Checking Connectors" },
    { key: "completed", label: "Complete" },
  ];
  const currentIdx = phases.findIndex(p => p.key === phase);

  return (
    <div className="flex items-center gap-1 text-sm" data-testid="audit-phase-indicator">
      {phases.map((p, idx) => (
        <div key={p.key} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
            idx < currentIdx ? "bg-green-100 text-green-700" :
            idx === currentIdx ? "bg-blue-100 text-blue-700" :
            "bg-muted text-muted-foreground"
          }`}>
            {idx < currentIdx && <CheckCircle2 className="h-3 w-3" />}
            {idx === currentIdx && <Loader2 className="h-3 w-3 animate-spin" />}
            {p.label}
          </div>
          {idx < phases.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

function StepEditor({
  steps,
  onChange,
}: {
  steps: any[];
  onChange: (steps: any[]) => void;
}) {
  const addStep = () => onChange([...steps, { name: "", role: "Manager", description: "", order: steps.length + 1 }]);
  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx));
  const updateStep = (idx: number, field: string, value: string) => {
    const updated = steps.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2.5 w-6 shrink-0">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Input
              placeholder="Step name"
              value={step.name || ""}
              onChange={e => updateStep(idx, "name", e.target.value)}
              data-testid={`input-step-name-${idx}`}
            />
            <Select value={step.role || "Manager"} onValueChange={v => updateStep(idx, "role", v)}>
              <SelectTrigger data-testid={`select-step-role-${idx}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Description (optional)"
              value={step.description || ""}
              onChange={e => updateStep(idx, "description", e.target.value)}
              className="col-span-2"
              data-testid={`input-step-desc-${idx}`}
            />
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => removeStep(idx)}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addStep} className="w-full" data-testid="button-add-step">
        <Plus className="h-4 w-4 mr-2" /> Add Step
      </Button>
    </div>
  );
}

function ProcessFormDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: BusinessProcess | null;
}) {
  const { t } = useTranslation("processAuditor");
  const { toast } = useToast();
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [category, setCategory] = useState(existing?.category || "general");
  const [estimatedDuration, setEstimatedDuration] = useState(existing?.estimatedDuration || "");
  const [rolesInvolved, setRolesInvolved] = useState<string[]>(
    (existing?.rolesInvolved as string[]) || []
  );
  const [steps, setSteps] = useState<any[]>((existing?.stepsJson as any[]) || []);

  useEffect(() => {
    if (open) {
      setName(existing?.name || "");
      setDescription(existing?.description || "");
      setCategory(existing?.category || "general");
      setEstimatedDuration(existing?.estimatedDuration || "");
      setRolesInvolved((existing?.rolesInvolved as string[]) || []);
      setSteps((existing?.stepsJson as any[]) || []);
    }
  }, [open, existing]);

  const toggleRole = (role: string) => {
    setRolesInvolved(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (existing) {
        return apiRequest("PATCH", `/api/business-processes/${existing.id}`, data).then(r => r.json());
      }
      return apiRequest("POST", "/api/business-processes", data).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-processes"] });
      toast({ title: existing ? t("processUpdated") : t("processCreated") });
      onClose();
    },
    onError: () => toast({ title: t("failedToSave"), variant: "destructive" }),
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: t("processNameRequired"), variant: "destructive" });
      return;
    }
    mutation.mutate({ name, description, category, estimatedDuration, rolesInvolved, stepsJson: steps });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? t("editProcess") : t("createProcess")}</DialogTitle>
          <DialogDescription>
            {t("processFormDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>{t("processName")}</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., New Customer Estimate"
                data-testid="input-process-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-process-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("estimatedDuration")}</Label>
              <Input
                value={estimatedDuration}
                onChange={e => setEstimatedDuration(e.target.value)}
                placeholder="e.g., 2-4 hours"
                data-testid="input-process-duration"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t("descriptionLabel")}</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does this process accomplish?"
                rows={3}
                data-testid="input-process-description"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("rolesInvolved")}</Label>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map(role => (
                <Badge
                  key={role}
                  variant={rolesInvolved.includes(role) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleRole(role)}
                  data-testid={`badge-role-${role.toLowerCase()}`}
                >
                  {role}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("processSteps")}</Label>
            <StepEditor steps={steps} onChange={setSteps} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-save-process">
              {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {existing ? t("saveChanges") : t("createProcess")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  onClose,
  processId,
  existingSchedule,
}: {
  open: boolean;
  onClose: () => void;
  processId: string;
  existingSchedule?: ProcessAuditSchedule | null;
}) {
  const { t } = useTranslation("processAuditor");
  const { toast } = useToast();
  const [frequency, setFrequency] = useState(existingSchedule?.frequency || "weekly");
  const [customDays, setCustomDays] = useState(existingSchedule?.customIntervalDays ?? 7);
  const [isEnabled, setIsEnabled] = useState(existingSchedule?.isEnabled !== false);

  useEffect(() => {
    if (open) {
      setFrequency(existingSchedule?.frequency || "weekly");
      setCustomDays(existingSchedule?.customIntervalDays ?? 7);
      setIsEnabled(existingSchedule?.isEnabled !== false);
    }
  }, [open, existingSchedule]);

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/process-audit-schedules", {
        processId,
        frequency,
        customIntervalDays: customDays,
        isEnabled,
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/process-audit-schedules", processId] });
      toast({ title: t("scheduleSaved") });
      onClose();
    },
    onError: () => toast({ title: t("failedToSaveSchedule"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingSchedule) return;
      return apiRequest("DELETE", `/api/process-audit-schedules/${existingSchedule.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/process-audit-schedules", processId] });
      toast({ title: t("scheduleRemoved") });
      onClose();
    },
  });

  const freqLabel: Record<string, string> = {
    daily: "Every day",
    weekly: "Every 7 days",
    monthly: "Every 30 days",
    custom: `Every ${customDays} days`,
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> {t("auditSchedule")}
          </DialogTitle>
          <DialogDescription>
            {t("scheduleDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{t("enableAutoAudits")}</p>
              <p className="text-xs text-muted-foreground">{t("auditsBackground")}</p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              data-testid="switch-schedule-enabled"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("frequency")}</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="select-schedule-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("daily")}</SelectItem>
                <SelectItem value="weekly">{t("weekly")}</SelectItem>
                <SelectItem value="monthly">{t("monthly")}</SelectItem>
                <SelectItem value="custom">{t("custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency === "custom" && (
            <div className="space-y-1.5">
              <Label>{t("runEvery")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={e => setCustomDays(Number(e.target.value))}
                  className="w-24"
                  data-testid="input-custom-days"
                />
                <span className="text-sm text-muted-foreground">{t("days")}</span>
              </div>
            </div>
          )}

          {isEnabled && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium">{t("scheduleSummary")}</p>
              <p className="mt-1 text-blue-700">{freqLabel[frequency]} — the AI will research your process against current best practices and report any new issues or improvements.</p>
            </div>
          )}

          <div className="flex gap-2 justify-between pt-1">
            {existingSchedule && (
              <Button
                variant="outline"
                className="text-destructive border-destructive/30"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-schedule"
              >
                {t("removeSchedule")}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-schedule">
                {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t("saveSchedule")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProcessAuditor() {
  const { t } = useTranslation("processAuditor");
  const { toast } = useToast();
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editProcess, setEditProcess] = useState<BusinessProcess | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [pollingAuditId, setPollingAuditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [addingStepIdx, setAddingStepIdx] = useState<number | null>(null);

  const { data: processes = [] } = useQuery<BusinessProcess[]>({
    queryKey: ["/api/business-processes"],
  });

  const { data: auditResults = [], refetch: refetchAudits } = useQuery<ProcessAuditResult[]>({
    queryKey: ["/api/process-audits", selectedProcessId],
    queryFn: async () => {
      const url = selectedProcessId
        ? `/api/process-audits?processId=${selectedProcessId}`
        : "/api/process-audits";
      return apiRequest("GET", url).then(r => r.json());
    },
    refetchInterval: pollingAuditId ? 2000 : false,
  });

  const { data: schedule } = useQuery<ProcessAuditSchedule | null>({
    queryKey: ["/api/process-audit-schedules", selectedProcessId],
    queryFn: async () => {
      if (!selectedProcessId) return null;
      return apiRequest("GET", `/api/process-audit-schedules/${selectedProcessId}`).then(r => r.json());
    },
    enabled: !!selectedProcessId,
  });

  const runAuditMutation = useMutation({
    mutationFn: async (processId: string) => {
      return apiRequest("POST", "/api/process-audits/run", { processId }).then(r => r.json());
    },
    onSuccess: (data) => {
      toast({ title: t("auditStarted"), description: t("auditStartedDesc") });
      setPollingAuditId(data.auditId);
      setActiveTab("overview");
      refetchAudits();
    },
    onError: () => toast({ title: t("failedToStart"), variant: "destructive" }),
  });

  const deleteProcessMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/business-processes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-processes"] });
      setSelectedProcessId("");
      toast({ title: t("processDeleted") });
    },
  });

  const addStepMutation = useMutation({
    mutationFn: async ({ processId, step }: { processId: string; step: any }) => {
      return apiRequest("POST", `/api/business-processes/${processId}/add-step`, { step }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-processes"] });
      toast({ title: t("stepAdded") });
      setAddingStepIdx(null);
    },
    onError: () => toast({ title: t("failedToAddStep"), variant: "destructive" }),
  });

  useEffect(() => {
    if (!pollingAuditId) return;
    const current = auditResults.find(a => a.id === pollingAuditId);
    if (current && current.status !== "running") {
      setPollingAuditId(null);
      if (current.status === "completed") {
        toast({ title: "Audit complete", description: `Overall score: ${current.overallScore}/100` });
      } else if (current.status === "failed") {
        toast({
          title: "Audit failed",
          description: current.errorMessage || "An error occurred during the audit.",
          variant: "destructive",
        });
      }
    }
  }, [auditResults, pollingAuditId, toast]);

  const selectedProcess = processes.find(p => p.id === selectedProcessId);
  const latestAudit = auditResults.find(a => a.processId === selectedProcessId);
  const isRunning = latestAudit?.status === "running";
  const isFailed = latestAudit?.status === "failed";
  const isCompleted = latestAudit?.status === "completed";

  const connectorIssues = (latestAudit?.connectorIssuesJson as any[]) || [];
  const suggestedSteps = (latestAudit?.suggestedStepsJson as any[]) || [];
  const bestPractices = (latestAudit?.bestPracticesJson as any[]) || [];
  const findings = (latestAudit?.findingsJson as any[]) || [];
  const recommendations = (latestAudit?.recommendationsJson as any[]) || [];

  const criticalConnectors = connectorIssues.filter(i => i.severity === "critical" || i.severity === "high");
  const totalIssues = connectorIssues.length + findings.filter(f => f.type === "issue").length;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-process">
          <Plus className="h-4 w-4 mr-2" /> {t("newProcess")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Process Selector */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> {t("processes")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {processes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>{t("noProcesses")}</p>
                <Button variant="link" size="sm" onClick={() => setShowCreateDialog(true)}>
                  {t("createFirst")}
                </Button>
              </div>
            ) : (
              processes.map(proc => (
                <div
                  key={proc.id}
                  onClick={() => { setSelectedProcessId(proc.id); setActiveTab("overview"); }}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedProcessId === proc.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted border border-transparent"
                  }`}
                  data-testid={`process-item-${proc.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{proc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {proc.category?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditProcess(proc); }}>
                        <Pencil className="h-4 w-4 mr-2" /> {t("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(t("deleteProcess"))) deleteProcessMutation.mutate(proc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right: Audit Panel */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedProcessId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ClipboardCheck className="h-14 w-14 mb-4 opacity-30" />
                <p className="text-lg font-medium">{t("selectProcess")}</p>
                <p className="text-sm mt-1">{t("createNew")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Process Header + Run Audit */}
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold">{selectedProcess?.name}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedProcess?.description || t("noDescription")}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="capitalize">
                          {selectedProcess?.category?.replace(/_/g, " ")}
                        </Badge>
                        {selectedProcess?.estimatedDuration && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {selectedProcess.estimatedDuration}
                          </Badge>
                        )}
                        {((selectedProcess?.rolesInvolved as string[]) || []).map(r => (
                          <Badge key={r} variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" /> {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowScheduleDialog(true)}
                        data-testid="button-open-schedule"
                      >
                        <Calendar className="h-4 w-4 mr-1.5" />
                        {schedule?.isEnabled ? t("scheduled") : t("schedule")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => runAuditMutation.mutate(selectedProcessId)}
                        disabled={isRunning || runAuditMutation.isPending}
                        data-testid="button-run-audit"
                      >
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-1.5" />
                        )}
                        {isRunning ? t("auditing") : t("runAudit")}
                      </Button>
                    </div>
                  </div>

                  {/* Phase progress bar */}
                  {isRunning && latestAudit?.auditPhase && (
                    <div className="mt-4 pt-4 border-t">
                      <AuditPhaseIndicator phase={latestAudit.auditPhase} />
                    </div>
                  )}

                  {/* Failed state */}
                  {isFailed && latestAudit && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">{t("auditFailed")}</p>
                        <p className="text-sm text-red-700 mt-0.5">
                          {latestAudit.errorMessage || "An unexpected error occurred. Please try running the audit again."}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 border-red-300 text-red-700"
                          onClick={() => runAuditMutation.mutate(selectedProcessId)}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> {t("retry")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Schedule info */}
                  {schedule?.isEnabled && schedule.nextRunAt && (
                    <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("nextAudit")}: {new Date(schedule.nextRunAt).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              {isCompleted && latestAudit && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" /> {t("auditResults")}
                      </CardTitle>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {latestAudit.runDurationMs ? `${(latestAudit.runDurationMs / 1000).toFixed(1)}s` : "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${latestAudit.estimatedCost}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {new Date(latestAudit.completedAt!).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Score strip */}
                    <div className="grid grid-cols-5 gap-3 mb-5">
                      {[
                        { label: "Overall", val: latestAudit.overallScore },
                        { label: "Efficiency", val: latestAudit.efficiencyScore },
                        { label: "Reliability", val: latestAudit.reliabilityScore },
                        { label: "Customer XP", val: latestAudit.customerExperienceScore },
                        { label: "Communication", val: latestAudit.communicationScore },
                      ].map(({ label, val }) => (
                        <div key={label} className="text-center p-3 bg-muted rounded-lg">
                          <p className={`text-2xl font-bold ${scoreColor(val || 0)}`}>{val ?? "—"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Alert strip for critical issues */}
                    {criticalConnectors.length > 0 && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">
                          <strong>{criticalConnectors.length} critical connector issue{criticalConnectors.length > 1 ? "s" : ""}</strong> detected — this process cannot run end-to-end without fixing these.
                        </p>
                      </div>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="w-full">
                        <TabsTrigger value="overview" className="flex-1">{t("overview")}</TabsTrigger>
                        <TabsTrigger value="best-practices" className="flex-1">
                          {t("bestPractices")}
                          {bestPractices.filter(b => b.gap === "major").length > 0 && (
                            <Badge variant="destructive" className="ml-1.5 text-xs h-4 px-1">
                              {bestPractices.filter(b => b.gap === "major").length}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="suggestions" className="flex-1">
                          {t("suggestions")}
                          {suggestedSteps.length > 0 && (
                            <Badge className="ml-1.5 text-xs h-4 px-1 bg-blue-500">
                              {suggestedSteps.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="connectors" className="flex-1">
                          {t("connectors")}
                          {connectorIssues.length > 0 && (
                            <Badge variant="destructive" className="ml-1.5 text-xs h-4 px-1">
                              {connectorIssues.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="recommendations" className="flex-1">{t("actions")}</TabsTrigger>
                      </TabsList>

                      {/* Overview */}
                      <TabsContent value="overview" className="mt-4 space-y-4">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="p-3 border rounded-lg">
                            <p className="text-xs text-muted-foreground">{t("issuesFound")}</p>
                            <p className="text-2xl font-bold mt-1 text-foreground">{totalIssues}</p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <p className="text-xs text-muted-foreground">{t("stepsToAdd")}</p>
                            <p className="text-2xl font-bold mt-1 text-foreground">{suggestedSteps.length}</p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <p className="text-xs text-muted-foreground">{t("estImprovement")}</p>
                            <p className="text-sm font-semibold mt-1">{latestAudit.estimatedImprovementTime || "N/A"}</p>
                          </div>
                        </div>
                        {findings.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">{t("findings")}</p>
                            {findings.map((f: any, idx: number) => (
                              <div key={idx} className="flex gap-2 p-3 border rounded-lg">
                                {f.type === "strength"
                                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                  : f.severity === "high"
                                  ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                  : <Info className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{f.title}</p>
                                    <Badge variant="outline" className="text-xs capitalize">{f.type}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-0.5">{f.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* Best Practices */}
                      <TabsContent value="best-practices" className="mt-4">
                        {bestPractices.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No best practices data available.</p>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Based on industry standards for landscaping businesses, here's how your process compares:
                            </p>
                            {bestPractices.map((bp: any, idx: number) => (
                              <div key={idx} className="p-4 border rounded-lg space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm">{bp.aspect}</p>
                                  <Badge className={`text-xs ${gapBadge(bp.gap)}`}>
                                    {bp.gap === "none" ? "✓ On track" : bp.gap === "minor" ? "Minor gap" : "Major gap"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">Best practice: </span>
                                  {bp.description}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">Your process: </span>
                                  {bp.currentStatus}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* Suggested Steps */}
                      <TabsContent value="suggestions" className="mt-4">
                        {suggestedSteps.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>No missing steps found — your process looks complete!</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              The AI identified {suggestedSteps.length} steps your process is missing. Click "Add to Process" to insert any of these directly.
                            </p>
                            {suggestedSteps.map((step: any, idx: number) => (
                              <div key={idx} className="p-4 border rounded-lg space-y-2" data-testid={`suggested-step-${idx}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{step.name}</p>
                                      <Badge className={`text-xs ${priorityBadge(step.priority)}`}>
                                        {step.priority}
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs">{step.role}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <span className="font-medium">When: </span>{step.timing}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">Why: </span>{step.reason}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={addStepMutation.isPending && addingStepIdx === idx}
                                    onClick={() => {
                                      setAddingStepIdx(idx);
                                      addStepMutation.mutate({
                                        processId: selectedProcessId,
                                        step: { name: step.name, role: step.role, description: step.description },
                                      });
                                    }}
                                    data-testid={`button-add-step-${idx}`}
                                  >
                                    {addStepMutation.isPending && addingStepIdx === idx ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Plus className="h-3.5 w-3.5 mr-1" />
                                    )}
                                    Add
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* Connector Health */}
                      <TabsContent value="connectors" className="mt-4">
                        {connectorIssues.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-70" />
                            <p className="font-medium text-foreground">All connectors look healthy</p>
                            <p className="text-sm mt-1">Roles, notifications, and handoffs are properly configured.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              These are wiring issues that would prevent this process from running end-to-end correctly.
                            </p>
                            {connectorIssues.map((issue: any, idx: number) => (
                              <div key={idx} className={`p-4 border rounded-lg space-y-2 ${severityColor(issue.severity)}`} data-testid={`connector-issue-${idx}`}>
                                <div className="flex items-start gap-2">
                                  {severityIcon(issue.severity)}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{issue.title}</p>
                                      <Badge variant="outline" className="text-xs capitalize border-current">
                                        {issue.severity}
                                      </Badge>
                                    </div>
                                    <p className="text-sm mt-1">{issue.description}</p>
                                    {issue.suggestedFix && (
                                      <p className="text-sm mt-1.5 font-medium">
                                        {t("fix")}: <span className="font-normal">{issue.suggestedFix}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* Recommendations */}
                      <TabsContent value="recommendations" className="mt-4">
                        {recommendations.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">{t("noRecommendations")}</p>
                        ) : (
                          <div className="space-y-3">
                            {recommendations.map((rec: any, idx: number) => (
                              <div key={idx} className="p-4 border rounded-lg" data-testid={`recommendation-${idx}`}>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <p className="font-medium text-sm">{rec.title}</p>
                                  <Badge className={`text-xs shrink-0 ${priorityBadge(rec.priority)}`}>
                                    {rec.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{rec.description}</p>
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {t("effort")}: {rec.estimatedEffort}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Zap className="h-3 w-3" /> {t("impact")}: {rec.expectedImpact}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {/* No audit yet */}
              {!latestAudit && !isRunning && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                    <Play className="h-12 w-12 mb-4 opacity-30" />
                    <p className="font-medium">{t("selectProcess")}</p>
                    <p className="text-sm mt-1">{t("createNew")}</p>
                  </CardContent>
                </Card>
              )}

              {/* Audit History */}
              {auditResults.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("auditResults")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {auditResults.slice(0, 6).map(audit => (
                      <div key={audit.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={
                            audit.status === "completed" ? "default" :
                            audit.status === "running" ? "secondary" : "destructive"
                          }>
                            {audit.status === "running" ? (
                              <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Running</span>
                            ) : audit.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(audit.createdAt!).toLocaleString()}
                          </span>
                          {audit.status === "failed" && audit.errorMessage && (
                            <span className="text-xs text-red-600 truncate max-w-48">{audit.errorMessage}</span>
                          )}
                        </div>
                        {audit.overallScore != null && (
                          <span className={`font-bold text-sm ${scoreColor(audit.overallScore)}`}>
                            {audit.overallScore}/100
                          </span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <ProcessFormDialog
        open={showCreateDialog || !!editProcess}
        onClose={() => { setShowCreateDialog(false); setEditProcess(null); }}
        existing={editProcess}
      />

      {selectedProcessId && (
        <ScheduleDialog
          open={showScheduleDialog}
          onClose={() => setShowScheduleDialog(false)}
          processId={selectedProcessId}
          existingSchedule={schedule}
        />
      )}
    </div>
  );
}
