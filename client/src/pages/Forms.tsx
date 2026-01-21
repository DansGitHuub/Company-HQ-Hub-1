import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Settings, 
  Trash2, 
  GripVertical, 
  CheckSquare, 
  Type, 
  ChevronDown,
  Eye,
  Share2,
  Loader2,
  Edit,
  FileText,
  Calendar,
  Mail,
  Hash,
  ListOrdered,
  ToggleLeft,
  AlignLeft,
  Save,
  X,
  Copy,
  Sparkles,
  Palette,
  Minus,
  MoreHorizontal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type FormField = {
  id: string;
  type: "text" | "textarea" | "number" | "email" | "date" | "select" | "checkbox" | "radio" | "separator";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
};

type FormStyling = {
  fontFamily: string;
  fontSize: string;
  showBorder: boolean;
  borderStyle: string;
};

type CustomForm = {
  id: string;
  title: string;
  description?: string;
  category: string;
  fields: FormField[];
  accessLevel: string;
  isPublished: boolean;
  createdAt: string;
  styling?: FormStyling;
};

const FONT_OPTIONS = [
  { value: "system-ui, sans-serif", label: "System Default" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Georgia', serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Arial', sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', sans-serif", label: "Helvetica" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
];

const FONT_SIZES = [
  { value: "text-sm", label: "Small" },
  { value: "text-base", label: "Medium" },
  { value: "text-lg", label: "Large" },
];

const BORDER_STYLES = [
  { value: "none", label: "None" },
  { value: "simple", label: "Simple Line" },
  { value: "rounded", label: "Rounded" },
  { value: "shadow", label: "Shadow" },
];

const ACCESS_LEVELS = [
  { value: "All", label: "All Users", description: "Anyone can fill out this form" },
  { value: "Customer", label: "Customers Only", description: "Only customer accounts" },
  { value: "Crew", label: "Crew & Above", description: "Crew, Managers, and Admins" },
  { value: "Manager", label: "Managers & Admins", description: "Managers and Admin only" },
  { value: "Admin", label: "Admins Only", description: "Only Admin users" },
];

type FormSubmission = {
  id: string;
  formId: string;
  submittedBy: string;
  data: Record<string, any>;
  status: string;
  createdAt: string;
};

const fieldTypes = [
  { type: "text", label: "Text Input", icon: Type },
  { type: "textarea", label: "Long Text", icon: AlignLeft },
  { type: "number", label: "Number", icon: Hash },
  { type: "email", label: "Email", icon: Mail },
  { type: "date", label: "Date", icon: Calendar },
  { type: "select", label: "Dropdown", icon: ChevronDown },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "radio", label: "Radio Buttons", icon: ListOrdered },
  { type: "separator", label: "Section Divider", icon: Minus },
];

