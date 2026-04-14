import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clockIn, clockOut, getActiveSession } from "@/lib/timeApi";
import OfflineBanner from "@/components/OfflineBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  Clock,
  Sun,
  Coffee,
  Car,
  Wrench,
  LogOut as ClockOutIcon,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkArea {
  id: string;
  name: string;
  status: string | null;
  estimated_hours: number | null;
}

interface MyDayJob {
  id: string;
  title: string;
  status: string;
  division: string | null;
  color: string | null;
  client: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  customer_name: string | null;
  customer_address: string | null;
  work_areas: WorkArea[];
}

interface TimeEntry {
  id: string;
  user_id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  entry_type: string;
  work_area_name: string | null;
  job_work_area_id: string | null;
  job_title: string | null;
}

interface PendingClockIn {
  jobId: string;
  jobTitle: string;
  workAreaId: string | null;
  workAreaName: string;
  entryType: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DIVISION_COLORS: Record<string, string> = {
  maintenance: "#22c55e",
  install: "#3b82f6",
  snow: "#94a3b8",
  general: "#f59e0b",
};

function divisionColor(division: string | null): string {
  if (!division) return "#e5e7eb";
  return DIVISION_COLORS[division.toLowerCase()] ?? "#e5e7eb";
}

function greeting(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function useLiveElapsed(clockIn: string | null): string {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!clockIn) { setElapsed(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(clockIn).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockIn]);
  return elapsed;
}

// ─── Quick-chip row (Drive Time, Shop Time, Break) ────────────────────────────
const QUICK_CHIPS = [
  { label: "Drive Time", entryType: "drive_time", icon: Car },
  { label: "Shop Time", entryType: "shop_time", icon: Wrench },
  { label: "Break", entryType: "break", icon: Coffee },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyDayPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingClockIn | null>(null);
  const [gpsChecking, setGpsChecking] = useState(false);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<MyDayJob[]>({
    queryKey: ["/api/my-day"],
    refetchInterval: 60_000,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/my-day/time-entries"],
    refetchInterval: 30_000,
  });

  const { data: activeEntry } = useQuery<any | null>({
    queryKey: ["/api/time/active"],
    queryFn: () => getActiveSession(),
    refetchInterval: 30_000,
  });

  const elapsed = useLiveElapsed(activeEntry?.clock_in ?? null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const clockInMutation = useMutation({
    mutationFn: async (p: PendingClockIn) => {
      // Auto-clock-out if active
      if (activeEntry) {
        const coPayload = activeEntry.isOffline
          ? { local_clock_in_id: activeEntry.localId }
          : { time_entry_id: activeEntry.id };
        await clockOut(coPayload);
      }
      const result = await clockIn({
        job_id: p.jobId || undefined,
        job_work_area_id: p.workAreaId || undefined,
        work_area_name: p.workAreaName,
        entry_type: p.entryType,
      });
      if (!result.success) throw new Error(result.error ?? "Clock-in failed");
      return result;
    },
    onSuccess: (result: any) => {
      const offlineMsg = result?.offline ? " (saved offline)" : "";
      toast({ title: `Clocked in${offlineMsg}!`, description: `Now working on ${pending?.workAreaName}` });
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["/api/time/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-day/time-entries"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry) return;
      const payload = activeEntry.isOffline
        ? { local_clock_in_id: activeEntry.localId }
        : { time_entry_id: activeEntry.id };
      const result = await clockOut(payload);
      if (!result.success) throw new Error(result.error ?? "Clock-out failed");
      return result;
    },
    onSuccess: (result: any) => {
      const offlineMsg = result?.offline ? " (saved offline)" : "";
      toast({ title: `Clocked out${offlineMsg}!` });
      queryClient.invalidateQueries({ queryKey: ["/api/time/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-day/time-entries"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleMyDayClockIn = () => {
    if (!pending) return;
    if (!navigator.geolocation) {
      toast({ title: "GPS required", description: "This device does not support location. GPS is required to clock in.", variant: "destructive" });
      return;
    }
    setGpsChecking(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsChecking(false);
        clockInMutation.mutate(pending);
      },
      () => {
        setGpsChecking(false);
        toast({ title: "GPS required", description: "Location access was denied. Please enable GPS for this app and try again.", variant: "destructive" });
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const firstName = user?.firstName || user?.username || "there";

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 pb-12 pt-4 space-y-6">
      <OfflineBanner />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 data-testid="my-day-greeting" className="text-2xl font-bold text-gray-900">
          {greeting(firstName)}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatDate(new Date())}</p>
      </div>

      {/* ── Active Entry Banner ─────────────────────────────────────────── */}
      {activeEntry && (
        <div
          data-testid="active-entry-banner"
          className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-green-700 font-semibold text-sm flex items-center gap-1.5 truncate">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              {activeEntry.work_area_name || activeEntry.entry_type}
              {activeEntry.job_title && (
                <span className="text-green-600 font-normal">· {activeEntry.job_title}</span>
              )}
              {activeEntry.isOffline && (
                <Badge
                  data-testid="badge-offline-entry"
                  className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 border border-yellow-300"
                >
                  ⚡ Offline
                </Badge>
              )}
            </p>
            <p className="text-green-600 text-xs mt-0.5">{elapsed}</p>
          </div>
          <Button
            data-testid="clock-out-button"
            size="sm"
            variant="outline"
            className="border-green-400 text-green-700 hover:bg-green-100 shrink-0"
            onClick={() => clockOutMutation.mutate()}
            disabled={clockOutMutation.isPending}
          >
            <ClockOutIcon className="w-3.5 h-3.5 mr-1" />
            Clock Out
          </Button>
        </div>
      )}

      {/* ── Today's Jobs ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Today's Jobs{jobs.length > 0 ? ` · ${jobs.length}` : ""}
        </h2>

        {jobsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              <Sun className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No jobs scheduled for today</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                activeEntry={activeEntry ?? null}
                onChipTap={(p) => setPending(p)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── My Time Log ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          My Time Log Today
        </h2>

        {entriesLoading ? (
          <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-400 text-sm">
              No time logged today yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <TimeEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      {/* ── Clock-In Confirmation Dialog ───────────────────────────────── */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>
              {activeEntry ? "Switch Work Area" : "Clock In"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700 space-y-1">
            {activeEntry && (
              <p>
                Clock out of{" "}
                <span className="font-semibold">
                  {activeEntry.work_area_name || activeEntry.entry_type}
                </span>{" "}
                and clock into{" "}
                <span className="font-semibold">{pending?.workAreaName}</span>?
              </p>
            )}
            {!activeEntry && (
              <p>
                Clock into{" "}
                <span className="font-semibold">{pending?.workAreaName}</span>
                {pending?.jobTitle && (
                  <> at <span className="font-semibold">{pending.jobTitle}</span></>
                )}?
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPending(null)} data-testid="clock-in-cancel">
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleMyDayClockIn}
              disabled={clockInMutation.isPending || gpsChecking}
              data-testid="clock-in-confirm"
            >
              {gpsChecking ? "Getting GPS…" : clockInMutation.isPending ? "Clocking in…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({
  job,
  activeEntry,
  onChipTap,
}: {
  job: MyDayJob;
  activeEntry: TimeEntry | null;
  onChipTap: (p: PendingClockIn) => void;
}) {
  const borderColor = divisionColor(job.division);
  const timeLabel =
    job.scheduled_start_time
      ? `${job.scheduled_start_time.slice(0, 5)}${job.scheduled_end_time ? " – " + job.scheduled_end_time.slice(0, 5) : ""}`
      : null;

  function handleChip(workAreaId: string | null, workAreaName: string, entryType: string) {
    onChipTap({
      jobId: job.id,
      jobTitle: job.title || job.client || "Job",
      workAreaId,
      workAreaName,
      entryType,
    });
  }

  return (
    <Card
      data-testid={`job-card-${job.id}`}
      className="overflow-hidden shadow-sm border-l-4"
      style={{ borderLeftColor: borderColor }}
    >
      <CardContent className="p-4 space-y-3">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-2">
          <p data-testid={`job-title-${job.id}`} className="font-semibold text-gray-900 leading-snug">
            {job.title || job.client || "Unnamed Job"}
          </p>
          {job.division && (
            <Badge
              className="text-white text-xs shrink-0 capitalize"
              style={{ backgroundColor: borderColor }}
            >
              {job.division}
            </Badge>
          )}
        </div>

        {/* Customer + address */}
        {(job.customer_name || job.customer_address) && (
          <div className="flex items-start gap-1.5 text-sm text-gray-500">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug">
              {[job.customer_name, job.customer_address].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}

        {/* Scheduled time */}
        {timeLabel && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{timeLabel}</span>
          </div>
        )}

        {/* Work area chips */}
        {job.work_areas.length > 0 && (
          <div className="space-y-2">
            {/* Active / pending areas — tappable to clock in */}
            {(() => {
              const openAreas = job.work_areas.filter((wa) => wa.status !== "completed");
              const doneAreas = job.work_areas.filter((wa) => wa.status === "completed");
              return (
                <>
                  {openAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {openAreas.map((wa) => {
                        const isActive =
                          activeEntry?.job_work_area_id === wa.id && !activeEntry?.clock_out;
                        return (
                          <button
                            key={wa.id}
                            data-testid={`work-area-chip-${wa.id}`}
                            onClick={() => handleChip(wa.id, wa.name, "billable")}
                            className={[
                              "px-3 py-1.5 rounded-full text-sm font-medium min-h-[36px] transition-colors",
                              isActive
                                ? "bg-green-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700 active:bg-green-100",
                            ].join(" ")}
                          >
                            {isActive && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                            {wa.name}
                            {wa.estimated_hours ? ` (${wa.estimated_hours}h)` : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Completed areas — non-clickable, greyed with checkmark */}
                  {doneAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {doneAreas.map((wa) => (
                        <span
                          key={wa.id}
                          data-testid={`work-area-done-${wa.id}`}
                          title="Completed"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-50 text-gray-400 border border-gray-200 line-through cursor-default"
                        >
                          <CheckCircle2 className="inline w-3 h-3 text-gray-400 no-underline" style={{ textDecoration: "none" }} />
                          <span>{wa.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Quick chips: Drive Time / Shop Time / Break */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {QUICK_CHIPS.map(({ label, entryType, icon: Icon }) => {
            const isActive =
              activeEntry?.entry_type === entryType &&
              activeEntry?.job_id === job.id &&
              !activeEntry?.clock_out;
            return (
              <button
                key={entryType}
                data-testid={`quick-chip-${entryType}-${job.id}`}
                onClick={() => handleChip(null, label, entryType)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm min-h-[36px] transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200",
                ].join(" ")}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Time Entry Row ───────────────────────────────────────────────────────────
function TimeEntryRow({ entry }: { entry: TimeEntry }) {
  const elapsed = useLiveElapsed(entry.clock_out ? null : entry.clock_in);
  const isActive = !entry.clock_out;

  return (
    <div
      data-testid={`time-entry-${entry.id}`}
      className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">
          {entry.work_area_name || entry.entry_type}
        </p>
        {entry.job_title && (
          <p className="text-xs text-gray-400 truncate">{entry.job_title}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {formatTime(entry.clock_in)}
          {entry.clock_out ? ` → ${formatTime(entry.clock_out)}` : ""}
        </p>
      </div>
      <div className="ml-3 shrink-0 text-right">
        {isActive ? (
          <Badge className="bg-green-100 text-green-700 text-xs font-semibold">
            {elapsed || "Active"}
          </Badge>
        ) : (
          <span className="text-sm font-semibold text-gray-700">
            {formatDuration(entry.duration_minutes)}
          </span>
        )}
      </div>
    </div>
  );
}
