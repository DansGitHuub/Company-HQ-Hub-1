import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  Circle,
  Mail,
  CheckSquare,
  Calendar,
  Truck,
  Megaphone,
  Users,
  BookOpen,
  Lightbulb,
  Wrench,
  Building2,
  HelpCircle,
  ArrowRight,
  AlertTriangle,
  Clock,
  Brain,
  Hammer,
  Loader2,
  Calculator,
  MapPin,
  Zap,
  FileText,
  Sparkles,
  GraduationCap,
  Maximize2,
  ExternalLink,
  Play,
  Bell,
  Eye,
  Pause,
  CheckCircle2,
  User,
  ListChecks,
  StickyNote,
  Pin,
  PinOff,
  Archive,
  Trash2,
  Plus,
  Search,
  Tag,
  ChevronLeft,
  Save,
  AlarmClock,
  Palette,
  ClipboardList,
  X,
} from "lucide-react";
import type { WidgetSize } from "./widgetRegistry";

interface WidgetProps {
  size: WidgetSize;
}

function WidgetShell({ children, loading, href, emptyText }: { children: React.ReactNode; loading?: boolean; href?: string; emptyText?: string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">{children}</div>
      {href && (
        <Link href={href}>
          <div className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer mt-2 pt-2 border-t" data-testid="widget-view-all">
            View all <ArrowRight className="h-3 w-3" />
          </div>
        </Link>
      )}
    </div>
  );
}

