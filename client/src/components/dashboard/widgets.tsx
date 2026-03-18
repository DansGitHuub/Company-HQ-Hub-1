import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
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
  const { data: threads = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/messages/threads"],
  });

  const unreadCount = threads.filter((t: any) => t.unreadCount > 0).length;
  const recentThreads = threads.slice(0, size === "small" ? 3 : size === "medium" ? 5 : 8);

  return (
    <WidgetShell loading={isLoading} href="/inbox">
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
            <div key={thread.id} className="flex items-start gap-2 text-sm">
              <Mail className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${thread.unreadCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className={`truncate text-xs ${thread.unreadCount > 0 ? "font-semibold" : ""}`}>{thread.subject || "No subject"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function TodosWidget({ size }: WidgetProps) {
  const { data: todos = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/todos"],
  });

  const pending = todos.filter((t: any) => !t.completed);
  const overdue = pending.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date());
  const display = pending.slice(0, size === "small" ? 4 : size === "medium" ? 6 : 10);

  return (
    <WidgetShell loading={isLoading} href="/todos">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{pending.length} pending</span>
        {overdue.length > 0 && (
          <Badge variant="destructive" className="text-xs">{overdue.length} overdue</Badge>
        )}
      </div>
      {display.length === 0 ? (
        <p className="text-sm text-muted-foreground">All caught up!</p>
      ) : (
        <div className="space-y-1.5">
          {display.map((todo: any) => {
            const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date();
            return (
              <div key={todo.id} className="flex items-start gap-2 text-sm">
                <CheckSquare className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{todo.title}</p>
                  {todo.dueDate && (
                    <p className={`text-[10px] ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                      Due {new Date(todo.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {todo.priority && (
                  <Badge variant="outline" className="text-[10px] shrink-0 px-1">{todo.priority}</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
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

  const stages = ["New Lead", "Contact Made", "Site Visit", "Proposal Sent", "Follow Up", "Won", "Lost"];
  const stageCounts = stages.map(stage => ({
    stage,
    count: estimates.filter((e: any) => e.stage === stage).length,
  }));

  return (
    <WidgetShell loading={isLoading} href="/jobs">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{estimates.length} estimates</span>
      </div>
      <div className="space-y-1.5">
        {stageCounts.filter(s => s.count > 0 || size !== "small").slice(0, size === "small" ? 4 : 7).map((s) => (
          <div key={s.stage} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate">{s.stage}</span>
            <Badge variant={s.stage === "Won" ? "default" : "secondary"} className="text-xs px-1.5 min-w-[24px] justify-center">{s.count}</Badge>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function CalendarWidget({ size }: WidgetProps) {
  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/calendar/events"],
  });

  const now = new Date();
  const upcoming = events
    .filter((e: any) => new Date(e.startDate || e.start) >= now)
    .sort((a: any, b: any) => new Date(a.startDate || a.start).getTime() - new Date(b.startDate || b.start).getTime())
    .slice(0, size === "small" ? 3 : size === "medium" ? 5 : 8);

  return (
    <WidgetShell loading={isLoading} href="/calendar">
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((event: any) => {
            const start = new Date(event.startDate || event.start);
            return (
              <div key={event.id} className="flex items-start gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{event.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
    queryKey: ["/api/equipment"],
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
    <WidgetShell loading={isLoading} href="/testing">
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
};
