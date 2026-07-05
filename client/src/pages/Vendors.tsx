import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Upload, Building2, Trash2, Pencil, Mail, Phone, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Vendor } from "@shared/schema";

const emptyForm = { name: "", contactName: "", email: "", phone: "", address: "", category: "", notes: "" };

export default function Vendors() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);

  const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => (await apiRequest("GET", "/api/vendors")).json(),
  });

  // Deep-link support: auto-open a vendor's edit dialog when navigated here from Global Search
  useEffect(() => {
    if (isLoading || vendors.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("editVendorId");
    if (targetId) {
      const target = vendors.find(v => v.id === targetId);
      if (target) {
        openEdit(target);
        params.delete("editVendorId");
        const newSearch = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, vendors]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => (await apiRequest("POST", "/api/vendors", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Vendor added" });
    },
    onError: () => toast({ title: "Failed to add vendor", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof emptyForm }) => (await apiRequest("PUT", `/api/vendors/${id}`, data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: "Vendor updated" });
    },
    onError: () => toast({ title: "Failed to update vendor", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Vendor deleted" });
    },
    onError: () => toast({ title: "Failed to delete vendor", variant: "destructive" }),
  });

  const filtered = vendors.filter(v =>
    !search || `${v.name} ${v.contactName || ""} ${v.category || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name, contactName: v.contactName || "", email: v.email || "",
      phone: v.phone || "", address: v.address || "", category: v.category || "", notes: v.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-vendors-title">
            <Building2 className="h-6 w-6" /> Vendors
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{vendors.length} vendors total</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/vendors/import")} data-testid="btn-import-csv">
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={openAdd} data-testid="button-add-vendor">
              <Plus className="h-4 w-4 mr-2" /> Add Vendor
            </Button>
          </div>
        )}
      </div>

      <Input
        placeholder="Search vendors..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
        data-testid="input-search-vendors"
      />

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No vendors found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full" data-testid="table-vendors">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-semibold">Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Contact</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Category</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Email / Phone</th>
                {isAdmin && <th className="text-right px-4 py-3 text-sm font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, idx) => (
                <tr key={v.id} className={`border-t ${idx % 2 !== 0 ? "bg-muted/20" : ""}`} data-testid={`row-vendor-${v.id}`}>
                  <td className="px-4 py-3 font-medium text-sm" data-testid={`text-vendor-name-${v.id}`}>{v.name}</td>
                  <td className="px-4 py-3 text-sm">{v.contactName || "—"}</td>
                  <td className="px-4 py-3 text-sm">{v.category || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col gap-0.5">
                      {v.email && <span className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" /> {v.email}</span>}
                      {v.phone && <span className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" /> {v.phone}</span>}
                      {!v.email && !v.phone && "—"}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)} data-testid={`button-edit-vendor-${v.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(v.id)} data-testid={`button-delete-vendor-${v.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
            <DialogDescription>{editing ? "Update vendor details" : "Create a new vendor record"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-vendor-name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Contact Name</Label>
                <Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} data-testid="input-vendor-contact" />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="input-vendor-category" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-vendor-email" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-vendor-phone" />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="input-vendor-address" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-vendor-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-vendor"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
