import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  isValid,
  startOfDay,
} from "date-fns";
import {
  Briefcase, DollarSign, CheckSquare, Wrench,
  AlertTriangle, ChevronRight, CheckCircle, ExternalLink, CalendarClock, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawJob {
  id: string;
  title: string;
  client: string;
  status: string;
  scheduled_date: string | null;
  cust_first: string | null;
  cust_last: string | null;
  cust_company: string | null;
}

interface RawInvoice {
  id: string;
  invoice_number: string;
  status: string;
  due_date: string | null;
  balance_due: string | number;
  total: string | number;
  cust_first: string | null;
  cust_last: string | null;
  cust_company: string | null;
}

interface RawTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}

interface RawAsset {
  id: string;
  name: string;
  status: string;
  nextServiceDate: string | null;
  nextServiceTask: string | null;
}

interface RawFollowUp {
  id: string;
  name: string;
  next_follow_up_date: string;
  type: "customer" | "lead";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = startOfDay(new Date());

function parseDateSafe(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = parseISO(val);
  return isValid(d) ? d : null;
}

function daysBadgeClass(days: number) {
  if (days >= 31) return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800";
  if (days >= 8)  return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800";
  return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
}

function daysLabel(days: number) {
  return days === 1 ? "1 day overdue" : `${days} days overdue`;
}

function customerName(row: { cust_first?: string | null; cust_last?: string | null; cust_company?: string | null; client?: string }) {
  if (row.cust_company) return row.cust_company;
  if (row.cust_first || row.cust_last) return [row.cust_first, row.cust_last].filter(Boolean).join(" ");
  return row.client ?? "—";
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400",
    high:   "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400",
    medium: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400",
    low:    "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400",
  };
  return map[priority] ?? map.medium;
}

// ─── Section component ────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, count, accentClass,
}: { icon: any; title: string; count: number; accentClass: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("p-1.5 rounded-md", accentClass)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {count > 0 ? (
        <Badge variant="destructive" className="ml-1 text-xs px-2">{count}</Badge>
      ) : (
        <Badge variant="secondary" className="ml-1 text-xs px-2">0</Badge>
      )}
    </div>
  );
}

