import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { CustomerResource } from "@shared/schema";
import {
  HelpCircle,
  Map,
  Clock,
  ShieldCheck,
  ArrowRight,
  PlayCircle,
  Plus,
  Edit,
  Trash2,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Leaf,
  FileUp,
  Loader2,
  Upload,
  CheckCircle2,
  X,
  Download,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  ListChecks,
  FileCheck,
} from "lucide-react";

// ── Section category config ───────────────────────────────────────────────────
const SECTION_CATEGORIES = [
  {
    key: "Care Guides",
    label: "Care Guides",
    description: "Seasonal and ongoing care guides we create",
    icon: Leaf,
    color: "text-emerald-600",
    defaultType: "guide",
  },
  {
    key: "Manufacturer Info",
    label: "Manufacturer Info",
    description: "Product manuals, specs, and warranty documents",
    icon: BookOpen,
    color: "text-blue-600",
    defaultType: "document",
  },
  {
    key: "Professional Documents",
    label: "Professional Documents",
    description: "Contracts, assessments, and signed agreements",
    icon: FileCheck,
    color: "text-amber-600",
    defaultType: "document",
  },
  {
    key: "Seasonal Checklists",
    label: "Seasonal Checklists",
    description: "Step-by-step seasonal resources and checklists",
    icon: ListChecks,
    color: "text-purple-600",
    defaultType: "guide",
  },
] as const;

type SectionKey = typeof SECTION_CATEGORIES[number]["key"];

const SEASONS = ["N/A", "Spring", "Summer", "Fall", "Year-Round"] as const;

const SEASON_COLORS: Record<string, string> = {
  Spring: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  Summer: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  Fall: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  "Year-Round": "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
};

const FILE_BADGE_COLORS: Record<string, string> = {
  PDF: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  DOC: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  XLS: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  LIST: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
  GUIDE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  FILE: "bg-muted text-muted-foreground",
};

function getFileBadge(resource: CustomerResource): string {
  if (resource.fileUrl || resource.fileName) {
    const name = resource.fileName || resource.fileUrl || "";
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "PDF";
    if (ext === "doc" || ext === "docx") return "DOC";
    if (ext === "xls" || ext === "xlsx") return "XLS";
    return "FILE";
  }
  if (resource.category === "Seasonal Checklists") return "LIST";
  return "GUIDE";
}

// ── Presigned-URL upload helper ───────────────────────────────────────────────
async function uploadFileToStorage(file: File): Promise<{ url: string; fileName: string }> {
  const urlRes = await fetch("/api/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!urlRes.ok) throw new Error("Could not get upload URL");
  const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) throw new Error("File upload to storage failed");
  return { url: objectPath, fileName: file.name };
}

// ── File Drop Zone ────────────────────────────────────────────────────────────
// Uses native DOM listeners (not React synthetic events) so it works correctly
// inside Radix UI dialog portals, which render outside the React root element.
function FileDropZone({
  onFile,
  uploading,
  currentFileName,
  onClear,
}: {
  onFile: (file: File) => void;
  uploading: boolean;
  currentFileName?: string;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const onFileRef = useRef(onFile);
  useEffect(() => { onFileRef.current = onFile; }, [onFile]);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) onFileRef.current(file);
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  if (currentFileName) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/40">
        <FileUp className="w-5 h-5 text-muted-foreground shrink-0" />
        <span className="text-sm flex-1 truncate">{currentFileName}</span>
        {onClear && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 w-6 p-0">
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={dropRef}
      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Uploading…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Drop a file here or click to browse</p>
          <p className="text-xs text-muted-foreground">PDF, Word, Excel, and other documents accepted</p>
        </div>
      )}
    </div>
  );
}

