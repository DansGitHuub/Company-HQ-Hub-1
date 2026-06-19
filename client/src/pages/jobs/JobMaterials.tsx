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
import { Plus, Loader2, Package, Trash2, Pencil, Search } from "lucide-react";

interface CatalogItem {
  id: string;
  item_number: string;
  name: string;
  class: string;
  category: string;
  units: string | null;
  cost: string | null;
  description: string | null;
}

interface JobMaterial {
  id: string;
  job_id: string;
  catalog_item_id: string | null;
  item_name: string;
  item_number: string | null;
  units: string | null;
  quantity: string;
  unit_cost: string | null;
  notes: string | null;
  category: string | null;
  class: string | null;
  created_at: string;
}

const CLASS_COLORS: Record<string, string> = {
  Materials:      "bg-blue-100 text-blue-700",
  Labor:          "bg-purple-100 text-purple-700",
  Equipment:      "bg-amber-100 text-amber-700",
  Subcontracting: "bg-green-100 text-green-700",
};

export default function JobMaterials({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Form fields
  const [itemName, setItemName] = useState("");
  const [itemNumber, setItemNumber] = useState("");
  const [units, setUnits] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");

  const { data: materials = [], isLoading } = useQuery<JobMaterial[]>({
    queryKey: ["/api/jobs", jobId, "materials"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/materials`);
      return res.json();
    },
  });

  const { data: catalogItems = [] } = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog-items-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/catalog-items-list");
      return res.json();
    },
    enabled: showAdd && !manualMode,
  });

  const filteredCatalog = catalogItems.filter(ci =>
    !catalogSearch || ci.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    ci.item_number?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    ci.category?.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  function resetForm() {
    setItemName(""); setItemNumber(""); setUnits("");
    setQuantity("1"); setUnitCost(""); setNotes("");
    setSelectedCatalogItem(null); setCatalogSearch("");
    setManualMode(false); setEditingId(null);
  }

  function pickCatalogItem(ci: CatalogItem) {
    setSelectedCatalogItem(ci);
    setItemName(ci.name);
    setItemNumber(ci.item_number ?? "");
    setUnits(ci.units ?? "");
    setUnitCost(ci.cost ?? "");
    setCatalogSearch("");
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/materials`, {
        catalog_item_id: selectedCatalogItem?.id ?? null,
        item_name: itemName,
        item_number: itemNumber || null,
        units: units || null,
        quantity: parseFloat(quantity) || 1,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        notes: notes || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "materials"] });
      toast({ title: "Material added to job" });
      setShowAdd(false); resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/materials/${id}`, {
        item_name: itemName,
        units: units || null,
        quantity: parseFloat(quantity) || 1,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        notes: notes || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "materials"] });
      toast({ title: "Updated" }); resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/materials/${id}`);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "materials"] });
      toast({ title: "Removed" });
    },
  });

  function startEdit(m: JobMaterial) {
    setEditingId(m.id);
    setItemName(m.item_name);
    setItemNumber(m.item_number ?? "");
    setUnits(m.units ?? "");
    setQuantity(String(m.quantity));
    setUnitCost(m.unit_cost ?? "");
    setNotes(m.notes ?? "");
  }

  const totalCost = materials.reduce((sum, m) => {
    if (!m.unit_cost) return sum;
    return sum + Number(m.quantity) * Number(m.unit_cost);
  }, 0);

  const fmt$ = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Materials Required</h3>
            <p className="text-xs text-muted-foreground">
              {materials.length === 0
                ? "No materials listed"
                : `${materials.length} item${materials.length !== 1 ? "s" : ""}${totalCost > 0 ? ` · ${fmt$(totalCost)} est. cost` : ""}`}
            </p>
          </div>
          {isAdminOrManager && (
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-add-material">
              <Plus className="h-4 w-4 mr-1.5" /> Add Material
            </Button>
          )}
        </div>

        {materials.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No materials assigned to this job</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right w-20">Qty</TableHead>
                    <TableHead className="text-right w-24">Unit Cost</TableHead>
                    <TableHead className="text-right w-24">Total</TableHead>
                    {isAdminOrManager && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map(m => (
                    <TableRow key={m.id} data-testid={`row-material-${m.id}`}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{m.item_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {m.item_number && <span className="text-xs text-muted-foreground font-mono">{m.item_number}</span>}
                            {m.class && (
                              <Badge variant="outline" className={`text-xs py-0 ${CLASS_COLORS[m.class] ?? ""}`}>
                                {m.class}
                              </Badge>
                            )}
                            {m.units && <span className="text-xs text-muted-foreground">per {m.units}</span>}
                          </div>
                          {m.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{m.notes}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{Number(m.quantity)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.unit_cost ? fmt$(Number(m.unit_cost)) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {m.unit_cost ? fmt$(Number(m.quantity) * Number(m.unit_cost)) : "—"}
                      </TableCell>
                      {isAdminOrManager && (
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => startEdit(m)}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              data-testid={`button-edit-mat-${m.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteMutation.mutate(m.id)}
                              className="p-1 text-muted-foreground hover:text-red-500"
                              data-testid={`button-del-mat-${m.id}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {totalCost > 0 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3} className="text-right text-sm">Total Estimated Cost</TableCell>
                      <TableCell className="text-right">{fmt$(totalCost)}</TableCell>
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
          <DialogHeader><DialogTitle>Add Material to Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button onClick={() => { setManualMode(false); setSelectedCatalogItem(null); }}
                className={`flex-1 py-1.5 text-sm rounded border transition-colors ${!manualMode ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-input"}`}>
                From Catalog
              </button>
              <button onClick={() => setManualMode(true)}
                className={`flex-1 py-1.5 text-sm rounded border transition-colors ${manualMode ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-input"}`}>
                Enter Manually
              </button>
            </div>

            {!manualMode && !selectedCatalogItem && (
              <div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                    placeholder="Search catalog items…" className="pl-8"
                    autoFocus data-testid="input-catalog-search" />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border divide-y">
                  {filteredCatalog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {catalogSearch ? "No matches" : "Loading catalog…"}
                    </p>
                  ) : filteredCatalog.slice(0, 50).map(ci => (
                    <button key={ci.id} onClick={() => pickCatalogItem(ci)}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
                      data-testid={`option-catalog-${ci.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{ci.name}</p>
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{ci.item_number}</span>
                          {ci.class && <span className={`text-xs px-1.5 py-0 rounded border ${CLASS_COLORS[ci.class] ?? ""}`}>{ci.class}</span>}
                          {ci.cost && <span className="text-xs text-muted-foreground">${Number(ci.cost).toFixed(2)}{ci.units ? `/${ci.units}` : ""}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(manualMode || selectedCatalogItem) && (
              <div className="space-y-2">
                {selectedCatalogItem && !manualMode && (
                  <div className="flex items-center justify-between bg-muted/50 rounded p-2">
                    <div>
                      <p className="text-sm font-medium">{selectedCatalogItem.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedCatalogItem.item_number}</p>
                    </div>
                    <button onClick={() => { setSelectedCatalogItem(null); setItemName(""); setItemNumber(""); setUnits(""); setUnitCost(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground underline">Change</button>
                  </div>
                )}
                {manualMode && (
                  <div>
                    <Label>Item Name <span className="text-red-500">*</span></Label>
                    <Input value={itemName} onChange={e => setItemName(e.target.value)}
                      placeholder="e.g. Mulch, Topsoil, Edging Brick" className="mt-1"
                      data-testid="input-item-name" autoFocus />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" min={0} step={0.5} value={quantity}
                      onChange={e => setQuantity(e.target.value)} className="mt-1"
                      data-testid="input-mat-qty" />
                  </div>
                  <div>
                    <Label>Units</Label>
                    <Input value={units} onChange={e => setUnits(e.target.value)}
                      placeholder="bag, yd³…" className="mt-1" />
                  </div>
                  <div>
                    <Label>Unit Cost ($)</Label>
                    <Input type="number" min={0} step={0.01} value={unitCost}
                      onChange={e => setUnitCost(e.target.value)} className="mt-1"
                      data-testid="input-mat-cost" />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                    rows={2} className="resize-none mt-1" placeholder="Color, supplier, delivery notes…" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
            <Button
              disabled={(!manualMode && !selectedCatalogItem) || (manualMode && !itemName) || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              data-testid="button-confirm-material">
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Add to Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={open => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Material</DialogTitle></DialogHeader>
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
                <Label>Units</Label>
                <Input value={units} onChange={e => setUnits(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Unit Cost</Label>
                <Input type="number" min={0} step={0.01} value={unitCost}
                  onChange={e => setUnitCost(e.target.value)} className="mt-1" />
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
