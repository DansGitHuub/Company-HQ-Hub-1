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
import { ArrowLeft, Save, Trash2, X, Plus, Tag } from "lucide-react";

const CLASS_OPTIONS = ["Labor", "Equipment", "Materials", "Subcontracting"];

type Tag = { id: number; name: string };

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
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  tags: Tag[];
};

export default function CatalogDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Partial<CatalogItemDetail> | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: item, isLoading, isError } = useQuery<CatalogItemDetail>({
    queryKey: ["/api/catalog", id],
    queryFn: () => apiRequest("GET", `/api/catalog/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  useEffect(() => {
    if (item && !form) {
      setForm({ ...item });
    }
  }, [item]);

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
    const newTag: Tag = { id: Date.now(), name };
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

  const costNum = form.cost != null ? parseFloat(form.cost as string) : NaN;
  const displayCost = !isNaN(costNum) ? costNum.toFixed(2) : "";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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
        </div>
      </div>

      <Separator />

      {/* Status banner */}
      {!form.isActive && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          This item is currently <strong>inactive</strong>.
        </div>
      )}

      {/* Core Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Name */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="field-name">Name</Label>
          <Input
            id="field-name"
            value={form.name ?? ""}
            onChange={e => field("name", e.target.value)}
            data-testid="input-name"
          />
        </div>

        {/* Class */}
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={form.class ?? ""} onValueChange={v => field("class", v || null)}>
            <SelectTrigger data-testid="select-class">
              <SelectValue placeholder="Select class…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— None —</SelectItem>
              {CLASS_OPTIONS.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
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

        {/* SKU */}
        <div className="space-y-1.5">
          <Label htmlFor="field-sku">SKU</Label>
          <Input
            id="field-sku"
            value={form.sku ?? ""}
            onChange={e => field("sku", e.target.value || null)}
            data-testid="input-sku"
          />
        </div>

        {/* Units */}
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

        {/* Cost */}
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

        {/* Taxable */}
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

        {/* Active */}
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

      {/* Description */}
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

      {/* Other Options */}
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

      {/* Tags */}
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

      <Separator />

      {/* Metadata */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p data-testid="text-item-number-meta">Item #: <span className="font-mono">{form.itemNumber}</span></p>
        {form.createdAt && (
          <p data-testid="text-created-at">Created: {new Date(form.createdAt).toLocaleDateString()}</p>
        )}
        {form.updatedAt && (
          <p data-testid="text-updated-at">Last updated: {new Date(form.updatedAt).toLocaleString()}</p>
        )}
      </div>

      {/* Bottom save bar */}
      {dirty && (
        <div className="sticky bottom-6 flex justify-end">
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
