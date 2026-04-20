import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, Briefcase, TrendingUp, TrendingDown, Clock, Users,
  AlertCircle, BarChart2, Layers, FileText, Timer,
} from "lucide-react";
import { Loader2 } from "lucide-react";

type Tab = "revenue" | "job-costing" | "invoice-aging" | "crew-hours";

const DIVISIONS = ["Maintenance", "Install", "Snow", "General"];

function fmt$(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtHrs(n: number) { return `${n.toFixed(1)} hrs`; }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

function StatCard({
  title, value, sub, icon: Icon, trend, color = "default",
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; trend?: number | null; color?: string;
}) {
  const { t } = useTranslation("reports");
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
                {Math.abs(trend).toFixed(1)}{t("vsPriorPeriodLabel")}
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

function RevenueReport() {
  const { t } = useTranslation("reports");
  const thisYear = new Date().getFullYear();
  const [filters, setFilters] = useState({
    date_from: `${thisYear}-01-01`,
    date_to:   `${thisYear}-12-31`,
    division:  "",
  });
  const [applied, setApplied] = useState(filters);

  const params = new URLSearchParams();
  if (applied.date_from) params.set("date_from", applied.date_from);
  if (applied.date_to)   params.set("date_to",   applied.date_to);
  if (applied.division)  params.set("division",   applied.division);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/revenue", applied],
    queryFn: () => fetch(`/api/reports/revenue?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">{t("from")}</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                data-testid="filter-revenue-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("to")}</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                data-testid="filter-revenue-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("division")}</Label>
              <Select value={filters.division} onValueChange={v => setFilters(f => ({ ...f, division: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm w-40" data-testid="filter-revenue-division">
                  <SelectValue placeholder={t("allDivisions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("allDivisions")}</SelectItem>
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(filters)}
              data-testid="btn-apply-revenue-filters">
              {t("applyFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />{t("failedToLoad")}</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t("totalRevenue")} value={fmt$(data.summary.total_revenue)} icon={DollarSign}
              trend={data.summary.pct_vs_prior} color="green" />
            <StatCard title={t("jobsCompleted")} value={String(data.summary.total_jobs)} icon={Briefcase}
              sub={t("withPriceData")} color="blue" />
            <StatCard title={t("avgJobValue")} value={fmt$(data.summary.avg_job_value)} icon={TrendingUp} />
            <StatCard title={t("vsPriorPeriod")}
              value={data.summary.pct_vs_prior != null ? `${data.summary.pct_vs_prior >= 0 ? "+" : ""}${data.summary.pct_vs_prior.toFixed(1)}%` : "—"}
              icon={data.summary.pct_vs_prior != null && data.summary.pct_vs_prior < 0 ? TrendingDown : TrendingUp}
              color={data.summary.pct_vs_prior != null && data.summary.pct_vs_prior < 0 ? "red" : "green"}
              sub={t("requiresDateFilter")} />
          </div>

          {data.by_month.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t("revenueByMonth")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.by_month} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip formatter={(v: any) => fmt$(Number(v))} />
                    <Bar dataKey="revenue" name={t("revenue")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {data.by_division.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t("revenueByDivision")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table data-testid="revenue-division-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("division")}</TableHead>
                      <TableHead className="text-right">{t("revenue")}</TableHead>
                      <TableHead className="text-right">{t("jobs")}</TableHead>
                      <TableHead className="text-right">{t("pctOfTotal")}</TableHead>
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
              {t("noRevenueData")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const JOB_STATUSES = ["Lead", "Scheduled", "In Progress", "Completed", "Invoiced"];

function JobCosting() {
  const { t } = useTranslation("reports");
  const thisYear = new Date().getFullYear();
  const [filters, setFilters] = useState({ date_from: `${thisYear}-01-01`, date_to: `${thisYear}-12-31`, status: "", division: "" });
  const [applied, setApplied] = useState(filters);

  const params = new URLSearchParams();
  if (applied.date_from) params.set("date_from", applied.date_from);
  if (applied.date_to)   params.set("date_to",   applied.date_to);
  if (applied.status)    params.set("status",     applied.status);
  if (applied.division)  params.set("division",   applied.division);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/job-costing", applied],
    queryFn: () => fetch(`/api/reports/job-costing?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">{t("from")}</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                data-testid="filter-costing-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("to")}</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                data-testid="filter-costing-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("status")}</Label>
              <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm w-36" data-testid="filter-costing-status">
                  <SelectValue placeholder={t("allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("allStatuses")}</SelectItem>
                  {JOB_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("division")}</Label>
              <Select value={filters.division} onValueChange={v => setFilters(f => ({ ...f, division: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm w-36" data-testid="filter-costing-division">
                  <SelectValue placeholder={t("allDivisions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("allDivisions")}</SelectItem>
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(filters)}
              data-testid="btn-apply-costing-filters">
              {t("applyFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />{t("failedToLoad")}</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t("estCost")} value={fmt$(data.summary.total_est_cost)} icon={Briefcase} />
            <StatCard title={t("actualCost")} value={fmt$(data.summary.total_actual_cost)} icon={DollarSign}
              color={data.summary.total_actual_cost > data.summary.total_est_cost ? "red" : "green"} />
            <StatCard title={t("grossProfit")} value={fmt$(data.summary.total_gross_profit)} icon={TrendingUp}
              color={data.summary.total_gross_profit >= 0 ? "green" : "red"} />
            <StatCard title={t("avgMargin")} value={fmtPct(data.summary.avg_margin_pct)} icon={BarChart2}
              color={data.summary.avg_margin_pct >= 30 ? "green" : data.summary.avg_margin_pct >= 15 ? "blue" : "red"}
              sub={`${data.jobs.length} ${t("jobs").toLowerCase()}`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t("jobDetail")}</CardTitle>
              <CardDescription className="text-xs">{t("jobCostingDesc2")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.jobs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{t("noJobs")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="job-costing-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("job")}</TableHead>
                        <TableHead>{t("customer")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead className="text-right">{t("contract")}</TableHead>
                        <TableHead className="text-right">{t("estCostCol")}</TableHead>
                        <TableHead className="text-right">{t("actualCostCol")}</TableHead>
                        <TableHead className="text-right">{t("profit")}</TableHead>
                        <TableHead className="text-right">{t("margin")}</TableHead>
                        <TableHead className="text-right">{t("estHrs")}</TableHead>
                        <TableHead className="text-right">{t("actHrs")}</TableHead>
                        <TableHead className="text-right">{t("variance")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.jobs.map((job: any) => (
                        <TableRow key={job.id} data-testid={`costing-row-${job.id}`}>
                          <TableCell className="font-medium max-w-[140px] truncate">{job.title}</TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[100px] truncate">{job.customer}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{job.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt$(job.contract_value)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt$(job.est_cost)}</TableCell>
                          <TableCell className={`text-right font-mono text-xs ${job.actual_cost > job.est_cost ? "text-red-500" : ""}`}>
                            {fmt$(job.actual_cost)}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs ${job.gross_profit < 0 ? "text-red-500" : "text-green-600"}`}>
                            {fmt$(job.gross_profit)}
                          </TableCell>
                          <TableCell className={`text-right text-xs ${job.margin_pct < 15 ? "text-red-500" : job.margin_pct >= 30 ? "text-green-600" : ""}`}>
                            {fmtPct(job.margin_pct)}
                          </TableCell>
                          <TableCell className="text-right text-xs">{job.est_hours > 0 ? job.est_hours : "—"}</TableCell>
                          <TableCell className="text-right text-xs">{job.actual_hours > 0 ? job.actual_hours : "—"}</TableCell>
                          <TableCell className={`text-right text-xs ${job.hour_variance > 0 ? "text-red-500" : job.hour_variance < 0 ? "text-green-600" : ""}`}>
                            {job.est_hours > 0 || job.actual_hours > 0 ? `${job.hour_variance > 0 ? "+" : ""}${job.hour_variance}` : "—"}
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

function InvoiceAging() {
  const { t } = useTranslation("reports");
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
              <Label className="text-xs">{t("asOfDate")}</Label>
              <Input type="date" className="h-8 text-sm w-40" value={asOf}
                onChange={e => setAsOf(e.target.value)} data-testid="filter-aging-date" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("bucket")}</Label>
              <Select value={bucketFilter} onValueChange={v => setBucketFilter(v === "_all" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm w-36" data-testid="filter-aging-bucket">
                  <SelectValue placeholder={t("allBuckets")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("allBuckets")}</SelectItem>
                  <SelectItem value="current">{t("current")}</SelectItem>
                  <SelectItem value="1-30">1–30</SelectItem>
                  <SelectItem value="31-60">31–60</SelectItem>
                  <SelectItem value="61-90">61–90</SelectItem>
                  <SelectItem value="90+">90+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(asOf)}
              data-testid="btn-apply-aging-filters">
              {t("apply")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />{t("failedToLoad")}</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t("current")} value={fmt$(data.summary.current)} icon={DollarSign} color="green"
              sub={t("notYetDue")} />
            <StatCard title={t("days1to30")} value={fmt$(data.summary.days_1_30)} icon={Clock} color="blue" />
            <StatCard title={t("days31to60")} value={fmt$(data.summary.days_31_60)} icon={AlertCircle} color="default" />
            <StatCard title={t("days61to90")} value={fmt$(data.summary.days_61_90)} icon={AlertCircle} color="red" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t("days90plus")} value={fmt$(data.summary.days_90plus)} icon={AlertCircle} color="red"
              sub={t("criticalOverdue")} />
            <StatCard title={t("totalAR")} value={fmt$(data.summary.total_ar)} icon={DollarSign}
              sub={`${data.summary.invoice_count}`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t("openInvoices")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{t("noOpenInvoices")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="aging-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("invoiceNum")}</TableHead>
                        <TableHead>{t("customer")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead>{t("issued")}</TableHead>
                        <TableHead>{t("due")}</TableHead>
                        <TableHead className="text-right">{t("balanceDue")}</TableHead>
                        <TableHead>{t("aging")}</TableHead>
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

function CrewHours() {
  const { t } = useTranslation("reports");
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
              <Label className="text-xs">{t("from")}</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                data-testid="filter-crew-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("to")}</Label>
              <Input type="date" className="h-8 text-sm w-36" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                data-testid="filter-crew-to" />
            </div>
            <Button size="sm" className="h-8" onClick={() => setApplied(filters)}
              data-testid="btn-apply-crew-filters">
              {t("applyFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {error && <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />{t("failedToLoad")}</div>}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t("totalHours")} value={fmtHrs(data.summary.total_hours)} icon={Clock}
              sub={`${data.summary.employee_count} ${t("employees")}`} color="blue" />
            <StatCard title={t("regularHours")} value={fmtHrs(data.summary.regular_hours)} icon={Timer} color="green" />
            <StatCard title={t("overtimeHours")} value={fmtHrs(data.summary.ot_hours)} icon={AlertCircle}
              color={data.summary.ot_hours > 0 ? "red" : "default"} />
            <StatCard title={t("avgPerEmployee")} value={fmtHrs(data.summary.avg_hours)} icon={Users} />
          </div>

          {data.by_week.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t("weeklyHoursTrend")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.by_week} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week_label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} unit="h" />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)} hrs`, t("totalHours")]} />
                    <Bar dataKey="total_hours" name={t("totalHours")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t("employeeHoursBreakdown")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.by_employee.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{t("noTimeEntries")}</div>
              ) : (
                <Table data-testid="crew-hours-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("employees")}</TableHead>
                      <TableHead className="text-right">{t("daysWorked")}</TableHead>
                      <TableHead className="text-right">{t("totalHours")}</TableHead>
                      <TableHead className="text-right">{t("regularHours")}</TableHead>
                      <TableHead className="text-right">{t("overtimeHours")}</TableHead>
                      <TableHead className="text-right">{t("avgPerDay")}</TableHead>
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

export default function Reports() {
  const { t } = useTranslation("reports");
  const [activeTab, setActiveTab] = useState<Tab>("revenue");

  const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "revenue",       label: t("revenueReport"),  icon: DollarSign, desc: t("revenueDesc") },
    { id: "job-costing",   label: t("jobCosting"),     icon: Layers,     desc: t("jobCostingDesc") },
    { id: "invoice-aging", label: t("invoiceAging"),   icon: FileText,   desc: t("invoiceAgingDesc") },
    { id: "crew-hours",    label: t("crewHours"),      icon: Timer,      desc: t("crewHoursDesc") },
  ];

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4" data-testid="reports-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reports-title">
          <BarChart2 className="h-6 w-6" /> {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

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
          {activeTab === "revenue"       && <RevenueReport />}
          {activeTab === "job-costing"   && <JobCosting />}
          {activeTab === "invoice-aging" && <InvoiceAging />}
          {activeTab === "crew-hours"    && <CrewHours />}
        </div>
      </div>
    </div>
  );
}
