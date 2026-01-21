import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Copy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type FormField = {
  id: string;
  type: "text" | "textarea" | "number" | "email" | "date" | "select" | "checkbox" | "radio";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
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
};

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
  const [accessLevel, setAccessLevel] = useState(form.accessLevel);
  const [selectedField, setSelectedField] = useState<FormField | null>(null);

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
      const res = await apiRequest("PATCH", `/api/forms/${form.id}`, { isPublished: true });
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
      label: `New ${type} field`,
      required: false,
      options: type === "select" || type === "radio" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
    setSelectedField(newField);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    if (selectedField?.id === id) {
      setSelectedField({ ...selectedField, ...updates });
    }
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedField?.id === id) setSelectedField(null);
  };

  const handleSave = () => {
    mutation.mutate({ title, description, fields, accessLevel });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Form Builder - {title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
          <div className="col-span-1 space-y-4 overflow-y-auto">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Add Field</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {fieldTypes.map(({ type, label, icon: Icon }) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => addField(type)}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-2 overflow-y-auto">
            <Card className="h-full">
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-bold text-lg border-0 p-0 h-auto focus-visible:ring-0"
                  placeholder="Form Title"
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Form description..."
                  className="text-sm resize-none"
                  rows={2}
                />
                {fields.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>Add fields from the left panel</p>
                  </div>
                ) : (
                  fields.map((field) => (
                    <div
                      key={field.id}
                      className={`group flex gap-2 items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedField?.id === field.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedField(field)}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move mt-2" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label className="font-medium">{field.label}</Label>
                          {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                        </div>
                        <FieldPreview field={field} />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-1 space-y-4 overflow-y-auto">
            {selectedField ? (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Field Properties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={selectedField.label}
                      onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Placeholder</Label>
                    <Input
                      value={selectedField.placeholder || ""}
                      onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedField.required}
                      onCheckedChange={(checked) => updateField(selectedField.id, { required: !!checked })}
                    />
                    <Label className="text-sm">Required field</Label>
                  </div>
                  {(selectedField.type === "select" || selectedField.type === "radio") && (
                    <div className="space-y-1">
                      <Label className="text-xs">Options (one per line)</Label>
                      <Textarea
                        value={(selectedField.options || []).join("\n")}
                        onChange={(e) => updateField(selectedField.id, { options: e.target.value.split("\n").filter(Boolean) })}
                        rows={4}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  <p className="text-sm">Select a field to edit its properties</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Form Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Access Level</Label>
                  <Select value={accessLevel} onValueChange={setAccessLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Customer">Customer</SelectItem>
                      <SelectItem value="Crew">Crew</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Admin">Admin Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" /> Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Draft
            </Button>
            <Button onClick={() => { handleSave(); publishMutation.mutate(); }} disabled={publishMutation.isPending || fields.length === 0}>
              {publishMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Publish Form
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
