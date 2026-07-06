import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { format, subDays, formatDistanceToNow, differenceInMinutes, startOfDay, parseISO, isValid } from "date-fns";
import {
  Users, Clock, Briefcase, FileText, RefreshCw, MapPin, CheckCircle,
  XCircle, AlertTriangle, ChevronRight, Activity, TrendingUp,
  ShieldAlert, GraduationCap, Timer, Car, HardHat, Coffee, Building2,
  Check, X, MoreHorizontal, ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface LiveCrewEntry {
  id: string;
  clock_in: string;
  entry_type: string;
  work_area_name: string | null;
  job_id: string | null;
  notes: string | null;
  user_id: string;
  employee_name: string;
  username: string;
  job_name: string | null;
  job_title: string | null;
  job_address: string | null;
  lat: number | null;
  lng: number | null;
  last_ping_at: string | null;
}

interface PendingApproval {
  id: string;
  user_id: string;
  employee_name: string;
  username: string;
  job_id: string | null;
  job_title: string | null;
  clock_in: string;
  clock_out: string;
  duration_minutes: number;
  entry_type: string;
  work_area_name: string | null;
  notes: string | null;
  approval_status: string;
  rejection_note: string | null;
}

interface Job {
  id: string;
  title: string;
  client: string;
  status: string;
  job_type: string | null;
  address: string | null;
  city: string | null;
  scheduled_date: string | null;
}

interface PendingCO {
  id: string;
  co_number: string;
  title: string;
  status: string;
  total_amount: number;
  job_id: string;
  job_name: string | null;
  job_title: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface SafetyFlag {
  user_id: string;
  name: string;
  username: string;
  role: string;
  quiz_id: string;
  quiz_title: string;
  sop_title: string;
  best_level: number;
  min_pass_level: number;
}

interface EmployeeQuizStat {
  user_id: string;
  name: string;
  username: string;
  quiz_id: string;
  quiz_title: string;
  is_safety_critical: boolean;
  best_level: number;
  min_pass_level: number;
  attempt_count: number;
  last_attempt: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ENTRY_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  work:        { label: "On Job",    color: "bg-green-500",  icon: HardHat },
  drive:       { label: "Driving",   color: "bg-blue-500",   icon: Car },
  shop:        { label: "Shop",      color: "bg-amber-500",  icon: Building2 },
  break:       { label: "Break",     color: "bg-slate-400",  icon: Coffee },
  "drive-home":{ label: "Drive Home",color: "bg-purple-400", icon: Car },
  other:       { label: "Other",     color: "bg-gray-400",   icon: Timer },
};

function entryTypeConfig(type: string) {
  return ENTRY_TYPE_CONFIG[type] ?? { label: type, color: "bg-gray-400", icon: Timer };
}

function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function elapsedMinutes(clockIn: string) {
  return differenceInMinutes(new Date(), new Date(clockIn));
}

function StatCard({
  title, value, icon: Icon, color, sub, href,
}: { title: string; value: number | string; icon: any; color: string; sub?: string; href?: string }) {
  const inner = (
    <Card className={cn("flex-1 min-w-0", href && "cursor-pointer hover:shadow-md transition-shadow")}>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-lg", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href} className="flex-1 min-w-0">{inner}</Link>;
  return inner;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PendingApproval | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: liveCrew = [], isLoading: crewLoading, refetch: refetchCrew } = useQuery<LiveCrewEntry[]>({
    queryKey: ["/api/manager/live-crew"],
    refetchInterval: 60_000,
  });

  const { data: approvalData, isLoading: approvalLoading, refetch: refetchApprovals } = useQuery<{
    entries: PendingApproval[];
    counts: { pending: number; approved: number; rejected: number };
  }>({
    queryKey: ["/api/admin/time-card-approval", "pending", weekAgo, today],
    queryFn: () =>
      fetch(`/api/admin/time-card-approval?status=pending&startDate=${weekAgo}&endDate=${today}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const { data: activeJobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs", "active,scheduled"],
    queryFn: () =>
      fetch("/api/jobs?status=active,scheduled", { credentials: "include" }).then(r => r.json()),
  });

  // Separate, broader fetch used only for the "Overdue Jobs" stat card below —
  // matches the status set used by Overdue.tsx and the admin Daily Pulse widget
  // (scheduled, in_progress, sold, active), which is wider than the "Active Jobs"
  // stat/list above (active, scheduled only). Kept isolated so it doesn't affect
  // the "Active Jobs" count or the job list section.
  const { data: overdueScopeJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs", "scheduled,in_progress,sold,active"],
    queryFn: () =>
      fetch("/api/jobs?status=scheduled,in_progress,sold,active", { credentials: "include" }).then(r => r.json()),
  });

  const { data: pendingCOs = [], isLoading: cosLoading } = useQuery<PendingCO[]>({
    queryKey: ["/api/manager/pending-change-orders"],
    refetchInterval: 120_000,
  });

  const { data: safetyFlags = [], isLoading: safetyLoading } = useQuery<SafetyFlag[]>({
    queryKey: ["/api/quiz-stats/safety-flags"],
    staleTime: 300_000,
  });

  const { data: quizStats = [], isLoading: quizLoading } = useQuery<EmployeeQuizStat[]>({
    queryKey: ["/api/quiz-stats/employees"],
    staleTime: 300_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const approveEntry = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/time-entries/${id}/approval`, { status: "approved" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/time-card-approval"] });
      toast({ title: "Entry approved" });
    },
  });

  const rejectEntry = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest("PATCH", `/api/admin/time-entries/${id}/approval`, {
        status: "rejected",
        rejection_note: note,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/time-card-approval"] });
      setRejectDialogOpen(false);
      setRejectNote("");
      setRejectTarget(null);
      toast({ title: "Entry rejected" });
    },
  });

  const bulkApproveAll = useMutation({
    mutationFn: () => {
      const ids = pendingEntries.map(e => e.id);
      return apiRequest("POST", "/api/admin/time-entries/bulk-approval", { ids, status: "approved" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/time-card-approval"] });
      toast({ title: `Approved ${pendingEntries.length} entries` });
    },
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const pendingEntries = approvalData?.entries ?? [];

  const quizByEmployee = quizStats.reduce<Record<string, EmployeeQuizStat[]>>((acc, s) => {
    (acc[s.user_id] = acc[s.user_id] ?? []).push(s);
    return acc;
  }, {});

  const employeesWithCriticalFail = [
    ...new Map(safetyFlags.map(f => [f.user_id, f])).values()
  ];

  const todayStart = startOfDay(new Date());
  const overdueJobsCount = overdueScopeJobs.filter(j => {
    if (!j.scheduled_date) return false;
    const d = parseISO(j.scheduled_date);
    return isValid(d) && startOfDay(d) < todayStart;
  }).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["/api/manager/live-crew"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/time-card-approval"] });
    qc.invalidateQueries({ queryKey: ["/api/manager/pending-change-orders"] });
    toast({ title: "Dashboard refreshed" });
  }, [qc, toast]);

  const openRejectDialog = (entry: PendingApproval) => {
    setRejectTarget(entry);
    setRejectNote("");
    setRejectDialogOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manager Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live operations overview · auto-refreshes every 60s</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="flex gap-4 flex-wrap">
        <StatCard
          title="Clocked In Now"
          value={liveCrew.length}
          icon={Users}
          color="bg-green-600"
          sub={liveCrew.length === 1 ? "1 employee active" : `${liveCrew.length} employees active`}
        />
        <StatCard
          title="Pending Approvals"
          value={pendingEntries.length}
          icon={Clock}
          color={pendingEntries.length > 0 ? "bg-amber-500" : "bg-slate-400"}
          sub="time entries needing review"
        />
        <StatCard
          title="Active Jobs"
          value={activeJobs.length}
          icon={Briefcase}
          color="bg-blue-600"
          sub="active + scheduled"
        />
        <StatCard
          title="Pending Change Orders"
          value={pendingCOs.length}
          icon={FileText}
          color={pendingCOs.length > 0 ? "bg-orange-500" : "bg-slate-400"}
          sub="awaiting customer approval"
        />
        <StatCard
          title="Overdue Jobs"
          value={overdueJobsCount}
          icon={AlertTriangle}
          color={overdueJobsCount > 0 ? "bg-red-600" : "bg-slate-400"}
          sub="past scheduled date → view all overdue"
          href="/overdue"
        />
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: Live Crew ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-green-500" />
                Live Crew
                <Badge variant="secondary" className="ml-auto">{liveCrew.length} clocked in</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {crewLoading ? (
                <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
              ) : liveCrew.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">No one is clocked in right now.</div>
              ) : (
                <div className="divide-y divide-border">
                  {liveCrew.map(entry => {
                    const cfg = entryTypeConfig(entry.entry_type);
                    const TypeIcon = cfg.icon;
                    const elapsed = elapsedMinutes(entry.clock_in);
                    return (
                      <div key={entry.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                        <div className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", cfg.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground">{entry.employee_name}</span>
                            <Badge variant="outline" className="text-xs gap-1 px-1.5">
                              <TypeIcon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {entry.job_name
                              ? <>📍 {entry.job_name}{entry.job_address ? ` · ${entry.job_address}` : ""}</>
                              : entry.work_area_name
                              ? `🏢 ${entry.work_area_name}`
                              : "No job linked"}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-mono font-medium">{fmtDuration(elapsed)}</p>
                          <p className="text-xs text-muted-foreground">since {format(new Date(entry.clock_in), "h:mm a")}</p>
                          {entry.last_ping_at && (
                            <p className="text-xs text-muted-foreground flex items-center justify-end gap-0.5 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              GPS {formatDistanceToNow(new Date(entry.last_ping_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Active Jobs ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4 text-blue-500" />
                Active Jobs
                <Badge variant="secondary" className="ml-auto">{activeJobs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {jobsLoading ? (
                <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
              ) : activeJobs.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">No active or scheduled jobs.</div>
              ) : (
                <div className="divide-y divide-border">
                  {activeJobs.slice(0, 12).map(job => (
                    <Link key={job.id} href={`/jobs/${job.id}`}>
                      <div className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground truncate max-w-[200px]">
                              {job.client || job.title || "Unnamed Job"}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("text-xs", job.status === "active" ? "border-green-500 text-green-600" : "border-blue-400 text-blue-600")}
                            >
                              {job.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {job.title && job.title !== job.client ? `${job.title} · ` : ""}
                            {job.address ?? "No address"}
                            {job.city ? `, ${job.city}` : ""}
                          </p>
                        </div>
                        {job.scheduled_date && (
                          <p className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(job.scheduled_date), "MMM d")}
                          </p>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                  {activeJobs.length > 12 && (
                    <div className="px-6 py-3">
                      <Link href="/jobs?status=active">
                        <span className="text-xs text-primary hover:underline cursor-pointer">
                          View all {activeJobs.length} jobs →
                        </span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* ── Quick Time Approval ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Time Approval
                </CardTitle>
                {pendingEntries.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1"
                    onClick={() => bulkApproveAll.mutate()}
                    disabled={bulkApproveAll.isPending}
                  >
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Approve All ({pendingEntries.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {approvalLoading ? (
                <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
              ) : pendingEntries.length === 0 ? (
                <div className="p-6 flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground">No pending time entries this week.</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {pendingEntries.map(entry => {
                    const cfg = entryTypeConfig(entry.entry_type);
                    const TypeIcon = cfg.icon;
                    return (
                      <div key={entry.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium">{entry.employee_name}</span>
                              <Badge variant="outline" className="text-xs gap-1 px-1.5">
                                <TypeIcon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(entry.clock_in), "EEE MMM d")}
                              {" · "}{format(new Date(entry.clock_in), "h:mm a")} – {format(new Date(entry.clock_out), "h:mm a")}
                              {" · "}<span className="font-mono">{fmtDuration(entry.duration_minutes)}</span>
                            </p>
                            {entry.job_title && (
                              <p className="text-xs text-muted-foreground truncate">{entry.job_title}</p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                              onClick={() => approveEntry.mutate(entry.id)}
                              disabled={approveEntry.isPending}
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => openRejectDialog(entry)}
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {pendingEntries.length > 0 && (
                <div className="px-4 py-3 border-t">
                  <Link href="/admin/time?tab=approval">
                    <span className="text-xs text-primary hover:underline cursor-pointer">
                      View full Time Approval page →
                    </span>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Pending Change Orders ────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-orange-500" />
                Pending Change Orders
                {pendingCOs.length > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs">{pendingCOs.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cosLoading ? (
                <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
              ) : pendingCOs.length === 0 ? (
                <div className="p-6 flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium">No pending COs</p>
                  <p className="text-xs text-muted-foreground">All change orders are resolved.</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {pendingCOs.map(co => (
                    <Link key={co.id} href={`/jobs/${co.job_id}`}>
                      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{co.title || co.co_number}</p>
                          <p className="text-xs text-muted-foreground truncate">{co.job_name}</p>
                          {co.total_amount != null && (
                            <p className="text-xs font-mono text-muted-foreground">
                              ${Number(co.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                            {co.status === "pending_approval" ? "Pending" : "Sent"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(co.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Team Health (full width) ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            Team Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="safety">
            <TabsList>
              <TabsTrigger value="safety" className="gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Safety Flags
                {safetyFlags.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs px-1.5">{safetyFlags.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="training" className="gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                Training
              </TabsTrigger>
            </TabsList>

            {/* Safety Flags Tab */}
            <TabsContent value="safety" className="mt-4">
              {safetyLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : safetyFlags.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">All safety quizzes passed</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Every employee meets the required safety quiz level.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    {safetyFlags.length} safety-critical quiz failure{safetyFlags.length !== 1 ? "s" : ""} across {employeesWithCriticalFail.length} employee{employeesWithCriticalFail.length !== 1 ? "s" : ""}
                  </p>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employee</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiz / SOP</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {safetyFlags.map((flag, i) => (
                          <tr key={`${flag.user_id}-${flag.quiz_id}-${i}`} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                <span className="font-medium">{flag.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="text-sm">{flag.quiz_title}</p>
                              {flag.sop_title && <p className="text-xs text-muted-foreground">{flag.sop_title}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Badge variant="destructive" className="text-xs">{flag.best_level ?? 0}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Badge variant="outline" className="text-xs">{flag.min_pass_level}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Training Tab */}
            <TabsContent value="training" className="mt-4">
              {quizLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : Object.keys(quizByEmployee).length === 0 ? (
                <p className="text-sm text-muted-foreground">No quiz activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(quizByEmployee).map(([userId, stats]) => {
                    const name = stats[0].name;
                    const total = stats.length;
                    const passed = stats.filter(s => s.best_level >= s.min_pass_level).length;
                    const pct = Math.round((passed / total) * 100);
                    const lastDate = stats
                      .map(s => s.last_attempt)
                      .filter(Boolean)
                      .sort()
                      .at(-1);
                    return (
                      <div key={userId} className="flex items-center gap-4">
                        <div className="w-32 flex-shrink-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          {lastDate && (
                            <p className="text-xs text-muted-foreground">
                              Last: {format(new Date(lastDate), "MMM d")}
                            </p>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-24 text-right flex-shrink-0">
                          <span className={cn(
                            "text-sm font-semibold",
                            pct === 100 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-red-500"
                          )}>{passed}/{total}</span>
                          <span className="text-xs text-muted-foreground ml-1">passed</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Reject Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Time Entry</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Rejecting entry for <strong>{rejectTarget.employee_name}</strong> on{" "}
                {format(new Date(rejectTarget.clock_in), "EEE, MMM d")} ·{" "}
                {format(new Date(rejectTarget.clock_in), "h:mm a")} – {format(new Date(rejectTarget.clock_out), "h:mm a")}
              </p>
              <Textarea
                placeholder="Reason for rejection (optional but recommended)…"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && rejectEntry.mutate({ id: rejectTarget.id, note: rejectNote })}
              disabled={rejectEntry.isPending}
            >
              Reject Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
