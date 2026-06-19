import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, Truck, Trash2, Pencil, Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  asset_id: string | null;
  status: string;
}

interface Assignment {
  id: string;
  job_id: string;
  equipment_id: string;
  assigned_date: string;
  hours_used: number;
  operator_name: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  equipment_name: string;
  equipment_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
}

export default function JobEquipment({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [selectedEquipId, setSelectedEquipId] = useState("");
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().slice(0, 10));
  const [hoursUsed, setHoursUsed] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [notes, setNotes] = useState("");

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/jobs", jobId, "equipment"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/equipment`);
      return res.json();
    },
  });

  const { data: equipmentList = [] } = useQuery<EquipmentItem[]>({
    queryKey: ["/api/equipment-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/equipment-list");
      return res.json();
    },
    enabled: showAdd,
  });

  function resetForm() {
    setSelectedEquipId("");
    setAssignedDate(new Date().toISOString().slice(0, 10));
    setHoursUsed("");
    setOperatorName("");
    setNotes("");
    setEditingId(null);
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/equipment`, {
        equipment_id: selectedEquipId,
        assigned_date: assignedDate,
        hours_used: hoursUsed ? parseFloat(hoursUsed) : 0,
        operator_name: operatorName || null,
        notes: notes || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "equipment"] });
      toast({ title: "Equipment assigned to job" });
      setShowAdd(false);
      resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/equipment/${id}`, {
        hours_used: hoursUsed ? parseFloat(hoursUsed) : undefined,
        assigned_date: assignedDate || undefined,
        operator_name: operatorName || null,
        notes: notes || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "equipment"] });
      toast({ title: "Assignment updated" });
      resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/equipment/${id}`);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "equipment"] });
      toast({ title: "Removed from job" });
    },
  });

  function startEdit(a: Assignment) {
    setEditingId(a.id);
    setAssignedDate(a.assigned_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setHoursUsed(String(a.hours_used ?? ""));
    setOperatorName(a.operator_name ?? "");
    setNotes(a.notes ?? "");
  }

  const totalHours = assignments.reduce((s, a) => s + Number(a.hours_used ?? 0), 0);

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Equipment Used</h3>
            <p className="text-xs text-muted-foreground">
              {assignments.length === 0
                ? "No equipment logged"
                : `${assignments.length} piece${assignments.length !== 1 ? "s" : ""} · ${totalHours.toFixed(1)} total hrs`}
            </p>
          </div>
          {isAdminOrManager && (
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-assign-equipment">
              <Plus className="h-4 w-4 mr-1.5" /> Assign Equipment
            </Button>
          )}
        </div>

        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Truck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No equipment assigned to this job</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => (
              <Card key={a.id} data-testid={`card-equipment-${a.id}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <Truck className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {a.equipment_name}
                      {(a.make || a.model) && (
                        <span className="text-muted-foreground font-normal"> — {[a.year, a.make, a.model].filter(Boolean).join(" ")}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground capitalize">{a.equipment_type}</span>
                      {a.hours_used > 0 && (
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" /> {Number(a.hours_used).toFixed(1)} hrs
                        </span>
                      )}
                      {a.operator_name && (
                        <span className="text-xs text-muted-foreground">Op: {a.operator_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {a.assigned_date ? format(parseISO(a.assigned_date), "MMM d, yyyy") : ""}
                      </span>
                    </div>
                    {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">{a.notes}</p>}
                  </div>
                  {isAdminOrManager && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(a)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        data-testid={`button-edit-equip-${a.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(a.id)}
                        className="text-muted-foreground hover:text-red-500 p-1"
                        data-testid={`button-remove-equip-${a.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={open => { if (!open) { setShowAdd(false); resetForm(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Equipment to Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Equipment <span className="text-red-500">*</span></Label>
              <select value={selectedEquipId} onChange={e => setSelectedEquipId(e.target.value)}
                className="w-full h-9 mt-1 rounded-md border border-input bg-background px-2 text-sm"
                data-testid="select-equipment">
                <option value="">— Select equipment —</option>
                {equipmentList.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}{eq.make ? ` (${[eq.year, eq.make, eq.model].filter(Boolean).join(" ")})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Date</Label>
                <Input type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)}
                  data-testid="input-equip-date" />
              </div>
              <div>
                <Label>Hours Used</Label>
                <Input type="number" min={0} step={0.5} value={hoursUsed}
                  onChange={e => setHoursUsed(e.target.value)} placeholder="0.0"
                  data-testid="input-equip-hours" />
              </div>
            </div>
            <div>
              <Label>Operator Name</Label>
              <Input value={operatorName} onChange={e => setOperatorName(e.target.value)}
                placeholder="Who operated this equipment?" data-testid="input-operator" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} placeholder="Any notes…" className="resize-none mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
            <Button disabled={!selectedEquipId || addMutation.isPending} onClick={() => addMutation.mutate()}
              data-testid="button-confirm-assign">
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={open => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Date</Label>
                <Input type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)} />
              </div>
              <div>
                <Label>Hours Used</Label>
                <Input type="number" min={0} step={0.5} value={hoursUsed}
                  onChange={e => setHoursUsed(e.target.value)} placeholder="0.0" />
              </div>
            </div>
            <div>
              <Label>Operator</Label>
              <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} className="resize-none mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button disabled={updateMutation.isPending} onClick={() => editingId && updateMutation.mutate(editingId)}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
