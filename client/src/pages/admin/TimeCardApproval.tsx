import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, CheckCircle2, XCircle, Clock, RotateCcw, ChevronDown, ChevronRight, Pencil,
} from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  user_id: string;
  employee_name: string | null;
  username: string;
  job_id: string | null;
  job_title: string | null;
  job_address: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  entry_type: string;
  work_area_name: string | null;
  notes: string | null;
  approval_status: string;
  rejection_note: string | null;
}

interface Employee { id: string; name: string | null; username: string; }

interface ApprovalData {
  entries: TimeEntry[];
  employees: Employee[];
  counts: { pending: number; approved: number; rejected: number };
  summary: { totalEntries: number; totalHours: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<string, string> = {
  billable: "Billable", drive_time: "Drive", shop_time: "Shop", break: "Break",
};
const ENTRY_TYPE_COLORS: Record<string, string> = {
  billable: "bg-green-100 text-green-700", drive_time: "bg-blue-100 text-blue-700",
  shop_time: "bg-purple-100 text-purple-700", break: "bg-gray-100 text-gray-600",
};
const STATUS_CFG: Record<string, { label: string; pill: string }> = {
  pending:  { label: "Pending", pill: "bg-yellow-100 text-yellow-700 border border-yellow-300" },
  approved: { label: "Approved",  pill: "bg-green-100 text-green-700 border border-green-300" },
  rejected: { label: "Rejected", pill: "bg-red-100 text-red-700 border border-red-300" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDur(mins: number | null, ci: string, co: string | null) {
  let m = mins;
  if (!m && ci && co) m = Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 60000);
  if (!m || m < 0) return "—";
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDate(iso: string) {
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}
function fmtTime(iso: string) {
  try { return format(parseISO(iso), "h:mm a"); } catch { return iso; }
}
function defaultRange() {
  const now = new Date();
  return {
    startDate: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    endDate:   format(endOfWeek(now,   { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimeCardApproval() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdmin =
    (user as any)?.role === "Admin" ||
    (user as any)?.role === "Manager" ||
    (user as any)?.isMasterAdmin;

  const def = defaultRange();
  const [startDate,    setStartDate]    = useState(def.startDate);
  const [endDate,      setEndDate]      = useState(def.endDate);
  const [employeeId,   setEmployeeId]   = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [collapsed,    setCollapsed]    = useState<Record<string, boolean>>({});
  const [loadingIds,   setLoadingIds]   = useState<Set<string>>(new Set());

  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean; ids: string[]; note: string; isBulk: boolean;
  }>({ open: false, ids: [], note: "", isBulk: false });

  // Edit punch dialog state
  const [editDialog, setEditDialog] = useState<{
    open: boolean; entry: TimeEntry | null;
    clockIn: string; clockOut: string; notes: string; entryType: string;
  }>({ open: false, entry: null, clockIn: "", clockOut: "", notes: "", entryType: "billable" });
  const [editSaving, setEditSaving] = useState(false);

  // Build query key & params (status filter passed to server)
  const qKey = ["/api/admin/time-card-approval", startDate, endDate, employeeId, statusFilter];

  const { data, isLoading, error, refetch } = useQuery<ApprovalData>({
    queryKey: qKey,
    queryFn: () => {
      const p = new URLSearchParams({ startDate, endDate });
      if (employeeId !== "all") p.set("employeeId", employeeId);
      if (statusFilter !== "all") p.set("status", statusFilter);
      return apiRequest("GET", `/api/admin/time-card-approval?${p}`).then((r) => r.json());
    },
    enabled: isAdmin,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; label: string; entries: TimeEntry[]; totalMins: number }>();
    for (const e of data?.entries ?? []) {
      if (!map.has(e.user_id))
        map.set(e.user_id, { key: e.user_id, label: e.employee_name || e.username, entries: [], totalMins: 0 });
      const g = map.get(e.user_id)!;
      g.entries.push(e);
      g.totalMins += Number(e.duration_minutes) || 0;
    }
    return Array.from(map.values());
  }, [data?.entries]);

  const counts = data?.counts ?? { pending: 0, approved: 0, rejected: 0 };

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const setLoading = (ids: string[], on: boolean) =>
    setLoadingIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  async function updateOne(id: string, status: string, rejection_note?: string) {
    setLoading([id], true);
    try {
      await apiRequest("PATCH", `/api/admin/time-entries/${id}/approval`, {
        status, rejection_note: rejection_note ?? null,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/time-card-approval"] });
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    } finally {
      setLoading([id], false);
    }
  }

  async function bulkUpdate(ids: string[], status: string, rejection_note?: string) {
    if (ids.length === 0) return;
    setLoading(ids, true);
    try {
      await apiRequest("POST", "/api/admin/time-entries/bulk-approval", {
        ids, status, rejection_note: rejection_note ?? null,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/time-card-approval"] });
      setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
      toast({ title: status === "approved" ? "Approved" : "Rejected", description: `${ids.length} entry(ies) updated.` });
    } catch {
      toast({ title: "Error", description: "Could not update.", variant: "destructive" });
    } finally {
      setLoading(ids, false);
    }
  }

  function openRejectDialog(ids: string[], isBulk: boolean) {
    setRejectDialog({ open: true, ids, note: "", isBulk });
  }

  function confirmReject() {
    const { ids, note, isBulk } = rejectDialog;
    if (isBulk) bulkUpdate(ids, "rejected", note || undefined);
    else        updateOne(ids[0], "rejected", note || undefined);
    setRejectDialog((d) => ({ ...d, open: false }));
  }

  // ─── Edit punch helpers ──────────────────────────────────────────────────────

  function toDatetimeLocal(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openEditDialog(entry: TimeEntry) {
    setEditDialog({
      open: true,
      entry,
      clockIn:   toDatetimeLocal(entry.clock_in),
      clockOut:  entry.clock_out ? toDatetimeLocal(entry.clock_out) : "",
      notes:     entry.notes ?? "",
      entryType: entry.entry_type ?? "billable",
    });
  }

  async function submitEdit() {
    if (!editDialog.entry) return;
    if (!editDialog.clockIn) {
      toast({ title: "Clock-in required", variant: "destructive" }); return;
    }
    const cin  = new Date(editDialog.clockIn);
    const cout = editDialog.clockOut ? new Date(editDialog.clockOut) : null;
    if (cout && cout <= cin) {
      toast({ title: "Clock-out must be after clock-in", variant: "destructive" }); return;
    }
    setEditSaving(true);
    try {
      await apiRequest("PATCH", `/api/admin/time-entries/${editDialog.entry.id}`, {
        clock_in:   cin.toISOString(),
        clock_out:  cout ? cout.toISOString() : null,
        notes:      editDialog.notes || null,
        entry_type: editDialog.entryType,
      });
      toast({ title: "Punch corrected", description: "Time entry updated and logged." });
      qc.invalidateQueries({ queryKey: ["/api/admin/time-card-approval"] });
      setEditDialog((d) => ({ ...d, open: false }));
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Could not save.", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  // ─── Selection helpers ───────────────────────────────────────────────────────

  const toggleEntry = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleGroup = (entries: TimeEntry[]) => {
    const ids = entries.map((e) => e.id);
    const allIn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      allIn ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id));
      return n;
    });
  };

  const selectedArr = Array.from(selected);

  if (!isAdmin)
    return <div className="flex items-center justify-center h-screen text-gray-500">Acceso denegado.</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            Time Card Approval
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Approve or reject employee time entries
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start">From</Label>
              <Input id="start" type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} data-testid="input-start-date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">To</Label>
              <Input id="end" type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)} data-testid="input-end-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {data?.employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} data-testid={`option-emp-${emp.id}`}>
                      {emp.name || emp.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
                  <SelectItem value="approved">Approved ({counts.approved})</SelectItem>
                  <SelectItem value="rejected">Rejected ({counts.rejected})</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Status summary pills ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
          <Clock className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-semibold text-yellow-700" data-testid="count-pending">
            {counts.pending} pending
          </span>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-700" data-testid="count-approved">
            {counts.approved} approved
          </span>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-red-600" data-testid="count-rejected">
            {counts.rejected} rejected
          </span>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedArr.length > 0 && (
        <div className="sticky top-4 z-10 flex items-center justify-between bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">
            {selectedArr.length} entry(ies) seleccionada(s)
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => bulkUpdate(selectedArr, "approved")}
              data-testid="button-bulk-approve">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Approve all
            </Button>
            <Button size="sm" variant="destructive"
              onClick={() => openRejectDialog(selectedArr, true)}
              data-testid="button-bulk-reject">
              <XCircle className="w-4 h-4 mr-1.5" />
              Reject all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}
              data-testid="button-clear-selection">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <Card><CardContent className="py-10 text-center text-red-500">
          Error al cargar. Intenta de nuevo.
        </CardContent></Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-gray-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">
              {statusFilter === "pending"
                ? "No pending entries for this period."
                : "No entries match the selected filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            const isOpen = !collapsed[group.key];
            const groupIds = group.entries.map((e) => e.id);
            const allGroupSel = groupIds.every((id) => selected.has(id));
            const someGroupSel = groupIds.some((id) => selected.has(id));
            const pendingIds = group.entries.filter((e) => e.approval_status === "pending").map((e) => e.id);
            const totalHrs = (group.totalMins / 60).toFixed(1);

            return (
              <Card key={group.key} data-testid={`group-${group.key}`}>
                <CardHeader className="py-3 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={allGroupSel}
                        onCheckedChange={() => toggleGroup(group.entries)}
                        data-testid={`checkbox-group-${group.key}`}
                        className={someGroupSel && !allGroupSel ? "opacity-50" : ""}
                      />
                      <button className="flex items-center gap-2 min-w-0"
                        onClick={() => setCollapsed((p) => ({ ...p, [group.key]: !p[group.key] }))}>
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                        <span className="font-semibold text-gray-900 truncate"
                          data-testid={`group-name-${group.key}`}>
                          {group.label}
                        </span>
                      </button>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
                      </Badge>
                      {pendingIds.length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 font-semibold shrink-0">
                          {pendingIds.length} pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-green-700 hidden sm:flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />{totalHrs}h
                      </span>
                      <Button size="sm" variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50 text-xs px-2.5"
                        disabled={pendingIds.length === 0}
                        onClick={() => bulkUpdate(pendingIds, "approved")}
                        data-testid={`button-approve-group-${group.key}`}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Approve group
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="px-0 pt-0 pb-2">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="pl-5 w-10"></TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Job</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead>Clock In</TableHead>
                            <TableHead>Clock Out</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notes / Rejection</TableHead>
                            <TableHead className="pr-4 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.entries.map((entry) => {
                            const cfg = STATUS_CFG[entry.approval_status] ?? STATUS_CFG.pending;
                            const busy = loadingIds.has(entry.id);
                            const isSel = selected.has(entry.id);
                            return (
                              <TableRow key={entry.id} data-testid={`row-${entry.id}`}
                                className={isSel ? "bg-blue-50/60" : undefined}>
                                <TableCell className="pl-5">
                                  <Checkbox checked={isSel} onCheckedChange={() => toggleEntry(entry.id)}
                                    data-testid={`checkbox-entry-${entry.id}`} />
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                  {fmtDate(entry.clock_in)}
                                </TableCell>
                                <TableCell className="max-w-[160px]">
                                  <p className="truncate text-sm font-medium text-gray-800">
                                    {entry.job_title || "—"}
                                  </p>
                                  {entry.job_address && (
                                    <p className="truncate text-xs text-gray-400">{entry.job_address}</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                  {entry.work_area_name || "—"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                  {fmtTime(entry.clock_in)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                  {entry.clock_out ? fmtTime(entry.clock_out) : "—"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm font-semibold text-gray-800">
                                  {fmtDur(entry.duration_minutes, entry.clock_in, entry.clock_out)}
                                </TableCell>
                                <TableCell>
                                  <span data-testid={`type-${entry.id}`}
                                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ENTRY_TYPE_COLORS[entry.entry_type] ?? "bg-gray-100 text-gray-600"}`}>
                                    {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span data-testid={`status-${entry.id}`}
                                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cfg.pill}`}>
                                    {cfg.label}
                                  </span>
                                </TableCell>
                                <TableCell className="max-w-[180px]">
                                  {entry.rejection_note ? (
                                    <p className="text-xs text-red-600 italic truncate"
                                      title={entry.rejection_note} data-testid={`rejection-note-${entry.id}`}>
                                      {entry.rejection_note}
                                    </p>
                                  ) : (
                                    <p className="truncate text-sm text-gray-400">{entry.notes || "—"}</p>
                                  )}
                                </TableCell>
                                <TableCell className="pr-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {busy ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                    ) : (
                                      <>
                                        <Button size="sm" variant="outline"
                                          className="h-7 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                                          onClick={() => openEditDialog(entry)}
                                          data-testid={`button-edit-${entry.id}`}>
                                          <Pencil className="w-3.5 h-3.5 mr-1" />
                                          Edit
                                        </Button>
                                        {entry.approval_status !== "approved" && (
                                          <Button size="sm" variant="outline"
                                            className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                            onClick={() => updateOne(entry.id, "approved")}
                                            data-testid={`button-approve-${entry.id}`}>
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                            Approve
                                          </Button>
                                        )}
                                        {entry.approval_status !== "rejected" && (
                                          <Button size="sm" variant="outline"
                                            className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                            onClick={() => openRejectDialog([entry.id], false)}
                                            data-testid={`button-reject-${entry.id}`}>
                                            <XCircle className="w-3.5 h-3.5 mr-1" />
                                            Reject
                                          </Button>
                                        )}
                                        {entry.approval_status !== "pending" && (
                                          <Button size="sm" variant="ghost"
                                            className="h-7 px-2 text-xs text-gray-500"
                                            onClick={() => updateOne(entry.id, "pending")}
                                            data-testid={`button-reset-${entry.id}`}>
                                            <RotateCcw className="w-3 h-3 mr-1" />
                                            Reset
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Reject dialog ── */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject {rejectDialog.isBulk ? `${rejectDialog.ids.length} entries` : "entry"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              You can add an optional rejection note to inform the employee.
            </p>
            <Textarea
              placeholder="Motivo del rechazo (opcional)…"
              value={rejectDialog.note}
              onChange={(e) => setRejectDialog((d) => ({ ...d, note: e.target.value }))}
              rows={3}
              data-testid="input-rejection-note"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialog((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject} data-testid="button-confirm-reject">
              <XCircle className="w-4 h-4 mr-1.5" />
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Punch dialog ── */}
      <Dialog open={editDialog.open} onOpenChange={(o) => setEditDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-lg" data-testid="edit-punch-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Pencil className="w-5 h-5" />
              Correct Punch — {editDialog.entry?.employee_name ?? editDialog.entry?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-clock-in">Clock In</Label>
                <Input
                  id="edit-clock-in"
                  type="datetime-local"
                  value={editDialog.clockIn}
                  onChange={(e) => setEditDialog((d) => ({ ...d, clockIn: e.target.value }))}
                  data-testid="input-edit-clock-in"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-clock-out">
                  Clock Out <span className="text-muted-foreground text-xs">(leave blank if still clocked in)</span>
                </Label>
                <Input
                  id="edit-clock-out"
                  type="datetime-local"
                  value={editDialog.clockOut}
                  onChange={(e) => setEditDialog((d) => ({ ...d, clockOut: e.target.value }))}
                  data-testid="input-edit-clock-out"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Entry Type</Label>
              <Select
                value={editDialog.entryType}
                onValueChange={(v) => setEditDialog((d) => ({ ...d, entryType: v }))}
              >
                <SelectTrigger data-testid="select-edit-entry-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="billable">Billable</SelectItem>
                  <SelectItem value="drive_time">Drive Time</SelectItem>
                  <SelectItem value="shop_time">Shop Time</SelectItem>
                  <SelectItem value="break">Break</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Admin Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="edit-notes"
                placeholder="Reason for correction…"
                value={editDialog.notes}
                onChange={(e) => setEditDialog((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                data-testid="input-edit-notes"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
              This change will be recorded in the audit log with the original and corrected times.
              Approval status will be reset to <strong>Pending</strong> after saving.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialog((d) => ({ ...d, open: false }))} disabled={editSaving}>
              Cancel
            </Button>
            <Button
              onClick={submitEdit}
              disabled={editSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-confirm-edit"
            >
              {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
