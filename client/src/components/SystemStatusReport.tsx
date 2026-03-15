import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity, BarChart3, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, RefreshCw, Clock, Database,
  Users, Briefcase, Truck, BookOpen, GraduationCap, Wrench,
  FileText, Calendar, MessageSquare, ListTodo, ClipboardList,
  Megaphone, Lightbulb, Map, Shield, Bot, Globe, Link2,
  Layers, ArrowRightLeft
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type ModuleStatus = "operational" | "partial" | "needs-work" | "demo-only";

interface ModuleInfo {
  id: string;
  name: string;
  icon: typeof Activity;
  status: ModuleStatus;
  description: string;
  countKeys?: string[];
  countLabels?: string[];
  capabilities: string[];
  issues?: string[];
  connections?: string[];
  section: "core" | "work" | "people" | "company" | "tools" | "system";
}

const MODULES: ModuleInfo[] = [
  {
    id: "dashboard", name: "Dashboard", icon: BarChart3, status: "operational",
    section: "core",
    description: "Main workspace overview with stats, quick links, and activity summary.",
    capabilities: ["Activity overview", "Quick navigation", "Role-based content"],
  },
  {
    id: "jobs", name: "Work Pipeline", icon: Briefcase, status: "operational",
    section: "work",
    description: "Sold Jobs kanban board and Estimates pipeline with full lifecycle tracking.",
    countKeys: ["jobs", "estimates"],
    countLabels: ["Jobs", "Estimates"],
    capabilities: ["Drag-and-drop kanban", "Custom category tabs", "Job documents", "Estimate → Job conversion", "Stage change tracking"],
    connections: ["Activity Log", "Calendar", "Documents"],
  },
  {
    id: "todos", name: "Tasks", icon: ListTodo, status: "operational",
    section: "work",
    description: "Task management with assignees, due dates, reminders, and calendar sync.",
    countKeys: ["todos"],
    countLabels: ["Tasks"],
    capabilities: ["Create/edit tasks", "Due date reminders", "Calendar sync", "Team assignment", "Linked records"],
    connections: ["Calendar (auto-creates events)", "Reminder Scheduler"],
  },
  {
    id: "equipment", name: "Equipment / Fleet", icon: Truck, status: "operational",
    section: "work",
    description: "Fleet management with health dashboard, maintenance tracking, and VIN decode.",
    countKeys: ["equipment", "maintenanceSchedules", "repairRequests"],
    countLabels: ["Assets", "Maint. Schedules", "Repair Requests"],
    capabilities: ["Health priority engine (P1-P4)", "Maintenance schedules", "Service history", "Repair requests", "VIN decode (NHTSA)", "OEM template library", "Document management"],
    connections: ["NHTSA API (VIN)", "OEM Templates"],
  },
  {
    id: "employees", name: "Employees", icon: Users, status: "operational",
    section: "people",
    description: "Employee profiles with pay history, documents, notes, and onboarding.",
    countKeys: ["employees"],
    countLabels: ["Employees"],
    capabilities: ["Employee profiles", "Pay history", "Document storage", "Notes", "Onboarding checklists"],
    connections: ["Onboarding Forms", "Documents"],
  },
  {
    id: "hiring", name: "Hiring", icon: ClipboardList, status: "operational",
    section: "people",
    description: "Recruitment pipeline with kanban board, applicant tracking, and communications.",
    countKeys: ["candidates"],
    countLabels: ["Candidates"],
    capabilities: ["7-column kanban pipeline", "Drag-and-drop stages", "Applicant detail panels", "Notes and communications", "Applicant Portal"],
    connections: ["Employee records", "Email (Resend)"],
  },
  {
    id: "customer-hub", name: "Customer Hub", icon: Globe, status: "operational",
    section: "people",
    description: "Customer-facing portal with branded dashboard, jobs, documents, care library, and messaging.",
    countKeys: ["customerMessages", "customerSuggestions"],
    countLabels: ["Messages", "Suggestions"],
    capabilities: ["Branded dashboard", "Job details view", "Document access", "Care library with bookmarks", "Messaging", "Suggestion submission"],
    connections: ["Care Guides", "Documents", "Suggestions (Admin review)"],
  },
  {
    id: "messages", name: "Messages / Inbox", icon: MessageSquare, status: "operational",
    section: "company",
    description: "Internal messaging system for staff communication and customer inquiries.",
    capabilities: ["View messages", "Reply to customers", "Status tracking"],
  },
  {
    id: "forms", name: "Forms", icon: FileText, status: "operational",
    section: "company",
    description: "Dynamic form builder with folders, templates, and submission management.",
    countKeys: ["forms"],
    countLabels: ["Forms"],
    capabilities: ["Custom form builder", "Form folders", "Templates", "Submission viewing", "Multi-page forms"],
  },
  {
    id: "sops", name: "SOP Library", icon: BookOpen, status: "operational",
    section: "company",
    description: "Standard Operating Procedures with AI-powered creation and quiz generation.",
    countKeys: ["sops", "sopQuizzes"],
    countLabels: ["SOPs", "Quizzes"],
    capabilities: ["SOP builder", "AI generation", "Version history", "Categories", "Auto quiz generation"],
    connections: ["Quizzes / Testing", "AI (OpenAI)"],
  },
  {
    id: "testing", name: "Quizzes / Testing", icon: GraduationCap, status: "operational",
    section: "company",
    description: "Adaptive quiz system with 5 difficulty levels and employee mastery tracking.",
    countKeys: ["quizAttempts"],
    countLabels: ["Quiz Attempts"],
    capabilities: ["Adaptive difficulty", "Real-time progression", "Manager oversight", "Safety-critical alerts"],
    connections: ["SOPs (generates from content)"],
  },
  {
    id: "calendar", name: "Calendar", icon: Calendar, status: "operational",
    section: "core",
    description: "Full calendar with month/week/day views, Google sync, and custom categories.",
    countKeys: ["calendarEvents"],
    countLabels: ["Events"],
    capabilities: ["Month/week/day/list views", "Event CRUD", "Google Calendar OAuth sync", "Custom categories with colors", "Team assignment", "Contact fields"],
    connections: ["Google Calendar API", "Tasks (auto-sync)", "Jobs"],
  },
  {
    id: "education", name: "Resource Library", icon: Layers, status: "operational",
    section: "people",
    description: "Educational content and care guides for customers. Admin-managed, customer-visible.",
    countKeys: ["careGuides"],
    countLabels: ["Care Guides"],
    capabilities: ["Process overview", "Care guides", "Instructions", "Documents", "Bookmarking"],
    connections: ["Customer Hub (Resources link)", "Care Guide Manager"],
  },
  {
    id: "documents", name: "Documents", icon: FileText, status: "operational",
    section: "system",
    description: "Cross-module document sharing with secure token-based links.",
    countKeys: ["documents"],
    countLabels: ["Documents"],
    capabilities: ["Cross-module sharing", "Secure share links", "Password protection", "Access logging", "Attach from library"],
    connections: ["All modules (Jobs, Equipment, Employees, etc.)"],
  },
  {
    id: "ai-assistant", name: "AI Assistant", icon: Bot, status: "operational",
    section: "core",
    description: "OpenAI-powered chat with voice input/output and tool integration.",
    capabilities: ["Streaming chat", "Per-user history", "Tool library", "Voice input (Speech-to-Text)", "Text-to-Speech (6 voices)", "Animated waveforms"],
    connections: ["OpenAI API", "System tools"],
  },
  {
    id: "marketing", name: "Marketing", icon: Megaphone, status: "demo-only",
    section: "company",
    description: "Campaign dashboard with charts and performance metrics.",
    countKeys: ["campaigns"],
    countLabels: ["Campaigns"],
    capabilities: ["Campaign cards", "Performance charts", "Spend vs leads"],
    issues: ["Uses hardcoded demo data — not connected to database", "No create/edit/delete for campaigns", "Needs real CRUD operations"],
  },
  {
    id: "admin", name: "Admin Panel", icon: Shield, status: "operational",
    section: "system",
    description: "Central administration with user management, branding, AI agents, and diagnostics.",
    capabilities: ["User management", "Role assignment", "Company branding", "Sidebar ordering", "AI agent management", "Suggestion review", "System diagnostics (Master Admin)"],
  },
  {
    id: "settings", name: "Settings", icon: Wrench, status: "operational",
    section: "system",
    description: "User preferences including profile, notifications, language, and appearance.",
    capabilities: ["Profile editing", "Notification preferences", "Language (EN/ES)", "Theme picker"],
  },
  {
    id: "plow-mapper", name: "Plow Site Mapper", icon: Map, status: "operational",
    section: "tools",
    description: "Google Maps-powered site mapping with drawing tools and crew instructions.",
    countKeys: ["plowSites"],
    countLabels: ["Sites"],
    capabilities: ["Satellite mapping", "Site grouping", "Photo markup with annotations", "Crew instructions"],
    connections: ["Google Maps API"],
  },
  {
    id: "process-auditor", name: "Process Auditor", icon: Activity, status: "operational",
    section: "tools",
    description: "AI-powered business process auditing with scoring and recommendations.",
    capabilities: ["Process selection", "AI audit analysis", "Scoring (efficiency, reliability, CX, communication)", "Audit history"],
    connections: ["AI (OpenAI)"],
  },
  {
    id: "calculator", name: "Calculator", icon: BarChart3, status: "operational",
    section: "tools",
    description: "Material, chemical, and system sizing calculators with unit conversions.",
    capabilities: ["Mulch/soil/gravel calculator", "Chemical application rates", "Lighting/irrigation sizing", "Unit conversions", "Product library"],
  },
  {
    id: "lead-qualifier", name: "Lead Qualifier", icon: Lightbulb, status: "operational",
    section: "tools",
    description: "Prospect scoring questionnaire for qualifying leads.",
    capabilities: ["Multi-step questionnaire", "Budget/authority/urgency scoring", "Hot/Warm/Cold classification"],
  },
  {
    id: "i18n", name: "Internationalization", icon: Globe, status: "operational",
    section: "system",
    description: "Full English/Spanish language support across the entire application.",
    capabilities: ["EN/ES toggle", "Per-user language preference", "400+ translation keys", "Email translations"],
  },
  {
    id: "notifications", name: "Updates & Notifications", icon: Activity, status: "operational",
    section: "system",
    description: "Bell icon notification system with activity feed and role-based app updates.",
    countKeys: ["appUpdates", "activityLog"],
    countLabels: ["App Updates", "Activity Entries"],
    capabilities: ["Activity feed with seen tracking", "Role-based app updates", "Admin inline posting", "Mark all seen/read"],
    connections: ["Activity Logger", "All modules (event tracking)"],
  },
];

