import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ArrowLeft, Edit, Trash2, Sparkles, Upload, FileText, Image, Link2, Loader2, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Sop } from "@shared/schema";

const CATEGORIES = ["Operations", "Sales", "Installation", "Equipment", "Safety", "HR", "Customer Service", "General"];

export default function SOPs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedSOP, setSelectedSOP] = useState<Sop | null>(null);
  const [editingSOP, setEditingSOP] = useState<Sop | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const { data: sops = [], isLoading } = useQuery<Sop[]>({
    queryKey: ["/api/sops"],
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

  const filtered = sops.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase()) || 
    s.category.toLowerCase().includes(search.toLowerCase())
  );

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
      });
      
      setAiGenerateOpen(false);
      setAiPrompt("");
    } catch (err) {
      toast({ title: "AI generation failed", variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  if (editingSOP) {
    return <SOPEditor sop={editingSOP} onSave={(data) => updateMutation.mutate({ id: editingSOP.id, data })} onCancel={() => setEditingSOP(null)} isSaving={updateMutation.isPending} />;
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
              <h1 className="text-4xl font-heading font-bold text-primary">{selectedSOP.title}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {selectedSOP.lastUpdated ? new Date(selectedSOP.lastUpdated).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingSOP(selectedSOP)} data-testid="button-edit-sop">
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  if (confirm("Are you sure you want to delete this SOP?")) {
                    deleteMutation.mutate(selectedSOP.id);
                  }
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">SOP Library</h1>
          <p className="text-muted-foreground">Standard Operating Procedures & Knowledge Base</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiGenerateOpen(true)} className="gap-2" data-testid="button-ai-generate-sop">
            <Sparkles className="w-4 h-4" /> Generate with AI
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)} data-testid="button-new-sop">
            <Plus className="w-4 h-4" /> New SOP
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search procedures..." 
          className="pl-9 max-w-md bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No SOPs Found</h3>
            <p className="text-muted-foreground mb-4">
              {search ? "No procedures match your search." : "Create your first standard operating procedure."}
            </p>
            {!search && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create SOP
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(sop => (
            <Card 
              key={sop.id} 
              className="group hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary/0 hover:border-l-primary"
              onClick={() => setSelectedSOP(sop)}
              data-testid={`sop-card-${sop.id}`}
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary">{sop.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {sop.lastUpdated ? new Date(sop.lastUpdated).toLocaleDateString() : ""}
                  </span>
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">{sop.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {sop.content.replace(/<[^>]*>?/gm, '')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateSOPDialog 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
        onSubmit={(data) => createMutation.mutate({ ...data, ownerId: user?.id })}
        isPending={createMutation.isPending}
      />

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

function CreateSOPDialog({ 
  open, 
  onOpenChange, 
  onSubmit,
  isPending 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; category: string; content: string }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, category, content });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Procedure</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
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
          <div className="grid gap-2">
            <Label htmlFor="content">Content</Label>
            <Textarea 
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-40" 
              placeholder="Step 1: ..." 
              required
            />
            <p className="text-xs text-muted-foreground">You can edit and format this content after creating the SOP.</p>
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

function SOPEditor({ 
  sop, 
  onSave, 
  onCancel,
  isSaving 
}: { 
  sop: Sop; 
  onSave: (data: Partial<Sop>) => void; 
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(sop.title);
  const [category, setCategory] = useState(sop.category);
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onCancel} className="pl-0 gap-2 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" /> Cancel
        </Button>
        <Button onClick={() => onSave({ title, category, content })} disabled={isSaving} data-testid="button-save-sop">
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
            <Label htmlFor="editCategory">Category</Label>
            <Select value={category} onValueChange={setCategory}>
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
