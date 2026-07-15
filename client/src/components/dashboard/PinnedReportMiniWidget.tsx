import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  DollarSign, Clock, Package, AlertTriangle,
  TrendingUp, Wrench, Loader2, Star, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites, type Favorite } from "@/hooks/use-favorites";
import type { LucideIcon } from "lucide-react";

// ── Report metadata ───────────────────────────────────────────────────────────
interface ReportMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  endpoint: string;
}

const REPORT_META: Record<string, ReportMeta> = {
  "revenue":            { label: "Revenue",           icon: DollarSign,    color: "#22c55e", endpoint: "/api/reports/revenue" },
  "invoice-aging":      { label: "Invoice Aging",     icon: DollarSign,    color: "#f59e0b", endpoint: "/api/reports/invoice-aging" },
  "crew-hours":         { label: "Crew Hours",        icon: Clock,         color: "#3b82f6", endpoint: "/api/reports/crew-hours" },
  "profitability":      { label: "Job Profitability", icon: TrendingUp,    color: "#8b5cf6", endpoint: "/api/reports/job-profitability" },
  "time-by-division":   { label: "Time by Division",  icon: Clock,         color: "#ec4899", endpoint: "/api/reports/time-by-division" },
  "materials-spend":    { label: "Materials Spend",   icon: Package,       color: "#f97316", endpoint: "/api/reports/materials-spend" },
  "equipment-repair":   { label: "Equipment Repair",  icon: Wrench,        color: "#ef4444", endpoint: "/api/reports/equipment-repair" },
  "material-shortages": { label: "Material Shortages",icon: AlertTriangle, color: "#dc2626", endpoint: "/api/reports/material-shortages" },
};

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
function fmtH(n: number): string {
  return `${Math.round(n)}h`;
}

// ── Custom mini tooltip ───────────────────────────────────────────────────────
function MiniTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-md px-2 py-1 text-[10px] shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{formatter ? formatter(payload[0].value) : payload[0].value}</p>
    </div>
  );
}

// ── Per-report mini chart renderer ────────────────────────────────────────────
function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[72px] text-[10px] text-muted-foreground">
      No data yet
    </div>
  );
}

