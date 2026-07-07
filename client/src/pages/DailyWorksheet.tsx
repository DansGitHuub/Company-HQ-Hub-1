import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { clockIn, clockOut, getActiveSession } from "@/lib/timeApi";
import OfflineBanner from "@/components/OfflineBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList, Plus, Trash2, Send, Save, Loader2, PackageOpen,
  Receipt, Users, StickyNote, Briefcase, ChevronDown, ChevronRight,
  ImagePlus, X, HardHat, Sun, Coffee, Car, Wrench, LogOut as ClockOutIcon,
  CheckCircle2, MapPin, Clock, AlertTriangle, ClipboardCheck,
  Camera, XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChecklistAnswer = "yes" | "no" | null;
interface ChecklistState {
  q1: ChecklistAnswer; q1note: string;
  q2: ChecklistAnswer; q2note: string;
  q3: ChecklistAnswer; q3note: string;
  q4: ChecklistAnswer; q4note: string;
}
interface PhotoSummary {
  before: number; after: number; damage: number; other: number;
  has_job: boolean; has_sessions: boolean;
}

interface Material {
  id: number;
  material_name: string | null;
  quantity: string | null;
  unit: string | null;
  unit_cost: string | null;
  notes: string | null;
}

interface Expense {
  id: number;
  description: string | null;
  amount: string | null;
  category: string | null;
  receipt_url: string | null;
}

interface TeamMember {
  id: number;
  user_id: string;
  user_name: string | null;
  username: string;
}

interface Worksheet {
  id: string;
  user_id: string;
  job_id: string | null;
  date: string;
  notes: string | null;
  status: string;
  materials: Material[];
  expenses: Expense[];
  teamMembers: TeamMember[];
}

interface ActiveEntry {
  id?: number;
  localId?: string;
  isOffline?: boolean;
  job_id: string | null;
  job_name: string | null;
  job_work_area_id?: string | null;
  work_area_name: string | null;
  clock_in: string;
  clock_out?: string | null;
  entry_type: string;
}

