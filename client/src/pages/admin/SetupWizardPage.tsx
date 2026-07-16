import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Image,
  Globe,
  Users,
  Package,
  Plug,
  MapPin,
  Shield,
  Bell,
  CheckCircle2,
  Circle,
  SkipForward,
  ExternalLink,
  RotateCcw,
  ArrowLeft,
  Rocket,
  ChevronRight,
} from "lucide-react";

type StepStatus = "not_started" | "complete" | "skipped";

interface WizardProgress {
  business_info: StepStatus;
  branding: StepStatus;
  regional: StepStatus;
  employees: StepStatus;
  catalog: StepStatus;
  integrations: StepStatus;
  routes: StepStatus;
  permissions: StepStatus;
  notifications: StepStatus;
  dismissed_at: string | null;
}

interface WizardStep {
  id: keyof Omit<WizardProgress, "dismissed_at">;
  label: string;
  description: string;
  detail: string;
  destination: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const STEPS: WizardStep[] = [
  {
    id: "business_info",
    label: "Business Information",
    description: "Company name, address, phone, email, and tax/EIN details",
    detail: "Fill in your company's legal name, mailing address, phone number, email, and EIN/tax ID. This information appears on estimates, invoices, and documents sent to customers.",
    destination: "/admin?tab=company",
    icon: Building2,
    group: "Company",
  },
  {
    id: "branding",
    label: "Logo & Branding",
    description: "Upload your company logo and customize sidebar appearance",
    detail: "Upload your logo, choose its shape (square, rounded, or circle), and set the corner radius. Your logo appears in the sidebar and on printed documents.",
    destination: "/admin?tab=company",
    icon: Image,
    group: "Company",
  },
  {
    id: "regional",
    label: "Regional & Seasonal Settings",
    description: "Timezone, fiscal year start, and seasonal service windows",
    detail: "Set your timezone, fiscal year start month, and which seasons your business operates in. These settings control scheduling defaults, report periods, and seasonal automation triggers.",
    destination: "/admin/regional-settings",
    icon: Globe,
    group: "Company",
  },
  {
    id: "employees",
    label: "Employees",
    description: "Add your team members or bulk-import via CSV",
    detail: "Add employees one by one from the Employees page, or use the Import CSV button to bring in your whole team at once. New hires automatically get onboarding checklists.",
    destination: "/employees",
    icon: Users,
    group: "People",
  },
  {
    id: "catalog",
    label: "Services & Materials Catalog",
    description: "Set up labor, materials, equipment, and subcontractor line items",
    detail: "Build your item catalog for use on estimates and jobs. You can add items individually from the Catalog page, or import a spreadsheet to load your full price list at once.",
    destination: "/catalog",
    icon: Package,
    group: "Operations",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect QuickBooks Online, CompanyCam, Google Calendar, and more",
    detail: "Link your existing tools. QuickBooks syncs invoices and payments. CompanyCam syncs job photos. Google Calendar syncs events. Use the Integration Wizard to connect each service.",
    destination: "/tools/integration-wizard",
    icon: Plug,
    group: "Operations",
  },
  {
    id: "routes",
    label: "Routes & Stops",
    description: "Import your snow plowing or maintenance route stops",
    detail: "If you run maintenance or snow removal routes, import your stops here. Upload a CSV with your customer addresses and stop details to pre-load your route list.",
    destination: "/maintenance-routes/import",
    icon: MapPin,
    group: "Operations",
  },
  {
    id: "permissions",
    label: "Permissions & Roles",
    description: "Review user roles and access levels for your team",
    detail: "Check that each team member has the right role: Admin, Manager, Crew, or Customer. Roles control what each person can see and do in Company HQ.",
    destination: "/admin?tab=users",
    icon: Shield,
    group: "People",
  },
  {
    id: "notifications",
    label: "Notification Defaults",
    description: "Configure default notification preferences and alert channels",
    detail: "Decide which events trigger in-app alerts, emails, or SMS for each role. The Notification Center lets you enable or disable specific notification types system-wide.",
    destination: "/admin/notification-center",
    icon: Bell,
    group: "Company",
  },
];

const STEP_IDS = STEPS.map((s) => s.id);

function statusIcon(status: StepStatus) {
  if (status === "complete") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "skipped") return <SkipForward className="h-5 w-5 text-amber-500" />;
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}