const CONNECTIONS_MAP = [
  { from: "Calendar", to: "Tasks", desc: "Due dates auto-create calendar events" },
  { from: "Calendar", to: "Google Calendar", desc: "OAuth sync pushes/pulls events" },
  { from: "Jobs", to: "Estimates", desc: "Won estimates convert to Sold Jobs" },
  { from: "Jobs", to: "Activity Log", desc: "Stage changes logged to feed" },
  { from: "SOPs", to: "Quizzes", desc: "AI generates quizzes from SOPs" },
  { from: "Equipment", to: "OEM Templates", desc: "Auto-assign during creation" },
  { from: "Equipment", to: "NHTSA API", desc: "VIN decode fills vehicle details" },
  { from: "Documents", to: "All Modules", desc: "Cross-module sharing via links" },
  { from: "AI Assistant", to: "OpenAI", desc: "Chat, quiz gen, process auditing" },
  { from: "Plow Mapper", to: "Google Maps", desc: "Satellite imagery for mapping" },
  { from: "Email", to: "Resend", desc: "Reminders, notifications, updates" },
  { from: "Users", to: "i18n", desc: "Language preference per user" },
];

const SECTION_LABELS: Record<string, string> = {
  core: "Core Systems",
  work: "Work Management",
  people: "People & Customers",
  company: "Company Operations",
  tools: "Tools & Utilities",
  system: "Platform & Settings",
};

