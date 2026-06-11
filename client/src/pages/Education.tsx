import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileText,
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
  Wrench,
  ChevronRight,
} from "lucide-react";

const CATEGORIES = [
  "Lawn Care",
  "Pruning",
  "Irrigation",
  "Hardscaping",
  "Seasonal",
  "Equipment",
  "General",
];

type ResourceType = "guide" | "instruction" | "document";

const TYPE_CONFIG: Record<
  ResourceType,
  { label: string; icon: React.ElementType; color: string; description: string }
> = {
  guide: {
    label: "Care Guide",
    icon: Leaf,
    color: "text-emerald-600",
    description: "Seasonal and ongoing plant & lawn care advice",
  },
  instruction: {
    label: "Instructions",
    icon: Wrench,
    color: "text-blue-600",
    description: "Step-by-step how-to guides and setup instructions",
  },
  document: {
    label: "Document",
    icon: FileUp,
    color: "text-amber-600",
    description: "PDFs, warranties, spec sheets, and other files",
  },
};

// ── Presigned-URL upload helper ──────────────────────────────────────────────
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

// ── Drag & Drop File Zone ────────────────────────────────────────────────────
function FileDropZone({
  onFile,
  uploading,
  currentFileName,
  onClear,
}: {
  onFile: (f: File) => void;
  uploading: boolean;
  currentFileName?: string;
  onClear?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

  // Prevent the browser from opening dropped files anywhere on the page
  useEffect(() => {
    const stop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("dragover", stop);
    document.addEventListener("drop", stop);
    return () => {
      document.removeEventListener("dragover", stop);
      document.removeEventListener("drop", stop);
    };
  }, []);

  if (currentFileName) {
    return (
      <div className="flex items-center gap-3 border-2 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 rounded-xl px-4 py-4">
        <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{currentFileName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ready to save</p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
      onDragLeave={(e) => { e.stopPropagation(); setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      onClick={() => !uploading && inputRef.current?.click()}
      data-testid="file-drop-zone"
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all select-none ${
        uploading
          ? "border-muted-foreground/20 bg-muted/20 cursor-wait"
          : dragging
          ? "border-primary bg-primary/10 scale-[1.01] cursor-copy"
          : "border-muted-foreground/25 bg-muted/30 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
      }`}
    >
      {uploading ? (
        <>
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Uploading…</p>
        </>
      ) : dragging ? (
        <>
          <Upload className="w-10 h-10 text-primary animate-bounce" />
          <p className="text-base font-semibold text-primary">Drop to upload</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <FileUp className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Drag & drop your file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click anywhere to browse your computer</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">PDF · Word · Excel · PowerPoint · CSV · TXT</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="pointer-events-none mt-1">
            Browse Files
          </Button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        data-testid="file-input-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Resource card ────────────────────────────────────────────────────────────
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
  const cfg = TYPE_CONFIG[resource.type as ResourceType] ?? TYPE_CONFIG.guide;
  const Icon = cfg.icon;

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow group relative overflow-hidden" data-testid={`resource-card-${resource.id}`}>
      {!resource.isPublished && (
        <Badge className="absolute top-2 left-2 z-10" variant="secondary">Draft</Badge>
      )}
      {/* Colour band */}
      <div
        className="h-28 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center cursor-pointer"
        onClick={onView}
      >
        <Icon className={`w-12 h-12 opacity-40 ${cfg.color}`} />
      </div>

      <CardHeader className="pb-2 flex-1">
        <CardTitle
          className="text-base line-clamp-2 cursor-pointer hover:text-primary leading-snug"
          onClick={onView}
        >
          {resource.title}
        </CardTitle>
        <Badge variant="outline" className="w-fit text-xs">{resource.category}</Badge>
      </CardHeader>

      <CardContent className="pb-2">
        <CardDescription className="line-clamp-2 text-sm">
          {resource.description || <span className="italic opacity-60">No description</span>}
        </CardDescription>
      </CardContent>

      <CardFooter className="pt-0 flex justify-between items-center border-t mt-auto">
        <Button variant="ghost" size="sm" onClick={onToggleSave} data-testid={`save-resource-${resource.id}`}>
          {isSaved
            ? <><BookmarkCheck className="w-4 h-4 mr-1 text-primary" /> Saved</>
            : <><Bookmark className="w-4 h-4 mr-1" /> Save</>}
        </Button>
        <div className="flex gap-1">
          {resource.fileUrl && (
            <Button variant="ghost" size="sm" asChild title="Open file">
              <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onView} title="View">
            <ChevronRight className="w-4 h-4" />
          </Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit} title="Edit"><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive" title="Delete">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, subtitle, action }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Education() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === "Admin" || currentUser?.role === "Manager";

  const [activeTab, setActiveTab] = useState("process");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<CustomerResource | null>(null);
  const [viewingResource, setViewingResource] = useState<CustomerResource | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const defaultForm = {
    title: "",
    description: "",
    type: "guide" as ResourceType,
    category: "General",
    content: "",
    fileUrl: "",
    fileName: "",
    isPublished: true,
  };
  const [formData, setFormData] = useState(defaultForm);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: resources = [] } = useQuery<CustomerResource[]>({ queryKey: ["/api/resources"] });
  const { data: savedResources = [] } = useQuery<{ resourceId: string }[]>({ queryKey: ["/api/saved-resources"] });
  const savedIds = new Set(savedResources.map((s) => s.resourceId));

  const publishedResources = resources.filter((r) => r.isPublished || isAdmin);
  const guides = publishedResources.filter((r) => r.type === "guide");
  const instructions = publishedResources.filter((r) => r.type === "instruction");
  const documents = publishedResources.filter((r) => r.type === "document");
  const savedItems = publishedResources.filter((r) => savedIds.has(r.id));

  // ── Mutations ─────────────────────────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = (type: ResourceType = "guide") => {
    setEditingResource(null);
    setFormData({ ...defaultForm, type });
    setEditDialogOpen(true);
  };

  const openEdit = (resource: CustomerResource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      description: resource.description || "",
      type: resource.type as ResourceType,
      category: resource.category,
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
    if (formData.type === "document" && !formData.fileUrl) {
      toast({ title: "Please upload a file before saving", variant: "destructive" });
      return;
    }
    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // ── File upload via presigned URL (the correct pattern for this stack) ────
  const handleFile = useCallback(async (file: File, openDialogAfter = false) => {
    setIsUploadingFile(true);
    try {
      const { url, fileName } = await uploadFileToStorage(file);
      if (openDialogAfter) {
        // Documents tab: upload first, then open details dialog
        setEditingResource(null);
        setFormData({
          ...defaultForm,
          type: "document",
          title: file.name.replace(/\.[^/.]+$/, ""),
          fileUrl: url,
          fileName,
        });
        setEditDialogOpen(true);
      } else {
        // Inside edit dialog: just update the file fields
        setFormData((prev) => ({ ...prev, fileUrl: url, fileName }));
      }
      toast({ title: "File uploaded — fill in the details and save" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingFile(false);
    }
  }, [toast]);

  const toggleSave = (id: string) => {
    savedIds.has(id) ? unsaveMutation.mutate(id) : saveMutation.mutate(id);
  };

  // ── FAQ data ──────────────────────────────────────────────────────────────
  const faqData = [
    { q: "How long does a typical installation take?", a: "Residential projects usually take 1–2 weeks depending on scope and weather." },
    { q: "What is your warranty policy?", a: "We offer a 2-year warranty on all hardscape installations and a 1-year plant health guarantee." },
    { q: "Do I need to be home for the maintenance crew?", a: "No, as long as we have access to gates and any pets are inside." },
    { q: "When should I water new sod?", a: "Twice daily for the first two weeks, then gradually reduce to deep watering every 2–3 days." },
    { q: "How often should I fertilize my lawn?", a: "Four times per year: early spring, late spring, summer, and fall." },
  ];

  // ── Resource grid with optional upload zone ───────────────────────────────
  const ResourceGrid = ({
    items,
    type,
    emptyTitle,
    emptySubtitle,
  }: {
    items: CustomerResource[];
    type: ResourceType;
    emptyTitle: string;
    emptySubtitle: string;
  }) => {
    const cfg = TYPE_CONFIG[type];
    const Icon = cfg.icon;
    return (
      <div className="space-y-6">
        {/* Admin: add button + upload zone for documents */}
        {isAdmin && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? cfg.label.toLowerCase() : `${cfg.label.toLowerCase()}s`}
              {items.some((r) => !r.isPublished) && " (includes drafts)"}
            </p>
            {type !== "document" && (
              <Button size="sm" variant="outline" onClick={() => openCreate(type)} className="gap-2">
                <Plus className="w-4 h-4" /> Add {cfg.label}
              </Button>
            )}
          </div>
        )}

        {/* Documents: drag & drop upload zone */}
        {isAdmin && type === "document" && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upload a new document</p>
            <FileDropZone
              onFile={(f) => handleFile(f, true)}
              uploading={isUploadingFile && !editDialogOpen}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={emptyTitle}
              subtitle={emptySubtitle}
              action={
                isAdmin && type !== "document" ? (
                  <Button size="sm" onClick={() => openCreate(type)} className="gap-2">
                    <Plus className="w-4 h-4" /> Add the first {cfg.label.toLowerCase()}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            items.map((r) => (
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
            ))
          )}
        </div>
      </div>
    );
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="page-title">
            {t("education.pageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("education.pageSubtitle")}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => openCreate("guide")} className="gap-2" data-testid="create-guide-btn">
              <Leaf className="w-4 h-4" /> New Guide
            </Button>
            <Button variant="outline" onClick={() => openCreate("instruction")} className="gap-2" data-testid="create-instruction-btn">
              <Wrench className="w-4 h-4" /> New Instructions
            </Button>
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="process">{t("education.ourProcess")}</TabsTrigger>
          <TabsTrigger value="guides">{t("education.careGuides")}</TabsTrigger>
          <TabsTrigger value="instructions">{t("education.instructions")}</TabsTrigger>
          <TabsTrigger value="documents">{t("education.documents")}</TabsTrigger>
          <TabsTrigger value="saved">
            <Bookmark className="w-3.5 h-3.5 mr-1" />{t("education.saved")}
          </TabsTrigger>
        </TabsList>

        {/* ── Our Process ──────────────────────────────────────────────── */}
        <TabsContent value="process" className="mt-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {[
              { title: t("education.consultation"), icon: HelpCircle, desc: t("education.consultationDesc") },
              { title: t("education.design"), icon: Map, desc: t("education.designDesc") },
              { title: t("education.install"), icon: ShieldCheck, desc: t("education.installDesc") },
              { title: t("education.maintain"), icon: Clock, desc: t("education.maintainDesc") },
            ].map((step, i) => (
              <div key={i} className="relative p-6 bg-card border rounded-xl space-y-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {i + 1}
                </div>
                <h3 className="text-lg font-heading font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                {i < 3 && (
                  <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 w-6 h-6" />
                )}
              </div>
            ))}
          </div>

          <Card className="bg-primary text-primary-foreground overflow-hidden">
            <div className="md:flex">
              <div className="p-8 md:w-1/2 space-y-4">
                <h2 className="text-3xl font-heading font-bold">What to expect on Day 1</h2>
                <p className="text-primary-foreground/80">
                  Our crew will arrive between 7:30–8:00 AM. We'll start with a site walkthrough and
                  material staging. Expect some noise and heavy equipment — it's all part of the magic!
                </p>
                <Button variant="secondary" className="gap-2">
                  <PlayCircle className="w-4 h-4" /> Watch Onboarding Video
                </Button>
              </div>
              <div className="md:w-1/2 bg-black/20 min-h-[200px] flex items-center justify-center">
                <PlayCircle className="w-16 h-16 opacity-50" />
              </div>
            </div>
          </Card>

          <div className="space-y-3 max-w-3xl">
            <h2 className="text-2xl font-heading font-bold">Frequently Asked Questions</h2>
            {faqData.map((item, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Care Guides ──────────────────────────────────────────────── */}
        <TabsContent value="guides" className="mt-8">
          <ResourceGrid
            items={guides}
            type="guide"
            emptyTitle="No care guides yet"
            emptySubtitle="Add seasonal care guides, lawn tips, and plant maintenance articles for your customers."
          />
        </TabsContent>

        {/* ── Instructions ─────────────────────────────────────────────── */}
        <TabsContent value="instructions" className="mt-8">
          <ResourceGrid
            items={instructions}
            type="instruction"
            emptyTitle="No instructions yet"
            emptySubtitle="Add step-by-step how-to guides for irrigation, equipment, and maintenance tasks."
          />
        </TabsContent>

        {/* ── Documents ────────────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-8">
          <ResourceGrid
            items={documents}
            type="document"
            emptyTitle="No documents uploaded yet"
            emptySubtitle="Upload PDFs, warranties, spec sheets, and other files for your customers."
          />
        </TabsContent>

        {/* ── Saved ────────────────────────────────────────────────────── */}
        <TabsContent value="saved" className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedItems.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="Nothing saved yet"
                subtitle="Click the bookmark icon on any resource to save it here for quick access."
              />
            ) : (
              savedItems.map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  isAdmin={isAdmin}
                  isSaved={true}
                  onView={() => { setViewingResource(r); setViewDialogOpen(true); }}
                  onEdit={() => openEdit(r)}
                  onDelete={() => { if (confirm("Delete this resource?")) deleteMutation.mutate(r.id); }}
                  onToggleSave={() => toggleSave(r.id)}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Create / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setFormData(defaultForm); setEditingResource(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingResource
                ? `Edit: ${editingResource.title}`
                : formData.type === "document"
                ? "Add Document Details"
                : formData.type === "instruction"
                ? "New Instructions"
                : "New Care Guide"}
            </DialogTitle>
            <DialogDescription>
              {formData.type === "document"
                ? "Give this document a clear title so customers can find it easily."
                : "Fill in the content below. Customers will see exactly what you type."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type selector — only when creating */}
            {!editingResource && (
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TYPE_CONFIG) as ResourceType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, type: t, fileUrl: "", fileName: "" }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          formData.type === t
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* File upload — documents only */}
            {formData.type === "document" && (
              <div className="space-y-2">
                <Label>
                  File {!editingResource && <span className="text-destructive">*</span>}
                </Label>
                <FileDropZone
                  onFile={(f) => handleFile(f, false)}
                  uploading={isUploadingFile}
                  currentFileName={formData.fileName || undefined}
                  onClear={() => setFormData((p) => ({ ...p, fileUrl: "", fileName: "" }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder={
                    formData.type === "guide"
                      ? "e.g., Spring Lawn Watering Guide"
                      : formData.type === "instruction"
                      ? "e.g., How to Set Your Irrigation Timer"
                      : "e.g., 2024 Warranty Documentation"
                  }
                  data-testid="resource-title-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short description customers will see on the card"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={formData.isPublished ? "published" : "draft"}
                onValueChange={(v) => setFormData((p) => ({ ...p, isPublished: v === "published" }))}
              >
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published — visible to all customers</SelectItem>
                  <SelectItem value="draft">Draft — only visible to admins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content — guides and instructions only */}
            {formData.type !== "document" && (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Write the full content here. Use ## for headings, - for bullet points, **bold** for emphasis."
                  rows={12}
                  className="font-mono text-sm leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  Supports basic markdown: <code>## Heading</code> · <code>- bullet</code> · <code>**bold**</code>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving || isUploadingFile}>
              {isUploadingFile ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
              ) : isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : editingResource ? (
                "Save Changes"
              ) : formData.type === "document" ? (
                "Save Document"
              ) : (
                "Publish Resource"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingResource && (() => {
            const cfg = TYPE_CONFIG[viewingResource.type as ResourceType] ?? TYPE_CONFIG.guide;
            const Icon = cfg.icon;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div>
                        <DialogTitle className="text-xl leading-tight">{viewingResource.title}</DialogTitle>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{viewingResource.category}</Badge>
                          <Badge variant="secondary" className="text-xs">{cfg.label}</Badge>
                          {!viewingResource.isPublished && <Badge variant="secondary" className="text-xs">Draft</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSave(viewingResource.id)}
                      className="shrink-0"
                    >
                      {savedIds.has(viewingResource.id)
                        ? <BookmarkCheck className="w-5 h-5 text-primary" />
                        : <Bookmark className="w-5 h-5" />}
                    </Button>
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