export default function Forms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<CustomForm | null>(null);
  const [previewForm, setPreviewForm] = useState<CustomForm | null>(null);
  const [fillForm, setFillForm] = useState<CustomForm | null>(null);
  const isAdmin = user?.role === "Admin";

  const { data: forms = [], isLoading } = useQuery<CustomForm[]>({
    queryKey: ["/api/forms"],
  });

  const { data: allSubmissions = [] } = useQuery<FormSubmission[]>({
    queryKey: ["/api/submissions"],
    enabled: isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Form deleted" });
    },
  });

  const publishedForms = forms.filter(f => f.isPublished);
  const draftForms = forms.filter(f => !f.isPublished);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Forms Library</h1>
          <p className="text-muted-foreground">Create and manage digital forms for hiring, compliance, and operations</p>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={() => setCreateOpen(true)} data-testid="button-new-form">
            <Plus className="w-4 h-4"/> New Form
          </Button>
        )}
      </div>

      <Tabs defaultValue="library" className="w-full">
        <TabsList>
          <TabsTrigger value="library">Form Library</TabsTrigger>
          {isAdmin && <TabsTrigger value="drafts">Drafts ({draftForms.length})</TabsTrigger>}
          {isAdmin && <TabsTrigger value="submissions">Submissions</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="library" className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : publishedForms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No published forms yet</p>
              {isAdmin && (
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  Create Your First Form
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {publishedForms.map((form) => (
                <Card key={form.id} className="hover:shadow-md transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{form.title}</CardTitle>
                        <CardDescription>{form.description || "No description"}</CardDescription>
                      </div>
                      <Badge variant="outline">{form.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {(form.fields as FormField[]).length} fields · Access: {form.accessLevel}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setFillForm(form)}
                      >
                        <Edit className="w-4 h-4 mr-2"/> Fill Form
                      </Button>
                      {isAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingForm(form)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="drafts" className="mt-6">
            {draftForms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No draft forms</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {draftForms.map((form) => (
                  <Card key={form.id} className="hover:shadow-md transition-all border-dashed">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{form.title}</CardTitle>
                          <CardDescription>{form.description || "No description"}</CardDescription>
                        </div>
                        <Badge variant="secondary">Draft</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {(form.fields as FormField[]).length} fields
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setEditingForm(form)}
                        >
                          <Edit className="w-4 h-4 mr-2"/> Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteMutation.mutate(form.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="submissions" className="mt-6">
            <SubmissionsView forms={forms} />
          </TabsContent>
        )}
      </Tabs>

      <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      
      {editingForm && (
        <FormBuilderDialog 
          form={editingForm} 
          open={!!editingForm} 
          onOpenChange={(open) => !open && setEditingForm(null)} 
        />
      )}

      {fillForm && (
        <FillFormDialog
          form={fillForm}
          open={!!fillForm}
          onOpenChange={(open) => !open && setFillForm(null)}
        />
      )}
    </div>
  );
}

function CreateFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/forms", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Form created", description: "Now add fields to your form" });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setCategory("General");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ title, description, category, fields: [], isPublished: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Form</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Form Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Job Application, W-9, Vehicle Inspection"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this form's purpose"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Hiring">Hiring & HR</SelectItem>
                <SelectItem value="Compliance">Compliance</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Customer">Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Form
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormBuilderDialog({ form, open, onOpenChange }: { form: CustomForm; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [fields, setFields] = useState<FormField[]>(form.fields as FormField[] || []);
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description || "");
  const [accessLevel, setAccessLevel] = useState(form.accessLevel || "All");
  const [styling, setStyling] = useState<FormStyling>(form.styling || {
    fontFamily: "system-ui, sans-serif",
    fontSize: "text-base",
    showBorder: true,
    borderStyle: "rounded",
  });
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "style" | "settings">("fields");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/forms/${form.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Form saved" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/forms/${form.id}`, { isPublished: true, fields, title, description, accessLevel, styling });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Form published" });
      onOpenChange(false);
    },
  });

  const addField = (type: string) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: type as FormField["type"],
      label: type === "separator" ? "" : `New ${type} field`,
      required: false,
      placeholder: type === "separator" ? "" : `Enter ${type}...`,
      options: type === "select" || type === "radio" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
    if (type !== "separator") {
      setEditingFieldId(newField.id);
    }
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (editingFieldId === id) setEditingFieldId(null);
  };

  const handleSave = () => {
    mutation.mutate({ title, description, fields, accessLevel, styling });
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!res.ok) throw new Error("AI generation failed");
      const data = await res.json();
      if (data.fields && Array.isArray(data.fields)) {
        const newFields: FormField[] = data.fields.map((f: any) => ({
          id: crypto.randomUUID(),
          type: f.type || "text",
          label: f.label || "Field",
          placeholder: f.placeholder || "",
          required: f.required || false,
          options: f.options,
        }));
        setFields([...fields, ...newFields]);
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        toast({ title: "AI generated fields added!" });
      }
      setShowAiDialog(false);
      setAiPrompt("");
    } catch (err) {
      toast({ title: "AI generation failed", variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const getBorderClass = () => {
    switch (styling.borderStyle) {
      case "none": return "";
      case "simple": return "border";
      case "rounded": return "border rounded-lg";
      case "shadow": return "border rounded-lg shadow-md";
      default: return "border rounded-lg";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-semibold">Form Builder</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAiDialog(true)}>
              <Sparkles className="w-4 h-4 mr-2" /> Generate with AI
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
            <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending || fields.length === 0}>
              {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Publish
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-56 border-r bg-muted/20 p-3 overflow-y-auto">
            <div className="space-y-1 mb-4">
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeTab === "fields" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setActiveTab("fields")}
              >
                <Plus className="w-4 h-4 inline mr-2" /> Add Fields
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeTab === "style" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setActiveTab("style")}
              >
                <Palette className="w-4 h-4 inline mr-2" /> Style
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeTab === "settings" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setActiveTab("settings")}
              >
                <Settings className="w-4 h-4 inline mr-2" /> Settings
              </button>
            </div>

            {activeTab === "fields" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-2 mb-2">Click to add field</p>
                {fieldTypes.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors flex items-center gap-2"
                    onClick={() => addField(type)}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" /> {label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "style" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Font Family</Label>
                  <Select value={styling.fontFamily} onValueChange={(v) => setStyling({...styling, fontFamily: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Font Size</Label>
                  <Select value={styling.fontSize} onValueChange={(v) => setStyling({...styling, fontSize: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZES.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Border Style</Label>
                  <Select value={styling.borderStyle} onValueChange={(v) => setStyling({...styling, borderStyle: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BORDER_STYLES.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Intended For</Label>
                  <Select value={accessLevel} onValueChange={setAccessLevel}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map(a => (
                        <SelectItem key={a.value} value={a.value}>
                          <div>
                            <div className="font-medium">{a.label}</div>
                            <div className="text-xs text-muted-foreground">{a.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            <div 
              className={`max-w-2xl mx-auto bg-background p-6 ${getBorderClass()}`}
              style={{ fontFamily: styling.fontFamily }}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold border-0 border-b rounded-none px-0 h-auto pb-2 focus-visible:ring-0 bg-transparent"
                placeholder="Form Title - click to edit"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for this form..."
                className="mt-2 border-0 px-0 resize-none focus-visible:ring-0 bg-transparent text-muted-foreground"
                rows={2}
              />

              <Separator className="my-4" />

              {fields.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Plus className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Start building your form</p>
                  <p className="text-sm mt-1">Add fields from the sidebar, or use AI to generate</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field) => (
                    <InlineEditableField
                      key={field.id}
                      field={field}
                      isEditing={editingFieldId === field.id}
                      onStartEdit={() => setEditingFieldId(field.id)}
                      onStopEdit={() => setEditingFieldId(null)}
                      onUpdate={(updates) => updateField(field.id, updates)}
                      onDelete={() => removeField(field.id)}
                      fontSize={styling.fontSize}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generate Form with AI
              </DialogTitle>
              <DialogDescription>
                Describe the form you need and AI will create the fields for you
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., Create a job application form with name, email, phone, resume upload, and work experience..."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAiDialog(false)}>Cancel</Button>
              <Button onClick={generateWithAI} disabled={aiGenerating || !aiPrompt.trim()}>
                {aiGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Fields
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function InlineEditableField({
  field,
  isEditing,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
  fontSize,
}: {
  field: FormField;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  fontSize: string;
}) {
  if (field.type === "separator") {
    return (
      <div className="group relative py-2">
        <Separator className="my-2" />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 h-6 w-6"
          onClick={onDelete}
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={`p-4 border-2 border-primary rounded-lg bg-primary/5 space-y-3 ${fontSize}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Field Label</Label>
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                className="mt-1 font-medium"
                placeholder="Enter label..."
                autoFocus
              />
            </div>
            {field.type !== "checkbox" && (
              <div>
                <Label className="text-xs text-muted-foreground">Placeholder</Label>
                <Input
                  value={field.placeholder || ""}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                  className="mt-1"
                  placeholder="Hint text..."
                />
              </div>
            )}
            {(field.type === "select" || field.type === "radio") && (
              <div>
                <Label className="text-xs text-muted-foreground">Options (one per line)</Label>
                <Textarea
                  value={(field.options || []).join("\n")}
                  onChange={(e) => onUpdate({ options: e.target.value.split("\n").filter(Boolean) })}
                  rows={3}
                  className="mt-1"
                  placeholder="Option 1&#10;Option 2"
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={field.required}
                  onCheckedChange={(checked) => onUpdate({ required: !!checked })}
                />
                <Label className="text-sm">Required</Label>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
          <Button size="sm" onClick={onStopEdit}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-all hover:bg-muted/30 ${fontSize}`}
      onClick={onStartEdit}
    >
      <div className="flex items-start justify-between mb-2">
        <Label className="font-medium flex items-center gap-2">
          {field.label}
          {field.required && <span className="text-destructive text-xs">*</span>}
        </Label>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge variant="secondary" className="text-xs">{field.type}</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </div>
      <FieldPreview field={field} />
      <p className="text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        Click to edit this field
      </p>
    </div>
  );
}

function FieldPreview({ field }: { field: FormField }) {
  switch (field.type) {
    case "text":
    case "email":
    case "number":
      return <Input disabled placeholder={field.placeholder || `Enter ${field.type}...`} className="h-8" />;
    case "textarea":
      return <Textarea disabled placeholder={field.placeholder} rows={2} className="resize-none" />;
    case "date":
      return <Input disabled type="date" className="h-8" />;
    case "select":
      return (
        <div className="h-8 w-full rounded-md border px-3 py-1 text-sm text-muted-foreground bg-muted/30">
          Select option...
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox disabled />
          <span className="text-sm text-muted-foreground">{field.placeholder || "Checkbox option"}</span>
        </div>
      );
    case "radio":
      return (
        <div className="space-y-1">
          {(field.options || ["Option 1", "Option 2"]).slice(0, 2).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-muted-foreground" />
              <span className="text-xs text-muted-foreground">{opt}</span>
            </div>
          ))}
        </div>
      );
    case "separator":
      return <Separator className="my-2" />;
    default:
      return null;
  }
}

function FillFormDialog({ form, open, onOpenChange }: { form: CustomForm; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const fields = form.fields as FormField[];

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/forms/${form.id}/submissions`, { data });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Form submitted successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error submitting form", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const updateValue = (fieldId: string, value: any) => {
    setFormData({ ...formData, [fieldId]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.title}</DialogTitle>
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.type === "text" && (
                <Input
                  value={formData[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              {field.type === "email" && (
                <Input
                  type="email"
                  value={formData[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              {field.type === "number" && (
                <Input
                  type="number"
                  value={formData[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              {field.type === "textarea" && (
                <Textarea
                  value={formData[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              {field.type === "date" && (
                <Input
                  type="date"
                  value={formData[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  required={field.required}
                />
              )}
              {field.type === "select" && (
                <Select value={formData[field.id] || ""} onValueChange={(v) => updateValue(field.id, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options || []).map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.type === "checkbox" && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData[field.id] || false}
                    onCheckedChange={(checked) => updateValue(field.id, checked)}
                  />
                  <span className="text-sm">{field.placeholder || "Yes"}</span>
                </div>
              )}
              {field.type === "radio" && (
                <div className="space-y-2">
                  {(field.options || []).map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={field.id}
                        value={opt}
                        checked={formData[field.id] === opt}
                        onChange={(e) => updateValue(field.id, e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{opt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Form
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionsView({ forms }: { forms: CustomForm[] }) {
  const [selectedFormId, setSelectedFormId] = useState<string>("");

  const { data: submissions = [], isLoading } = useQuery<FormSubmission[]>({
    queryKey: ["/api/forms", selectedFormId, "submissions"],
    queryFn: async () => {
      if (!selectedFormId) return [];
      const res = await fetch(`/api/forms/${selectedFormId}/submissions`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedFormId,
  });

  const selectedForm = forms.find(f => f.id === selectedFormId);
  const fields = (selectedForm?.fields as FormField[]) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label>Select Form:</Label>
        <Select value={selectedFormId} onValueChange={setSelectedFormId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a form..." />
          </SelectTrigger>
          <SelectContent>
            {forms.filter(f => f.isPublished).map((form) => (
              <SelectItem key={form.id} value={form.id}>{form.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedFormId && (
        isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No submissions yet for this form</p>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Date</th>
                    {fields.slice(0, 4).map((field) => (
                      <th key={field.id} className="text-left py-2 px-3">{field.label}</th>
                    ))}
                    <th className="text-left py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">{new Date(sub.createdAt).toLocaleDateString()}</td>
                      {fields.slice(0, 4).map((field) => (
                        <td key={field.id} className="py-2 px-3 max-w-[150px] truncate">
                          {String(sub.data[field.id] || "-")}
                        </td>
                      ))}
                      <td className="py-2 px-3">
                        <Badge variant={sub.status === "submitted" ? "secondary" : "default"}>
                          {sub.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