const SECTION_ORDER = ["core", "work", "people", "company", "tools", "system"];

function StatusBadge({ status }: { status: ModuleStatus }) {
  const config = {
    "operational": { label: "Operational", variant: "default" as const, className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
    "partial": { label: "Partial", variant: "secondary" as const, className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
    "needs-work": { label: "Needs Work", variant: "destructive" as const, className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
    "demo-only": { label: "Demo Only", variant: "outline" as const, className: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600" },
  };
  const c = config[status];
  return <Badge variant={c.variant} className={`text-xs font-semibold px-2 py-0.5 ${c.className}`}>{c.label}</Badge>;
}

function StatusIcon({ status }: { status: ModuleStatus }) {
  if (status === "operational") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "needs-work") return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-slate-400" />;
}

function ModuleRow({ mod, counts }: { mod: ModuleInfo; counts: Record<string, number> }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = mod.icon;

  return (
    <div className="border rounded-lg overflow-hidden transition-all" data-testid={`module-${mod.id}`}>
      <button
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`module-toggle-${mod.id}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon status={mod.status} />
          <div className="p-1.5 rounded-md bg-muted/60">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-medium text-sm truncate">{mod.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {mod.countKeys && mod.countKeys.map((key, i) => {
            const val = counts[key] ?? 0;
            return val > 0 ? (
              <span key={key} className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {val} {mod.countLabels?.[i]}
              </span>
            ) : null;
          })}
          <StatusBadge status={mod.status} />
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t bg-muted/10 space-y-3">
          <p className="text-sm text-muted-foreground">{mod.description}</p>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Capabilities</p>
            <div className="flex flex-wrap gap-1.5">
              {mod.capabilities.map(c => (
                <span key={c} className="text-xs bg-primary/5 text-primary border border-primary/10 rounded-full px-2 py-0.5">{c}</span>
              ))}
            </div>
          </div>

          {mod.connections && mod.connections.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Connected To</p>
              <div className="flex flex-wrap gap-1.5">
                {mod.connections.map(c => (
                  <span key={c} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mod.issues && mod.issues.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-1.5">Issues</p>
              <ul className="space-y-1">
                {mod.issues.map(issue => (
                  <li key={issue} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SystemStatusReport() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    counts: Record<string, number>;
    roleCounts: Record<string, number>;
    generatedAt: string;
  }>({
    queryKey: ["/api/admin/system-status"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/system-status")).json(),
    enabled: open,
  });

  const counts = data?.counts || {};
  const roleCounts = data?.roleCounts || {};

  const operationalCount = MODULES.filter(m => m.status === "operational").length;
  const partialCount = MODULES.filter(m => m.status === "partial").length;
  const needsWorkCount = MODULES.filter(m => m.status === "needs-work").length;
  const demoCount = MODULES.filter(m => m.status === "demo-only").length;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2"
        variant="outline"
        data-testid="button-system-status"
      >
        <Activity className="h-4 w-4" />
        System Status Report
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
          <DialogTitle className="sr-only">System Status Report</DialogTitle>
          <div className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-report-title">
                  <Database className="h-5 w-5 text-primary" />
                  System Status Report
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  CompanyHQ Platform — Live System Overview
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="gap-1.5 text-xs"
                data-testid="button-refresh-status"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-medium">{operationalCount} Operational</span>
              </div>
              {partialCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium">{partialCount} Partial</span>
                </div>
              )}
              {needsWorkCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-medium">{needsWorkCount} Needs Work</span>
                </div>
              )}
              {demoCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium">{demoCount} Demo Only</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}
              </span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-6">
              {Object.keys(roleCounts).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(roleCounts).sort(([,a],[,b]) => b - a).map(([role, count]) => (
                    <div key={role} className="bg-muted/30 rounded-lg p-3 text-center border">
                      <div className="text-2xl font-bold text-primary">{count}</div>
                      <div className="text-xs text-muted-foreground font-medium mt-0.5">{role} Users</div>
                    </div>
                  ))}
                </div>
              )}

              {SECTION_ORDER.map(section => {
                const sectionModules = MODULES.filter(m => m.section === section);
                if (sectionModules.length === 0) return null;
                return (
                  <div key={section}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      {SECTION_LABELS[section]}
                      <div className="h-px flex-1 bg-border" />
                    </h3>
                    <div className="space-y-2">
                      {sectionModules.map(mod => (
                        <ModuleRow key={mod.id} mod={mod} counts={counts} />
                      ))}
                    </div>
                  </div>
                );
              })}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  System Connections
                  <div className="h-px flex-1 bg-border" />
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CONNECTIONS_MAP.map((conn, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/10 text-sm">
                      <span className="font-medium text-xs whitespace-nowrap">{conn.from}</span>
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium text-xs whitespace-nowrap">{conn.to}</span>
                      <span className="text-xs text-muted-foreground ml-auto hidden sm:block">{conn.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground pt-2 pb-4 border-t">
                CompanyHQ v1.0 — {MODULES.length} modules tracked — Report generated live from system data
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
