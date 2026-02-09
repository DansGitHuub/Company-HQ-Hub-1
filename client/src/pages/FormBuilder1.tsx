import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FormInput, Plus, Save, Share2, Download, Archive, RotateCcw,
  Trash2, X, GripVertical, ChevronRight, FileText, FolderArchive,
  Type, Mail, Phone, MapPin, AlignLeft, List, CheckSquare, Hash,
  Calendar, Clock, Upload, Image, Star, PenTool, CreditCard,
  Globe, Settings2, Zap, Link2, LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";

type FieldData = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label: { en: string; es: string };
  help: { en: string; es: string };
  options: { en: string; es: string }[];
  rules: { futureOnly?: boolean };
};

type PageData = {
  id: string;
  fields: FieldData[];
};

type FormData = {
  id?: string;
  name: string;
  language: string;
  exportTarget: string;
  pages: PageData[];
  archived?: boolean;
};

const PALETTE_GROUPS = [
  { id: "standard", title: "1. Standard Form Items", items: [
    "Header/Subheader", "Full Name", "Email", "Address", "Phone", "Short Text", "Long Text",
    "Dropdown", "Single Choice", "Multiple Choice", "Number", "Date Picker", "Time", "File Upload", "Image",
    "Paragraph", "Submit Button"
  ]},
  { id: "survey", title: "2. Survey & Data Items", items: [
    "Input Table", "Star Rating", "Scale Rating", "Spinner", "Fill In The Blank", "Signature"
  ]},
  { id: "payments", title: "3. Payment Processing Items", items: [
    "Product List", "Payment Gateway", "Purchase Order", "Shipping & Tax", "Coupons/Promo Codes", "Payment Authorization"
  ]},
  { id: "widgets", title: "4. Advanced Widgets", items: [
    "Appointment", "Configurable List", "Multiple Text Fields", "Take Photo", "Unique ID", "Form Calculation",
    "Draw Board", "Geolocation", "Terms & Conditions"
  ]},
  { id: "layout", title: "5. Page Layout Structure", items: [
    "Page Break", "Section Collapse", "Divider"
  ]},
  { id: "behind", title: "6. Behind-the-Scenes Features", items: [
    "Conditional Logic", "Input Masking", "Hidden Fields", "Pre-populate Fields", "Translation", "Custom CSS"
  ]},
  { id: "post", title: "7. Post Submission & Automation", items: [
    "Autoresponder Email", "Notification Email", "Thank You Page", "PDF Converter", "Approval Flows"
  ]},
  { id: "integrations", title: "8. Integrations", items: [
    "CRM: Salesforce", "CRM: HubSpot", "CRM: Zoho",
    "Cloud Storage: Google Drive", "Cloud Storage: Dropbox",
    "Project Mgmt: Trello", "Project Mgmt: Asana",
    "Email Marketing: Mailchimp", "Email Marketing: Constant Contact",
    "Accounting: QuickBooks", "Accounting: Xero",
    "Payments: Stripe", "Payments: PayPal", "Payments: Square",
    "E-Sign: DocuSign",
    "Calendar: Google Calendar", "Calendar: Outlook Calendar",
    "SMS: Twilio", "Chat: Slack", "Chat: Microsoft Teams",
    "Automation: Zapier", "Automation: Make.com",
    "Webhooks", "REST API"
  ]}
];

