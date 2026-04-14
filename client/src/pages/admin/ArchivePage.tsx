import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Archive, Clock, RefreshCw, Search, ChevronDown, ChevronRight } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(mins: number | null): string {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}

// ─── Archive Tab ──────────────────────────────────────────────────────────────

function ArchiveTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState(ninetyDaysAgo());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [preview, setPreview] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  async function handlePreview() {
    setPreview(null);
    setPreviewError(null);
    setPreviewing(true);
    try {
      const r = await apiRequest(
        "GET",
        `/api/archive/preview?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  const archiveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/archive", { startDate, endDate }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Object.assign(new Error(data.error || "Archive failed"), { data });
        return data;
      }),
    onSuccess: (result: any) => {
      toast({ title: `✓ Archived ${result.archived} entries` });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/archive/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/archive/entries"] });
    },
    onError: (err: any) => {
      const employees: string[] = err?.data?.employees ?? [];
      toast({
        title: err.message,
        description: employees.length ? `Still clocked in: ${employees.join(", ")}` : undefined,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          <p className="text-sm text-gray-600">
            Select a date range to move completed time entries into the archive. This frees up
            the active table while keeping all data browsable in the View Archives tab.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Start Date</label>
              <input
                type="date"
                data-testid="archive-start-date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPreview(null); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">End Date</label>
              <input
                type="date"
                data-testid="archive-end-date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPreview(null); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <Button
            onClick={handlePreview}
            disabled={!startDate || !endDate || previewing}
            variant="outline"
            data-testid="preview-button"
            className="gap-2"
          >
            <Search className="w-4 h-4" />
            {previewing ? "Previewing…" : "Preview"}
          </Button>

          {previewError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {previewError}
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div data-testid="preview-result">
              <p className="text-base font-semibold text-amber-900">
                {preview.count.toLocaleString()} {preview.count === 1 ? "entry" : "entries"} covering{" "}
                <span className="font-bold">{preview.totalHours.toFixed(1)} hours</span> from{" "}
                {formatDate(preview.startDate + "T12:00:00")} to {formatDate(preview.endDate + "T12:00:00")} will be archived.
              </p>
              {preview.count === 0 && (
                <p className="text-sm text-amber-700 mt-1">No completed entries found in this range.</p>
              )}
            </div>

            {preview.count > 0 && (
              <>
                <div className="flex items-start gap-2 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>This action cannot be undone.</strong> Entries will be removed from the active
                    time table and moved to the archive.
                  </span>
                </div>
                <Button
                  variant="destructive"
                  data-testid="archive-now-button"
                  disabled={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate()}
                  className="gap-2"
                >
                  <Archive className="w-4 h-4" />
                  {archiveMutation.isPending ? "Archiving…" : `Archive ${preview.count} Entries Now`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── View Archives Tab ────────────────────────────────────────────────────────

function ArchiveHistoryTable() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/archive/history", page],
    queryFn: () =>
      apiRequest("GET", `/api/archive/history?page=${page}&limit=20`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const batches: any[] = data?.batches ?? [];

  function toggleExpand(key: string) {
    setExpanded((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Archive History</h3>
        <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="refresh-history">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="history-table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide w-8" />
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Date Range</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Entries</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Total Hours</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Archived By</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Archived At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    No archive batches yet
                  </td>
                </tr>
              ) : (
                batches.map((batch: any) => {
                  const key = batch.batch_time;
                  const isExpanded = expanded.has(key);
                  return (
                    <tr
                      key={key}
                      data-testid={`history-row-${key}`}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(key)}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(batch.range_start)} – {formatDate(batch.range_end)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 tabular-nums">{batch.entry_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-700 tabular-nums">{batch.total_hours.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-gray-600">{batch.archived_by_name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(batch.batch_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-50">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="history-prev">Previous</Button>
            <span className="text-sm text-gray-500">Page {page} of {data?.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} data-testid="history-next">Next</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function BrowseArchiveTable() {
  const [dateFrom, setDateFrom] = useState(ninetyDaysAgo());
  const [dateTo, setDateTo] = useState(today());
  const [userIdFilter, setUserIdFilter] = useState("all");
  const [page, setPage] = useState(1);

  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: "50" });
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (userIdFilter !== "all") p.set("userId", userIdFilter);
    return p.toString();
  };

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/archive/entries", dateFrom, dateTo, userIdFilter, page],
    queryFn: () =>
      apiRequest("GET", `/api/archive/entries?${buildQuery()}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  // Employees dropdown from history endpoint reuse (just use /api/quickbooks/employees for user list)
  const { data: empData } = useQuery<any>({
    queryKey: ["/api/quickbooks/employees"],
    queryFn: () => apiRequest("GET", "/api/quickbooks/employees").then((r) => r.json()),
    staleTime: 120_000,
  });

  const entries: any[] = data?.entries ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Browse Archived Entries</h3>
        <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="refresh-entries">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            data-testid="browse-date-from"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            data-testid="browse-date-to"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Employee</label>
          <Select value={userIdFilter} onValueChange={(v) => { setUserIdFilter(v); setPage(1); }}>
            <SelectTrigger data-testid="browse-employee-filter" className="w-44 h-9 text-sm">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {(empData?.localUsers ?? []).map((u: any) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="browse-table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Job</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Work Area</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Hours</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">QB</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No archived entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry: any) => (
                  <tr
                    key={`${entry.id}-${entry.archived_at}`}
                    data-testid={`browse-row-${entry.id}`}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{entry.employee_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(entry.clock_in)}
                      <span className="text-gray-400 text-xs ml-1">
                        {new Date(entry.clock_in).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[140px]">
                      {entry.job_title ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]">
                      {entry.work_area_name ?? <span className="text-gray-300 text-xs">{entry.entry_type}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium tabular-nums">
                      {formatDuration(entry.duration_minutes)}
                    </td>
                    <td className="px-4 py-3">
                      {entry.qbo_exported_at ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Exported</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-400">—</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-50">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="browse-prev">Previous</Button>
            <span className="text-sm text-gray-500">Page {page} of {data?.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} data-testid="browse-next">Next</Button>
          </div>
        )}
      </Card>
      <p className="text-xs text-gray-400 text-center">{data?.totalCount ?? 0} total archived entries</p>
    </div>
  );
}

function ViewArchivesTab() {
  return (
    <div className="space-y-8">
      <ArchiveHistoryTable />
      <BrowseArchiveTable />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<"archive" | "view">("archive");

  return (
    <div className="max-w-5xl mx-auto px-4 pb-12 pt-4 space-y-6">
      <div>
        <h1 data-testid="archive-page-title" className="text-2xl font-bold text-gray-900">
          Time Entry Archive
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Archive old completed time entries to keep the active table fast while preserving all data
        </p>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          data-testid="tab-archive"
          onClick={() => setActiveTab("archive")}
          className={[
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "archive"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700",
          ].join(" ")}
        >
          <Archive className="inline w-4 h-4 mr-1.5 -mt-0.5" />
          Archive
        </button>
        <button
          data-testid="tab-view"
          onClick={() => setActiveTab("view")}
          className={[
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "view"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700",
          ].join(" ")}
        >
          <Clock className="inline w-4 h-4 mr-1.5 -mt-0.5" />
          View Archives
        </button>
      </div>

      {activeTab === "archive" ? <ArchiveTab /> : <ViewArchivesTab />}
    </div>
  );
}
