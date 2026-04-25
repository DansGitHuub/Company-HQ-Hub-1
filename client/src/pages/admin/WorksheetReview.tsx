import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  ClipboardList,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface WorksheetEntry {
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
  auto_clocked_out: boolean;
}

interface Employee { id: string; name: string | null; username: string; }

interface ReviewData {
  entries: WorksheetEntry[];
  employees: Employee[];
  summary: {
    totalEntries: number;
    totalHours: string;
    uniqueEmployees: number;
    uniqueDays: number;
  };
}

interface Job { id: string; title: string; }

const ENTRY_TYPE_LABELS: Record<string, string> = {
  billable:   "Billable",
  drive_time: "Drive",
  shop_time:  "Shop",
  break:      "Break",
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  billable:   "bg-green-100 text-green-700",
  drive_time: "bg-blue-100 text-blue-700",
  shop_time:  "bg-purple-100 text-purple-700",
  break:      "bg-gray-100 text-gray-600",
};

const APPROVAL_CONFIG: Record<string, { label: string; className: string }> = {
  pending:  { label: "Pending", className: "bg-yellow-100 text-yellow-700 border border-yellow-300" },
  approved: { label: "Approved",  className: "bg-green-100 text-green-700 border border-green-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border border-red-300" },
};

function formatDuration(minutes: number | null, clockIn: string, clockOut: string | null): string {
  let mins = minutes;
  if (!mins && clockIn && clockOut) {
    mins = Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
  }
  if (!mins || mins < 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}
function fmtTime(iso: string) {
  try { return format(parseISO(iso), "h:mm a"); } catch { return iso; }
}

function toLocalDatetimeValue(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

function defaultRange() {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end   = endOfWeek(now,   { weekStartsOn: 1 });
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate:   format(end,   "yyyy-MM-dd"),
  };
}

type GroupMode = "employee" | "date";

interface EditState {
  id: string;
  clock_in: string;
  clock_out: string;
  job_id: string;
  work_area_name: string;
  notes: string;
  entry_type: string;
}

export default function WorksheetReview() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = (user as any)?.role === "Admin" || (user as any)?.role === "Manager" || (user as any)?.isMasterAdmin;

  const defaults = defaultRange();
  const [startDate,  setStartDate]  = useState(defaults.startDate);
  const [endDate,    setEndDate]    = useState(defaults.endDate);
  const [employeeId, setEmployeeId] = useState("all");
  const [groupMode,  setGroupMode]  = useState<GroupMode>("employee");
  const [collapsed,  setCollapsed]  = useState<Record<string, boolean>>({});
  const [editEntry,  setEditEntry]  = useState<EditState | null>(null);

  const queryParams = new URLSearchParams({
    startDate,
    endDate,
    ...(employeeId !== "all" ? { employeeId } : {}),
  }).toString();

  const { data, isLoading, error, refetch } = useQuery<ReviewData>({
    queryKey: ["/api/admin/worksheet-review", queryParams],
    queryFn: () =>
      apiRequest("GET", `/api/admin/worksheet-review?${queryParams}`).then((r) => r.json()),
    enabled: isAdmin,
  });

  const { data: jobsData } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs").then((r) => r.json()),
    enabled: isAdmin,
  });

  const editMutation = useMutation({
    mutationFn: (payload: EditState) =>
      apiRequest("PATCH", `/api/admin/time-entries/${payload.id}`, {
        clock_in:       payload.clock_in,
        clock_out:      payload.clock_out || null,
        job_id:         payload.job_id === "__none__" ? null : payload.job_id || null,
        work_area_name: payload.work_area_name || null,
        notes:          payload.notes || null,
        entry_type:     payload.entry_type || null,
      }).then((r) => {
        if (!r.ok) return r.json().then((e: any) => Promise.reject(new Error(e.message)));
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Entry updated", description: "Time entry saved successfully." });
      setEditEntry(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/worksheet-review"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const grouped = useMemo(() => {
    if (!data?.entries) return [];
    const map = new Map<string, { key: string; label: string; entries: WorksheetEntry[]; totalMins: number }>();
    for (const e of data.entries) {
      const key =
        groupMode === "employee"
          ? e.user_id
          : new Date(e.clock_in).toISOString().split("T")[0];
      const label =
        groupMode === "employee"
          ? (e.employee_name || e.username)
          : fmtDate(e.clock_in);
      if (!map.has(key)) map.set(key, { key, label, entries: [], totalMins: 0 });
      const g = map.get(key)!;
      g.entries.push(e);
      g.totalMins += Number(e.duration_minutes) || 0;
    }
    return Array.from(map.values());
  }, [data?.entries, groupMode]);

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  function openEdit(entry: WorksheetEntry) {
    setEditEntry({
      id:             entry.id,
      clock_in:       toLocalDatetimeValue(entry.clock_in),
      clock_out:      entry.clock_out ? toLocalDatetimeValue(entry.clock_out) : "",
      job_id:         entry.job_id ?? "__none__",
      work_area_name: entry.work_area_name ?? "",
      notes:          entry.notes ?? "",
      entry_type:     entry.entry_type ?? "billable",
    });
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Access denied.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-green-600" />
            Worksheet Review
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Vista admin de entradas por empleado y fecha
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="filter-start">Desde</Label>
              <Input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-end">Hasta</Label>
              <Input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {data?.employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} data-testid={`option-employee-${emp.id}`}>
                      {emp.name || emp.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Agrupar por</Label>
              <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
                <SelectTrigger data-testid="select-group-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="date">Fecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Entradas</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5" data-testid="stat-total-entries">
                {data.summary.totalEntries}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Horas totales</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5" data-testid="stat-total-hours">
                {data.summary.totalHours}h
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Empleados</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5" data-testid="stat-employees">
                {data.summary.uniqueEmployees}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Days</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5" data-testid="stat-days">
                {data.summary.uniqueDays}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-500">
            Error al cargar los datos. Intenta de nuevo.
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No hay entradas para el rango seleccionado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            const isOpen = !collapsed[group.key];
            const totalHrs = (group.totalMins / 60).toFixed(1);
            return (
              <Card key={group.key} data-testid={`group-${group.key}`}>
                <CardHeader
                  className="cursor-pointer select-none py-3 px-5"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="font-semibold text-gray-900" data-testid={`group-label-${group.key}`}>
                        {group.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {group.entries.length} {group.entries.length === 1 ? "entrada" : "entradas"}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold text-green-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {totalHrs}h
                    </span>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="px-0 pt-0 pb-2">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            {groupMode === "date" && (
                              <TableHead className="pl-5">Employee</TableHead>
                            )}
                            {groupMode === "employee" && (
                              <TableHead className="pl-5">Fecha</TableHead>
                            )}
                            <TableHead>Trabajo</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>Salida</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="pr-2">Notas</TableHead>
                            <TableHead className="pr-5 w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.entries.map((entry) => {
                            const statusCfg = APPROVAL_CONFIG[entry.approval_status] ?? APPROVAL_CONFIG.pending;
                            return (
                              <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                                {groupMode === "date" && (
                                  <TableCell className="pl-5 font-medium text-gray-800">
                                    {entry.employee_name || entry.username}
                                  </TableCell>
                                )}
                                {groupMode === "employee" && (
                                  <TableCell className="pl-5 text-gray-600 whitespace-nowrap">
                                    {fmtDate(entry.clock_in)}
                                  </TableCell>
                                )}
                                <TableCell className="max-w-[180px]">
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
                                  <span>{formatDuration(entry.duration_minutes, entry.clock_in, entry.clock_out)}</span>
                                  {entry.auto_clocked_out && (
                                    <span
                                      className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium align-middle"
                                      data-testid={`badge-auto-${entry.id}`}
                                      title="Auto clocked out"
                                    >
                                      Auto
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                      ENTRY_TYPE_COLORS[entry.entry_type] ?? "bg-gray-100 text-gray-600"
                                    }`}
                                    data-testid={`type-badge-${entry.id}`}
                                  >
                                    {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.className}`}
                                    data-testid={`status-badge-${entry.id}`}
                                  >
                                    {statusCfg.label}
                                  </span>
                                </TableCell>
                                <TableCell className="pr-2 max-w-[180px]">
                                  <p className="truncate text-sm text-gray-500">{entry.notes || "—"}</p>
                                </TableCell>
                                <TableCell className="pr-5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-gray-400 hover:text-gray-700"
                                    onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                                    data-testid={`button-edit-entry-${entry.id}`}
                                    title="Edit entry"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
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

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-edit-entry">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>

          {editEntry && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-clock-in">Clock In</Label>
                  <Input
                    id="edit-clock-in"
                    type="datetime-local"
                    value={editEntry.clock_in}
                    onChange={(e) => setEditEntry((s) => s && { ...s, clock_in: e.target.value })}
                    data-testid="input-edit-clock-in"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-clock-out">Clock Out</Label>
                  <Input
                    id="edit-clock-out"
                    type="datetime-local"
                    value={editEntry.clock_out}
                    onChange={(e) => setEditEntry((s) => s && { ...s, clock_out: e.target.value })}
                    data-testid="input-edit-clock-out"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Job</Label>
                <Select
                  value={editEntry.job_id}
                  onValueChange={(v) => setEditEntry((s) => s && { ...s, job_id: v })}
                >
                  <SelectTrigger data-testid="select-edit-job">
                    <SelectValue placeholder="No job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No job —</SelectItem>
                    {(jobsData ?? []).map((j) => (
                      <SelectItem key={j.id} value={j.id} data-testid={`option-job-${j.id}`}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Entry Type</Label>
                  <Select
                    value={editEntry.entry_type}
                    onValueChange={(v) => setEditEntry((s) => s && { ...s, entry_type: v })}
                  >
                    <SelectTrigger data-testid="select-edit-type">
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
                  <Label htmlFor="edit-area">Work Area</Label>
                  <Input
                    id="edit-area"
                    value={editEntry.work_area_name}
                    onChange={(e) => setEditEntry((s) => s && { ...s, work_area_name: e.target.value })}
                    placeholder="e.g. Front yard"
                    data-testid="input-edit-area"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  rows={3}
                  value={editEntry.notes}
                  onChange={(e) => setEditEntry((s) => s && { ...s, notes: e.target.value })}
                  placeholder="Optional notes…"
                  data-testid="input-edit-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditEntry(null)}
              data-testid="button-edit-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => editEntry && editMutation.mutate(editEntry)}
              disabled={editMutation.isPending || !editEntry?.clock_in}
              data-testid="button-edit-save"
            >
              {editMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
              ) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
