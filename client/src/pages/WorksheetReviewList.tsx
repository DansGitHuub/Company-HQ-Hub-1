import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ClipboardList, Download, MapPin, AlertTriangle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorksheetSummary {
  id: string;
  date: string;
  status: string;
  employee_name: string | null;
  employee_username: string;
  job_name: string | null;
  materials_total: string | number;
  expenses_total: string | number;
  checklist_work_order_changed: boolean;
  checklist_materials_needed: boolean;
  checklist_change_order_needed: boolean;
  checklist_issue_reported: boolean;
}

interface SkippedStop {
  title: string;
  skip_reason: string | null;
  customer_name: string | null;
}

interface RouteDayReview {
  id: string;
  date: string;
  weather: string[];
  summary_notes: string | null;
  status: string;
  employee_name: string;
  total_minutes: number;
  completed_count: number;
  skipped_stops: SkippedStop[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:     "secondary",
  submitted: "default",
  approved:  "outline",
};

function statusBadgeVariant(status: string) {
  return (STATUS_COLORS[status] ?? "secondary") as any;
}

function fmt(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n) || n === 0) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const WEATHER_ICON: Record<string, string> = {
  sunny: "☀️", cloudy: "☁️", rainy: "🌧️", stormy: "⛈️",
  windy: "💨", snowy: "❄️", foggy: "🌫️", hail: "🌨️",
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WorksheetReviewList() {
  const [, navigate] = useLocation();
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin =
    (user as any)?.role === "Admin" ||
    (user as any)?.role === "Manager" ||
    (user as any)?.isMasterAdmin;

  // ── Daily worksheets query ─────────────────────────────────────────────────
  const { data: worksheets = [], isLoading, error } = useQuery<WorksheetSummary[]>({
    queryKey: ["/api/worksheets"],
    queryFn: () => apiRequest("GET", "/api/worksheets").then((r) => r.json()),
  });

  const submitted = worksheets.filter((w) => w.status === "submitted");
  const others    = worksheets.filter((w) => w.status !== "submitted");
  const sorted    = [...submitted, ...others];

  // ── Route-day review state & queries ──────────────────────────────────────
  const [routeDayStatus, setRouteDayStatus] = useState<"submitted" | "approved" | "rejected">("submitted");

  const { data: routeDays = [], isLoading: routeDaysLoading } = useQuery<RouteDayReview[]>({
    queryKey: ["/api/admin/route-days", routeDayStatus],
    queryFn: () => apiRequest("GET", `/api/admin/route-days?status=${routeDayStatus}`).then((r) => r.json()),
    enabled: isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/route-days/${id}/approve`).then((r) => {
        if (!r.ok) return r.json().then((e: any) => Promise.reject(new Error(e.error)));
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Route day approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/route-days"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/route-days/${id}/reject`).then((r) => {
        if (!r.ok) return r.json().then((e: any) => Promise.reject(new Error(e.error)));
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Route day rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/route-days"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to reject", description: err.message, variant: "destructive" });
    },
  });

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/worksheets/export?status=approved,submitted", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `worksheets-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Worksheet Review</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve submitted daily worksheets from field staff.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-export-csv"
          onClick={handleExport}
          disabled={exporting}
          className="gap-2 shrink-0"
        >
          {exporting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      {/* ── Route Day Submissions (admin/manager only) ────────────────────── */}
      {isAdmin && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                Route Day Submissions
              </h2>
              <div className="flex gap-1.5">
                {(["submitted", "approved", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setRouteDayStatus(s)}
                    data-testid={`btn-route-status-${s}`}
                    className={[
                      "px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors",
                      routeDayStatus === s
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {routeDaysLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!routeDaysLoading && routeDays.length === 0 && (
              <p
                className="text-sm text-gray-500 text-center py-6"
                data-testid="text-route-days-empty"
              >
                No route days yet.
              </p>
            )}

            {!routeDaysLoading && routeDays.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {routeDays.map((rd) => (
                  <div
                    key={rd.id}
                    data-testid={`card-route-day-${rd.id}`}
                    className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm" data-testid={`text-rd-employee-${rd.id}`}>
                          {rd.employee_name}
                        </p>
                        <p className="text-xs text-gray-500" data-testid={`text-rd-date-${rd.id}`}>
                          {fmtDate(rd.date)}
                        </p>
                      </div>
                      {/* Weather chips */}
                      {rd.weather.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {rd.weather.map((w) => (
                            <span key={w} className="text-xs bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                              {WEATHER_ICON[w] ?? ""} {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span data-testid={`text-rd-minutes-${rd.id}`}>
                        🕐 {formatMinutes(rd.total_minutes)}
                      </span>
                      <span data-testid={`text-rd-completed-${rd.id}`}>
                        ✅ {rd.completed_count} completed
                      </span>
                      {rd.skipped_stops.length > 0 && (
                        <span className="text-amber-600" data-testid={`text-rd-skipped-${rd.id}`}>
                          ⏭️ {rd.skipped_stops.length} skipped
                        </span>
                      )}
                    </div>

                    {/* Skipped stops detail */}
                    {rd.skipped_stops.length > 0 && (
                      <div className="bg-amber-50 rounded p-2 space-y-1">
                        {rd.skipped_stops.map((s, i) => (
                          <div key={i} className="text-xs text-amber-800">
                            <span className="font-medium">{s.title}</span>
                            {s.customer_name && <span className="text-amber-600"> · {s.customer_name}</span>}
                            {s.skip_reason && <span className="block text-amber-600 pl-2">— {s.skip_reason}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Summary notes */}
                    {rd.summary_notes && (
                      <div
                        className="text-xs text-gray-600 border-t pt-2 prose prose-xs max-w-none line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: rd.summary_notes }}
                        data-testid={`text-rd-notes-${rd.id}`}
                      />
                    )}

                    {/* Detail link + Actions */}
                    <div className="mt-1 border-t pt-2 flex flex-col gap-2">
                      <Link
                        href={`/admin/route-days/${rd.id}`}
                        className="text-xs text-green-700 hover:underline self-start"
                        data-testid={`link-rd-detail-${rd.id}`}
                      >
                        View details →
                      </Link>
                      {routeDayStatus === "submitted" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                            onClick={() => approveMutation.mutate(rd.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`btn-approve-rd-${rd.id}`}
                          >
                            {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs"
                            onClick={() => rejectMutation.mutate(rd.id)}
                            disabled={rejectMutation.isPending}
                            data-testid={`btn-reject-rd-${rd.id}`}
                          >
                            {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary counts */}
      <div className="flex gap-3 flex-wrap">
        {(["submitted", "approved", "draft"] as const).map((s) => {
          const count = worksheets.filter((w) => w.status === s).length;
          return (
            <Card key={s} className="flex-1 min-w-[120px]" data-testid={`stat-${s}`}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{s}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card data-testid="card-worksheet-list">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Worksheets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-destructive py-10">
              Failed to load worksheets.
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              No worksheets found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Job / Area</TableHead>
                  <TableHead className="text-right">Materials $</TableHead>
                  <TableHead className="text-right">Expenses $</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((w) => {
                  const flags = [
                    w.checklist_work_order_changed  && { label: "WO Changed",    color: "bg-amber-100 text-amber-800 border-amber-300" },
                    w.checklist_materials_needed     && { label: "Materials",     color: "bg-blue-100 text-blue-800 border-blue-300"   },
                    w.checklist_change_order_needed  && { label: "Change Order",  color: "bg-purple-100 text-purple-800 border-purple-300" },
                    w.checklist_issue_reported       && { label: "Field Issue",   color: "bg-red-100 text-red-800 border-red-300"      },
                  ].filter(Boolean) as { label: string; color: string }[];

                  return (
                  <TableRow
                    key={w.id}
                    data-testid={`row-worksheet-${w.id}`}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/worksheet-review/${w.id}`)}
                  >
                    <TableCell className="font-medium">
                      {w.employee_name ?? w.employee_username}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {fmtDate(w.date)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {w.job_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(w.materials_total)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(w.expenses_total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(w.status)} className="capitalize">
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {flags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1" data-testid={`flags-${w.id}`}>
                          {flags.map((f) => (
                            <span
                              key={f.label}
                              className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded border ${f.color}`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {f.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
