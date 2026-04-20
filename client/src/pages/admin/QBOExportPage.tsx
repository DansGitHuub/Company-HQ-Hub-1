import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Upload,
  Users,
  TriangleAlert,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(mins: number | null): string {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getThirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Status chip ─────────────────────────────────────────────────────────────

function StatusChip({ entry }: { entry: any }) {
  if (entry.qbo_exported_at) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-1">
        <CheckCircle2 className="w-3 h-3" /> Exported
      </Badge>
    );
  }
  if (entry.qbo_export_error) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1" title={entry.qbo_export_error}>
        <AlertCircle className="w-3 h-3" /> Error
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs gap-1">
      <Clock className="w-3 h-3" /> Pending
    </Badge>
  );
}

// ─── Tab: Time Entries ────────────────────────────────────────────────────────

function TimeEntriesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dateFrom, setDateFrom] = useState(getThirtyDaysAgo());
  const [dateTo, setDateTo] = useState(today());
  const [statusFilter, setStatusFilter] = useState("all");
  const [userIdFilter, setUserIdFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: "50" });
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (userIdFilter !== "all") p.set("userId", userIdFilter);
    return p.toString();
  };

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/quickbooks/export-time/entries", dateFrom, dateTo, statusFilter, userIdFilter, page],
    queryFn: () =>
      apiRequest("GET", `/api/quickbooks/export-time/entries?${buildQuery()}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  // Users dropdown
  const { data: empData } = useQuery<any>({
    queryKey: ["/api/quickbooks/employees"],
    queryFn: () => apiRequest("GET", "/api/quickbooks/employees").then((r) => r.json()),
    staleTime: 120_000,
  });

  const exportMutation = useMutation({
    mutationFn: (entryIds: number[]) =>
      apiRequest("POST", "/api/quickbooks/export-time", { entryIds }).then((r) => r.json()),
    onSuccess: (result: any) => {
      const { exported, failed, errors } = result;
      if (failed > 0) {
        toast({
          title: `Exported ${exported}, failed ${failed}`,
          description: errors.slice(0, 3).join("; "),
          variant: "destructive",
        });
      } else {
        toast({ title: `✓ Exported ${exported} entries to QuickBooks` });
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/export-time/entries"] });
    },
    onError: (err: any) => {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    },
  });

  const entries: any[] = data?.entries ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  const allPageIds = entries.map((e: any) => e.id);
  const allPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allPageSelected) {
      setSelected((s) => { const n = new Set(s); allPageIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); allPageIds.forEach((id) => n.add(id)); return n; });
    }
  }

  function toggleOne(id: number) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const selectedArr = [...selected];
  const exportablePending = selectedArr.filter((id) => {
    const e = entries.find((x: any) => x.id === id);
    return e && !e.qbo_exported_at;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                data-testid="filter-date-from"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); setSelected(new Set()); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                data-testid="filter-date-to"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); setSelected(new Set()); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Employee</label>
              <Select value={userIdFilter} onValueChange={(v) => { setUserIdFilter(v); setPage(1); setSelected(new Set()); }}>
                <SelectTrigger data-testid="filter-employee" className="w-44 h-9 text-sm">
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
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); setSelected(new Set()); }}>
                <SelectTrigger data-testid="filter-status" className="w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="exported">Exported</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} className="mt-5" data-testid="refresh-entries">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
          <span className="text-sm text-green-800 font-medium">
            {selected.size} selected ({exportablePending.length} pending)
          </span>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white ml-auto"
            disabled={exportablePending.length === 0 || exportMutation.isPending}
            onClick={() => exportMutation.mutate(exportablePending)}
            data-testid="export-selected-button"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {exportMutation.isPending ? "Exporting…" : `Export ${exportablePending.length} to QuickBooks`}
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="entries-table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAll}
                    data-testid="select-all-checkbox"
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Job</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Work Area</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Hours</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No time entries found for this filter
                  </td>
                </tr>
              ) : (
                entries.map((entry: any) => (
                  <tr
                    key={entry.id}
                    data-testid={`entry-row-${entry.id}`}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(entry.id)}
                        onChange={() => toggleOne(entry.id)}
                        data-testid={`checkbox-${entry.id}`}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{entry.employee_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(entry.clock_in)}
                      <span className="text-gray-400 text-xs ml-1">{formatTime(entry.clock_in)}</span>
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
                      <StatusChip entry={entry} />
                      {entry.qbo_export_error && (
                        <p className="text-[10px] text-red-500 mt-0.5 max-w-[160px] truncate" title={entry.qbo_export_error}>
                          {entry.qbo_export_error}
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-50">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="pagination-prev">
              Previous
            </Button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="pagination-next">
              Next
            </Button>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400 text-center">
        {data?.totalCount ?? 0} total entries · Select pending entries and click "Export to QuickBooks"
      </p>
    </div>
  );
}

// ─── Tab: Employee Mapping ────────────────────────────────────────────────────

function EmployeeMappingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/quickbooks/employees"],
    queryFn: () => apiRequest("GET", "/api/quickbooks/employees").then((r) => r.json()),
    staleTime: 60_000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ userId, qboEmployeeId }: { userId: string; qboEmployeeId: string | null }) =>
      apiRequest("PATCH", `/api/quickbooks/employees/${userId}`, { qboEmployeeId }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Employee mapping saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/employees"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const localUsers: any[] = data?.localUsers ?? [];
  const qbEmployees: any[] = data?.qbEmployees ?? [];
  const noQbConnection = localUsers.length > 0 && qbEmployees.length === 0;

  return (
    <div className="space-y-4">
      {noQbConnection && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">
          <TriangleAlert className="w-4 h-4 shrink-0" />
          QuickBooks is not connected or has no employees — employee dropdowns will be empty. Connect QuickBooks in Settings first.
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Map each employee to their matching QuickBooks Employee record so time entries can be exported.
        </p>
        <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="refresh-mapping">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="mapping-table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Pending Entries</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">QuickBooks Employee</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : localUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400">No employees found</td>
                </tr>
              ) : (
                localUsers.map((user: any) => {
                  const hasPending = user.pendingCount > 0;
                  const unmapped = !user.qbo_employee_id;
                  const showWarning = hasPending && unmapped;

                  return (
                    <tr
                      key={user.id}
                      data-testid={`mapping-row-${user.id}`}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.username}
                          </p>
                          {user.email && (
                            <p className="text-xs text-gray-400">{user.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {showWarning ? (
                          <div className="flex items-center gap-1.5 text-amber-600">
                            <TriangleAlert className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold">{user.pendingCount} pending</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{user.pendingCount || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <Select
                          value={user.qbo_employee_id ?? "__none__"}
                          onValueChange={(val) =>
                            patchMutation.mutate({
                              userId: String(user.id),
                              qboEmployeeId: val === "__none__" ? null : val,
                            })
                          }
                        >
                          <SelectTrigger
                            data-testid={`qb-employee-select-${user.id}`}
                            className={`h-8 text-sm ${showWarning ? "border-amber-300" : ""}`}
                          >
                            <SelectValue placeholder="Not mapped" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not mapped</SelectItem>
                            {qbEmployees.map((emp: any) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QBOExportPage() {
  const [activeTab, setActiveTab] = useState<"entries" | "mapping">("entries");

  return (
    <div className="max-w-5xl mx-auto px-4 pb-12 pt-4 space-y-6">
      {/* Header */}
      <div>
        <h1 data-testid="qbo-export-title" className="text-2xl font-bold text-gray-900">
          QuickBooks Time Export
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Review and export completed time entries to QuickBooks Online for payroll
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          data-testid="tab-entries"
          onClick={() => setActiveTab("entries")}
          className={[
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "entries"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700",
          ].join(" ")}
        >
          <Clock className="inline w-4 h-4 mr-1.5 -mt-0.5" />
          Time Entries
        </button>
        <button
          data-testid="tab-mapping"
          onClick={() => setActiveTab("mapping")}
          className={[
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "mapping"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700",
          ].join(" ")}
        >
          <Users className="inline w-4 h-4 mr-1.5 -mt-0.5" />
          Employee Mapping
        </button>
      </div>

      {activeTab === "entries" ? <TimeEntriesTab /> : <EmployeeMappingTab />}
    </div>
  );
}