const FIELD_TYPE_MAP: Record<string, string> = {
  "Header/Subheader": "header", "Full Name": "fullName", "Email": "email",
  "Address": "address", "Phone": "phone", "Short Text": "shortText",
  "Long Text": "longText", "Dropdown": "dropdown", "Single Choice": "singleChoice",
  "Multiple Choice": "multipleChoice", "Number": "number", "Date Picker": "date",
  "Time": "time", "File Upload": "file", "Image": "image", "Paragraph": "paragraph",
  "Submit Button": "submit", "Input Table": "table", "Star Rating": "starRating",
  "Scale Rating": "scaleRating", "Spinner": "spinner", "Fill In The Blank": "fillBlank",
  "Signature": "signature", "Product List": "productList", "Payment Gateway": "paymentGateway",
  "Purchase Order": "purchaseOrder", "Shipping & Tax": "shippingTax",
  "Coupons/Promo Codes": "coupons", "Payment Authorization": "paymentAuth",
  "Appointment": "appointment", "Configurable List": "configList",
  "Multiple Text Fields": "multiText", "Take Photo": "takePhoto",
  "Unique ID": "uniqueId", "Form Calculation": "calculation",
  "Draw Board": "drawBoard", "Geolocation": "geolocation",
  "Terms & Conditions": "terms", "Page Break": "pageBreak",
  "Section Collapse": "section", "Divider": "divider",
  "Conditional Logic": "conditionalLogic", "Input Masking": "inputMasking",
  "Hidden Fields": "hidden", "Pre-populate Fields": "prepopulate",
  "Translation": "translation", "Custom CSS": "customCss",
  "Autoresponder Email": "autoresponder", "Notification Email": "notification",
  "Thank You Page": "thankYou", "PDF Converter": "pdfConverter",
  "Approval Flows": "approvalFlows"
};

const SPANISH_MAP: Record<string, string> = {
  "Header/Subheader": "Encabezado/Subtítulo", "Full Name": "Nombre completo",
  "Email": "Correo electrónico", "Address": "Dirección", "Phone": "Teléfono",
  "Short Text": "Texto corto", "Long Text": "Texto largo", "Dropdown": "Desplegable",
  "Single Choice": "Selección única", "Multiple Choice": "Selección múltiple",
  "Number": "Número", "Date Picker": "Selector de fecha", "Time": "Hora",
  "File Upload": "Subir archivo", "Image": "Imagen", "Paragraph": "Párrafo",
  "Submit Button": "Enviar", "Signature": "Firma", "Appointment": "Cita",
  "Star Rating": "Calificación", "Terms & Conditions": "Términos y condiciones"
};

