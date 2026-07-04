import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  CheckCircle2, Clock, FileCheck, Loader2, Plus, Star,
  ShieldCheck, Send, ThumbsUp, Camera, Image as ImageIcon,
  Package, GitMerge, ClipboardList,
} from "lucide-react";

interface Closeout {
  id: string;
  job_id: string;
  status: string;
  final_scope_confirmed: boolean;
  final_scope_notes: string | null;
  materials_used_confirmed: boolean;
  materials_notes: string | null;
  remaining_issues: string | null;
  warranty_terms: string | null;
  warranty_duration_months: number;
  customer_notes: string | null;
  internal_notes: string | null;
  customer_satisfaction: number | null;
  ready_for_invoice: boolean;
  manager_approved_by_name: string | null;
  manager_approved_at: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface TimeEntry {
  id: string;
  employee_name: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  entry_type: string | null;
}

interface LineItem {
  id: string;
  item_name: string;
  quantity: string;
  unit: string | null;
  unit_price: string;
  line_total: string;
  class_label: string | null;
}

interface ChangeOrder {
  id: string;
  co_number: string;
  title: string;
  status: string;
  total: string | number;
  created_by_name: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:            { label: "Draft",            color: "bg-gray-100 text-gray-700",   icon: FileCheck },
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-700", icon: Clock },
  approved:         { label: "Approved",         color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const CO_STATUS_COLOR: Record<string, string> = {
  draft:            "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-700",
  sent:             "bg-blue-100 text-blue-700",
  approved:         "bg-green-100 text-green-700",
  rejected:         "bg-red-100 text-red-700",
};

const fmt$ = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function minutesToHours(mins: number | null) {
  if (!mins) return 0;
  return mins / 60;
}

// ── Job Data Summary — pulls in real photos, time entries, materials, and
// change orders already recorded for this job so the closeout doesn't
// require re-typing data that already exists elsewhere in the app. ──────────
function JobDataSummary({ jobId }: { jobId: string }) {
  const { data: job } = useQuery<any>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });
  const timeEntries: TimeEntry[] = job?.time_entries ?? [];

  const { data: lineItems = [] } = useQuery<LineItem[]>({
    queryKey: ["/api/jobs", jobId, "line-items"],
    queryFn: () => fetch(`/api/jobs/${jobId}/line-items`, { credentials: "include" })
      .then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });

  const { data: changeOrders = [] } = useQuery<ChangeOrder[]>({
    queryKey: ["/api/jobs", jobId, "change-orders"],
    queryFn: () => fetch(`/api/jobs/${jobId}/change-orders`, { credentials: "include" })
      .then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });

