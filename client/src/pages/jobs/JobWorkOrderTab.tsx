import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, HardHat, User, MapPin,
  ClipboardCheck, ExternalLink, Loader2, AlertTriangle, Plus,
} from "lucide-react";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Readiness {
  has_areas: boolean;
  has_tasks: boolean;
  has_crew_leader: boolean;
  has_site_notes: boolean;
  deposit_paid: boolean;
}

interface Task {
  id: string;
  description: string;
  is_complete: boolean;
}

interface Area {
  id: string;
  area_name: string;
  tasks: Task[];
}

interface WorkOrder {
  id: string;
  title: string;
  status: string;
  wo_type: string;
  customer_name: string | null;
  customer_address: string | null;
  site_access_notes: string | null;
  crew_leader_name: string | null;
  service_type_name: string | null;
  area_count: number;
  task_count: number;
  areas: Area[];
  readiness: Readiness;
  is_ready: boolean;
}

// ── Status display ─────────────────────────────────────────────────────────────
const WO_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Draft",       cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ready:       { label: "Ready",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  complete:    { label: "Complete",    cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  on_hold:     { label: "On Hold",     cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function ReadinessItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
      <span className={`text-sm ${ok ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  jobId: string;
  isAdminOrManager: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function JobWorkOrderTab({ jobId, isAdminOrManager }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: wo, isLoading, isError } = useQuery<WorkOrder | null>({
    queryKey: ["/api/jobs", jobId, "work-order"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/work-order`);
      if (!res.ok) throw new Error("Failed to load work order");
      return res.json();
    },
  });

  const markReadyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/work-orders/${wo!.id}`, { status: "ready" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "work-order"] });
      toast({ title: "Work Order marked as Ready — crew can now clock in." });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/work-orders", { job_id: jobId });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "work-order"] });
      toast({ title: "Work Order created" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          Failed to load work order data.
        </CardContent>
      </Card>
    );
  }

  // ── No WO yet ─────────────────────────────────────────────────────────────
  if (!wo) {
    return (
      <Card>
        <CardContent className="py-12 text-center" data-testid="wo-empty-state">
          <HardHat className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No Work Order yet</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
            A Work Order is created automatically when a payment is received.
            You can also create one manually below.
          </p>
          {isAdminOrManager && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-create-wo"
            >
              {createMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Create Work Order
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── WO exists ─────────────────────────────────────────────────────────────
  const statusInfo = WO_STATUS_MAP[wo.status] ?? { label: wo.status, cls: "bg-muted text-muted-foreground" };
  const isDraft = wo.status === "draft";

  const readinessItems: { label: string; key: keyof Readiness }[] = [
    { label: "Deposit / payment received",  key: "deposit_paid" },
    { label: "Work areas defined",           key: "has_areas" },
    { label: "Tasks assigned to areas",      key: "has_tasks" },
    { label: "Crew leader assigned",         key: "has_crew_leader" },
    { label: "Site access notes filled in",  key: "has_site_notes" },
  ];

  return (
    <div className="space-y-4" data-testid="job-work-order-tab">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <HardHat className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate">{wo.title}</h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.cls}`}
            data-testid="badge-wo-status"
          >
            {statusInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdminOrManager && isDraft && (
            <Button
              size="sm"
              disabled={!wo.is_ready || markReadyMutation.isPending}
              onClick={() => markReadyMutation.mutate()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-mark-wo-ready"
              title={!wo.is_ready ? "Complete all readiness items first" : "Mark this Work Order as ready for crew"}
            >
              {markReadyMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />}
              Mark as Ready
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/work-orders")}
            data-testid="link-open-wo"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open Full View
          </Button>
        </div>
      </div>

      {/* ── Two-column layout: readiness + details ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Readiness checklist — always show when draft, show when incomplete */}
        {(isDraft || !wo.is_ready) && (
          <Card data-testid="card-readiness">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                {wo.is_ready
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                Handoff Readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {readinessItems.map((item) => (
                <ReadinessItem key={item.key} label={item.label} ok={wo.readiness[item.key]} />
              ))}
              {wo.is_ready ? (
                <p className="text-xs text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-md px-3 py-2 mt-1">
                  All items complete — ready to mark as Ready.
                </p>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-md px-3 py-2 mt-1">
                  Complete all items above to enable "Mark as Ready".
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Details card */}
        <Card data-testid="card-wo-details">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {wo.crew_leader_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Crew Leader:</span>
                <span className="font-medium">{wo.crew_leader_name}</span>
              </div>
            )}
            {wo.service_type_name && (
              <div className="flex items-center gap-2 text-sm">
                <HardHat className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Service:</span>
                <span>{wo.service_type_name}</span>
              </div>
            )}
            {wo.customer_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground flex-shrink-0">Address:</span>
                <span>{wo.customer_address}</span>
              </div>
            )}
            {wo.site_access_notes && (
              <div className="text-sm">
                <p className="text-muted-foreground text-xs mb-1">Site Access Notes:</p>
                <p className="text-xs bg-muted rounded-md px-3 py-2 whitespace-pre-wrap">
                  {wo.site_access_notes}
                </p>
              </div>
            )}
            {!wo.crew_leader_name && !wo.customer_address && !wo.site_access_notes && !wo.service_type_name && (
              <p className="text-xs text-muted-foreground italic">
                No details yet — add them in the full Work Order view.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Areas + Tasks ──────────────────────────────────────────────────── */}
      {wo.areas.length > 0 ? (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Work Areas &amp; Tasks &nbsp;
              <span className="font-normal normal-case text-muted-foreground/70">
                ({wo.area_count} area{wo.area_count !== 1 ? "s" : ""}, {wo.task_count} task{wo.task_count !== 1 ? "s" : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {wo.areas.map((area) => (
              <div key={area.id} className="border rounded-md overflow-hidden" data-testid={`wo-area-${area.id}`}>
                <div className="px-3 py-2 bg-muted/50 flex items-center gap-2">
                  <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{area.area_name}</span>
                </div>
                {area.tasks.length > 0 ? (
                  <ul className="divide-y">
                    {area.tasks.map((task) => (
                      <li key={task.id} className="flex items-center gap-2 px-3 py-2" data-testid={`wo-task-${task.id}`}>
                        {task.is_complete
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                          : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40 flex-shrink-0" />}
                        <span className={`text-xs ${task.is_complete ? "line-through text-muted-foreground" : ""}`}>
                          {task.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground italic">No tasks added yet</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No work areas defined yet.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/work-orders")}
              data-testid="link-add-areas"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Add Areas in Work Order View
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
