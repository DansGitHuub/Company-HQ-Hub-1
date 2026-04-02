import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, Square, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimeEntry {
  id: string;
  user_id: string;
  job_id: string | null;
  job_name: string | null;
  clock_in: string;
  clock_out: string | null;
  entry_type: string;
}

interface Job { id: string; client: string; type: string; }

const ENTRY_TYPES = [
  { value: "billable",     label: "Billable Job" },
  { value: "non_billable", label: "Non-Billable" },
  { value: "drive_time",   label: "Drive Time" },
  { value: "break",        label: "Break" },
  { value: "shop_time",    label: "Shop Time" },
  { value: "meeting",      label: "Meeting" },
];

// ── Elapsed time hook ─────────────────────────────────────────────────────────
function useElapsed(clockIn: string | null) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!clockIn) { setElapsed(""); return; }
    const tick = () => {
      const ms = Date.now() - new Date(clockIn).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setElapsed(h > 0
        ? `${h}h ${String(m).padStart(2, "0")}m`
        : `${m}m ${String(s).padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockIn]);
  return elapsed;
}

// ── GPS Pinger ────────────────────────────────────────────────────────────────
function useGpsPinger(activeEntry: TimeEntry | null) {
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendPing = useCallback((entryId: string) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        apiRequest("POST", "/api/gps/ping", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          time_entry_id: entryId,
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    if (activeEntry) {
      sendPing(activeEntry.id);                    // immediate first ping
      pingRef.current = setInterval(() => sendPing(activeEntry.id), 60_000);
    }
    return () => { if (pingRef.current) clearInterval(pingRef.current); };
  }, [activeEntry?.id]);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TimeClock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState("billable");
  const [selectedJob, setSelectedJob] = useState("");

  // Active entry
  const { data: activeEntry = null } = useQuery<TimeEntry | null>({
    queryKey: ["/api/time/active"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/time/active");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // Jobs for selector — only show scheduled or in-progress jobs
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs", "active"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs?status=scheduled,in_progress");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !activeEntry,
  });

  const elapsed = useElapsed(activeEntry?.clock_in ?? null);
  useGpsPinger(activeEntry);

  // Clock in
  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/time/clock-in", {
        entry_type: entryType,
        job_id: selectedJob || undefined,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time/entries"] });
      toast({ title: "Clocked in" });
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  // Clock out
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/time/clock-out", {
        time_entry_id: activeEntry!.id,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time/entries"] });
      toast({ title: "Clocked out" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  // ── Clocked In State ──
  if (activeEntry) {
    return (
      <div className="flex items-center gap-1.5" data-testid="timeclock-active">
        <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-600 dark:text-green-400 rounded-full px-3 py-1.5 text-xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          {elapsed}
          {activeEntry.job_name && (
            <span className="hidden sm:inline text-green-600/70 dark:text-green-400/70 font-normal">
              · {activeEntry.job_name}
            </span>
          )}
        </div>
        <button
          onClick={() => clockOutMutation.mutate()}
          disabled={clockOutMutation.isPending}
          title="Clock Out"
          className="h-7 w-7 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
          data-testid="button-clock-out"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>
    );
  }

  // ── Clocked Out State ──
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          data-testid="button-clock-in-trigger"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clock In</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end" data-testid="popover-clock-in">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Clock In</p>

          {/* Entry Type */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Entry Type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="select-entry-type"
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Job (optional) */}
          {(entryType === "billable" || entryType === "non_billable") && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Job <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="select-job"
              >
                <option value="">No specific job</option>
                {jobs.slice(0, 50).map((j) => (
                  <option key={j.id} value={j.id}>{j.client}</option>
                ))}
              </select>
            </div>
          )}

          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white h-9"
            onClick={() => clockInMutation.mutate()}
            disabled={clockInMutation.isPending}
            data-testid="button-clock-in-confirm"
          >
            {clockInMutation.isPending ? "Clocking in…" : "Clock In"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
