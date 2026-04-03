import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Cog } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkAreaType {
  id: string;
  name: string;
  division: string | null;
  is_active: boolean;
  sort_order: number;
}

interface EstimateTemplate {
  id: string;
  name: string;
  estimate_type: string | null;
  default_customer_message: string | null;
  default_terms: string | null;
  is_active: boolean;
}

interface DivisionColors {
  Maintenance: string;
  Install: string;
  Snow: string;
  General: string;
}

interface CompanyInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  tax_rate: string;
  payment_terms: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DIVISIONS = ["Maintenance", "Install", "Snow", "General"] as const;
const TEMPLATE_TYPES = [
  "Maintenance Contract",
  "Landscape Project",
  "Snow & Ice Contract",
  "Custom",
];

const TAB_PATHS: Record<string, string> = {
  "work-areas": "work-areas",
  "divisions": "divisions",
  "estimate-templates": "estimate-templates",
  "company": "company",
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const params = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();
  const activeTab = TAB_PATHS[params.tab || ""] ? params.tab! : "work-areas";

  function switchTab(t: string) {
    navigate(`/settings/${t}`);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <Cog className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="settings-heading">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure app-wide defaults and catalog data</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={switchTab}>
        <TabsList className="mb-4" data-testid="settings-tabs">
          <TabsTrigger value="work-areas" data-testid="tab-work-areas">Work Areas</TabsTrigger>
          <TabsTrigger value="divisions" data-testid="tab-divisions">Divisions</TabsTrigger>
          <TabsTrigger value="estimate-templates" data-testid="tab-estimate-templates">Estimate Templates</TabsTrigger>
          <TabsTrigger value="company" data-testid="tab-company">Company Info</TabsTrigger>
        </TabsList>

        <TabsContent value="work-areas"><WorkAreasTab /></TabsContent>
        <TabsContent value="divisions"><DivisionsTab /></TabsContent>
        <TabsContent value="estimate-templates"><EstimateTemplatesTab /></TabsContent>
        <TabsContent value="company"><CompanyInfoTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB 1 — Work Areas
// ═══════════════════════════════════════════════════════════════════════════════
function WorkAreasTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkAreaType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkAreaType | null>(null);

  const [form, setForm] = useState({
    name: "", division: "Maintenance", is_active: true, sort_order: 0,
  });

  const { data: workAreas = [], isLoading } = useQuery<WorkAreaType[]>({
    queryKey: ["/api/work-area-types?all=true"],
    queryFn: () => fetch("/api/work-area-types?all=true", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/work-area-types", data),
    onSuccess: () => {
      toast({ title: "Work area created" });
      qc.invalidateQueries({ queryKey: ["/api/work-area-types?all=true"] });
      qc.invalidateQueries({ queryKey: ["/api/work-area-types"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      apiRequest("PUT", `/api/work-area-types/${id}`, data),
    onSuccess: () => {
      toast({ title: "Work area updated" });
      qc.invalidateQueries({ queryKey: ["/api/work-area-types?all=true"] });
      qc.invalidateQueries({ queryKey: ["/api/work-area-types"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/work-area-types/${id}`),
    onSuccess: () => {
      toast({ title: "Work area deleted" });
      qc.invalidateQueries({ queryKey: ["/api/work-area-types?all=true"] });
      qc.invalidateQueries({ queryKey: ["/api/work-area-types"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiRequest("PUT", `/api/work-area-types/${id}`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/work-area-types?all=true"] });
      qc.invalidateQueries({ queryKey: ["/api/work-area-types"] });
    },
  });

  function openAdd() {
    setEditing(null);
    setForm({ name: "", division: "Maintenance", is_active: true, sort_order: 0 });
    setModalOpen(true);
  }

  function openEdit(wa: WorkAreaType) {
    setEditing(wa);
    setForm({
      name: wa.name,
      division: wa.division || "Maintenance",
      is_active: wa.is_active,
      sort_order: wa.sort_order,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  // Group by division
  const grouped = DIVISIONS.reduce<Record<string, WorkAreaType[]>>((acc, div) => {
    acc[div] = workAreas.filter(wa => (wa.division || "General") === div);
    return acc;
  }, {} as any);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-base">Work Area Types</CardTitle>
        <Button size="sm" onClick={openAdd} data-testid="btn-add-work-area">
          <Plus className="h-4 w-4 mr-1" /> Add Work Area
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Table data-testid="work-areas-table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-24">Sort</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DIVISIONS.flatMap((div) => {
                const items = grouped[div] || [];
                if (items.length === 0) return [];
                return [
                  <TableRow key={`header-${div}`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={5} className="py-1.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      {div}
                    </TableCell>
                  </TableRow>,
                  ...items.map((wa) => (
                    <TableRow key={wa.id} data-testid={`work-area-row-${wa.id}`}>
                      <TableCell className="font-medium">{wa.name}</TableCell>
                      <TableCell>
                        <DivBadge division={wa.division} />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={wa.is_active}
                          data-testid={`toggle-active-${wa.id}`}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: wa.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{wa.sort_order}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="icon"
                            data-testid={`btn-edit-wa-${wa.id}`}
                            onClick={() => openEdit(wa)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="text-destructive hover:text-destructive"
                            data-testid={`btn-delete-wa-${wa.id}`}
                            onClick={() => setDeleteTarget(wa)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )),
                ];
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Work Area" : "Add Work Area"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                data-testid="input-wa-name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mulch Beds"
              />
            </div>
            <div className="space-y-1">
              <Label>Division</Label>
              <Select value={form.division} onValueChange={(v) => setForm(f => ({ ...f, division: v }))}>
                <SelectTrigger data-testid="select-wa-division">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sort Order</Label>
              <Input
                type="number"
                data-testid="input-wa-sort"
                value={form.sort_order}
                onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                data-testid="switch-wa-active"
                onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button
              data-testid="btn-save-wa"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              data-testid="btn-confirm-delete-wa"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB 2 — Divisions
// ═══════════════════════════════════════════════════════════════════════════════
function DivisionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: setting } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/settings/division_colors"],
  });

  const colors: DivisionColors = setting?.value
    ? JSON.parse(setting.value)
    : { Maintenance: "#22c55e", Install: "#3b82f6", Snow: "#94a3b8", General: "#f59e0b" };

  const [localColors, setLocalColors] = useState<DivisionColors>(colors);

  useEffect(() => {
    if (setting?.value) setLocalColors(JSON.parse(setting.value));
  }, [setting?.value]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/settings/division_colors", { value: JSON.stringify(localColors) }),
    onSuccess: () => {
      toast({ title: "Division colors saved" });
      qc.invalidateQueries({ queryKey: ["/api/settings/division_colors"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-base">Division Colors</CardTitle>
        <Button
          size="sm"
          data-testid="btn-save-divisions"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          These colors are used to code jobs, estimates, and the dispatch calendar by division.
        </p>
        <div className="space-y-4">
          {(Object.keys(localColors) as Array<keyof DivisionColors>).map((div) => (
            <div key={div} className="flex items-center gap-4" data-testid={`division-row-${div}`}>
              <div
                className="w-8 h-8 rounded-full border border-gray-200 shrink-0"
                style={{ backgroundColor: localColors[div] }}
              />
              <span className="w-32 font-medium">{div}</span>
              <Input
                type="color"
                className="w-16 h-9 p-1 cursor-pointer"
                value={localColors[div]}
                data-testid={`color-input-${div}`}
                onChange={(e) => setLocalColors(c => ({ ...c, [div]: e.target.value }))}
              />
              <Input
                className="w-32 font-mono text-sm"
                value={localColors[div]}
                data-testid={`color-hex-${div}`}
                onChange={(e) => setLocalColors(c => ({ ...c, [div]: e.target.value }))}
                placeholder="#000000"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB 3 — Estimate Templates
// ═══════════════════════════════════════════════════════════════════════════════
function EstimateTemplatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EstimateTemplate | null>(null);

  const emptyForm = {
    name: "",
    estimate_type: "Custom",
    default_customer_message: "",
    default_terms: "",
    is_active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const { data: templates = [], isLoading } = useQuery<EstimateTemplate[]>({
    queryKey: ["/api/estimate-templates?all=true"],
    queryFn: () => fetch("/api/estimate-templates?all=true", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/estimate-templates", data),
    onSuccess: () => {
      toast({ title: "Template created" });
      qc.invalidateQueries({ queryKey: ["/api/estimate-templates?all=true"] });
      qc.invalidateQueries({ queryKey: ["/api/estimate-templates"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      apiRequest("PUT", `/api/estimate-templates/${id}`, data),
    onSuccess: () => {
      toast({ title: "Template updated" });
      qc.invalidateQueries({ queryKey: ["/api/estimate-templates?all=true"] });
      qc.invalidateQueries({ queryKey: ["/api/estimate-templates"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/estimate-templates/${id}`),
    onSuccess: () => {
      toast({ title: "Template deleted" });
      qc.invalidateQueries({ queryKey: ["/api/estimate-templates?all=true"] });
      qc.invalidateQueries({ queryKey: ["/api/estimate-templates"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(t: EstimateTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      estimate_type: t.estimate_type || "Custom",
      default_customer_message: t.default_customer_message || "",
      default_terms: t.default_terms || "",
      is_active: t.is_active,
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-base">Estimate Templates</CardTitle>
        <Button size="sm" onClick={openAdd} data-testid="btn-add-template">
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No templates yet</div>
        ) : (
          <Table data-testid="templates-table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} data-testid={`template-row-${t.id}`}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{t.estimate_type || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.is_active ? (
                      <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}
                        data-testid={`btn-edit-template-${t.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(t)}
                        data-testid={`btn-delete-template-${t.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Estimate Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Template Name</Label>
              <Input
                data-testid="input-template-name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Spring Cleanup Package"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.estimate_type}
                onValueChange={(v) => setForm(f => ({ ...f, estimate_type: v }))}
              >
                <SelectTrigger data-testid="select-template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Customer Message</Label>
              <Textarea
                data-testid="input-template-message"
                rows={3}
                value={form.default_customer_message}
                onChange={(e) => setForm(f => ({ ...f, default_customer_message: e.target.value }))}
                placeholder="Thank you for the opportunity to work with you…"
              />
            </div>
            <div className="space-y-1">
              <Label>Default Terms</Label>
              <Textarea
                data-testid="input-template-terms"
                rows={3}
                value={form.default_terms}
                onChange={(e) => setForm(f => ({ ...f, default_terms: e.target.value }))}
                placeholder="Payment due upon completion…"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
                data-testid="switch-template-active"
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button
              data-testid="btn-save-template"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              data-testid="btn-confirm-delete-template"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB 4 — Company Info
// ═══════════════════════════════════════════════════════════════════════════════
function CompanyInfoTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: setting } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/settings/company_info"],
  });

  const empty: CompanyInfo = {
    name: "", phone: "", email: "", address: "", website: "", tax_rate: "0", payment_terms: "Net 30",
  };

  const [form, setForm] = useState<CompanyInfo>(empty);

  useEffect(() => {
    if (setting?.value) {
      try { setForm({ ...empty, ...JSON.parse(setting.value) }); } catch {}
    }
  }, [setting?.value]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/settings/company_info", { value: JSON.stringify(form) }),
    onSuccess: () => {
      toast({ title: "Company info saved" });
      qc.invalidateQueries({ queryKey: ["/api/settings/company_info"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function field(key: keyof CompanyInfo, label: string, placeholder?: string, type?: string) {
    return (
      <div className="space-y-1">
        <Label htmlFor={`ci-${key}`}>{label}</Label>
        <Input
          id={`ci-${key}`}
          type={type || "text"}
          data-testid={`input-ci-${key}`}
          value={form[key]}
          placeholder={placeholder}
          onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="py-4">
        <CardTitle className="text-base">Company Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {field("name", "Company Name", "Chapin Landscapes")}
        <div className="grid grid-cols-2 gap-4">
          {field("phone", "Phone", "(555) 000-0000", "tel")}
          {field("email", "Email", "info@company.com", "email")}
        </div>
        {field("address", "Address", "123 Main St, City, State 00000")}
        {field("website", "Website", "https://company.com", "url")}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="ci-tax">Default Tax Rate (%)</Label>
            <Input
              id="ci-tax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              data-testid="input-ci-tax_rate"
              value={form.tax_rate}
              onChange={(e) => setForm(f => ({ ...f, tax_rate: e.target.value }))}
            />
          </div>
          {field("payment_terms", "Default Payment Terms", "Net 30")}
        </div>
        <div className="pt-2">
          <Button
            data-testid="btn-save-company"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save Company Info"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DIV_COLORS: Record<string, string> = {
  Maintenance: "#22c55e", Install: "#3b82f6", Snow: "#94a3b8", General: "#f59e0b",
};

function DivBadge({ division }: { division: string | null }) {
  const color = DIV_COLORS[division || ""] || "#e5e7eb";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {division || "—"}
    </span>
  );
}
