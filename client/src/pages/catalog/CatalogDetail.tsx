import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Save, Trash2, X, Plus, Tag, DollarSign, Upload, ImageIcon, Eye, EyeOff } from "lucide-react";

const CLASS_OPTIONS = ["Labor", "Equipment", "Materials", "Subcontracting"];

const CLASS_ID_MAP: Record<string, number> = {
  Labor: 1,
  Equipment: 2,
  Materials: 3,
  Subcontracting: 4,
};

type TagItem = { id: number; name: string };

type CatalogItemDetail = {
  id: number;
  itemNumber: string;
  name: string;
  class: string | null;
  category: string | null;
  units: string | null;
  cost: string | null;
  taxable: boolean | null;
  description: string | null;
  sku: string | null;
  otherOptions: string | null;
  imageUrl: string | null;
  imageHidden: boolean | null;
  optionImages: Record<string, string> | null;
  optionImagesHidden: Record<string, boolean> | null;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  tags: TagItem[];
};

type ClassPricingDefault = {
  id: number;
  class_id: number;
  year: number;
  overhead_pct: string;
  profit_margin_pct: string;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CatalogDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Partial<CatalogItemDetail> | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showEstimateDialog, setShowEstimateDialog] = useState(false);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingOption, setUploadingOption] = useState<Record<string, boolean>>({});

  // Pricing panel local state
  const [taxRate, setTaxRate] = useState(8.25);
  const [overheadPct, setOverheadPct] = useState(15);
  const [profitPct, setProfitPct] = useState(20);

  const { data: estimates = [] } = useQuery<any[]>({
    queryKey: ["/api/estimates"],
    queryFn: () => apiRequest("GET", "/api/estimates").then(r => r.json()),
    enabled: showEstimateDialog,
  });

  const addToEstimateMut = useMutation({
    mutationFn: async (estimateId: number) => {
      const cost = parseFloat(form?.cost ?? "0");
      const breakeven = cost * (1 + overheadPct / 100);
      const unitPrice = breakeven * (1 + profitPct / 100);
      return apiRequest("POST", `/api/estimates/${estimateId}/line-items`, {
        description: form?.name ?? "Catalog Item",
        unit_price: unitPrice.toFixed(2),
        quantity: 1,
        units: form?.units ?? "",
      }).then(r => r.json());
    },
    onSuccess: () => { setShowEstimateDialog(false); toast({ title: "Added to estimate" }); },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const { data: item, isLoading, isError } = useQuery<CatalogItemDetail>({
    queryKey: ["/api/catalog", id],
    queryFn: () => apiRequest("GET", `/api/catalog/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: classPricingDefaults = [] } = useQuery<ClassPricingDefault[]>({
    queryKey: ["/api/class-pricing-defaults"],
    queryFn: () => apiRequest("GET", `/api/class-pricing-defaults`).then(r => r.json()),
  });

  useEffect(() => {
    if (item && !form) {
      setForm({ ...item });
    }
  }, [item]);

  // When the item's class changes, update overhead/profit defaults from class_pricing_defaults
  useEffect(() => {
    if (!form?.class || !classPricingDefaults.length) return;
    const classId = CLASS_ID_MAP[form.class];
    if (!classId) return;
    const defaults = classPricingDefaults.find(d => d.class_id === classId);
    if (defaults) {
      setOverheadPct(Math.round(parseFloat(defaults.overhead_pct) * 100 * 100) / 100);
      setProfitPct(Math.round(parseFloat(defaults.profit_margin_pct) * 100 * 100) / 100);
    }
  }, [form?.class, classPricingDefaults]);

  const saveMut = useMutation({
    mutationFn: async (data: Partial<CatalogItemDetail>) => {
      const { tags, ...body } = data as CatalogItemDetail;
      const payload = {
        ...body,
        tags: (tags ?? []).map(t => t.name),
      };
      const res = await apiRequest("PUT", `/api/catalog/${id}`, payload);
      return res.json();
    },
    onSuccess: (saved) => {
      setForm({ ...saved });
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/catalog", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      toast({ title: "Item saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/catalog/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      toast({ title: "Item deactivated" });
      navigate("/catalog");
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  function field<K extends keyof CatalogItemDetail>(key: K, value: CatalogItemDetail[K]) {
    setForm(f => f ? { ...f, [key]: value } : f);
    setDirty(true);
  }

  function addTag() {
    const name = tagInput.trim();
    if (!name || !form) return;
    const existing = (form.tags ?? []).find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) { setTagInput(""); return; }
    const newTag: TagItem = { id: Date.now(), name };
    setForm(f => f ? { ...f, tags: [...(f.tags ?? []), newTag] } : f);
    setTagInput("");
    setDirty(true);
  }

  function removeTag(name: string) {
    setForm(f => f ? { ...f, tags: (f.tags ?? []).filter(t => t.name !== name) } : f);
    setDirty(true);
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
  }

  async function uploadPrimaryPhoto(file: File) {
    if (!id) return;
    setUploadingPrimary(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/catalog/${id}/image`, { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setForm(f => f ? { ...f, imageUrl: data.image_url } : f);
      queryClient.invalidateQueries({ queryKey: ["/api/catalog", id] });
      toast({ title: "Primary photo updated" });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploadingPrimary(false);
    }
  }

  async function uploadOptionPhoto(option: string, file: File) {
    if (!id) return;
    setUploadingOption(prev => ({ ...prev, [option]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("option", option);
      const res = await fetch(`/api/catalog/${id}/option-image`, { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setForm(f => f ? { ...f, optionImages: { ...(f.optionImages ?? {}), [option]: data.image_url } } : f);
      queryClient.invalidateQueries({ queryKey: ["/api/catalog", id] });
      toast({ title: `Photo for "${option}" updated` });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploadingOption(prev => ({ ...prev, [option]: false }));
    }
  }

  async function removeOptionPhoto(option: string) {
    if (!id) return;
    try {
      await fetch(`/api/catalog/${id}/option-image/${encodeURIComponent(option)}`, { method: "DELETE", credentials: "include" });
      setForm(f => {
        if (!f) return f;
        const next = { ...(f.optionImages ?? {}) };
        delete next[option];
        return { ...f, optionImages: next };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog", id] });
      toast({ title: `Photo for "${option}" removed` });
    } catch {
      toast({ title: "Remove failed", variant: "destructive" });
    }
  }

  async function toggleImageVisibility(type: "primary" | "option", option?: string) {
    if (!id || !form) return;
    const currentHidden = type === "primary"
      ? (form.imageHidden ?? false)
      : ((form.optionImagesHidden ?? {})[option!] ?? false);
    const newHidden = !currentHidden;
    if (type === "primary") {
      setForm(f => f ? { ...f, imageHidden: newHidden } : f);
    } else {
      setForm(f => f ? { ...f, optionImagesHidden: { ...(f.optionImagesHidden ?? {}), [option!]: newHidden } } : f);
    }
    try {
      const res = await fetch(`/api/catalog/${id}/image-visibility`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, option, hidden: newHidden }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: newHidden ? "Photo hidden from estimates" : "Photo visible in estimates" });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog", id] });
    } catch {
      if (type === "primary") {
        setForm(f => f ? { ...f, imageHidden: currentHidden } : f);
      } else {
        setForm(f => f ? { ...f, optionImagesHidden: { ...(f.optionImagesHidden ?? {}), [option!]: currentHidden } } : f);
      }
      toast({ title: "Failed to update visibility", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center space-y-4">
        <p className="text-muted-foreground">Item not found.</p>
        <Button variant="outline" onClick={() => navigate("/catalog")} data-testid="btn-back-not-found">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Catalog
        </Button>
      </div>
    );
  }

  const costNum = form.cost != null && form.cost !== "" ? parseFloat(form.cost as string) : 0;
  const displayCost = !isNaN(costNum) && form.cost != null && form.cost !== "" ? parseFloat(form.cost as string).toFixed(2) : "";

  // Pricing calculations
  const taxable = form.taxable ?? false;
  const taxAmount = taxable ? costNum * (taxRate / 100) : 0;
  const subtotal = costNum + taxAmount;
  const overheadAmount = subtotal * (overheadPct / 100);
  const breakeven = subtotal + overheadAmount;
  const profitAmount = breakeven * (profitPct / 100);
  const unitPrice = breakeven + profitAmount;

  // Determine default hint label for class
  const classId = form.class ? CLASS_ID_MAP[form.class] : null;
  const classDefaults = classId ? classPricingDefaults.find(d => d.class_id === classId) : null;
  const defaultOverheadHint = classDefaults ? `${Math.round(parseFloat(classDefaults.overhead_pct) * 10000) / 100}% (${form.class} default)` : null;
  const defaultProfitHint = classDefaults ? `${Math.round(parseFloat(classDefaults.profit_margin_pct) * 10000) / 100}% (${form.class} default)` : null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/catalog")} data-testid="btn-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-item-name">{form.name}</h1>
            <p className="text-sm text-muted-foreground font-mono" data-testid="text-item-number">{form.itemNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="secondary" className="text-xs">Unsaved changes</Badge>
          )}
          <Button
            onClick={() => saveMut.mutate(form as CatalogItemDetail)}
            disabled={saveMut.isPending || !dirty}
            data-testid="btn-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" data-testid="btn-delete-trigger">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark <strong>{form.name}</strong> as inactive. It will no longer appear in the active catalog.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="btn-delete-cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMut.mutate()}
                  className="bg-destructive hover:bg-destructive/90"
                  data-testid="btn-delete-confirm"
                >
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        <Dialog open={showEstimateDialog} onOpenChange={setShowEstimateDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add to Estimate</DialogTitle>
              <DialogDescription>Select an estimate to add this item to.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto py-2">
              {estimates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No estimates found.</p>}
              {estimates.map((est: any) => (
                <button key={est.id} className="w-full text-left px-3 py-2 rounded-md border hover:bg-muted text-sm"
                  onClick={() => addToEstimateMut.mutate(est.id)} disabled={addToEstimateMut.isPending}>
                  <span className="font-medium">{est.estimate_number ?? "#" + est.id}</span>
                  {est.customer_name && <span className="text-muted-foreground ml-2">— {est.customer_name}</span>}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEstimateDialog(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: main form */}
        <div className="flex-1 min-w-0 space-y-6">
          <Separator />

          {!form.isActive && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
              This item is currently <strong>inactive</strong>.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="field-name">Name</Label>
              <Input
                id="field-name"
                value={form.name ?? ""}
                onChange={e => field("name", e.target.value)}
                data-testid="input-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={form.class ?? "none"} onValueChange={v => field("class", v === "none" ? null : v)}>
                <SelectTrigger data-testid="select-class">
                  <SelectValue placeholder="Select class…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {CLASS_OPTIONS.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-category">Category</Label>
              <Input
                id="field-category"
                value={form.category ?? ""}
                onChange={e => field("category", e.target.value || null)}
                placeholder="e.g. Mulch, Pruning…"
                data-testid="input-category"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-sku">SKU</Label>
              <Input
                id="field-sku"
                value={form.sku ?? ""}
                onChange={e => field("sku", e.target.value || null)}
                data-testid="input-sku"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-units">Units</Label>
              <Input
                id="field-units"
                value={form.units ?? ""}
                onChange={e => field("units", e.target.value || null)}
                placeholder="e.g. hr, yard, each…"
                data-testid="input-units"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-cost">Cost ($)</Label>
              <Input
                id="field-cost"
                type="number"
                min="0"
                step="0.01"
                value={displayCost}
                onChange={e => field("cost", e.target.value)}
                data-testid="input-cost"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Taxable</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={form.taxable ?? false}
                  onCheckedChange={v => field("taxable", v)}
                  data-testid="switch-taxable"
                />
                <span className="text-sm text-muted-foreground">{form.taxable ? "Yes" : "No"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={form.isActive ?? true}
                  onCheckedChange={v => field("isActive", v)}
                  data-testid="switch-active"
                />
                <span className="text-sm text-muted-foreground">{form.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-description">Description</Label>
            <Textarea
              id="field-description"
              rows={4}
              value={form.description ?? ""}
              onChange={e => field("description", e.target.value || null)}
              placeholder="Optional item description…"
              data-testid="textarea-description"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-other-options">Other Options / Notes</Label>
            <Textarea
              id="field-other-options"
              rows={3}
              value={form.otherOptions ?? ""}
              onChange={e => field("otherOptions", e.target.value || null)}
              placeholder="Additional notes…"
              data-testid="textarea-other-options"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="w-4 h-4" /> Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {(form.tags ?? []).map(t => (
                <Badge key={t.name} variant="secondary" className="gap-1 pr-1" data-testid={`badge-tag-${t.name}`}>
                  {t.name}
                  <button
                    type="button"
                    onClick={() => removeTag(t.name)}
                    className="hover:text-destructive transition-colors"
                    data-testid={`btn-remove-tag-${t.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag…"
                className="max-w-xs"
                data-testid="input-tag"
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag} data-testid="btn-add-tag">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {form.class === "Materials" && (() => {
            const options = (form.otherOptions ?? "")
              .split(",")
              .map(o => o.trim())
              .filter(Boolean);
            return (
              <div className="space-y-4">
                <Label className="flex items-center gap-1.5 text-base font-semibold">
                  <ImageIcon className="w-4 h-4" /> Photos
                </Label>

                {/* Primary photo */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Primary Photo <span className="font-normal text-xs">(optional)</span>
                  </p>
                  <div className="flex items-start gap-4">
                    {form.imageUrl ? (
                      <div className="relative">
                        <img
                          src={form.imageUrl}
                          alt="Primary"
                          className={`w-24 h-24 object-cover rounded-md border transition-opacity ${form.imageHidden ? "opacity-40" : ""}`}
                          data-testid="img-primary-photo"
                        />
                        {form.imageHidden && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <EyeOff className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted/30">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label htmlFor="upload-primary">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          disabled={uploadingPrimary}
                          data-testid="btn-upload-primary-photo"
                        >
                          <span>
                            {uploadingPrimary ? (
                              <>Uploading…</>
                            ) : (
                              <><Upload className="w-3.5 h-3.5 mr-1.5" />{form.imageUrl ? "Replace" : "Upload"}</>
                            )}
                          </span>
                        </Button>
                      </label>
                      <input
                        id="upload-primary"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) uploadPrimaryPhoto(f);
                          e.target.value = "";
                        }}
                      />
                      {form.imageUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1.5 text-xs px-2 h-7"
                          onClick={() => toggleImageVisibility("primary")}
                          title={form.imageHidden ? "Show in estimates" : "Hide from estimates"}
                          data-testid="btn-toggle-primary-visibility"
                        >
                          {form.imageHidden
                            ? <><EyeOff className="w-3.5 h-3.5" /> Hidden</>
                            : <><Eye className="w-3.5 h-3.5" /> Visible</>
                          }
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">PNG or JPG</p>
                    </div>
                  </div>
                </div>

                {/* Option photos */}
                {options.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Option Photos <span className="font-normal text-xs">(each slot is optional — upload any, skip others)</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {options.map(opt => {
                        const optUrl = (form.optionImages ?? {})[opt];
                        const isUploading = uploadingOption[opt] ?? false;
                        const optHidden = (form.optionImagesHidden ?? {})[opt] ?? false;
                        return (
                          <div key={opt} className="border rounded-md p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{opt}</span>
                              <div className="flex items-center gap-1">
                                {optUrl && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => toggleImageVisibility("option", opt)}
                                    title={optHidden ? "Show in estimates" : "Hide from estimates"}
                                    data-testid={`btn-toggle-option-visibility-${opt}`}
                                  >
                                    {optHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </Button>
                                )}
                                {optUrl && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => removeOptionPhoto(opt)}
                                    data-testid={`btn-remove-option-photo-${opt}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {optUrl ? (
                                <div className="relative">
                                  <img
                                    src={optUrl}
                                    alt={opt}
                                    className={`w-16 h-16 object-cover rounded border transition-opacity ${optHidden ? "opacity-40" : ""}`}
                                    data-testid={`img-option-photo-${opt}`}
                                  />
                                  {optHidden && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded border border-dashed flex items-center justify-center bg-muted/30">
                                  <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                                </div>
                              )}
                              <label htmlFor={`upload-opt-${opt}`}>
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  disabled={isUploading}
                                  data-testid={`btn-upload-option-photo-${opt}`}
                                >
                                  <span>
                                    {isUploading ? "Uploading…" : <><Upload className="w-3 h-3 mr-1" />{optUrl ? "Replace" : "Upload"}</>}
                                  </span>
                                </Button>
                              </label>
                              <input
                                id={`upload-opt-${opt}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadOptionPhoto(opt, f);
                                  e.target.value = "";
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p data-testid="text-item-number-meta">Item #: <span className="font-mono">{form.itemNumber}</span></p>
            {form.createdAt && (
              <p data-testid="text-created-at">Created: {new Date(form.createdAt).toLocaleDateString()}</p>
            )}
            {form.updatedAt && (
              <p data-testid="text-updated-at">Last updated: {new Date(form.updatedAt).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Right: Pricing Breakdown panel */}
        <div className="w-80 shrink-0 sticky top-6" data-testid="panel-pricing">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Pricing Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Unit Cost */}
              <div className="space-y-1">
                <Label htmlFor="pricing-cost" className="text-xs">Unit Cost ($)</Label>
                <Input
                  id="pricing-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={displayCost}
                  onChange={e => field("cost", e.target.value)}
                  className="h-8 text-sm"
                  data-testid="pricing-input-cost"
                />
              </div>

              {/* Taxable toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Taxable</Label>
                <Switch
                  checked={form.taxable ?? false}
                  onCheckedChange={v => field("taxable", v)}
                  data-testid="pricing-switch-taxable"
                />
              </div>

              {/* Tax Rate (only if taxable) */}
              {taxable && (
                <div className="space-y-1">
                  <Label htmlFor="pricing-tax-rate" className="text-xs">Tax Rate (%)</Label>
                  <Input
                    id="pricing-tax-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                    data-testid="pricing-input-tax-rate"
                  />
                </div>
              )}

              <Separator />

              {/* Calculated rows */}
              <div className="space-y-2 text-sm">
                {taxable && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax Amount</span>
                    <span data-testid="pricing-tax-amount">${fmt(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium">
                  <span>Subtotal</span>
                  <span data-testid="pricing-subtotal">${fmt(subtotal)}</span>
                </div>
              </div>

              <Separator />

              {/* Overhead */}
              <div className="space-y-1">
                <Label htmlFor="pricing-overhead" className="text-xs flex items-center justify-between">
                  <span>Overhead (%)</span>
                  {defaultOverheadHint && (
                    <span className="text-muted-foreground font-normal">{defaultOverheadHint}</span>
                  )}
                </Label>
                <Input
                  id="pricing-overhead"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={overheadPct}
                  onChange={e => setOverheadPct(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                  data-testid="pricing-input-overhead"
                />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Overhead Amount</span>
                  <span data-testid="pricing-overhead-amount">${fmt(overheadAmount)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Breakeven</span>
                  <span data-testid="pricing-breakeven">${fmt(breakeven)}</span>
                </div>
              </div>

              <Separator />

              {/* Profit */}
              <div className="space-y-1">
                <Label htmlFor="pricing-profit" className="text-xs flex items-center justify-between">
                  <span>Profit (%)</span>
                  {defaultProfitHint && (
                    <span className="text-muted-foreground font-normal">{defaultProfitHint}</span>
                  )}
                </Label>
                <Input
                  id="pricing-profit"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={profitPct}
                  onChange={e => setProfitPct(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                  data-testid="pricing-input-profit"
                />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Profit Amount</span>
                  <span data-testid="pricing-profit-amount">${fmt(profitAmount)}</span>
                </div>
              </div>

              <Separator />

              {/* Unit Price */}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Unit Price</span>
                <span
                  className="text-lg font-bold text-green-600 dark:text-green-400"
                  data-testid="pricing-unit-price"
                >
                  ${fmt(unitPrice)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom save bar */}
      {dirty && (
        <div className="sticky bottom-6 flex justify-end mt-6">
          <div className="bg-background border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">You have unsaved changes</span>
            <Button variant="outline" size="sm" onClick={() => { setForm({ ...item! }); setDirty(false); }} data-testid="btn-discard">
              Discard
            </Button>
            <Button size="sm" onClick={() => saveMut.mutate(form as CatalogItemDetail)} disabled={saveMut.isPending} data-testid="btn-save-bottom">
              <Save className="w-4 h-4 mr-1" />
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
