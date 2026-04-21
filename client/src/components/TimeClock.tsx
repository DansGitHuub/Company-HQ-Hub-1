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
  work_area_name: string | null;
}

interface Job { id: string; client: string; title: string | null; }

interface WorkAreaType {
  id: string; name: string; division: string | null; sort_order: number;
}

interface JobWorkArea {
  id: string; name: string; estimated_hours: string | null; status: string;
}

interface WorkAreasResponse {
  globalAreas: WorkAreaType[];
  jobAreas: JobWorkArea[];
  allTypes: WorkAreaType[];
}

// ── Fallback general options if DB returns nothing ────────────────────────────
const FALLBACK_GENERAL = ["On Site", "Drive Time", "Shop Time", "Meeting", "Break"];

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
function useGpsPinger(activeEntry: TimeEntry | null, setGpsLost: (v: boolean) => void) {
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
    let watchId: number | null = null;
    if (activeEntry) {
      sendPing(activeEntry.id);
      pingRef.current = setInterval(() => sendPing(activeEntry.id), 60_000);
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          () => { setGpsLost(false); },
          () => { setGpsLost(true); },
          { enableHighAccuracy: false, timeout: 30000 }
        );
      }
    } else {
      setGpsLost(false);
    }
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeEntry?.id]);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TimeClock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedWorkArea, setSelectedWorkArea] = useState("");
  const [gpsChecking, setGpsChecking] = useState(false);
  const [gpsLost, setGpsLost] = useState(false);

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

  // Jobs — only scheduled or in-progress
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs", "active"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs?status=scheduled,in_progress");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !activeEntry,
  });

  // Unified work areas — fetched whenever the popover is open (re-fetches when job changes)
  const { data: workAreasData } = useQuery<WorkAreasResponse>({
    queryKey: ["/api/work-areas", selectedJob],
    queryFn: async () => {
      const url = selectedJob
        ? `/api/work-areas?jobId=${selectedJob}`
        : "/api/work-areas";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    enabled: open && !activeEntry,
  });

  const globalAreas = workAreasData?.globalAreas ?? [];
  const jobWorkAreas = workAreasData?.jobAreas ?? [];
  const allTypes = workAreasData?.allTypes ?? [];

  const elapsed = useElapsed(activeEntry?.clock_in ?? null);
  useGpsPinger(activeEntry, setGpsLost);

  // Reset work area when job changes
  useEffect(() => { setSelectedWorkArea(""); }, [selectedJob]);

  // Build the work area options shown in the dropdown
  // Format: encoded string "job:ID:NAME" or "type:ID:NAME" or "general:ID:NAME"
  function buildWorkAreaOptions(): Array<{ value: string; label: string; group: string }> {
    const opts: Array<{ value: string; label: string; group: string }> = [];

    // Build the global (General division) options list
    const generalOpts: Array<{ value: string; label: string; group: string }> = [];
    if (globalAreas.length > 0) {
      globalAreas.forEach((t) => {
        generalOpts.push({ value: `general:${t.id}:${t.name}`, label: t.name, group: "General" });
      });
    } else {
      // Fallback if DB hasn't loaded yet
      FALLBACK_GENERAL.forEach((name) => {
        generalOpts.push({ value: `general::${name}`, label: name, group: "General" });
      });
    }

    if (selectedJob) {
      if (jobWorkAreas.length > 0) {
        // Job has specific areas → show job areas FIRST, then global areas
        jobWorkAreas.forEach((jwa) => {
          opts.push({ value: `job:${jwa.id}:${jwa.name}`, label: jwa.name, group: "Job Work Areas" });
        });
        opts.push(...generalOpts);
      } else {
        // No job-specific areas → show global areas, then fall back to all non-General types
        opts.push(...generalOpts);
        const grouped = allTypes.filter((t) => t.division !== "General");
        const divisions = Array.from(new Set(grouped.map((t) => t.division ?? "Other")));
        divisions.forEach((div) => {
          grouped.filter((t) => (t.division ?? "Other") === div).forEach((t) => {
            opts.push({ value: `type:${t.id}:${t.name}`, label: t.name, group: div });
          });
        });
      }
    } else {
      // No job selected → global areas only
      opts.push(...generalOpts);
    }

    return opts;
  }

  function parseWorkAreaValue(val: string) {
    const [kind, id, ...rest] = val.split(":");
    const name = rest.join(":");
    if (kind === "job") return { job_work_area_id: id, work_area_name: name };
    return { job_work_area_id: undefined, work_area_name: name };
  }

  const workAreaOptions = buildWorkAreaOptions();

  // Clock in
  // Alert when GPS is lost while clocked in
  useEffect(() => {
    if (gpsLost && activeEntry) {
      toast({ title: "GPS signal lost", description: "Location has been disabled. GPS is required while clocked in — please re-enable it.", variant: "destructive" });
    }
  }, [gpsLost]);

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkArea) throw new Error("Please select a work area.");
      const { job_work_area_id, work_area_name } = parseWorkAreaValue(selectedWorkArea);
      const res = await apiRequest("POST", "/api/time/clock-in", {
        job_id: selectedJob || undefined,
        job_work_area_id: job_work_area_id || undefined,
        work_area_name,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time/entries"] });
      toast({ title: "Clocked in" });
      setOpen(false);
      setSelectedJob("");
      setSelectedWorkArea("");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleClockIn = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS required", description: "This device does not support location. GPS is required to clock in.", variant: "destructive" });
      return;
    }
    setGpsChecking(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsChecking(false);
        clockInMutation.mutate();
      },
      () => {
        setGpsChecking(false);
        toast({ title: "GPS required", description: "Location access was denied. Please enable GPS for this app and try again.", variant: "destructive" });
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

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
    const displayLabel = activeEntry.work_area_name || activeEntry.job_name;
    return (
      <div className="flex items-center gap-1.5" data-testid="timeclock-active">
        <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-600 dark:text-green-400 rounded-full px-3 py-1.5 text-xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          {elapsed}
          {displayLabel && (
            <span className="hidden sm:inline text-green-600/70 dark:text-green-400/70 font-normal">
              · {displayLabel}
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
  // Group work area options by group label
  const optionGroups = workAreaOptions.reduce<Record<string, typeof workAreaOptions>>((acc, o) => {
    (acc[o.group] = acc[o.group] ?? []).push(o);
    return acc;
  }, {});

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
      <PopoverContent className="w-72 p-3" align="end" data-testid="popover-clock-in">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Clock In</p>

          {/* Job selector */}
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
                <option key={j.id} value={j.id}>{j.title || j.client}</option>
              ))}
            </select>
          </div>

          {/* Work Area selector */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Work Area *</label>
            <select
              value={selectedWorkArea}
              onChange={(e) => setSelectedWorkArea(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="select-work-area"
            >
              <option value="">Select work area…</option>
              {Object.entries(optionGroups).map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white h-9"
            onClick={handleClockIn}
            disabled={clockInMutation.isPending || gpsChecking || !selectedWorkArea}
            data-testid="button-clock-in-confirm"
          >
            {gpsChecking ? "Getting GPS…" : clockInMutation.isPending ? "Clocking in…" : "Clock In"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
