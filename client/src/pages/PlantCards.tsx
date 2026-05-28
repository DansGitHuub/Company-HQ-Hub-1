import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Leaf, Search, Plus, Sparkles, Sun, Droplets, Ruler, Thermometer,
  Scissors, Bug, Star, Edit, Trash2, Upload, X, Eye, EyeOff,
  Printer, ArrowLeft, Image as ImageIcon, ChevronRight
} from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";

type PlantCard = {
  id: number;
  catalog_item_id: number | null;
  common_name: string;
  botanical_name: string | null;
  plant_type: string | null;
  deciduous_evergreen: string | null;
  mature_size: string | null;
  growth_rate: string | null;
  hardiness_zone: string | null;
  light_requirement: string | null;
  soil_moisture: string | null;
  water_needs: string | null;
  deer_resistant: boolean;
  flowering: boolean;
  flower_season: string | null;
  flower_color: string | null;
  pruning_time: string | null;
  known_pests_issues: string | null;
  special_notes: string | null;
  maintenance_notes: string | null;
  photos: string[];
  published: boolean;
  created_by: string | null;
  created_at: string;
};

const PLANT_TYPES = ["Tree", "Shrub", "Perennial", "Annual", "Groundcover", "Vine", "Grass", "Other"];

const EMPTY_FORM: Partial<PlantCard> & { catalogItemId?: number | null } = {
  common_name: "",
  botanical_name: "",
  plant_type: "Tree",
  deciduous_evergreen: "",
  mature_size: "",
  growth_rate: "",
  hardiness_zone: "",
  light_requirement: "",
  soil_moisture: "",
  water_needs: "",
  deer_resistant: false,
  flowering: false,
  flower_season: "",
  flower_color: "",
  pruning_time: "",
  known_pests_issues: "",
  special_notes: "",
  maintenance_notes: "",
  photos: [],
  published: true,
  catalogItemId: null,
};

function fieldVal(v: any): string { return v ?? ""; }
function boolBadge(v: boolean, yes: string, no: string) {
  return v
    ? <Badge className="bg-green-100 text-green-800 border-green-200">{yes}</Badge>
    : <Badge variant="outline" className="text-muted-foreground">{no}</Badge>;
}

