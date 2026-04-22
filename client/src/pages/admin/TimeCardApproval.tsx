import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
} from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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
}

interface Employee { id: string; name: string | null; username: string; }

interface ReviewData {
  entries: TimeEntry[];
  employees: Employee[];
  summary: {
    totalEntries: number;
    totalHours: string;
    uniqueEmployees: number;
    uniqueDays: number;
  };
}

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

const STATUS_CFG: Record<string, { label: string; pill: string }> = {
  pending:  { label: "Pendiente", pill: "bg-yellow-100 text-yellow-700 border border-yellow-300" },
  approved: { label: "Aprobado",  pill: "bg-green-100 text-green-700 border border-green-300" },
  rejected: { label: "Rechazado", pill: "bg-red-100 text-red-700 border border-red-300" },
};

function fmtDur(minutes: number | null, clockIn: string, clockOut: string | null) {
  let m = minutes;
  if (!m && clockIn && clockOut)
    m = Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
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

type StatusFilter = "pending" | "all" | "approved" | "rejected";

export default function TimeCardApproval() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdmin =
    (user as any)?.role === "Admin" ||
    (user as any)?.role === "Manager" ||
    (user as any)?.isMasterAdmin;

  const def = defaultRange();
  const [startDate,     setStartDate]     = useState(def.startDate);
  const [endDate,       setEndDate]       = useState(def.endDate);
  const [employeeId,    setEmployeeId]    = useState("all");
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("pending");
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [collapsed,     setCollapsed]     = useState<Record<string, boolean>>({});
  const [loadingIds,    setLoadingIds]    = useState<Set<string>>(new Set());

  const qKey = ["/api/admin/worksheet-review", startDate, endDate, employeeId];

  const { data, isLoading, error, refetch } = useQuery<ReviewData>({
    queryKey: qKey,
    queryFn: () => {
      const p = new URLSearchParams({ startDate, endDate });
      if (employeeId !== "all") p.set("employeeId", employeeId);
      return apiRequest("GET", `/api/admin/worksheet-review?${p}`).then((r) => r.json());
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!data?.entries) return [];
    if (statusFilter === "all") return data.entries;
    return data.entries.filter((e) => e.approval_status === statusFilter);
  }, [data?.entries, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; label: string; entries: TimeEntry[]; totalMins: number }>();
    for (const e of filtered) {
      if (!map.has(e.user_id)) map.set(e.user_id, { key: e.user_id, label: e.employee_name || e.username, entries: [], totalMins: 0 });
      const g = map.get(e.user_id)!;
      g.entries.push(e);
      g.totalMins += Number(e.duration_minutes) || 0;
    }
    return Array.from(map.values());
  }, [filtered]);

  const counts = useMemo(() => {
    const all = data?.entries ?? [];
    return {
      pending:  all.filter((e) => e.approval_status === "pending").length,
      approved: all.filter((e) => e.approval_status === "approved").length,
      rejected: all.filter((e) => e.approval_status === "rejected").length,
    };
  }, [data?.entries]);

  const invalidate = () => qc.invalidateQueries({ queryKey: qKey });

  const setLoading = (ids: string[], on: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  async function updateOne(id: string, status: string) {
    setLoading([id], true);
    try {
      await apiRequest("PATCH", `/api/admin/time-entries/${id}/approval`, { status });
      await invalidate();
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    } finally {
      setLoading([id], false);
    }
  }

  async function bulkUpdate(ids: string[], status: string) {
    setLoading(ids, true);
    try {
      await apiRequest("POST", "/api/admin/time-entries/bulk-approval", { ids, status });
      await invalidate();
      setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
      toast({ title: status === "approved" ? "Aprobado" : "Rechazado", description: `${ids.length} entrada(s) actualizadas.` });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
    } finally {
      setLoading(ids, false);
    }
  }

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

  const collapseGroup = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectedArr = Array.from(selected);

  if (!isAdmin) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Acceso denegado.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            Aprobación de Tarjetas de Tiempo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Aprueba o rechaza las entradas de tiempo de los empleados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start">Desde</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-start-date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Hasta</Label>
              <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-end-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Empleado</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {data?.employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} data-testid={`option-emp-${emp.id}`}>
                      {emp.name || emp.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendientes ({counts.pending})</SelectItem>
                  <SelectItem value="approved">Aprobados ({counts.approved})</SelectItem>
                  <SelectItem value="rejected">Rechazados ({counts.rejected})</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
          <Clock className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-semibold text-yellow-700">{counts.pending} pendientes</span>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-700">{counts.approved} aprobados</span>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-red-600">{counts.rejected} rechazados</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedArr.length > 0 && (
        <div className="sticky top-4 z-10 flex items-center justify-between bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">
            {selectedArr.length} entrada(s) seleccionada(s)
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => bulkUpdate(selectedArr, "approved")}
              data-testid="button-bulk-approve"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Aprobar todas
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => bulkUpdate(selectedArr, "rejected")}
              data-testid="button-bulk-reject"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Rechazar todas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} data-testid="button-clear-selection">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <Card><CardContent className="py-10 text-center text-red-500">Error al cargar. Intenta de nuevo.</CardContent></Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-gray-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">
              {statusFilter === "pending"
                ? "No hay entradas pendientes para este período."
                : "No hay entradas para los filtros seleccionados."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            const isOpen = !collapsed[group.key];
            const groupIds = group.entries.map((e) => e.id);
            const allGroupSelected = groupIds.every((id) => selected.has(id));
            const someGroupSelected = groupIds.some((id) => selected.has(id));
            const totalHrs = (group.totalMins / 60).toFixed(1);
            const pendingCount = group.entries.filter((e) => e.approval_status === "pending").length;

            return (
              <Card key={group.key} data-testid={`group-${group.key}`}>
                <CardHeader className="py-3 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={allGroupSelected}
                        onCheckedChange={() => toggleGroup(group.entries)}
                        data-testid={`checkbox-group-${group.key}`}
                        className={someGroupSelected && !allGroupSelected ? "opacity-50" : ""}
                      />
                      <button
                        className="flex items-center gap-2 min-w-0"
                        onClick={() => collapseGroup(group.key)}
                      >
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                        <span className="font-semibold text-gray-900 truncate" data-testid={`group-name-${group.key}`}>
                          {group.label}
                        </span>
                      </button>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {group.entries.length} {group.entries.length === 1 ? "entrada" : "entradas"}
                      </Badge>
                      {pendingCount > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 font-semibold shrink-0">
                          {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-green-700 hidden sm:flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />{totalHrs}h
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50 text-xs px-2.5"
                        onClick={() => bulkUpdate(group.entries.filter((e) => e.approval_status === "pending").map((e) => e.id).filter(Boolean), "approved")}
                        disabled={pendingCount === 0}
                        data-testid={`button-approve-group-${group.key}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Aprobar grupo
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
                            <TableHead>Fecha</TableHead>
                            <TableHead>Trabajo</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>Salida</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Notas</TableHead>
                            <TableHead className="pr-4 text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.entries.map((entry) => {
                            const cfg = STATUS_CFG[entry.approval_status] ?? STATUS_CFG.pending;
                            const isLoading = loadingIds.has(entry.id);
                            const isSelected = selected.has(entry.id);
                            return (
                              <TableRow
                                key={entry.id}
                                data-testid={`row-${entry.id}`}
                                className={isSelected ? "bg-blue-50/60" : undefined}
                              >
                                <TableCell className="pl-5">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleEntry(entry.id)}
                                    data-testid={`checkbox-entry-${entry.id}`}
                                  />
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                  {fmtDate(entry.clock_in)}
                                </TableCell>
                                <TableCell className="max-w-[160px]">
                                  <p className="truncate text-sm font-medium text-gray-800">{entry.job_title || "—"}</p>
                                  {entry.job_address && (
                                    <p className="truncate text-xs text-gray-400">{entry.job_address}</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">{entry.work_area_name || "—"}</TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-gray-600">{fmtTime(entry.clock_in)}</TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                  {entry.clock_out ? fmtTime(entry.clock_out) : "—"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm font-semibold text-gray-800">
                                  {fmtDur(entry.duration_minutes, entry.clock_in, entry.clock_out)}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ENTRY_TYPE_COLORS[entry.entry_type] ?? "bg-gray-100 text-gray-600"}`}
                                    data-testid={`type-${entry.id}`}>
                                    {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cfg.pill}`}
                                    data-testid={`status-${entry.id}`}>
                                    {cfg.label}
                                  </span>
                                </TableCell>
                                <TableCell className="max-w-[150px]">
                                  <p className="truncate text-sm text-gray-500">{entry.notes || "—"}</p>
                                </TableCell>
                                <TableCell className="pr-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isLoading ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                    ) : (
                                      <>
                                        {entry.approval_status !== "approved" && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                            onClick={() => updateOne(entry.id, "approved")}
                                            data-testid={`button-approve-${entry.id}`}
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                            Aprobar
                                          </Button>
                                        )}
                                        {entry.approval_status !== "rejected" && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                            onClick={() => updateOne(entry.id, "rejected")}
                                            data-testid={`button-reject-${entry.id}`}
                                          >
                                            <XCircle className="w-3.5 h-3.5 mr-1" />
                                            Rechazar
                                          </Button>
                                        )}
                                        {entry.approval_status !== "pending" && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs text-gray-500"
                                            onClick={() => updateOne(entry.id, "pending")}
                                            data-testid={`button-reset-${entry.id}`}
                                          >
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
    </div>
  );
}
