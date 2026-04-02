import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, Pencil, User, MapPin, Calendar, Clock,
  DollarSign, Briefcase, Timer, ChevronDown, Loader2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import { JobFormModal, JOB_STATUSES } from "./JobFormModal";
import { useAuth } from "@/hooks/use-auth";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimeEntry {
  id: string; clock_in: string; clock_out: string | null;
  duration_minutes: number | null; entry_type: string; employee_name: string | null;
}
interface JobDetail {
  id: string; title: string; client: string; status: string; stage: string;
  job_type: string | null; type: string | null; description: string | null;
  scheduled_date: string | null; scheduled_start_time: string | null;
  scheduled_end_time: string | null; completion_date: string | null;
  estimated_hours: string | null; actual_hours: string | null;
  price: string | null; value: number | null; crew_notes: string | null; notes: string | null;
  customer_id: string | null; property_id: string | null;
  cust_first: string | null; cust_last: string | null; cust_company: string | null;
  prop_address: string | null; prop_city: string | null; prop_state: string | null; prop_zip: string | null;
  created_at: string; updated_at: string;
  time_entries: TimeEntry[];
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  lead:        { label: "Lead",        cls: "bg-gray-100 text-gray-700 border-gray-200",      dot: "bg-gray-400" },
  scheduled:   { label: "Scheduled",   cls: "bg-blue-100 text-blue-800 border-blue-200",      dot: "bg-blue-500" },
  in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-800 border-amber-200",   dot: "bg-amber-500 animate-pulse" },
  completed:   { label: "Completed",   cls: "bg-green-100 text-green-800 border-green-200",   dot: "bg-green-500" },
  invoiced:    { label: "Invoiced",    cls: "bg-purple-100 text-purple-800 border-purple-200",dot: "bg-purple-500" },
  cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-800 border-red-200",         dot: "bg-red-500" },
};

const STATUS_ORDER = ["lead","scheduled","in_progress","completed","invoiced"];

