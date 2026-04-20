import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";

// ─── Pay period + date helpers ────────────────────────────────────────────────

function getPayPeriod(biweekOffset = 0): { start: string; end: string } {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const daysSinceSat = dow === 6 ? 0 : dow + 1;
  const endDate = new Date(now);
  endDate.setDate(now.getDate() - daysSinceSat - biweekOffset * 14);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 13);
  return {
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
  };
}

function getThisMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().split("T")[0],
    end: now.toISOString().split("T")[0],
  };
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

function formatPayPeriodRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  return `${s.toLocaleDateString([], { month: "short", day: "numeric" })} – ${e.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatDateHeader(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<string, string> = {
  billable: "Billable",
  drive_time: "Drive",
  shop_time: "Shop",
  break: "Break",
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  billable: "bg-green-100 text-green-700",
  drive_time: "bg-blue-100 text-blue-700",
  shop_time: "bg-purple-100 text-purple-700",
  break: "bg-gray-100 text-gray-600",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyHoursPage() {
  const { pendingCount } = useOfflineSync();
  const thisPP = getPayPeriod(0);
  const [startDate, setStartDate] = useState(thisPP.start);
  const [endDate, setEndDate] = useState(thisPP.end);
  const [page, setPage] = useState(1);

  // Current pay period summary (always fixed to current pay period)
  const { data: ppData, isLoading: ppLoading } = useQuery<any>({
    queryKey: ["/api/time/my-hours/pay-period"],
    queryFn: () =>
      apiRequest("GET", "/api/time/my-hours/pay-period").then((r) => r.json()),
    staleTime: 60_000,
  });

  // Paginated entries for the selected date range
  const { data: hoursData, isLoading: hoursLoading, refetch } = useQuery<any>({
    queryKey: ["/api/time/my-hours", startDate, endDate, page],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/time/my-hours?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=50`
      ).then((r) => r.json()),
    staleTime: 30_000,
    enabled: !!startDate && !!endDate,
  });

  const entries: any[] = hoursData?.entries ?? [];
  const summary = hoursData?.summary;
  const totalPages: number = hoursData?.totalPages ?? 1;

  // Group entries by calendar date
  const grouped: Record<string, any[]> = {};
  for (const entry of entries) {
    const day = new Date(entry.clock_in).toISOString().split("T")[0];
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(entry);
  }
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function applyQuickSelect(type: "this-pp" | "last-pp" | "this-month") {
    setPage(1);
    if (type === "this-pp") {
      const pp = getPayPeriod(0);
      setStartDate(pp.start);
      setEndDate(pp.end);
    } else if (type === "last-pp") {
      const pp = getPayPeriod(1);
      setStartDate(pp.start);
      setEndDate(pp.end);
    } else {
      const m = getThisMonth();
      setStartDate(m.start);
      setEndDate(m.end);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-12 pt-4 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="my-hours-title" className="text-2xl font-bold text-gray-900">
            My Hours
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Your time history</p>
        </div>
        <button
          data-testid="refresh-button"
          onClick={() => refetch()}
          className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Pay Period Summary Card ──────────────────────────────────────── */}
      <Card data-testid="pay-period-card" className="border-l-4 border-l-green-500 shadow-sm">
        <CardContent className="pt-5 pb-5">
          {ppLoading ? (
            <div className="space-y-3">
              <div className="h-3 bg-gray-100 rounded animate-pulse w-40" />
              <div className="h-10 bg-gray-100 rounded animate-pulse w-28" />
              <div className="flex gap-4">
                <div className="h-6 bg-gray-100 rounded animate-pulse w-16" />
                <div className="h-6 bg-gray-100 rounded animate-pulse w-12" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center flex-wrap gap-2 mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Current Pay Period
                </p>
                {ppData?.payPeriodStart && (
                  <span className="text-xs text-gray-400">
                    {formatPayPeriodRange(ppData.payPeriodStart, ppData.payPeriodEnd)}
                  </span>
                )}
                {pendingCount > 0 && (
                  <Badge
                    data-testid="pending-sync-badge"
                    className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 border border-yellow-300"
                  >
                    ⚡ {pendingCount} pending sync
                  </Badge>
                )}
              </div>

              <div className="flex items-end gap-8 flex-wrap">
                <div>
                  <p data-testid="pp-total-hours" className="text-4xl font-bold text-gray-900 tabular-nums">
                    {ppData?.summary?.totalHours ?? "0.00"}
                    <span className="text-lg font-normal text-gray-400 ml-1">hrs</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Total Worked</p>
                </div>
                <div className="flex gap-6 pb-1">
                  <div>
                    <p data-testid="pp-regular-hours" className="text-xl font-semibold text-gray-700 tabular-nums">
                      {ppData?.summary?.regularHours ?? "0.00"}h
                    </p>
                    <p className="text-xs text-gray-400">Regular</p>
                  </div>
                  {(ppData?.summary?.overtimeHours ?? 0) > 0 && (
                    <div>
                      <p data-testid="pp-ot-hours" className="text-xl font-semibold text-amber-600 tabular-nums">
                        {ppData?.summary?.overtimeHours}h
                      </p>
                      <p className="text-xs text-amber-500">Overtime</p>
                    </div>
                  )}
                  <div>
                    <p data-testid="pp-days-worked" className="text-xl font-semibold text-gray-700 tabular-nums">
                      {ppData?.summary?.daysWorked ?? 0}
                    </p>
                    <p className="text-xs text-gray-400">Days</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Date Range Picker ────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              data-testid="quick-this-pp"
              onClick={() => applyQuickSelect("this-pp")}
            >
              This Pay Period
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="quick-last-pp"
              onClick={() => applyQuickSelect("last-pp")}
            >
              Last Pay Period
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="quick-this-month"
              onClick={() => applyQuickSelect("this-month")}
            >
              This Month
            </Button>
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                data-testid="input-start-date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                data-testid="input-end-date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {summary && !hoursLoading && (
            <p className="text-xs text-gray-400">
              <span className="font-medium text-gray-600">{summary.totalHours}h</span> logged ·{" "}
              <span className="font-medium text-gray-600">{summary.daysWorked}</span> days ·{" "}
              {hoursData?.totalCount ?? 0} entries
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Entries List ─────────────────────────────────────────────────── */}
      <section>
        {hoursLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-14 text-center">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No time entries for this period</p>
              <p className="text-gray-300 text-sm mt-1">Try a different date range</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {sortedDays.map((day) => {
              const dayEntries = grouped[day];
              const dayMinutes = dayEntries.reduce(
                (s: number, e: any) => s + (e.duration_minutes ?? 0),
                0
              );

              return (
                <div key={day}>
                  <div className="flex items-center justify-between mb-2">
                    <h3
                      data-testid={`date-header-${day}`}
                      className="text-xs font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {formatDateHeader(day)}
                    </h3>
                    <span className="text-xs text-gray-400 font-medium">
                      {formatDuration(dayMinutes)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayEntries.map((entry: any) => (
                      <div
                        key={entry.id}
                        data-testid={`entry-${entry.id}`}
                        className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {entry.work_area_name || entry.job_title || "General"}
                            </p>
                            <Badge
                              className={`text-[10px] px-1.5 py-0 ${
                                ENTRY_TYPE_COLORS[entry.entry_type] ?? "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                            </Badge>
                          </div>
                          {entry.job_title && entry.work_area_name && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {entry.job_title}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatTime(entry.clock_in)}
                            {entry.clock_out ? ` → ${formatTime(entry.clock_out)}` : ""}
                          </p>
                        </div>

                        <div className="ml-3 shrink-0 text-right">
                          {!entry.clock_out ? (
                            <div
                              data-testid={`entry-active-${entry.id}`}
                              className="flex items-center gap-1.5 text-green-600 text-xs font-semibold"
                            >
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              In progress
                            </div>
                          ) : (
                            <span
                              data-testid={`entry-duration-${entry.id}`}
                              className="text-sm font-semibold text-gray-700"
                            >
                              {formatDuration(entry.duration_minutes)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              data-testid="pagination-prev"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              data-testid="pagination-next"
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
