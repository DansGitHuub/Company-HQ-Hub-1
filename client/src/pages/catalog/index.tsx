import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Edit, Archive, Upload, X, Tag } from "lucide-react";
import { CATALOG_CLASSES } from "@shared/schema";
import type { CatalogItem, CatalogTag } from "@shared/schema";

const UNITS_OPTIONS = ["EA", "HR", "LF", "SF", "SY", "CY", "LS", "TN", "GAL", "BAG", "LB", "Day", "Week"];

type CatalogItemWithTags = CatalogItem & { tags: CatalogTag[] };

type ItemForm = {
  name: string;
  class: string;
  category: string;
  units: string;
  cost: string;
  taxable: boolean;
  description: string;
  sku: string;
  other_options: string;
  is_active: boolean;
  tags: string[];
};

const emptyForm = (): ItemForm => ({
  name: "", class: "", category: "", units: "", cost: "0",
  taxable: false, description: "", sku: "", other_options: "", is_active: true, tags: [],
});

export default function CatalogPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [classTab, setClassTab] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [showRetired, setShowRetired] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItemWithTags | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [newTagInput, setNewTagInput] = useState("");
  const [retireTarget, setRetireTarget] = useState<CatalogItemWithTags | null>(null);

  const { data: items = [], isLoading } = useQuery<CatalogItemWithTags[]>({
    queryKey: ["/api/catalog", showRetired],
    queryFn: () => apiRequest("GET", `/api/catalog?active_only=${showRetired ? "false" : "true"}`).then(r => r.json()),
  });

  const { data: allTags = [] } = useQuery<CatalogTag[]>({
    queryKey: ["/api/catalog/tags"],
    queryFn: () => apiRequest("GET", "/api/catalog/tags").then(r => r.json()),
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/catalog/categories"],
    queryFn: () => apiRequest("GET", "/api/catalog/categories").then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editItem) {
        return apiRequest("PUT", `/api/catalog/${editItem.id}`, payload).then(r => r.json());
      }
      return apiRequest("POST", "/api/catalog", payload).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/catalog"] });
      qc.invalidateQueries({ queryKey: ["/api/catalog/categories"] });
      qc.invalidateQueries({ queryKey: ["/api/catalog/tags"] });
      setDialogOpen(false);
      toast({ title: editItem ? "Item updated" : "Item created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const retireMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/catalog/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/catalog"] });
      setRetireTarget(null);
      toast({ title: "Item retired" });
    },
  });

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (classTab !== "All" && item.class !== classTab) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (tagFilter !== "all" && !item.tags.some(t => t.name === tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (item.name?.toLowerCase().includes(q) ||
          item.itemNumber?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [items, classTab, categoryFilter, tagFilter, search]);

  function openNew() {
    setEditItem(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(item: CatalogItemWithTags) {
    setEditItem(item);
    setForm({
      name: item.name ?? "",
      class: item.class ?? "",
      category: item.category ?? "",
      units: item.units ?? "",
      cost: item.cost ?? "0",
      taxable: item.taxable ?? false,
      description: item.description ?? "",
      sku: item.sku ?? "",
      other_options: item.otherOptions ?? "",
      is_active: item.isActive ?? true,
      tags: item.tags.map(t => t.name),
    });
    setDialogOpen(true);
  }

  function addTag() {
    const t = newTagInput.trim();
    if (!t || form.tags.includes(t)) return;
    setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setNewTagInput("");
  }

  function removeTag(t: string) {
    setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      name: form.name.trim(),
      class: form.class || null,
      category: form.category.trim() || null,
      units: form.units || null,
      cost: parseFloat(form.cost) || 0,
      taxable: form.taxable,
      description: form.description.trim() || null,
      sku: form.sku.trim() || null,
      other_options: form.other_options.trim() || null,
      is_active: form.is_active,
      tags: form.tags,
    });
  }

  const tabs = ["All", ...CATALOG_CLASSES];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materials Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your items, labor, equipment and subcontractor entries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/catalog/import")} data-testid="btn-import-csv">
            <Upload className="w-4 h-4 mr-2" /> Import CSV
          </Button>
          <Button onClick={openNew} data-testid="btn-new-item">
            <Plus className="w-4 h-4 mr-2" /> New Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <Tabs value={classTab} onValueChange={setClassTab}>
          <TabsList data-testid="tabs-class">
            {tabs.map(t => (
              <TabsTrigger key={t} value={t} data-testid={`tab-class-${t.toLowerCase()}`}>{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, item#, SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-40" data-testid="select-tag-filter">
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Switch checked={showRetired} onCheckedChange={setShowRetired} data-testid="switch-show-retired" />
            Show retired
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Item #</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Class</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Units</th>
              <th className="text-right px-4 py-3 font-medium">Cost</th>
              <th className="text-center px-4 py-3 font-medium">Taxable</th>
              <th className="text-left px-4 py-3 font-medium">Tags</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No items found</td></tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id} className={`border-b hover:bg-muted/20 transition-colors ${!item.isActive ? "opacity-50" : ""}`}
                  data-testid={`row-catalog-${item.id}`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground" data-testid={`text-item-number-${item.id}`}>{item.itemNumber}</td>
                  <td className="px-4 py-3 font-medium" data-testid={`text-name-${item.id}`}>
                    {item.name}
                    {!item.isActive && <Badge variant="outline" className="ml-2 text-xs">Retired</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {item.class && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-class-${item.id}`}>{item.class}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" data-testid={`text-category-${item.id}`}>{item.category ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground" data-testid={`text-units-${item.id}`}>{item.units ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono" data-testid={`text-cost-${item.id}`}>
                    ${parseFloat(item.cost ?? "0").toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center" data-testid={`text-taxable-${item.id}`}>
                    {item.taxable ? "✓" : ""}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map(t => (
                        <Badge key={t.id} variant="outline" className="text-xs" data-testid={`badge-tag-${item.id}-${t.id}`}>{t.name}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)} data-testid={`btn-edit-${item.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {item.isActive && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive"
                          onClick={() => setRetireTarget(item)} data-testid={`btn-retire-${item.id}`}>
                          <Archive className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</p>

      {/* Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? `Edit: ${editItem.name}` : "New Catalog Item"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Name */}
            <div className="col-span-2">
              <Label className="text-xs">Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1" placeholder="Item name" data-testid="input-item-name" />
            </div>

            {/* Class */}
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={form.class || "_none"} onValueChange={v => setForm(f => ({ ...f, class: v === "_none" ? "" : v }))}>
                <SelectTrigger className="mt-1" data-testid="select-item-class">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {CATALOG_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div>
              <Label className="text-xs">Category</Label>
              <Input list="catalog-categories" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="mt-1" placeholder="e.g. Mulch, Hardscape" data-testid="input-item-category" />
              <datalist id="catalog-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Units */}
            <div>
              <Label className="text-xs">Units</Label>
              <Select value={form.units || "_none"} onValueChange={v => setForm(f => ({ ...f, units: v === "_none" ? "" : v }))}>
                <SelectTrigger className="mt-1" data-testid="select-item-units">
                  <SelectValue placeholder="Select units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {UNITS_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Cost */}
            <div>
              <Label className="text-xs">Cost ($)</Label>
              <Input type="number" min="0" step="0.01" value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                className="mt-1" data-testid="input-item-cost" />
            </div>

            {/* SKU */}
            <div>
              <Label className="text-xs">SKU</Label>
              <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                className="mt-1" placeholder="Vendor SKU" data-testid="input-item-sku" />
            </div>

            {/* Taxable */}
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={form.taxable} onCheckedChange={v => setForm(f => ({ ...f, taxable: v }))}
                data-testid="switch-item-taxable" />
              <Label className="text-xs">Taxable</Label>
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1 resize-none" placeholder="Item description" data-testid="textarea-item-description" />
            </div>

            {/* Tags */}
            <div className="col-span-2">
              <Label className="text-xs">Tags</Label>
              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                {form.tags.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1 text-xs" data-testid={`badge-form-tag-${t}`}>
                    {t}
                    <button onClick={() => removeTag(t)} data-testid={`btn-remove-tag-${t}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input list="all-tags" value={newTagInput} onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Add tag..." className="text-sm" data-testid="input-new-tag" />
                <datalist id="all-tags">
                  {allTags.filter(t => !form.tags.includes(t.name)).map(t => <option key={t.id} value={t.name} />)}
                </datalist>
                <Button type="button" variant="outline" size="sm" onClick={addTag} data-testid="btn-add-tag">
                  <Tag className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Other Options */}
            <div className="col-span-2">
              <Label className="text-xs">Other Options</Label>
              <Textarea rows={2} value={form.other_options} onChange={e => setForm(f => ({ ...f, other_options: e.target.value }))}
                className="mt-1 resize-none" placeholder="Any additional notes or options" data-testid="textarea-item-other-options" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="btn-cancel-item">Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="btn-save-item">
              {saveMutation.isPending ? "Saving..." : editItem ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retire Confirm */}
      <AlertDialog open={!!retireTarget} onOpenChange={open => !open && setRetireTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire Item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{retireTarget?.name}" will be marked inactive and hidden from active listings. This can be undone by editing the item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-retire">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => retireTarget && retireMutation.mutate(retireTarget.id)}
              data-testid="btn-confirm-retire">
              Retire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