function fmtDate(d: string | null) {
  if (!d) return null;
  try { return format(parseISO(d), "MMMM d, yyyy"); } catch { return d; }
}
function fmtTime(t: string | null) {
  if (!t) return null;
  // t is a TIME string like "08:00:00"
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}
function fmtMoney(v: any) {
  const n = Number(v);
  if (!v && v !== 0) return null;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtMinutes(mins: number | null) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: React.ReactNode; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        {href
          ? <a href={href} className="text-sm font-medium text-primary hover:underline">{value}</a>
          : <p className="text-sm font-medium">{value}</p>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveRole } = useAuth();
  const isAdminOrManager = ["Admin", "Manager", "Master Admin"].includes(effectiveRole ?? "");

  const [showEdit, setShowEdit] = useState(false);
  const [crewNotes, setCrewNotes] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const { data: job, isLoading, error } = useQuery<JobDetail>({
    queryKey: ["/api/jobs", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${id}`);
      if (!res.ok) throw new Error("Job not found");
      const data = await res.json();
      setCrewNotes(data.crew_notes ?? data.notes ?? "");
      return data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/jobs/${id}/status`, { status: newStatus });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const saveNotes = async () => {
    if (!job) return;
    setSavingNotes(true);
    try {
      await apiRequest("PATCH", `/api/jobs/${id}`, { crew_notes: crewNotes, notes: crewNotes });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      toast({ title: "Notes saved" });
    } catch {
      toast({ title: "Failed to save notes", variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !job) {
    return <div className="p-8 text-center text-muted-foreground">Job not found.</div>;
  }

  const status = job.status || "lead";
  const statusInfo = STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-muted", dot: "bg-muted" };
  const custName = job.cust_first ? `${job.cust_first} ${job.cust_last}` : (job.cust_company ?? job.client);
  const propAddr = [job.prop_address, job.prop_city, job.prop_state, job.prop_zip].filter(Boolean).join(", ");

  const actualHours = job.actual_hours ? parseFloat(String(job.actual_hours)) : 0;
  const estimatedHours = job.estimated_hours ? parseFloat(String(job.estimated_hours)) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")} className="text-muted-foreground"
          data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" /> Jobs
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{job.title || job.client}</h1>
        </div>
        {isAdminOrManager && (
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-edit-job">
            <Pencil className="h-4 w-4 mr-1.5" /> Edit Job
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
        {/* ── Left Column ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              {/* Status — big, clickable */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">Status</p>
                {isAdminOrManager ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors hover:opacity-90 ${statusInfo.cls}`}
                        data-testid="button-status">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                        <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {JOB_STATUSES.map((s) => (
                        <DropdownMenuItem
                          key={s.value}
                          className={`cursor-pointer ${status === s.value ? "font-bold" : ""}`}
                          onClick={() => statusMutation.mutate(s.value)}
                        >
                          {s.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${statusInfo.cls}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </span>
                )}
              </div>

              <Separator className="mb-3" />

              {/* Info rows */}
              <InfoRow
                icon={User} label="Customer" value={custName}
                href={job.customer_id ? `/customers/${job.customer_id}` : undefined}
              />
              {propAddr && <InfoRow icon={MapPin} label="Property" value={propAddr} />}
              <InfoRow icon={Briefcase} label="Job Type" value={job.job_type || job.type} />
              <InfoRow
                icon={Calendar} label="Scheduled"
                value={fmtDate(job.scheduled_date) ?? undefined}
              />
              {(job.scheduled_start_time || job.scheduled_end_time) && (
                <InfoRow
                  icon={Clock} label="Time"
                  value={[fmtTime(job.scheduled_start_time), fmtTime(job.scheduled_end_time)].filter(Boolean).join(" – ")}
                />
              )}
              <InfoRow icon={DollarSign} label="Price" value={fmtMoney(job.price ?? job.value) ?? undefined} />
            </CardContent>
          </Card>

          {/* Crew Notes (left col quick view) */}
          {(job.crew_notes || job.notes) && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground font-medium">Crew Notes</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm whitespace-pre-wrap">{job.crew_notes || job.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="time">Time Entries</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Timer className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Estimated Hours</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-est-hours">
                    {estimatedHours != null ? `${estimatedHours}h` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Actual Hours</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-actual-hours">
                    {actualHours > 0 ? `${actualHours.toFixed(1)}h` : "—"}
                  </p>
                  {estimatedHours && actualHours > 0 && (
                    <p className={`text-xs mt-1 ${actualHours > estimatedHours ? "text-red-500" : "text-green-600"}`}>
                      {actualHours > estimatedHours
                        ? `${(actualHours - estimatedHours).toFixed(1)}h over`
                        : `${(estimatedHours - actualHours).toFixed(1)}h remaining`}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Job Value</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-price">
                    {fmtMoney(job.price ?? job.value) ?? "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Time Entries</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-entries-count">
                    {job.time_entries.length}
                  </p>
                </CardContent>
              </Card>
            </div>

            {job.description && (
              <Card className="mt-4">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm">Scope of Work</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{job.description}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Time Entries Tab */}
          <TabsContent value="time">
            <Card>
              <CardContent className="p-0">
                {job.time_entries.length === 0 ? (
                  <div className="py-12 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No time entries linked to this job yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the Clock In widget and select this job to start tracking.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {job.time_entries.map((te) => (
                        <TableRow key={te.id} data-testid={`row-te-${te.id}`}>
                          <TableCell className="font-medium text-sm">
                            {te.employee_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {te.clock_in ? format(parseISO(te.clock_in), "MMM d, h:mm a") : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {te.clock_out ? format(parseISO(te.clock_out), "MMM d, h:mm a") : (
                              <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {fmtMinutes(te.duration_minutes)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground capitalize">
                            {te.entry_type?.replace("_", " ") ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm">Crew Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={crewNotes ?? ""}
                  onChange={(e) => setCrewNotes(e.target.value)}
                  rows={8}
                  placeholder="Add internal crew notes here…"
                  className="resize-none"
                  data-testid="textarea-crew-notes"
                  readOnly={!isAdminOrManager}
                />
                {isAdminOrManager && (
                  <Button size="sm" onClick={saveNotes} disabled={savingNotes} data-testid="button-save-notes">
                    {savingNotes ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Save Notes
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Job created</p>
                    <p className="text-xs text-muted-foreground">
                      {job.created_at ? format(parseISO(job.created_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                    </p>
                  </div>
                </div>
                {job.updated_at && job.updated_at !== job.created_at && (
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Last updated</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(job.updated_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${STATUS_MAP[status]?.dot ?? "bg-muted"}`} />
                  <div>
                    <p className="text-sm font-medium">
                      Current status: <span className="font-semibold">{STATUS_MAP[status]?.label ?? status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status === "completed" && job.completion_date
                        ? `Completed on ${fmtDate(job.completion_date)}`
                        : "Set via status control"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Modal */}
      {showEdit && job && (
        <JobFormModal
          open={showEdit}
          onOpenChange={setShowEdit}
          initialData={{
            id: job.id,
            title: job.title,
            customer_id: job.customer_id ?? "",
            property_id: job.property_id ?? "",
            job_type: job.job_type ?? "",
            status: job.status,
            scheduled_date: job.scheduled_date?.split("T")[0] ?? "",
            scheduled_start_time: job.scheduled_start_time ?? "",
            scheduled_end_time: job.scheduled_end_time ?? "",
            estimated_hours: job.estimated_hours ? String(job.estimated_hours) : "",
            price: job.price ? String(job.price) : job.value ? String(job.value) : "",
            description: job.description ?? "",
            crew_notes: job.crew_notes ?? job.notes ?? "",
          }}
        />
      )}
    </div>
  );
}