  const { data: ccData } = useQuery<any>({
    queryKey: ["/api/jobs", jobId, "companycam-photos"],
    queryFn: () => fetch(`/api/jobs/${jobId}/companycam-photos`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: wsPhotos = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs", jobId, "worksheet-photos"],
    queryFn: () => fetch(`/api/jobs/${jobId}/worksheet-photos`, { credentials: "include" })
      .then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });
  const ccPhotos: any[] = ccData?.photos ?? [];
  const totalPhotos = ccPhotos.length + wsPhotos.length;

  const totalHours = timeEntries.reduce((sum, te) => sum + minutesToHours(te.duration_minutes), 0);
  const approvedCOs = changeOrders.filter(co => co.status === "approved");
  const approvedCOTotal = approvedCOs.reduce((sum, co) => sum + Number(co.total || 0), 0);
  const materialsTotal = lineItems.reduce((sum, li) => sum + Number(li.line_total || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Job Data Summary
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pulled automatically from this job — review below, no need to re-type it.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Time entries */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Time Logged
            </p>
            <span className="text-xs font-medium" data-testid="text-closeout-total-hours">
              {totalHours.toFixed(1)}h total
            </span>
          </div>
          {timeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center border rounded-md">
              No time entries logged for this job yet
            </p>
          ) : (
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto" data-testid="list-closeout-time-entries">
              {timeEntries.map((te) => (
                <div key={te.id} className="flex items-center justify-between px-3 py-1.5 text-xs" data-testid={`row-closeout-time-${te.id}`}>
                  <div className="min-w-0">
                    <span className="font-medium">{te.employee_name || "Unknown"}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(te.clock_in), "MMM d")} · {format(new Date(te.clock_in), "h:mm a")}
                      {te.clock_out ? ` – ${format(new Date(te.clock_out), "h:mm a")}` : " (in progress)"}
                    </span>
                    {te.entry_type && te.entry_type !== "job" && (
                      <Badge variant="secondary" className="ml-2 text-[10px] capitalize">{te.entry_type}</Badge>
                    )}
                  </div>
                  <span className="font-medium whitespace-nowrap ml-2">
                    {minutesToHours(te.duration_minutes).toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Materials / line items */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Materials / Line Items Used
            </p>
            {lineItems.length > 0 && (
              <span className="text-xs font-medium" data-testid="text-closeout-materials-total">
                {fmt$(materialsTotal)}
              </span>
            )}
          </div>
          {lineItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center border rounded-md">
              No line items recorded for this job
            </p>
          ) : (
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto" data-testid="list-closeout-line-items">
              {lineItems.map((li) => (
                <div key={li.id} className="flex items-center justify-between px-3 py-1.5 text-xs" data-testid={`row-closeout-material-${li.id}`}>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{li.item_name}</span>
                    <span className="text-muted-foreground ml-2">
                      {li.quantity} {li.unit || ""}
                    </span>
                  </div>
                  <span className="font-medium whitespace-nowrap ml-2">{fmt$(Number(li.line_total || 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Change orders */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <GitMerge className="h-3.5 w-3.5" /> Change Orders
            </p>
            {approvedCOs.length > 0 && (
              <span className="text-xs font-medium" data-testid="text-closeout-co-total">
                {fmt$(approvedCOTotal)} approved
              </span>
            )}
          </div>
          {changeOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center border rounded-md">
              No change orders on this job
            </p>
          ) : (
            <div className="border rounded-md divide-y" data-testid="list-closeout-change-orders">
              {changeOrders.map((co) => (
                <div key={co.id} className="flex items-center justify-between px-3 py-1.5 text-xs" data-testid={`row-closeout-co-${co.id}`}>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{co.co_number}</span>
                    <span className="text-muted-foreground ml-2 truncate">{co.title}</span>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap ml-2">
                    <Badge className={`text-[10px] px-1.5 py-0 ${CO_STATUS_COLOR[co.status] || "bg-gray-100 text-gray-700"}`}>
                      {co.status.replace("_", " ")}
                    </Badge>
                    <span className="font-medium">{fmt$(Number(co.total || 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Photos
            </p>
            <span className="text-xs font-medium" data-testid="text-closeout-photo-count">
              {totalPhotos} photo{totalPhotos !== 1 ? "s" : ""}
            </span>
          </div>
          {totalPhotos === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center border rounded-md">
              No photos attached to this job yet
            </p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5" data-testid="grid-closeout-photos">
              {ccPhotos.map((photo: any) => (
                <a key={`cc-${photo.companycam_photo_id}`}
                  href={photo.companycam_app_url || photo.photo_url_web || photo.photo_url_original}
                  target="_blank" rel="noreferrer"
                  className="block group" data-testid={`img-closeout-cc-${photo.companycam_photo_id}`}>
                  <div className="aspect-square rounded-md overflow-hidden bg-muted border">
                    <img src={photo.photo_url_web || photo.photo_url_original} alt={photo.description || "Site photo"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  </div>
                </a>
              ))}
              {wsPhotos.map((photo: any) => (
                <a key={`ws-${photo.id}`} href={photo.photo_url} target="_blank" rel="noreferrer"
                  className="block group" data-testid={`img-closeout-ws-${photo.id}`}>
                  <div className="aspect-square rounded-md overflow-hidden bg-muted border">
                    <img src={photo.photo_url} alt={`${photo.photo_type} photo`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobCloseout({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  // Form state
  const [finalScopeNotes, setFinalScopeNotes] = useState("");
  const [materialsNotes, setMaterialsNotes] = useState("");
  const [remainingIssues, setRemainingIssues] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [finalScopeConfirmed, setFinalScopeConfirmed] = useState(false);
  const [materialsConfirmed, setMaterialsConfirmed] = useState(false);

  const { data: closeout, isLoading } = useQuery<Closeout | null>({
    queryKey: ["/api/jobs", jobId, "closeout"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/closeout`);
      return res.json();
    },
  });

  // Populate form when closeout loads
  useEffect(() => {
    if (closeout) {
      setFinalScopeNotes(closeout.final_scope_notes || "");
      setMaterialsNotes(closeout.materials_notes || "");
      setRemainingIssues(closeout.remaining_issues || "");
      setWarrantyTerms(closeout.warranty_terms || "");
      setWarrantyMonths(closeout.warranty_duration_months || 12);
      setCustomerNotes(closeout.customer_notes || "");
      setInternalNotes(closeout.internal_notes || "");
      setSatisfaction(closeout.customer_satisfaction || null);
      setFinalScopeConfirmed(closeout.final_scope_confirmed || false);
      setMaterialsConfirmed(closeout.materials_used_confirmed || false);
    }
  }, [closeout]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const method = closeout ? "PATCH" : "POST";
      const res = await apiRequest(method, `/api/jobs/${jobId}/closeout`, {
        final_scope_notes: finalScopeNotes || null,
        materials_notes: materialsNotes || null,
        remaining_issues: remainingIssues || null,
        warranty_terms: warrantyTerms || null,
        warranty_duration_months: warrantyMonths,
        customer_notes: customerNotes || null,
        internal_notes: internalNotes || null,
        customer_satisfaction: satisfaction,
        final_scope_confirmed: finalScopeConfirmed,
        materials_used_confirmed: materialsConfirmed,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "closeout"] });
      toast({ title: "Closeout saved" });
      setEditing(false);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/closeout/submit`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "closeout"] });
      toast({ title: "Closeout submitted for approval" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/closeout/approve`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "closeout"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({ title: "Closeout approved — job marked complete, warranty created" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  // No closeout yet — show start button
  if (!closeout && !editing) {
    return (
      <div className="space-y-4">
        <JobDataSummary jobId={jobId} />
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium">No closeout record yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Create a closeout record when the job is complete to capture final details,
              approve warranty, and trigger invoicing.
            </p>
            {isAdminOrManager && (
              <Button onClick={() => setEditing(true)} data-testid="button-start-closeout">
                <Plus className="h-4 w-4 mr-1.5" /> Start Closeout
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = closeout?.status ?? "draft";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const isLocked = status === "approved";

  return (
    <div className="space-y-4">
      {/* Status header */}
      {closeout && !editing && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <StatusIcon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                {closeout.ready_for_invoice && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                    Ready for Invoice
                  </span>
                )}
              </div>
              {closeout.manager_approved_at && closeout.manager_approved_by_name && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Approved by {closeout.manager_approved_by_name}
                </p>
              )}
            </div>
            {isAdminOrManager && !isLocked && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-closeout">
                Edit
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pulled-in job data — always visible so it can be reviewed before finalizing */}
      <JobDataSummary jobId={jobId} />

      {/* Form */}
      {(editing || !closeout) && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">Closeout Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Final scope */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Final Scope Confirmed</Label>
                <Switch checked={finalScopeConfirmed} onCheckedChange={setFinalScopeConfirmed}
                  data-testid="switch-scope-confirmed" />
              </div>
              <Textarea value={finalScopeNotes} onChange={e => setFinalScopeNotes(e.target.value)}
                placeholder="Notes on final scope…" rows={2} className="resize-none" />
            </div>

            <Separator />

            {/* Materials */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Materials & Installation Confirmed</Label>
                <Switch checked={materialsConfirmed} onCheckedChange={setMaterialsConfirmed}
                  data-testid="switch-materials-confirmed" />
              </div>
              <p className="text-xs text-muted-foreground">
                Review the materials list in the Job Data Summary above, then confirm it's accurate.
              </p>
              <Textarea value={materialsNotes} onChange={e => setMaterialsNotes(e.target.value)}
                placeholder="Only needed if materials used differ from what's listed above…" rows={2} className="resize-none" />
            </div>

            <Separator />

            {/* Remaining issues */}
            <div>
              <Label>Remaining Issues / Punch List</Label>
              <Textarea value={remainingIssues} onChange={e => setRemainingIssues(e.target.value)}
                placeholder="List any outstanding items or follow-ups…" rows={2} className="resize-none mt-1" />
            </div>

            {/* Warranty */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Warranty Duration (months)</Label>
                <Input type="number" min={0} max={120} value={warrantyMonths}
                  onChange={e => setWarrantyMonths(parseInt(e.target.value) || 0)}
                  data-testid="input-warranty-months" />
              </div>
              <div>
                <Label>Customer Satisfaction (1-5)</Label>
                <div className="flex items-center gap-1 mt-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setSatisfaction(n)}
                      className="p-0.5" data-testid={`star-${n}`}>
                      <Star className={`h-6 w-6 ${satisfaction && n <= satisfaction ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>Warranty Terms</Label>
              <Textarea value={warrantyTerms} onChange={e => setWarrantyTerms(e.target.value)}
                placeholder="e.g. 1-year workmanship warranty on all hardscape…" rows={2} className="resize-none mt-1" />
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <Label>Customer Notes</Label>
              <Textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)}
                placeholder="Notes visible to customer…" rows={2} className="resize-none mt-1" />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                placeholder="Internal-only notes…" rows={2} className="resize-none mt-1" />
            </div>

            <div className="flex gap-2 pt-1">
              {editing && closeout && (
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              )}
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                data-testid="button-save-closeout">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save Closeout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Closeout details (read-only) */}
      {closeout && !editing && (
        <Card>
          <CardContent className="p-4 space-y-3 text-sm">
            {closeout.final_scope_notes && (
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Scope Notes</p>
                <p className="text-sm">{closeout.final_scope_notes}</p></div>
            )}
            {closeout.remaining_issues && (
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Punch List</p>
                <p className="text-sm">{closeout.remaining_issues}</p></div>
            )}
            {closeout.warranty_terms && (
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{closeout.warranty_duration_months}-month warranty</p>
                  <p className="text-xs text-muted-foreground">{closeout.warranty_terms}</p>
                </div>
              </div>
            )}
            {closeout.customer_satisfaction && (
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`h-4 w-4 ${n <= closeout.customer_satisfaction! ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                ))}
                <span className="text-xs text-muted-foreground ml-1">{closeout.customer_satisfaction}/5</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {isAdminOrManager && closeout && !editing && (
        <div className="flex gap-2 flex-wrap">
          {status === "draft" && (
            <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
              data-testid="button-submit-closeout">
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Submit for Approval
            </Button>
          )}
          {status === "pending_approval" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
              data-testid="button-approve-closeout">
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ThumbsUp className="h-4 w-4 mr-1.5" />}
              Approve Closeout
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
