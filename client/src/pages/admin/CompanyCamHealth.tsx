import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Clock, Zap } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface EventCounts { total: number; success: number; failed: number }
interface RecentEvent { id: string; event_type: string; success: boolean; error_message: string | null; received_at: string }
interface HealthData {
  last_success_at: string | null;
  is_healthy: boolean;
  counts_24h: EventCounts;
  counts_7d: EventCounts;
  recent_events: RecentEvent[];
  event_type_breakdown_24h: { event_type: string; total: number; success: number }[];
}

function SuccessRate({ counts }: { counts: EventCounts }) {
  if (counts.total === 0) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round((counts.success / counts.total) * 100);
  return (
    <span className={cn("font-medium", pct === 100 ? "text-green-600" : pct >= 80 ? "text-yellow-600" : "text-red-600")}>
      {pct}%
    </span>
  );
}

export default function CompanyCamHealth() {
  const qc = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["/api/admin/companycam/webhook-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/companycam/webhook-health", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load health data");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const lastRefreshed = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">CompanyCam Webhook Health</h1>
            <p className="text-sm text-muted-foreground">
              Incoming webhook event tracking and success monitoring
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/companycam/webhook-health"] })}
          data-testid="btn-refresh-health"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
          {lastRefreshed && <span className="ml-2 text-muted-foreground text-xs">· {lastRefreshed}</span>}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading health data…
          </div>
        ) : !data ? null : (
          <>
            {/* ── Health status banner ───────────────────────────────────── */}
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                data.is_healthy
                  ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
              )}
              data-testid="health-banner"
            >
              {data.is_healthy
                ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                : <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />}
              <div>
                <p className={cn("font-medium text-sm",
                  data.is_healthy ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300")}>
                  {data.is_healthy ? "Webhook connection healthy" : "No recent successful events"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.last_success_at
                    ? `Last successful event ${formatDistanceToNow(new Date(data.last_success_at), { addSuffix: true })}`
                    : "No successful events recorded yet"}
                </p>
              </div>
            </div>

            {/* ── Stats cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Last Success
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold" data-testid="stat-last-success">
                      {data.last_success_at
                        ? formatDistanceToNow(new Date(data.last_success_at), { addSuffix: true })
                        : "Never"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    24h Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4 space-y-0.5">
                  <div className="text-sm font-semibold" data-testid="stat-24h-total">{data.counts_24h.total} total</div>
                  <div className="text-xs text-muted-foreground">
                    {data.counts_24h.success} ok · {data.counts_24h.failed} failed ·{" "}
                    <SuccessRate counts={data.counts_24h} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    7-Day Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4 space-y-0.5">
                  <div className="text-sm font-semibold" data-testid="stat-7d-total">{data.counts_7d.total} total</div>
                  <div className="text-xs text-muted-foreground">
                    {data.counts_7d.success} ok · {data.counts_7d.failed} failed ·{" "}
                    <SuccessRate counts={data.counts_7d} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Event Types (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  {data.event_type_breakdown_24h.length === 0 ? (
                    <span className="text-sm text-muted-foreground">None</span>
                  ) : (
                    <div className="space-y-0.5">
                      {data.event_type_breakdown_24h.slice(0, 3).map((e) => (
                        <div key={e.event_type} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate max-w-[100px]">{e.event_type}</span>
                          <span className="font-medium ml-2">{e.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Recent events table ───────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Recent Events
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {data.recent_events.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No webhook events recorded yet.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase">Status</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase">Event Type</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase">Received</th>
                          <th className="pb-2 font-medium text-muted-foreground text-xs uppercase">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent_events.map((ev) => (
                          <tr key={ev.id} className="border-b last:border-0" data-testid={`event-row-${ev.id}`}>
                            <td className="py-2 pr-4">
                              {ev.success ? (
                                <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30 text-xs">
                                  OK
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:bg-red-950/30 text-xs">
                                  Failed
                                </Badge>
                              )}
                            </td>
                            <td className="py-2 pr-4 font-mono text-xs">{ev.event_type}</td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(ev.received_at), "MMM d, h:mm:ss a")}
                            </td>
                            <td className="py-2 text-xs text-red-600 max-w-[240px] truncate">
                              {ev.error_message ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
