import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Ban,
  Search,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
} from "lucide-react";
import { Redirect } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string;
  title: string;
  status: string;
  division: string | null;
  address: string | null;
  scheduled_date: string | null;
  customer_name: string | null;
}

interface WorkArea {
  id: string;
  job_id: string;
  name: string;
  status: string;
  estimated_hours: number | null;
  actual_hours_computed: number | null;
  sort_order: number;
  notes: string | null;
  is_active: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-600 border-gray-200",
  active:    "bg-blue-50 text-blue-700 border-blue-200",
  on_hold:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  completed: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "Pending",
  active:    "Active",
  on_hold:   "On Hold",
  completed: "Completed",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  scheduled:   "bg-blue-50 text-blue-700",
  in_progress: "bg-orange-50 text-orange-700",
  completed:   "bg-green-50 text-green-700",
  cancelled:   "bg-red-50 text-red-700",
};

function fmtHours(h: number | null | undefined) {
  if (!h) return null;
  const n = Number(h);
  if (isNaN(n)) return null;
  return n % 1 === 0 ? `${n}h` : `${n.toFixed(1)}h`;
}

// ─── Inline Add Form ──────────────────────────────────────────────────────────
function AddWorkAreaForm({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/jobs/${jobId}/work-areas`, {
        name: name.trim(),
        notes: notes.trim() || null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      }),
    onSuccess: () => {
      toast({ title: "Work area added" });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/work-areas`] });
      onDone();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <form
      data-testid="add-work-area-form"
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate(); }}
      className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3"
    >
      <p className="text-sm font-semibold text-primary">New Work Area</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`wa-name-${jobId}`} className="text-xs">Name *</Label>
          <Input
            id={`wa-name-${jobId}`}
            data-testid="input-work-area-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Front lawn mowing"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`wa-hours-${jobId}`} className="text-xs">Estimated Hours</Label>
          <Input
            id={`wa-hours-${jobId}`}
            data-testid="input-work-area-hours"
            type="number"
            min="0.25"
            step="0.25"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="e.g. 2.5"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`wa-notes-${jobId}`} className="text-xs">Notes / Description</Label>
        <Textarea
          id={`wa-notes-${jobId}`}
          data-testid="input-work-area-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions or scope details…"
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="button-cancel-add-work-area"
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          data-testid="button-submit-work-area"
          disabled={!name.trim() || mutation.isPending}
        >
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
          Add Work Area
        </Button>
      </div>
    </form>
  );
}

