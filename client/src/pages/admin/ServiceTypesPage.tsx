import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, Tag } from "lucide-react";
import { Redirect } from "wouter";

const CATEGORIES = [
  "Hardscape", "Landscape", "Irrigation", "Seasonal",
  "Snow & Ice", "Installation", "Maintenance", "Other",
];

interface ServiceType {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  sort_order: number;
}

function emptyForm() {
  return { name: "", category: "", is_active: true, sort_order: 0 };
}

export default function ServiceTypesPage() {
  const { effectiveRole } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceType | null>(null);
  const [form, setForm] = useState(emptyForm());

  if (!["Admin", "Master Admin"].includes(effectiveRole ?? "")) {
    return <Redirect to="/" />;
  }

  const { data: types = [], isLoading } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
    queryFn: () => fetch("/api/service-types", { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/service-types"] });

  const createMut = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/service-types", d),
    onSuccess: () => { toast({ title: "Service type created" }); invalidate(); setModalOpen(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => apiRequest("PATCH", `/api/service-types/${editing?.id}`, d),
    onSuccess: () => { toast({ title: "Service type updated" }); invalidate(); setModalOpen(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/service-types/${id}/toggle`, {}),
    onSuccess: () => { toast({ title: "Toggled" }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/service-types/${id}`),
    onSuccess: () => { toast({ title: "Deleted" }); invalidate(); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(st: ServiceType) {
    setEditing(st);
    setForm({ name: st.name, category: st.category, is_active: st.is_active, sort_order: st.sort_order });
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const payload = { ...form, sort_order: Number(form.sort_order) || 0 };
    if (editing) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  const isBusy = createMut.isPending || updateMut.isPending;

  // Group by category for display
  const grouped: Record<string, ServiceType[]> = {};
  for (const t of types) {
    const cat = t.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }

  return (
    <div className="flex flex-col h-full" data-testid="service-types-page">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Service Types
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage service types used across Consultations, Estimates, and Jobs
          </p>
        </div>
        <Button onClick={openNew} data-testid="btn-new-service-type">
          <Plus className="h-4 w-4 mr-2" /> Add Service Type
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{types.length} service types total</span>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Active</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>Inactive</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table data-testid="service-types-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sort Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map(st => (
                    <TableRow key={st.id} data-testid={`row-service-type-${st.id}`}>
                      <TableCell className="font-medium">{st.name}</TableCell>
                      <TableCell>
                        {st.category && (
                          <Badge variant="outline" className="text-xs">{st.category}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{st.sort_order}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleMut.mutate(st.id)}
                          data-testid={`toggle-service-type-${st.id}`}
                          className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
                        >
                          {st.is_active ? (
                            <>
                              <ToggleRight className="h-4 w-4 text-green-600" />
                              <span className="text-green-700 text-xs font-medium">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-500 text-xs">Inactive</span>
                            </>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8"
                            data-testid={`btn-edit-service-type-${st.id}`}
                            onClick={() => openEdit(st)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                            data-testid={`btn-delete-service-type-${st.id}`}
                            onClick={() => setDeleteTarget(st)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={o => { if (!o) setModalOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service Type" : "New Service Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Patio"
                value={form.name}
                data-testid="input-service-type-name"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category || "_none"}
                onValueChange={v => setForm(f => ({ ...f, category: v === "_none" ? "" : v }))}
              >
                <SelectTrigger data-testid="select-service-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sort Order</Label>
              <Input
                type="number"
                min="0"
                value={form.sort_order}
                data-testid="input-sort-order"
                onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                data-testid="checkbox-is-active"
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active" className="cursor-pointer">Active (visible in dropdowns)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isBusy} data-testid="btn-save-service-type">
              {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
