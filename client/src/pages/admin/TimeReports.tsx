import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ClipboardList, Clock, Download, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  entry_type: string;
  notes: string | null;
  work_area_name: string | null;
  user_id: string;
  employee_name: string;
  username: string;
  job_id: string | null;
  customer: string | null;
  job_type: string | null;
}

interface DropdownEmployee { id: string; name: string; username: string; }
interface DropdownJob { id: string; client: string; job_type: string; }

interface TimeReportsData {
  entries: TimeEntry[];
  totalMinutes: number;
  employees: DropdownEmployee[];
  jobs: DropdownJob[];
}

function formatDuration(minutes: number | null, clockIn: string, clockOut: string | null): string {
  let mins = minutes;
  if (!mins && clockIn && clockOut) {
    mins = Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
  }
  if (!mins || mins < 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hrs` : `${h} hrs ${m} min`;
}

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    return format(parseISO(ts), "h:mm a");
  } catch {
    return "—";
  }
}

function formatDate(ts: string): string {
  try {
    return format(parseISO(ts), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i);

export default function TimeReports() {
  const { t } = useTranslation("admin");
  const { user } = useAuth();

  const isAdmin = user?.role === "Admin" || (user as any)?.isMasterAdmin;

  const [filters, setFilters] = useState({
    user_id: "",
    job_id: "",
    customer: "",
    date_from: "",
    date_to: "",
    year: "",
  });
  const [applied, setApplied] = useState(filters);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (applied.user_id)   p.set("user_id",   applied.user_id);
    if (applied.job_id)    p.set("job_id",    applied.job_id);
    if (applied.customer)  p.set("customer",  applied.customer);
    if (applied.date_from) p.set("date_from", applied.date_from);
    if (applied.date_to)   p.set("date_to",   applied.date_to);
    if (applied.year)      p.set("year",      applied.year);
    return p.toString();
  }, [applied]);

  const { data, isLoading, error } = useQuery<TimeReportsData>({
    queryKey: ["/api/admin/time-reports", queryParams],
    queryFn: () => apiRequest("GET", `/api/admin/time-reports?${queryParams}`).then((r) => r.json()),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">{t("timeReports.adminRequired")}</p>
      </div>
    );
  }

  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const applyFilters = () => setApplied({ ...filters });

  const resetFilters = () => {
    const empty = { user_id: "", job_id: "", customer: "", date_from: "", date_to: "", year: "" };
    setFilters(empty);
    setApplied(empty);
  };

  const exportCSV = () => {
    if (!data?.entries.length) return;
    const headers = [
      t("timeReports.employeeCol"), t("timeReports.date"), t("timeReports.clockIn"),
      t("timeReports.clockOut"), t("timeReports.totalHoursCol"),
      t("timeReports.job"), t("timeReports.customer"), t("timeReports.type"),
    ];
    const rows = data.entries.map((e) => [
      e.employee_name || e.username,
      formatDate(e.clock_in),
      formatTime(e.clock_in),
      formatTime(e.clock_out),
      formatDuration(e.duration_minutes, e.clock_in, e.clock_out),
      e.job_type ?? "",
      e.customer ?? "",
      e.entry_type,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-5 text-white flex items-center justify-between mb-6 shadow-md">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-time-reports">{t("timeReports.title")}</h1>
            <p className="text-sm text-green-100">{t("timeReports.subtitle")}</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={exportCSV}
          disabled={!data?.entries.length}
          data-testid="button-export-csv"
          className="bg-white/15 border border-white/30 text-white hover:bg-white/25 hover:text-white"
        >
          <Download className="h-4 w-4 mr-2" /> {t("timeReports.exportCsv")}
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("timeReports.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-employee">{t("timeReports.employee")}</Label>
              <Select value={filters.user_id} onValueChange={(v) => setFilter("user_id", v === "__all__" ? "" : v)}>
                <SelectTrigger id="filter-employee" data-testid="select-filter-employee">
                  <SelectValue placeholder={t("timeReports.allEmployees")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("timeReports.allEmployees")}</SelectItem>
                  {data?.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id} data-testid={`option-employee-${e.id}`}>
                      {e.name || e.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-job">{t("timeReports.job")}</Label>
              <Select value={filters.job_id} onValueChange={(v) => setFilter("job_id", v === "__all__" ? "" : v)}>
                <SelectTrigger id="filter-job" data-testid="select-filter-job">
                  <SelectValue placeholder={t("timeReports.allJobs")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("timeReports.allJobs")}</SelectItem>
                  {data?.jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id} data-testid={`option-job-${j.id}`}>
                      {j.client} — {j.job_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-customer">{t("timeReports.customer")}</Label>
              <Input
                id="filter-customer"
                data-testid="input-filter-customer"
                placeholder={t("timeReports.searchCustomer")}
                value={filters.customer}
                onChange={(e) => setFilter("customer", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-year">{t("timeReports.year")}</Label>
              <Select value={filters.year} onValueChange={(v) => setFilter("year", v === "__all__" ? "" : v)}>
                <SelectTrigger id="filter-year" data-testid="select-filter-year">
                  <SelectValue placeholder={t("timeReports.allYears")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("timeReports.allYears")}</SelectItem>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)} data-testid={`option-year-${y}`}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-date-from">{t("timeReports.dateFrom")}</Label>
              <Input id="filter-date-from" data-testid="input-filter-date-from" type="date"
                value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-date-to">{t("timeReports.dateTo")}</Label>
              <Input id="filter-date-to" data-testid="input-filter-date-to" type="date"
                value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters} data-testid="button-apply-filters">
              {t("timeReports.applyFilters")}
            </Button>
            <Button variant="outline" onClick={resetFilters} data-testid="button-reset-filters">
              <RotateCcw className="h-4 w-4 mr-2" /> {t("timeReports.reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="flex items-center gap-4 mb-4" data-testid="summary-row">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("timeReports.totalHours")}</span>
            <span className="font-semibold" data-testid="text-total-hours">
              {formatHours(data.totalMinutes)}
            </span>
          </div>
          <Badge variant="secondary" data-testid="badge-entry-count">
            {data.entries.length} {data.entries.length === 1 ? t("timeReports.entry") : t("timeReports.entries")}
          </Badge>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-16 text-center text-destructive text-sm" data-testid="error-message">
              {t("timeReports.failedToLoad")}
            </div>
          ) : !data?.entries.length ? (
            <div className="py-16 text-center text-muted-foreground text-sm" data-testid="empty-state">
              {t("timeReports.noEntries")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-time-reports">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("timeReports.employeeCol")}</TableHead>
                    <TableHead>{t("timeReports.date")}</TableHead>
                    <TableHead>{t("timeReports.clockIn")}</TableHead>
                    <TableHead>{t("timeReports.clockOut")}</TableHead>
                    <TableHead>{t("timeReports.totalHoursCol")}</TableHead>
                    <TableHead>{t("timeReports.job")}</TableHead>
                    <TableHead>{t("timeReports.customer")}</TableHead>
                    <TableHead>{t("timeReports.type")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry, idx) => (
                    <TableRow
                      key={entry.id}
                      data-testid={`row-time-entry-${entry.id}`}
                      className={`hover:bg-emerald-50/40 transition-colors ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}
                    >
                      <TableCell className="font-medium" data-testid={`text-employee-${entry.id}`}>
                        {entry.employee_name || entry.username}
                      </TableCell>
                      <TableCell data-testid={`text-date-${entry.id}`}>
                        {formatDate(entry.clock_in)}
                      </TableCell>
                      <TableCell data-testid={`text-clock-in-${entry.id}`}>
                        {formatTime(entry.clock_in)}
                      </TableCell>
                      <TableCell data-testid={`text-clock-out-${entry.id}`}>
                        {entry.clock_out ? formatTime(entry.clock_out) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">{t("timeReports.active")}</Badge>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-duration-${entry.id}`}>
                        {formatDuration(entry.duration_minutes, entry.clock_in, entry.clock_out)}
                      </TableCell>
                      <TableCell data-testid={`text-job-${entry.id}`}>
                        {entry.job_type ?? <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell data-testid={`text-customer-${entry.id}`}>
                        {entry.customer ?? <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell data-testid={`text-type-${entry.id}`}>
                        {entry.entry_type === "billable" ? (
                          <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">{t("timeReports.billable")}</Badge>
                        ) : entry.entry_type === "drive_time" ? (
                          <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs">{t("timeReports.driveTime")}</Badge>
                        ) : entry.entry_type === "shop_time" ? (
                          <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-xs">{t("timeReports.shopTime")}</Badge>
                        ) : (
                          <Badge variant="secondary" className="capitalize text-xs">
                            {entry.entry_type.replace("_", " ")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold" data-testid="row-summary-footer">
                    <TableCell colSpan={4} className="text-right text-sm text-muted-foreground pr-4">
                      {t("timeReports.total")}
                    </TableCell>
                    <TableCell data-testid="text-footer-total-hours">
                      {formatHours(data.totalMinutes)}
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
