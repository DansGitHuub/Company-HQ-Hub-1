import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck, Plus, Loader2, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, Flag,
} from "lucide-react";
import { format, parseISO, isPast } from "date-fns";

interface Warranty {
  id: string;
  job_id: string;
  title: string;
  description: string | null;
  warranty_type: string;
  duration_months: number;
  start_date: string;
  end_date: string;
  status: string;
  terms: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface Claim {
  id: string;
  claim_number: string;
  title: string;
  description: string;
  reported_by: string | null;
  reported_at: string;
  status: string;
  priority: string;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
}

interface WarrantyWithClaims extends Warranty {
  claims: Claim[];
}

const CLAIM_STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: "Open",        color: "bg-red-100 text-red-700" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700" },
  resolved:    { label: "Resolved",    color: "bg-green-100 text-green-700" },
  closed:      { label: "Closed",      color: "bg-gray-100 text-gray-600" },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "text-blue-500",
  normal: "text-gray-500",
  high:   "text-amber-500",
  urgent: "text-red-500",
};

export default function JobWarranty({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Create warranty form
  const [wTitle, setWTitle] = useState("");
  const [wType, setWType] = useState("workmanship");
  const [wMonths, setWMonths] = useState(12);
  const [wTerms, setWTerms] = useState("");

  // Claim form
  const [claimTitle, setClaimTitle] = useState("");
  const [claimDesc, setClaimDesc] = useState("");
  const [claimReporter, setClaimReporter] = useState("");
  const [claimPriority, setClaimPriority] = useState("normal");

  // Resolve claim
  const [resolvingClaimId, setResolvingClaimId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const { data: warranty, isLoading } = useQuery<Warranty | null>({
    queryKey: ["/api/jobs", jobId, "warranty"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/warranty`);
      return res.json();
    },
  });

  const { data: warrantyDetail } = useQuery<WarrantyWithClaims | null>({
    queryKey: ["/api/warranties", warranty?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/warranties/${warranty!.id}`);
      return res.json();
    },
    enabled: !!warranty?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/warranty`, {
        title: wTitle, warranty_type: wType, duration_months: wMonths, terms: wTerms || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "warranty"] });
      toast({ title: "Warranty created" });
      setShowCreate(false);
      setWTitle(""); setWType("workmanship"); setWMonths(12); setWTerms("");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/warranties/${warranty!.id}/claims`, {
        title: claimTitle, description: claimDesc,
        reported_by: claimReporter || null, priority: claimPriority,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warranties", warranty?.id] });
      toast({ title: "Claim submitted" });
      setShowClaim(false);
      setClaimTitle(""); setClaimDesc(""); setClaimReporter(""); setClaimPriority("normal");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const res = await apiRequest("PATCH", `/api/warranty-claims/${claimId}`, {
        status: "resolved", resolution,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warranties", warranty?.id] });
      toast({ title: "Claim resolved" });
      setResolvingClaimId(null);
      setResolution("");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const isExpired = warranty?.end_date ? isPast(parseISO(warranty.end_date)) : false;
  const openClaims = warrantyDetail?.claims?.filter(c => c.status === "open" || c.status === "in_progress") ?? [];

  // No warranty yet
  if (!warranty) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium">No warranty on file</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Warranties are auto-created when a closeout is approved, or create one manually.
          </p>
          {isAdminOrManager && (
            <Button onClick={() => setShowCreate(true)} data-testid="button-create-warranty">
              <Plus className="h-4 w-4 mr-1.5" /> Create Warranty
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Warranty card */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className={`h-6 w-6 flex-shrink-0 mt-0.5 ${isExpired ? "text-gray-400" : "text-green-500"}`} />
                <div>
                  <p className="text-sm font-bold">{warranty.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{warranty.warranty_type.replace("_", " ")} · {warranty.duration_months} months</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isExpired ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                      {isExpired ? "Expired" : "Active"}
                    </span>
                    {openClaims.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                        {openClaims.length} open claim{openClaims.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                {warranty.start_date && (
                  <p>Starts: {format(parseISO(warranty.start_date), "MMM d, yyyy")}</p>
                )}
                {warranty.end_date && (
                  <p className={isExpired ? "text-red-500 font-medium" : ""}>
                    Ends: {format(parseISO(warranty.end_date), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>
            {warranty.terms && (
              <p className="text-xs text-muted-foreground mt-2 pl-9">{warranty.terms}</p>
            )}
          </CardContent>
        </Card>

        {/* Claims */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Warranty Claims</h4>
          <Button size="sm" variant="outline" onClick={() => setShowClaim(true)} data-testid="button-new-claim">
            <Plus className="h-4 w-4 mr-1.5" /> New Claim
          </Button>
        </div>

        {(!warrantyDetail?.claims || warrantyDetail.claims.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No claims filed</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {warrantyDetail!.claims.map(claim => {
              const statusCfg = CLAIM_STATUS[claim.status] ?? CLAIM_STATUS.open;
              const priorityColor = PRIORITY_COLOR[claim.priority] ?? PRIORITY_COLOR.normal;
              return (
                <Card key={claim.id} data-testid={`card-claim-${claim.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <Flag className={`h-4 w-4 flex-shrink-0 mt-0.5 ${priorityColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{claim.claim_number}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-0.5">{claim.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{claim.description}</p>
                      {claim.reported_by && (
                        <p className="text-xs text-muted-foreground mt-0.5">Reported by {claim.reported_by}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(claim.reported_at), "MMM d, yyyy")}
                      </p>
                      {claim.resolution && (
                        <p className="text-xs bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200 rounded px-2 py-1 mt-1">
                          Resolution: {claim.resolution}
                        </p>
                      )}
                    </div>
                    {isAdminOrManager && (claim.status === "open" || claim.status === "in_progress") && (
                      <Button size="sm" variant="outline" className="flex-shrink-0"
                        onClick={() => setResolvingClaimId(claim.id)}
                        data-testid={`button-resolve-claim-${claim.id}`}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create warranty dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Warranty</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={wTitle} onChange={e => setWTitle(e.target.value)}
                placeholder="e.g. Hardscape Workmanship Warranty" data-testid="input-warranty-title" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <select value={wType} onChange={e => setWType(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="workmanship">Workmanship</option>
                  <option value="materials">Materials</option>
                  <option value="plant_material">Plant Material</option>
                  <option value="full">Full</option>
                </select>
              </div>
              <div>
                <Label>Duration (months)</Label>
                <Input type="number" min={1} max={120} value={wMonths}
                  onChange={e => setWMonths(parseInt(e.target.value) || 12)}
                  data-testid="input-warranty-duration" />
              </div>
            </div>
            <div>
              <Label>Terms</Label>
              <Textarea value={wTerms} onChange={e => setWTerms(e.target.value)}
                rows={3} placeholder="Warranty terms and conditions…" className="resize-none mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!wTitle.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}
              data-testid="button-save-warranty">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Create Warranty
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New claim dialog */}
      <Dialog open={showClaim} onOpenChange={setShowClaim}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Submit Warranty Claim</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={claimTitle} onChange={e => setClaimTitle(e.target.value)}
                placeholder="Brief description of the issue" data-testid="input-claim-title" />
            </div>
            <div>
              <Label>Description <span className="text-red-500">*</span></Label>
              <Textarea value={claimDesc} onChange={e => setClaimDesc(e.target.value)}
                rows={3} placeholder="Full description of the problem…" className="resize-none mt-1" data-testid="textarea-claim-desc" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Reported By</Label>
                <Input value={claimReporter} onChange={e => setClaimReporter(e.target.value)}
                  placeholder="Customer name" />
              </div>
              <div>
                <Label>Priority</Label>
                <select value={claimPriority} onChange={e => setClaimPriority(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaim(false)}>Cancel</Button>
            <Button disabled={!claimTitle.trim() || !claimDesc.trim() || claimMutation.isPending}
              onClick={() => claimMutation.mutate()} data-testid="button-submit-claim">
              {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Submit Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve claim dialog */}
      <Dialog open={!!resolvingClaimId} onOpenChange={open => { if (!open) { setResolvingClaimId(null); setResolution(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Resolve Claim</DialogTitle></DialogHeader>
          <div>
            <Label>Resolution Notes</Label>
            <Textarea value={resolution} onChange={e => setResolution(e.target.value)}
              rows={3} placeholder="Describe how the claim was resolved…" className="resize-none mt-1"
              data-testid="textarea-resolution" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolvingClaimId(null); setResolution(""); }}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!resolution.trim() || resolveMutation.isPending}
              onClick={() => resolvingClaimId && resolveMutation.mutate(resolvingClaimId)}
              data-testid="button-confirm-resolve">
              {resolveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