// ─── Inline Edit Form ─────────────────────────────────────────────────────────
function EditWorkAreaForm({
  jobId,
  area,
  onDone,
}: {
  jobId: string;
  area: WorkArea;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(area.name);
  const [notes, setNotes] = useState(area.notes ?? "");
  const [status, setStatus] = useState(area.status);
  const [estimatedHours, setEstimatedHours] = useState(
    area.estimated_hours != null ? String(area.estimated_hours) : ""
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/jobs/${jobId}/work-areas/${area.id}`, {
        name: name.trim(),
        notes: notes.trim() || null,
        status,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      }),
    onSuccess: () => {
      toast({ title: "Work area updated" });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/work-areas`] });
      onDone();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <form
      data-testid={`edit-work-area-form-${area.id}`}
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      className="border border-blue-200 rounded-lg p-4 bg-blue-50/50 space-y-3"
    >
      <p className="text-sm font-semibold text-blue-700">Edit: {area.name}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Name *</Label>
          <Input
            data-testid={`input-edit-name-${area.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estimated Hours</Label>
          <Input
            data-testid={`input-edit-hours-${area.id}`}
            type="number"
            min="0.25"
            step="0.25"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="e.g. 2.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid={`select-status-${area.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notes / Description</Label>
          <Textarea
            data-testid={`input-edit-notes-${area.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
            className="resize-none text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}
          data-testid={`button-cancel-edit-${area.id}`}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!name.trim() || mutation.isPending}
          data-testid={`button-save-edit-${area.id}`}>
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

// ─── Work Area Row ────────────────────────────────────────────────────────────
function WorkAreaRow({
  jobId,
  area,
}: {
  jobId: string;
  area: WorkArea;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const deactivateMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/jobs/${jobId}/work-areas/${area.id}`),
    onSuccess: () => {
      toast({ title: "Work area deactivated" });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/work-areas`] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (editing) {
    return (
      <div className="py-1">
        <EditWorkAreaForm jobId={jobId} area={area} onDone={() => setEditing(false)} />
      </div>
    );
  }

  const actualH = fmtHours(area.actual_hours_computed);
  const estH = fmtHours(area.estimated_hours);

  return (
    <div
      data-testid={`work-area-row-${area.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 group transition-colors"
    >
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          area.status === "completed" ? "bg-green-500" :
          area.status === "active"    ? "bg-blue-500"  :
          area.status === "on_hold"   ? "bg-yellow-500" :
          "bg-gray-300"
        }`}
      />

      {/* Name + notes */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{area.name}</p>
        {area.notes && (
          <p className="text-xs text-muted-foreground truncate">{area.notes}</p>
        )}
      </div>

      {/* Status badge */}
      <Badge
        variant="outline"
        className={`text-xs shrink-0 ${STATUS_COLORS[area.status] ?? ""}`}
        data-testid={`badge-status-${area.id}`}
      >
        {STATUS_LABELS[area.status] ?? area.status}
      </Badge>

      {/* Hours */}
      {(estH || actualH) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock className="w-3 h-3" />
          <span data-testid={`text-hours-${area.id}`}>
            {actualH ?? "0h"}{estH ? ` / ${estH}` : ""}
          </span>
        </div>
      )}

      {/* Actions — visible on hover / always visible on touch */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          data-testid={`button-edit-area-${area.id}`}
          onClick={() => setEditing(true)}
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              data-testid={`button-deactivate-area-${area.id}`}
              title="Deactivate"
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Ban className="w-3.5 h-3.5" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate work area?</AlertDialogTitle>
              <AlertDialogDescription>
                "<span className="font-medium">{area.name}</span>" will be hidden from field
                worker views immediately. Time history is preserved. This can be reversed by
                re-activating the area.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid={`button-confirm-deactivate-${area.id}`}
                onClick={() => deactivateMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: workAreas = [], isLoading } = useQuery<WorkArea[]>({
    queryKey: [`/api/jobs/${job.id}/work-areas`],
    queryFn: () =>
      apiRequest("GET", `/api/jobs/${job.id}/work-areas`).then((r) => r.json()),
    enabled: expanded,
  });

  return (
    <Card data-testid={`job-card-${job.id}`} className="overflow-hidden">
      {/* Job header — click to expand */}
      <button
        data-testid={`button-expand-job-${job.id}`}
        className="w-full text-left"
        onClick={() => { setExpanded((v) => !v); setAdding(false); }}
      >
        <CardHeader className="py-3 px-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-muted-foreground">
              {expanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{job.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {job.customer_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    {job.customer_name}
                  </span>
                )}
                {job.address && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    {job.address}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {job.division && (
                <Badge variant="outline" className="text-xs capitalize">
                  {job.division}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`text-xs capitalize ${JOB_STATUS_COLORS[job.status] ?? ""}`}
              >
                {job.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </button>

      {/* Expanded content */}
      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-2">
          <div className="h-px bg-border mb-3" />

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading work areas…
            </div>
          )}

          {!isLoading && workAreas.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              No work areas yet for this job.
            </p>
          )}

          {!isLoading && workAreas.length > 0 && (
            <div className="divide-y divide-border rounded-lg border overflow-hidden">
              {workAreas.map((wa) => (
                <WorkAreaRow key={wa.id} jobId={job.id} area={wa} />
              ))}
            </div>
          )}

          {adding && (
            <AddWorkAreaForm jobId={job.id} onDone={() => setAdding(false)} />
          )}

          {!adding && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-dashed"
              data-testid={`button-add-work-area-${job.id}`}
              onClick={() => setAdding(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Work Area
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WorkAreasPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: allJobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs").then((r) => r.json()),
  });

  // Guard: admin only
  if (user && (user as any).role !== "Admin" && (user as any).role !== "MasterAdmin") {
    return <Redirect to="/admin" />;
  }

  const filtered = allJobs.filter((j) => {
    const q = search.toLowerCase();
    return (
      !q ||
      j.title.toLowerCase().includes(q) ||
      (j.customer_name ?? "").toLowerCase().includes(q) ||
      (j.address ?? "").toLowerCase().includes(q) ||
      (j.division ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16 pt-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title-work-areas">
            Work Areas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage work areas across all active jobs. Add, edit, or deactivate areas for field crews.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span>{allJobs.length} jobs loaded</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          data-testid="input-search-jobs"
          className="pl-9"
          placeholder="Filter jobs by name, customer, address or division…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading jobs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {search ? "No jobs match your search." : "No jobs found."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
