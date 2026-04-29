import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, CalendarCheck, X, Users, Briefcase, RotateCcw } from "lucide-react";
import {
  format, addWeeks, subWeeks, startOfWeek, addDays, isToday,
  parseISO,
} from "date-fns";
import { useTranslation } from "react-i18next";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CrewMember { id: string; first_name: string; last_name: string; }
interface ScheduledJob {
  id: string; title: string; status: string;
  division: string | null; color: string | null;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  customer_name: string | null;
  property_address: string | null;
  assigned_crew: CrewMember[];
}
interface UnscheduledJob {
  id: string; title: string; status: string;
  division: string | null; color: string | null;
  customer_name: string | null;
  property_address: string | null;
}
interface Employee { id: string; first_name: string; last_name: string; position?: string; }

interface PendingDrop { jobId: string; date: string; hour: number; }

interface UndoPreviousState {
  was_scheduled: boolean;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  division: string | null;
  color: string | null;
  employee_ids: string[];
}
interface UndoAction {
  jobId: string;
  jobTitle: string;
  previousState: UndoPreviousState;
  timestamp: number;
}

// ── Constants ────────────────────────────────────────────────────────────────
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const CELL_H = 64;

const DIVISIONS = [
  { value: "Maintenance", color: "#22c55e" },
  { value: "Install",     color: "#3b82f6" },
  { value: "Snow",        color: "#94a3b8" },
  { value: "General",     color: "#f59e0b" },
];

function getDivisionColor(division: string | null | undefined, fallback = "#22c55e") {
  const d = DIVISIONS.find(d => d.value === division);
  return d?.color ?? fallback;
}

function parseHour(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const h = parseInt(timeStr.split(":")[0], 10);
  return isNaN(h) ? null : h;
}