// ── Card Detail View ──────────────────────────────────────────────────────────
function PlantCardDetail({ card, onBack, isAdmin, onEdit }: {
  card: PlantCard; onBack: () => void; isAdmin: boolean; onEdit: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/plant-cards/${card.id}/photos`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards"] });
      toast({ title: "Photo added" });
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  const deletePhoto = useMutation({
    mutationFn: async (url: string) => {
      await apiRequest("DELETE", `/api/plant-cards/${card.id}/photos`, { url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards"] });
    },
    onError: () => toast({ title: "Failed to remove photo", variant: "destructive" }),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!isAdmin) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    files.forEach(f => uploadPhoto.mutate(f));
  }, [isAdmin, uploadPhoto]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(f => uploadPhoto.mutate(f));
    e.target.value = "";
  };

  const photos: string[] = card.photos ?? [];
  const coverPhoto = photos[0] ?? null;

  return (
    <div className="max-w-4xl mx-auto" data-testid="plant-card-detail">
      {/* Back bar */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="btn-back-plant-cards">
          <ArrowLeft className="w-4 h-4 mr-1" /> All Plants
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="btn-print-plant-card">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={onEdit} data-testid="btn-edit-plant-card">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* ── Printable card starts here ── */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none">
        {/* Header band */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white px-8 py-6 print:px-6 print:py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight print:text-2xl" data-testid="plant-card-common-name">
                {card.common_name}
              </h1>
              {card.botanical_name && (
                <p className="italic text-green-200 text-lg mt-0.5">{card.botanical_name}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {card.plant_type && <Badge className="bg-white/20 text-white border-white/30">{card.plant_type}</Badge>}
                {card.deciduous_evergreen && <Badge className="bg-white/20 text-white border-white/30">{card.deciduous_evergreen}</Badge>}
                {card.flowering && boolBadge(true, "🌸 Flowering", "")}
                {card.deer_resistant && boolBadge(true, "🦌 Deer Resistant", "")}
              </div>
            </div>
            {coverPhoto && (
              <img
                src={coverPhoto}
                alt={card.common_name}
                className="w-28 h-28 object-cover rounded-lg border-2 border-white/30 shrink-0 cursor-pointer print:w-20 print:h-20"
                onClick={() => setLightboxSrc(coverPhoto)}
              />
            )}
          </div>
        </div>

        <div className="p-8 print:p-6 space-y-6">
          {/* Quick-facts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[
              { icon: Ruler, label: "Mature Size", val: card.mature_size },
              { icon: Thermometer, label: "Hardiness Zone", val: card.hardiness_zone },
              { icon: Sun, label: "Light", val: card.light_requirement },
              { icon: Droplets, label: "Water Needs", val: card.water_needs },
              { icon: Leaf, label: "Soil", val: card.soil_moisture },
              { icon: ChevronRight, label: "Growth Rate", val: card.growth_rate },
              { icon: Scissors, label: "Pruning", val: card.pruning_time },
              { icon: Star, label: "Flower Season", val: card.flowering && card.flower_season ? `${card.flower_season}${card.flower_color ? ` · ${card.flower_color}` : ""}` : null },
            ].filter(f => f.val).map(({ icon: Icon, label, val }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1 print:bg-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <div className="text-sm font-medium">{val}</div>
              </div>
            ))}
          </div>

          {/* Special Notes */}
          {card.special_notes && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Leaf className="w-4 h-4" /> About This Plant
              </h3>
              <p className="text-sm leading-relaxed text-gray-700">{card.special_notes}</p>
            </div>
          )}

          {/* Maintenance Notes */}
          {card.maintenance_notes && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Scissors className="w-4 h-4" /> Maintenance Tips
              </h3>
              <p className="text-sm leading-relaxed text-gray-700">{card.maintenance_notes}</p>
            </div>
          )}

          {/* Pests / Issues */}
          {card.known_pests_issues && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Bug className="w-4 h-4" /> Known Pests & Issues
              </h3>
              <p className="text-sm leading-relaxed text-gray-700">{card.known_pests_issues}</p>
            </div>
          )}

          {/* Photo gallery */}
          {(photos.length > 0 || isAdmin) && (
            <div className="print:break-inside-avoid">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Photos
              </h3>
              <div
                className={[
                  "grid grid-cols-3 sm:grid-cols-4 gap-2",
                  isAdmin && dragOver ? "ring-2 ring-green-400 ring-offset-2 rounded-lg" : "",
                ].join(" ")}
                onDragOver={isAdmin ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
                onDragLeave={isAdmin ? () => setDragOver(false) : undefined}
                onDrop={isAdmin ? handleDrop : undefined}
              >
                {photos.map((url, i) => (
                  <div key={i} className="relative group aspect-square">
                    <img
                      src={url}
                      alt={`${card.common_name} photo ${i + 1}`}
                      className="w-full h-full object-cover rounded-lg border cursor-pointer"
                      onClick={() => setLightboxSrc(url)}
                      data-testid={`plant-photo-${i}`}
                    />
                    {isAdmin && (
                      <button
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        onClick={() => deletePhoto.mutate(url)}
                        data-testid={`btn-delete-photo-${i}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {isAdmin && (
                  <button
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-green-500 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-green-600 transition-colors print:hidden"
                    onClick={() => fileRef.current?.click()}
                    data-testid="btn-add-photo"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">Add Photo</span>
                  </button>
                )}
              </div>

              {isAdmin && (
                <p className="text-xs text-muted-foreground mt-2 print:hidden">
                  Drag & drop images here or click "Add Photo" · First photo becomes the cover
                </p>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Print footer */}
          <div className="hidden print:block border-t pt-4 text-xs text-gray-400 text-center">
            Chapin Landscapes · Plant Care Guide · {card.common_name}{card.botanical_name ? ` (${card.botanical_name})` : ""}
          </div>
        </div>
      </div>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

// ── List card ─────────────────────────────────────────────────────────────────
function PlantListCard({ card, onClick }: { card: PlantCard; onClick: () => void }) {
  const photo = card.photos?.[0] ?? null;
  return (
    <div
      className="bg-white rounded-lg border hover:shadow-md transition-shadow cursor-pointer flex gap-3 p-3"
      onClick={onClick}
      data-testid={`plant-card-row-${card.id}`}
    >
      {photo ? (
        <img src={photo} alt={card.common_name} className="w-16 h-16 object-cover rounded-md shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-md bg-green-50 flex items-center justify-center shrink-0">
          <Leaf className="w-7 h-7 text-green-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{card.common_name}</div>
        {card.botanical_name && (
          <div className="italic text-xs text-muted-foreground truncate">{card.botanical_name}</div>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {card.plant_type && <Badge variant="secondary" className="text-xs">{card.plant_type}</Badge>}
          {card.light_requirement && <Badge variant="outline" className="text-xs">{card.light_requirement}</Badge>}
          {card.hardiness_zone && <Badge variant="outline" className="text-xs">Zone {card.hardiness_zone}</Badge>}
          {!card.published && <Badge variant="destructive" className="text-xs">Draft</Badge>}
        </div>
      </div>
    </div>
  );
}

// ── Admin Edit/Create Form ────────────────────────────────────────────────────
function PlantCardForm({ initial, onSave, onCancel, isNew }: {
  initial: Partial<PlantCard> & { catalogItemId?: number | null };
  onSave: (data: any) => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  function f(key: string, val: any) { setForm(prev => ({ ...prev, [key]: val })); }

  async function generate() {
    if (!form.common_name) { toast({ title: "Enter a plant name first", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/plant-cards/generate", {
        commonName: form.common_name,
        botanicalName: form.botanical_name,
        plantType: form.plant_type,
      });
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        common_name: data.commonName ?? prev.common_name,
        botanical_name: data.botanicalName ?? prev.botanical_name,
        plant_type: data.plantType ?? prev.plant_type,
        deciduous_evergreen: data.deciduousEvergreen ?? prev.deciduous_evergreen,
        mature_size: data.matureSize ?? prev.mature_size,
        growth_rate: data.growthRate ?? prev.growth_rate,
        hardiness_zone: data.hardinessZone ?? prev.hardiness_zone,
        light_requirement: data.lightRequirement ?? prev.light_requirement,
        soil_moisture: data.soilMoisture ?? prev.soil_moisture,
        water_needs: data.waterNeeds ?? prev.water_needs,
        deer_resistant: data.deerResistant ?? prev.deer_resistant,
        flowering: data.flowering ?? prev.flowering,
        flower_season: data.flowerSeason ?? prev.flower_season,
        flower_color: data.flowerColor ?? prev.flower_color,
        pruning_time: data.pruningTime ?? prev.pruning_time,
        known_pests_issues: data.knownPestsIssues ?? prev.known_pests_issues,
        special_notes: data.specialNotes ?? prev.special_notes,
        maintenance_notes: data.maintenanceNotes ?? prev.maintenance_notes,
      }));
      toast({ title: "AI card generated — review and save" });
    } catch (err: any) {
      showErrorToast(err, "AI Generation Failed");
      // Log to diagnostics so admins can see it in the panel
      fetch("/api/diagnostics/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          errorType: "ai_generation_error",
          errorMessage: err?.serverMessage || err?.message || "Plant card AI generation failed",
          feature: "plant_cards",
          severity: "error",
        }),
      }).catch(() => {});
    } finally {
      setGenerating(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.common_name?.trim()) { toast({ title: "Common name is required", variant: "destructive" }); return; }
    onSave({
      commonName: form.common_name,
      botanicalName: form.botanical_name || null,
      plantType: form.plant_type || null,
      deciduousEvergreen: form.deciduous_evergreen || null,
      matureSize: form.mature_size || null,
      growthRate: form.growth_rate || null,
      hardinessZone: form.hardiness_zone || null,
      lightRequirement: form.light_requirement || null,
      soilMoisture: form.soil_moisture || null,
      waterNeeds: form.water_needs || null,
      deerResistant: form.deer_resistant ?? false,
      flowering: form.flowering ?? false,
      flowerSeason: form.flower_season || null,
      flowerColor: form.flower_color || null,
      pruningTime: form.pruning_time || null,
      knownPestsIssues: form.known_pests_issues || null,
      specialNotes: form.special_notes || null,
      maintenanceNotes: form.maintenance_notes || null,
      photos: form.photos ?? [],
      published: form.published ?? true,
      catalogItemId: form.catalogItemId ?? null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* AI generate button */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800">AI Auto-Fill</p>
          <p className="text-xs text-green-700 mt-0.5">Enter the plant name below, then click Generate to fill all fields automatically.</p>
        </div>
        <Button type="button" size="sm" onClick={generate} disabled={generating} className="bg-green-600 hover:bg-green-700 shrink-0" data-testid="btn-ai-generate">
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          {generating ? "Generating…" : "Generate"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Common Name *</Label>
          <Input value={fieldVal(form.common_name)} onChange={e => f("common_name", e.target.value)} placeholder="e.g. Red Maple" data-testid="input-common-name" />
        </div>
        <div className="space-y-1.5">
          <Label>Botanical Name</Label>
          <Input value={fieldVal(form.botanical_name)} onChange={e => f("botanical_name", e.target.value)} placeholder="e.g. Acer rubrum" data-testid="input-botanical-name" />
        </div>
        <div className="space-y-1.5">
          <Label>Plant Type</Label>
          <Select value={form.plant_type ?? "Tree"} onValueChange={v => f("plant_type", v)}>
            <SelectTrigger data-testid="select-plant-type"><SelectValue /></SelectTrigger>
            <SelectContent>{PLANT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Deciduous / Evergreen</Label>
          <Select value={form.deciduous_evergreen ?? ""} onValueChange={v => f("deciduous_evergreen", v)}>
            <SelectTrigger data-testid="select-deciduous"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["Deciduous", "Evergreen", "Semi-Evergreen"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mature Size</Label>
          <Input value={fieldVal(form.mature_size)} onChange={e => f("mature_size", e.target.value)} placeholder="e.g. 20-30 ft tall" data-testid="input-mature-size" />
        </div>
        <div className="space-y-1.5">
          <Label>Growth Rate</Label>
          <Select value={form.growth_rate ?? ""} onValueChange={v => f("growth_rate", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["Slow", "Moderate", "Fast"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Hardiness Zone</Label>
          <Input value={fieldVal(form.hardiness_zone)} onChange={e => f("hardiness_zone", e.target.value)} placeholder="e.g. 4-8" data-testid="input-hardiness-zone" />
        </div>
        <div className="space-y-1.5">
          <Label>Light Requirement</Label>
          <Select value={form.light_requirement ?? ""} onValueChange={v => f("light_requirement", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["Full Sun", "Part Sun", "Part Shade", "Full Shade", "Adaptable"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Soil Moisture</Label>
          <Input value={fieldVal(form.soil_moisture)} onChange={e => f("soil_moisture", e.target.value)} placeholder="e.g. Well-drained, tolerates clay" data-testid="input-soil-moisture" />
        </div>
        <div className="space-y-1.5">
          <Label>Water Needs</Label>
          <Select value={form.water_needs ?? ""} onValueChange={v => f("water_needs", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["Low", "Moderate", "High"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Pruning Time</Label>
          <Input value={fieldVal(form.pruning_time)} onChange={e => f("pruning_time", e.target.value)} placeholder="e.g. Late winter" data-testid="input-pruning-time" />
        </div>
        <div className="space-y-1.5">
          <Label>Flower Season</Label>
          <Input value={fieldVal(form.flower_season)} onChange={e => f("flower_season", e.target.value)} placeholder="e.g. May-June" disabled={!form.flowering} data-testid="input-flower-season" />
        </div>
        <div className="space-y-1.5">
          <Label>Flower Color</Label>
          <Input value={fieldVal(form.flower_color)} onChange={e => f("flower_color", e.target.value)} placeholder="e.g. White" disabled={!form.flowering} data-testid="input-flower-color" />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={form.flowering ?? false} onCheckedChange={v => f("flowering", v)} data-testid="switch-flowering" />
          Flowering
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={form.deer_resistant ?? false} onCheckedChange={v => f("deer_resistant", v)} data-testid="switch-deer-resistant" />
          Deer Resistant
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={form.published ?? true} onCheckedChange={v => f("published", v)} data-testid="switch-published" />
          Published (visible to all)
        </label>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label>Known Pests & Issues</Label>
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
          value={fieldVal(form.known_pests_issues)}
          onChange={e => f("known_pests_issues", e.target.value)}
          placeholder="e.g. Aphids, scale insects…"
          data-testid="textarea-pests"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Special Notes</Label>
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
          value={fieldVal(form.special_notes)}
          onChange={e => f("special_notes", e.target.value)}
          placeholder="Landscape use, notable features…"
          data-testid="textarea-special-notes"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Maintenance Notes</Label>
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
          value={fieldVal(form.maintenance_notes)}
          onChange={e => f("maintenance_notes", e.target.value)}
          placeholder="Practical tips for the crew…"
          data-testid="textarea-maintenance"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="btn-cancel-plant-form">Cancel</Button>
        <Button type="submit" className="bg-green-600 hover:bg-green-700" data-testid="btn-save-plant-card">
          {isNew ? "Create Card" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PlantCards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCard, setEditCard] = useState<PlantCard | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const queryKey = isAdmin ? ["/api/plant-cards/all"] : ["/api/plant-cards"];
  const { data: cards = [], isLoading } = useQuery<PlantCard[]>({
    queryKey,
    queryFn: () => apiRequest("GET", isAdmin ? "/api/plant-cards/all" : "/api/plant-cards").then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/plant-cards", data).then(r => r.json()),
    onSuccess: (card: PlantCard) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards"] });
      toast({ title: `"${card.common_name}" card created` });
      setShowForm(false);
      setSelectedId(card.id);
    },
    onError: () => toast({ title: "Create failed", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/plant-cards/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards"] });
      toast({ title: "Card updated" });
      setEditCard(null);
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/plant-cards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards"] });
      toast({ title: "Card deleted" });
      setDeleteConfirmId(null);
      setSelectedId(null);
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const filtered = cards.filter(c => {
    if (typeFilter !== "all" && c.plant_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.common_name.toLowerCase().includes(q) || (c.botanical_name ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const selectedCard = cards.find(c => c.id === selectedId) ?? null;

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedCard && !editCard) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PlantCardDetail
          card={selectedCard}
          onBack={() => setSelectedId(null)}
          isAdmin={isAdmin}
          onEdit={() => setEditCard(selectedCard)}
        />
        {isAdmin && (
          <div className="mt-4 flex justify-end print:hidden">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirmId(selectedCard.id)}
              data-testid="btn-delete-plant-card"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete Card
            </Button>
          </div>
        )}

        <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete plant card?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMut.mutate(deleteConfirmId!)} data-testid="btn-confirm-delete">
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Edit form (overlay on detail) ─────────────────────────────────────────
  if (editCard) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setEditCard(null)} data-testid="btn-back-from-edit">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold">Edit: {editCard.common_name}</h1>
        </div>
        <PlantCardForm
          initial={editCard}
          isNew={false}
          onSave={data => updateMut.mutate({ id: editCard.id, data })}
          onCancel={() => setEditCard(null)}
        />
      </div>
    );
  }

  // ── List + Create ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" /> Plant Library
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {cards.length} cards · {filtered.length} showing
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700" data-testid="btn-new-plant-card">
            <Plus className="w-4 h-4 mr-1" /> New Plant Card
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plants…"
            className="pl-9"
            data-testid="input-search-plants"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44" data-testid="select-plant-type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PLANT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-24 bg-muted/40 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{cards.length === 0 ? "No plant cards yet" : "No matches"}</p>
          {isAdmin && cards.length === 0 && (
            <p className="text-sm mt-1">Create your first card using the AI tool above.</p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <PlantListCard key={c.id} card={c} onClick={() => setSelectedId(c.id)} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" /> New Plant Card
            </DialogTitle>
          </DialogHeader>
          <PlantCardForm
            initial={EMPTY_FORM}
            isNew
            onSave={data => createMut.mutate(data)}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