function AllClear({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-green-800 dark:text-green-300">All clear</p>
        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OverduePage() {
  const { data: rawJobs = [], isLoading: jobsLoading } = useQuery<RawJob[]>({
    queryKey: ["/api/jobs", "overdue-view"],
    queryFn: () =>
      fetch("/api/jobs?status=scheduled,in_progress,sold,active", { credentials: "include" })
        .then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: rawInvoices = [], isLoading: invoicesLoading } = useQuery<RawInvoice[]>({
    queryKey: ["/api/invoices", "overdue-view"],
    queryFn: () =>
      fetch("/api/invoices?status=overdue,sent,viewed,accepted", { credentials: "include" })
        .then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: rawTasks = [], isLoading: tasksLoading } = useQuery<RawTask[]>({
    queryKey: ["/api/tasks"],
    staleTime: 60_000,
  });

  const { data: rawAssets = [], isLoading: assetsLoading } = useQuery<RawAsset[]>({
    queryKey: ["/api/fleet/assets"],
    staleTime: 60_000,
  });

  const { data: rawFollowUps = [], isLoading: followUpsLoading } = useQuery<RawFollowUp[]>({
    queryKey: ["/api/follow-ups/overdue"],
    queryFn: () => fetch("/api/follow-ups/overdue", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const isLoading = jobsLoading || invoicesLoading || tasksLoading || assetsLoading || followUpsLoading;

  // ── Compute overdue items ────────────────────────────────────────────────

  const overdueJobs = rawJobs
    .filter(j => {
      const d = parseDateSafe(j.scheduled_date);
      return d !== null && d < today;
    })
    .map(j => ({ ...j, daysOverdue: differenceInCalendarDays(today, parseDateSafe(j.scheduled_date)!) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const overdueInvoices = rawInvoices
    .filter(i => {
      const d = parseDateSafe(i.due_date);
      return d !== null && d < today && parseFloat(String(i.balance_due)) > 0;
    })
    .map(i => ({ ...i, daysOverdue: differenceInCalendarDays(today, parseDateSafe(i.due_date)!) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const overdueTasks = rawTasks
    .filter(t => {
      if (["complete", "cancelled"].includes(t.status)) return false;
      const d = parseDateSafe(t.dueDate);
      return d !== null && d < today;
    })
    .map(t => ({ ...t, daysOverdue: differenceInCalendarDays(today, parseDateSafe(t.dueDate)!) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const overdueAssets = rawAssets
    .filter(a => {
      if (["Retired", "Out of Service"].includes(a.status)) return false;
      const d = parseDateSafe(a.nextServiceDate);
      return d !== null && d < today;
    })
    .map(a => ({ ...a, daysOverdue: differenceInCalendarDays(today, parseDateSafe(a.nextServiceDate)!) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const overdueFollowUps = rawFollowUps
    .map(f => ({ ...f, daysOverdue: differenceInCalendarDays(today, parseDateSafe(f.next_follow_up_date)!) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const totalCount = overdueJobs.length + overdueInvoices.length + overdueTasks.length + overdueAssets.length + overdueFollowUps.length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Overdue Items</h1>
            {!isLoading && totalCount > 0 && (
              <Badge variant="destructive" className="text-sm px-2.5 py-0.5">{totalCount} total</Badge>
            )}
            {!isLoading && totalCount === 0 && (
              <Badge variant="secondary" className="text-sm px-2.5 py-0.5">All clear</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Jobs, invoices, tasks, maintenance, and follow-ups past their due date · as of {format(today, "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* ── Group 1: Behind-Schedule Jobs ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-normal">
            <SectionHeader
              icon={Briefcase}
              title="Behind-Schedule Jobs"
              count={overdueJobs.length}
              accentClass="bg-blue-600"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="px-4 py-5 text-sm text-muted-foreground">Loading…</div>
          ) : overdueJobs.length === 0 ? (
            <div className="px-4 pb-4">
              <AllClear label="No jobs are past their scheduled date." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueJobs.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer group">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.title || "Untitled Job"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {customerName(job)}
                        {job.scheduled_date && (
                          <span className="ml-2 opacity-70">
                            · Scheduled {format(parseISO(job.scheduled_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", daysBadgeClass(job.daysOverdue))}>
                        {daysLabel(job.daysOverdue)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Group 2: Overdue Invoices ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-normal">
            <SectionHeader
              icon={DollarSign}
              title="Overdue Invoices"
              count={overdueInvoices.length}
              accentClass="bg-emerald-600"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoicesLoading ? (
            <div className="px-4 py-5 text-sm text-muted-foreground">Loading…</div>
          ) : overdueInvoices.length === 0 ? (
            <div className="px-4 pb-4">
              <AllClear label="No invoices are past their due date with an open balance." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueInvoices.map(inv => (
                <Link key={inv.id} href={`/invoices/${inv.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer group">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {customerName(inv)}
                        {inv.due_date && (
                          <span className="ml-2 opacity-70">
                            · Due {format(parseISO(inv.due_date), "MMM d, yyyy")}
                          </span>
                        )}
                        <span className="ml-2 font-medium text-foreground/70">
                          · ${parseFloat(String(inv.balance_due)).toLocaleString("en-US", { minimumFractionDigits: 2 })} due
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", daysBadgeClass(inv.daysOverdue))}>
                        {daysLabel(inv.daysOverdue)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Group 3: Overdue Tasks ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-normal">
            <SectionHeader
              icon={CheckSquare}
              title="Overdue Tasks"
              count={overdueTasks.length}
              accentClass="bg-violet-600"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tasksLoading ? (
            <div className="px-4 py-5 text-sm text-muted-foreground">Loading…</div>
          ) : overdueTasks.length === 0 ? (
            <div className="px-4 pb-4">
              <AllClear label="No tasks are past their due date." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueTasks.map(task => (
                <Link key={task.id} href="/todos">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer group">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[11px] font-medium px-1.5 py-0 rounded border capitalize", priorityBadge(task.priority))}>
                          {task.priority}
                        </span>
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Due {format(parseISO(task.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", daysBadgeClass(task.daysOverdue))}>
                        {daysLabel(task.daysOverdue)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Group 4: Maintenance Past Due ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-normal">
            <SectionHeader
              icon={Wrench}
              title="Maintenance Past Due"
              count={overdueAssets.length}
              accentClass="bg-orange-600"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assetsLoading ? (
            <div className="px-4 py-5 text-sm text-muted-foreground">Loading…</div>
          ) : overdueAssets.length === 0 ? (
            <div className="px-4 pb-4">
              <AllClear label="All equipment is within its maintenance schedule." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueAssets.map(asset => (
                <Link key={asset.id} href={`/equipment`}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer group">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{asset.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {asset.nextServiceTask ?? "Scheduled service"}
                        {asset.nextServiceDate && (
                          <span className="ml-2 opacity-70">
                            · Due {format(parseISO(asset.nextServiceDate), "MMM d, yyyy")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", daysBadgeClass(asset.daysOverdue))}>
                        {daysLabel(asset.daysOverdue)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Group 5: Overdue Follow-ups ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-normal">
            <SectionHeader
              icon={CalendarClock}
              title="Overdue Follow-ups"
              count={overdueFollowUps.length}
              accentClass="bg-teal-600"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {followUpsLoading ? (
            <div className="px-4 py-5 text-sm text-muted-foreground">Loading…</div>
          ) : overdueFollowUps.length === 0 ? (
            <div className="px-4 pb-4">
              <AllClear label="No customers or leads have overdue follow-up dates." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueFollowUps.map(fu => (
                <Link key={`${fu.type}-${fu.id}`} href={fu.type === "customer" ? `/customers/${fu.id}` : "/consultations"}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer group">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fu.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="capitalize">{fu.type}</span>
                        {fu.next_follow_up_date && (
                          <span className="ml-2 opacity-70">
                            · Follow-up was {format(parseDateSafe(fu.next_follow_up_date)!, "MMM d, yyyy")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", daysBadgeClass(fu.daysOverdue))}>
                        {daysLabel(fu.daysOverdue)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