function MiniChartContent({ reportId, data }: { reportId: string; data: any }) {
  const meta = REPORT_META[reportId];
  const color = meta.color;

  if (reportId === "revenue") {
    const rows = (data?.by_month ?? []).slice(-6).map((m: any) => ({ month: (m.month ?? "").slice(0, 7), v: m.revenue ?? 0 }));
    const stat = data?.summary?.total_revenue;
    return (
      <>
        {stat != null && <p className="text-xs font-bold mb-1" style={{ color }}>{fmt$(stat)} YTD</p>}
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={72}>
            <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip content={<MiniTooltip formatter={fmt$} />} />
              <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </>
    );
  }

  if (reportId === "invoice-aging") {
    const s = data?.summary ?? {};
    const rows = [
      { name: "Current", v: s.current ?? 0 },
      { name: "1-30",    v: s.days_1_30 ?? 0 },
      { name: "31-60",   v: s.days_31_60 ?? 0 },
      { name: "61-90",   v: s.days_61_90 ?? 0 },
      { name: "90+",     v: s.days_90plus ?? 0 },
    ];
    const stat = s.total_ar;
    return (
      <>
        {stat != null && <p className="text-xs font-bold mb-1" style={{ color }}>{fmt$(stat)} total AR</p>}
        <ResponsiveContainer width="100%" height={72}>
          <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis hide />
            <Tooltip content={<MiniTooltip formatter={fmt$} />} />
            <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </>
    );
  }

  if (reportId === "crew-hours") {
    const rows = (data?.by_day ?? []).slice(-10).map((d: any) => ({ d: (d.date ?? "").slice(5), v: d.hours ?? 0 }));
    const stat = data?.summary?.total_hours;
    return (
      <>
        {stat != null && <p className="text-xs font-bold mb-1" style={{ color }}>{fmtH(stat)} total</p>}
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={72}>
            <AreaChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="d" hide />
              <YAxis hide />
              <Tooltip content={<MiniTooltip formatter={fmtH} />} />
              <Area type="monotone" dataKey="v" stroke={color} fill={`${color}33`} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </>
    );
  }

  if (reportId === "profitability") {
    const jobs: any[] = Array.isArray(data) ? data : [];
    const withMargin = jobs.filter((j) => j.margin_pct != null);
    const avg = withMargin.length ? withMargin.reduce((s, j) => s + j.margin_pct, 0) / withMargin.length : null;
    const top5 = [...withMargin].sort((a, b) => b.margin_pct - a.margin_pct).slice(0, 5).map((j) => ({
      name: (j.title || j.client || "Job").slice(0, 10),
      v: Math.round(j.margin_pct),
    }));
    return (
      <>
        {avg != null && <p className="text-xs font-bold mb-1" style={{ color }}>{avg.toFixed(1)}% avg margin · {jobs.length} jobs</p>}
        {top5.length > 0 ? (
          <ResponsiveContainer width="100%" height={72}>
            <BarChart data={top5} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={56} />
              <Tooltip content={<MiniTooltip formatter={(v: number) => `${v}%`} />} />
              <Bar dataKey="v" fill={color} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </>
    );
  }

  if (reportId === "time-by-division") {
    const divs: string[] = data?.divisions ?? [];
    const rows = (data?.by_month ?? []).slice(-6).map((m: any) => {
      const total = divs.reduce((s, d) => s + (m[d] ?? 0), 0);
      return { month: (m.month ?? "").slice(0, 7), v: total };
    });
    const stat = data?.summary?.total_hours;
    return (
      <>
        {stat != null && <p className="text-xs font-bold mb-1" style={{ color }}>{fmtH(stat)} total</p>}
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={72}>
            <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip content={<MiniTooltip formatter={fmtH} />} />
              <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </>
    );
  }

  if (reportId === "materials-spend") {
    const rows = (data?.by_month ?? []).slice(-6).map((m: any) => ({ month: (m.month ?? "").slice(0, 7), v: m.total_spend ?? 0 }));
    const stat = data?.summary?.total_spend;
    return (
      <>
        {stat != null && <p className="text-xs font-bold mb-1" style={{ color }}>{fmt$(stat)} spend</p>}
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={72}>
            <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip content={<MiniTooltip formatter={fmt$} />} />
              <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </>
    );
  }

  if (reportId === "equipment-repair") {
    const rows = (data?.by_month ?? []).slice(-6).map((m: any) => ({ month: (m.month ?? "").slice(0, 7), v: m.total_cost ?? 0 }));
    const stat = data?.summary?.total_cost;
    return (
      <>
        {stat != null && <p className="text-xs font-bold mb-1" style={{ color }}>{fmt$(stat)} total</p>}
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={72}>
            <LineChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip content={<MiniTooltip formatter={fmt$} />} />
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </>
    );
  }

  if (reportId === "material-shortages") {
    const total = data?.total ?? 0;
    return (
      <div className="flex flex-col items-center justify-center h-20 gap-1">
        <p className="text-3xl font-bold" style={{ color }}>{total}</p>
        <p className="text-[10px] text-muted-foreground">shortages reported</p>
      </div>
    );
  }

  return <EmptyChart />;
}

// ── Single mini card ──────────────────────────────────────────────────────────
function PinnedReportCard({ reportId, onUnpin }: { reportId: string; onUnpin: () => void }) {
  const [, navigate] = useLocation();
  const meta = REPORT_META[reportId];

  // Standard app query pattern: URL-only key, default getQueryFn handles the fetch
  const { data, isLoading } = useQuery<any>({
    queryKey: [meta.endpoint],
  });

  const Icon = meta.icon;

  return (
    <div
      className="group relative border rounded-xl p-3 bg-card hover:shadow-md transition-all"
      data-testid={`pinned-report-card-${reportId}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          className="flex items-center gap-1.5 min-w-0 hover:underline"
          onClick={() => navigate(`/reports?tab=${reportId}`)}
          data-testid={`link-report-${reportId}`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
          <span className="text-xs font-semibold truncate">{meta.label}</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
        </button>
        <button
          onClick={onUnpin}
          className={cn(
            "p-1 rounded text-amber-500 hover:text-muted-foreground transition-colors shrink-0 ml-1"
          )}
          title="Unpin from dashboard"
          data-testid={`button-unpin-report-${reportId}`}
        >
          <Star className="h-3 w-3 fill-current" />
        </button>
      </div>

      {/* Chart / stat */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[72px]">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <MiniChartContent reportId={reportId} data={data} />
      )}
    </div>
  );
}

// ── Section — rendered in Home.tsx ────────────────────────────────────────────
export function PinnedReportsSection() {
  // Standard app pattern: URL-only key lets the default getQueryFn fetch /api/favorites
  const { favorites, toggleFavorite } = useFavorites("report");
  const pinnedReports = favorites.filter((f) => REPORT_META[f.entity_id]);

  if (pinnedReports.length === 0) return null;

  return (
    <div data-testid="pinned-reports-section">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
        <h2 className="text-sm font-semibold text-foreground">Pinned Reports</h2>
        <span className="text-xs text-muted-foreground">— click any chart to open the full report</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {pinnedReports.map((fav) => (
          <PinnedReportCard
            key={fav.entity_id}
            reportId={fav.entity_id}
            onUnpin={() => toggleFavorite("report", fav.entity_id)}
          />
        ))}
      </div>
    </div>
  );
}
