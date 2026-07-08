import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, Clock, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface PTORequest {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  request_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  notes: string | null;
  status: string;
  submitted_at: string;
  review_notes: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
}

const STATUS_CFG: Record<string, { label: string; pill: string; icon: React.ReactNode }> = {
  Pending:  { label: "Pending",  pill: "bg-yellow-100 text-yellow-700 border border-yellow-300", icon: <Clock className="h-3 w-3" /> },
  Approved: { label: "Approved", pill: "bg-green-100 text-green-700 border border-green-300",   icon: <CheckCircle2 className="h-3 w-3" /> },
  Denied:   { label: "Denied",   pill: "bg-red-100 text-red-700 border border-red-300",         icon: <XCircle className="h-3 w-3" /> },
};

function fmtDate(s: string) {
  try { return format(parseISO(s), "MMM d, yyyy"); } catch { return s; }
}

export default function PTOApprovalTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("Pending");
  const [dialog, setDialog] = useState<{ request: PTORequest; action: "Approved" | "Denied" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: requests = [], isLoading } = useQuery<PTORequest[]>({
    queryKey: ["/api/time-off-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/time-off-requests");
      return res.json();
    },
  });

  const filtered = statusFilter === "all"
    ? requests
    : requests.filter(r => r.status === statusFilter);

  const counts = {
    Pending:  requests.filter(r => r.status === "Pending").length,
    Approved: requests.filter(r => r.status === "Approved").length,
    Denied:   requests.filter(r => r.status === "Denied").length,
  };

  function openDialog(request: PTORequest, action: "Approved" | "Denied") {
    setReviewNotes("");
    setDialog({ request, action });
  }

  async function submitDecision() {
    if (!dialog) return;
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/time-off-requests/${dialog.request.id}`, {
        status: dialog.action,
        reviewNotes: reviewNotes.trim() || null,
      });
      toast({
        title: `Request ${dialog.action}`,
        description: `${dialog.request.first_name} ${dialog.request.last_name}'s PTO request has been ${dialog.action.toLowerCase()}.`,
      });
      qc.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      setDialog(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {(["Pending", "Approved", "Denied"] as const).map(s => (
            <Badge
              key={s}
              variant="outline"
              className={STATUS_CFG[s].pill + " flex items-center gap-1 cursor-pointer px-3 py-1"}
              onClick={() => setStatusFilter(s)}
              data-testid={`pto-filter-${s.toLowerCase()}`}
            >
              {STATUS_CFG[s].icon}
              {s}: {counts[s]}
            </Badge>
          ))}
        </div>
        <div className="ml-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="pto-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Denied">Denied</SelectItem>
              <SelectItem value="all">All Requests</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <CalendarDays className="h-8 w-8 opacity-40" />
              <p>No {statusFilter === "all" ? "" : statusFilter.toLowerCase() + " "}time-off requests.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.Pending;
                  return (
                    <TableRow key={r.id} data-testid={`pto-row-${r.id}`}>
                      <TableCell>
                        <div className="font-medium">{r.first_name} {r.last_name}</div>
                        {r.job_title && <div className="text-xs text-muted-foreground">{r.job_title}</div>}
                      </TableCell>
                      <TableCell>{r.request_type}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                      </TableCell>
                      <TableCell className="text-center">{r.total_days}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmtDate(r.submitted_at)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                        {r.notes ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cfg.pill + " flex items-center gap-1 w-fit"}>
                          {cfg.icon}{cfg.label}
                        </Badge>
                        {r.review_notes && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-[140px] truncate">
                            Note: {r.review_notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.reviewed_by_name
                          ? <>{r.reviewed_by_name}<br /><span className="text-xs">{r.reviewed_at ? fmtDate(r.reviewed_at) : ""}</span></>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "Pending" ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500 text-green-700 hover:bg-green-50"
                              data-testid={`pto-approve-${r.id}`}
                              onClick={() => openDialog(r, "Approved")}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-400 text-red-600 hover:bg-red-50"
                              data-testid={`pto-deny-${r.id}`}
                              onClick={() => openDialog(r, "Denied")}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Deny
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => openDialog(r, r.status === "Approved" ? "Denied" : "Approved")}
                            data-testid={`pto-reconsider-${r.id}`}
                          >
                            Reconsider
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve / Deny dialog */}
      <Dialog open={!!dialog} onOpenChange={open => { if (!open) setDialog(null); }}>
        <DialogContent data-testid="pto-decision-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === "Approved" ? "Approve" : "Deny"} Time-Off Request
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted p-3 space-y-1">
                <p><span className="font-medium">Employee:</span> {dialog.request.first_name} {dialog.request.last_name}</p>
                <p><span className="font-medium">Type:</span> {dialog.request.request_type}</p>
                <p><span className="font-medium">Dates:</span> {fmtDate(dialog.request.start_date)} – {fmtDate(dialog.request.end_date)} ({dialog.request.total_days} day{dialog.request.total_days !== 1 ? "s" : ""})</p>
                {dialog.request.notes && <p><span className="font-medium">Employee note:</span> {dialog.request.notes}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pto-review-notes">Review notes <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="pto-review-notes"
                  data-testid="pto-review-notes-input"
                  placeholder="Add a note for the employee (optional)…"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>Cancel</Button>
            <Button
              data-testid="pto-decision-confirm"
              onClick={submitDecision}
              disabled={saving}
              className={dialog?.action === "Approved"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm {dialog?.action === "Approved" ? "Approval" : "Denial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