interface CrewUser {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface Job {
  id: string;
  title: string | null;
  client: string;
  status: string;
}

// ─── Mi Día types ─────────────────────────────────────────────────────────────

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
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(_dateStr?: string) {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function useLiveElapsed(clockInTime: string | null): string {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!clockInTime) { setElapsed(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(clockInTime).getTime()) / 1000);
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

const QUICK_CHIPS = [
  { labelKey: "chipDriveTime", entryType: "drive_time", icon: Car },
  { labelKey: "chipShopTime",  entryType: "shop_time",  icon: Wrench },
  { labelKey: "chipBreak",     entryType: "break",      icon: Coffee },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, count, color, children,
}: {
  icon: any; title: string; count?: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none flex flex-row items-center justify-between"
        style={{ background: `${color}18`, borderBottom: `2px solid ${color}30` }}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md" style={{ background: color }}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm font-semibold" style={{ color }}>
            {title}
          </CardTitle>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">{count}</Badge>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </CardHeader>
      {open && <CardContent className="p-4">{children}</CardContent>}
    </Card>
  );
}

// ─── Time Entry Row ───────────────────────────────────────────────────────────

function TimeEntryRow({ entry }: { entry: TimeEntry }) {
  const { t } = useTranslation("myDay");
  const liveElapsed = useLiveElapsed(entry.clock_out ? null : entry.clock_in);
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
            {liveElapsed || t("active")}
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

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job, activeEntry, onChipTap, onPickerOpen,
}: {
  job: MyDayJob;
  activeEntry: ActiveEntry | null;
  onChipTap: (p: PendingClockIn) => void;
  onPickerOpen: (picker: PickerJob) => void;
}) {
  const { t } = useTranslation("myDay");
  const borderColor = divisionColor(job.division);
  const timeLabel = job.scheduled_start_time
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
        <div className="flex items-start justify-between gap-2">
          <p data-testid={`job-title-${job.id}`} className="font-semibold text-gray-900 leading-snug">
            {job.title || job.client || t("unnamedJob")}
          </p>
          {job.division && (
            <Badge className="text-white text-xs shrink-0 capitalize" style={{ backgroundColor: borderColor }}>
              {job.division}
            </Badge>
          )}
        </div>

        {(job.customer_name || job.customer_address) && (
          <div className="flex items-start gap-1.5 text-sm text-gray-500">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug">
              {[job.customer_name, job.customer_address].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}

        {timeLabel && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{timeLabel}</span>
          </div>
        )}

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
                        const isActive = activeEntry?.job_work_area_id === wa.id && !activeEntry?.clock_out;
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
                            {wa.name}{wa.estimated_hours ? ` (${wa.estimated_hours}h)` : ""}
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-50 text-gray-400 border border-gray-200 line-through cursor-default"
                        >
                          <CheckCircle2 className="inline w-3 h-3 text-gray-400" />
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

        <div className="flex justify-end">
          <button
            data-testid={`clock-in-job-${job.id}`}
            onClick={() => onPickerOpen({
              jobId: job.id,
              jobTitle: job.title || job.client || t("unnamedJob"),
              preSelectedId: null,
              preSelectedName: null,
            })}
            className="flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 active:text-green-900 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {t("clockIn")}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

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

// ─── Work Area Picker Dialog ──────────────────────────────────────────────────

function WorkAreaPickerDialog({
  pickerJob, activeEntry, onClose, onConfirm,
}: {
  pickerJob: PickerJob;
  activeEntry: ActiveEntry | null;
  onClose: () => void;
  onConfirm: (p: PendingClockIn) => void;
}) {
  const { t } = useTranslation("myDay");
  const { data: areas = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs", pickerJob.jobId, "work-areas"],
    queryFn: () =>
      apiRequest("GET", `/api/jobs/${pickerJob.jobId}/work-areas?active=true`).then((r) => r.json()),
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
    onConfirm({
      jobId: pickerJob.jobId,
      jobTitle: pickerJob.jobTitle,
      workAreaId: selectedId === "__general__" ? null : selectedId,
      workAreaName: getSelectedName(),
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
            <span className="font-semibold">{activeEntry.work_area_name || activeEntry.entry_type}</span>{" "}
            {t("first")}
          </div>
        )}
        <p className="text-xs text-gray-500 -mt-1">{pickerJob.jobTitle}</p>
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
          <Button variant="outline" onClick={onClose} data-testid="picker-cancel">{t("cancel")}</Button>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyWorksheet() {
  const { t } = useTranslation("dailyWorksheet");
  const { t: tDay } = useTranslation("myDay");
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Elapsed timer (for header display) ───────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);

  // ── Clock-in state ────────────────────────────────────────────────────────────
  const [pending, setPending] = useState<PendingClockIn | null>(null);
  const [gpsChecking, setGpsChecking] = useState(false);
  const [pickerJob, setPickerJob] = useState<PickerJob | null>(null);

  // ── Active entry ──────────────────────────────────────────────────────────────
  const { data: activeEntry } = useQuery<ActiveEntry | null>({
    queryKey: ["/api/time/active"],
    queryFn: () => getActiveSession(),
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!activeEntry?.clock_in) { setElapsed(0); return; }
    const update = () => setElapsed(
      Math.floor((Date.now() - new Date(activeEntry.clock_in).getTime()) / 1000)
    );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.clock_in]);

  // ── Today's worksheet ─────────────────────────────────────────────────────────
  const { data: ws, isLoading } = useQuery<Worksheet>({
    queryKey: ["/api/worksheets/today"],
    queryFn: () => fetch("/api/worksheets/today").then((r) => r.json()),
  });

  // ── Today's jobs (from Mi Día) ────────────────────────────────────────────────
  const { data: myDayJobs = [], isLoading: jobsLoading } = useQuery<MyDayJob[]>({
    queryKey: ["/api/my-day"],
    refetchInterval: 60_000,
  });

  // ── Today's time entries (from Mi Día) ────────────────────────────────────────
  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/my-day/time-entries"],
    refetchInterval: 30_000,
  });

  // ── Crew users list ───────────────────────────────────────────────────────────
  const { data: crewUsers = [] } = useQuery<CrewUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
    select: (data) => data.filter((u) => u.role !== "Customer"),
  });

  // ── Photo summary (for pre-submit gates) ─────────────────────────────────────
  const { data: photoSummary, refetch: refetchPhotos } = useQuery<PhotoSummary>({
    queryKey: ["/api/worksheets", ws?.id, "photo-summary"],
    queryFn: () => fetch(`/api/worksheets/${ws!.id}/photo-summary`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!ws?.id,
    staleTime: 20_000,
  });

  // ── Jobs list for job selector ────────────────────────────────────────────────
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs", "active-worksheet"],
    queryFn: async () => {
      const res = await fetch("/api/jobs?status=scheduled,in_progress", { credentials: "include" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // ── Selected job state ────────────────────────────────────────────────────────
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isSavingJob, setIsSavingJob] = useState(false);
  const jobInitialized = useRef(false);

  useEffect(() => {
    if (ws && !jobInitialized.current) {
      jobInitialized.current = true;
      if (ws.job_id) {
        setSelectedJobId(ws.job_id);
      } else if (activeEntry?.job_id) {
        setSelectedJobId(activeEntry.job_id);
        apiRequest("PATCH", `/api/worksheets/${ws.id}`, { job_id: activeEntry.job_id }).catch(() => {});
      }
    }
  }, [ws, activeEntry]);

  const handleJobChange = async (jobId: string) => {
    if (!ws) return;
    setSelectedJobId(jobId);
    setIsSavingJob(true);
    try {
      await apiRequest("PATCH", `/api/worksheets/${ws.id}`, { job_id: jobId || null });
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error saving job", description: err.message, variant: "destructive" });
    } finally {
      setIsSavingJob(false);
    }
  };

  // ── Notes state ───────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const notesInitialized = useRef(false);
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (ws && !notesInitialized.current) {
      setNotes(ws.notes ?? "");
      notesInitialized.current = true;
      wsIdRef.current = ws.id;
    }
  }, [ws]);

  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const flashSaved = () => {
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const saveNotes = async () => {
    if (!ws) return;
    setIsSavingNotes(true);
    try {
      await apiRequest("PATCH", `/api/worksheets/${ws.id}`, { notes });
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      flashSaved();
    } finally {
      setIsSavingNotes(false);
    }
  };

  useEffect(() => {
    if (!notesInitialized.current || !wsIdRef.current) return;
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(async () => {
      if (!wsIdRef.current) return;
      try {
        setIsSavingNotes(true);
        await apiRequest("PATCH", `/api/worksheets/${wsIdRef.current}`, { notes });
        flashSaved();
      } catch { /* silent */ } finally {
        setIsSavingNotes(false);
      }
    }, 1000);
    return () => { if (notesDebounce.current) clearTimeout(notesDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // ── Submit worksheet ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const emptyChecklist = (): ChecklistState => ({
    q1: null, q1note: "", q2: null, q2note: "",
    q3: null, q3note: "", q4: null, q4note: "",
  });
  const [cl, setCl] = useState<ChecklistState>(emptyChecklist());

  const openChecklist = async () => {
    await refetchPhotos();
    setCl(emptyChecklist());
    setShowChecklist(true);
  };

  const handleSubmit = async (checklist: ChecklistState) => {
    if (!ws) return;
    setIsSubmitting(true);
    setShowChecklist(false);
    try {
      await apiRequest("PATCH", `/api/worksheets/${ws.id}`, { notes });
      await apiRequest("POST", `/api/worksheets/${ws.id}/submit`, {
        checklist_work_order_changed:  checklist.q1 === "yes",
        checklist_work_order_note:     checklist.q1 === "yes" ? checklist.q1note : null,
        checklist_materials_needed:    checklist.q2 === "yes",
        checklist_materials_note:      checklist.q2 === "yes" ? checklist.q2note : null,
        checklist_change_order_needed: checklist.q3 === "yes",
        checklist_change_order_note:   checklist.q3 === "yes" ? checklist.q3note : null,
        checklist_issue_reported:      checklist.q4 === "yes",
        checklist_issue_note:          checklist.q4 === "yes" ? checklist.q4note : null,
      });
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      toast({ title: "Worksheet submitted!", description: "Your worksheet has been submitted." });
    } catch (err: any) {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitted = ws?.status === "submitted" || ws?.status === "approved";

  // ── Materials form state ──────────────────────────────────────────────────────
  const [matForm, setMatForm] = useState({ material_name: "", quantity: "", unit: "", unit_cost: "", notes: "" });
  const [addingMat, setAddingMat] = useState(false);
  const [showMatForm, setShowMatForm] = useState(false);

  const [catalogSuggestions, setCatalogSuggestions] = useState<{ id: string; name: string; unit: string | null; unit_cost: string | null }[]>([]);
  const [showCatalogDrop, setShowCatalogDrop] = useState(false);
  const catalogDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (catalogDebounce.current) clearTimeout(catalogDebounce.current);
    const q = matForm.material_name.trim();
    if (q.length < 2) { setCatalogSuggestions([]); setShowCatalogDrop(false); return; }
    catalogDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/materials/catalog?q=${encodeURIComponent(q)}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCatalogSuggestions(data);
          setShowCatalogDrop(data.length > 0);
        }
      } catch { /* silent */ }
    }, 280);
    return () => { if (catalogDebounce.current) clearTimeout(catalogDebounce.current); };
  }, [matForm.material_name]);

  const addMaterial = async () => {
    if (!ws || !matForm.material_name) return;
    setAddingMat(true);
    try {
      await apiRequest("POST", `/api/worksheets/${ws.id}/materials`, {
        material_name: matForm.material_name,
        quantity: matForm.quantity ? parseFloat(matForm.quantity) : null,
        unit: matForm.unit || null,
        unit_cost: matForm.unit_cost ? parseFloat(matForm.unit_cost) : null,
        notes: matForm.notes || null,
      });
      setMatForm({ material_name: "", quantity: "", unit: "", unit_cost: "", notes: "" });
      setShowMatForm(false);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      toast({ title: "Material added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingMat(false);
    }
  };

  const deleteMaterial = async (materialId: number) => {
    if (!ws) return;
    try {
      await apiRequest("DELETE", `/api/worksheets/${ws.id}/materials/${materialId}`, undefined);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Expenses form state ───────────────────────────────────────────────────────
  const EXPENSE_CATEGORIES = ["Fuel", "Materials", "Equipment Rental", "Dump Fee", "Food", "Other"];
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [expForm, setExpForm] = useState({ description: "", amount: "", category: "", receipt_url: "" });
  const [addingExp, setAddingExp] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);

  const handleReceiptFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setExpForm((f) => ({ ...f, receipt_url: e.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const addExpense = async () => {
    if (!ws || !expForm.description) return;
    setAddingExp(true);
    try {
      await apiRequest("POST", `/api/worksheets/${ws.id}/expenses`, {
        description: expForm.description,
        amount: expForm.amount ? parseFloat(expForm.amount) : null,
        category: expForm.category || null,
        receipt_url: expForm.receipt_url || null,
      });
      setExpForm({ description: "", amount: "", category: "", receipt_url: "" });
      setShowExpForm(false);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      toast({ title: "Expense added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingExp(false);
    }
  };

  const deleteExpense = async (expenseId: number) => {
    if (!ws) return;
    try {
      await apiRequest("DELETE", `/api/worksheets/${ws.id}/expenses/${expenseId}`, undefined);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Team members ──────────────────────────────────────────────────────────────
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const addTeamMember = async () => {
    if (!ws || !selectedUserId) return;
    setAddingMember(true);
    try {
      await apiRequest("POST", `/api/worksheets/${ws.id}/team-members`, { user_id: selectedUserId });
      setSelectedUserId("");
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingMember(false);
    }
  };

  const removeTeamMember = async (memberId: number) => {
    if (!ws) return;
    try {
      await apiRequest("DELETE", `/api/worksheets/${ws.id}/team-members/${memberId}`, undefined);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Clock-in / Clock-out mutations ────────────────────────────────────────────
  const clockInMutation = useMutation({
    mutationFn: async (p: PendingClockIn) => {
      if (activeEntry) {
        const coPayload = (activeEntry as any).isOffline
          ? { local_clock_in_id: (activeEntry as any).localId }
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
      const title = result?.offline ? tDay("clockedInOffline") : tDay("clockedInMsg");
      toast({ title, description: tDay("nowWorkingOn", { name: pending?.workAreaName }) });
      setPending(null);
      qc.invalidateQueries({ queryKey: ["/api/time/active"] });
      qc.invalidateQueries({ queryKey: ["/api/my-day/time-entries"] });
    },
    onError: (err: any) => {
      toast({ title: tDay("error"), description: err.message, variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry) return;
      const payload = (activeEntry as any).isOffline
        ? { local_clock_in_id: (activeEntry as any).localId }
        : { time_entry_id: activeEntry.id };
      const result = await clockOut(payload);
      if (!result.success) throw new Error(result.error ?? "Clock-out failed");
      return result;
    },
    onSuccess: (result: any) => {
      const title = result?.offline ? tDay("clockedOutOffline") : tDay("clockedOutMsg");
      toast({ title });
      qc.invalidateQueries({ queryKey: ["/api/time/active"] });
      qc.invalidateQueries({ queryKey: ["/api/my-day/time-entries"] });
    },
    onError: (err: any) => {
      toast({ title: tDay("error"), description: err.message, variant: "destructive" });
    },
  });

  const handleClockIn = () => {
    if (!pending) return;
    if (!navigator.geolocation) {
      toast({ title: tDay("gpsRequired"), description: tDay("gpsNotSupported"), variant: "destructive" });
      return;
    }
    setGpsChecking(true);
    navigator.geolocation.getCurrentPosition(
      () => { setGpsChecking(false); clockInMutation.mutate(pending); },
      () => { setGpsChecking(false); toast({ title: tDay("gpsRequired"), description: tDay("gpsAccessDenied"), variant: "destructive" }); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handlePickerConfirm = (p: PendingClockIn) => {
    setPickerJob(null);
    if (!navigator.geolocation) {
      toast({ title: tDay("gpsRequired"), description: tDay("gpsNotSupported"), variant: "destructive" });
      return;
    }
    setGpsChecking(true);
    navigator.geolocation.getCurrentPosition(
      () => { setGpsChecking(false); clockInMutation.mutate(p); },
      () => { setGpsChecking(false); toast({ title: tDay("gpsRequired"), description: tDay("gpsAccessDenied"), variant: "destructive" }); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  // ── Greeting ──────────────────────────────────────────────────────────────────
  const firstName = user?.name?.split(" ")[0] || user?.username || "there";
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "goodMorning" : hour < 17 ? "goodAfternoon" : "goodEvening";

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-green-700" />
      </div>
    );
  }

  if (!ws) return null;

  const addedMemberIds = new Set(ws.teamMembers.map((m) => m.user_id));
  const availableUsers = crewUsers.filter((u) => u.id !== user?.id && !addedMemberIds.has(u.id));

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <OfflineBanner />

      {/* ── HEADER ── */}
      <div className="bg-green-700 text-white px-4 pt-5 pb-4">
        <div className="max-w-2xl mx-auto">
          {/* Greeting */}
          <h1 data-testid="my-day-greeting" className="text-2xl font-bold">
            {tDay(greetingKey, { name: firstName })}
          </h1>
          <p className="text-sm opacity-70 mt-0.5">{formatDate(ws.date)}</p>

          {/* Active entry / clock status */}
          {activeEntry ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                {(activeEntry.job_name || activeEntry.work_area_name) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm opacity-90">
                    {activeEntry.job_name && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span className="font-semibold">{activeEntry.job_name}</span>
                      </div>
                    )}
                    {activeEntry.work_area_name && (
                      <span className="opacity-75">· {activeEntry.work_area_name}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-bold text-base">{formatElapsed(elapsed)}</span>
                  <span className="flex items-center gap-1 opacity-75 text-xs">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Clocked In
                  </span>
                  {(activeEntry as any).isOffline && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 border border-yellow-300">
                      ⚡ {tDay("offline")}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                data-testid="clock-out-button"
                size="sm"
                variant="outline"
                className="border-white/40 text-white hover:bg-white/20 bg-white/10 shrink-0"
                onClick={() => clockOutMutation.mutate()}
                disabled={clockOutMutation.isPending}
              >
                <ClockOutIcon className="w-3.5 h-3.5 mr-1" />
                {tDay("clockOut")}
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm opacity-70">
              <ClipboardList className="h-4 w-4" />
              <span>{t("notClockedIn")}</span>
              {isSubmitted && (
                <Badge className="ml-2 bg-white/20 text-white border-white/30 text-xs">Submitted</Badge>
              )}
            </div>
          )}
          {activeEntry && isSubmitted && (
            <Badge className="mt-1 bg-white/20 text-white border-white/30 text-xs">Submitted</Badge>
          )}
        </div>
      </div>

      {/* ── SECTIONS ── */}
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* Today's Jobs */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            {tDay("todaysJobs")}{myDayJobs.length > 0 ? ` · ${myDayJobs.length}` : ""}
          </h2>
          {jobsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-36 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : myDayJobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                <Sun className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{tDay("noJobsScheduledToday")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myDayJobs.map((job) => (
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

        {/* Job Selector Card */}
        <Card className="overflow-hidden">
          <CardHeader
            className="py-3 px-4 flex flex-row items-center gap-2"
            style={{ background: "#16a34a18", borderBottom: "2px solid #16a34a30" }}
          >
            <div className="p-1.5 rounded-md" style={{ background: "#16a34a" }}>
              <HardHat className="h-3.5 w-3.5 text-white" />
            </div>
            <CardTitle className="text-sm font-semibold" style={{ color: "#16a34a" }}>
              {t("job") || "Job"}
            </CardTitle>
            {activeEntry?.job_id && activeEntry.job_id === selectedJobId && (
              <span className="text-xs text-green-600 font-normal ml-1">(from clock-in)</span>
            )}
            {isSavingJob && <Loader2 className="h-3.5 w-3.5 animate-spin text-green-600 ml-auto" />}
          </CardHeader>
          <CardContent className="p-4">
            <select
              value={selectedJobId}
              onChange={(e) => handleJobChange(e.target.value)}
              disabled={isSubmitted || isSavingJob}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              data-testid="select-worksheet-job"
            >
              <option value="">No specific job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title ? `${j.client} — ${j.title}` : j.client}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* Section 1 — Materials Used */}
        <Section icon={PackageOpen} title={t("materialsUsed")} count={ws.materials.length} color="#2563eb">
          {ws.materials.length > 0 && (
            <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
              {ws.materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2.5 bg-white text-sm" data-testid={`material-row-${m.id}`}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 truncate block">{m.material_name || "—"}</span>
                    <span className="text-xs text-gray-500">
                      {[m.quantity && `${m.quantity}${m.unit ? ` ${m.unit}` : ""}`, m.unit_cost && `$${parseFloat(m.unit_cost).toFixed(2)} each`]
                        .filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {!isSubmitted && (
                    <button onClick={() => deleteMaterial(m.id)} className="ml-3 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0" data-testid={`btn-delete-material-${m.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!isSubmitted && (
            showMatForm ? (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 relative">
                    <Input
                      placeholder="Material name *"
                      value={matForm.material_name}
                      onChange={(e) => setMatForm((f) => ({ ...f, material_name: e.target.value }))}
                      onBlur={() => setTimeout(() => setShowCatalogDrop(false), 150)}
                      className="h-8 text-sm"
                      data-testid="input-material-name"
                    />
                    {showCatalogDrop && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {catalogSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center gap-2"
                            onMouseDown={() => {
                              setMatForm((f) => ({ ...f, material_name: s.name, unit: s.unit ?? f.unit, unit_cost: s.unit_cost ?? f.unit_cost }));
                              setShowCatalogDrop(false);
                            }}
                          >
                            <span className="font-medium text-gray-800">{s.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {s.unit ? s.unit : ""}{s.unit_cost ? ` · $${parseFloat(s.unit_cost).toFixed(2)}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input placeholder="Qty" value={matForm.quantity} onChange={(e) => setMatForm((f) => ({ ...f, quantity: e.target.value }))} className="h-8 text-sm" data-testid="input-material-qty" />
                  <Input placeholder="Unit (bag, gal…)" value={matForm.unit} onChange={(e) => setMatForm((f) => ({ ...f, unit: e.target.value }))} className="h-8 text-sm" data-testid="input-material-unit" />
                  <Input placeholder="Unit cost ($)" value={matForm.unit_cost} onChange={(e) => setMatForm((f) => ({ ...f, unit_cost: e.target.value }))} className="h-8 text-sm" data-testid="input-material-cost" />
                  <Input placeholder="Notes" value={matForm.notes} onChange={(e) => setMatForm((f) => ({ ...f, notes: e.target.value }))} className="h-8 text-sm" data-testid="input-material-notes" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={addMaterial} disabled={!matForm.material_name || addingMat} className="h-7 text-xs bg-blue-600 hover:bg-blue-700" data-testid="btn-add-material">
                    {addingMat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />} Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMatForm(false)} className="h-7 text-xs">Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowMatForm(true)} className="h-8 text-xs border-dashed" data-testid="btn-show-material-form">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("addMaterial")}
              </Button>
            )
          )}
        </Section>

        {/* Section 2 — Expenses */}
        <Section icon={Receipt} title={t("expenses")} count={ws.expenses.length} color="#7c3aed">
          {ws.expenses.length > 0 && (
            <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
              {ws.expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2.5 bg-white text-sm" data-testid={`expense-row-${e.id}`}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 truncate block">{e.description || "—"}</span>
                    <span className="text-xs text-gray-500">
                      {[e.category, e.amount && `$${parseFloat(e.amount).toFixed(2)}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {!isSubmitted && (
                    <button onClick={() => deleteExpense(e.id)} className="ml-3 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0" data-testid={`btn-delete-expense-${e.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!isSubmitted && (
            showExpForm ? (
              <div className="space-y-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Description *" value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} className="h-8 text-sm col-span-2" data-testid="input-expense-desc" />
                  <Input placeholder="Amount ($)" value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} className="h-8 text-sm" data-testid="input-expense-amount" />
                  <select value={expForm.category} onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))} className="h-8 text-sm rounded-md border border-input bg-background px-3" data-testid="select-expense-category">
                    <option value="">Category…</option>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input ref={receiptInputRef} type="file" accept="image/*" className="hidden" data-testid="input-receipt-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptFile(f); }} />
                {expForm.receipt_url ? (
                  <div className="relative w-24 h-20 rounded-md overflow-hidden border border-purple-200">
                    <img src={expForm.receipt_url} alt="Receipt" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setExpForm((f) => ({ ...f, receipt_url: "" })); if (receiptInputRef.current) receiptInputRef.current.value = ""; }} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => receiptInputRef.current?.click()} className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 py-1" data-testid="btn-upload-receipt">
                    <ImagePlus className="h-3.5 w-3.5" /> Attach receipt photo
                  </button>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={addExpense} disabled={!expForm.description || addingExp} className="h-7 text-xs bg-purple-600 hover:bg-purple-700" data-testid="btn-add-expense">
                    {addingExp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />} Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowExpForm(false); setExpForm({ description: "", amount: "", category: "", receipt_url: "" }); if (receiptInputRef.current) receiptInputRef.current.value = ""; }} className="h-7 text-xs">Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowExpForm(true)} className="h-8 text-xs border-dashed" data-testid="btn-show-expense-form">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("addExpense")}
              </Button>
            )
          )}
        </Section>

        {/* Section 3 — Team Members */}
        <Section icon={Users} title={t("crewOnSite")} count={ws.teamMembers.length + 1} color="#059669">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-green-100 border border-green-300 text-green-900 text-sm px-3 py-1.5 rounded-full" data-testid="member-chip-self">
              <span className="font-medium">{(user as any)?.name || user?.username}</span>
              <span className="text-xs text-green-600 font-normal">({t("you")})</span>
            </div>
            {ws.teamMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-1.5 rounded-full" data-testid={`member-chip-${m.id}`}>
                <span className="font-medium">{m.user_name || m.username}</span>
                {!isSubmitted && (
                  <button onClick={() => removeTeamMember(m.id)} className="ml-1 text-green-500 hover:text-red-500 transition-colors" data-testid={`btn-remove-member-${m.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isSubmitted && availableUsers.length > 0 && (
            <div className="flex gap-2">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="flex-1 h-8 text-sm rounded-md border border-input bg-background px-3" data-testid="select-team-member">
                <option value="">{t("addCrewMember")}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.username}</option>
                ))}
              </select>
              <Button size="sm" onClick={addTeamMember} disabled={!selectedUserId || addingMember} className="h-8 text-xs bg-green-700 hover:bg-green-800" data-testid="btn-add-member">
                {addingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </Section>

        {/* Section 4 — Notes */}
        <Section icon={StickyNote} title={t("notes")} color="#d97706">
          <Textarea
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            disabled={isSubmitted}
            className="text-sm resize-none"
            data-testid="textarea-notes"
          />
          {!isSubmitted && (
            <div className="flex items-center gap-3 mt-2">
              <Button size="sm" variant="outline" onClick={saveNotes} disabled={isSavingNotes} className="h-7 text-xs" data-testid="btn-save-notes">
                {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} {t("saveNotes")}
              </Button>
              {notesSaved && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1" data-testid="text-notes-saved">
                  <span>✓</span> Saved
                </span>
              )}
              {isSavingNotes && !notesSaved && <span className="text-xs text-gray-400">Saving…</span>}
            </div>
          )}
        </Section>

        {/* My Time Log */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            {tDay("myTimeLogToday")}
          </h2>
          {entriesLoading ? (
            <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          ) : timeEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400 text-sm">
                {tDay("noTimeLoggedToday")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {timeEntries.map((entry) => (
                <TimeEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── STICKY FOOTER ── */}
      {!isSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
          <div className="max-w-2xl mx-auto flex gap-3">
            <Button variant="outline" onClick={saveNotes} disabled={isSavingNotes} className="flex-1 h-10" data-testid="btn-save-draft">
              {isSavingNotes ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t("saveDraft")}
            </Button>
            <Button onClick={openChecklist} disabled={isSubmitting} className="flex-1 h-10 bg-green-700 hover:bg-green-800" data-testid="btn-submit-worksheet">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t("submitWorksheet")}
            </Button>
          </div>
        </div>
      )}

      {isSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-green-50 border-t border-green-200 px-4 py-3 z-30 text-center">
          <p className="text-sm font-medium text-green-700">
            ✓ Worksheet submitted for {formatDate(ws.date)}
          </p>
        </div>
      )}

      {/* ── Pre-Submit Checklist Dialog ── */}
      {showChecklist && (
        <ChecklistDialog
          cl={cl}
          setCl={setCl}
          onConfirm={() => handleSubmit(cl)}
          onCancel={() => setShowChecklist(false)}
          isPending={isSubmitting}
          photoSummary={photoSummary ?? null}
        />
      )}

      {/* ── Work Area Picker Dialog ── */}
      {pickerJob && (
        <WorkAreaPickerDialog
          pickerJob={pickerJob}
          activeEntry={activeEntry ?? null}
          onClose={() => setPickerJob(null)}
          onConfirm={handlePickerConfirm}
        />
      )}

      {/* ── Clock-In Confirmation Dialog ── */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>
              {activeEntry ? tDay("switchWorkArea") : tDay("clockIn")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700 space-y-1">
            {activeEntry && (
              <p>
                {tDay("clockOutOfPrefix")}{" "}
                <span className="font-semibold">{activeEntry.work_area_name || activeEntry.entry_type}</span>{" "}
                {tDay("andClockInto")}{" "}
                <span className="font-semibold">{pending?.workAreaName}</span>?
              </p>
            )}
            {!activeEntry && (
              <p>
                {tDay("clockIntoPrefix")}{" "}
                <span className="font-semibold">{pending?.workAreaName}</span>
                {pending?.jobTitle && <> {tDay("atJob")} <span className="font-semibold">{pending.jobTitle}</span></>}?
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPending(null)} data-testid="clock-in-cancel">
              {tDay("cancel")}
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleClockIn}
              disabled={clockInMutation.isPending || gpsChecking}
              data-testid="clock-in-confirm"
            >
              {gpsChecking ? tDay("gettingGps") : clockInMutation.isPending ? tDay("clockingIn") : tDay("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Pre-Submit Checklist Dialog ──────────────────────────────────────────────
function ChecklistDialog({
  cl, setCl, onConfirm, onCancel, isPending, photoSummary,
}: {
  cl: ChecklistState;
  setCl: React.Dispatch<React.SetStateAction<ChecklistState>>;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  photoSummary: PhotoSummary | null;
}) {
  const QUESTIONS: {
    key: keyof Pick<ChecklistState, "q1" | "q2" | "q3" | "q4">;
    noteKey: keyof Pick<ChecklistState, "q1note" | "q2note" | "q3note" | "q4note">;
    label: string;
    icon: React.ReactNode;
    placeholder: string;
  }[] = [
    {
      key: "q1", noteKey: "q1note",
      label: "Did anything change from the work order?",
      icon: <ClipboardCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
      placeholder: "Briefly describe what changed…",
    },
    {
      key: "q2", noteKey: "q2note",
      label: "Are more materials needed?",
      icon: <PackageOpen className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
      placeholder: "What materials and roughly how much?",
    },
    {
      key: "q3", noteKey: "q3note",
      label: "Might a change order be needed?",
      icon: <Receipt className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />,
      placeholder: "Briefly describe the scope change…",
    },
    {
      key: "q4", noteKey: "q4note",
      label: "Was there any damage, delay, or customer issue?",
      icon: <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
      placeholder: "Describe what happened…",
    },
  ];

  // ── Photo gate logic ──────────────────────────────────────────────────────────
  const showPhotoGate = !!(photoSummary?.has_job && photoSummary?.has_sessions);
  const needsDamagePhoto = cl.q4 === "yes";

  const missingPhotos: { type: string; label: string }[] = [];
  if (showPhotoGate) {
    if ((photoSummary?.before ?? 0) === 0) missingPhotos.push({ type: "before", label: "Before photo" });
    if ((photoSummary?.after ?? 0)  === 0) missingPhotos.push({ type: "after",  label: "After photo" });
  }
  if (needsDamagePhoto && (photoSummary?.damage ?? 0) === 0) {
    missingPhotos.push({ type: "damage", label: "Damage photo (required when an issue is reported)" });
  }

  const allAnswered = QUESTIONS.every((q) => cl[q.key] !== null);
  const notesValid  = QUESTIONS.every(
    (q) => cl[q.key] !== "yes" || cl[q.noteKey].trim().length > 0
  );
  const canSubmit = allAnswered && notesValid && missingPhotos.length === 0 && !isPending;

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-800">
            <Send className="w-4 h-4" />
            Before You Submit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* ── Photo Requirements Gate ── */}
          {(showPhotoGate || needsDamagePhoto) && (
            <div
              data-testid="photo-gate-section"
              className={`rounded-lg border p-3 space-y-2 ${
                missingPhotos.length > 0
                  ? "border-red-200 bg-red-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Camera className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Required Photos
                </span>
              </div>

              {showPhotoGate && (
                <>
                  <PhotoRow
                    label="Before photo"
                    ok={(photoSummary?.before ?? 0) > 0}
                    testId="photo-gate-before"
                  />
                  <PhotoRow
                    label="After photo"
                    ok={(photoSummary?.after ?? 0) > 0}
                    testId="photo-gate-after"
                  />
                </>
              )}

              {needsDamagePhoto && (
                <PhotoRow
                  label="Damage photo (required — issue reported)"
                  ok={(photoSummary?.damage ?? 0) > 0}
                  testId="photo-gate-damage"
                />
              )}

              {missingPhotos.length > 0 && (
                <p className="text-xs text-red-700 mt-1 leading-snug">
                  Open the job from the <strong>Schedule</strong> view and add the missing photos before submitting.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500">Answer all 4 questions — quick yes or no. A note is only required if you answer yes.</p>

          {QUESTIONS.map((q, idx) => (
            <div key={q.key} className="space-y-1.5">
              <div className="flex items-start gap-2">
                {q.icon}
                <span className="text-sm font-medium text-gray-800 leading-snug">{idx + 1}. {q.label}</span>
              </div>
              <div className="flex gap-2 ml-6">
                <button
                  type="button"
                  data-testid={`checklist-${q.key}-no`}
                  onClick={() => setCl((prev) => ({ ...prev, [q.key]: "no", [q.noteKey]: "" }))}
                  className={`flex-1 h-8 rounded-md text-sm font-medium border transition-colors ${
                    cl[q.key] === "no"
                      ? "bg-gray-700 text-white border-gray-700"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  data-testid={`checklist-${q.key}-yes`}
                  onClick={() => setCl((prev) => ({ ...prev, [q.key]: "yes" }))}
                  className={`flex-1 h-8 rounded-md text-sm font-medium border transition-colors ${
                    cl[q.key] === "yes"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Yes
                </button>
              </div>
              {cl[q.key] === "yes" && (
                <Textarea
                  data-testid={`checklist-${q.key}-note`}
                  value={cl[q.noteKey]}
                  onChange={(e) => setCl((prev) => ({ ...prev, [q.noteKey]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={2}
                  className="ml-6 resize-none text-sm"
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={isPending} className="flex-1">
            Cancel
          </Button>
          <Button
            data-testid="checklist-confirm-submit"
            onClick={onConfirm}
            disabled={!canSubmit}
            className="flex-1 bg-green-700 hover:bg-green-800 text-white disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Confirm & Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhotoRow({ label, ok, testId }: { label: string; ok: boolean; testId: string }) {
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
        : <XCircle     className="w-3.5 h-3.5 text-red-500  shrink-0" />
      }
      <span className={`text-xs leading-snug ${ok ? "text-green-800" : "text-red-700 font-medium"}`}>
        {label}
      </span>
    </div>
  );
}
