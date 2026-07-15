import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  Database,
  Mail,
  MessageSquare,
  HardDrive,
  Cpu,
  Archive,
  Clock,
  AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubsystemStatus = "operational" | "degraded" | "not_configured" | "down";

interface Subsystem {
  key: string;
  label: string;
  status: SubsystemStatus;
  detail: string;
  lastChecked: string;
}

interface ErrorEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  message: string;
}

interface SlowEntry {
  timestamp: string;
  method: string;
  path: string;
  durationMs: number;
}

interface SystemHealthResponse {
  subsystems: Subsystem[];
  recentErrors: ErrorEntry[];
  slowRequests: SlowEntry[];
  generatedAt: string;
}

// ── Sub-component helpers ─────────────────────────────────────────────────────

function StatusPill({ status }: { status: SubsystemStatus }) {
  const configs: Record<SubsystemStatus, { label: string; className: string; icon: React.ReactNode }> = {
    operational: {
      label: "Operational",
      className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    degraded: {
      label: "Degraded",
      className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    not_configured: {
      label: "Not Configured",
      className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
      icon: <MinusCircle className="h-3 w-3" />,
    },
    down: {
      label: "Down",
      className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
      icon: <XCircle className="h-3 w-3" />,
    },
  };

  const cfg = configs[status] ?? configs.not_configured;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

const SUBSYSTEM_ICONS: Record<string, React.ReactNode> = {
  database: <Database className="h-4 w-4" />,
  email:    <Mail className="h-4 w-4" />,
  sms:      <MessageSquare className="h-4 w-4" />,
  storage:  <HardDrive className="h-4 w-4" />,
  ai:       <Cpu className="h-4 w-4" />,
  backups:  <Archive className="h-4 w-4" />,
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
    hour12: true,
  });
}

function fmtDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const { user } = useAuth();

  if (!user || (user.role !== "Admin" && !(user as any).isMasterAdmin)) {
    return <Redirect to="/admin" />;
  }

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery<SystemHealthResponse>({
    queryKey: ["/api/admin/system-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/system-health", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const overallStatus: SubsystemStatus = (() => {
    if (!data) return "not_configured";
    if (data.subsystems.some(s => s.status === "down")) return "down";
    if (data.subsystems.some(s => s.status === "degraded")) return "degraded";
    if (data.subsystems.every(s => s.status === "operational" || s.status === "not_configured")) return "operational";
    return "operational";
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="system-health-title">System Health</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live configuration &amp; liveness check — read-only, no test calls made.
          </p>
          {data && (
            <p className="text-xs text-muted-foreground mt-1">
              Generated: {fmt(data.generatedAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Overall:</span>
              <StatusPill status={overallStatus} />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="btn-refresh-health"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Checking…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Subsystem cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="subsystem-grid">
          {data.subsystems.map(sub => (
            <Card
              key={sub.key}
              data-testid={`subsystem-card-${sub.key}`}
              className={
                sub.status === "down"
                  ? "border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10"
                  : sub.status === "degraded"
                  ? "border-amber-300 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/10"
                  : ""
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={
                      sub.status === "operational" ? "text-green-600"
                        : sub.status === "down" ? "text-red-600"
                        : "text-amber-600"
                    }>
                      {SUBSYSTEM_ICONS[sub.key] ?? <AlertCircle className="h-4 w-4" />}
                    </span>
                    <span className="font-semibold text-sm">{sub.label}</span>
                  </div>
                  <StatusPill status={sub.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{sub.detail}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Checked {fmt(sub.lastChecked)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Errors */}
      {data && (
        <Card data-testid="recent-errors-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Recent 5xx Errors
              <Badge variant="secondary" className="ml-1 text-xs">{data.recentErrors.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentErrors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No 5xx errors recorded since last server start.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {data.recentErrors.map((e, i) => (
                  <div
                    key={i}
                    data-testid={`error-entry-${i}`}
                    className="flex items-start gap-2 text-xs border rounded px-2 py-1.5 bg-red-50/40 dark:bg-red-950/10 border-red-200 dark:border-red-900"
                  >
                    <Badge variant="destructive" className="text-[10px] shrink-0 px-1.5 py-0">{e.status}</Badge>
                    <span className="font-mono text-muted-foreground shrink-0">{e.method}</span>
                    <span className="font-mono truncate flex-1 text-foreground">{e.path}</span>
                    <span className="text-muted-foreground shrink-0">{fmt(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Slow Requests */}
      {data && (
        <Card data-testid="slow-requests-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Slowest Recent Requests <span className="font-normal text-muted-foreground">(≥ 2 s)</span>
              <Badge variant="secondary" className="ml-1 text-xs">{data.slowRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.slowRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No slow requests recorded since last server start.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {data.slowRequests.map((r, i) => (
                  <div
                    key={i}
                    data-testid={`slow-entry-${i}`}
                    className="flex items-start gap-2 text-xs border rounded px-2 py-1.5 bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900"
                  >
                    <Badge className="text-[10px] shrink-0 px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                      {fmtDuration(r.durationMs)}
                    </Badge>
                    <span className="font-mono text-muted-foreground shrink-0">{r.method}</span>
                    <span className="font-mono truncate flex-1 text-foreground">{r.path}</span>
                    <span className="text-muted-foreground shrink-0">{fmt(r.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !data && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Could not load system health data.
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
          </div>
        </div>
      )}
    </div>
  );
}
