import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
  Loader2,
  ChevronRight,
  Phone,
  BookOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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
  customer_phone: string | null;
  access_notes: string | null;
  gate_code: string | null;
  has_pets: boolean | null;
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

interface PickerJob {
  jobId: string;
  jobTitle: string;
  preSelectedId: string | null;
  preSelectedName: string | null;
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

// Browsers treat bare ISO strings without a timezone suffix as LOCAL time.
// Appending 'Z' forces UTC parsing and prevents negative elapsed times.
function toUTC(ts: string): string {
  if (ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts)) return ts;
  return ts + "Z";
}

function useLiveElapsed(clockInTime: string | null): string {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!clockInTime) { setElapsed(""); return; }
    const utc = toUTC(clockInTime);
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockInTime]);
  return elapsed;
}

// ─── Quick-chip row key map ────────────────────────────────────────────────────
const QUICK_CHIPS = [
  { labelKey: "chipDriveTime", entryType: "drive_time", icon: Car },
  { labelKey: "chipShopTime",  entryType: "shop_time",  icon: Wrench },
  { labelKey: "chipBreak",     entryType: "break",      icon: Coffee },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyDayPage() {
  const { t } = useTranslation("myDay");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingClockIn | null>(null);
  const [gpsChecking, setGpsChecking] = useState(false);
  const [pickerJob, setPickerJob] = useState<PickerJob | null>(null);

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
      const title = result?.offline ? t("clockedInOffline") : t("clockedInMsg");
      toast({ title, description: t("nowWorkingOn", { name: pending?.workAreaName }) });
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["/api/time/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-day/time-entries"] });
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
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
      const title = result?.offline ? t("clockedOutOffline") : t("clockedOutMsg");
      toast({ title });
      queryClient.invalidateQueries({ queryKey: ["/api/time/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-day/time-entries"] });
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  const handleMyDayClockIn = () => {
    if (!pending) return;
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Clocking in without GPS — add a note if your site requires it." });
      clockInMutation.mutate(pending);
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
        toast({ title: "Location not captured", description: "GPS was denied — clocking in without location." });
        clockInMutation.mutate(pending);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handlePickerConfirm = (p: PendingClockIn) => {
    setPickerJob(null);
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Clocking in without GPS — add a note if your site requires it." });
      clockInMutation.mutate(p);
      return;
    }
    setGpsChecking(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsChecking(false);
        clockInMutation.mutate(p);
      },
      () => {
        setGpsChecking(false);
        toast({ title: "Location not captured", description: "GPS was denied — clocking in without location." });
        clockInMutation.mutate(p);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const firstName = user?.firstName || "there";

  // greeting helper using t()
  const h = new Date().getHours();
  const greetingKey = h < 12 ? "goodMorning" : h < 17 ? "goodAfternoon" : "goodEvening";

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 pb-12 pt-4 space-y-6">
      <OfflineBanner />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 data-testid="my-day-greeting" className="text-2xl font-bold text-gray-900">
          {t(greetingKey, { name: firstName })}
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
                  ⚡ {t("offline")}
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
            {t("clockOut")}
          </Button>
        </div>
      )}

      {/* ── Today's Jobs ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          {t("todaysJobs")}{jobs.length > 0 ? ` · ${jobs.length}` : ""}
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
              <p className="text-sm">{t("noJobsScheduledToday")}</p>
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
                onPickerOpen={(picker) => setPickerJob(picker)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── My Time Log ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          {t("myTimeLogToday")}
        </h2>

        {entriesLoading ? (
          <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-400 text-sm">
              {t("noTimeLoggedToday")}
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

      {/* ── Work Area Picker Dialog ─────────────────────────────────────── */}
      {pickerJob && (
        <WorkAreaPickerDialog
          pickerJob={pickerJob}
          activeEntry={activeEntry ?? null}
          onClose={() => setPickerJob(null)}
          onConfirm={handlePickerConfirm}
        />
      )}

      {/* ── Clock-In Confirmation Dialog (quick chips only) ─────────────── */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>
              {activeEntry ? t("switchWorkArea") : t("clockIn")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700 space-y-1">
            {activeEntry && (
              <p>
                {t("clockOutOfPrefix")}{" "}
                <span className="font-semibold">
                  {activeEntry.work_area_name || activeEntry.entry_type}
                </span>{" "}
                {t("andClockInto")}{" "}
                <span className="font-semibold">{pending?.workAreaName}</span>?
              </p>
            )}
            {!activeEntry && (
              <p>
                {t("clockIntoPrefix")}{" "}
                <span className="font-semibold">{pending?.workAreaName}</span>
                {pending?.jobTitle && (
                  <> {t("atJob")} <span className="font-semibold">{pending.jobTitle}</span></>
                )}?
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPending(null)} data-testid="clock-in-cancel">
              {t("cancel")}
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleMyDayClockIn}
              disabled={clockInMutation.isPending || gpsChecking}
              data-testid="clock-in-confirm"
            >
              {gpsChecking ? t("gettingGps") : clockInMutation.isPending ? t("clockingIn") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Work Area Picker Dialog ──────────────────────────────────────────────────
function WorkAreaPickerDialog({
  pickerJob,
  activeEntry,
  onClose,
  onConfirm,
}: {
  pickerJob: PickerJob;
  activeEntry: TimeEntry | null;
  onClose: () => void;
  onConfirm: (p: PendingClockIn) => void;
}) {
  const { t } = useTranslation("myDay");
  const { data: areas = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs", pickerJob.jobId, "work-areas"],
    queryFn: () =>
      apiRequest("GET", `/api/jobs/${pickerJob.jobId}/work-areas?active=true`)
        .then((r) => r.json()),
    staleTime: 30_000,
  });

  const openAreas = areas.filter((wa: any) => wa.is_active !== false && wa.status !== "completed");

  const initialId = pickerJob.preSelectedId ?? (openAreas[0]?.id ?? "__general__");
  const [selectedId, setSelectedId] = useState<string>(initialId);

  useEffect(() => {
    if (!isLoading) {
      setSelectedId(pickerJob.preSelectedId ?? (openAreas[0]?.id ?? "__general__"));
    }
  }, [isLoading, pickerJob.preSelectedId]);

  function getSelectedName(): string {
    if (selectedId === "__general__") return t("general");
    const found = openAreas.find((wa: any) => wa.id === selectedId);
    return found?.name ?? t("general");
  }

  function handleConfirm() {
    const workAreaId = selectedId === "__general__" ? null : selectedId;
    const workAreaName = getSelectedName();
    onConfirm({
      jobId: pickerJob.jobId,
      jobTitle: pickerJob.jobTitle,
      workAreaId,
      workAreaName,
      entryType: "billable",
    });
  }

  const allOptions = [
    ...openAreas.map((wa: any) => ({ id: wa.id, name: wa.name, hours: wa.estimated_hours })),
    { id: "__general__", name: t("general"), hours: null },
  ];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>{t("selectWorkArea")}</DialogTitle>
        </DialogHeader>

        {activeEntry && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t("willClockOutOf")}{" "}
            <span className="font-semibold">
              {activeEntry.work_area_name || activeEntry.entry_type}
            </span>{" "}
            {t("first")}
          </div>
        )}

        <p className="text-xs text-gray-500 -mt-1">
          {pickerJob.jobTitle}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
            {allOptions.map((opt) => {
              const isChosen = selectedId === opt.id;
              return (
                <button
                  key={opt.id}
                  data-testid={`picker-area-${opt.id}`}
                  onClick={() => setSelectedId(opt.id)}
                  className={[
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors",
                    isChosen
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-white border-gray-200 text-gray-800 hover:border-green-300 hover:bg-green-50",
                  ].join(" ")}
                >
                  <span className="font-medium text-sm">
                    {opt.name}
                    {opt.hours ? (
                      <span className={["ml-1.5 text-xs font-normal", isChosen ? "text-green-100" : "text-gray-400"].join(" ")}>
                        {opt.hours}h est.
                      </span>
                    ) : null}
                  </span>
                  {isChosen && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 pt-1">
          <Button variant="outline" onClick={onClose} data-testid="picker-cancel">
            {t("cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            data-testid="picker-confirm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {activeEntry ? t("switchArea") : t("clockIn")}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({
  job,
  activeEntry,
  onChipTap,
  onPickerOpen,
}: {
  job: MyDayJob;
  activeEntry: TimeEntry | null;
  onChipTap: (p: PendingClockIn) => void;
  onPickerOpen: (picker: PickerJob) => void;
}) {
  const { t } = useTranslation("myDay");
  const [, nav] = useLocation();
  const borderColor = divisionColor(job.division);
  const timeLabel =
    job.scheduled_start_time
      ? `${job.scheduled_start_time.slice(0, 5)}${job.scheduled_end_time ? " – " + job.scheduled_end_time.slice(0, 5) : ""}`
      : null;

  function handleChip(workAreaId: string | null, workAreaName: string, entryType: string) {
    if (entryType === "billable") {
      onPickerOpen({
        jobId: job.id,
        jobTitle: job.title || job.client || t("unnamedJob"),
        preSelectedId: workAreaId,
        preSelectedName: workAreaName,
      });
    } else {
      onChipTap({
        jobId: job.id,
        jobTitle: job.title || job.client || t("unnamedJob"),
        workAreaId,
        workAreaName,
        entryType,
      });
    }
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
            {job.title || job.client || t("unnamedJob")}
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

        {/* Customer phone — tappable for crew */}
        {job.customer_phone && (
          <a href={`tel:${job.customer_phone}`}
            className="flex items-center gap-1.5 text-sm text-blue-600 font-medium">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {job.customer_phone}
          </a>
        )}

        {/* Site access info — highlighted for crews */}
        {(job.has_pets || job.gate_code || job.access_notes) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">⚠ Site Access</p>
            {job.has_pets && (
              <p className="text-sm text-amber-900 font-medium">🐾 Pets on property</p>
            )}
            {job.gate_code && (
              <p className="text-sm text-amber-900">
                <span className="font-medium">Gate:</span> {job.gate_code}
              </p>
            )}
            {job.access_notes && (
              <p className="text-sm text-amber-900 leading-snug">{job.access_notes}</p>
            )}
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

                  {doneAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {doneAreas.map((wa) => (
                        <span
                          key={wa.id}
                          data-testid={`work-area-done-${wa.id}`}
                          title={t("completed")}
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

        {/* Footer: View Instructions + Clock In */}
        <div className="flex items-center justify-between">
          <button
            data-testid={`view-instructions-${job.id}`}
            onClick={() => nav(`/jobs/${job.id}`)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            View Instructions
          </button>
          <button
            data-testid={`clock-in-job-${job.id}`}
            onClick={() =>
              onPickerOpen({
                jobId: job.id,
                jobTitle: job.title || job.client || t("unnamedJob"),
                preSelectedId: null,
                preSelectedName: null,
              })
            }
            className="flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 active:text-green-900 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {t("clockIn")}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick chips: Drive Time / Shop Time / Break */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {QUICK_CHIPS.map(({ labelKey, entryType, icon: Icon }) => {
            const label = t(labelKey);
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
  const { t } = useTranslation("myDay");
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
            {elapsed || t("active")}
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
