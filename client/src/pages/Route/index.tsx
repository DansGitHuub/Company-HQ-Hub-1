import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import { buildNavUrl, type MapApp } from "@/lib/mapUrl";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { clockIn, clockOut } from "@/lib/timeApi";
import { useIsOnline } from "@/hooks/useIsOnline";
import OfflineBanner from "@/components/OfflineBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Navigation, Clock, Camera, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WorkArea {
  id: string;
  name: string;
  status: string;
  sort_order: number;
  is_active: boolean;
}

interface Photo {
  id: number;
  photo_type: "before" | "after" | "damage" | "other";
  photo_url: string;
}

interface Stop {
  id: string;
  sort_order: number;
  title: string;
  status: string;
  customer_name: string | null;
  customer_address: string | null;
  address: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  work_areas: WorkArea[];
  photos: Photo[];
  session_id: number | null;
  session_status: string | null;
  skip_reason: string | null;
  skipped_at: string | null;
  time_entry_id: string | null;
  time_entry_clock_in: string | null;
}

interface RouteDay {
  id: string;
  employee_id: string;
  date: string;
  weather: string[];
  started_at: string | null;
  completed_at: string | null;
  status: string;
}

interface RouteData {
  route_day: RouteDay;
  stops: Stop[];
  total_minutes_today: number;
}

interface PersistedState {
  currentStopIndex: number;
  draftNotes: Record<string, string>;
  draftPhotos: Record<string, string[]>;
  summaryNotes: string;
  clockedOutJobIds: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

type Phase = "pre" | "stop" | "summary";

const WEATHER_OPTIONS = [
  { value: "sunny",  label: "☀️ Sunny" },
  { value: "cloudy", label: "☁️ Cloudy" },
  { value: "rain",   label: "🌧️ Rain" },
  { value: "snow",   label: "❄️ Snow" },
  { value: "windy",  label: "💨 Windy" },
  { value: "hot",    label: "🥵 Hot" },
  { value: "cold",   label: "🥶 Cold" },
];

// ─── localStorage helpers ───────────────────────────────────────────────────────

function lsKey(userId: string, date: string): string {
  return `route:${userId}:${date}`;
}

function lsRead(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      currentStopIndex: typeof parsed.currentStopIndex === "number" ? parsed.currentStopIndex : 0,
      draftNotes: parsed.draftNotes && typeof parsed.draftNotes === "object" ? parsed.draftNotes : {},
      draftPhotos: parsed.draftPhotos && typeof parsed.draftPhotos === "object" ? parsed.draftPhotos : {},
      summaryNotes: typeof parsed.summaryNotes === "string" ? parsed.summaryNotes : "",
      clockedOutJobIds: Array.isArray(parsed.clockedOutJobIds) ? parsed.clockedOutJobIds : [],
    };
  } catch {
    return null;
  }
}

function lsWrite(key: string, value: PersistedState): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently degrade — private mode or quota exceeded.
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently degrade.
  }
}

function lsSweepStale(todayDate: string): void {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("route:")) continue;
      const datePart = key.slice(key.lastIndexOf(":") + 1);
      if (datePart.match(/^\d{4}-\d{2}-\d{2}$/) && datePart < todayDate) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Silently degrade.
  }
}

function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function mapsHref(address: string | null | undefined, mapApp?: string): string {
  if (!address) return "#";
  return buildNavUrl(address, (mapApp ?? "google") as MapApp);
}

