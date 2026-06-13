import React, { useState, useRef, useCallback, useEffect } from "react";
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
  Printer, ArrowLeft, Image as ImageIcon, ChevronRight, Check, Pencil, Download
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

// ── Inline edit helpers ───────────────────────────────────────────────────────
function InlineText({ value, onSave, placeholder, isAdmin, testId }: {
  value: string; onSave: (v: string) => void; placeholder?: string; isAdmin: boolean; testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);
  if (!isAdmin) return <span>{value || <span className="text-muted-foreground/50 italic">—</span>}</span>;
  if (editing) return (
    <span className="flex items-center gap-1">
      <input
        ref={inputRef}
        className="border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white w-full"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { onSave(draft); setEditing(false); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        onBlur={() => { onSave(draft); setEditing(false); }}
        placeholder={placeholder}
        data-testid={testId}
      />
    </span>
  );
  return (
    <span className="group flex items-center gap-1 cursor-pointer" onClick={() => setEditing(true)}>
      <span>{value || <span className="text-muted-foreground/50 italic">Click to add…</span>}</span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
    </span>
  );
}

function InlineTextArea({ value, onSave, placeholder, isAdmin, testId }: {
  value: string; onSave: (v: string) => void; placeholder?: string; isAdmin: boolean; testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);
  if (!isAdmin) return <p className="text-sm leading-relaxed text-gray-700">{value || "—"}</p>;
  if (editing) return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={ref}
        className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[80px] bg-white"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        placeholder={placeholder}
        data-testid={testId}
      />
      <div className="flex gap-1">
        <button className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700" onClick={() => { onSave(draft); setEditing(false); }}>
          <Check className="w-3 h-3 inline mr-0.5" />Save
        </button>
        <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={() => { setDraft(value); setEditing(false); }}>
          Cancel
        </button>
      </div>
    </div>
  );
  return (
    <div className="group relative cursor-pointer" onClick={() => setEditing(true)}>
      <p className="text-sm leading-relaxed text-gray-700 pr-6">
        {value || <span className="text-muted-foreground/50 italic">Click to add…</span>}
      </p>
      <Pencil className="w-3 h-3 text-muted-foreground absolute top-0.5 right-0 opacity-0 group-hover:opacity-60 transition-opacity" />
    </div>
  );
}

function InlineSelect({ value, options, onSave, placeholder, isAdmin }: {
  value: string; options: string[]; onSave: (v: string) => void; placeholder?: string; isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) return; }, [editing]);
  if (!isAdmin) return <span>{value || "—"}</span>;
  if (editing) return (
    <Select value={value || ""} onValueChange={v => { onSave(v); setEditing(false); }}>
      <SelectTrigger className="h-7 text-sm" onBlur={() => setEditing(false)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  return (
    <span className="group flex items-center gap-1 cursor-pointer" onClick={() => setEditing(true)}>
      <span>{value || <span className="text-muted-foreground/50 italic">Click to set…</span>}</span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
    </span>
  );
}

function InlineBool({ value, label, onToggle, isAdmin }: {
  value: boolean; label: string; onToggle: () => void; isAdmin: boolean;
}) {
  if (!isAdmin) return value ? <Badge className="bg-green-100 text-green-800 border-green-200">{label}</Badge> : null;
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <Switch checked={value} onCheckedChange={onToggle} />
      <span className="text-sm text-white/90">{label}</span>
    </label>
  );
}

