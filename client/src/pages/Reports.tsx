import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, Briefcase, TrendingUp, TrendingDown, Clock, Users,
  AlertCircle, AlertTriangle, BarChart2, Layers, FileText, Timer, PieChart, ChevronDown, ChevronUp,
} from "lucide-react";
import { Loader2 } from "lucide-react";

type Tab = "revenue" | "invoice-aging" | "crew-hours" | "profitability" | "time-by-division" | "materials-spend";

const DIVISIONS = ["Maintenance", "Install", "Snow", "General"];

function fmt$(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtHrs(n: number) { return `${n.toFixed(1)} hrs`; }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

// ─── Summary Card ─────────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, trend, color = "default",
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; trend?: number | null; color?: string;
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {trend != null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}% vs prior period
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${color === "green" ? "bg-green-100 text-green-700" : color === "red" ? "bg-red-100 text-red-600" : color === "blue" ? "bg-blue-100 text-blue-700" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Bucket badge ─────────────────────────────────────────────────────────────
function AgingBadge({ bucket }: { bucket: string }) {
  const styles: Record<string, string> = {
    current:  "bg-green-100 text-green-700",
    "1-30":   "bg-yellow-100 text-yellow-700",
    "31-60":  "bg-orange-100 text-orange-700",
    "61-90":  "bg-red-100 text-red-600",
    "90+":    "bg-red-200 text-red-800 font-bold",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[bucket] ?? "bg-muted"}`}>
      {bucket === "current" ? "Current" : `${bucket} days`}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Tab 1 — Revenue Report
// ═══════════════════════════════════════════════════════════════════════════════
const REVENUE_STATUS_OPTIONS = [
  { value: "Completed,Invoiced,Paid", label: "Realized (Completed + Invoiced + Paid)" },
  { value: "_all",                    label: "All Statuses" },
  { value: "Completed",               label: "Completed Only" },
  { value: "Invoiced",                label: "Invoiced Only" },
  { value: "Paid",                    label: "Paid Only" },
  { value: "In Progress",             label: "In Progress" },
  { value: "Scheduled",               label: "Scheduled" },
  { value: "Lead",                    label: "Lead" },
];

function RevenueReport() {
  const thisYear = new Date().getFullYear();
  const [filters, setFilters] = useState({
    date_from: `${thisYear}-01-01`,
    date_to:   `${thisYear}-12-31`,
    division:  "",
    statuses:  "Completed,Invoiced,Paid",
  });
  const [applied, setApplied] = useState(filters);

  const params = new URLSearchParams();
  if (applied.date_from) params.set("date_from", applied.date_from);
  if (applied.date_to)   params.set("date_to",   applied.date_to);
  if (applied.division)  params.set("division",   applied.division);
  if (applied.statuses)  params.set("statuses",   applied.statuses);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/revenue", applied],
    queryFn: () => fetch(`/api/reports/revenue?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  const statusLabel = REVENUE_STATUS_OPTIONS.find(o => o.value === applied.statuses)?.label ?? applied.statuses;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                data-testid="filter-revenue-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                data-testid="filter-revenue-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Job Status</Label>
              <Select value={filters.statuses} onValueChange={v => setFilters(f => ({ ...f, statuses: v }))}>
                <SelectTrigger className="h-8 text-sm w-60" data-testid="filter-revenue-statuses">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVENUE_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Division</Label>
              <Select value={filters.division} onValueChange={v => setFilters(f => ({ ...f, division: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm w-40" data-testid="filter-revenue-division">
                  <SelectValue placeholder="All Divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Divisions</SelectItem>
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(filters)}
              data-testid="btn-apply-revenue-filters">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />Failed to load report</div>}

      {data && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value={fmt$(data.summary.total_revenue)} icon={DollarSign}
              trend={data.summary.pct_vs_prior} color="green" />
            <StatCard title="Jobs Counted" value={String(data.summary.total_jobs)} icon={Briefcase}
              sub={statusLabel} color="blue" />
            <StatCard title="Avg Job Value" value={fmt$(data.summary.avg_job_value)} icon={TrendingUp} />
            <StatCard title="vs Prior Period"
              value={data.summary.pct_vs_prior != null ? `${data.summary.pct_vs_prior >= 0 ? "+" : ""}${data.summary.pct_vs_prior.toFixed(1)}%` : "—"}
              icon={data.summary.pct_vs_prior != null && data.summary.pct_vs_prior < 0 ? TrendingDown : TrendingUp}
              color={data.summary.pct_vs_prior != null && data.summary.pct_vs_prior < 0 ? "red" : "green"}
              sub="requires date filter" />
          </div>

          {/* Bar Chart */}
          {data.by_month.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue by Month</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.by_month} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip formatter={(v: any) => fmt$(Number(v))} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Division Table */}
          {data.by_division.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue by Division</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table data-testid="revenue-division-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Division</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Jobs</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_division.map((row: any) => (
                      <TableRow key={row.division} data-testid={`division-row-${row.division}`}>
                        <TableCell className="font-medium">{row.division}</TableCell>
                        <TableCell className="text-right font-mono">{fmt$(row.revenue)}</TableCell>
                        <TableCell className="text-right">{row.job_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5">
                              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                            </div>
                            <span className="text-xs w-10 text-right">{fmtPct(row.pct)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data.by_month.length === 0 && data.by_division.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No revenue data found for the selected filters
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Tab 2 — Invoice Aging
// ═══════════════════════════════════════════════════════════════════════════════
function InvoiceAging() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0]);
  const [applied, setApplied] = useState(asOf);
  const [bucketFilter, setBucketFilter] = useState("");

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/invoice-aging", applied],
    queryFn: () => fetch(`/api/reports/invoice-aging?as_of_date=${applied}`, { credentials: "include" }).then(r => r.json()),
  });

  const filtered = data?.invoices?.filter((inv: any) => !bucketFilter || inv.bucket === bucketFilter) ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">As of Date</Label>
              <Input type="date" className="h-8 text-sm w-40" value={asOf}
                onChange={e => setAsOf(e.target.value)} data-testid="filter-aging-date" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bucket</Label>
              <Select value={bucketFilter} onValueChange={v => setBucketFilter(v === "_all" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm w-36" data-testid="filter-aging-bucket">
                  <SelectValue placeholder="All Buckets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Buckets</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="1-30">1–30 days</SelectItem>
                  <SelectItem value="31-60">31–60 days</SelectItem>
                  <SelectItem value="61-90">61–90 days</SelectItem>
                  <SelectItem value="90+">90+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(asOf)}
              data-testid="btn-apply-aging-filters">
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />Failed to load report</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Current" value={fmt$(data.summary.current)} icon={DollarSign} color="green"
              sub="Not yet due" />
            <StatCard title="1–30 Days" value={fmt$(data.summary.days_1_30)} icon={Clock} color="blue" />
            <StatCard title="31–60 Days" value={fmt$(data.summary.days_31_60)} icon={AlertCircle} color="default" />
            <StatCard title="61–90 Days" value={fmt$(data.summary.days_61_90)} icon={AlertCircle} color="red" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="90+ Days" value={fmt$(data.summary.days_90plus)} icon={AlertCircle} color="red"
              sub="Critical overdue" />
            <StatCard title="Total AR" value={fmt$(data.summary.total_ar)} icon={DollarSign}
              sub={`${data.summary.invoice_count} open invoices`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Open Invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No open invoices found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="aging-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        <TableHead>Aging</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((inv: any) => (
                        <TableRow key={inv.id} data-testid={`aging-row-${inv.id}`}
                          className={
                            inv.bucket === "90+" ? "bg-red-50/50 dark:bg-red-950/20" :
                            inv.bucket === "61-90" ? "bg-orange-50/50 dark:bg-orange-950/20" :
                            inv.bucket === "31-60" ? "bg-yellow-50/30 dark:bg-yellow-950/20" : ""
                          }>
                          <TableCell className="font-mono text-xs font-medium">{inv.invoice_number}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{inv.customer}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{inv.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.issued_date ? new Date(inv.issued_date).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {fmt$(inv.balance_due)}
                          </TableCell>
                          <TableCell>
                            <AgingBadge bucket={inv.bucket} />
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Tab 4 — Crew Hours
// ═══════════════════════════════════════════════════════════════════════════════
function CrewHours() {
  const today = new Date();
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 90);
  const [filters, setFilters] = useState({
    date_from: weekAgo.toISOString().split("T")[0],
    date_to:   today.toISOString().split("T")[0],
    user_id:   "",
  });
  const [applied, setApplied] = useState(filters);

  const params = new URLSearchParams();
  if (applied.date_from) params.set("date_from", applied.date_from);
  if (applied.date_to)   params.set("date_to",   applied.date_to);
  if (applied.user_id)   params.set("user_id",   applied.user_id);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/crew-hours", applied],
    queryFn: () => fetch(`/api/reports/crew-hours?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                data-testid="filter-crew-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                data-testid="filter-crew-to" />
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(filters)}
              data-testid="btn-apply-crew-filters">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />Failed to load report</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Hours" value={fmtHrs(data.summary.total_hours)} icon={Clock}
              sub={`${data.summary.employee_count} employees`} color="blue" />
            <StatCard title="Regular Hours" value={fmtHrs(data.summary.regular_hours)} icon={Timer} color="green" />
            <StatCard title="Overtime Hours" value={fmtHrs(data.summary.ot_hours)} icon={AlertCircle}
              color={data.summary.ot_hours > 0 ? "red" : "default"} />
            <StatCard title="Avg / Employee" value={fmtHrs(data.summary.avg_hours)} icon={Users} />
          </div>

          {data.by_week.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Weekly Hours Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.by_week} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week_label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} unit="h" />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)} hrs`, "Total Hours"]} />
                    <Bar dataKey="total_hours" name="Total Hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Employee Hours Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.by_employee.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No time entries found for this period</div>
              ) : (
                <Table data-testid="crew-hours-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Days Worked</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead className="text-right">Regular Hrs</TableHead>
                      <TableHead className="text-right">OT Hours</TableHead>
                      <TableHead className="text-right">Avg / Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_employee.map((emp: any) => (
                      <TableRow key={emp.user_id} data-testid={`crew-row-${emp.user_id}`}>
                        <TableCell className="font-medium">{emp.employee_name}</TableCell>
                        <TableCell className="text-right">{emp.days_worked}</TableCell>
                        <TableCell className="text-right font-mono">{fmtHrs(emp.total_hours)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{fmtHrs(emp.regular_hours)}</TableCell>
                        <TableCell className={`text-right font-mono ${emp.ot_hours > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                          {emp.ot_hours > 0 ? fmtHrs(emp.ot_hours) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtHrs(emp.avg_per_day)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Profitability Report
// ═══════════════════════════════════════════════════════════════════════════════
type SortKey = "sold_value" | "gross_profit" | "margin_pct" | "labor_cost" | "material_cost" | "actual_hours";

function marginColor(pct: number) {
  if (pct >= 40) return "text-green-600 dark:text-green-400";
  if (pct >= 20) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function ProfitabilityReport() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [division, setDivision] = useState("");
  const [applied, setApplied] = useState({ year: String(thisYear), division: "" });
  const [sortKey, setSortKey] = useState<SortKey>("gross_profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const params = new URLSearchParams();
  if (applied.year)     params.set("year", applied.year);
  if (applied.division) params.set("division", applied.division);

  const { data = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/reports/job-profitability", applied],
    queryFn: () => fetch(`/api/reports/job-profitability?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
    const aVal = Number(a[sortKey] ?? 0);
    const bVal = Number(b[sortKey] ?? 0);
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  // Summary totals
  const totals = sorted.reduce((acc, r) => ({
    sold: acc.sold + Number(r.sold_value ?? 0),
    profit: acc.profit + Number(r.gross_profit ?? 0),
    labor: acc.labor + Number(r.labor_cost ?? 0),
    materials: acc.materials + Number(r.material_cost ?? 0),
    hours: acc.hours + Number(r.actual_hours ?? 0),
  }), { sold: 0, profit: 0, labor: 0, materials: 0, hours: 0 });

  const avgMargin = totals.sold > 0 ? (totals.profit / totals.sold) * 100 : 0;

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortDir === "desc" ? <ChevronDown className="h-3 w-3 inline ml-0.5" /> : <ChevronUp className="h-3 w-3 inline ml-0.5" />;
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <select value={year} onChange={e => setYear(e.target.value)}
                className="h-8 text-sm rounded-md border border-input bg-background px-2 w-24"
                data-testid="filter-profit-year">
                {[thisYear, thisYear - 1, thisYear - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Division</Label>
              <select value={division} onChange={e => setDivision(e.target.value)}
                className="h-8 text-sm rounded-md border border-input bg-background px-2 w-36"
                data-testid="filter-profit-division">
                <option value="">All Divisions</option>
                {["Maintenance", "Install", "Snow", "General"].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={() => setApplied({ year, division })} data-testid="button-apply-profit-filter">
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
              <p className="text-xl font-bold mt-0.5">{fmt$(totals.sold)}</p>
              <p className="text-xs text-muted-foreground">{sorted.length} jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Gross Profit</p>
              <p className={`text-xl font-bold mt-0.5 ${marginColor(avgMargin)}`}>{fmt$(totals.profit)}</p>
              <p className="text-xs text-muted-foreground">{fmtPct(avgMargin)} avg margin</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Labor Cost</p>
              <p className="text-xl font-bold mt-0.5">{fmt$(totals.labor)}</p>
              <p className="text-xs text-muted-foreground">{fmtHrs(totals.hours)} total hrs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Material Cost</p>
              <p className="text-xl font-bold mt-0.5">{fmt$(totals.materials)}</p>
              <p className="text-xs text-muted-foreground">
                {totals.sold > 0 ? fmtPct((totals.materials / totals.sold) * 100) : "0%"} of revenue
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Failed to load data</div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No jobs found for the selected filters</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Job</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("sold_value")}>
                      Sold Value <SortIcon k="sold_value" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("actual_hours")}>
                      Act. Hours <SortIcon k="actual_hours" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("labor_cost")}>
                      Labor Cost <SortIcon k="labor_cost" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("material_cost")}>
                      Materials <SortIcon k="material_cost" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("gross_profit")}>
                      Gross Profit <SortIcon k="gross_profit" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("margin_pct")}>
                      Margin <SortIcon k="margin_pct" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(r => (
                    <TableRow key={r.id} data-testid={`row-profit-${r.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px] flex items-center gap-1">
                            {r.title}
                            {Number(r.missing_rate_count ?? 0) > 0 && (
                              <AlertTriangle
                                className="h-3.5 w-3.5 text-amber-600 flex-shrink-0"
                                data-testid={`icon-missing-rate-${r.id}`}
                              />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{r.client}</p>
                          {r.division && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.division}</span>
                          )}
                          {Number(r.missing_rate_count ?? 0) > 0 && (
                            <p className="text-xs text-amber-600 mt-0.5" data-testid={`text-missing-rate-${r.id}`}>
                              {r.missing_rate_count} entr{r.missing_rate_count !== 1 ? "ies" : "y"} w/o pay rate — margin may be overstated
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt$(r.sold_value)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtHrs(Number(r.actual_hours))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt$(r.labor_cost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt$(r.material_cost)}</TableCell>
                      <TableCell className={`text-right font-semibold ${r.gross_profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600"}`}>
                        {fmt$(r.gross_profit)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${marginColor(r.margin_pct)}`}>
                        {fmtPct(Number(r.margin_pct))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Tab 6 — Time by Division
// ═══════════════════════════════════════════════════════════════════════════════
const DIV_COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444", "#06b6d4"];

function TimeByDivision() {
  const thisYear = new Date().getFullYear();
  const [filters, setFilters] = useState({ date_from: `${thisYear}-01-01`, date_to: `${thisYear}-12-31` });
  const [applied, setApplied] = useState(filters);

  const params = new URLSearchParams();
  if (applied.date_from) params.set("date_from", applied.date_from);
  if (applied.date_to)   params.set("date_to",   applied.date_to);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/time-by-division", applied],
    queryFn: () => fetch(`/api/reports/time-by-division?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                data-testid="filter-tbd-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                data-testid="filter-tbd-to" />
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(filters)} data-testid="btn-apply-tbd-filters">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />Failed to load report</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Hours" value={fmtHrs(data.summary.total_hours)} icon={Clock} color="blue" />
            <StatCard title="Divisions" value={String(data.summary.division_count)} icon={BarChart2} />
            {data.by_division[0] && (
              <StatCard title="Top Division" value={data.by_division[0].division}
                sub={fmtHrs(data.by_division[0].total_hours)} icon={TrendingUp} color="green" />
            )}
            {data.by_division[1] && (
              <StatCard title="2nd Division" value={data.by_division[1].division}
                sub={fmtHrs(data.by_division[1].total_hours)} icon={TrendingUp} />
            )}
          </div>

          {data.by_month.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Hours by Division — Monthly</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.by_month} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${v}h`} tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)} hrs`} />
                    <Legend />
                    {data.divisions.map((div: string, i: number) => (
                      <Bar key={div} dataKey={div} name={div} stackId="a"
                        fill={DIV_COLORS[i % DIV_COLORS.length]} radius={i === data.divisions.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {data.by_division.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Hours by Division</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Division</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead className="text-right">Crew Members</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_division.map((r: any) => (
                      <TableRow key={r.division}>
                        <TableCell className="font-medium">{r.division}</TableCell>
                        <TableCell className="text-right">{fmtHrs(r.total_hours)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.crew_count}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.entry_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data.by_employee.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Employee Hours by Division</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_employee.map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.employee_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.division}</TableCell>
                        <TableCell className="text-right">{fmtHrs(r.total_hours)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Tab 7 — Materials Spend
// ═══════════════════════════════════════════════════════════════════════════════
function MaterialsSpend() {
  const thisYear = new Date().getFullYear();
  const [filters, setFilters] = useState({ date_from: `${thisYear}-01-01`, date_to: `${thisYear}-12-31`, division: "" });
  const [applied, setApplied] = useState(filters);

  const params = new URLSearchParams();
  if (applied.date_from) params.set("date_from", applied.date_from);
  if (applied.date_to)   params.set("date_to",   applied.date_to);
  if (applied.division)  params.set("division",   applied.division);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/materials-spend", applied],
    queryFn: () => fetch(`/api/reports/materials-spend?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                data-testid="filter-ms-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                data-testid="filter-ms-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Division</Label>
              <Select value={filters.division} onValueChange={v => setFilters(f => ({ ...f, division: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm w-40" data-testid="filter-ms-division">
                  <SelectValue placeholder="All Divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Divisions</SelectItem>
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(filters)} data-testid="btn-apply-ms-filters">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />Failed to load report</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Spend"     value={fmt$(data.summary.total_spend)}    icon={DollarSign} color="green" />
            <StatCard title="Jobs with Materials" value={String(data.summary.job_count)} icon={Briefcase}  color="blue" />
            <StatCard title="Line Items"      value={String(data.summary.line_count)}   icon={FileText} />
            <StatCard title="Avg Line Value"  value={fmt$(data.summary.avg_line_value)} icon={TrendingUp} />
          </div>

          {data.by_month.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Spend by Month</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.by_month} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip formatter={(v: any) => fmt$(Number(v))} />
                    <Bar dataKey="total_spend" name="Spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.by_division.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">By Division</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Division</TableHead>
                        <TableHead className="text-right">Jobs</TableHead>
                        <TableHead className="text-right">Total Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_division.map((r: any) => (
                        <TableRow key={r.division}>
                          <TableCell className="font-medium">{r.division}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{r.job_count}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt$(r.total_spend)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {data.by_item.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top Items by Spend</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_item.slice(0, 10).map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>
                            <p className="font-medium text-sm truncate max-w-[160px]">{r.item_name}</p>
                            {r.item_number && <p className="text-xs text-muted-foreground">{r.item_number}</p>}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{r.total_qty}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt$(r.total_spend)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          {data.by_item.length === 0 && data.by_month.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No materials spend data for this period.</p>
                <p className="text-xs text-muted-foreground mt-1">Add materials to jobs using the Materials tab on any job detail page.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  At a Glance Panel
// ═══════════════════════════════════════════════════════════════════════════════
const STAGE_COLORS: Record<string, string> = {
  lead:          "bg-slate-100 text-slate-700",
  Lead:          "bg-slate-100 text-slate-700",
  scheduled:     "bg-blue-100 text-blue-700",
  Scheduled:     "bg-blue-100 text-blue-700",
  in_progress:   "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-yellow-100 text-yellow-700",
  on_hold:       "bg-orange-100 text-orange-700",
  "On Hold":     "bg-orange-100 text-orange-700",
  active:        "bg-green-100 text-green-700",
  Active:        "bg-green-100 text-green-700",
};

function GlanceTile({
  label, value, sub, icon: Icon, iconColor = "bg-primary/10 text-primary",
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconColor?: string;
}) {
  return (
    <div className="flex items-start gap-3" data-testid={`glance-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">{label}</p>
        <p className="text-xl font-bold mt-1 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

function stageLabel(s: string) {
  const map: Record<string, string> = {
    lead: "Lead", scheduled: "Scheduled", in_progress: "In Progress",
    on_hold: "On Hold", active: "Active", invoiced: "Invoiced",
    completed: "Completed", cancelled: "Cancelled", paid: "Paid",
  };
  return map[s.toLowerCase()] ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function AtAGlance() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/reports/at-a-glance"],
    queryFn: () => fetch("/api/reports/at-a-glance", { credentials: "include" }).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Card className="mb-6" data-testid="at-a-glance-panel">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              At a Glance
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Revenue &amp; AR: year-to-date &nbsp;·&nbsp; Win Rate: last 90 days &nbsp;·&nbsp; Utilization: last 30 days
            </CardDescription>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-1" />}
        </div>
      </CardHeader>

      <CardContent className="pb-5">
        {isError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" /> Failed to load summary
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-5">
            {/* ── Five metric tiles ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
              <GlanceTile
                label="Revenue YTD"
                value={fmt$(data.revenue_ytd)}
                sub="Completed · Invoiced · Paid"
                icon={DollarSign}
                iconColor="bg-green-100 text-green-700"
              />
              <GlanceTile
                label="Total AR"
                value={fmt$(data.total_ar)}
                sub={
                  data.ar_invoice_count > 0
                    ? `${data.ar_invoice_count} open invoice${data.ar_invoice_count !== 1 ? "s" : ""}`
                    : "No open invoices"
                }
                icon={FileText}
                iconColor="bg-blue-100 text-blue-700"
              />
              <GlanceTile
                label="Win Rate"
                value={data.win_rate_pct != null ? fmtPct(data.win_rate_pct) : "—"}
                sub={
                  data.win_rate_total > 0
                    ? `${data.win_rate_won} won of ${data.win_rate_total} finalized (90d)`
                    : "No finalized estimates in 90 days"
                }
                icon={TrendingUp}
                iconColor={
                  data.win_rate_pct == null
                    ? "bg-muted text-muted-foreground"
                    : data.win_rate_pct >= 50
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }
              />
              <GlanceTile
                label="Crew Utilization"
                value={data.utilization_pct != null ? fmtPct(data.utilization_pct) : "—"}
                sub={
                  data.utilization_total_min > 0
                    ? `${fmtHrs(data.utilization_billable_min / 60)} billable of ${fmtHrs(data.utilization_total_min / 60)} (30d)`
                    : "No time logged in 30 days"
                }
                icon={Timer}
                iconColor="bg-orange-100 text-orange-700"
              />
              <GlanceTile
                label="Maint. Compliance"
                value={data.maintenance_compliance_pct != null ? fmtPct(data.maintenance_compliance_pct) : "—"}
                sub={
                  data.maintenance_total > 0
                    ? `${data.maintenance_behind} job${data.maintenance_behind !== 1 ? "s" : ""} behind schedule`
                    : "No maintenance jobs this year"
                }
                icon={BarChart2}
                iconColor={
                  data.maintenance_compliance_pct == null
                    ? "bg-muted text-muted-foreground"
                    : data.maintenance_compliance_pct >= 80
                    ? "bg-green-100 text-green-700"
                    : data.maintenance_compliance_pct >= 60
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-600"
                }
              />
            </div>

            {/* ── Jobs by Stage ── */}
            <div className="border-t pt-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Active Jobs by Stage
              </p>
              {data.jobs_by_stage && data.jobs_by_stage.length > 0 ? (
                <div className="flex flex-wrap gap-2" data-testid="jobs-by-stage">
                  {data.jobs_by_stage.map((item: any) => (
                    <div
                      key={item.status}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                        STAGE_COLORS[item.status] ?? "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`stage-badge-${item.status}`}
                    >
                      <span className="font-bold tabular-nums">{item.cnt}</span>
                      <span className="text-xs opacity-80">{stageLabel(item.status)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active jobs.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main Reports Page
// ═══════════════════════════════════════════════════════════════════════════════
const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "revenue",          label: "Revenue Report",    icon: DollarSign, desc: "Revenue trends, job volume, and division breakdown" },
  { id: "invoice-aging",    label: "Invoice Aging",     icon: FileText,   desc: "Outstanding AR bucketed by days past due" },
  { id: "crew-hours",       label: "Crew Hours",        icon: Timer,      desc: "Employee hours, overtime, and weekly trends" },
  { id: "profitability",    label: "Job Profitability", icon: PieChart,   desc: "Actual labor + materials vs sold value, gross margin per job" },
  { id: "time-by-division", label: "Time by Division",  icon: BarChart2,  desc: "Hours worked broken down by division and month" },
  { id: "materials-spend",  label: "Materials Spend",   icon: Layers,     desc: "Materials cost from job records by item, division, and month" },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>("revenue");

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4" data-testid="reports-page">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reports-title">
          <BarChart2 className="h-6 w-6" /> Reports
        </h1>
        <p className="text-muted-foreground mt-1">Financial and operational analytics for your business</p>
      </div>

      <AtAGlance />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar nav */}
        <nav className="md:w-56 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`reports-tab-${tab.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "revenue"          && <RevenueReport />}
          {activeTab === "invoice-aging"    && <InvoiceAging />}
          {activeTab === "crew-hours"       && <CrewHours />}
          {activeTab === "profitability"    && <ProfitabilityReport />}
          {activeTab === "time-by-division" && <TimeByDivision />}
          {activeTab === "materials-spend"  && <MaterialsSpend />}
        </div>
      </div>
    </div>
  );
}