function uniqueCustomers(stops: Stop[]): number {
  const names = stops
    .map((s) => s.customer_name)
    .filter((n): n is string => Boolean(n));
  return new Set(names).size;
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Stop Materials ────────────────────────────────────────────────────────────
function StopMaterials({ sessionId }: { sessionId: number }) {
  const { data: materials = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/worksheets", sessionId, "materials"],
    queryFn: () =>
      fetch(`/api/worksheets/${sessionId}/materials`, { credentials: "include" })
        .then(r => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (materials.length === 0) return (
    <p className="text-sm text-muted-foreground italic">No materials logged yet</p>
  );

  return (
    <ul className="space-y-1">
      {materials.map((m: any) => (
        <li key={m.id} className="flex items-start gap-2 text-sm">
          <span className="mt-1 w-2 h-2 rounded-full bg-orange-400 shrink-0" />
          <span>
            <span className="font-medium">{m.material_name || "Unknown"}</span>
            {m.quantity != null && (
              <span className="text-muted-foreground ml-1">{m.quantity}{m.unit ? ` ${m.unit}` : ""}</span>
            )}
            {m.notes && <span className="text-muted-foreground ml-1 italic">— {m.notes}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Sub-views ─────────────────────────────────────────────────────────────────

function PreView({
  data,
  weather,
  setWeather,
  onStart,
  starting,
}: {
  data: RouteData;
  weather: string[];
  setWeather: (w: string[]) => void;
  onStart: () => void;
  starting: boolean;
}) {
  const { stops } = data;
  const customers = uniqueCustomers(stops);

  function toggleWeather(value: string) {
    setWeather(
      weather.includes(value)
        ? weather.filter((w) => w !== value)
        : [...weather, value]
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Date */}
      <div>
        <p data-testid="text-route-date" className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
          {formatDate(new Date())}
        </p>
        <h1 className="text-2xl font-bold mt-1">Today's Route</h1>
      </div>

      {/* Stops summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-6">
            <div className="text-center">
              <p data-testid="text-stop-count" className="text-3xl font-bold">{stops.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Stop{stops.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p data-testid="text-customer-count" className="text-3xl font-bold">{customers}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Customer{customers !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weather multi-select */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Weather conditions</p>
        <div className="flex flex-wrap gap-2">
          {WEATHER_OPTIONS.map((opt) => {
            const active = weather.includes(opt.value);
            return (
              <button
                key={opt.value}
                data-testid={`chip-weather-${opt.value}`}
                onClick={() => toggleWeather(opt.value)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors select-none",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Route CTA */}
      <Button
        data-testid="button-start-route"
        size="lg"
        className="w-full text-base h-14"
        disabled={starting || stops.length === 0}
        onClick={onStart}
      >
        {starting ? (
          <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Starting…</>
        ) : (
          "Start Route"
        )}
      </Button>

      {stops.length === 0 && (
        <p data-testid="text-no-stops" className="text-center text-muted-foreground text-sm">
          No stops scheduled for today.
        </p>
      )}
    </div>
  );
}

// ── StopView ──────────────────────────────────────────────────────────────────

function StopView({
  stops,
  index,
  draftNotes,
  setDraftNotes,
  clockedOutJobIds,
  onNext,
  onClockOutComplete,
}: {
  stops: Stop[];
  index: number;
  draftNotes: Record<string, string>;
  setDraftNotes: Dispatch<SetStateAction<Record<string, string>>>;
  clockedOutJobIds: Set<string>;
  onNext: () => void;
  /** Called after a successful clock-out with the job id. */
  onClockOutComplete: (jobId: string, isLastStop: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const stop = stops[index];
  const total = stops.length;
  const progress = Math.round((index / total) * 100);
  const address = stop?.customer_address ?? stop?.address ?? null;

  // Derive active time entry from the flat fields the API returns.
  const activeEntry =
    stop?.time_entry_id
      ? { id: stop.time_entry_id, clock_in: stop.time_entry_clock_in ?? "" }
      : null;

  const isCompletedStop = clockedOutJobIds.has(stop?.id ?? "");

  // ── Elapsed timer ────────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeEntry?.clock_in) {
      setElapsed(0);
      return;
    }
    const clockInMs = new Date(activeEntry.clock_in).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - clockInMs) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeEntry?.clock_in]);

  // ── Clock-in handler ─────────────────────────────────────────────────────────
  const [clockingIn, setClockingIn] = useState(false);

  async function handleClockIn() {
    if (!stop) return;
    setClockingIn(true);
    const result = await clockIn({
      job_id: stop.id,
      job_work_area_id: null,
      work_area_name: null,
      localId: crypto.randomUUID(),
    });
    setClockingIn(false);
    if (!result.success) {
      toast({
        title: "Clock-in failed",
        description: result.error ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    qc.invalidateQueries({ queryKey: ["/api/route/today"] });
  }

  // ── Clock-out handler ────────────────────────────────────────────────────────
  const [clockingOut, setClockingOut] = useState(false);

  async function handleClockOut() {
    if (!stop || !activeEntry) return;
    setClockingOut(true);
    const result = await clockOut({
      time_entry_id: activeEntry.id,
      notes: draftNotes[stop.id] ?? "",
    });
    setClockingOut(false);
    if (!result.success) {
      toast({
        title: "Clock-out failed",
        description: result.error ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    // Refetch so time_entry_id clears in the stop data.
    qc.invalidateQueries({ queryKey: ["/api/route/today"] });
    onClockOutComplete(stop.id, index === stops.length - 1);
  }

  // ── Work-area checklist ───────────────────────────────────────────────────────
  // Optimistic status overrides: workAreaId → 'completed' | 'pending'
  const [waOverrides, setWaOverrides] = useState<Record<string, string>>({});
  // Work-area IDs currently being patched (shows spinner on the checkbox row).
  const [waToggling, setWaToggling] = useState<Set<string>>(new Set());

  // Reset overrides when the stop changes so stale state doesn't bleed across.
  useEffect(() => {
    setWaOverrides({});
    setWaToggling(new Set());
  }, [stop?.id]);

  async function handleWorkAreaToggle(waId: string, checked: boolean) {
    if (!stop) return;
    const newStatus = checked ? "completed" : "pending";
    // Optimistic update first.
    setWaOverrides((prev) => ({ ...prev, [waId]: newStatus }));
    setWaToggling((prev) => new Set(prev).add(waId));
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/jobs/${stop.id}/work-areas/${waId}`,
        { status: newStatus }
      );
      if (!res.ok) {
        // Revert optimistic update on failure.
        setWaOverrides((prev) => {
          const n = { ...prev };
          delete n[waId];
          return n;
        });
        toast({
          title: "Couldn't update work area",
          description: "Please try again.",
          variant: "destructive",
        });
      } else {
        // Refresh in background — keeps server state in sync.
        qc.invalidateQueries({ queryKey: ["/api/route/today"] });
      }
    } catch {
      // Network error — revert.
      setWaOverrides((prev) => {
        const n = { ...prev };
        delete n[waId];
        return n;
      });
    } finally {
      setWaToggling((prev) => {
        const n = new Set(prev);
        n.delete(waId);
        return n;
      });
    }
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────
  const PHOTO_TYPES = [
    { type: "before",  label: "Before"  },
    { type: "after",   label: "After"   },
    { type: "damage",  label: "Damage"  },
    { type: "other",   label: "Other"   },
  ] as const;

  const photoInputRefs = {
    before:  useRef<HTMLInputElement>(null),
    after:   useRef<HTMLInputElement>(null),
    damage:  useRef<HTMLInputElement>(null),
    other:   useRef<HTMLInputElement>(null),
  };
  const [uploadingTypes, setUploadingTypes] = useState<Set<string>>(new Set());

  // Reset uploading state when stop changes
  useEffect(() => {
    setUploadingTypes(new Set());
  }, [stop?.id]);

  async function handlePhotoFile(
    photoType: "before" | "after" | "damage" | "other",
    file: File
  ) {
    if (!stop?.session_id) return;
    setUploadingTypes((prev) => new Set(prev).add(photoType));
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("photo_type", photoType);
      const res = await fetch(`/api/worksheets/${stop.session_id}/photos`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          title: "Photo upload failed",
          description: body.error ?? "Please try again.",
          variant: "destructive",
        });
      } else {
        qc.invalidateQueries({ queryKey: ["/api/route/today"] });
      }
    } catch {
      toast({
        title: "Photo upload failed",
        description: "Network error — please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingTypes((prev) => {
        const n = new Set(prev);
        n.delete(photoType);
        return n;
      });
    }
  }

  // ── Skip / Reschedule ────────────────────────────────────────────────────────
  const SKIP_REASONS = [
    "Locked Gate",
    "Customer Not Ready",
    "Equipment Issue",
    "Weather",
    "Property Inaccessible",
    "Other",
  ];

  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0]);
  const [skipNotes, setSkipNotes] = useState("");
  const [skipping, setSkipping] = useState(false);

  async function handleSkip() {
    if (!stop) return;
    const reason = skipNotes.trim()
      ? `${skipReason} — ${skipNotes.trim()}`
      : skipReason;
    setSkipping(true);
    try {
      const res = await apiRequest("PATCH", `/api/route/stops/${stop.id}/skip`, { reason });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          title: "Couldn't skip stop",
          description: body.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      setShowSkipModal(false);
      qc.invalidateQueries({ queryKey: ["/api/route/today"] });
      onNext();
    } catch {
      toast({
        title: "Couldn't skip stop",
        description: "Network error — please try again.",
        variant: "destructive",
      });
    } finally {
      setSkipping(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p data-testid="text-stop-progress" className="text-sm font-medium text-muted-foreground">
            Stop {index + 1} of {total}
            {stop?.customer_name ? ` · ${stop.customer_name}` : ""}
          </p>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            data-testid="progress-bar-route"
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Job title */}
      <div>
        <h2 data-testid="text-stop-title" className="text-xl font-bold leading-snug">
          {stop?.title ?? "Untitled Stop"}
        </h2>
        {stop?.customer_name && (
          <p data-testid="text-stop-customer" className="text-muted-foreground text-sm mt-0.5">
            {stop.customer_name}
          </p>
        )}
      </div>

      {/* Address card — tap to navigate */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p data-testid="text-stop-address" className="text-sm text-foreground break-words">
                {address ?? "No address available"}
              </p>
              {address && (
                <a
                  data-testid="link-navigate-stop"
                  href={mapsHref(address, user?.preferredMapApp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary hover:underline"
                >
                  <Navigation className="h-4 w-4" />
                  Navigate
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work-area checklist */}
      {stop?.work_areas && stop.work_areas.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Work Areas
          </p>
          <div className="flex flex-col gap-2">
            {stop.work_areas.map((wa) => {
              const effectiveStatus = waOverrides[wa.id] ?? wa.status;
              const isChecked = effectiveStatus === "completed";
              const isToggling = waToggling.has(wa.id);
              return (
                <div
                  key={wa.id}
                  data-testid={`row-work-area-${wa.id}`}
                  className="flex items-center gap-3 py-1"
                >
                  {isToggling ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <Checkbox
                      id={`wa-${wa.id}`}
                      data-testid={`checkbox-work-area-${wa.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleWorkAreaToggle(wa.id, Boolean(checked))
                      }
                    />
                  )}
                  <label
                    htmlFor={`wa-${wa.id}`}
                    className={[
                      "text-sm leading-none cursor-pointer select-none",
                      isChecked ? "line-through text-muted-foreground" : "text-foreground",
                    ].join(" ")}
                  >
                    {wa.name}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Materials logged */}
      {stop?.session_id && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Materials Needed
          </p>
          <StopMaterials sessionId={stop.session_id} />
        </div>
      )}

      {/* Notes editor */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Notes
        </p>
        <RichTextEditor
          value={draftNotes[stop?.id ?? ""] ?? ""}
          onChange={(html) =>
            setDraftNotes((prev) => ({ ...prev, [stop.id]: html }))
          }
          placeholder="Add notes for this stop…"
          minHeight="120px"
        />
      </div>

      {/* Photo upload */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Photos
        </p>
        {stop?.session_id ? (
          <>
            {/* Hidden file inputs — one per type */}
            {PHOTO_TYPES.map(({ type }) => (
              <input
                key={type}
                ref={photoInputRefs[type]}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                data-testid={`input-photo-${type}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoFile(type, file);
                  e.target.value = "";
                }}
              />
            ))}

            {/* Four labeled buttons */}
            <div className="grid grid-cols-4 gap-2">
              {PHOTO_TYPES.map(({ type, label }) => {
                const busy = uploadingTypes.has(type);
                return (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    data-testid={`button-photo-${type}`}
                    disabled={busy}
                    onClick={() => photoInputRefs[type].current?.click()}
                    className="flex flex-col items-center gap-1 h-auto py-2 text-xs"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {label}
                  </Button>
                );
              })}
            </div>

            {/* Thumbnail strip */}
            {stop.photos && stop.photos.length > 0 && (
              <div
                data-testid="scroll-photo-thumbnails"
                className="flex gap-2 overflow-x-auto mt-3 pb-1"
              >
                {stop.photos.map((photo) => (
                  <div key={photo.id} className="relative shrink-0">
                    <img
                      data-testid={`img-photo-${photo.id}`}
                      src={photo.photo_url}
                      alt={photo.photo_type}
                      className="h-20 w-20 object-cover rounded-md border"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5 rounded-b-md capitalize">
                      {photo.photo_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p
            data-testid="text-photos-locked"
            className="text-sm text-muted-foreground italic"
          >
            Clock in to upload photos
          </p>
        )}
      </div>

      {/* Clock-in / Clock-out / Next Stop */}
      {isCompletedStop ? (
        // Clock-out already done for this stop — show navigation button.
        <Button
          data-testid="button-next-stop"
          size="lg"
          className="w-full text-base h-14"
          onClick={onNext}
        >
          {index + 1 < total ? `Next Stop (${index + 2} of ${total})` : "Finish Route"}
        </Button>
      ) : activeEntry ? (
        // Currently clocked in — show timer and Clock Out.
        <div className="flex flex-col gap-3">
          <div
            data-testid="text-clock-timer"
            className="flex items-center justify-center gap-2 text-sm font-mono text-muted-foreground"
          >
            <Clock className="h-4 w-4" />
            {formatElapsed(elapsed)}
          </div>
          <Button
            data-testid="button-clock-out"
            variant="outline"
            size="lg"
            className="w-full h-12"
            disabled={clockingOut}
            onClick={handleClockOut}
          >
            {clockingOut && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
            Clock Out
          </Button>
        </div>
      ) : (
        // Not yet clocked in.
        <Button
          data-testid="button-clock-in"
          size="lg"
          className="w-full h-12"
          disabled={clockingIn}
          onClick={handleClockIn}
        >
          {clockingIn && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          Clock In
        </Button>
      )}

      {/* Skip / Reschedule — only shown while the stop is not yet completed */}
      {!isCompletedStop && (
        <Button
          data-testid="button-skip-stop"
          variant="ghost"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => {
            setSkipReason(SKIP_REASONS[0]);
            setSkipNotes("");
            setShowSkipModal(true);
          }}
        >
          Skip / Reschedule
        </Button>
      )}

      {/* Skip modal */}
      <Dialog open={showSkipModal} onOpenChange={setShowSkipModal}>
        <DialogContent data-testid="dialog-skip-stop">
          <DialogHeader>
            <DialogTitle>Skip this stop?</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <RadioGroup
              value={skipReason}
              onValueChange={setSkipReason}
              className="flex flex-col gap-2"
            >
              {SKIP_REASONS.map((reason) => (
                <div key={reason} className="flex items-center gap-2">
                  <RadioGroupItem
                    id={`skip-reason-${reason}`}
                    value={reason}
                    data-testid={`radio-skip-reason-${reason.replace(/\s+/g, "-").toLowerCase()}`}
                  />
                  <Label htmlFor={`skip-reason-${reason}`} className="cursor-pointer">
                    {reason}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex flex-col gap-1">
              <Label htmlFor="skip-notes" className="text-sm text-muted-foreground">
                Notes (optional)
              </Label>
              <Textarea
                id="skip-notes"
                data-testid="textarea-skip-notes"
                placeholder="Add any additional details…"
                value={skipNotes}
                onChange={(e) => setSkipNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              data-testid="button-skip-cancel"
              variant="outline"
              onClick={() => setShowSkipModal(false)}
              disabled={skipping}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-skip-confirm"
              variant="destructive"
              onClick={handleSkip}
              disabled={skipping}
            >
              {skipping && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
              Confirm Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SummaryView ───────────────────────────────────────────────────────────────

function SummaryView({
  stops,
  totalMinutes,
  weather,
  summaryNotes,
  setSummaryNotes,
  onSubmit,
  submitting,
}: {
  stops: Stop[];
  totalMinutes: number;
  weather: string[];
  summaryNotes: string;
  setSummaryNotes: (s: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const completedStatuses = ["pending_review", "submitted", "approved"];
  const completedCount = stops.filter(
    (s) => s.session_status != null && completedStatuses.includes(s.session_status)
  ).length;
  const skippedStops = stops.filter((s) => s.session_status === "skipped");

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Heading */}
      <div>
        <div className="text-4xl mb-2">🎉</div>
        <h2 data-testid="text-summary-heading" className="text-2xl font-bold">Route Complete</h2>
        <p className="text-muted-foreground text-sm">Here's your day at a glance.</p>
      </div>

      {/* Stats: total time + completed stops */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p data-testid="text-summary-total-time" className="text-2xl font-bold">
              {formatMinutes(totalMinutes)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Time on site</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p data-testid="text-summary-completed-count" className="text-2xl font-bold">
              {completedCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Completed stop{completedCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Skipped stops list */}
      {skippedStops.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Skipped stops</p>
          <div className="flex flex-col gap-2">
            {skippedStops.map((s) => (
              <Card key={s.id} data-testid={`card-skipped-stop-${s.id}`}>
                <CardContent className="py-3 px-4">
                  <p className="font-medium text-sm">{s.title}</p>
                  {s.customer_name && (
                    <p className="text-xs text-muted-foreground">{s.customer_name}</p>
                  )}
                  {s.skip_reason && (
                    <p className="text-xs text-muted-foreground italic mt-1">{s.skip_reason}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Weather — read-only chips (only selected ones shown) */}
      {weather.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Weather conditions</p>
          <div className="flex flex-wrap gap-2">
            {WEATHER_OPTIONS.filter((opt) => weather.includes(opt.value)).map((opt) => (
              <span
                key={opt.value}
                data-testid={`chip-summary-weather-${opt.value}`}
                className="px-3 py-1.5 rounded-full text-sm font-medium border bg-primary text-primary-foreground border-primary select-none"
              >
                {opt.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Day notes — RichTextEditor */}
      <div>
        <p className="text-sm font-medium mb-2">Day notes</p>
        <RichTextEditor
          value={summaryNotes}
          onChange={setSummaryNotes}
          placeholder="Add any notes about the day…"
          minHeight="160px"
        />
      </div>

      {/* Submit Day */}
      <Button
        data-testid="button-submit-day"
        size="lg"
        className="w-full text-base h-14"
        disabled={submitting}
        onClick={onSubmit}
      >
        {submitting ? (
          <><Loader2 className="animate-spin mr-2 h-5 w-5" />Submitting…</>
        ) : (
          "Submit Day"
        )}
      </Button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function RoutePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isOnline = useIsOnline();

  const today = todayISODate();
  const storageKey = user?.id ? lsKey(user.id, today) : null;

  // ── Hydrate persisted state (lazy initialisers run synchronously) ─────────────

  const [stopIndex, setStopIndex] = useState<number>(() => {
    if (!storageKey) return 0;
    return lsRead(storageKey)?.currentStopIndex ?? 0;
  });

  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(() => {
    if (!storageKey) return {};
    return lsRead(storageKey)?.draftNotes ?? {};
  });

  const [draftPhotos, setDraftPhotos] = useState<Record<string, string[]>>(() => {
    if (!storageKey) return {};
    return lsRead(storageKey)?.draftPhotos ?? {};
  });

  const [summaryNotes, setSummaryNotes] = useState<string>(() => {
    if (!storageKey) return "";
    return lsRead(storageKey)?.summaryNotes ?? "";
  });

  const [phase, setPhase] = useState<Phase>("pre");
  const [weather, setWeather] = useState<string[]>([]);

  // Tracks which job IDs have had their clock-out completed this session.
  // Lifted here so it survives between stop index transitions.
  const [clockedOutJobIds, setClockedOutJobIds] = useState<Set<string>>(() => {
    if (!storageKey) return new Set<string>();
    return new Set<string>(lsRead(storageKey)?.clockedOutJobIds ?? []);
  });

  const hasHydratedPhase = useRef(false);

  // ── Fetch today's route data ──────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<RouteData>({
    queryKey: ["/api/route/today"],
    queryFn: () =>
      fetch("/api/route/today", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load route");
        return r.json();
      }),
    retry: 1,
  });

  // ── Mount: sweep stale localStorage entries ───────────────────────────────────
  useEffect(() => {
    lsSweepStale(today);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── After data loads: resume phase from localStorage ─────────────────────────
  useEffect(() => {
    if (!data || hasHydratedPhase.current) return;
    hasHydratedPhase.current = true;
    if (!storageKey) return;
    const saved = lsRead(storageKey);
    if (!saved) return;
    const alreadyStarted = Boolean(data.route_day?.started_at);
    const validIndex = saved.currentStopIndex < data.stops.length;
    if (alreadyStarted && data.stops.length > 0 && validIndex) {
      setPhase("stop");
    }
  }, [data, storageKey]);

  // ── Persist state changes to localStorage ────────────────────────────────────
  useEffect(() => {
    if (!storageKey) return;
    lsWrite(storageKey, {
      currentStopIndex: stopIndex,
      draftNotes,
      draftPhotos,
      summaryNotes,
      clockedOutJobIds: Array.from(clockedOutJobIds),
    });
  }, [storageKey, stopIndex, draftNotes, draftPhotos, summaryNotes, clockedOutJobIds]);

  // ── Start route mutation ──────────────────────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/route/start").then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/route/today"] });
      setStopIndex(0);
      setPhase("stop");
    },
    onError: () => {
      toast({ title: "Couldn't start route", description: "Please try again.", variant: "destructive" });
    },
  });

  // ── Phase D: POST /api/route/submit → lsRemove(storageKey) ───────────────────
  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/route/submit", {
        summary_notes: summaryNotes,
        weather: Array.from(weather),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (storageKey) lsRemove(storageKey);
      toast({ title: "Day submitted" });
      navigate("/dashboard");
    },
    onError: () => {
      toast({
        title: "Submit failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // ── Navigation ────────────────────────────────────────────────────────────────
  function handleNext() {
    const stops = data?.stops ?? [];
    if (stopIndex + 1 < stops.length) {
      setStopIndex((i) => i + 1);
    } else {
      setPhase("summary");
    }
  }

  function handleClockOutComplete(jobId: string, isLastStop: boolean) {
    setClockedOutJobIds((prev) => new Set(prev).add(jobId));
    if (isLastStop) {
      setPhase("summary");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 flex justify-center">
        <Loader2 data-testid="loader-route" className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <p data-testid="text-route-error" className="text-destructive text-sm">
          Unable to load today's route. Please refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 min-h-screen">
      <OfflineBanner />
      {!isOnline && data && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3" data-testid="banner-cached-route">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Showing saved data (offline)
        </div>
      )}
      {phase === "pre" && (
        <PreView
          data={data}
          weather={weather}
          setWeather={setWeather}
          onStart={() => startMutation.mutate()}
          starting={startMutation.isPending}
        />
      )}

      {phase === "stop" && (
        <StopView
          stops={data.stops}
          index={stopIndex}
          draftNotes={draftNotes}
          setDraftNotes={setDraftNotes}
          clockedOutJobIds={clockedOutJobIds}
          onNext={handleNext}
          onClockOutComplete={handleClockOutComplete}
        />
      )}

      {phase === "summary" && (
        <SummaryView
          stops={data.stops}
          totalMinutes={data.total_minutes_today}
          weather={weather}
          summaryNotes={summaryNotes}
          setSummaryNotes={setSummaryNotes}
          onSubmit={() => submitMutation.mutate()}
          submitting={submitMutation.isPending}
        />
      )}
    </div>
  );
}
