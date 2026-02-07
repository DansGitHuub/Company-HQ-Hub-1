import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Plus, ArrowLeft, Edit, Trash2, Sparkles, Upload, FileText, 
  Link2, Loader2, Save, X, ChevronRight, ChevronDown, Archive, Copy, 
  Move, MoreVertical, FolderPlus, Pencil, Check, ExternalLink, FileUp,
  LayoutTemplate, BookMarked, Image, File, ClipboardList
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import SOPBuilder, { type SOPBuilderData } from "@/components/SOPBuilder";
import type { Sop, SopCategory, SopTemplate, SopExample, SopDraft } from "@shared/schema";
import { Clock, PlayCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function SOPs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("topics");
  const [search, setSearch] = useState("");
  const [selectedSOP, setSelectedSOP] = useState<Sop | null>(null);
  const [editingSOP, setEditingSOP] = useState<Sop | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categorySearch, setCategorySearch] = useState<Record<string, string>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingSopId, setMovingSopId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // SOP Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderInitialData, setBuilderInitialData] = useState<(SOPBuilderData & { draftId?: number }) | undefined>(undefined);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const { data: drafts = [] } = useQuery<SopDraft[]>({
    queryKey: ["/api/sop-drafts"],
  });
  
  // Templates & Examples state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [exampleDialogOpen, setExampleDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SopTemplate | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<SopCategory[]>({
    queryKey: ["/api/sop-categories"],
  });

  const { data: sops = [], isLoading: sopsLoading } = useQuery<Sop[]>({
    queryKey: ["/api/sops"],
  });

  const { data: templates = [] } = useQuery<SopTemplate[]>({
    queryKey: ["/api/sop-templates"],
  });

  const { data: examples = [] } = useQuery<SopExample[]>({
    queryKey: ["/api/sop-examples"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Sop>) => {
      const res = await fetch("/api/sops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create SOP");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      setCreateOpen(false);
      setCreateCategoryId(null);
      toast({ title: "SOP created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Sop> }) => {
      const res = await fetch(`/api/sops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update SOP");
      return res.json();
    },
    onSuccess: (updatedSop) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      setEditingSOP(null);
      setSelectedSOP(updatedSop);
      toast({ title: "SOP updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sops/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete SOP");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      setSelectedSOP(null);
      toast({ title: "SOP deleted" });
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sops/${id}/copy`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to copy SOP");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      toast({ title: "SOP copied" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/sop-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sortOrder: categories.length }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-categories"] });
      setNewCategoryOpen(false);
      setNewCategoryName("");
      toast({ title: "Topic created" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/sop-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      setEditingCategoryId(null);
      setSelectedSOP(null);
      toast({ title: "Topic renamed" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sop-categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete category");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-categories"] });
      toast({ title: "Topic deleted" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<SopTemplate>) => {
      const res = await fetch("/api/sop-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-templates"] });
      setTemplateDialogOpen(false);
      toast({ title: "Template created" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sop-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const createExampleMutation = useMutation({
    mutationFn: async (data: Partial<SopExample>) => {
      const res = await fetch("/api/sop-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save example");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-examples"] });
      setExampleDialogOpen(false);
      toast({ title: "Example saved" });
    },
  });

  const deleteExampleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sop-examples/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete example");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-examples"] });
      toast({ title: "Example deleted" });
    },
  });

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSopsForCategory = (categoryId: string) => {
    const searchTerm = categorySearch[categoryId]?.toLowerCase() || "";
    return sops.filter(sop => {
      const matchesCategory = sop.categoryId === categoryId;
      const matchesSearch = !searchTerm || 
        sop.title.toLowerCase().includes(searchTerm) || 
        sop.content.toLowerCase().includes(searchTerm);
      const matchesArchived = showArchived ? sop.isArchived : !sop.isArchived;
      return matchesCategory && matchesSearch && matchesArchived;
    });
  };

  const getUncategorizedSops = () => {
    const searchTerm = search.toLowerCase();
    return sops.filter(sop => {
      const uncategorized = !sop.categoryId;
      const matchesSearch = !searchTerm ||
        sop.title.toLowerCase().includes(searchTerm) ||
        sop.content.toLowerCase().includes(searchTerm);
      const matchesArchived = showArchived ? sop.isArchived : !sop.isArchived;
      return uncategorized && matchesSearch && matchesArchived;
    });
  };

  const handleArchive = (sop: Sop) => {
    updateMutation.mutate({ id: sop.id, data: { isArchived: !sop.isArchived } });
    toast({ title: sop.isArchived ? "SOP restored" : "SOP archived" });
  };

  const handleMove = (sopId: string, newCategoryId: string) => {
    const newCategory = categories.find(c => c.id === newCategoryId);
    updateMutation.mutate({ 
      id: sopId, 
      data: { 
        categoryId: newCategoryId,
        category: newCategory?.name || "Uncategorized"
      } 
    });
    setMoveDialogOpen(false);
    setMovingSopId(null);
    toast({ title: "SOP moved" });
  };

  const handleCreateFromTemplate = (template: SopTemplate) => {
    const category = categories.find(c => c.id === template.categoryId);
    createMutation.mutate({
      title: template.name,
      content: template.content,
      category: category?.name || "General",
      categoryId: template.categoryId || undefined,
      ownerId: user?.id,
    });
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("AI generation failed");
      const { content, title, category } = await res.json();
      
      await createMutation.mutateAsync({
        title: title || "AI Generated SOP",
        category: category || "General",
        content: content,
        ownerId: user?.id,
        categoryId: createCategoryId || undefined,
      });
      
      setAiGenerateOpen(false);
      setAiPrompt("");
    } catch (err) {
      toast({ title: "AI generation failed", variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const isLoading = categoriesLoading || sopsLoading;

  if (editingSOP) {
    return <SOPEditor sop={editingSOP} categories={categories} onSave={(data) => updateMutation.mutate({ id: editingSOP.id, data })} onCancel={() => setEditingSOP(null)} isSaving={updateMutation.isPending} />;
  }

  if (selectedSOP) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
        <Button variant="ghost" onClick={() => setSelectedSOP(null)} className="pl-0 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </Button>
        
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="outline" className="mb-2">{selectedSOP.category}</Badge>
              {selectedSOP.isArchived && <Badge variant="secondary" className="ml-2">Archived</Badge>}
              <h1 className="text-4xl font-heading font-bold text-primary">{selectedSOP.title}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {selectedSOP.lastUpdated ? new Date(selectedSOP.lastUpdated).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingSOP(selectedSOP)} data-testid="button-edit-sop">
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => copyMutation.mutate(selectedSOP.id)}>
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setMovingSopId(selectedSOP.id); setMoveDialogOpen(true); }}>
                    <Move className="w-4 h-4 mr-2" /> Move
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchive(selectedSOP)}>
                    <Archive className="w-4 h-4 mr-2" /> {selectedSOP.isArchived ? "Restore" : "Archive"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this SOP?")) {
                        deleteMutation.mutate(selectedSOP.id);
                      }
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <Card className="min-h-[60vh]">
            <CardContent className="p-8 prose prose-slate dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: selectedSOP.content }} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <SOPBuilder
        categories={categories}
        initialData={builderInitialData}
        onComplete={(sopData) => {
          createMutation.mutate({
            title: sopData.title,
            category: sopData.category,
            categoryId: sopData.categoryId,
            superCategory: sopData.superCategory || undefined,
            subCategory: sopData.subCategory || undefined,
            sopType: sopData.sopType || undefined,
            content: sopData.content,
            ownerId: user?.id,
          }, {
            onSuccess: () => {
              if (builderInitialData?.draftId) {
                apiRequest("DELETE", `/api/sop-drafts/${builderInitialData.draftId}`).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/sop-drafts"] });
                }).catch(() => {});
              }
              setShowBuilder(false);
              setBuilderInitialData(undefined);
            }
          });
        }}
        onCancel={() => { setShowBuilder(false); setBuilderInitialData(undefined); }}
        isSubmitting={createMutation.isPending}
        onSaveDraft={async (draftData) => {
          setIsSavingDraft(true);
          try {
            await apiRequest("POST", "/api/sop-drafts", draftData);
            queryClient.invalidateQueries({ queryKey: ["/api/sop-drafts"] });
            toast({ title: "Saved to drafts", description: "You can resume this SOP later from your drafts." });
            setShowBuilder(false);
            setBuilderInitialData(undefined);
          } catch {
            toast({ title: "Failed to save draft", variant: "destructive" });
          } finally {
            setIsSavingDraft(false);
          }
        }}
        isSavingDraft={isSavingDraft}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">SOP Library</h1>
          <p className="text-muted-foreground">Standard Operating Procedures & Knowledge Base</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => { setBuilderInitialData(undefined); setShowBuilder(true); }}
            className="gap-2 px-5 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg hover:brightness-110 transition-all ring-1 ring-primary/20"
            data-testid="button-sop-builder"
          >
            <ClipboardList className="w-5 h-5" /> SOP Builder
          </Button>
          <Button variant="outline" onClick={() => setAiGenerateOpen(true)} className="gap-2" data-testid="button-ai-generate-sop">
            <Sparkles className="w-4 h-4" /> Generate with AI
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="topics" className="gap-2">
            <FolderPlus className="w-4 h-4" /> Topics
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2" data-testid="tab-drafts">
            <Clock className="w-4 h-4" /> Drafts {drafts.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5">{drafts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="w-4 h-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="examples" className="gap-2">
            <BookMarked className="w-4 h-4" /> Examples
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4 mt-6">
          <div className="flex gap-2 items-center justify-between">
            <Button 
              variant={showArchived ? "secondary" : "outline"} 
              onClick={() => setShowArchived(!showArchived)}
              size="sm"
            >
              <Archive className="w-4 h-4 mr-2" /> {showArchived ? "Showing Archived" : "Show Archived"}
            </Button>
            <Button variant="outline" onClick={() => setNewCategoryOpen(true)} size="sm" className="gap-2">
              <FolderPlus className="w-4 h-4" /> New Topic
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map(category => (
                <CategoryDropdown
                  key={category.id}
                  category={category}
                  sops={getSopsForCategory(category.id)}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                  search={categorySearch[category.id] || ""}
                  onSearchChange={(value) => setCategorySearch(prev => ({ ...prev, [category.id]: value }))}
                  onCreateSop={() => { setCreateCategoryId(category.id); setCreateOpen(true); }}
                  onSelectSop={setSelectedSOP}
                  onCopySop={(id) => copyMutation.mutate(id)}
                  onMoveSop={(id) => { setMovingSopId(id); setMoveDialogOpen(true); }}
                  onArchiveSop={handleArchive}
                  onDeleteSop={(id) => {
                    if (confirm("Are you sure you want to delete this SOP?")) {
                      deleteMutation.mutate(id);
                    }
                  }}
                  isEditingName={editingCategoryId === category.id}
                  editingName={editingCategoryName}
                  onStartRename={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }}
                  onSaveRename={() => updateCategoryMutation.mutate({ id: category.id, name: editingCategoryName })}
                  onCancelRename={() => setEditingCategoryId(null)}
                  onNameChange={setEditingCategoryName}
                  onDeleteCategory={() => {
                    if (confirm("Delete this topic? SOPs within will become uncategorized.")) {
                      deleteCategoryMutation.mutate(category.id);
                    }
                  }}
                />
              ))}

              {getUncategorizedSops().length > 0 && (
                <Card className="border-dashed">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm text-muted-foreground">Uncategorized</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {getUncategorizedSops().map(sop => (
                      <SopListItem
                        key={sop.id}
                        sop={sop}
                        onSelect={() => setSelectedSOP(sop)}
                        onCopy={() => copyMutation.mutate(sop.id)}
                        onMove={() => { setMovingSopId(sop.id); setMoveDialogOpen(true); }}
                        onArchive={() => handleArchive(sop)}
                        onDelete={() => {
                          if (confirm("Are you sure you want to delete this SOP?")) {
                            deleteMutation.mutate(sop.id);
                          }
                        }}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {categories.length === 0 && sops.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No SOPs Yet</h3>
                    <p className="text-muted-foreground mb-4 text-center">
                      Create your first topic and start adding procedures.
                    </p>
                    <Button onClick={() => setNewCategoryOpen(true)}>
                      <FolderPlus className="h-4 w-4 mr-2" /> Create Topic
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4 mt-6">
          <div>
            <p className="text-muted-foreground text-sm mb-4">
              SOPs you started but haven't finished yet. Resume where you left off.
            </p>
          </div>
          {drafts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-muted-foreground">No drafts saved</p>
                <p className="text-sm text-muted-foreground mt-1">When you save an SOP to drafts, it will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drafts.map((draft) => {
                const draftData = draft.data as SOPBuilderData;
                const sopTypeLabel = draft.sopType ? {
                  standard: "Standard Procedure", safety: "Safety Procedure",
                  maintenance: "Maintenance", training: "Training Guide",
                  quality: "Quality Control", emergency: "Emergency Response",
                }[draft.sopType] || draft.sopType : null;

                return (
                  <Card key={draft.id} className="hover:shadow-md transition-all" data-testid={`draft-card-${draft.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{draft.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {sopTypeLabel && <Badge variant="outline" className="text-xs">{sopTypeLabel}</Badge>}
                            <Badge variant="secondary" className="text-xs">Step {(draft.currentStep || 0) + 1} of 9</Badge>
                          </div>
                          {draft.updatedAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Last edited: {new Date(draft.updatedAt).toLocaleDateString()} at {new Date(draft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBuilderInitialData({ ...draftData, draftId: Number(draft.id) });
                              setShowBuilder(true);
                            }}
                            className="gap-1"
                            data-testid={`btn-resume-draft-${draft.id}`}
                          >
                            <PlayCircle className="h-3.5 w-3.5" /> Resume
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              try {
                                await apiRequest("DELETE", `/api/sop-drafts/${draft.id}`);
                                queryClient.invalidateQueries({ queryKey: ["/api/sop-drafts"] });
                                toast({ title: "Draft deleted" });
                              } catch {
                                toast({ title: "Failed to delete draft", variant: "destructive" });
                              }
                            }}
                            data-testid={`btn-delete-draft-${draft.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground text-sm">
              Create templates to quickly build SOPs with pre-filled content
            </p>
            <Button onClick={() => setTemplateDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> New Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Create templates to quickly generate SOPs with pre-filled sections.
                </p>
                <Button onClick={() => setTemplateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(template => (
                <Card key={template.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleCreateFromTemplate(template)}>
                            <FileText className="h-4 w-4 mr-2" /> Create SOP from Template
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              if (confirm("Delete this template?")) {
                                deleteTemplateMutation.mutate(template.id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => handleCreateFromTemplate(template)}
                    >
                      <FileText className="h-4 w-4 mr-2" /> Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="examples" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground text-sm">
              Save external SOP examples for reference and training
            </p>
            <Button onClick={() => setExampleDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Save Example
            </Button>
          </div>

          {examples.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookMarked className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Examples Saved</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Save SOPs you find online for employees to reference as examples.
                </p>
                <Button onClick={() => setExampleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Save Example
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {examples.map(example => (
                <Card key={example.id} className="group">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{example.title}</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-destructive"
                        onClick={() => {
                          if (confirm("Delete this example?")) {
                            deleteExampleMutation.mutate(example.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {example.description && (
                      <CardDescription>{example.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {example.sourceUrl && (
                      <a 
                        href={example.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" /> View Source
                      </a>
                    )}
                    {example.sourceFile && (
                      <a 
                        href={example.sourceFile} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <File className="h-4 w-4" /> View Document
                      </a>
                    )}
                    {example.notes && (
                      <p className="text-sm text-muted-foreground">{example.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create SOP Dialog */}
      <CreateSOPDialog 
        open={createOpen} 
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateCategoryId(null); }} 
        onSubmit={(data) => createMutation.mutate({ ...data, ownerId: user?.id, categoryId: createCategoryId || undefined })}
        isPending={createMutation.isPending}
        categories={categories}
        defaultCategoryId={createCategoryId}
      />

      {/* New Category Dialog */}
      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
            <DialogDescription>Add a new main topic to organize your SOPs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="categoryName">Topic Name</Label>
              <Input
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Safety Procedures"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCategoryOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createCategoryMutation.mutate(newCategoryName)} 
              disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <CreateTemplateDialog 
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSubmit={(data) => createTemplateMutation.mutate(data)}
        isPending={createTemplateMutation.isPending}
        categories={categories}
      />

      {/* Example Dialog */}
      <CreateExampleDialog 
        open={exampleDialogOpen}
        onOpenChange={setExampleDialogOpen}
        onSubmit={(data) => createExampleMutation.mutate(data)}
        isPending={createExampleMutation.isPending}
        categories={categories}
      />

      {/* Move SOP Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move SOP</DialogTitle>
            <DialogDescription>Select the topic to move this SOP to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {categories.map(cat => (
              <Button
                key={cat.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => movingSopId && handleMove(movingSopId, cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiGenerateOpen} onOpenChange={setAiGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate SOP with AI
            </DialogTitle>
            <DialogDescription>
              Describe the procedure you need and AI will create a comprehensive SOP for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiPrompt">What procedure do you need?</Label>
              <Textarea
                id="aiPrompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Morning safety check procedure for crew members before starting work"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiGenerateOpen(false)}>Cancel</Button>
            <Button onClick={handleAIGenerate} disabled={aiGenerating || !aiPrompt.trim()}>
              {aiGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryDropdown({
  category,
  sops,
  isExpanded,
  onToggle,
  search,
  onSearchChange,
  onCreateSop,
  onSelectSop,
  onCopySop,
  onMoveSop,
  onArchiveSop,
  onDeleteSop,
  isEditingName,
  editingName,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onNameChange,
  onDeleteCategory,
}: {
  category: SopCategory;
  sops: Sop[];
  isExpanded: boolean;
  onToggle: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onCreateSop: () => void;
  onSelectSop: (sop: Sop) => void;
  onCopySop: (id: string) => void;
  onMoveSop: (id: string) => void;
  onArchiveSop: (sop: Sop) => void;
  onDeleteSop: (id: string) => void;
  isEditingName: boolean;
  editingName: string;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onNameChange: (value: string) => void;
  onDeleteCategory: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <div className="flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-1 h-auto">
              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </Button>
          </CollapsibleTrigger>
          
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editingName}
                onChange={(e) => onNameChange(e.target.value)}
                className="h-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveRename();
                  if (e.key === "Escape") onCancelRename();
                }}
              />
              <Button size="sm" variant="ghost" onClick={onSaveRename} className="h-8 w-8 p-0">
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelRename} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <span 
                className="font-medium flex-1 cursor-pointer" 
                onClick={onToggle}
                onDoubleClick={onStartRename}
              >
                {category.name}
              </span>
              <Badge variant="secondary" className="ml-2">{sops.length}</Badge>
            </>
          )}
          
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onCreateSop} className="h-8 w-8 p-0" title="Add SOP">
              <Plus className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onStartRename}>
                  <Pencil className="h-4 w-4 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCreateSop}>
                  <Plus className="h-4 w-4 mr-2" /> New SOP
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDeleteCategory} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Topic
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in this topic..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            {sops.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No SOPs in this topic yet. Click + to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {sops.map(sop => (
                  <SopListItem
                    key={sop.id}
                    sop={sop}
                    onSelect={() => onSelectSop(sop)}
                    onCopy={() => onCopySop(sop.id)}
                    onMove={() => onMoveSop(sop.id)}
                    onArchive={() => onArchiveSop(sop)}
                    onDelete={() => onDeleteSop(sop.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SopListItem({
  sop,
  onSelect,
  onCopy,
  onMove,
  onArchive,
  onDelete,
}: {
  sop: Sop;
  onSelect: () => void;
  onCopy: () => void;
  onMove: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
      onClick={onSelect}
      data-testid={`sop-item-${sop.id}`}
    >
      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{sop.title}</span>
          {sop.isArchived && <Badge variant="secondary" className="text-xs">Archived</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {sop.lastUpdated ? new Date(sop.lastUpdated).toLocaleDateString() : ""}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(); }}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
            <Move className="h-4 w-4 mr-2" /> Move
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
            <Archive className="h-4 w-4 mr-2" /> {sop.isArchived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={(e) => { e.stopPropagation(); onDelete(); }} 
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateSOPDialog({ 
  open, 
  onOpenChange, 
  onSubmit,
  isPending,
  categories,
  defaultCategoryId,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; category: string; categoryId?: string; content: string }) => void;
  isPending: boolean;
  categories: SopCategory[];
  defaultCategoryId?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");
  const [content, setContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (defaultCategoryId) {
      setCategoryId(defaultCategoryId);
    }
  }, [defaultCategoryId]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
        credentials: "include",
      });
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      
      let insertHtml: string;
      if (file.type.startsWith("image/")) {
        insertHtml = `<img src="${objectPath}" alt="${file.name}" style="max-width: 100%; height: auto; margin: 1rem 0;" />\n`;
      } else {
        insertHtml = `<p><a href="${objectPath}" target="_blank" rel="noopener">📄 ${file.name}</a></p>\n`;
      }
      
      setContent(prev => prev + insertHtml);
      toast({ title: "File uploaded successfully" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category = categories.find(c => c.id === categoryId);
    onSubmit({ 
      title, 
      category: category?.name || "General", 
      categoryId: categoryId || undefined,
      content 
    });
    setTitle("");
    setCategoryId("");
    setContent("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create New SOP</DialogTitle>
          <DialogDescription>
            Create a new standard operating procedure with text, images, documents, and links.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input 
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Safety Check" 
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Topic</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content</Label>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileUp className="h-4 w-4 mr-1" />}
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
              </div>
            </div>
            <Textarea 
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-48" 
              placeholder="Enter procedure steps, or upload documents and images..." 
              required
            />
            <p className="text-xs text-muted-foreground">
              Upload documents, images, or paste content. You can edit and format after creating.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create SOP
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<SopTemplate>) => void;
  isPending: boolean;
  categories: SopCategory[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description, content, categoryId: categoryId || undefined });
    setName("");
    setDescription("");
    setContent("");
    setCategoryId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create SOP Template</DialogTitle>
          <DialogDescription>
            Create a reusable template with pre-filled sections for quick SOP creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label htmlFor="templateName">Template Name</Label>
            <Input 
              id="templateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Equipment Inspection Template" 
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="templateDesc">Description (optional)</Label>
            <Input 
              id="templateDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of when to use this template" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="templateCategory">Default Topic (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="templateContent">Template Content</Label>
            <Textarea 
              id="templateContent"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-48" 
              placeholder="<h2>Purpose</h2>&#10;[Describe the purpose of this procedure]&#10;&#10;<h2>Steps</h2>&#10;<ol>&#10;<li>Step 1</li>&#10;<li>Step 2</li>&#10;</ol>" 
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateExampleDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<SopExample>) => void;
  isPending: boolean;
  categories: SopCategory[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFile, setSourceFile] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
        credentials: "include",
      });
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      
      setSourceFile(objectPath);
      toast({ title: "Document uploaded successfully" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ 
      title, 
      description, 
      sourceUrl: sourceUrl || undefined, 
      sourceFile: sourceFile || undefined,
      categoryId: categoryId || undefined,
      notes: notes || undefined,
    });
    setTitle("");
    setDescription("");
    setSourceUrl("");
    setSourceFile("");
    setCategoryId("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Save Example SOP</DialogTitle>
          <DialogDescription>
            Save an external SOP example for employees to reference and learn from.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label htmlFor="exampleTitle">Title</Label>
            <Input 
              id="exampleTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. OSHA Safety Checklist Example" 
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exampleDesc">Description (optional)</Label>
            <Input 
              id="exampleDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this example" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exampleUrl">Source URL (optional)</Label>
            <Input 
              id="exampleUrl"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/sop-document" 
            />
          </div>
          <div className="grid gap-2">
            <Label>Or Upload Document</Label>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileUp className="h-4 w-4 mr-2" />
                )}
                {sourceFile ? "Document Uploaded" : "Upload Document"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exampleCategory">Related Topic (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exampleNotes">Notes (optional)</Label>
            <Textarea 
              id="exampleNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this example..." 
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Example
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SOPEditor({ 
  sop, 
  categories,
  onSave, 
  onCancel,
  isSaving 
}: { 
  sop: Sop; 
  categories: SopCategory[];
  onSave: (data: Partial<Sop>) => void; 
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(sop.title);
  const [categoryId, setCategoryId] = useState(sop.categoryId || "");
  const [content, setContent] = useState(sop.content);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
        credentials: "include",
      });
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      
      let insertHtml: string;
      if (file.type.startsWith("image/")) {
        insertHtml = `\n<img src="${objectPath}" alt="${file.name}" style="max-width: 100%; height: auto; margin: 1rem 0;" />\n`;
      } else {
        insertHtml = `\n<p><a href="${objectPath}" target="_blank" rel="noopener">📄 ${file.name}</a></p>\n`;
      }
      
      setContent(content + insertHtml);
      toast({ title: "File uploaded successfully" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      const text = prompt("Enter link text:", url);
      const linkTag = `<a href="${url}" target="_blank" rel="noopener">${text || url}</a>`;
      insertAtCursor(linkTag);
    }
  };

  const insertAtCursor = (insertText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(content + insertText);
      return;
    }
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + insertText + content.substring(end);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
      textarea.focus();
    }, 0);
  };

  const formatText = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      toast({ title: "Editor not ready", variant: "destructive" });
      return;
    }
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end) {
      const placeholder = tag === "h2" || tag === "h3" ? "Heading" : "text";
      const formatted = `<${tag}>${placeholder}</${tag}>`;
      insertAtCursor(formatted);
      return;
    }
    
    const selectedText = content.substring(start, end);
    const formatted = `<${tag}>${selectedText}</${tag}>`;
    const newContent = content.substring(0, start) + formatted + content.substring(end);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.selectionStart = start;
      textarea.selectionEnd = start + formatted.length;
      textarea.focus();
    }, 0);
  };

  const insertListItem = () => {
    insertAtCursor("\n<li></li>");
  };

  const handleSave = () => {
    const category = categories.find(c => c.id === categoryId);
    onSave({ 
      title, 
      category: category?.name || sop.category, 
      categoryId: categoryId || undefined,
      content 
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onCancel} className="pl-0 gap-2 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" /> Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-sop">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Label htmlFor="editTitle">Title</Label>
            <Input 
              id="editTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold"
              data-testid="input-sop-title"
            />
          </div>
          <div>
            <Label htmlFor="editCategory">Topic</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="py-3 border-b">
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs text-muted-foreground mr-2">Format:</span>
              <Button variant="outline" size="sm" onClick={() => formatText("strong")} title="Bold">
                <strong>B</strong>
              </Button>
              <Button variant="outline" size="sm" onClick={() => formatText("em")} title="Italic">
                <em>I</em>
              </Button>
              <Button variant="outline" size="sm" onClick={() => formatText("u")} title="Underline">
                <u>U</u>
              </Button>
              <Button variant="outline" size="sm" onClick={() => formatText("h2")} title="Heading 2">
                H2
              </Button>
              <Button variant="outline" size="sm" onClick={() => formatText("h3")} title="Heading 3">
                H3
              </Button>
              <Button variant="outline" size="sm" onClick={insertListItem} title="List Item">
                •
              </Button>
              <div className="border-l mx-2 h-6" />
              <span className="text-xs text-muted-foreground mr-2">Insert:</span>
              <Button variant="outline" size="sm" onClick={insertLink} title="Insert Link">
                <Link2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload Image or Document">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Enter your procedure content here. Select text and use the toolbar to format, or type HTML directly."
              data-testid="textarea-sop-content"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Tip: Select text and click a format button, or type HTML directly. Supports images, PDFs, and documents.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
