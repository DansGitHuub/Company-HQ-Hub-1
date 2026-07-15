import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, BarChart2, CheckCircle2, XCircle, AlertTriangle,
  Clock, Calendar, ChevronRight, Loader2, RefreshCw, Route,
} from "lucide-react";
import { format, subDays } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteSummary {
  route_id: string;
  route_name: string;
  cadence: string;
  visits_total: number;
  visits_completed: number;
  visits_missed: number;
  visits_partial: number;
  visits_scheduled: number;
  completion_rate_pct: number | null;
  avg_actual_duration_min: number | null;
  expected_duration_per_visit_min: number;
  total_actual_minutes: number;
  total_stops_hit: number;
  total_stops_planned: number;
}

interface VisitStop {
  id: string;
  route_stop_id: string | null;
  property_id: string | null;
  completed: boolean;
  notes: string | null;
  sequence_order: number | null;
  property_address: string | null;
}

interface VisitHistory {
  id: string;
  visit_date: string;
  status: string;
  completed_at: string | null;
  actual_duration_minutes: number | null;
  stops_completed: number | null;
  stops_total: number | null;
  notes: string | null;
  assigned_crew_id: string | null;
  assigned_crew_name: string | null;
  stop_completions: VisitStop[];
}

interface SummaryResponse {
  routes: RouteSummary[];
  start: string;
  end: string;
}

interface RouteHistoryResponse {
  route: { id: string; name: string; cadence: string; description: string | null };
  visits: VisitHistory[];
  start: string;
  end: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border-green-300",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  partial: {
    label: "Partial",
    className: "bg-amber-100 text-amber-800 border-amber-300",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  missed: {
    label: "Missed",
    className: "bg-red-100 text-red-800 border-red-300",
    icon: <XCircle className="h-3 w-3" />,
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 border-blue-300",
    icon: <Calendar className="h-3 w-3" />,
  },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function completionColor(pct: number | null) {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 90) return "text-green-700 font-semibold";
  if (pct >= 60) return "text-amber-700 font-semibold";
  return "text-red-700 font-semibold";
}

