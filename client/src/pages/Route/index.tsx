import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { clockIn, clockOut } from "@/lib/timeApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Navigation, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  work_areas: any[];
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
}

interface PersistedState {
  currentStopIndex: number;
  draftNotes: Record<string, string>;
  draftPhotos: Record<string, string[]>;
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

function mapsHref(address: string | null | undefined): string {
  if (!address) return "#";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
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
  clockedOutJobIds,
  onNext,
  onClockOutComplete,
}: {
  stops: Stop[];
  index: number;
  draftNotes: Record<string, string>;
  clockedOutJobIds: Set<string>;
  onNext: () => void;
  /** Called after a successful clock-out with the job id. */
  onClockOutComplete: (jobId: string, isLastStop: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

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
                  href={mapsHref(address)}
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
    </div>
  );
}

// ── SummaryView ───────────────────────────────────────────────────────────────

function SummaryView({ stops }: { stops: Stop[] }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="text-5xl">🎉</div>
      <h2 data-testid="text-summary-heading" className="text-2xl font-bold">Route Complete</h2>
      <p className="text-muted-foreground text-sm">
        You finished {stops.length} stop{stops.length !== 1 ? "s" : ""} today. Great work!
      </p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function RoutePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

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

  const [phase, setPhase] = useState<Phase>("pre");
  const [weather, setWeather] = useState<string[]>([]);

  // Tracks which job IDs have had their clock-out completed this session.
  // Lifted here so it survives between stop index transitions.
  const [clockedOutJobIds, setClockedOutJobIds] = useState<Set<string>>(new Set());

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
    lsWrite(storageKey, { currentStopIndex: stopIndex, draftNotes, draftPhotos });
  }, [storageKey, stopIndex, draftNotes, draftPhotos]);

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
  // Reserved — no endpoint yet.

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
          clockedOutJobIds={clockedOutJobIds}
          onNext={handleNext}
          onClockOutComplete={handleClockOutComplete}
        />
      )}

      {phase === "summary" && <SummaryView stops={data.stops} />}
    </div>
  );
}
