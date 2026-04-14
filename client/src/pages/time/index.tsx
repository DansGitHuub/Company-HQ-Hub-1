import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, Briefcase, Timer, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import TimeClock from "@/components/TimeClock";
import OfflineBanner from "@/components/OfflineBanner";

interface TimeEntry {
  id: string;
  user_id: string;
  job_id: string | null;
  job_name: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  entry_type: string;
  work_area_name: string | null;
  notes: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  billable:     "Billable",
  non_billable: "Non-Billable",
  drive_time:   "Drive Time",
  break:        "Break",
  shop_time:    "Shop Time",
  meeting:      "Meeting",
};

const TYPE_COLORS: Record<string, string> = {
  billable:     "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  non_billable: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  drive_time:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  break:        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  shop_time:    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  meeting:      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

function fmtMinutes(mins: number | null) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(iso: string) {
  return format(parseISO(iso), "h:mm a");
}

export default function TimeTrackingPage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data: entries = [], isLoading, refetch } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time/entries", date],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/time/entries?date=${date}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const totalBillable = entries
    .filter((e) => e.entry_type === "billable" && e.duration_minutes)
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

  const totalTime = entries
    .filter((e) => e.duration_minutes)
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

  const openEntry = entries.find((e) => !e.clock_out);

  const changeDate = (delta: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(format(d, "yyyy-MM-dd"));
  };

  const isToday = date === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <OfflineBanner />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your time entries and clock history
          </p>
        </div>
        {/* Clock widget (also in header but handy here too) */}
        <div className="flex items-center gap-2">
          <TimeClock />
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDate(-1)}
          data-testid="button-prev-day">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40 h-8 text-sm"
          data-testid="input-date"
        />
        <Button variant="outline" size="icon" className="h-8 w-8"
          onClick={() => changeDate(1)} disabled={isToday}
          data-testid="button-next-day">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isToday && (
          <Button variant="ghost" size="sm" className="text-xs h-8"
            onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}>
            Today
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Timer className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Time</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-total-time">{fmtMinutes(totalTime || null)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Briefcase className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Billable</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-billable-time">{fmtMinutes(totalBillable || null)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Entries</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-entries">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium uppercase tracking-wide">Status</span>
            </div>
            <p className="text-sm font-semibold mt-1" data-testid="stat-status">
              {openEntry
                ? <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse inline-block" />
                    Clocked In
                  </span>
                : <span className="text-muted-foreground">Clocked Out</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entries table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isToday ? "Today's Entries" : `Entries for ${format(new Date(date + "T12:00:00"), "MMMM d, yyyy")}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading entries…</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No time entries for this day.</p>
              {isToday && (
                <p className="text-xs text-muted-foreground mt-1">Use the Clock In button to start tracking time.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Work Area</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}
                    className={!entry.clock_out ? "bg-green-50/50 dark:bg-green-900/10" : ""}>
                    <TableCell className="font-medium text-sm">
                      {fmtTime(entry.clock_in)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.clock_out
                        ? fmtTime(entry.clock_out)
                        : <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            Active
                          </span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {entry.clock_out
                        ? fmtMinutes(entry.duration_minutes)
                        : <RunningTimer clockIn={entry.clock_in} />}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {entry.work_area_name || TYPE_LABELS[entry.entry_type] || entry.entry_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.job_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                      {entry.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Running timer for active entry in the table
function RunningTimer({ clockIn }: { clockIn: string }) {
  const [display, setDisplay] = useState("");
  React.useEffect(() => {
    const tick = () => {
      const ms = Date.now() - new Date(clockIn).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setDisplay(h > 0
        ? `${h}h ${String(m).padStart(2, "0")}m`
        : `${m}m ${String(s).padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockIn]);
  return <span className="text-green-600 dark:text-green-400">{display}</span>;
}
