import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
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
  Droplets,
  Wrench,
  FileUp,
  Eye
} from "lucide-react";

const CATEGORIES = ["Lawn Care", "Pruning", "Irrigation", "Hardscaping", "Seasonal", "Equipment", "General"];
const RESOURCE_TYPES = [
  { value: "guide", label: "Care Guide", icon: Leaf },
  { value: "instruction", label: "Instructions", icon: FileText },
  { value: "document", label: "Document", icon: FileUp },
];

export default function Education() {
  const { currentUser } = useApp();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === "Admin" || currentUser?.role === "Manager";

  const [activeTab, setActiveTab] = useState("guides");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<CustomerResource | null>(null);
  const [viewingResource, setViewingResource] = useState<CustomerResource | null>(null);
  const [uploadMode, setUploadMode] = useState(false);

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

  const savedResourceIds = new Set(savedResources.map(s => s.resourceId));

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
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resources/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete resource");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      toast({ title: "Resource deleted" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch(`/api/saved-resources/${resourceId}`, {
        method: "POST",
        credentials: "include",
      });
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
      const res = await fetch(`/api/saved-resources/${resourceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove saved resource");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-resources"] });
      toast({ title: "Removed from saved" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "guide",
      category: "General",
      content: "",
      fileUrl: "",
      fileName: "",
      isPublished: true,
    });
    setEditingResource(null);
    setUploadMode(false);
  };

  const openCreateDialog = (isUpload = false) => {
    resetForm();
    setUploadMode(isUpload);
    if (isUpload) {
      setFormData(prev => ({ ...prev, type: "document" }));
    }
    setEditDialogOpen(true);
  };

  const openEditDialog = (resource: CustomerResource) => {
    setEditingResource(resource);
    setUploadMode(!!resource.fileUrl);
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
    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formDataUpload,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setFormData(prev => ({
        ...prev,
        fileUrl: url,
        fileName: file.name,
      }));
      toast({ title: "File uploaded successfully" });
    } catch (err) {
      toast({ title: "Failed to upload file", variant: "destructive" });
    }
  };

  const toggleSave = (resourceId: string) => {
    if (savedResourceIds.has(resourceId)) {
      unsaveMutation.mutate(resourceId);
    } else {
      saveMutation.mutate(resourceId);
    }
  };

  const publishedResources = resources.filter(r => r.isPublished || isAdmin);
  const guides = publishedResources.filter(r => r.type === "guide");
  const instructions = publishedResources.filter(r => r.type === "instruction");
  const documents = publishedResources.filter(r => r.type === "document");
  const savedItems = publishedResources.filter(r => savedResourceIds.has(r.id));

  const faqData = [
    { q: "How long does a typical installation take?", a: "Residential projects usually take 1-2 weeks depending on scope and weather." },
    { q: "What is your warranty policy?", a: "We offer a 2-year warranty on all hardscape installations and a 1-year plant health guarantee." },
    { q: "Do I need to be home for the maintenance crew?", a: "No, as long as we have access to the gates and any pets are inside." },
    { q: "When should I water new sod?", a: "Water new sod twice daily for the first two weeks, then gradually reduce to deep watering every 2-3 days." },
    { q: "How often should I fertilize my lawn?", a: "We recommend fertilizing 4 times per year: early spring, late spring, summer, and fall." },
  ];

  const ResourceCard = ({ resource }: { resource: CustomerResource }) => {
    const isSaved = savedResourceIds.has(resource.id);
    const TypeIcon = RESOURCE_TYPES.find(t => t.value === resource.type)?.icon || FileText;

    return (
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer group relative"
        data-testid={`resource-card-${resource.id}`}
      >
        {!resource.isPublished && (
          <Badge className="absolute top-2 right-2 z-10" variant="secondary">Draft</Badge>
        )}
        <div 
          className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 rounded-t-xl flex items-center justify-center"
          onClick={() => {
            setViewingResource(resource);
            setViewDialogOpen(true);
          }}
        >
          <TypeIcon className="w-12 h-12 text-primary/40" />
        </div>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle 
              className="text-lg line-clamp-1 cursor-pointer hover:text-primary"
              onClick={() => {
                setViewingResource(resource);
                setViewDialogOpen(true);
              }}
            >
              {resource.title}
            </CardTitle>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{resource.category}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <CardDescription className="line-clamp-2">{resource.description || "No description"}</CardDescription>
        </CardContent>
        <CardFooter className="pt-0 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSave(resource.id)}
            data-testid={`save-resource-${resource.id}`}
          >
            {isSaved ? (
              <><BookmarkCheck className="w-4 h-4 mr-1 text-primary" /> Saved</>
            ) : (
              <><Bookmark className="w-4 h-4 mr-1" /> Save</>
            )}
          </Button>
          <div className="flex gap-1">
            {resource.fileUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
            {isAdmin && (
              <>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(resource)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => deleteMutation.mutate(resource.id)}
                  className="text-destructive hover:text-destructive"
                >
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
        items.map(resource => <ResourceCard key={resource.id} resource={resource} />)
      )}
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground" data-testid="page-title">Customer Hub</h1>
          <p className="text-xl text-muted-foreground">Everything you need to know about your landscape journey.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button onClick={() => openCreateDialog(false)} className="gap-2" data-testid="create-resource-btn">
                <Plus className="w-4 h-4" /> New Resource
              </Button>
              <Button variant="outline" onClick={() => openCreateDialog(true)} className="gap-2" data-testid="upload-document-btn">
                <Upload className="w-4 h-4" /> Upload Document
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="process">Our Process</TabsTrigger>
          <TabsTrigger value="guides">Care Guides</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="saved">
            <Bookmark className="w-4 h-4 mr-1" /> Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="mt-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {[
              { title: "Consultation", icon: HelpCircle, desc: "We discuss your vision and budget." },
              { title: "Design", icon: Map, desc: "Visualizing your dream outdoor space." },
              { title: "Install", icon: ShieldCheck, desc: "Expert crews bring the design to life." },
              { title: "Maintain", icon: Clock, desc: "Keeping your investment beautiful." }
            ].map((step, i) => (
              <div key={i} className="relative p-6 bg-card border rounded-xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                  {i + 1}
                </div>
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
                  <p className="text-primary-foreground/80">
                    Our crew will arrive between 7:30-8:00 AM. We'll start with a site walkthrough and material staging. Expect some noise and heavy equipment—it's all part of the magic!
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

          <div className="space-y-4 max-w-3xl">
            <h2 className="text-2xl font-heading font-bold">Frequently Asked Questions</h2>
            {faqData.map((item, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{item.a}</p>
                </CardContent>
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

        <TabsContent value="documents" className="mt-8">
          <ResourceGrid items={documents} emptyMessage="No documents have been uploaded yet." />
        </TabsContent>

        <TabsContent value="saved" className="mt-8">
          <ResourceGrid items={savedItems} emptyMessage="You haven't saved any resources yet. Click the bookmark icon on any resource to save it here." />
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit Resource" : uploadMode ? "Upload Document" : "Create Resource"}</DialogTitle>
            <DialogDescription>
              {uploadMode ? "Upload a PDF or document from the manufacturer" : "Create a care guide or instruction page"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.isPublished ? "published" : "draft"} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, isPublished: v === "published" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
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

            {uploadMode || formData.type === "document" ? (
              <div className="space-y-2">
                <Label>Document File</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  {formData.fileUrl ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{formData.fileName}</p>
                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setFormData(prev => ({ ...prev, fileUrl: "", fileName: "" }))}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">Upload PDF, Word, or other document</p>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="max-w-xs mx-auto"
                      />
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your care guide or instructions here..."
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  You can use markdown formatting. Use ## for headings, - for bullet points, **bold** for emphasis.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingResource ? "Save Changes" : "Create Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      <Badge variant="secondary">
                        {RESOURCE_TYPES.find(t => t.value === viewingResource.type)?.label}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSave(viewingResource.id)}
                  >
                    {savedResourceIds.has(viewingResource.id) ? (
                      <BookmarkCheck className="w-5 h-5 text-primary" />
                    ) : (
                      <Bookmark className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <DialogDescription>{viewingResource.description}</DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {viewingResource.fileUrl ? (
                  <div className="text-center py-8 border rounded-lg bg-muted/50">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-primary" />
                    <p className="font-medium mb-2">{viewingResource.fileName || "Document"}</p>
                    <Button asChild>
                      <a href={viewingResource.fileUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" /> Open Document
                      </a>
                    </Button>
                  </div>
                ) : viewingResource.content ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {viewingResource.content.split('\n').map((paragraph, i) => {
                      if (paragraph.startsWith('## ')) {
                        return <h2 key={i} className="text-xl font-bold mt-6 mb-2">{paragraph.slice(3)}</h2>;
                      }
                      if (paragraph.startsWith('### ')) {
                        return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{paragraph.slice(4)}</h3>;
                      }
                      if (paragraph.startsWith('- ')) {
                        return <li key={i} className="ml-4">{paragraph.slice(2)}</li>;
                      }
                      if (paragraph.trim() === '') return <br key={i} />;
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
                  <Button onClick={() => {
                    setViewDialogOpen(false);
                    openEditDialog(viewingResource);
                  }}>
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