export function MessagesWidget({ size }: WidgetProps) {
  // Use the same endpoint as the /messages page — /api/dm/conversations?folder=inbox
  const { data: threads = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dm/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/dm/conversations?folder=inbox", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 0,
  });

  const unreadCount = threads.filter((t: any) => t.unread_count > 0).length;
  const recentThreads = threads.slice(0, size === "small" ? 3 : size === "medium" ? 5 : 8);

  return (
    <WidgetShell loading={isLoading} href="/messages">
      {unreadCount > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="destructive" className="text-xs">{unreadCount} unread</Badge>
        </div>
      )}
      {recentThreads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet</p>
      ) : (
        <div className="space-y-2">
          {recentThreads.map((thread: any) => (
            <div key={thread.other_user_id} className="flex items-start gap-2 text-sm">
              <Mail className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${thread.unread_count > 0 ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className={`truncate text-xs font-medium ${thread.unread_count > 0 ? "font-semibold" : ""}`}>
                  {thread.other_user_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">{thread.last_message || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  p1_urgent: "bg-red-500",
  p2_high: "bg-orange-500",
  p3_normal: "bg-yellow-500",
  p4_low: "bg-green-500",
};

const PRIORITY_LABELS: Record<string, string> = {
  p1_urgent: "Urgent",
  p2_high: "High",
  p3_normal: "Normal",
  p4_low: "Low",
};

const KANBAN_COLUMNS = [
  { id: "todo",         label: "To Do",        icon: Circle,       color: "border-slate-400",  bg: "bg-slate-50 dark:bg-slate-800/30" },
  { id: "assigned",    label: "Assigned",    icon: Bell,         color: "border-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30" },
  { id: "acknowledged",label: "Acknowledged",icon: Eye,          color: "border-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  { id: "in_progress", label: "In Progress", icon: Play,         color: "border-yellow-400",  bg: "bg-yellow-50 dark:bg-yellow-950/30" },
  { id: "on_hold",     label: "On Hold",     icon: Pause,        color: "border-gray-400",    bg: "bg-gray-50 dark:bg-gray-800/30" },
  { id: "completed",   label: "Completed",   icon: CheckCircle2, color: "border-green-400",   bg: "bg-green-50 dark:bg-green-950/30" },
];

function TaskCard({ task }: { task: any }) {
  const isOverdue = task.dueDate && task.status !== "completed" && task.status !== "cancelled"
    && new Date(task.dueDate) < new Date();

  return (
    <div
      className="bg-card border rounded-lg p-3 space-y-1.5 shadow-sm hover:shadow-md transition-shadow cursor-default"
      data-testid={`mirror-task-card-${task.id}`}
    >
      <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {task.priority && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${PRIORITY_COLORS[task.priority] || "bg-gray-400"}`}>
            {PRIORITY_LABELS[task.priority] || task.priority}
          </span>
        )}
        {task.dueDate && (
          <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            <Clock className="h-2.5 w-2.5" />
            {isOverdue ? "Overdue" : new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      {task.assigneeName && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <User className="h-2.5 w-2.5" />
          <span className="truncate">{task.assigneeName}</span>
        </div>
      )}
    </div>
  );
}

function TasksBoardPanel() {
  // /api/tasks/assigned returns only tasks assigned to the current user (server-side filtered).
  const { data: assignedTasks = [], isLoading: loadingAssigned } = useQuery<any[]>({ queryKey: ["/api/tasks/assigned"] });
  const { user } = useAuth();

  const allTasks = assignedTasks;

  const isLoading = loadingAssigned;

  const overdueTasks = allTasks.filter(t =>
    t.dueDate && !["completed", "cancelled"].includes(t.status) && new Date(t.dueDate) < new Date()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{allTasks.length} total tasks</span>
        {overdueTasks.length > 0 && (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertTriangle className="h-3 w-3" /> {overdueTasks.length} overdue
          </Badge>
        )}
        <div className="ml-auto">
          <Link href="/todos">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" data-testid="open-full-tasks-page">
              <ExternalLink className="h-3 w-3" /> Open Full Tasks Page
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full" style={{ minWidth: `${KANBAN_COLUMNS.length * 220}px` }}>
          {KANBAN_COLUMNS.map(col => {
            const colTasks = allTasks.filter(t => t.status === col.id);
            const Icon = col.icon;
            return (
              <div key={col.id} className={`flex flex-col rounded-xl border-t-2 ${col.color} ${col.bg} flex-1 min-w-[200px] overflow-hidden`}>
                <div className="px-3 pt-3 pb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] h-4 min-w-[18px] flex items-center justify-center px-1">
                    {colTasks.length}
                  </Badge>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2">
                  {colTasks.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-4 italic">No tasks</p>
                  ) : (
                    colTasks.map(task => <TaskCard key={task.id} task={task} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TodosWidget({ size }: WidgetProps) {
  const [boardOpen, setBoardOpen] = useState(false);
  const { user } = useAuth();

  // /api/tasks/assigned returns only tasks assigned to the current user (server-side filtered).
  const { data: myTasks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/tasks/assigned"] });

  const filteredMine = myTasks;
  const now = new Date();
  const active    = filteredMine.filter((t: any) => !["completed", "cancelled"].includes(t.status));
  const inProgress = filteredMine.filter((t: any) => t.status === "in_progress");
  const overdue    = filteredMine.filter((t: any) => t.dueDate && !["completed", "cancelled"].includes(t.status) && new Date(t.dueDate) < now);
  const dueToday   = filteredMine.filter((t: any) => {
    if (!t.dueDate || ["completed", "cancelled"].includes(t.status)) return false;
    const d = new Date(t.dueDate);
    return d.toDateString() === now.toDateString();
  });

  const previewTasks = active.slice(0, size === "small" ? 3 : size === "medium" ? 5 : 8);

  return (
    <>
      <div className="h-full flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">{active.length} active</span>
          {inProgress.length > 0 && (
            <Badge className="text-[10px] gap-0.5 px-1.5 h-4 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" variant="outline">
              <Play className="h-2.5 w-2.5" /> {inProgress.length} in progress
            </Badge>
          )}
          {overdue.length > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 h-4">
              <AlertTriangle className="h-2.5 w-2.5" /> {overdue.length} overdue
            </Badge>
          )}
          {dueToday.length > 0 && overdue.length === 0 && (
            <Badge className="text-[10px] gap-0.5 px-1.5 h-4 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" variant="outline">
              <Clock className="h-2.5 w-2.5" /> {dueToday.length} due today
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : previewTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground flex-1 flex items-center">All caught up!</p>
        ) : (
          <div className="flex-1 space-y-1 min-h-0 overflow-hidden">
            {previewTasks.map((task: any) => {
              const isTaskOverdue = task.dueDate && new Date(task.dueDate) < now;
              return (
                <div key={task.id} className="flex items-center gap-2 text-xs py-0.5">
                  {task.status === "in_progress"
                    ? <Play className="h-3 w-3 text-yellow-500 shrink-0" />
                    : <CheckSquare className={`h-3 w-3 shrink-0 ${isTaskOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                  }
                  <span className={`truncate flex-1 ${isTaskOverdue ? "text-destructive" : ""}`}>{task.title}</span>
                  {task.priority && (
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[task.priority] || "bg-gray-400"}`} title={PRIORITY_LABELS[task.priority]} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setBoardOpen(true)}
          className="flex items-center justify-center gap-1.5 w-full mt-1 pt-2 border-t text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          data-testid="open-tasks-board"
        >
          <Maximize2 className="h-3 w-3" /> Open Task Board
        </button>
      </div>

      <Dialog open={boardOpen} onOpenChange={setBoardOpen}>
        <DialogContent
          className="max-w-[97vw] w-[97vw] h-[93vh] max-h-[93vh] p-0 flex flex-col gap-0 overflow-hidden"
          data-testid="tasks-board-dialog"
        >
          <DialogHeader className="px-5 py-3 border-b shrink-0 flex-row items-center gap-3">
            <ListChecks className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-base font-semibold">Task Board</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <TasksBoardPanel />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PipelineWidget({ size }: WidgetProps) {
  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const stages = ["Lead", "Proposed", "Approved", "In Progress", "Completed"];
  const stageCounts = stages.map(stage => ({
    stage,
    count: jobs.filter((j: any) => j.stage === stage).length,
  }));
  const totalValue = jobs.reduce((sum: number, j: any) => sum + (j.value || 0), 0);

  return (
    <WidgetShell loading={isLoading} href="/jobs">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{jobs.length} jobs</span>
        {totalValue > 0 && (
          <span className="text-xs font-medium text-green-600">${totalValue.toLocaleString()}</span>
        )}
      </div>
      <div className="space-y-1.5">
        {stageCounts.filter(s => s.count > 0 || size !== "small").slice(0, size === "small" ? 4 : 5).map((s) => (
          <div key={s.stage} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{s.stage}</span>
            <Badge variant="secondary" className="text-xs px-1.5 min-w-[24px] justify-center">{s.count}</Badge>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function EstimatesWidget({ size }: WidgetProps) {
  const { data: estimates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/estimates"],
  });

  const statuses = ["draft", "sent", "viewed", "approved", "declined", "converted"];
  const statusLabels: Record<string, string> = {
    draft: "Draft", sent: "Sent", viewed: "Viewed",
    approved: "Approved", declined: "Declined", converted: "Converted",
  };
  const statusCounts = statuses.map(status => ({
    status,
    label: statusLabels[status] ?? status,
    count: estimates.filter((e: any) => e.status === status).length,
  }));

  return (
    <WidgetShell loading={isLoading} href="/estimates">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{estimates.length} estimates</span>
      </div>
      <div className="space-y-1.5">
        {statusCounts.filter(s => s.count > 0 || size !== "small").slice(0, size === "small" ? 4 : 6).map((s) => (
          <div key={s.status} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate">{s.label}</span>
            <Badge variant={s.status === "approved" ? "default" : "secondary"} className="text-xs px-1.5 min-w-[24px] justify-center">{s.count}</Badge>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

// Approach B: call the same /api/google-calendar/events endpoint the calendar
// drawer uses; filter + limit client-side.  Falls back to empty silently when
// Google Calendar is not connected (HTTP 401).
export function CalendarWidget({ size }: WidgetProps) {
  const limit = size === "small" ? 3 : size === "medium" ? 5 : 8;

  // Stable day-granularity key so the query doesn't re-fire on every render.
  const todayKey = useMemo(() => new Date().toDateString(), []);
  const startIso = useMemo(() => new Date().toISOString(), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const endIso = useMemo(
    () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    [todayKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { data: gcEvents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/google-calendar/events", todayKey],
    queryFn: async () => {
      const res = await fetch(
        `/api/google-calendar/events?start=${startIso}&end=${endIso}`,
        { credentials: "include" },
      );
      // 401 = not connected; return empty rather than throw
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Server already returns events ordered by start, but be defensive.
  const upcoming = gcEvents
    .filter((e: any) => e?.start)
    .sort((a: any, b: any) => new Date(a?.start ?? 0).getTime() - new Date(b?.start ?? 0).getTime())
    .slice(0, limit);

  return (
    <WidgetShell loading={isLoading} href="/calendar">
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((event: any) => {
            const start = new Date(event?.start ?? "");
            const valid = !isNaN(start.getTime());
            return (
              <div key={event?.id} className="flex items-start gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{event?.title ?? "Event"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {valid
                      ? `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "All day"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

export function EquipmentWidget({ size }: WidgetProps) {
  const { data: equipment = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fleet/assets"],
    queryFn: async () => {
      const res = await fetch("/api/fleet/assets", { credentials: "include" });
      return res.json();
    },
  });

  const totalCount = equipment.length;
  const needsMaint = equipment.filter((e: any) => e.status === "Needs Maintenance" || e.maintenanceStatus === "overdue").length;
  const outOfService = equipment.filter((e: any) => e.status === "Out of Service").length;

  return (
    <WidgetShell loading={isLoading} href="/equipment">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Assets</span>
          <span className="font-medium">{totalCount}</span>
        </div>
        {needsMaint > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> Needs Maintenance</span>
            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">{needsMaint}</Badge>
          </div>
        )}
        {outOfService > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-destructive"><Truck className="h-3 w-3" /> Out of Service</span>
            <Badge variant="destructive" className="text-xs">{outOfService}</Badge>
          </div>
        )}
        {needsMaint === 0 && outOfService === 0 && totalCount > 0 && (
          <p className="text-xs text-green-600 flex items-center gap-1">All equipment operational</p>
        )}
      </div>
    </WidgetShell>
  );
}

export function MarketingWidget({ size }: WidgetProps) {
  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
  });

  const active = campaigns.filter((c: any) => c.status === "Active");
  const totalSpend = campaigns.reduce((sum: number, c: any) => sum + (Number(c.spend) || 0), 0);
  const totalLeads = campaigns.reduce((sum: number, c: any) => sum + (c.leads || 0), 0);

  return (
    <WidgetShell loading={isLoading} href="/marketing">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Active</p>
            <p className="text-lg font-bold">{active.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Leads</p>
            <p className="text-lg font-bold">{totalLeads}</p>
          </div>
        </div>
        {totalSpend > 0 && (
          <div className="text-xs text-muted-foreground">
            Total spend: <span className="font-medium text-foreground">${totalSpend.toLocaleString()}</span>
          </div>
        )}
        {size !== "small" && active.slice(0, 3).map((c: any) => (
          <div key={c.id} className="flex items-center justify-between text-xs">
            <span className="truncate">{c.name}</span>
            <Badge variant="outline" className="text-[10px]">{c.platform}</Badge>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function EmployeesWidget({ size }: WidgetProps) {
  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const byRole: Record<string, number> = {};
  users.forEach((u: any) => {
    byRole[u.role] = (byRole[u.role] || 0) + 1;
  });

  return (
    <WidgetShell loading={isLoading} href="/employees">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground">{users.length} team members</span>
        </div>
        {Object.entries(byRole).map(([role, count]) => (
          <div key={role} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{role}</span>
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function SOPsWidget({ size }: WidgetProps) {
  const { data: sops = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sops"],
  });

  const recent = sops.slice(0, size === "small" ? 4 : 6);

  return (
    <WidgetShell loading={isLoading} href="/sops">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{sops.length} procedures</span>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No SOPs yet</p>
      ) : (
        <div className="space-y-1.5">
          {recent.map((sop: any) => (
            <div key={sop.id} className="flex items-start gap-2 text-xs">
              <BookOpen className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{sop.title}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function QuizzesWidget({ size }: WidgetProps) {
  const { data: sops = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sops"],
  });

  const withQuizzes = sops.filter((s: any) => s.hasQuiz);

  return (
    <WidgetShell loading={isLoading} href="/training">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{withQuizzes.length} quizzes available</span>
      </div>
      {withQuizzes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No quizzes yet</p>
      ) : (
        <div className="space-y-1.5">
          {withQuizzes.slice(0, size === "small" ? 4 : 6).map((sop: any) => (
            <div key={sop.id} className="flex items-start gap-2 text-xs">
              <Brain className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{sop.title}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function MaterialsWidget({ size }: WidgetProps) {
  const { data: materials = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/materials"],
  });

  const lowStock = materials.filter((m: any) => m.stockQuantity !== undefined && m.stockQuantity <= (m.reorderPoint || 5));

  return (
    <WidgetShell loading={isLoading} href="/materials">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{materials.length} items</span>
          {lowStock.length > 0 && (
            <Badge variant="destructive" className="text-xs">{lowStock.length} low stock</Badge>
          )}
        </div>
        {lowStock.length > 0 && size !== "small" && (
          <div className="space-y-1">
            {lowStock.slice(0, 3).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-amber-600">{m.name}</span>
                <span className="text-[10px] text-muted-foreground">Qty: {m.stockQuantity ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

export function SuggestionsWidget({ size }: WidgetProps) {
  const { data: suggestions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/suggestions"],
  });

  const pending = suggestions.filter((s: any) => s.status === "Received" || s.status === "Reviewing");

  return (
    <WidgetShell loading={isLoading} href="/admin">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{suggestions.length} total</span>
          {pending.length > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{pending.length} pending</Badge>
          )}
        </div>
        {pending.slice(0, size === "small" ? 3 : 5).map((s: any) => (
          <div key={s.id} className="flex items-start gap-2 text-xs">
            <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
            <span className="truncate">{s.title}</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function ToolsWidget({ size }: WidgetProps) {
  const links = [
    { label: "Plow Mapper", href: "/tools/plow-mapper", icon: MapPin },
    { label: "Calculator", href: "/tools/calculator", icon: Calculator },
    { label: "Lead Qualifier", href: "/tools/lead-qualifier", icon: Zap },
    { label: "Forms", href: "/forms", icon: FileText },
    { label: "Process Auditor", href: "/tools/process-auditor", icon: Wrench },
  ];

  return (
    <WidgetShell>
      <div className="space-y-1.5">
        {links.slice(0, size === "small" ? 4 : 5).map((link) => (
          <Link key={link.href} href={link.href}>
            <div className="flex items-center gap-2 text-xs p-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors" data-testid={`quicklink-${link.label.toLowerCase().replace(/\s/g, "-")}`}>
              <link.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{link.label}</span>
              <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </WidgetShell>
  );
}

export function CompanyHQWidget({ size }: WidgetProps) {
  return (
    <WidgetShell href="/hq">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Company HQ</span>
        </div>
        <p className="text-xs text-muted-foreground">
          View company mission, vision, goals and team info
        </p>
      </div>
    </WidgetShell>
  );
}

export function HelpWidget({ size }: WidgetProps) {
  return (
    <WidgetShell href="/help">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Help Center</span>
        </div>
        <p className="text-xs text-muted-foreground">
          FAQs, guides, and support resources
        </p>
      </div>
    </WidgetShell>
  );
}

export function DevTrackerWidget({ size }: WidgetProps) {
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/development-tracker"],
  });

  const statusColors: Record<string, string> = {
    done: "text-emerald-600 bg-emerald-50 border-emerald-200",
    in_progress: "text-blue-600 bg-blue-50 border-blue-200",
    blocked: "text-red-600 bg-red-50 border-red-200",
    not_started: "text-slate-500 bg-slate-50 border-slate-200",
    needs_review: "text-amber-600 bg-amber-50 border-amber-200",
  };

  const statusLabels: Record<string, string> = {
    done: "Done",
    in_progress: "In Progress",
    blocked: "Blocked",
    not_started: "Not Started",
    needs_review: "Needs Review",
  };

  const statusIcons: Record<string, typeof CheckSquare> = {
    done: CheckSquare,
    in_progress: Clock,
    blocked: AlertTriangle,
    not_started: Clock,
    needs_review: AlertTriangle,
  };

  const counts = {
    done: items.filter(i => i.status === "done").length,
    in_progress: items.filter(i => i.status === "in_progress").length,
    blocked: items.filter(i => i.status === "blocked").length,
    not_started: items.filter(i => i.status === "not_started").length,
    needs_review: items.filter(i => i.status === "needs_review").length,
  };

  const activeItems = items
    .filter(i => i.status !== "done")
    .sort((a, b) => {
      const order = { blocked: 0, needs_review: 1, in_progress: 2, not_started: 3 };
      return (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4);
    });

  const maxItems = size === "medium" ? 5 : 10;

  return (
    <WidgetShell loading={isLoading}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).filter(([, c]) => c > 0).map(([status, count]) => (
            <div key={status} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[status] || ""}`}>
              <span>{count}</span>
              <span>{statusLabels[status]}</span>
            </div>
          ))}
        </div>

        {activeItems.length === 0 ? (
          <p className="text-sm text-emerald-600 font-medium">All features complete!</p>
        ) : (
          <div className="space-y-1.5">
            {activeItems.slice(0, maxItems).map((item) => {
              const StatusIcon = statusIcons[item.status] || Clock;
              const colorClass = statusColors[item.status] || "";
              const blockers = (() => {
                try { return JSON.parse(item.blockers || "[]"); } catch { return []; }
              })();

              return (
                <div key={item.id} className="group" data-testid={`devtracker-item-${item.id}`}>
                  <div className="flex items-start gap-2 text-xs">
                    <StatusIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${colorClass.split(" ")[0]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{item.featureName}</span>
                        <span className={`text-[10px] px-1.5 py-0 rounded-full border shrink-0 ${colorClass}`}>
                          {statusLabels[item.status]}
                        </span>
                      </div>
                      {item.percentComplete != null && item.percentComplete < 100 && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${item.percentComplete}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{item.percentComplete}%</span>
                        </div>
                      )}
                      {blockers.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {blockers.slice(0, 2).map((b: string, i: number) => (
                            <p key={i} className="text-[10px] text-red-500 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> {b}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {activeItems.length > maxItems && (
              <p className="text-[10px] text-muted-foreground">+{activeItems.length - maxItems} more items</p>
            )}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

export function SOPPipelineWidget({ size }: WidgetProps) {
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sop-pipeline"],
  });
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/sop-pipeline/settings"],
  });

  const counts = {
    suggested: items.filter(i => i.status === "suggested").length,
    approved: items.filter(i => i.status === "approved").length,
    generating: items.filter(i => i.status === "generating").length,
    published: items.filter(i => i.status === "published").length,
    rejected: items.filter(i => i.status === "rejected").length,
  };

  const statusColors: Record<string, string> = {
    suggested: "text-blue-600 bg-blue-50",
    approved: "text-green-600 bg-green-50",
    generating: "text-amber-600 bg-amber-50",
    published: "text-emerald-600 bg-emerald-50",
    rejected: "text-red-600 bg-red-50",
  };

  const recentItems = items
    .sort((a, b) => new Date(b.suggestedAt || b.createdAt).getTime() - new Date(a.suggestedAt || a.createdAt).getTime())
    .slice(0, size === "small" ? 3 : size === "medium" ? 5 : 8);

  return (
    <WidgetShell loading={isLoading} href="/admin">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).filter(([, c]) => c > 0).map(([status, count]) => (
            <div key={status} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[status]}`}>
              {count} {status}
            </div>
          ))}
        </div>

        {settings?.autoGenerateEnabled && (
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600" data-testid="widget-pipeline-schedule-active">
            <Sparkles className="h-3 w-3" />
            <span>Auto-generating {settings.generateFrequency}</span>
          </div>
        )}

        {recentItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pipeline items yet</p>
        ) : (
          <div className="space-y-1.5">
            {recentItems.map((item: any) => (
              <div key={item.id} className="flex items-start gap-2 text-xs" data-testid={`widget-pipeline-item-${item.id}`}>
                {item.status === "published" ? (
                  <GraduationCap className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                ) : (
                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="truncate block">{item.title}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0 rounded-full shrink-0 ${statusColors[item.status] || "text-muted-foreground bg-muted"}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

// ─── Notes Widget ─────────────────────────────────────────────────────────────

type Note = {
  id: string; userId: string; title: string | null; body: string | null;
  color: string; isPinned: boolean; isArchived: boolean; tags: string[];
  reminderAt: string | null; reminderSent: boolean; createdAt: string; updatedAt: string;
};

const NOTE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  default: { bg: "bg-card",             border: "border-border",       label: "Default"  },
  yellow:  { bg: "bg-yellow-50 dark:bg-yellow-950/40",  border: "border-yellow-300 dark:border-yellow-700",  label: "Yellow"   },
  green:   { bg: "bg-green-50 dark:bg-green-950/40",    border: "border-green-300 dark:border-green-700",    label: "Green"    },
  blue:    { bg: "bg-blue-50 dark:bg-blue-950/40",      border: "border-blue-300 dark:border-blue-700",      label: "Blue"     },
  purple:  { bg: "bg-purple-50 dark:bg-purple-950/40",  border: "border-purple-300 dark:border-purple-700",  label: "Purple"   },
  red:     { bg: "bg-red-50 dark:bg-red-950/40",        border: "border-red-300 dark:border-red-700",        label: "Red"      },
  orange:  { bg: "bg-orange-50 dark:bg-orange-950/40",  border: "border-orange-300 dark:border-orange-700",  label: "Orange"   },
  teal:    { bg: "bg-teal-50 dark:bg-teal-950/40",      border: "border-teal-300 dark:border-teal-700",      label: "Teal"     },
};

const COLOR_SWATCHES: Record<string, string> = {
  default: "bg-card border-2 border-border",
  yellow:  "bg-yellow-400",
  green:   "bg-green-500",
  blue:    "bg-blue-500",
  purple:  "bg-purple-500",
  red:     "bg-red-500",
  orange:  "bg-orange-400",
  teal:    "bg-teal-500",
};

function formatReminderDate(dt: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "Past reminder";
  if (diff < 60 * 60 * 1000) return `In ${Math.round(diff / 60000)}m`;
  if (diff < 24 * 60 * 60 * 1000) return `In ${Math.round(diff / 3600000)}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NoteEditor({ note, onSave, onDelete, onBack }: {
  note: Partial<Note> | null;
  onSave: (data: Partial<Note>) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [title, setTitle]     = useState(note?.title || "");
  const [body, setBody]       = useState(note?.body || "");
  const [color, setColor]     = useState(note?.color || "default");
  const [isPinned, setIsPinned] = useState(note?.isPinned || false);
  const [tags, setTags]       = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [reminderAt, setReminderAt] = useState(toLocalDatetimeInput(note?.reminderAt || null));

  const handleSave = () => {
    onSave({ title: title || null, body, color, isPinned, tags,
      reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null });
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter(x => x !== t));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <button onClick={onBack} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" data-testid="note-back">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1 ml-1">
          {Object.entries(COLOR_SWATCHES).map(([key, cls]) => (
            <button key={key} onClick={() => setColor(key)}
              className={`h-5 w-5 rounded-full ${cls} transition-all ${color === key ? "ring-2 ring-offset-1 ring-foreground scale-110" : "hover:scale-105"}`}
              title={NOTE_COLORS[key]?.label} data-testid={`color-swatch-${key}`} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded hover:bg-muted transition-colors ${isPinned ? "text-primary" : "text-muted-foreground"}`}
            title={isPinned ? "Unpin" : "Pin"} data-testid="note-pin-toggle">
            {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          {note?.id && (
            <button onClick={onDelete}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete note" data-testid="note-delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSave} data-testid="note-save">
            <Save className="h-3 w-3" /> Save
          </Button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${NOTE_COLORS[color]?.bg || ""}`}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full bg-transparent text-lg font-semibold border-none outline-none placeholder:text-muted-foreground/60"
          data-testid="note-title-input"
        />
        <div data-testid="note-body-input">
          <RichTextEditor
            value={body}
            onChange={setBody}
            placeholder="Write your note…"
            minHeight="200px"
          />
        </div>

        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={e => setReminderAt(e.target.value)}
              className="text-xs bg-transparent border border-border rounded px-2 py-1 flex-1 text-foreground"
              data-testid="note-reminder-input"
            />
            {reminderAt && (
              <button onClick={() => setReminderAt("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex flex-wrap gap-1 flex-1">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                placeholder="Add tag…"
                className="text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/50 min-w-[60px] flex-1"
                data-testid="note-tag-input"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, onClick, onPin, onArchive, onDelete }: {
  note: Note;
  onClick: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const colors = NOTE_COLORS[note.color] || NOTE_COLORS.default;
  const isPast = note.reminderAt && new Date(note.reminderAt) < new Date();

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md group ${colors.bg} ${colors.border}`}
      data-testid={`note-card-${note.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          {note.title && <p className="text-sm font-semibold truncate">{note.title}</p>}
          {note.body && (
            <div
              className="prose max-w-none text-xs text-muted-foreground mt-0.5 overflow-hidden"
              style={{ maxHeight: "4rem" }}
              dangerouslySetInnerHTML={{ __html: note.body }}
            />
          )}
        </div>
        {note.isPinned && <Pin className="h-3 w-3 text-primary shrink-0 mt-0.5" />}
      </div>

      {(note.tags.length > 0 || note.reminderAt) && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {note.reminderAt && (
            <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isPast ? "bg-destructive/10 text-destructive" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
              <AlarmClock className="h-2.5 w-2.5" /> {formatReminderDate(note.reminderAt)}
            </span>
          )}
          {note.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      )}

      {hovered && (
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-background/90 backdrop-blur-sm rounded-lg shadow px-1 py-0.5 border"
          onClick={e => e.stopPropagation()}>
          <button onClick={onPin} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title={note.isPinned ? "Unpin" : "Pin"}>
            {note.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
          <button onClick={onArchive} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors" title="Archive">
            <Archive className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function NotesPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<"all" | "pinned" | "reminders" | "archived">("all");
  const [editing, setEditing] = useState<Note | null | "new">(null);

  const qKey = ["/api/notes", filter, search];
  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filter === "pinned") params.set("pinned", "true");
      if (filter === "archived") params.set("archived", "true");
      const res = await fetch(`/api/notes?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const displayNotes = filter === "reminders"
    ? notes.filter((n: Note) => !!n.reminderAt && !n.isArchived)
    : notes;

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Note>) => {
      const res = await fetch("/api/notes", { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); setEditing(null); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Note> }) => {
      const res = await fetch(`/api/notes/${id}`, { method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notes/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); setEditing(null); },
  });

  const handleSave = (data: Partial<Note>) => {
    if (editing === "new") { createMutation.mutate(data); }
    else if (editing) { updateMutation.mutate({ id: editing.id, data }); }
  };

  const FILTERS = [
    { id: "all",       label: "All"       },
    { id: "pinned",    label: "Pinned"    },
    { id: "reminders", label: "Reminders" },
    { id: "archived",  label: "Archived"  },
  ] as const;

  if (editing !== null) {
    return (
      <NoteEditor
        note={editing === "new" ? null : editing}
        onSave={handleSave}
        onDelete={() => editing !== "new" && deleteMutation.mutate(editing.id)}
        onBack={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
              data-testid="notes-search"
            />
          </div>
          <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => setEditing("new")} data-testid="new-note-button">
            <Plus className="h-3.5 w-3.5" /> New Note
          </Button>
        </div>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid={`filter-${f.id}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <StickyNote className="h-8 w-8 opacity-30" />
            <p className="text-sm">{search ? "No notes match your search" : filter === "archived" ? "No archived notes" : "No notes yet — create your first!"}</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
            {displayNotes.map((note: Note) => (
              <div key={note.id} className="break-inside-avoid mb-3">
                <NoteCard
                  note={note}
                  onClick={() => setEditing(note)}
                  onPin={() => updateMutation.mutate({ id: note.id, data: { isPinned: !note.isPinned } })}
                  onArchive={() => updateMutation.mutate({ id: note.id, data: { isArchived: true } })}
                  onDelete={() => { if (confirm("Delete this note?")) deleteMutation.mutate(note.id); }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotesWidget({ size }: WidgetProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes", "all", ""],
    queryFn: async () => {
      const res = await fetch("/api/notes", { credentials: "include" });
      return res.json();
    },
  });

  const pinned    = notes.filter((n: Note) => n.isPinned && !n.isArchived);
  const recent    = notes.filter((n: Note) => !n.isPinned && !n.isArchived);
  const reminders = notes.filter((n: Note) => n.reminderAt && !n.reminderSent && !n.isArchived);
  const previewNotes = [...pinned, ...recent].slice(0, size === "small" ? 2 : size === "medium" ? 3 : 5);

  return (
    <>
      <div className="h-full flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">{notes.filter((n: Note) => !n.isArchived).length} notes</span>
          {pinned.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 h-4">
              <Pin className="h-2.5 w-2.5" /> {pinned.length} pinned
            </Badge>
          )}
          {reminders.length > 0 && (
            <Badge className="text-[10px] gap-0.5 px-1.5 h-4 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" variant="outline">
              <AlarmClock className="h-2.5 w-2.5" /> {reminders.length} reminder{reminders.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : previewNotes.length === 0 ? (
          <button onClick={() => setOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors group">
            <StickyNote className="h-6 w-6 opacity-40 group-hover:opacity-60" />
            <p className="text-xs">Tap to add your first note</p>
          </button>
        ) : (
          <div className="flex-1 space-y-1.5 min-h-0 overflow-hidden">
            {previewNotes.map((note: Note) => {
              const colors = NOTE_COLORS[note.color] || NOTE_COLORS.default;
              return (
                <button key={note.id} onClick={() => setOpen(true)}
                  className={`w-full text-left rounded-lg border px-2.5 py-1.5 ${colors.bg} ${colors.border} hover:shadow-sm transition-shadow`}
                  data-testid={`notepad-preview-${note.id}`}>
                  <div className="flex items-center gap-1.5">
                    {note.isPinned && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
                    <p className="text-xs font-medium truncate flex-1">{note.title || note.body?.slice(0, 40) || "Empty note"}</p>
                    {note.reminderAt && <AlarmClock className="h-2.5 w-2.5 text-blue-500 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-1.5 w-full mt-1 pt-2 border-t text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          data-testid="open-notepad"
        >
          <Maximize2 className="h-3 w-3" /> Open Notepad
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[97vw] w-[97vw] h-[93vh] max-h-[93vh] p-0 flex flex-col gap-0 overflow-hidden" data-testid="notepad-dialog">
          <DialogHeader className="px-5 py-3 border-b shrink-0 flex-row items-center gap-3">
            <StickyNote className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-base font-semibold">My Notepad</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <NotesPanel />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DailyAgendaWidget({ size }: WidgetProps) {
  function todayStr() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  const { data: agenda, isLoading } = useQuery<any>({
    queryKey: ["/api/daily-agenda", "widget"],
    queryFn: async () => {
      const r = await fetch(`/api/daily-agenda?date=${todayStr()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 30_000,
  });

  const todos: any[] = Array.isArray(agenda?.todoItems) ? agenda.todoItems : [];
  const withText = todos.filter((t: any) => t.text);
  const done = withText.filter((t: any) => t.completed);
  const preview = withText.slice(0, size === "small" ? 3 : size === "medium" ? 5 : 7);

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
        {withText.length > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${done.length === withText.length ? "border-green-500 text-green-600" : "border-border text-muted-foreground"}`}>
            {done.length}/{withText.length} done
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : preview.length === 0 ? (
        <Link href="/daily-agenda">
          <div className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-4">
            <ClipboardList className="h-7 w-7 opacity-40" />
            <p className="text-xs">Start today's agenda</p>
          </div>
        </Link>
      ) : (
        <div className="flex-1 space-y-1 min-h-0 overflow-hidden">
          {preview.map((item: any) => (
            <div key={item.id} className="flex items-center gap-1.5">
              {item.completed
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              }
              <span className={`text-xs truncate ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                {item.text}
              </span>
            </div>
          ))}
          {withText.length > preview.length && (
            <p className="text-xs text-muted-foreground pl-5">+{withText.length - preview.length} more</p>
          )}
        </div>
      )}

      <Link href="/daily-agenda">
        <div
          className="flex items-center justify-center gap-1.5 w-full mt-auto pt-2 border-t text-xs text-primary hover:text-primary/80 transition-colors font-medium cursor-pointer"
          data-testid="open-daily-agenda"
        >
          <Maximize2 className="h-3 w-3" /> Open Agenda
        </div>
      </Link>
    </div>
  );
}

export const WIDGET_COMPONENTS: Record<string, React.ComponentType<WidgetProps>> = {
  messages: MessagesWidget,
  todos: TodosWidget,
  pipeline: PipelineWidget,
  estimates: EstimatesWidget,
  calendar: CalendarWidget,
  equipment: EquipmentWidget,
  marketing: MarketingWidget,
  employees: EmployeesWidget,
  sops: SOPsWidget,
  quizzes: QuizzesWidget,
  materials: MaterialsWidget,
  suggestions: SuggestionsWidget,
  tools: ToolsWidget,
  companyhq: CompanyHQWidget,
  help: HelpWidget,
  devtracker: DevTrackerWidget,
  soppipeline: SOPPipelineWidget,
  notes: NotesWidget,
  dailyagenda: DailyAgendaWidget,
};