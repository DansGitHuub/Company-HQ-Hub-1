import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, ClipboardList, Trash2, Pencil, FileText } from "lucide-react";

interface JobLineItem {
  id: string;
  job_id: string;
  job_work_area_id: string | null;
  source_estimate_id: string | null;
  source_estimate_line_item_id: string | null;
  item_type: string;
  catalog_item_id: number | null;
  class_id: number | null;
  item_name: string;
  quantity: string;
  unit: string | null;
  unit_price: string;
  line_total: string;
  is_optional: boolean;
  notes: string | null;
  work_area_name: string | null;
  catalog_item_number: string | null;
  class_label: string | null;
}

const fmt$ = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function JobLineItems({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");

  const { data: items = [], isLoading } = useQuery<JobLineItem[]>({
    queryKey: ["/api/jobs", jobId, "line-items"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/line-items`);
      return res.json();
    },
  });

  function resetForm() {
    setItemName(""); setQuantity("1"); setUnit(""); setUnitPrice(""); setNotes("");
    setEditingId(null);
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/line-items`, {
        item_name: itemName,
        quantity: parseFloat(quantity) || 1,
        unit: unit || null,
        unit_price: unitPrice ? parseFloat(unitPrice) : 0,
        notes: notes || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "line-items"] });
      toast({ title: "Line item added" });
      setShowAdd(false); resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/line-items/${id}`, {
        item_name: itemName,
        quantity: parseFloat(quantity) || 1,
        unit: unit || null,
        unit_price: unitPrice ? parseFloat(unitPrice) : 0,
        notes: notes || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "line-items"] });
      toast({ title: "Updated" }); resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/line-items/${id}`);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "line-items"] });
      toast({ title: "Removed" });
    },
  });

  function startEdit(li: JobLineItem) {
    setEditingId(li.id);
    setItemName(li.item_name);
    setQuantity(String(li.quantity));
    setUnit(li.unit ?? "");
    setUnitPrice(li.unit_price ?? "");
    setNotes(li.notes ?? "");
  }

  const total = items.reduce((sum, li) => sum + Number(li.line_total || 0), 0);

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Scope & Materials</h3>
            <p className="text-xs text-muted-foreground">
              {items.length === 0
                ? "No scope items on this job yet"
                : `${items.length} item${items.length !== 1 ? "s" : ""}${total > 0 ? ` · ${fmt$(total)}` : ""}`}
            </p>
          </div>
          {isAdminOrManager && (
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-add-line-item">
              <Plus className="h-4 w-4 mr-1.5" /> Add Item
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Nothing here yet. Items copied from a converted estimate — or added manually — will show up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Work Area</TableHead>
                    <TableHead className="text-right w-20">Qty</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="text-right w-24">Unit Price</TableHead>
                    <TableHead className="text-right w-24">Total</TableHead>
                    {isAdminOrManager && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(li => (
                    <TableRow key={li.id} data-testid={`row-line-item-${li.id}`}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{li.item_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {li.source_estimate_line_item_id && (
                              <Badge variant="outline" className="text-xs py-0 bg-teal-50 text-teal-700 border-teal-200">
                                <FileText className="h-3 w-3 mr-1" /> From Estimate
                              </Badge>
                            )}
                            {li.class_label && (
                              <Badge variant="outline" className="text-xs py-0">{li.class_label}</Badge>
                            )}
                            {li.catalog_item_number && (
                              <span className="text-xs text-muted-foreground font-mono">{li.catalog_item_number}</span>
                            )}
                            {li.is_optional && (
                              <Badge variant="outline" className="text-xs py-0 text-muted-foreground">Optional</Badge>
                            )}
                          </div>
                          {li.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{li.notes}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{li.work_area_name || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{Number(li.quantity)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{li.unit || "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Number(li.unit_price) ? fmt$(Number(li.unit_price)) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(li.line_total) ? fmt$(Number(li.line_total)) : "—"}
                      </TableCell>
                      {isAdminOrManager && (
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => startEdit(li)}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              data-testid={`button-edit-line-item-${li.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteMutation.mutate(li.id)}
                              className="p-1 text-muted-foreground hover:text-red-500"
                              data-testid={`button-del-line-item-${li.id}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {total > 0 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={5} className="text-right text-sm">Total</TableCell>
                      <TableCell className="text-right">{fmt$(total)}</TableCell>
                      {isAdminOrManager && <TableCell />}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={open => { if (!open) { setShowAdd(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Scope Item</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Item Name <span className="text-red-500">*</span></Label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)}
                placeholder="e.g. Sod installation, Mulch" className="mt-1"
                data-testid="input-line-item-name" autoFocus />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Quantity</Label>
                <Input type="number" min={0} step={0.5} value={quantity}
                  onChange={e => setQuantity(e.target.value)} className="mt-1"
                  data-testid="input-line-item-qty" />
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={unit} onChange={e => setUnit(e.target.value)}
                  placeholder="sq ft, bag…" className="mt-1" />
              </div>
              <div>
                <Label>Unit Price ($)</Label>
                <Input type="number" min={0} step={0.01} value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)} className="mt-1"
                  data-testid="input-line-item-price" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} className="resize-none mt-1" placeholder="Optional notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
            <Button
              disabled={!itemName || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              data-testid="button-confirm-line-item">
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={open => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Scope Item</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Item Name</Label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Qty</Label>
                <Input type="number" min={0} step={0.5} value={quantity}
                  onChange={e => setQuantity(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={unit} onChange={e => setUnit(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Unit Price</Label>
                <Input type="number" min={0} step={0.01} value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} className="resize-none mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button disabled={!itemName || updateMutation.isPending}
              onClick={() => editingId && updateMutation.mutate(editingId)}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