// ── Card Detail View ──────────────────────────────────────────────────────────
function PlantCardDetail({ card, onBack, isAdmin, onEdit }: {
  card: PlantCard; onBack: () => void; isAdmin: boolean; onEdit: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset edit mode whenever we're viewing a different card
  useEffect(() => { setEditMode(false); }, [card.id]);

  async function fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function downloadCard() {
    setIsDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = 0;

      // ── Green header band ──────────────────────────────────────────────────
      doc.setFillColor(20, 83, 45);
      doc.rect(0, 0, pageW, 52, "F");

      // Cover photo in top-right corner of header
      if (photos.length > 0) {
        try {
          const imgData = await fetchImageAsBase64(photos[0]);
          doc.addImage(imgData, "JPEG", pageW - margin - 42, 5, 42, 42, undefined, "FAST");
        } catch { /* skip on error */ }
      }

      // Plant name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      const nameLines = doc.splitTextToSize(card.common_name, contentW - 50);
      doc.text(nameLines, margin, 16);
      y = 16 + nameLines.length * 8;

      // Botanical name
      if (card.botanical_name) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(187, 247, 208);
        doc.text(card.botanical_name, margin, y + 1);
        y += 7;
      }

      // Badges row
      const badges: string[] = [
        card.plant_type,
        card.deciduous_evergreen,
        card.flowering ? "Flowering" : null,
        card.deer_resistant ? "Deer Resistant" : null,
      ].filter(Boolean) as string[];

      if (badges.length > 0) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        let bx = margin;
        badges.forEach(b => {
          const tw = doc.getTextWidth(b) + 6;
          doc.setFillColor(255, 255, 255, 0.18);
          doc.setDrawColor(255, 255, 255, 0.35);
          doc.roundedRect(bx, y + 2, tw, 6, 1, 1, "FD");
          doc.setTextColor(255, 255, 255);
          doc.text(b, bx + 3, y + 6.2);
          bx += tw + 3;
        });
      }

      y = 58;

      // ── Quick-facts grid ───────────────────────────────────────────────────
      const facts: [string, string][] = [
        ["Mature Size", card.mature_size ?? ""],
        ["Hardiness Zone", card.hardiness_zone ?? ""],
        ["Light", card.light_requirement ?? ""],
        ["Water Needs", card.water_needs ?? ""],
        ["Soil", card.soil_moisture ?? ""],
        ["Growth Rate", card.growth_rate ?? ""],
        ["Pruning", card.pruning_time ?? ""],
        ["Flower Season", card.flower_season ?? ""],
        ["Flower Color", card.flower_color ?? ""],
      ].filter(([, v]) => v) as [string, string][];

      if (facts.length > 0) {
        const cols = 3;
        const cellW = contentW / cols;
        const cellH = 14;
        facts.forEach(([label, val], i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = margin + col * cellW;
          const cy = y + row * (cellH + 2);
          doc.setFillColor(245, 247, 245);
          doc.roundedRect(cx, cy, cellW - 2, cellH, 1.5, 1.5, "F");
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(100, 100, 100);
          doc.text(label.toUpperCase(), cx + 3, cy + 5);
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 30, 30);
          doc.text(doc.splitTextToSize(val, cellW - 6)[0], cx + 3, cy + 10.5);
        });
        y += Math.ceil(facts.length / cols) * (cellH + 2) + 6;
      }

      // ── Text sections ──────────────────────────────────────────────────────
      const sections: [string, string | null][] = [
        ["About This Plant", card.special_notes ?? null],
        ["Maintenance Tips", card.maintenance_notes ?? null],
        ["Known Pests & Issues", card.known_pests_issues ?? null],
      ];

      for (const [title, content] of sections) {
        if (!content) continue;
        if (y > pageH - 35) { doc.addPage(); y = margin; }
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 101, 52);
        doc.text(title, margin, y);
        y += 4;
        doc.setDrawColor(22, 101, 52);
        doc.setLineWidth(0.3);
        doc.line(margin, y, margin + contentW, y);
        y += 4;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(content, contentW);
        for (const line of lines) {
          if (y > pageH - 15) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += 4.5;
        }
        y += 4;
      }

      // ── Photos ─────────────────────────────────────────────────────────────
      if (photos.length > 0) {
        if (y > pageH - 80) { doc.addPage(); y = margin; }
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 101, 52);
        doc.text("Photos", margin, y);
        y += 4;
        doc.setDrawColor(22, 101, 52);
        doc.setLineWidth(0.3);
        doc.line(margin, y, margin + contentW, y);
        y += 5;

        const imgCols = 3;
        const imgW = (contentW - (imgCols - 1) * 3) / imgCols;
        const imgH = imgW * 0.75;

        for (let i = 0; i < photos.length; i++) {
          const col = i % imgCols;
          const ix = margin + col * (imgW + 3);
          if (col === 0 && i > 0) y += imgH + 3;
          if (y + imgH > pageH - margin) { doc.addPage(); y = margin; }
          try {
            const imgData = await fetchImageAsBase64(photos[i]);
            doc.addImage(imgData, "JPEG", ix, y, imgW, imgH, undefined, "FAST");
          } catch { /* skip broken photos */ }
        }
      }

      doc.save(`${card.common_name.replace(/\s+/g, "-")}-plant-card.pdf`);
    } catch {
      toast({ title: "Download failed", description: "Could not generate PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }

  // Build the full payload for PUT (merges one field at a time)
  function cardPayload(overrides: Partial<PlantCard>) {
    const c = { ...card, ...overrides };
    return {
      commonName: c.common_name,
      botanicalName: c.botanical_name || null,
      plantType: c.plant_type || null,
      deciduousEvergreen: c.deciduous_evergreen || null,
      matureSize: c.mature_size || null,
      growthRate: c.growth_rate || null,
      hardinessZone: c.hardiness_zone || null,
      lightRequirement: c.light_requirement || null,
      soilMoisture: c.soil_moisture || null,
      waterNeeds: c.water_needs || null,
      deerResistant: c.deer_resistant ?? false,
      flowering: c.flowering ?? false,
      flowerSeason: c.flower_season || null,
      flowerColor: c.flower_color || null,
      pruningTime: c.pruning_time || null,
      knownPestsIssues: c.known_pests_issues || null,
      specialNotes: c.special_notes || null,
      maintenanceNotes: c.maintenance_notes || null,
      photos: c.photos ?? [],
      published: c.published ?? true,
    };
  }

  const patchCard = useMutation({
    mutationFn: async (overrides: Partial<PlantCard>) => {
      await apiRequest("PUT", `/api/plant-cards/${card.id}`, cardPayload(overrides));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plant-cards"] });
      toast({ title: "Saved", description: "Field updated successfully." });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

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

  function checkImageSize(file: File): Promise<{ ok: boolean; w: number; h: number }> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const shorter = Math.min(img.naturalWidth, img.naturalHeight);
        resolve({ ok: shorter >= 800, w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, w: 0, h: 0 }); };
      img.src = url;
    });
  }

  async function validateAndUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    const { ok, w, h } = await checkImageSize(file);
    if (!ok) {
      toast({
        title: "Image too small",
        description: `${file.name} is ${w}×${h}px — please use a photo that's at least 800px on the shorter side so it looks sharp when printed.`,
        variant: "destructive",
      });
      return;
    }
    uploadPhoto.mutate(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!isAdmin) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    files.forEach(f => validateAndUpload(f));
  }, [isAdmin, uploadPhoto]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(f => validateAndUpload(f));
    e.target.value = "";
  };

  const photos: string[] = card.photos ?? [];
  const coverPhoto = photos[0] ?? null;

  function patch(overrides: Partial<PlantCard>) { patchCard.mutate(overrides); }

  function printCard() {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    const photosArr: string[] = card.photos ?? [];
    const cover = photosArr[0] ?? null;

    const facts = [
      { label: "Mature Size", val: card.mature_size },
      { label: "Hardiness Zone", val: card.hardiness_zone },
      { label: "Light", val: card.light_requirement },
      { label: "Water Needs", val: card.water_needs },
      { label: "Soil", val: card.soil_moisture },
      { label: "Growth Rate", val: card.growth_rate },
      { label: "Pruning Time", val: card.pruning_time },
      card.flowering ? { label: "Flower Season", val: card.flower_season } : null,
      card.flowering ? { label: "Flower Color", val: card.flower_color } : null,
    ].filter((f): f is { label: string; val: string | null } => !!f && !!f.val);

    const factsHtml = facts.map(f => `
      <div class="fact-card">
        <div class="fact-label">${f.label}</div>
        <div class="fact-val">${f.val}</div>
      </div>`).join("");

    const badges = [
      card.plant_type, card.deciduous_evergreen,
      card.flowering ? "🌸 Flowering" : null,
      card.deer_resistant ? "🦌 Deer Resistant" : null,
    ].filter(Boolean);

    const badgesHtml = badges.map(b =>
      `<span class="badge">${b}</span>`).join("");

    const section = (title: string, content: string | null | undefined) => content ? `
      <div class="section">
        <h3>${title}</h3>
        <p>${content.replace(/\n/g, "<br/>")}</p>
      </div>` : "";

    const coverHtml = cover
      ? `<img src="${cover}" class="cover-img" />`
      : "";

    const photoPages = photosArr.map((url, i) => `
      <div class="photo-page">
        <img src="${url}" class="photo-full" />
        <div class="photo-caption">${card.common_name} — Photo ${i + 1} of ${photosArr.length}</div>
      </div>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${card.common_name} — Plant Care Guide</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;background:#fff;}
    @media print{
      @page{size:letter;margin:0;}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    }
    /* ── Card page ── */
    .card-page{width:100%;}
    .header{background:linear-gradient(to right,#166534,#16a34a);color:#fff;padding:32px 40px;display:flex;align-items:flex-start;gap:20px;}
    .header-text{flex:1;}
    .header h1{font-size:28px;font-weight:700;letter-spacing:-0.02em;margin-bottom:4px;}
    .botanical{font-style:italic;color:#bbf7d0;font-size:16px;margin-bottom:12px;}
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
    .badge{background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);border-radius:999px;padding:3px 10px;font-size:11px;color:#fff;}
    .cover-img{width:100px;height:100px;object-fit:cover;border-radius:8px;border:2px solid rgba(255,255,255,0.3);flex-shrink:0;}
    .body{padding:32px 40px;}
    .facts-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;}
    .fact-card{background:#f0fdf4;border:1px solid #d1fae5;border-radius:6px;padding:10px 12px;}
    .fact-label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:4px;}
    .fact-val{font-size:13px;font-weight:600;color:#111827;}
    .section{margin-bottom:20px;}
    .section h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;}
    .section p{font-size:13px;color:#1f2937;line-height:1.65;}
    .footer{border-top:1px solid #e5e7eb;margin-top:24px;padding-top:14px;font-size:10px;color:#9ca3af;text-align:center;}
    /* ── Photo pages ── */
    .photo-page{width:100%;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.4in;page-break-before:always;break-before:page;}
    .photo-full{max-width:100%;max-height:calc(100vh - 1.2in);width:100%;height:calc(100vh - 1.2in);object-fit:contain;}
    .photo-caption{font-size:10px;color:#9ca3af;margin-top:10px;text-align:center;}
  </style>
</head>
<body>
  <div class="card-page">
    <div class="header">
      <div class="header-text">
        <h1>${card.common_name}</h1>
        ${card.botanical_name ? `<div class="botanical">${card.botanical_name}</div>` : ""}
        <div class="badges">${badgesHtml}</div>
      </div>
      ${coverHtml}
    </div>
    <div class="body">
      ${facts.length > 0 ? `<div class="facts-grid">${factsHtml}</div>` : ""}
      ${section("About This Plant", card.special_notes)}
      ${section("Maintenance Tips", card.maintenance_notes)}
      ${section("Known Pests & Issues", card.known_pests_issues)}
      <div class="footer">Chapin Landscapes · Plant Care Guide · ${card.common_name}${card.botanical_name ? ` (${card.botanical_name})` : ""} · Printed ${new Date().toLocaleDateString()}</div>
    </div>
  </div>
  ${photoPages}
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    // Small delay so images finish loading before the print dialog opens
    setTimeout(() => win.print(), 800);
  }

  return (
    <div className="max-w-4xl mx-auto" data-testid="plant-card-detail">
      {/* Back bar */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="btn-back-plant-cards">
          <ArrowLeft className="w-4 h-4 mr-1" /> All Plants
        </Button>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 border text-xs font-medium transition-colors ${
                editMode
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-muted/50 border-border text-muted-foreground"
              }`}
            >
              <Switch
                checked={editMode}
                onCheckedChange={setEditMode}
                data-testid="toggle-edit-mode"
              />
              <span>{editMode ? "Editing" : "Read Only"}</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={printCard} data-testid="btn-print-plant-card">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* ── Printable card starts here ── */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none">
        {/* Header band */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white px-8 py-6 print:px-6 print:py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              {/* Common name */}
              <h1 className="text-3xl font-bold tracking-tight print:text-2xl" data-testid="plant-card-common-name">
                {isAdmin && editMode ? (
                  <span className="group flex items-center gap-2">
                    <EditableHeader
                      value={card.common_name}
                      onSave={v => patch({ common_name: v })}
                      className="text-3xl font-bold bg-transparent border-0 border-b border-white/30 focus:border-white text-white placeholder-white/50 outline-none w-full"
                    />
                  </span>
                ) : card.common_name}
              </h1>
              {/* Botanical name */}
              <p className="italic text-green-200 text-lg mt-0.5">
                {isAdmin && editMode ? (
                  <EditableHeader
                    value={card.botanical_name ?? ""}
                    onSave={v => patch({ botanical_name: v })}
                    placeholder="Botanical name…"
                    className="italic text-green-200 bg-transparent border-0 border-b border-white/20 focus:border-white/60 outline-none w-full placeholder-white/30 text-lg"
                  />
                ) : card.botanical_name}
              </p>
              {/* Badges row */}
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                {isAdmin && editMode ? (
                  <>
                    <InlineSelect
                      value={card.plant_type ?? ""}
                      options={PLANT_TYPES}
                      onSave={v => patch({ plant_type: v })}
                      placeholder="Type…"
                      isAdmin={true}
                    />
                    <InlineSelect
                      value={card.deciduous_evergreen ?? ""}
                      options={["Deciduous", "Evergreen", "Semi-Evergreen"]}
                      onSave={v => patch({ deciduous_evergreen: v })}
                      placeholder="Dec/Evg…"
                      isAdmin={true}
                    />
                    <InlineBool value={card.flowering} label="🌸 Flowering" onToggle={() => patch({ flowering: !card.flowering })} isAdmin={true} />
                    <InlineBool value={card.deer_resistant} label="🦌 Deer Resistant" onToggle={() => patch({ deer_resistant: !card.deer_resistant })} isAdmin={true} />
                  </>
                ) : (
                  <>
                    {card.plant_type && <Badge className="bg-white/20 text-white border-white/30">{card.plant_type}</Badge>}
                    {card.deciduous_evergreen && <Badge className="bg-white/20 text-white border-white/30">{card.deciduous_evergreen}</Badge>}
                    {card.flowering && <Badge className="bg-green-100 text-green-800 border-green-200">🌸 Flowering</Badge>}
                    {card.deer_resistant && <Badge className="bg-green-100 text-green-800 border-green-200">🦌 Deer Resistant</Badge>}
                  </>
                )}
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

        {/* ── Download strip ── */}
        <div className="border-b bg-green-50 px-8 py-3 flex items-center justify-between print:hidden">
          <p className="text-xs text-green-700">
            Save a full copy of this plant card including all photos to your device.
          </p>
          <Button
            onClick={downloadCard}
            disabled={isDownloading}
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white shrink-0 gap-1.5"
            data-testid="btn-download-plant-card"
          >
            {isDownloading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Generating PDF…
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Download Plant Card
              </>
            )}
          </Button>
        </div>

        <div className="p-8 print:p-6 space-y-6">
          {/* Quick-facts grid — all inline-editable */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[
              { icon: Ruler, label: "Mature Size", field: "mature_size" as keyof PlantCard, type: "text", val: card.mature_size, placeholder: "e.g. 20-30 ft tall" },
              { icon: Thermometer, label: "Hardiness Zone", field: "hardiness_zone" as keyof PlantCard, type: "text", val: card.hardiness_zone, placeholder: "e.g. 4-8" },
              { icon: Sun, label: "Light", field: "light_requirement" as keyof PlantCard, type: "select", options: ["Full Sun", "Part Sun", "Part Shade", "Full Shade", "Adaptable"], val: card.light_requirement },
              { icon: Droplets, label: "Water Needs", field: "water_needs" as keyof PlantCard, type: "select", options: ["Low", "Moderate", "High"], val: card.water_needs },
              { icon: Leaf, label: "Soil", field: "soil_moisture" as keyof PlantCard, type: "text", val: card.soil_moisture, placeholder: "e.g. Well-drained" },
              { icon: ChevronRight, label: "Growth Rate", field: "growth_rate" as keyof PlantCard, type: "select", options: ["Slow", "Moderate", "Fast"], val: card.growth_rate },
              { icon: Scissors, label: "Pruning", field: "pruning_time" as keyof PlantCard, type: "text", val: card.pruning_time, placeholder: "e.g. Late winter" },
              { icon: Star, label: "Flower Season", field: "flower_season" as keyof PlantCard, type: "text", val: card.flower_season, placeholder: "e.g. May-June" },
              { icon: Star, label: "Flower Color", field: "flower_color" as keyof PlantCard, type: "text", val: card.flower_color, placeholder: "e.g. White" },
            ].filter(f => f.val || (isAdmin && editMode)).map(({ icon: Icon, label, field, type, val, options, placeholder }: any) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1 print:bg-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <div className="text-sm font-medium">
                  {type === "select"
                    ? <InlineSelect value={val ?? ""} options={options} onSave={v => patch({ [field]: v } as any)} isAdmin={isAdmin && editMode} />
                    : <InlineText value={val ?? ""} onSave={v => patch({ [field]: v } as any)} placeholder={placeholder} isAdmin={isAdmin && editMode} />
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Published toggle — admin only, edit mode only */}
          {isAdmin && editMode && (
            <div className="flex items-center gap-2 py-1 border-t pt-4">
              <Switch checked={card.published} onCheckedChange={v => patch({ published: v })} />
              <span className="text-sm">{card.published ? "Published — visible to all users" : "Draft — hidden from non-admins"}</span>
            </div>
          )}

          {/* Special Notes */}
          {(card.special_notes || (isAdmin && editMode)) && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Leaf className="w-4 h-4" /> About This Plant
              </h3>
              <InlineTextArea
                value={card.special_notes ?? ""}
                onSave={v => patch({ special_notes: v })}
                placeholder="Notable features, landscape uses…"
                isAdmin={isAdmin && editMode}
                testId="textarea-special-notes-inline"
              />
            </div>
          )}

          {/* Maintenance Notes */}
          {(card.maintenance_notes || (isAdmin && editMode)) && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Scissors className="w-4 h-4" /> Maintenance Tips
              </h3>
              <InlineTextArea
                value={card.maintenance_notes ?? ""}
                onSave={v => patch({ maintenance_notes: v })}
                placeholder="Practical tips for the crew…"
                isAdmin={isAdmin && editMode}
                testId="textarea-maintenance-inline"
              />
            </div>
          )}

          {/* Pests / Issues */}
          {(card.known_pests_issues || (isAdmin && editMode)) && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Bug className="w-4 h-4" /> Known Pests & Issues
              </h3>
              <InlineTextArea
                value={card.known_pests_issues ?? ""}
                onSave={v => patch({ known_pests_issues: v })}
                placeholder="e.g. Aphids, scale insects…"
                isAdmin={isAdmin && editMode}
                testId="textarea-pests-inline"
              />
            </div>
          )}

          {/* Photo gallery */}
          {(photos.length > 0 || (isAdmin && editMode)) && (
            <div className="print:break-inside-avoid">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Photos
              </h3>
              <div
                className={[
                  "grid grid-cols-3 sm:grid-cols-4 gap-2",
                  isAdmin && editMode && dragOver ? "ring-2 ring-green-400 ring-offset-2 rounded-lg" : "",
                ].join(" ")}
                onDragOver={isAdmin && editMode ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
                onDragLeave={isAdmin && editMode ? () => setDragOver(false) : undefined}
                onDrop={isAdmin && editMode ? handleDrop : undefined}
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
                    {isAdmin && editMode && (
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

                {isAdmin && editMode && (
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

              {isAdmin && editMode && (
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

// Simple editable header that renders as a styled input
function EditableHeader({ value, onSave, placeholder, className }: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      className={className}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft); }}
      onKeyDown={e => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
      placeholder={placeholder}
    />
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
      {/* Thumbnail — always the same size */}
      {photo ? (
        <img src={photo} alt={card.common_name} className="w-16 h-16 object-cover rounded-md shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-md bg-green-50 flex items-center justify-center shrink-0">
          <Leaf className="w-7 h-7 text-green-300" />
        </div>
      )}

      {/* Text block — always renders the same three rows */}
      <div className="flex-1 min-w-0">
        {/* Row 1: common name + draft badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-sm truncate">{card.common_name}</span>
          {!card.published && <Badge variant="destructive" className="text-xs shrink-0">Draft</Badge>}
        </div>

        {/* Row 2: botanical name — always present, placeholder when empty */}
        <div className="italic text-xs text-muted-foreground truncate mt-0.5">
          {card.botanical_name || <span className="not-italic text-muted-foreground/50">No botanical name</span>}
        </div>

        {/* Row 3: three fixed property chips — always shown */}
        <div className="flex gap-1 mt-1.5">
          <Badge variant="secondary" className="text-xs">
            {card.plant_type || "—"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {card.light_requirement || "—"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {card.hardiness_zone ? `Zone ${card.hardiness_zone}` : "Zone —"}
          </Badge>
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
  const [aiHasFilled, setAiHasFilled] = useState(!isNew);
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
      setAiHasFilled(true);
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
          <p className="text-sm font-medium text-green-800">AI Auto-Fill {isNew && !aiHasFilled && <span className="text-green-600 font-normal">(required to create card)</span>}</p>
          <p className="text-xs text-green-700 mt-0.5">Type the common or botanical name below and press <kbd className="px-1 py-0.5 bg-green-100 border border-green-300 rounded text-xs">Enter</kbd> — AI will fill the card automatically.</p>
        </div>
        <Button type="button" size="sm" onClick={generate} disabled={generating} className="bg-green-600 hover:bg-green-700 shrink-0" data-testid="btn-ai-generate">
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          {generating ? "Generating…" : "Generate"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Common Name *</Label>
          <Input
            value={fieldVal(form.common_name)}
            onChange={e => f("common_name", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generate(); } }}
            placeholder="e.g. Red Maple — press Enter to auto-fill"
            data-testid="input-common-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Botanical Name</Label>
          <Input
            value={fieldVal(form.botanical_name)}
            onChange={e => f("botanical_name", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generate(); } }}
            placeholder="e.g. Acer rubrum — press Enter to auto-fill"
            data-testid="input-botanical-name"
          />
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
        <Button
          type="submit"
          className="bg-green-600 hover:bg-green-700"
          disabled={isNew && !aiHasFilled}
          title={isNew && !aiHasFilled ? "Type a plant name and press Enter to auto-fill before saving" : undefined}
          data-testid="btn-save-plant-card"
        >
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
