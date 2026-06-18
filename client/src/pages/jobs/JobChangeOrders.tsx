import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Loader2, FileText, CheckCircle2, Clock, XCircle, Send,
  Trash2, ChevronRight, DollarSign,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface COItem {
  id?: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

interface ChangeOrder {
  id: string;
  co_number: string;
  title: string;
  description: string | null;
  status: string;
  total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  approval_type: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_by_name: string | null;
  created_at: string;
  items?: COItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:            { label: "Draft",            color: "bg-gray-100 text-gray-700",   icon: FileText },
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-700", icon: Clock },
  approved:         { label: "Approved",         color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected:         { label: "Rejected",         color: "bg-red-100 text-red-700",     icon: XCircle },
};

const ITEM_TYPES = ["labor", "equipment", "material", "subcontractor", "other"];

function fmtMoney(v: number) {
  return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyItem = (): COItem => ({
  item_type: "labor", description: "", quantity: 1, unit: "hr", unit_price: 0, amount: 0,
});

export default function JobChangeOrders({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCO, setSelectedCO] = useState<ChangeOrder | null>(null);
  const [showApprove, setShowApprove] = useState(false);
  const [approvalType, setApprovalType] = useState("verbal");
  const [approvedByName, setApprovedByName] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<COItem[]>([emptyItem()]);

  const { data: changeOrders = [], isLoading } = useQuery<ChangeOrder[]>({
    queryKey: ["/api/jobs", jobId, "change-orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/change-orders`);
      return res.json();
    },
  });

  const { data: coDetail } = useQuery<ChangeOrder>({
    queryKey: ["/api/change-orders", selectedCO?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/change-orders/${selectedCO!.id}`);
      return res.json();
    },
    enabled: !!selectedCO?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/change-orders`, {
        title, description, notes, items,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "change-orders"] });
      toast({ title: "Change order created" });
      setShowCreate(false);
      resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const sendForApprovalMutation = useMutation({
    mutationFn: async (coId: string) => {
      const res = await apiRequest("POST", `/api/change-orders/${coId}/send-for-approval`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "change-orders"] });
      toast({ title: "Sent for approval" });
      setSelectedCO(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ coId }: { coId: string }) => {
      const res = await apiRequest("POST", `/api/change-orders/${coId}/approve`, {
        approval_type: approvalType,
        approved_by_name: approvedByName || undefined,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "change-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({ title: "Change order approved — job value updated" });
      setShowApprove(false);
      setSelectedCO(null);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (coId: string) => {
      const res = await apiRequest("DELETE", `/api/change-orders/${coId}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "change-orders"] });
      toast({ title: "Change order deleted" });
      setSelectedCO(null);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setTitle(""); setDescription(""); setNotes("");
    setItems([emptyItem()]);
  }

  function updateItem(idx: number, field: keyof COItem, value: any) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        next[idx].amount = Number(next[idx].quantity) * Number(next[idx].unit_price);
      }
      if (field === "amount") {
        next[idx].amount = Number(value);
      }
      return next;
    });
  }

  const subtotal = items.reduce((s, i) => s + Number(i.amount), 0);

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Change Orders</h3>
            <p className="text-xs text-muted-foreground">
              {changeOrders.length === 0 ? "No change orders yet" :
               `${changeOrders.length} change order${changeOrders.length !== 1 ? "s" : ""} · ${fmtMoney(changeOrders.reduce((s, c) => s + (c.status === "approved" ? Number(c.total) : 0), 0))} approved`}
            </p>
          </div>
          {isAdminOrManager && (
            <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }} data-testid="button-new-co">
              <Plus className="h-4 w-4 mr-1.5" /> New Change Order
            </Button>
          )}
        </div>

        {changeOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No change orders for this job</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {changeOrders.map(co => {
              const cfg = STATUS_CONFIG[co.status] ?? STATUS_CONFIG.draft;
              const StatusIcon = cfg.icon;
              return (
                <Card key={co.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedCO(co)} data-testid={`card-co-${co.id}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <StatusIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{co.co_number}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">{co.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(co.created_at), "MMM d, yyyy")}
                        {co.created_by_name && ` · ${co.created_by_name}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">{fmtMoney(co.total)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Change Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Additional retaining wall block" data-testid="input-co-title" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe what changed and why" className="resize-none" />
            </div>

            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items</Label>
                <Button size="sm" variant="outline" onClick={() => setItems(p => [...p, emptyItem()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr,80px,90px,90px,90px,32px] gap-1.5 items-center">
                    <Input placeholder="Description" value={item.description}
                      onChange={e => updateItem(idx, "description", e.target.value)}
                      data-testid={`input-co-item-desc-${idx}`} />
                    <select value={item.item_type} onChange={e => updateItem(idx, "item_type", e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs">
                      {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Input type="number" placeholder="Qty" value={item.quantity}
                      onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="text-right" />
                    <Input type="number" placeholder="$/unit" value={item.unit_price}
                      onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                      className="text-right" />
                    <Input type="number" placeholder="Total" value={item.amount.toFixed(2)}
                      onChange={e => updateItem(idx, "amount", parseFloat(e.target.value) || 0)}
                      className="text-right font-medium" />
                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-red-500 flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2">
                <p className="text-sm font-bold">Subtotal: {fmtMoney(subtotal)}</p>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes" className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button disabled={!title.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}
              data-testid="button-save-co">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Create Change Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selectedCO && (
        <Dialog open={!!selectedCO} onOpenChange={open => { if (!open) setSelectedCO(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{selectedCO.co_number}</span>
                {selectedCO.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = STATUS_CONFIG[selectedCO.status] ?? STATUS_CONFIG.draft;
                  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>;
                })()}
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(selectedCO.created_at), "MMM d, yyyy")}
                </span>
              </div>

              {selectedCO.description && (
                <p className="text-sm text-muted-foreground">{selectedCO.description}</p>
              )}

              {coDetail?.items && coDetail.items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
                  <div className="space-y-1">
                    {coDetail.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{item.item_type} · {item.quantity} × {fmtMoney(item.unit_price)}</p>
                        </div>
                        <p className="text-sm font-bold ml-2">{fmtMoney(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 pt-2 border-t">
                    <p className="text-base font-bold">Total: {fmtMoney(selectedCO.total)}</p>
                  </div>
                </div>
              )}

              {selectedCO.status === "approved" && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Approved
                  </p>
                  {selectedCO.approved_by_name && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                      By {selectedCO.approved_by_name} · {selectedCO.approval_type}
                    </p>
                  )}
                  {selectedCO.approved_at && (
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {format(parseISO(selectedCO.approved_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 flex-wrap">
              {isAdminOrManager && selectedCO.status === "draft" && (
                <>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"
                    onClick={() => deleteMutation.mutate(selectedCO.id)}
                    disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                  <Button size="sm" onClick={() => sendForApprovalMutation.mutate(selectedCO.id)}
                    disabled={sendForApprovalMutation.isPending}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Send for Approval
                  </Button>
                </>
              )}
              {isAdminOrManager && selectedCO.status === "pending_approval" && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setShowApprove(true)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setSelectedCO(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Approve Change Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Approval Type</Label>
              <select value={approvalType} onChange={e => setApprovalType(e.target.value)}
                className="w-full h-9 mt-1 rounded-md border border-input bg-background px-2 text-sm">
                <option value="verbal">Verbal</option>
                <option value="written">Written</option>
                <option value="digital_signature">Digital Signature</option>
              </select>
            </div>
            <div>
              <Label>Approved By (customer name)</Label>
              <Input value={approvedByName} onChange={e => setApprovedByName(e.target.value)}
                placeholder="Customer name" data-testid="input-approved-by" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprove(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white"
              disabled={approveMutation.isPending}
              onClick={() => selectedCO && approveMutation.mutate({ coId: selectedCO.id })}
              data-testid="button-confirm-approve-co">
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