function fmtMin(min: number | null | undefined) {
  if (min == null) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(iso: string) {
  return format(new Date(iso + "T12:00:00"), "EEE, MMM d, yyyy");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MaintenanceReportsPage() {
  const { user } = useAuth();
  if (!user || (user.role !== "Admin" && user.role !== "Manager" && !(user as any).isMasterAdmin)) {
    return <Redirect to="/admin" />;
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [start, setStart] = useState(thirtyDaysAgo);
  const [end, setEnd] = useState(today);
  const [appliedStart, setAppliedStart] = useState(thirtyDaysAgo);
  const [appliedEnd, setAppliedEnd] = useState(today);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  function applyFilter() {
    setAppliedStart(start);
    setAppliedEnd(end);
    setSelectedRouteId(null);
  }

  // ── Summary query ────────────────────────────────────────────────────────
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = useQuery<SummaryResponse>({
    queryKey: ["/api/admin/maintenance-reports/summary", appliedStart, appliedEnd],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/maintenance-reports/summary?start=${appliedStart}&end=${appliedEnd}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60_000,
  });

  // ── Route drill-in query ─────────────────────────────────────────────────
  const {
    data: routeData,
    isLoading: routeLoading,
  } = useQuery<RouteHistoryResponse>({
    queryKey: ["/api/admin/maintenance-reports/route", selectedRouteId, appliedStart, appliedEnd],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/maintenance-reports/route/${selectedRouteId}?start=${appliedStart}&end=${appliedEnd}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!selectedRouteId,
    staleTime: 60_000,
  });

  const selectedRouteName = useMemo(() => {
    if (!selectedRouteId || !summaryData) return "";
    return summaryData.routes.find(r => r.route_id === selectedRouteId)?.route_name ?? "";
  }, [selectedRouteId, summaryData]);

  // ── Overall stats ────────────────────────────────────────────────────────
  const overall = useMemo(() => {
    const routes = summaryData?.routes ?? [];
    const total = routes.reduce((a, r) => a + r.visits_total, 0);
    const completed = routes.reduce((a, r) => a + r.visits_completed, 0);
    const missed = routes.reduce((a, r) => a + r.visits_missed, 0);
    const pct = total ? Math.round(100 * completed / total) : null;
    return { total, completed, missed, pct };
  }, [summaryData]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {selectedRouteId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRouteId(null)}
              data-testid="btn-back-summary"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              All Routes
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" data-testid="maintenance-reports-title">
              <BarChart2 className="h-5 w-5 text-green-600" />
              Maintenance Reporting
              {selectedRouteId && selectedRouteName && (
                <span className="text-base font-normal text-muted-foreground">
                  <ChevronRight className="inline h-4 w-4" /> {selectedRouteName}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedRouteId ? "Per-visit history for this route" : "Completion metrics across all active maintenance routes"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectedRouteId ? null : refetchSummary()}
          disabled={summaryFetching}
          data-testid="btn-refresh-reports"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${summaryFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-40 h-8 text-sm"
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-40 h-8 text-sm"
                data-testid="input-end-date"
              />
            </div>
            <Button size="sm" onClick={applyFilter} data-testid="btn-apply-filter">
              Apply
            </Button>
            <p className="text-xs text-muted-foreground self-center">
              Showing {appliedStart} → {appliedEnd}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── SUMMARY VIEW ─────────────────────────────────────────────────── */}
      {!selectedRouteId && (
        <>
          {/* Overall metric cards */}
          {summaryData && summaryData.routes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card data-testid="stat-total-visits">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Visits</p>
                  <p className="text-2xl font-bold mt-1">{overall.total}</p>
                </CardContent>
              </Card>
              <Card data-testid="stat-completed">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold mt-1 text-green-700">{overall.completed}</p>
                </CardContent>
              </Card>
              <Card data-testid="stat-missed">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Missed</p>
                  <p className="text-2xl font-bold mt-1 text-red-600">{overall.missed}</p>
                </CardContent>
              </Card>
              <Card data-testid="stat-completion-pct">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  <p className={`text-2xl font-bold mt-1 ${completionColor(overall.pct)}`}>
                    {overall.pct !== null ? `${overall.pct}%` : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Summary table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Route className="h-4 w-4 text-green-600" />
                Routes — click any row to drill in
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {summaryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !summaryData || summaryData.routes.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No visits found in this date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route</TableHead>
                        <TableHead>Cadence</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Done</TableHead>
                        <TableHead className="text-center">Partial</TableHead>
                        <TableHead className="text-center">Missed</TableHead>
                        <TableHead className="text-center">Completion %</TableHead>
                        <TableHead className="text-center">Avg Actual</TableHead>
                        <TableHead className="text-center">Expected / Visit</TableHead>
                        <TableHead className="text-center">Stops Hit</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryData.routes.map(r => (
                        <TableRow
                          key={r.route_id}
                          data-testid={`summary-row-${r.route_id}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedRouteId(r.route_id)}
                        >
                          <TableCell className="font-medium">{r.route_name}</TableCell>
                          <TableCell className="capitalize text-muted-foreground text-xs">{r.cadence}</TableCell>
                          <TableCell className="text-center">{r.visits_total}</TableCell>
                          <TableCell className="text-center text-green-700">{r.visits_completed}</TableCell>
                          <TableCell className="text-center text-amber-700">{r.visits_partial}</TableCell>
                          <TableCell className="text-center text-red-600">{r.visits_missed}</TableCell>
                          <TableCell className="text-center">
                            <span className={completionColor(r.completion_rate_pct)}>
                              {r.completion_rate_pct != null ? `${r.completion_rate_pct}%` : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs">{fmtMin(r.avg_actual_duration_min)}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{fmtMin(r.expected_duration_per_visit_min)}</TableCell>
                          <TableCell className="text-center text-xs">
                            {r.total_stops_planned > 0
                              ? `${r.total_stops_hit}/${r.total_stops_planned}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── DRILL-IN: per-visit history ───────────────────────────────────── */}
      {selectedRouteId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              Visit History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {routeLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !routeData || routeData.visits.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No visits found for this route in the selected date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Crew</TableHead>
                      <TableHead className="text-center">Actual Duration</TableHead>
                      <TableHead className="text-center">Stops</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routeData.visits.map(v => (
                      <TableRow key={v.id} data-testid={`visit-row-${v.id}`}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {fmtDate(v.visit_date)}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={v.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.assigned_crew_name || "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {fmtMin(v.actual_duration_minutes)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {v.stops_total != null
                            ? `${v.stops_completed ?? 0}/${v.stops_total}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {v.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Per-stop detail for selected visits that have stop completions */}
            {routeData && routeData.visits.some(v => v.stop_completions.length > 0) && (
              <div className="border-t px-4 py-4 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Stop-Level Detail (visits with completion data)
                </h3>
                {routeData.visits
                  .filter(v => v.stop_completions.length > 0)
                  .map(v => (
                    <div key={v.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{fmtDate(v.visit_date)}</span>
                        <StatusPill status={v.status} />
                      </div>
                      <div className="ml-2 space-y-1">
                        {v.stop_completions.map((sc, i) => (
                          <div key={sc.id ?? i} className="flex items-center gap-2 text-xs">
                            {sc.completed
                              ? <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                              : <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                            <span className={sc.completed ? "text-foreground" : "text-muted-foreground line-through"}>
                              {sc.property_address || `Stop ${(sc.sequence_order ?? i) + 1}`}
                            </span>
                            {sc.notes && (
                              <span className="text-muted-foreground">— {sc.notes}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
