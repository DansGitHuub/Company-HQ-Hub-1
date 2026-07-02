import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  format, addDays, parseISO, differenceInCalendarDays, isToday, isTomorrow
} from "date-fns";
import {
  Users, MapPin, Clock, AlertTriangle, Package,
  ChevronDown, ChevronUp, ExternalLink, CalendarDays,
  Truck, HardHat, RefreshCw, CheckCircle, ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

// ── Types ────────────────────────────────────────────────────────────────────

interface CrewMember {
  employee_id: string;
  employee_name: string;
  sort_order: number;
}

interface EquipItem {
  equipment_id: string;
  equipment_name: string;
}

interface Job {
  id: string;
  title: string;
  client: string;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  division: string | null;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  estimated_hours: number | null;
  crew_lead_id: string | null;
  crew_lead_name: string | null;
  crew_lead_display_name: string | null;
  crew: CrewMember[];
  equipment: EquipItem[];
}

interface CrewGroup {
  crewLabel: string;
  crewLeadId: string | null;
  jobs: Job[];
}

interface Material {
  item_name: string;
  units: string | null;
  total_quantity: string;
  item_number: string | null;
}

interface Conflict {
  type: "crew" | "equipment";
  name: string;
  description: string;
  jobs: { id: string; title: string; start_time: string | null; end_time: string | null }[];
}

interface OverdueJob {
  id: string;
  title: string;
  client: string;
  scheduled_date: string;
  status: string;
  address: string | null;
  city: string | null;
  division: string | null;
  crew_lead_display_name: string | null;
}

interface DailyPlanData {
  date: string;
  jobs: Job[];
  crewGroups: CrewGroup[];
  materials: Material[];
  conflicts: Conflict[];
  overdueJobs: OverdueJob[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function jobAddressLine(job: Pick<Job, "address" | "city" | "state">) {
  return [job.address, job.city, job.state].filter(Boolean).join(", ");
}

function dateLabel(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "EEEE, MMMM d");
  } catch {
    return dateStr;
  }
}

function daysOverdue(dateStr: string, relativeTo: string) {
  try {
    const scheduled = parseISO(dateStr);
    const ref = parseISO(relativeTo);
    const diff = differenceInCalendarDays(ref, scheduled);
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function JobRow({ job }: { job: Job }) {
  const addr = jobAddressLine(job);
  const startTime = formatTime(job.scheduled_start_time);
  const endTime = formatTime(job.scheduled_end_time);
  const crewNames = job.crew.length
    ? job.crew.map((c) => c.employee_name).join(", ")
    : null;

  return (
    <div
      data-testid={`daily-plan-job-${job.id}`}
      className="flex items-start gap-3 py-3 border-b last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/jobs/${job.id}`}>
            <a className="font-medium text-sm hover:underline text-primary">
              {job.title || job.client}
            </a>
          </Link>
          {job.title && job.client && job.title !== job.client && (
            <span className="text-xs text-muted-foreground">· {job.client}</span>
          )}
          {job.division && (
            <Badge variant="outline" className="text-xs py-0 h-5">{job.division}</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {addr && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {addr}
            </span>
          )}
          {(startTime || job.estimated_hours) && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {startTime ? (
                <>
                  {startTime}{endTime ? ` – ${endTime}` : ""}
                  {job.estimated_hours ? ` (${job.estimated_hours}h est.)` : ""}
                </>
              ) : (
                `${job.estimated_hours}h est.`
              )}
            </span>
          )}
          {crewNames && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3 shrink-0" />
              {crewNames}
            </span>
          )}
          {job.equipment.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3 shrink-0" />
              {job.equipment.map((e) => e.equipment_name).join(", ")}
            </span>
          )}
        </div>
      </div>

      <Link href={`/jobs/${job.id}`}>
        <a>
          <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground mt-0.5" />
        </a>
      </Link>
    </div>
  );
}

function CrewGroupCard({ group, index }: { group: CrewGroup; index: number }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card data-testid={`crew-group-${index}`}>
      <CardHeader className="py-3 px-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setExpanded((v) => !v)}
          data-testid={`crew-group-toggle-${index}`}
        >
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardHat className="h-4 w-4 text-muted-foreground" />
            {group.crewLabel}
            <Badge variant="secondary" className="ml-1 text-xs">
              {group.jobs.length} job{group.jobs.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="py-0 px-4 pb-3">
          {group.jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function SummaryCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: number; icon: any; color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DailyPlanPage() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(tomorrow);

  const { data, isLoading, isError, error, refetch } = useQuery<DailyPlanData>({
    queryKey: ["/api/daily-plan", selectedDate],
    queryFn: () =>
      apiRequest("GET", `/api/daily-plan?date=${selectedDate}`).then((r) => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  const displayLabel = dateLabel(selectedDate);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            data-testid="daily-plan-title"
          >
            <CalendarDays className="h-6 w-6 text-primary" />
            Daily Plan
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{displayLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="daily-plan-date-picker"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            data-testid="daily-plan-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading plan…
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {(error as any)?.message ?? "Failed to load daily plan."}
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          {/* ── Summary strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Jobs scheduled"
              value={data.jobs.length}
              icon={ClipboardList}
              color="bg-blue-500"
            />
            <SummaryCard
              label="Crew groups"
              value={data.crewGroups.length}
              icon={Users}
              color="bg-green-500"
            />
            <SummaryCard
              label="Conflicts"
              value={data.conflicts.length}
              icon={AlertTriangle}
              color={data.conflicts.length > 0 ? "bg-red-500" : "bg-slate-400"}
            />
            <SummaryCard
              label="Overdue jobs"
              value={data.overdueJobs.length}
              icon={HardHat}
              color={data.overdueJobs.length > 0 ? "bg-amber-500" : "bg-slate-400"}
            />
          </div>

          {/* ── Section 1: Jobs by Crew ── */}
          <section data-testid="section-jobs-by-crew">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Jobs by Crew
            </h2>
            {data.crewGroups.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No jobs scheduled for {displayLabel}.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.crewGroups.map((group, i) => (
                  <CrewGroupCard key={group.crewLeadId ?? "unassigned"} group={group} index={i} />
                ))}
              </div>
            )}
          </section>

          {/* ── Sections 2 & 3 side-by-side on wider screens ── */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* ── Section 2: Materials Needed ── */}
            <section data-testid="section-materials">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Materials Needed
              </h2>
              <Card>
                {data.materials.length === 0 ? (
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No materials logged for {displayLabel}.
                  </CardContent>
                ) : (
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Item</TableHead>
                          <TableHead className="text-right pr-4">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.materials.map((m, i) => (
                          <TableRow key={i} data-testid={`material-row-${i}`}>
                            <TableCell className="pl-4 py-2">
                              <div className="text-sm font-medium">{m.item_name}</div>
                              {m.item_number && (
                                <div className="text-xs text-muted-foreground">{m.item_number}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-4 py-2 text-sm tabular-nums">
                              {Number(m.total_quantity).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                              {m.units ? ` ${m.units}` : ""}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            </section>

            {/* ── Section 3: Scheduling Conflicts ── */}
            <section data-testid="section-conflicts">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Scheduling Conflicts
              </h2>
              {data.conflicts.length === 0 ? (
                <Card>
                  <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    No conflicts detected for {displayLabel}.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {data.conflicts.map((conflict, i) => (
                    <Card
                      key={i}
                      className="border-red-200 bg-red-50 dark:bg-red-950/20"
                      data-testid={`conflict-card-${i}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{conflict.name}</span>
                              <Badge
                                variant="outline"
                                className="text-xs border-red-300 text-red-700 dark:text-red-400"
                              >
                                {conflict.type === "crew" ? "Crew" : "Equipment"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {conflict.description}
                            </p>
                            <ul className="mt-2 space-y-1">
                              {conflict.jobs.map((j) => (
                                <li key={j.id} className="text-xs flex items-center gap-1">
                                  <span className="font-medium">{j.title}</span>
                                  {j.start_time && (
                                    <span className="text-muted-foreground">
                                      · {formatTime(j.start_time)}
                                      {j.end_time ? ` – ${formatTime(j.end_time)}` : ""}
                                    </span>
                                  )}
                                  <Link href={`/jobs/${j.id}`}>
                                    <a className="ml-1 text-primary">
                                      <ExternalLink className="h-3 w-3 inline" />
                                    </a>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Section 4: Overdue Jobs ── */}
          <section data-testid="section-overdue">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <HardHat className="h-4 w-4 text-primary" />
              Overdue Jobs
              {data.overdueJobs.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {data.overdueJobs.length}
                </Badge>
              )}
            </h2>
            <Card>
              {data.overdueJobs.length === 0 ? (
                <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  No overdue jobs.
                </CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Job</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Days Overdue</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="pr-4">Crew Lead</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.overdueJobs.map((job) => {
                        const overdueDays = daysOverdue(job.scheduled_date, selectedDate);
                        return (
                          <TableRow key={job.id} data-testid={`overdue-row-${job.id}`}>
                            <TableCell className="pl-4 py-2">
                              <div className="flex items-center gap-1">
                                <Link href={`/jobs/${job.id}`}>
                                  <a className="text-sm font-medium hover:underline text-primary">
                                    {job.title || job.client}
                                  </a>
                                </Link>
                                {job.title && job.client && job.title !== job.client && (
                                  <span className="text-xs text-muted-foreground">· {job.client}</span>
                                )}
                              </div>
                              {(job.city || job.address) && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {[job.address, job.city].filter(Boolean).join(", ")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-sm text-muted-foreground">
                              {format(parseISO(job.scheduled_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  overdueDays >= 7
                                    ? "border-red-400 text-red-600"
                                    : overdueDays >= 3
                                    ? "border-amber-400 text-amber-600"
                                    : "border-yellow-300 text-yellow-600"
                                )}
                              >
                                {overdueDays}d
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {job.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-4 py-2 text-sm text-muted-foreground">
                              {job.crew_lead_display_name ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
