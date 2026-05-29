import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Upload,
  ExternalLink,
  X,
  Leaf,
  FileUp,
  Loader2,
  CheckCircle2,
  Download,
} from "lucide-react";

const CATEGORIES = ["Lawn Care", "Pruning", "Irrigation", "Hardscaping", "Seasonal", "Equipment", "General"];
const RESOURCE_TYPES = [
  { value: "guide", label: "Care Guide", icon: Leaf },
  { value: "instruction", label: "Instructions", icon: FileText },
  { value: "document", label: "Document", icon: FileUp },
];
const ACCEPTED_EXTS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

// ── Reusable drag-and-drop file zone ─────────────────────────────────────────
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  if (currentFileName) {
    return (
      <div className="flex items-center gap-3 border-2 border-green-200 bg-green-50 rounded-xl px-4 py-4">
        <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{currentFileName}</p>
          <p className="text-xs text-muted-foreground">File uploaded successfully</p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-all select-none ${
        dragging
          ? "border-primary bg-primary/10 scale-[1.01]"
          : uploading
          ? "border-muted-foreground/20 bg-muted/20 cursor-wait"
          : "border-muted-foreground/25 bg-muted/30 hover:border-primary/60 hover:bg-primary/5"
      }`}
      data-testid="file-drop-zone"
    >
      {uploading ? (
        <>
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Uploading…</p>
        </>
      ) : dragging ? (
        <>
          <Upload className="w-10 h-10 text-primary" />
          <p className="text-sm font-semibold text-primary">Drop to upload</p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <FileUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Drag & drop your file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse your computer</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">PDF, Word, Excel, PowerPoint, CSV, TXT</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-1 pointer-events-none">
            Browse Files
          </Button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTS}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
        data-testid="file-input-hidden"
      />
    </div>
  );
}

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

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "guide" as string,
    category: "General",
    content: "",
    fileUrl: "",
    fileName: "",
    isPublished: true,
  });

  const { data: resources = [], isLoading } = useQuery<CustomerResource[]>({
    queryKey: ["/api/resources"],
  });

  const { data: savedResources = [] } = useQuery<{ resourceId: string }[]>({
    queryKey: ["/api/saved-resources"],
  });

  const savedResourceIds = new Set(savedResources.map((s) => s.resourceId));

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create resource");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setEditDialogOpen(false);
      resetForm();
      toast({ title: "Resource created successfully" });
    },
    onError: () => toast({ title: "Failed to save resource", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update resource");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setEditDialogOpen(false);
      resetForm();
      toast({ title: "Resource updated successfully" });
    },
    onError: () => toast({ title: "Failed to save changes", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resources/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete resource");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      toast({ title: "Resource deleted" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch(`/api/saved-resources/${resourceId}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to save resource");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-resources"] });
      toast({ title: "Saved to your profile" });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch(`/api/saved-resources/${resourceId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove saved resource");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-resources"] });
      toast({ title: "Removed from saved" });
    },
  });

  const resetForm = () => {
    setFormData({ title: "", description: "", type: "guide", category: "General", content: "", fileUrl: "", fileName: "", isPublished: true });
    setEditingResource(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setEditDialogOpen(true);
  };

  const openEditDialog = (resource: CustomerResource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      description: resource.description || "",
      type: resource.type,
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
      toast({ title: "Please upload a file for document resources", variant: "destructive" });
      return;
    }
    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // ── Shared upload function used in both the drop zone (Documents tab) and the edit dialog ──
  const uploadFile = useCallback(async (file: File): Promise<{ url: string; fileName: string } | null> => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Upload failed");
      }
      const data = await res.json();
      return { url: data.url, fileName: file.name };
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      return null;
    }
  }, [toast]);

  // ── Documents tab: drop/browse → upload → open details dialog ──
  const handleDocumentTabFile = useCallback(async (file: File) => {
    setIsUploadingFile(true);
    const result = await uploadFile(file);
    setIsUploadingFile(false);
    if (!result) return;
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setEditingResource(null);
    setFormData({
      title: nameWithoutExt,
      description: "",
      type: "document",
      category: "General",
      content: "",
      fileUrl: result.url,
      fileName: result.fileName,
      isPublished: true,
    });
    setEditDialogOpen(true);
  }, [uploadFile]);

  // ── Dialog file picker (when changing file on existing doc resource) ──
  const handleDialogFile = useCallback(async (file: File) => {
    setIsUploadingFile(true);
    const result = await uploadFile(file);
    setIsUploadingFile(false);
    if (!result) return;
    setFormData(prev => ({ ...prev, fileUrl: result.url, fileName: result.fileName }));
    if (!formData.title) {
      setFormData(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, "") }));
    }
  }, [uploadFile, formData.title]);

  const toggleSave = (resourceId: string) => {
    if (savedResourceIds.has(resourceId)) {
      unsaveMutation.mutate(resourceId);
    } else {
      saveMutation.mutate(resourceId);
    }
  };

  const publishedResources = resources.filter((r) => r.isPublished || isAdmin);
  const guides = publishedResources.filter((r) => r.type === "guide");
  const instructions = publishedResources.filter((r) => r.type === "instruction");
  const documents = publishedResources.filter((r) => r.type === "document");
  const savedItems = publishedResources.filter((r) => savedResourceIds.has(r.id));

  const faqData = [
    { q: "How long does a typical installation take?", a: "Residential projects usually take 1-2 weeks depending on scope and weather." },
    { q: "What is your warranty policy?", a: "We offer a 2-year warranty on all hardscape installations and a 1-year plant health guarantee." },
    { q: "Do I need to be home for the maintenance crew?", a: "No, as long as we have access to the gates and any pets are inside." },
    { q: "When should I water new sod?", a: "Water new sod twice daily for the first two weeks, then gradually reduce to deep watering every 2-3 days." },
    { q: "How often should I fertilize my lawn?", a: "We recommend fertilizing 4 times per year: early spring, late spring, summer, and fall." },
  ];

  const ResourceCard = ({ resource }: { resource: CustomerResource }) => {
    const isSaved = savedResourceIds.has(resource.id);
    const TypeIcon = RESOURCE_TYPES.find((t) => t.value === resource.type)?.icon || FileText;

    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer group relative" data-testid={`resource-card-${resource.id}`}>
        {!resource.isPublished && <Badge className="absolute top-2 right-2 z-10" variant="secondary">Draft</Badge>}
        <div
          className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 rounded-t-xl flex items-center justify-center"
          onClick={() => { setViewingResource(resource); setViewDialogOpen(true); }}
        >
          <TypeIcon className="w-12 h-12 text-primary/40" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle
            className="text-lg line-clamp-1 cursor-pointer hover:text-primary"
            onClick={() => { setViewingResource(resource); setViewDialogOpen(true); }}
          >
            {resource.title}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{resource.category}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <CardDescription className="line-clamp-2">{resource.description || "No description"}</CardDescription>
        </CardContent>
        <CardFooter className="pt-0 flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => toggleSave(resource.id)} data-testid={`save-resource-${resource.id}`}>
            {isSaved ? <><BookmarkCheck className="w-4 h-4 mr-1 text-primary" /> Saved</> : <><Bookmark className="w-4 h-4 mr-1" /> Save</>}
          </Button>
          <div className="flex gap-1">
            {resource.fileUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer" title="Open document">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
            {isAdmin && (
              <>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(resource)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(resource.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    );
  };

  const ResourceGrid = ({ items, emptyMessage }: { items: CustomerResource[]; emptyMessage: string }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.length === 0 ? (
        <div className="col-span-full text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        items.map((resource) => <ResourceCard key={resource.id} resource={resource} />)
      )}
    </div>
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="page-title">{t("education.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("education.pageSubtitle")}</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateDialog} className="gap-2" data-testid="create-resource-btn">
            <Plus className="w-4 h-4" /> {t("education.newResource")}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="process">{t("education.ourProcess")}</TabsTrigger>
          <TabsTrigger value="guides">{t("education.careGuides")}</TabsTrigger>
          <TabsTrigger value="instructions">{t("education.instructions")}</TabsTrigger>
          <TabsTrigger value="documents">{t("education.documents")}</TabsTrigger>
          <TabsTrigger value="saved"><Bookmark className="w-4 h-4 mr-1" /> {t("education.saved")}</TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="mt-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {[
              { title: t("education.consultation"), icon: HelpCircle, desc: t("education.consultationDesc") },
              { title: t("education.design"), icon: Map, desc: t("education.designDesc") },
              { title: t("education.install"), icon: ShieldCheck, desc: t("education.installDesc") },
              { title: t("education.maintain"), icon: Clock, desc: t("education.maintainDesc") },
            ].map((step, i) => (
              <div key={i} className="relative p-6 bg-card border rounded-xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">{i + 1}</div>
                <h3 className="text-xl font-heading font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                {i < 3 && <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 w-6 h-6" />}
              </div>
            ))}
          </div>

          <Card className="bg-primary text-primary-foreground overflow-hidden">
            <div className="md:flex">
              <div className="p-8 md:w-1/2 space-y-4">
                <h2 className="text-3xl font-heading font-bold">What to expect on Day 1</h2>
                <p className="text-primary-foreground/80">Our crew will arrive between 7:30-8:00 AM. We'll start with a site walkthrough and material staging. Expect some noise and heavy equipment—it's all part of the magic!</p>
                <Button variant="secondary" className="gap-2"><PlayCircle className="w-4 h-4" /> Watch Onboarding Video</Button>
              </div>
              <div className="md:w-1/2 bg-black/20 min-h-[200px] flex items-center justify-center">
                <PlayCircle className="w-16 h-16 opacity-50" />
              </div>
            </div>
          </Card>

          <div className="space-y-4 max-w-3xl">
            <h2 className="text-2xl font-heading font-bold">Frequently Asked Questions</h2>
            {faqData.map((item, i) => (
              <Card key={i}>
                <CardHeader><CardTitle className="text-lg">{item.q}</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">{item.a}</p></CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="guides" className="mt-8">
          <ResourceGrid items={guides} emptyMessage="No care guides available yet. Check back soon!" />
        </TabsContent>

        <TabsContent value="instructions" className="mt-8">
          <ResourceGrid items={instructions} emptyMessage="No instructions available yet." />
        </TabsContent>

        {/* ── Documents tab: THE single place to upload documents ── */}
        <TabsContent value="documents" className="mt-8 space-y-6">
          {isAdmin && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upload a Document</p>
              <FileDropZone
                onFile={handleDocumentTabFile}
                uploading={isUploadingFile && !editDialogOpen}
                data-testid="doc-drop-zone"
              />
            </div>
          )}
          <ResourceGrid items={documents} emptyMessage="No documents have been uploaded yet." />
        </TabsContent>

        <TabsContent value="saved" className="mt-8">
          <ResourceGrid items={savedItems} emptyMessage="You haven't saved any resources yet. Click the bookmark icon on any resource to save it here." />
        </TabsContent>
      </Tabs>

      {/* ── Create / Edit dialog ───────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit Resource" : formData.type === "document" ? "Add Document Details" : "Create Resource"}</DialogTitle>
            <DialogDescription>
              {formData.type === "document"
                ? "Fill in the details for this document. You can replace the file at any time."
                : "Create a care guide or instruction page for customers."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* File section — only shown for document type */}
            {formData.type === "document" && (
              <div className="space-y-2">
                <Label>File {!editingResource && <span className="text-destructive">*</span>}</Label>
                <FileDropZone
                  onFile={handleDialogFile}
                  uploading={isUploadingFile}
                  currentFileName={formData.fileName || undefined}
                  onClear={() => setFormData(prev => ({ ...prev, fileUrl: "", fileName: "" }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., New Lawn Watering Guide"
                  data-testid="resource-title-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RESOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={formData.isPublished ? "published" : "draft"} onValueChange={(v) => setFormData(prev => ({ ...prev, isPublished: v === "published" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published — visible to everyone</SelectItem>
                    <SelectItem value="draft">Draft — admins only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this resource"
                rows={2}
              />
            </div>

            {/* Content field — only shown for guide / instruction types */}
            {formData.type !== "document" && (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your care guide or instructions here…"
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Supports basic markdown: ## headings, - bullet points, **bold**</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || isUploadingFile}
            >
              {isUploadingFile ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : editingResource ? "Save Changes" : formData.type === "document" ? "Save Document" : "Create Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View dialog ───────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingResource && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl">{viewingResource.title}</DialogTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{viewingResource.category}</Badge>
                      <Badge variant="secondary">{RESOURCE_TYPES.find(t => t.value === viewingResource.type)?.label}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleSave(viewingResource.id)}>
                    {savedResourceIds.has(viewingResource.id) ? <BookmarkCheck className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5" />}
                  </Button>
                </div>
                <DialogDescription>{viewingResource.description}</DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {viewingResource.fileUrl ? (
                  <div className="flex flex-col items-center gap-4 py-8 border rounded-xl bg-muted/30">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileUp className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{viewingResource.fileName || "Document"}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Click below to open or download</p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild>
                        <a href={viewingResource.fileUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" /> Open Document
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
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {viewingResource.content.split("\n").map((paragraph, i) => {
                      if (paragraph.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-2">{paragraph.slice(3)}</h2>;
                      if (paragraph.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{paragraph.slice(4)}</h3>;
                      if (paragraph.startsWith("- ")) return <li key={i} className="ml-4">{paragraph.slice(2)}</li>;
                      if (paragraph.trim() === "") return <br key={i} />;
                      return <p key={i} className="mb-2">{paragraph}</p>;
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No content available.</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
                {isAdmin && (
                  <Button onClick={() => { setViewDialogOpen(false); openEditDialog(viewingResource); }}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