function hourTo12(h: number) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function hourToTime(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

const STATUS_CLS: Record<string, string> = {
  lead:        "bg-gray-100 text-gray-700",
  scheduled:   "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed:   "bg-green-100 text-green-700",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function SchedulingCalendar() {
  const { t } = useTranslation("scheduling");
  const { toast } = useToast();
  const [weekBase, setWeekBase] = useState(() => new Date());
  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 });
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rangeStart = format(weekStart, "yyyy-MM-dd");
  const rangeEnd   = format(addDays(weekStart, 6), "yyyy-MM-dd");

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: calJobs = [], isLoading: calLoading } = useQuery<ScheduledJob[]>({
    queryKey: ["/api/scheduling/calendar", rangeStart, rangeEnd],
    queryFn: async () => {
      const res = await fetch(`/api/scheduling/calendar?start=${rangeStart}&end=${rangeEnd}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: unscheduled = [], isLoading: unschLoading } = useQuery<UnscheduledJob[]>({
    queryKey: ["/api/scheduling/unscheduled"],
    queryFn: async () => {
      const res = await fetch("/api/scheduling/unscheduled", { credentials: "include" });
      return res.json();
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/scheduling/employees"],
    queryFn: async () => {
      const res = await fetch("/api/scheduling/employees", { credentials: "include" });
      return res.json();
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const scheduleMutation = useMutation({
    mutationFn: async (payload: {
      jobId: string; scheduled_date: string; scheduled_start: string;
      scheduled_end: string; division: string; color: string; employee_ids: string[];
    }) => {
      const res = await apiRequest("PATCH", `/api/scheduling/jobs/${payload.jobId}/schedule`, {
        scheduled_date:  payload.scheduled_date,
        scheduled_start: payload.scheduled_start,
        scheduled_end:   payload.scheduled_end,
        division:        payload.division,
        color:           payload.color,
        employee_ids:    payload.employee_ids,
      });
      return res.json();
    },
    onSuccess: (newJob, variables) => {
      // Normalise the returned scheduled_date to "YYYY-MM-DD" so that
      // getJobsForDay's string comparison always works, regardless of
      // whether Postgres returns a plain date or an ISO timestamp.
      const normalisedJob: ScheduledJob | null = newJob && newJob.id
        ? { ...newJob, scheduled_date: (newJob.scheduled_date ?? "").slice(0, 10) }
        : null;

      // Immediately write the returned job into the calendar cache so the
      // event block appears without waiting for a background refetch.
      // We do NOT call invalidateQueries for the calendar here because
      // invalidating while the query has an active observer triggers an
      // immediate background refetch that can race with (and overwrite)
      // this setQueryData write before React has a chance to render —
      // causing the green block to never appear.
      //
      // We scan ALL cached calendar queries (the user may have navigated
      // weeks while the mutation was in-flight) and update the one(s)
      // whose week range contains the job's scheduled date.
      const jobDate = normalisedJob?.scheduled_date ?? variables.scheduled_date;
      const allCalendarQueries = queryClient.getQueriesData<ScheduledJob[]>({
        queryKey: ["/api/scheduling/calendar"],
      });
      let updatedAny = false;
      for (const [queryKey, cachedData] of allCalendarQueries) {
        const [, qStart, qEnd] = queryKey as [string, string, string];
        if (!qStart || !qEnd || !jobDate) continue;
        if (jobDate >= qStart && jobDate <= qEnd) {
          queryClient.setQueryData<ScheduledJob[]>(queryKey, (old = cachedData ?? []) => {
            const without = (old ?? []).filter(j => j.id !== variables.jobId);
            return normalisedJob ? [...without, normalisedJob] : without;
          });
          updatedAny = true;
        }
      }
      // Fall back to the current week's key when no cached query matched the job date
      // (e.g. first time viewing this week, or scheduled_date outside all cached ranges).
      if (!updatedAny) {
        queryClient.setQueryData<ScheduledJob[]>(
          ["/api/scheduling/calendar", rangeStart, rangeEnd],
          (old = []) => {
            const without = (old ?? []).filter(j => j.id !== variables.jobId);
            return normalisedJob ? [...without, normalisedJob] : without;
          }
        );
      }
      // Remove the job from the unscheduled panel immediately.
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/unscheduled"] });
      toast({ title: t("jobScheduled") });
      if (previousStateRef.current) {
        const job = calJobs.find(j => j.id === variables.jobId)
          ?? unscheduled.find(j => j.id === variables.jobId);
        setUndoAction({
          jobId:         variables.jobId,
          jobTitle:      job?.title ?? newJob?.title ?? "Job",
          previousState: previousStateRef.current,
          timestamp:     Date.now(),
        });
        previousStateRef.current = null;
      }
      setPendingDrop(null);
    },
    onError: () => toast({ title: t("errorSchedulingJob"), variant: "destructive" }),
  });

  const unscheduleMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest("PATCH", `/api/scheduling/jobs/${jobId}/unschedule`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/unscheduled"] });
      toast({ title: t("removedFromSchedule") });
    },
    onError: () => toast({ title: t("errorRemovingJob"), variant: "destructive" }),
  });

  const undoMutation = useMutation({
    mutationFn: async ({ jobId, previousState }: { jobId: string; previousState: UndoPreviousState }) => {
      if (previousState.was_scheduled) {
        await apiRequest("PATCH", `/api/scheduling/jobs/${jobId}/schedule`, {
          scheduled_date:  previousState.scheduled_date,
          scheduled_start: previousState.scheduled_start_time,
          scheduled_end:   previousState.scheduled_end_time,
          division:        previousState.division ?? "General",
          color:           previousState.color ?? "#f59e0b",
          employee_ids:    previousState.employee_ids,
        });
      } else {
        await apiRequest("PATCH", `/api/scheduling/jobs/${jobId}/unschedule`, {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/unscheduled"] });
      toast({ title: t("actionUndone") });
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      setUndoAction(null);
      setUndoSecondsLeft(0);
    },
    onError: () => toast({ title: t("undoFailed"), variant: "destructive" }),
  });

  function handleUndo() {
    if (!undoAction) return;
    undoMutation.mutate({ jobId: undoAction.jobId, previousState: undoAction.previousState });
  }

  // ── Drag & Drop state ─────────────────────────────────────────────────────
  const draggingId = useRef<string | null>(null);

  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [modalStartHour, setModalStartHour] = useState(8);
  const [modalEndHour,   setModalEndHour]   = useState(10);
  const [modalDivision,  setModalDivision]  = useState("Maintenance");
  const [modalColor,     setModalColor]     = useState("#22c55e");
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  // ── Undo state ────────────────────────────────────────────────────────────
  const UNDO_DURATION = 300;
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const previousStateRef = useRef<UndoPreviousState | null>(null);
  const undoIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!undoAction) return;
    setUndoSecondsLeft(UNDO_DURATION);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    undoIntervalRef.current = setInterval(() => {
      setUndoSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(undoIntervalRef.current!);
          setUndoAction(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (undoIntervalRef.current) clearInterval(undoIntervalRef.current); };
  }, [undoAction?.timestamp]);

  const handleDragStart = useCallback((e: React.DragEvent, jobId: string) => {
    draggingId.current = jobId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", jobId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/plain") || draggingId.current;
    if (!jobId) return;

    const existingJob = calJobs.find(j => j.id === jobId) || null;
    const unschJob    = unscheduled.find(j => j.id === jobId) || null;
    const job         = existingJob ?? unschJob;

    if (existingJob) {
      previousStateRef.current = {
        was_scheduled:        true,
        scheduled_date:       existingJob.scheduled_date,
        scheduled_start_time: existingJob.scheduled_start_time,
        scheduled_end_time:   existingJob.scheduled_end_time,
        division:             existingJob.division,
        color:                existingJob.color,
        employee_ids:         existingJob.assigned_crew.map(c => c.id),
      };
    } else {
      previousStateRef.current = {
        was_scheduled: false,
        scheduled_date: null, scheduled_start_time: null,
        scheduled_end_time: null, division: null, color: null, employee_ids: [],
      };
    }

    const defaultDiv   = job?.division ?? "Maintenance";
    const defaultColor = job?.color    ?? getDivisionColor(defaultDiv);

    setModalStartHour(hour);
    setModalEndHour(Math.min(hour + 2, 19));
    setModalDivision(defaultDiv);
    setModalColor(defaultColor);
    setSelectedEmpIds([]);
    setPendingDrop({ jobId, date: format(day, "yyyy-MM-dd"), hour });
  }, [calJobs, unscheduled]);

  const pendingJob = pendingDrop
    ? (calJobs.find(j => j.id === pendingDrop.jobId) ?? unscheduled.find(j => j.id === pendingDrop.jobId))
    : null;

  function toggleEmp(empId: string) {
    setSelectedEmpIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  }

  function confirmSchedule() {
    if (!pendingDrop) return;
    scheduleMutation.mutate({
      jobId:           pendingDrop.jobId,
      scheduled_date:  pendingDrop.date,
      scheduled_start: hourToTime(modalStartHour),
      scheduled_end:   hourToTime(modalEndHour),
      division:        modalDivision,
      color:           modalColor,
      employee_ids:    selectedEmpIds,
    });
  }

  function getJobsForDay(day: Date): ScheduledJob[] {
    const dayStr = format(day, "yyyy-MM-dd");
    // Slice to 10 chars to handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ" formats
    return calJobs.filter(j => (j.scheduled_date ?? "").slice(0, 10) === dayStr);
  }

  function jobCountForDay(day: Date) {
    return getJobsForDay(day).length;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" data-testid="scheduling-page">

      {/* ── Left: Unscheduled jobs panel ── */}
      <div className="w-64 flex-shrink-0 border-r flex flex-col bg-muted/20">
        <div className="px-3 py-3 border-b bg-background">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t("unscheduled")}</span>
            <Badge variant="secondary" className="ml-auto">{unscheduled.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t("dragToSchedule")}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {unschLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!unschLoading && unscheduled.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">{t("allScheduled")}</p>
            </div>
          )}
          {unscheduled.map(job => {
            const divColor = getDivisionColor(job.division, job.color ?? "#22c55e");
            return (
              <div
                key={job.id}
                draggable
                onDragStart={e => handleDragStart(e, job.id)}
                data-testid={`unscheduled-job-${job.id}`}
                className="rounded-lg border bg-background px-2.5 py-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow select-none"
                style={{ borderLeftColor: divColor, borderLeftWidth: 3 }}
              >
                <div className="font-medium text-xs truncate">{job.title}</div>
                {job.customer_name && (
                  <div className="text-[10px] text-muted-foreground truncate">{job.customer_name}</div>
                )}
                {job.property_address && (
                  <div className="text-[10px] text-muted-foreground truncate">{job.property_address}</div>
                )}
                <div className="mt-1 flex items-center gap-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[job.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {job.status.replace(/_/g, " ")}
                  </span>
                  {job.division && (
                    <span className="text-[10px] text-muted-foreground">{job.division}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Calendar ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page title */}
        <div className="px-4 pt-3 pb-0 shrink-0">
          <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-page-title">Scheduling</h1>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline"
              onClick={() => setWeekBase(w => subWeeks(w, 1))}
              data-testid="btn-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => setWeekBase(new Date())}
              data-testid="btn-today"
            >
              {t("today")}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => setWeekBase(w => addWeeks(w, 1))}
              data-testid="btn-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold ml-2">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
          </div>

          {/* Division legend */}
          <div className="flex items-center gap-4">
            {DIVISIONS.map(d => (
              <div key={d.value} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day headers */}
        <div
          className="grid border-b bg-muted/20 shrink-0"
          style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
        >
          <div className="border-r" />
          {weekDays.map(day => {
            const todayDay = isToday(day);
            const cnt      = jobCountForDay(day);
            return (
              <div key={day.toISOString()} className="text-center py-2 border-r last:border-r-0">
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {format(day, "EEE")}
                </div>
                <div className={`text-lg font-bold leading-none mt-0.5 ${todayDay ? "text-green-500" : ""}`}>
                  {format(day, "d")}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {cnt > 0 ? t("jobCount", { count: cnt }) : ""}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div className="flex-1 overflow-y-auto">
          {calLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!calLoading && (
            <div
              className="grid"
              style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
            >
              {/* Time label column */}
              <div>
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="border-b border-r text-[10px] text-muted-foreground text-right pr-2 flex items-start pt-1"
                    style={{ height: CELL_H }}
                  >
                    {hourTo12(h)}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map(day => {
                const dayJobs = getJobsForDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className="relative border-r last:border-r-0"
                    style={{ minHeight: HOURS.length * CELL_H }}
                  >
                    {HOURS.map(h => (
                      <div
                        key={h}
                        className="border-b border-dashed border-muted-foreground/20 hover:bg-primary/5 transition-colors"
                        style={{ height: CELL_H }}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, day, h)}
                        data-testid={`cell-${format(day, "yyyy-MM-dd")}-${h}`}
                      />
                    ))}

                    {dayJobs.map(job => {
                      const startH = parseHour(job.scheduled_start_time) ?? 8;
                      const endH   = parseHour(job.scheduled_end_time)   ?? startH + 2;
                      const clampedStart = Math.max(startH, HOURS[0]);
                      const clampedEnd   = Math.min(endH,   HOURS[HOURS.length - 1] + 1);
                      const top    = (clampedStart - HOURS[0]) * CELL_H;
                      const height = Math.max((clampedEnd - clampedStart) * CELL_H, 28);
                      const bg     = job.color ?? getDivisionColor(job.division);

                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={e => handleDragStart(e, job.id)}
                          className="absolute left-0.5 right-0.5 rounded text-white text-[10px] px-1.5 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing hover:brightness-90 transition-all group"
                          style={{ top, height, backgroundColor: bg }}
                          data-testid={`cal-job-${job.id}`}
                        >
                          <div className="font-semibold truncate leading-tight">{job.title}</div>
                          {height >= 44 && job.customer_name && (
                            <div className="truncate opacity-80 leading-tight">{job.customer_name}</div>
                          )}
                          {height >= 60 && job.assigned_crew.length > 0 && (
                            <div className="truncate opacity-70 leading-tight">
                              {job.assigned_crew.map(c => c.first_name).join(", ")}
                            </div>
                          )}
                          {/* Remove button */}
                          <button
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-black/30 rounded p-0.5 transition-opacity"
                            onClick={e => { e.stopPropagation(); unscheduleMutation.mutate(job.id); }}
                            data-testid={`btn-unschedule-${job.id}`}
                            title={t("removeFromSchedule")}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Undo Button ── */}
      {undoAction && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 shadow-lg"
          data-testid="undo-container"
        >
          <Button
            variant="default"
            size="sm"
            onClick={handleUndo}
            disabled={undoMutation.isPending}
            data-testid="btn-undo-schedule"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-md"
          >
            {undoMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RotateCcw className="h-4 w-4" />}
            <span>
              {t("undo")} "{undoAction.jobTitle}" (
              {String(Math.floor(undoSecondsLeft / 60)).padStart(1, "0")}:{String(undoSecondsLeft % 60).padStart(2, "0")}
              )
            </span>
          </Button>
          <button
            onClick={() => { setUndoAction(null); if (undoIntervalRef.current) clearInterval(undoIntervalRef.current); }}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-background border hover:bg-muted transition-colors"
            data-testid="btn-dismiss-undo"
            title={t("dismiss")}
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* ── Schedule Modal ── */}
      <Dialog open={!!pendingDrop} onOpenChange={open => !open && setPendingDrop(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              {t("scheduleJob")}
            </DialogTitle>
          </DialogHeader>

          {pendingJob && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="font-medium text-sm">{pendingJob.title}</div>
                {pendingJob.customer_name && (
                  <div className="text-xs text-muted-foreground">{pendingJob.customer_name}</div>
                )}
                {pendingJob.property_address && (
                  <div className="text-xs text-muted-foreground">{pendingJob.property_address}</div>
                )}
              </div>

              <div>
                <Label className="text-xs">{t("dateLabel")}</Label>
                <div className="mt-1 text-sm font-medium">
                  {pendingDrop && format(parseISO(pendingDrop.date), "EEEE, MMMM d, yyyy")}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t("startTime")}</Label>
                  <Select
                    value={String(modalStartHour)}
                    onValueChange={v => setModalStartHour(Number(v))}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-start-hour">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map(h => (
                        <SelectItem key={h} value={String(h)}>{hourTo12(h)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("endTime")}</Label>
                  <Select
                    value={String(modalEndHour)}
                    onValueChange={v => setModalEndHour(Number(v))}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-end-hour">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.filter(h => h > modalStartHour).map(h => (
                        <SelectItem key={h} value={String(h)}>{hourTo12(h)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">{t("division")}</Label>
                <Select
                  value={modalDivision}
                  onValueChange={v => {
                    setModalDivision(v);
                    setModalColor(getDivisionColor(v));
                  }}
                >
                  <SelectTrigger className="mt-1" data-testid="select-division">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIVISIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.value}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {employees.length > 0 && (
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> {t("assignCrewCount", { count: selectedEmpIds.length })}
                  </Label>
                  <div className="mt-2 max-h-36 overflow-y-auto border rounded-md divide-y">
                    {employees.map(emp => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer"
                        data-testid={`crew-checkbox-${emp.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmpIds.includes(emp.id)}
                          onChange={() => toggleEmp(emp.id)}
                          className="rounded"
                        />
                        <span className="text-sm flex-1">
                          {emp.first_name} {emp.last_name}
                        </span>
                        {emp.position && (
                          <span className="text-xs text-muted-foreground">{emp.position}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingDrop(null)} data-testid="btn-cancel-schedule">
              {t("cancel")}
            </Button>
            <Button
              onClick={confirmSchedule}
              disabled={scheduleMutation.isPending}
              data-testid="btn-confirm-schedule"
            >
              {scheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("confirmSchedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
