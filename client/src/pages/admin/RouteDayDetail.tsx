import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string;
  duration_minutes: number | null;
  notes: string | null;
  entry_type: string | null;
  work_area_name: string | null;
}

interface StopPhoto {
  id: number;
  photo_type: string;
  photo_url: string;
  caption: string | null;
}

interface Stop {
  job_id: string;
  job_title: string;
  customer_name: string | null;
  sort_order: number;
  session_id: number | null;
  session_status: string | null;
  skip_reason: string | null;
  skipped_at: string | null;
  time_entries: TimeEntry[];
  photos: StopPhoto[];
}

interface RouteDayDetail {
  id: string;
  date: string;
  weather: string[];
  summary_notes: string | null;
  status: string;
  employee_name: string;
  employee_id: string;
  started_at: string | null;
  completed_at: string | null;
  total_minutes: number;
  completed_count: number;
  stops: Stop[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const WEATHER_ICON: Record<string, string> = {
  sunny: "☀️", cloudy: "☁️", rainy: "🌧️", stormy: "⛈️",
  windy: "💨", snowy: "❄️", foggy: "🌫️", hail: "🌨️",
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtDate(iso: string): string {
  try { return format(parseISO(iso), "EEEE, MMMM d, yyyy"); } catch { return iso; }
}

function fmtTime(iso: string): string {
  try { return format(new Date(iso), "h:mm a"); } catch { return iso; }
}

function stopStatusConfig(status: string | null): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "skipped":
      return {
        label: "Skipped",
        className: "bg-amber-100 text-amber-700 border border-amber-300",
        icon: <XCircle className="h-3.5 w-3.5" />,
      };
    case "active":
      return {
        label: "In Progress",
        className: "bg-blue-100 text-blue-700 border border-blue-300",
        icon: <Clock className="h-3.5 w-3.5" />,
      };
    case "pending_review":
    case "submitted":
    case "approved":
      return {
        label: "Completed",
        className: "bg-green-100 text-green-700 border border-green-300",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    default:
      return {
        label: "Pending",
        className: "bg-gray-100 text-gray-600 border border-gray-300",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      };
  }
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: "Before",
  after: "After",
  during: "During",
  issue: "Issue",
  receipt: "Receipt",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function RouteDayDetail() {
  const { user } = useAuth();
  const { routeDayId } = useParams<{ routeDayId: string }>();
  const [, navigate] = useLocation();

  const isAdmin =
    (user as any)?.role === "Admin" ||
    (user as any)?.role === "Manager" ||
    (user as any)?.isMasterAdmin;

  const { data, isLoading, error } = useQuery<RouteDayDetail>({
    queryKey: ["/api/admin/route-days", routeDayId],
    queryFn: () =>
      apiRequest("GET", `/api/admin/route-days/${routeDayId}`).then((r) => {
        if (!r.ok) return r.json().then((e: any) => Promise.reject(new Error(e.error ?? "Not found")));
        return r.json();
      }),
    enabled: isAdmin && !!routeDayId,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Access denied.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1 as any)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-center py-16 text-gray-500">
          {(error as any)?.message ?? "Route day not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1 as any)}
        data-testid="btn-back"
        className="-ml-1"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {/* ── Summary card ─────────────────────────────────────────────────── */}
      <Card data-testid="card-summary">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-xl font-bold text-gray-900 flex items-center gap-2"
                data-testid="text-employee-name"
              >
                <MapPin className="h-5 w-5 text-green-600 shrink-0" />
                {data.employee_name}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5" data-testid="text-route-date">
                {fmtDate(data.date)}
              </p>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-600 flex-wrap">
                <span data-testid="text-total-minutes">
                  🕐 {formatMinutes(data.total_minutes)} total
                </span>
                <span data-testid="text-completed-count">
                  ✅ {data.completed_count} completed
                </span>
                <span data-testid="text-stop-count">
                  📍 {data.stops.length} stops
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Status badge */}
              <Badge
                className={
                  data.status === "approved"
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : data.status === "rejected"
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : data.status === "submitted"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-gray-100 text-gray-600 border border-gray-300"
                }
                data-testid="badge-status"
              >
                {data.status.replace("_", " ")}
              </Badge>
              {/* Weather chips */}
              {data.weather.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end">
                  {data.weather.map((w) => (
                    <span
                      key={w}
                      className="text-xs bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5"
                    >
                      {WEATHER_ICON[w] ?? ""} {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary notes */}
          {data.summary_notes && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Day Notes
              </p>
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: data.summary_notes }}
                data-testid="text-summary-notes"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Stop list ────────────────────────────────────────────────────── */}
      <h2 className="text-base font-semibold text-gray-700">
        Stops ({data.stops.length})
      </h2>

      {data.stops.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No stops found for this route day.</p>
      )}

      <div className="space-y-3">
        {data.stops.map((stop, idx) => {
          const statusCfg = stopStatusConfig(stop.session_status);
          const totalStopMins = stop.time_entries.reduce(
            (sum, te) => sum + (te.duration_minutes ?? 0),
            0
          );

          return (
            <Card
              key={stop.job_id}
              data-testid={`card-stop-${stop.job_id}`}
              className="overflow-hidden"
            >
              <CardContent className="pt-4 pb-4">
                {/* Stop header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-gray-900 text-sm"
                      data-testid={`text-stop-title-${stop.job_id}`}
                    >
                      {idx + 1}. {stop.job_title}
                    </p>
                    {stop.customer_name && (
                      <p
                        className="text-xs text-gray-500 mt-0.5"
                        data-testid={`text-stop-customer-${stop.job_id}`}
                      >
                        {stop.customer_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCfg.className}`}
                    data-testid={`badge-stop-status-${stop.job_id}`}
                  >
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>
                </div>

                {/* Skip reason */}
                {stop.skip_reason && (
                  <div
                    className="mb-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800"
                    data-testid={`text-skip-reason-${stop.job_id}`}
                  >
                    <span className="font-medium">Skip reason:</span> {stop.skip_reason}
                  </div>
                )}

                {/* Time entries */}
                {stop.time_entries.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Time Entries
                      {totalStopMins > 0 && (
                        <span className="ml-2 text-gray-500 normal-case font-normal">
                          ({formatMinutes(totalStopMins)} total)
                        </span>
                      )}
                    </p>
                    <div className="space-y-1.5">
                      {stop.time_entries.map((te) => (
                        <div
                          key={te.id}
                          className="flex items-start gap-2 text-xs text-gray-700"
                          data-testid={`row-time-entry-${te.id}`}
                        >
                          <Clock className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <span className="font-mono">
                              {fmtTime(te.clock_in)} – {te.clock_out ? fmtTime(te.clock_out) : "—"}
                            </span>
                            {te.duration_minutes != null && (
                              <span className="ml-2 text-gray-500">
                                ({formatMinutes(te.duration_minutes)})
                              </span>
                            )}
                            {te.work_area_name && (
                              <span className="ml-2 text-gray-400">· {te.work_area_name}</span>
                            )}
                            {te.entry_type && te.entry_type !== "billable" && (
                              <span className="ml-2 bg-gray-100 rounded px-1 text-gray-500">
                                {te.entry_type}
                              </span>
                            )}
                            {te.notes && (
                              <p className="text-gray-500 mt-0.5 pl-1 italic">
                                {te.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos */}
                {stop.photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Photos ({stop.photos.length})
                    </p>
                    <div
                      className="flex gap-2 overflow-x-auto pb-1"
                      data-testid={`photos-${stop.job_id}`}
                    >
                      {stop.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="shrink-0 flex flex-col items-center gap-0.5"
                          data-testid={`photo-${photo.id}`}
                        >
                          <a
                            href={photo.photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={photo.photo_url}
                              alt={photo.photo_type}
                              className="h-16 w-16 rounded object-cover border border-gray-200 hover:opacity-90 transition-opacity"
                            />
                          </a>
                          <span className="text-[10px] text-gray-500">
                            {PHOTO_TYPE_LABELS[photo.photo_type] ?? photo.photo_type}
                          </span>
                          {photo.caption && (
                            <span className="text-[10px] text-gray-400 max-w-[64px] truncate">
                              {photo.caption}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state for stop with no time entries and no photos */}
                {stop.time_entries.length === 0 && stop.photos.length === 0 && !stop.skip_reason && (
                  <p className="text-xs text-gray-400 italic">No activity recorded for this stop.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