// ── Resource Card (new design) ────────────────────────────────────────────────
function ResourceCard({
  resource,
  isAdmin,
  isSaved,
  onView,
  onEdit,
  onDelete,
  onToggleSave,
}: {
  resource: CustomerResource;
  isAdmin: boolean;
  isSaved: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSave: () => void;
}) {
  const badge = getFileBadge(resource);
  const season = (resource as any).season as string | undefined;

  return (
    <Card
      className="flex flex-col hover:shadow-md transition-shadow"
      data-testid={`resource-card-${resource.id}`}
    >
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        {/* Top: file badge + draft badge + bookmark */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded font-mono tracking-wide ${FILE_BADGE_COLORS[badge] ?? FILE_BADGE_COLORS.FILE}`}
          >
            {badge}
          </span>
          {!resource.isPublished && (
            <Badge variant="secondary" className="text-xs">Draft</Badge>
          )}
          <button
            className="ml-auto text-muted-foreground hover:text-primary transition-colors"
            onClick={onToggleSave}
            data-testid={`save-resource-${resource.id}`}
            title={isSaved ? "Remove bookmark" : "Bookmark"}
          >
            {isSaved
              ? <BookmarkCheck className="w-4 h-4 text-primary" />
              : <Bookmark className="w-4 h-4" />}
          </button>
        </div>

        {/* Title + description */}
        <div className="cursor-pointer flex-1" onClick={onView}>
          <h3 className="font-semibold leading-snug line-clamp-2 hover:text-primary transition-colors text-sm">
            {resource.title}
          </h3>
          {resource.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {resource.description}
            </p>
          )}
        </div>

        {/* Footer: season + date + actions */}
        <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
          {season && season !== "N/A" && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEASON_COLORS[season] ?? ""}`}>
              {season}
            </span>
          )}
          {resource.createdAt && (
            <span className="text-xs text-muted-foreground">
              {format(new Date(resource.createdAt), "MMM d, yyyy")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            {resource.fileUrl && (
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Open file">
                <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView} title="View">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onDelete}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Our Process collapsible section ──────────────────────────────────────────
function OurProcessSection({ t }: { t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);

  const faqData = [
    { q: "How long does a typical installation take?", a: "Residential projects usually take 1–2 weeks depending on scope and weather." },
    { q: "What is your warranty policy?", a: "We offer a 2-year warranty on all hardscape installations and a 1-year plant health guarantee." },
    { q: "Do I need to be home for the maintenance crew?", a: "No, as long as we have access to gates and any pets are inside." },
    { q: "When should I water new sod?", a: "Twice daily for the first two weeks, then gradually reduce to deep watering every 2–3 days." },
    { q: "How often should I fertilize my lawn?", a: "Four times per year: early spring, late spring, summer, and fall." },
  ];

  const steps = [
    { title: t("education.consultation"), icon: HelpCircle, desc: t("education.consultationDesc") },
    { title: t("education.design"), icon: Map, desc: t("education.designDesc") },
    { title: t("education.install"), icon: ShieldCheck, desc: t("education.installDesc") },
    { title: t("education.maintain"), icon: Clock, desc: t("education.maintainDesc") },
  ];

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid="our-process-toggle"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <p className="font-semibold text-sm">Our Process & FAQ</p>
            <p className="text-xs text-muted-foreground">How we work, what to expect, and common questions</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t p-6 space-y-8 bg-muted/20">
          {/* 4-step process */}
          <div>
            <h2 className="text-lg font-heading font-bold mb-4">{t("education.ourProcess")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="relative p-5 bg-card border rounded-xl space-y-2">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <h3 className="font-heading font-bold text-sm">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    {i < 3 && (
                      <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 w-5 h-5" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day 1 card */}
          <Card className="bg-primary text-primary-foreground overflow-hidden">
            <div className="md:flex">
              <div className="p-6 md:w-1/2 space-y-3">
                <h2 className="text-2xl font-heading font-bold">What to expect on Day 1</h2>
                <p className="text-primary-foreground/80 text-sm leading-relaxed">
                  Our crew will arrive between 7:30–8:00 AM. We'll start with a site walkthrough and
                  material staging. Expect some noise and heavy equipment — it's all part of the magic!
                </p>
                <Button variant="secondary" className="gap-2" size="sm">
                  <PlayCircle className="w-4 h-4" /> Watch Onboarding Video
                </Button>
              </div>
              <div className="md:w-1/2 bg-black/20 min-h-[140px] flex items-center justify-center">
                <PlayCircle className="w-10 h-10 opacity-50" />
              </div>
            </div>
          </Card>

          {/* FAQ */}
          <div className="space-y-2 max-w-3xl">
            <h2 className="text-lg font-heading font-bold mb-3">Frequently Asked Questions</h2>
            {faqData.map((item, i) => (
              <Card key={i}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">{item.q}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Education() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === "Admin" || currentUser?.role === "Manager";

  const [activeCategory, setActiveCategory] = useState<"all" | SectionKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({});

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<CustomerResource | null>(null);
  const [viewingResource, setViewingResource] = useState<CustomerResource | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [hasFile, setHasFile] = useState(false);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  const defaultForm = {
    title: "",
    description: "",
    type: "guide",
    category: "Care Guides" as SectionKey,
    season: "N/A",
    content: "",
    fileUrl: "",
    fileName: "",
    isPublished: true,
  };
  const [formData, setFormData] = useState(defaultForm);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: resources = [] } = useQuery<CustomerResource[]>({ queryKey: ["/api/resources"] });
  const { data: savedResources = [] } = useQuery<{ resourceId: string }[]>({ queryKey: ["/api/saved-resources"] });
  const savedIds = new Set(savedResources.map((s) => s.resourceId));

  // ── Filtering ────────────────────────────────────────────────────────────────
  const allVisible = resources.filter((r) => r.isPublished || isAdmin);

  const filtered = allVisible.filter((r) => {
    if (savedOnly && !savedIds.has(r.id)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const byCategory: Record<string, CustomerResource[]> = {};
  SECTION_CATEGORIES.forEach((cat) => {
    byCategory[cat.key] = filtered.filter((r) => r.category === cat.key);
  });

  const activeItems =
    activeCategory === "all" ? filtered : byCategory[activeCategory] ?? [];

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setEditDialogOpen(false);
      setFormData(defaultForm);
      setEditingResource(null);
      setHasFile(false);
      toast({ title: "Resource created successfully" });
    },
    onError: (e: any) => toast({ title: "Failed to create", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setEditDialogOpen(false);
      setFormData(defaultForm);
      setEditingResource(null);
      setHasFile(false);
      toast({ title: "Resource updated" });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resources/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      toast({ title: "Resource deleted" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/saved-resources/${id}`, { method: "POST", credentials: "include" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-resources"] }),
  });

  const unsaveMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/saved-resources/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-resources"] }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openCreate = (category: SectionKey = "Care Guides") => {
    const catCfg = SECTION_CATEGORIES.find((c) => c.key === category);
    const defaultsToFile = catCfg?.defaultType === "document";
    setEditingResource(null);
    setHasFile(defaultsToFile);
    setFormData({ ...defaultForm, category, type: defaultsToFile ? "document" : "guide" });
    setEditDialogOpen(true);
  };

  const openEdit = (resource: CustomerResource) => {
    setEditingResource(resource);
    const resourceHasFile = !!(resource.fileUrl);
    setHasFile(resourceHasFile);
    setFormData({
      title: resource.title,
      description: resource.description || "",
      type: resource.type,
      category: (resource.category as SectionKey) || "Care Guides",
      season: (resource as any).season || "N/A",
      content: resource.content || "",
      fileUrl: resource.fileUrl || "",
      fileName: resource.fileName || "",
      isPublished: resource.isPublished,
    });
    setEditDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (hasFile && !formData.fileUrl) {
      toast({ title: "Please upload a file before saving", variant: "destructive" });
      return;
    }
    const payload = { ...formData, type: hasFile ? "document" : "guide" };
    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploadingFile(true);
      try {
        const { url, fileName } = await uploadFileToStorage(file);
        setFormData((prev) => ({ ...prev, fileUrl: url, fileName }));
        toast({ title: "File uploaded — fill in the details and save" });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      } finally {
        setIsUploadingFile(false);
      }
    },
    [toast],
  );

  const toggleSave = (id: string) => {
    savedIds.has(id) ? unsaveMutation.mutate(id) : saveMutation.mutate(id);
  };

  const toggleShowAll = (cat: string) => {
    setShowAllMap((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Category filter bar ───────────────────────────────────────────────────────
  const CategoryBar = () => (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setActiveCategory("all")}
        data-testid="filter-all"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          activeCategory === "all"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card border-border hover:bg-muted"
        }`}
      >
        All Resources
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
            activeCategory === "all" ? "bg-white/20" : "bg-muted"
          }`}
        >
          {allVisible.length}
        </span>
      </button>

      {SECTION_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const count = allVisible.filter((r) => r.category === cat.key).length;
        const isActive = activeCategory === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            data-testid={`filter-${cat.key.toLowerCase().replace(/\s+/g, "-")}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-muted"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {cat.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? "bg-white/20" : "bg-muted"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );

  // ── Category section block ───────────────────────────────────────────────────
  const CategorySection = ({ catKey }: { catKey: SectionKey }) => {
    const cat = SECTION_CATEGORIES.find((c) => c.key === catKey)!;
    const Icon = cat.icon;
    const items = byCategory[catKey] ?? [];
    const isExpanded = showAllMap[catKey];
    const displayed = isExpanded ? items : items.slice(0, 4);

    if (items.length === 0 && !isAdmin) return null;

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${cat.color}`} />
            <h2 className="font-heading font-semibold text-base">{cat.label}</h2>
            <span className="text-sm text-muted-foreground">({items.length})</span>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 text-xs ml-1 px-2"
                onClick={() => openCreate(catKey)}
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            )}
          </div>
          {items.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-7"
              onClick={() => toggleShowAll(catKey)}
            >
              {isExpanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <>View all {items.length} <ChevronRight className="w-3 h-3" /></>
              )}
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
            <Icon className={`w-8 h-8 mx-auto mb-2 opacity-25 ${cat.color}`} />
            <p className="text-sm font-medium">No {cat.label.toLowerCase()} yet</p>
            <p className="text-xs mt-1 text-muted-foreground/70">{cat.description}</p>
            {isAdmin && (
              <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => openCreate(catKey)}>
                <Plus className="w-3 h-3" /> Add the first one
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayed.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                isAdmin={isAdmin}
                isSaved={savedIds.has(r.id)}
                onView={() => { setViewingResource(r); setViewDialogOpen(true); }}
                onEdit={() => openEdit(r)}
                onDelete={() => { if (confirm("Delete this resource?")) deleteMutation.mutate(r.id); }}
                onToggleSave={() => toggleSave(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="page-title">
            {t("education.pageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("education.pageSubtitle")}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => openCreate()} className="gap-2 shrink-0" data-testid="upload-resource-btn">
            <Upload className="w-4 h-4" /> Upload Resource
          </Button>
        )}
      </div>

      {/* ── Category filter bar ─────────────────────────────────────────────── */}
      <CategoryBar />

      {/* ── Search + saved toggle ───────────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search resources…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-resources"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant={savedOnly ? "default" : "outline"}
          className="gap-2 shrink-0"
          onClick={() => setSavedOnly(!savedOnly)}
          data-testid="toggle-saved-only"
        >
          {savedOnly ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          Saved
          {savedIds.size > 0 && (
            <span className="text-xs opacity-70">({savedIds.size})</span>
          )}
        </Button>
      </div>

      {/* ── Content area ───────────────────────────────────────────────────────── */}
      {activeCategory === "all" ? (
        <div className="space-y-10">
          {SECTION_CATEGORIES.map((cat) => (
            <CategorySection key={cat.key} catKey={cat.key} />
          ))}

          {filtered.length === 0 && (searchQuery || savedOnly) && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No resources found</p>
              <p className="text-sm mt-1">
                {savedOnly
                  ? "You haven't saved any resources yet. Bookmark items using the icon on each card."
                  : `No results for "${searchQuery}"`}
              </p>
              {savedOnly && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setSavedOnly(false)}>
                  Show all resources
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Single category view ─────────────────────────────────────────── */
        (() => {
          const cat = SECTION_CATEGORIES.find((c) => c.key === activeCategory)!;
          const Icon = cat.icon;
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${cat.color}`} />
                  <h2 className="font-heading font-semibold text-base">{cat.label}</h2>
                  <span className="text-sm text-muted-foreground">({activeItems.length})</span>
                </div>
                {isAdmin && (
                  <Button size="sm" className="gap-2" onClick={() => openCreate(activeCategory)}>
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                )}
              </div>

              {activeItems.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-14 text-center text-muted-foreground">
                  <Icon className={`w-10 h-10 mx-auto mb-3 opacity-20 ${cat.color}`} />
                  <p className="font-semibold">
                    {searchQuery || savedOnly ? "No results" : `No ${cat.label.toLowerCase()} yet`}
                  </p>
                  <p className="text-sm mt-1">{cat.description}</p>
                  {isAdmin && !searchQuery && !savedOnly && (
                    <Button size="sm" variant="outline" className="mt-4 gap-1" onClick={() => openCreate(activeCategory)}>
                      <Plus className="w-3 h-3" /> Add the first one
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeItems.map((r) => (
                    <ResourceCard
                      key={r.id}
                      resource={r}
                      isAdmin={isAdmin}
                      isSaved={savedIds.has(r.id)}
                      onView={() => { setViewingResource(r); setViewDialogOpen(true); }}
                      onEdit={() => openEdit(r)}
                      onDelete={() => { if (confirm("Delete this resource?")) deleteMutation.mutate(r.id); }}
                      onToggleSave={() => toggleSave(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* ── Our Process (collapsible) ───────────────────────────────────────── */}
      <OurProcessSection t={t} />

      {/* ── Create / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) { setFormData(defaultForm); setEditingResource(null); setHasFile(false); }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingResource ? `Edit: ${editingResource.title}` : "Add Resource"}
            </DialogTitle>
            <DialogDescription>
              Fill in the details below. Choose a category, add a file or write content, and set visibility.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="grid grid-cols-2 gap-2">
                {SECTION_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = formData.category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        const defaultsToFile = cat.defaultType === "document";
                        setHasFile(defaultsToFile);
                        setFormData((p) => ({
                          ...p,
                          category: cat.key,
                          type: defaultsToFile ? "document" : "guide",
                          fileUrl: defaultsToFile ? p.fileUrl : "",
                          fileName: defaultsToFile ? p.fileName : "",
                        }));
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${cat.color}`} />
                      <span className="leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <button
                type="button"
                role="switch"
                aria-checked={hasFile}
                onClick={() => {
                  setHasFile(!hasFile);
                  if (hasFile) setFormData((p) => ({ ...p, fileUrl: "", fileName: "" }));
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  hasFile ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hasFile ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <div>
                <p className="text-sm font-medium">Has file attachment</p>
                <p className="text-xs text-muted-foreground">
                  {hasFile ? "Upload a PDF, Word doc, or other file" : "Write content directly in this form"}
                </p>
              </div>
            </div>

            {/* File upload or content */}
            {hasFile ? (
              <div className="space-y-2">
                <Label>File {!editingResource && <span className="text-destructive">*</span>}</Label>
                <FileDropZone
                  onFile={handleFile}
                  uploading={isUploadingFile}
                  currentFileName={formData.fileName || undefined}
                  onClear={() => setFormData((p) => ({ ...p, fileUrl: "", fileName: "" }))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Write the full content here. Use ## for headings, - for bullet points, **bold** for emphasis."
                  rows={10}
                  className="font-mono text-sm leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  Supports basic markdown: <code>## Heading</code> · <code>- bullet</code> · <code>**bold**</code>
                </p>
              </div>
            )}

            {/* Title + Season */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Spring Lawn Awakening Guide"
                  data-testid="resource-title-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Season</Label>
                <Select value={formData.season} onValueChange={(v) => setFormData((p) => ({ ...p, season: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short description customers will see on the card"
                rows={2}
              />
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={formData.isPublished ? "published" : "draft"}
                onValueChange={(v) => setFormData((p) => ({ ...p, isPublished: v === "published" }))}
              >
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published — visible to customers</SelectItem>
                  <SelectItem value="draft">Draft — only visible to admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving || isUploadingFile} data-testid="save-resource-btn">
              {isUploadingFile ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
              ) : isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : editingResource ? (
                "Save Changes"
              ) : (
                "Create Resource"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingResource && (() => {
            const badge = getFileBadge(viewingResource);
            const season = (viewingResource as any).season as string | undefined;
            const cat = SECTION_CATEGORIES.find((c) => c.key === viewingResource.category);
            const CatIcon = cat?.icon ?? FileUp;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <CatIcon className={`w-5 h-5 ${cat?.color ?? "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <DialogTitle className="text-xl leading-tight">{viewingResource.title}</DialogTitle>
                        <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${FILE_BADGE_COLORS[badge] ?? FILE_BADGE_COLORS.FILE}`}>
                            {badge}
                          </span>
                          {cat && <Badge variant="outline" className="text-xs">{cat.label}</Badge>}
                          {season && season !== "N/A" && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEASON_COLORS[season] ?? ""}`}>
                              {season}
                            </span>
                          )}
                          {!viewingResource.isPublished && (
                            <Badge variant="secondary" className="text-xs">Draft</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0 mt-1"
                      onClick={() => toggleSave(viewingResource.id)}
                      title={savedIds.has(viewingResource.id) ? "Remove bookmark" : "Bookmark"}
                    >
                      {savedIds.has(viewingResource.id)
                        ? <BookmarkCheck className="w-5 h-5 text-primary" />
                        : <Bookmark className="w-5 h-5" />}
                    </button>
                  </div>
                  {viewingResource.description && (
                    <DialogDescription className="mt-2 text-sm leading-relaxed">
                      {viewingResource.description}
                    </DialogDescription>
                  )}
                </DialogHeader>

                <div className="py-4">
                  {viewingResource.fileUrl ? (
                    <div className="flex flex-col items-center gap-5 py-10 border rounded-xl bg-muted/30">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileUp className="w-8 h-8 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{viewingResource.fileName || "Document"}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Click to open or download this file</p>
                      </div>
                      <div className="flex gap-3">
                        <Button asChild>
                          <a href={viewingResource.fileUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" /> Open File
                          </a>
                        </Button>
                        <Button variant="outline" asChild>
                          <a href={viewingResource.fileUrl} download={viewingResource.fileName || undefined}>
                            <Download className="w-4 h-4 mr-2" /> Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : viewingResource.content ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed">
                      {viewingResource.content.split("\n").map((line, i) => {
                        if (line.startsWith("## "))
                          return <h2 key={i} className="text-xl font-bold mt-6 mb-3 first:mt-0">{line.slice(3)}</h2>;
                        if (line.startsWith("### "))
                          return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
                        if (line.startsWith("- "))
                          return <li key={i} className="ml-5 mb-1">{line.slice(2)}</li>;
                        if (line.trim() === "") return <div key={i} className="h-3" />;
                        return <p key={i} className="mb-2">{line}</p>;
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No content added yet.</p>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
                  {isAdmin && (
                    <Button onClick={() => { setViewDialogOpen(false); openEdit(viewingResource); }}>
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