function getFieldIcon(type: string) {
  const iconMap: Record<string, typeof Type> = {
    header: Type, fullName: Type, email: Mail, phone: Phone, address: MapPin,
    shortText: AlignLeft, longText: AlignLeft, dropdown: List, singleChoice: CheckSquare,
    multipleChoice: CheckSquare, number: Hash, date: Calendar, time: Clock,
    file: Upload, image: Image, paragraph: AlignLeft, submit: ChevronRight,
    starRating: Star, signature: PenTool, paymentGateway: CreditCard,
    productList: CreditCard, geolocation: Globe, appointment: Calendar,
    configList: List, calculation: Hash, terms: FileText, divider: LayoutGrid,
  };
  return iconMap[type] || FormInput;
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function newField(paletteLabel: string): FieldData {
  const type = FIELD_TYPE_MAP[paletteLabel] || "shortText";
  return {
    id: uuid(),
    type,
    x: 30, y: 30,
    w: 320, h: (type === "header" || type === "paragraph" || type === "longText") ? 90 : 62,
    required: false,
    label: { en: paletteLabel, es: SPANISH_MAP[paletteLabel] || paletteLabel },
    help: { en: "", es: "" },
    options: ["dropdown", "singleChoice", "multipleChoice"].includes(type)
      ? [{ en: "Option 1", es: "Opción 1" }, { en: "Option 2", es: "Opción 2" }] : [],
    rules: { futureOnly: type === "appointment" }
  };
}

function newFormData(): FormData {
  return {
    name: "Untitled Form",
    language: "en",
    exportTarget: "pdf",
    pages: [{ id: uuid(), fields: [] }],
  };
}

function FieldPreview({ field, lang }: { field: FieldData; lang: string }) {
  const label = (field.label as any)?.[lang] || field.type;
  const type = field.type;
  if (type === "header") return <div className="font-bold text-sm truncate">{label}</div>;
  if (type === "paragraph") return <div className="text-xs text-muted-foreground truncate">{label}</div>;
  if (type === "divider") return <hr className="my-1 border-border" />;
  if (type === "submit") return <button className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-md">{label}</button>;
  if (type === "longText") return (
    <div>
      <div className="text-[10px] font-semibold mb-0.5 truncate">{label}{field.required && " *"}</div>
      <div className="border border-border rounded h-8 bg-muted/30" />
    </div>
  );
  if (type === "dropdown" || type === "singleChoice" || type === "multipleChoice") return (
    <div>
      <div className="text-[10px] font-semibold mb-0.5 truncate">{label}{field.required && " *"}</div>
      <div className="border border-border rounded px-2 py-0.5 text-[10px] text-muted-foreground bg-muted/30 truncate">
        {field.options?.[0]?.[lang as "en" | "es"] || "Select..."}
      </div>
    </div>
  );
  if (type === "starRating") return (
    <div>
      <div className="text-[10px] font-semibold mb-0.5 truncate">{label}{field.required && " *"}</div>
      <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 text-yellow-400" />)}</div>
    </div>
  );
  if (type === "signature") return (
    <div>
      <div className="text-[10px] font-semibold mb-0.5 truncate">{label}{field.required && " *"}</div>
      <div className="border border-dashed border-border rounded h-6 flex items-center justify-center text-[9px] text-muted-foreground">Sign here</div>
    </div>
  );
  if (type === "file" || type === "takePhoto" || type === "image") return (
    <div>
      <div className="text-[10px] font-semibold mb-0.5 truncate">{label}{field.required && " *"}</div>
      <div className="border border-dashed border-border rounded h-6 flex items-center justify-center text-[9px] text-muted-foreground">
        <Upload className="w-3 h-3 mr-1" /> Upload
      </div>
    </div>
  );
  const inputType = type === "email" ? "email" : type === "phone" ? "tel" : type === "number" ? "number" : type === "date" ? "date" : type === "time" ? "time" : "text";
  return (
    <div>
      <div className="text-[10px] font-semibold mb-0.5 truncate">{label}{field.required && " *"}</div>
      <input
        type={inputType}
        className="w-full border border-border rounded px-2 py-0.5 text-[10px] bg-muted/30 pointer-events-none"
        placeholder={label}
        readOnly
      />
    </div>
  );
}

export default function FormBuilder1() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pageRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormData>(newFormData());
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingFieldId, setResizingFieldId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [showFormsDialog, setShowFormsDialog] = useState(false);
  const [showArchivedDialog, setShowArchivedDialog] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const searchString = useSearch();
  const activePage = form.pages[activePageIndex];
  const selectedField = activePage?.fields.find(f => f.id === selectedFieldId) || null;
  const lang = form.language as "en" | "es";

  const { data: activeForms = [] } = useQuery({
    queryKey: ["/api/builder-forms", false],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/builder-forms?archived=false");
      return res.json();
    },
  });

  const { data: archivedForms = [] } = useQuery({
    queryKey: ["/api/builder-forms", true],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/builder-forms?archived=true");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formToSave: FormData) => {
      if (editingFormId) {
        const res = await apiRequest("PATCH", `/api/builder-forms/${editingFormId}`, formToSave);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/builder-forms", formToSave);
        return res.json();
      }
    },
    onSuccess: (data) => {
      setEditingFormId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/builder-forms"] });
      toast({ title: "Form saved" });
    },
    onError: () => toast({ title: "Error saving form", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/builder-forms/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/builder-forms"] });
      toast({ title: "Form archived" });
      handleNewForm();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/builder-forms/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/builder-forms"] });
      toast({ title: "Form restored" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/builder-forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/builder-forms"] });
      toast({ title: "Form permanently deleted" });
    },
  });

  const handleNewForm = useCallback(() => {
    setForm(newFormData());
    setEditingFormId(null);
    setActivePageIndex(0);
    setSelectedFieldId(null);
  }, []);

  const handleLoadForm = useCallback((f: any) => {
    setForm({
      name: f.name,
      language: f.language || "en",
      exportTarget: f.exportTarget || "pdf",
      pages: f.pages || [{ id: uuid(), fields: [] }],
    });
    setEditingFormId(f.id);
    setActivePageIndex(0);
    setSelectedFieldId(null);
    setShowFormsDialog(false);
    setShowArchivedDialog(false);
  }, []);

  const handleSave = useCallback(() => {
    saveMutation.mutate(form);
  }, [form, saveMutation]);

  const handleArchive = useCallback(() => {
    if (!editingFormId) {
      toast({ title: "Save the form first before archiving" });
      return;
    }
    archiveMutation.mutate(editingFormId);
  }, [editingFormId, archiveMutation, toast]);

  const handleShare = useCallback(() => {
    const formIdParam = editingFormId ? `?formId=${editingFormId}` : "";
    const url = `${window.location.origin}/form-builder-1${formIdParam}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
    const subject = encodeURIComponent(`Form: ${form.name}`);
    const body = encodeURIComponent(`Check out this form: ${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }, [form.name, editingFormId, toast]);

  const handleExport = useCallback(() => {
    if (form.exportTarget === "pdf") {
      window.print();
    } else {
      toast({ title: `${form.exportTarget.toUpperCase()} export coming soon` });
    }
  }, [form.exportTarget, toast]);

  const updateField = useCallback((fieldId: string, updates: Partial<FieldData>) => {
    setForm(prev => ({
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === activePageIndex
          ? { ...p, fields: p.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) }
          : p
      )
    }));
  }, [activePageIndex]);

  const deleteField = useCallback((fieldId: string) => {
    setForm(prev => ({
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === activePageIndex
          ? { ...p, fields: p.fields.filter(f => f.id !== fieldId) }
          : p
      )
    }));
    setSelectedFieldId(null);
  }, [activePageIndex]);

  const addPage = useCallback(() => {
    setForm(prev => ({
      ...prev,
      pages: [...prev.pages, { id: uuid(), fields: [] }]
    }));
    setActivePageIndex(form.pages.length);
    setSelectedFieldId(null);
  }, [form.pages.length]);

  const removePage = useCallback((idx: number) => {
    if (form.pages.length <= 1) return;
    setForm(prev => ({
      ...prev,
      pages: prev.pages.filter((_, i) => i !== idx)
    }));
    setActivePageIndex(Math.max(0, activePageIndex - 1));
    setSelectedFieldId(null);
  }, [form.pages.length, activePageIndex]);

  const handleDragStart = (e: React.DragEvent, label: string) => {
    e.dataTransfer.setData("palette-label", label);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const label = e.dataTransfer.getData("palette-label");
    if (!label || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const field = newField(label);
    field.x = Math.max(0, Math.min(e.clientX - rect.left - 160, 816 - field.w));
    field.y = Math.max(0, Math.min(e.clientY - rect.top - 30, 1056 - field.h));

    setForm(prev => ({
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === activePageIndex
          ? { ...p, fields: [...p.fields, field] }
          : p
      )
    }));
    setSelectedFieldId(field.id);
  };

  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(fieldId);
    const field = activePage?.fields.find(f => f.id === fieldId);
    if (!field || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    setDraggingFieldId(fieldId);
    setDragOffset({
      x: e.clientX - rect.left - field.x,
      y: e.clientY - rect.top - field.y,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const field = activePage?.fields.find(f => f.id === fieldId);
    if (!field) return;
    setResizingFieldId(fieldId);
    setResizeStart({ x: e.clientX, y: e.clientY, w: field.w, h: field.h });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingFieldId && pageRef.current) {
        const rect = pageRef.current.getBoundingClientRect();
        const field = activePage?.fields.find(f => f.id === draggingFieldId);
        if (!field) return;
        const newX = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, 816 - field.w));
        const newY = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, 1056 - field.h));
        updateField(draggingFieldId, { x: newX, y: newY });
      }
      if (resizingFieldId) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        updateField(resizingFieldId, {
          w: Math.max(100, resizeStart.w + dx),
          h: Math.max(40, resizeStart.h + dy),
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingFieldId(null);
      setResizingFieldId(null);
    };

    if (draggingFieldId || resizingFieldId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingFieldId, resizingFieldId, dragOffset, resizeStart, activePage, updateField]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const formId = params.get("formId");
    if (formId && !editingFormId) {
      apiRequest("GET", `/api/builder-forms/${formId}`)
        .then(res => res.json())
        .then(f => {
          if (f && f.id) handleLoadForm(f);
        })
        .catch(() => {});
    }
  }, [searchString]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col print:h-auto print:overflow-visible">
      {/* TOP BAR */}
      <div className="flex items-center gap-2 p-3 border-b bg-card flex-wrap print:hidden" data-testid="form-builder-toolbar">
        <div className="flex-1 min-w-[200px]">
          <Input
            data-testid="input-form-name"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Untitled Form"
            className="font-semibold"
          />
        </div>

        <div className="flex items-center gap-1 border rounded-lg px-2 py-1 bg-background">
          <span className="text-xs text-muted-foreground mr-1">Language</span>
          <Button
            variant={form.language === "en" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setForm(prev => ({ ...prev, language: "en" }))}
            data-testid="button-lang-en"
          >
            English
          </Button>
          <Button
            variant={form.language === "es" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setForm(prev => ({ ...prev, language: "es" }))}
            data-testid="button-lang-es"
          >
            Español
          </Button>
        </div>

        <div className="flex items-center gap-1 border rounded-lg px-2 py-1 bg-background">
          <span className="text-xs text-muted-foreground mr-1">Export</span>
          <Select value={form.exportTarget} onValueChange={(v) => setForm(prev => ({ ...prev, exportTarget: v }))}>
            <SelectTrigger className="h-7 w-24 text-xs" data-testid="select-export-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">Word</SelectItem>
              <SelectItem value="xlsx">Excel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowFormsDialog(true)} data-testid="button-forms-list">
          <FileText className="w-4 h-4 mr-1" /> Forms
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowArchivedDialog(true)} data-testid="button-archived-list">
          <FolderArchive className="w-4 h-4 mr-1" /> Archived
        </Button>
        <Button variant="outline" size="sm" onClick={handleNewForm} data-testid="button-new-form">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-form">
          <Save className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare} data-testid="button-share-form">
          <Share2 className="w-4 h-4 mr-1" /> Share
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-form">
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
        {editingFormId && (
          <Button variant="destructive" size="sm" onClick={handleArchive} data-testid="button-archive-form">
            <Archive className="w-4 h-4 mr-1" /> Archive
          </Button>
        )}
      </div>

      {/* MAIN CONTENT: Palette | Canvas | Properties */}
      <div className="flex-1 grid grid-cols-[280px_1fr_280px] gap-2 p-2 min-h-0 print:grid-cols-1 print:p-0">
        {/* PALETTE */}
        <div className="border rounded-xl bg-card overflow-auto print:hidden" data-testid="panel-palette">
          <div className="p-3 border-b sticky top-0 bg-card z-10">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Add Fields
            </h3>
          </div>
          <div className="p-2 space-y-1">
            {PALETTE_GROUPS.map(group => (
              <div key={group.id}>
                <button
                  className="w-full text-left text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-2 flex items-center gap-1"
                  onClick={() => toggleGroup(group.id)}
                  data-testid={`button-toggle-group-${group.id}`}
                >
                  <ChevronRight className={cn("w-3 h-3 transition-transform", !collapsedGroups.has(group.id) && "rotate-90")} />
                  {group.title}
                </button>
                {!collapsedGroups.has(group.id) && group.items.map(item => {
                  const type = FIELD_TYPE_MAP[item] || "shortText";
                  const Icon = getFieldIcon(type);
                  return (
                    <div
                      key={item}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-grab hover:bg-accent transition-colors text-sm bg-background mb-1"
                      data-testid={`palette-item-${type}`}
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground" />
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate">{item}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* CANVAS */}
        <div className="overflow-auto flex flex-col items-center" data-testid="panel-canvas">
          {/* Page Tabs */}
          <div className="flex gap-2 mb-2 flex-wrap justify-center print:hidden" data-testid="page-tabs">
            {form.pages.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-1">
                <Button
                  variant={idx === activePageIndex ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs rounded-full"
                  onClick={() => { setActivePageIndex(idx); setSelectedFieldId(null); }}
                  data-testid={`button-page-tab-${idx}`}
                >
                  Page {idx + 1}
                </Button>
                {form.pages.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded-full"
                    onClick={() => removePage(idx)}
                    data-testid={`button-remove-page-${idx}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-full border-dashed"
              onClick={addPage}
              data-testid="button-add-page"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Page
            </Button>
          </div>

          {/* 8.5x11 Page Canvas */}
          <div
            ref={pageRef}
            className={cn(
              "relative bg-white border rounded-xl shadow-sm",
              "w-[816px] h-[1056px]",
              isDragOver && "ring-2 ring-primary ring-dashed",
              "print:shadow-none print:border-none print:rounded-none"
            )}
            style={{ minWidth: 816, minHeight: 1056 }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => setSelectedFieldId(null)}
            data-testid="form-canvas"
          >
            {isDragOver && (
              <div className="absolute inset-3 border-2 border-dashed border-primary/50 rounded-lg pointer-events-none" />
            )}

            {activePage?.fields.map(field => (
              <div
                key={field.id}
                className={cn(
                  "absolute border rounded-lg bg-white/95 p-2 cursor-move group",
                  "hover:shadow-md transition-shadow",
                  field.id === selectedFieldId ? "border-primary border-2 shadow-md" : "border-border",
                  (draggingFieldId === field.id) && "opacity-80 z-50"
                )}
                style={{
                  left: field.x,
                  top: field.y,
                  width: field.w,
                  height: field.h,
                }}
                onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                data-testid={`field-${field.id}`}
              >
                <div className="overflow-hidden h-full">
                  <FieldPreview field={field} lang={lang} />
                </div>

                {field.id === selectedFieldId && (
                  <div
                    className="absolute w-3 h-3 bg-primary rounded-full right-1 bottom-1 cursor-nwse-resize hover:scale-125 transition-transform"
                    onMouseDown={(e) => handleResizeMouseDown(e, field.id)}
                    data-testid={`resize-handle-${field.id}`}
                  />
                )}
              </div>
            ))}

            {activePage?.fields.length === 0 && !isDragOver && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
                Drag fields from the palette to start building your form
              </div>
            )}
          </div>
        </div>

        {/* PROPERTIES PANEL */}
        <div className="border rounded-xl bg-card overflow-auto print:hidden" data-testid="panel-properties">
          <div className="p-3 border-b sticky top-0 bg-card z-10">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Properties
            </h3>
          </div>
          <div className="p-3">
            {!selectedField ? (
              <p className="text-sm text-muted-foreground" data-testid="text-props-empty">Select a field to edit its properties.</p>
            ) : (
              <div className="space-y-4" data-testid="props-editor">
                <div>
                  <Label className="text-xs text-muted-foreground">Field Type</Label>
                  <Badge variant="secondary" className="ml-2">{selectedField.type}</Badge>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Label (English)</Label>
                  <Input
                    value={selectedField.label.en}
                    onChange={(e) => updateField(selectedField.id, {
                      label: { ...selectedField.label, en: e.target.value }
                    })}
                    className="mt-1"
                    data-testid="input-prop-label-en"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Label (Español)</Label>
                  <Input
                    value={selectedField.label.es}
                    onChange={(e) => updateField(selectedField.id, {
                      label: { ...selectedField.label, es: e.target.value }
                    })}
                    className="mt-1"
                    data-testid="input-prop-label-es"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Help Text (English)</Label>
                  <Input
                    value={selectedField.help.en}
                    onChange={(e) => updateField(selectedField.id, {
                      help: { ...selectedField.help, en: e.target.value }
                    })}
                    className="mt-1"
                    data-testid="input-prop-help-en"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Help Text (Español)</Label>
                  <Input
                    value={selectedField.help.es}
                    onChange={(e) => updateField(selectedField.id, {
                      help: { ...selectedField.help, es: e.target.value }
                    })}
                    className="mt-1"
                    data-testid="input-prop-help-es"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="prop-required"
                    checked={selectedField.required}
                    onCheckedChange={(v) => updateField(selectedField.id, { required: !!v })}
                    data-testid="checkbox-prop-required"
                  />
                  <Label htmlFor="prop-required" className="text-sm">Required</Label>
                </div>

                {["dropdown", "singleChoice", "multipleChoice"].includes(selectedField.type) && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Options</Label>
                    {selectedField.options.map((opt, idx) => (
                      <div key={idx} className="flex gap-1 mb-1">
                        <Input
                          value={opt.en}
                          onChange={(e) => {
                            const newOpts = [...selectedField.options];
                            newOpts[idx] = { ...newOpts[idx], en: e.target.value };
                            updateField(selectedField.id, { options: newOpts });
                          }}
                          placeholder="English"
                          className="text-xs"
                          data-testid={`input-option-en-${idx}`}
                        />
                        <Input
                          value={opt.es}
                          onChange={(e) => {
                            const newOpts = [...selectedField.options];
                            newOpts[idx] = { ...newOpts[idx], es: e.target.value };
                            updateField(selectedField.id, { options: newOpts });
                          }}
                          placeholder="Español"
                          className="text-xs"
                          data-testid={`input-option-es-${idx}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            const newOpts = selectedField.options.filter((_, i) => i !== idx);
                            updateField(selectedField.id, { options: newOpts });
                          }}
                          data-testid={`button-remove-option-${idx}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-1 text-xs"
                      onClick={() => {
                        const newOpts = [...selectedField.options, { en: `Option ${selectedField.options.length + 1}`, es: `Opción ${selectedField.options.length + 1}` }];
                        updateField(selectedField.id, { options: newOpts });
                      }}
                      data-testid="button-add-option"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Option
                    </Button>
                  </div>
                )}

                {(selectedField.type === "appointment" || selectedField.type === "date") && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="prop-future"
                      checked={selectedField.rules?.futureOnly || false}
                      onCheckedChange={(v) => updateField(selectedField.id, {
                        rules: { ...selectedField.rules, futureOnly: !!v }
                      })}
                      data-testid="checkbox-prop-future"
                    />
                    <Label htmlFor="prop-future" className="text-sm">Future dates only</Label>
                  </div>
                )}

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => deleteField(selectedField.id)}
                  data-testid="button-delete-field"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete Field
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FORMS LIST DIALOG */}
      <Dialog open={showFormsDialog} onOpenChange={setShowFormsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Saved Forms
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {activeForms.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No saved forms yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeForms.map((f: any) => (
                  <Card
                    key={f.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleLoadForm(f)}
                    data-testid={`card-form-${f.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="font-bold truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {f.pages?.length || 0} page(s) · Updated {new Date(f.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Badge variant="outline" className="text-[10px]">{f.language === "es" ? "Español" : "English"}</Badge>
                        <Badge variant="outline" className="text-[10px]">{f.exportTarget?.toUpperCase() || "PDF"}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ARCHIVED DIALOG */}
      <Dialog open={showArchivedDialog} onOpenChange={setShowArchivedDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="w-5 h-5" /> Archived Forms
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {archivedForms.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No archived forms.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {archivedForms.map((f: any) => (
                  <Card key={f.id} data-testid={`card-archived-form-${f.id}`}>
                    <CardContent className="p-4">
                      <div className="font-bold truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Archived {f.archivedAt ? new Date(f.archivedAt).toLocaleDateString() : "N/A"}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            restoreMutation.mutate(f.id);
                          }}
                          data-testid={`button-restore-form-${f.id}`}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Restore
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            deleteMutation.mutate(f.id);
                          }}
                          data-testid={`button-delete-form-${f.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleLoadForm(f)}
                          data-testid={`button-view-archived-${f.id}`}
                        >
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:grid-cols-1 { grid-template-columns: 1fr !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:h-auto { height: auto !important; }
          .print\\:overflow-visible { overflow: visible !important; }
          @page { size: letter; margin: 0.25in; }
        }
      `}</style>
    </div>
  );
}