function statusBadge(status: StepStatus) {
  if (status === "complete")
    return <Badge variant="outline" className="border-green-600/40 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Complete</Badge>;
  if (status === "skipped")
    return <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">Skipped</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Not started</Badge>;
}

export default function SetupWizardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const { data: progress, isLoading } = useQuery<WizardProgress>({
    queryKey: ["/api/setup-wizard/progress"],
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<WizardProgress>) =>
      apiRequest("PATCH", "/api/setup-wizard/progress", updates).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/setup-wizard/progress"] });
    },
    onError: () => {
      toast({ title: "Error saving progress", variant: "destructive" });
    },
  });

  const markStep = (id: keyof Omit<WizardProgress, "dismissed_at">, status: StepStatus) => {
    updateMutation.mutate({ [id]: status } as any);
    if (status !== "not_started") toast({
      title: status === "complete" ? "✓ Marked as complete" : "Skipped",
      description: STEPS.find((s) => s.id === id)?.label,
    });
  };

  const completedCount = progress
    ? STEP_IDS.filter((id) => progress[id as keyof WizardProgress] === "complete").length
    : 0;
  const skippedCount = progress
    ? STEP_IDS.filter((id) => progress[id as keyof WizardProgress] === "skipped").length
    : 0;
  const totalDone = completedCount + skippedCount;
  const pct = Math.round((completedCount / STEPS.length) * 100);
  const allDone = totalDone === STEPS.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const groups = Array.from(new Set(STEPS.map((s) => s.group)));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Back link */}
      <button
        onClick={() => navigate("/admin")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="setup-wizard-back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin
      </button>

      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3 shrink-0">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">Company Setup Wizard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete these one-time setup steps to get Company HQ fully configured for your business.
              Each step links to the existing page — return here to mark your progress.
            </p>

            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {completedCount} of {STEPS.length} steps complete
                  {skippedCount > 0 && ` · ${skippedCount} skipped`}
                </span>
                <span className="font-semibold text-foreground">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" data-testid="setup-wizard-progress-bar" />
            </div>

            {allDone && (
              <div className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Setup complete! You can revisit any step below at any time.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Steps by group */}
      {groups.map((group) => {
        const groupSteps = STEPS.filter((s) => s.group === group);
        return (
          <div key={group} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">
              {group}
            </h2>
            <div className="rounded-xl border divide-y overflow-hidden">
              {groupSteps.map((step, i) => {
                const status: StepStatus = (progress?.[step.id] as StepStatus) ?? "not_started";
                const isExpanded = expandedStep === step.id;
                const globalIdx = STEPS.findIndex((s) => s.id === step.id) + 1;

                return (
                  <div
                    key={step.id}
                    className={`bg-card transition-colors ${isExpanded ? "bg-muted/30" : "hover:bg-muted/20"}`}
                    data-testid={`setup-step-${step.id}`}
                  >
                    {/* Row header — always visible */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                      onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                      data-testid={`setup-step-toggle-${step.id}`}
                    >
                      <span className="text-xs font-mono text-muted-foreground/60 w-5 shrink-0 text-right">
                        {globalIdx}
                      </span>
                      <div className="shrink-0">{statusIcon(status)}</div>
                      <step.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground leading-snug">
                          {step.label}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                          {step.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(status)}
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground/40 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t bg-muted/10">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          {step.detail}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => navigate(step.destination)}
                            data-testid={`setup-step-go-${step.id}`}
                            className="gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Go to page
                          </Button>

                          {status !== "complete" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markStep(step.id, "complete")}
                              disabled={updateMutation.isPending}
                              data-testid={`setup-step-complete-${step.id}`}
                              className="gap-1.5 border-green-600/30 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark complete
                            </Button>
                          )}

                          {status !== "skipped" && status !== "complete" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markStep(step.id, "skipped")}
                              disabled={updateMutation.isPending}
                              data-testid={`setup-step-skip-${step.id}`}
                              className="gap-1.5 text-muted-foreground"
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                              Skip for now
                            </Button>
                          )}

                          {status !== "not_started" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markStep(step.id, "not_started")}
                              disabled={updateMutation.isPending}
                              data-testid={`setup-step-reset-${step.id}`}
                              className="gap-1.5 text-muted-foreground/60 ml-auto"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        Progress is saved automatically. You can leave and come back at any time — this page is always accessible from the Admin Panel.
      </p>
    </div>
  );
}
