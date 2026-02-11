import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

type Lang = "en" | "es";
type Role = "Customer" | "Crew" | "Manager" | "Admin";
type UserLevel = "Master Admin" | Role;
type TemplateStatus = "Draft" | "Active" | "On Hold" | "Archived";

const PURPOSE_TYPES_DEFAULT = [
  "Hiring",
  "HR",
  "Customer Request",
  "Safety",
  "Operations",
  "Training",
  "Finance",
  "General",
  "Other",
] as const;
type PurposeType = (typeof PURPOSE_TYPES_DEFAULT)[number];

const LETTER = { w: 816, h: 1056, pad: 24 };

const LS_KEYS = {
  templates: "companyhq_formbuilder1_templates_v2",
  submissions: "companyhq_formbuilder1_submissions_v2",
} as const;

type PaletteGroup = { id: string; title: string; items: string[] };

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: "1",
    title: "1. Standard",
    items: [
      "Header/Subheader",
      "Full Name",
      "Email",
      "Address",
      "Phone",
      "Short Text",
      "Long Text",
      "Dropdown",
      "Single Choice",
      "Multiple Choice",
      "Number",
      "Date Picker",
      "Time",
      "File Upload",
      "Image",
      "Paragraph",
      "Captcha",
      "Submit Button",
    ],
  },
  {
    id: "2",
    title: "2. Survey & Data",
    items: ["Input Table", "Star Rating", "Scale Rating", "Spinner", "Fill In The Blank", "Signature"],
  },
  {
    id: "3",
    title: "3. Payments",
    items: [
      "Product List",
      "Payment Gateway",
      "Purchase Order",
      "Shipping & Tax",
      "Coupons/Promo Codes",
      "Payment Authorization",
    ],
  },
  {
    id: "4",
    title: "4. Widgets",
    items: [
      "Appointment",
      "Configurable List",
      "Multiple Text Fields",
      "Take Photo",
      "Unique ID",
      "Form Calculation",
      "Loom Video Recorder",
      "Draw Board",
      "Geolocation",
      "Terms & Conditions",
    ],
  },
  { id: "5", title: "5. Layout", items: ["Page Break", "Section Collapse", "Divider"] },
  {
    id: "6",
    title: "6. Behind the scenes",
    items: ["Conditional Logic", "Input Masking", "Hidden Fields", "Pre-populate Fields", "Translation", "Custom CSS"],
  },
  {
    id: "7",
    title: "7. After submit",
    items: ["Autoresponder Email", "Notification Email", "Thank You Page", "PDF Converter", "Approval Flows"],
  },
  {
    id: "8",
    title: "8. Integrations",
    items: [
      "CRM: Salesforce",
      "CRM: HubSpot",
      "CRM: Zoho",
      "CRM: Pipedrive",
      "CRM: Microsoft Dynamics",
      "Cloud: Google Drive",
      "Cloud: Dropbox",
      "Cloud: OneDrive",
      "Cloud: Box",
      "Cloud: SharePoint",
      "PM: Trello",
      "PM: Asana",
      "PM: Monday",
      "PM: ClickUp",
      "PM: Jira",
      "Email: Mailchimp",
      "Email: Constant Contact",
      "Email: Klaviyo",
      "Email: ActiveCampaign",
      "Accounting: QuickBooks",
      "Accounting: Xero",
      "Payments: Stripe",
      "Payments: PayPal",
      "Payments: Square",
      "E-Sign: DocuSign",
      "E-Sign: Dropbox Sign",
      "Calendar: Google Calendar",
      "Calendar: Outlook Calendar",
      "SMS: Twilio",
      "Chat: Slack",
      "Chat: Teams",
      "Automation: Zapier",
      "Automation: Make.com",
      "Automation: n8n",
      "Webhooks",
      "REST API",
      "GraphQL API",
    ],
  },
];

type FieldType =
  | "header"
  | "paragraph"
  | "divider"
  | "pageBreak"
  | "fullName"
  | "email"
  | "address"
  | "phone"
  | "shortText"
  | "longText"
  | "dropdown"
  | "singleChoice"
  | "multipleChoice"
  | "number"
  | "date"
  | "time"
  | "appointment"
  | "file"
  | "image"
  | "signature"
  | "captcha"
  | "submit"
  | "unknown";

const FIELD_TYPE_MAP: Record<string, FieldType> = {
  "Header/Subheader": "header",
  Paragraph: "paragraph",
  Divider: "divider",
  "Page Break": "pageBreak",
  "Full Name": "fullName",
  Email: "email",
  Address: "address",
  Phone: "phone",
  "Short Text": "shortText",
  "Long Text": "longText",
  Dropdown: "dropdown",
  "Single Choice": "singleChoice",
  "Multiple Choice": "multipleChoice",
  Number: "number",
  "Date Picker": "date",
  Time: "time",
  Appointment: "appointment",
  "File Upload": "file",
  Image: "image",
  Signature: "signature",
  Captcha: "captcha",
  "Submit Button": "submit",
};

type Option = { id: string; label: Record<Lang, string> };

type FormField = {
  id: string;
  type: FieldType;
  paletteLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label: Record<Lang, string>;
  help: Record<Lang, string>;
  options?: Option[];
  rules?: { futureOnly?: boolean };
};

type FormPage = { id: string; fields: FormField[] };

type FormTemplate = {
  id: string;
  name: string;
  purposeType: PurposeType;
  status: TemplateStatus;
  allowed: { masterAdmin: boolean; admin: boolean; manager: boolean; crew: boolean; customer: boolean };
  createdAt: string;
  updatedAt: string;
  pages: FormPage[];
};

type Submission = {
  id: string;
  templateId: string;
  templateName: string;
  purposeType: PurposeType;
  submittedAt: string;
  submittedBy: { userId?: string | number; name?: string; role?: Role; isMasterAdmin?: boolean };
  valuesByFieldId: Record<string, any>;
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isAdminOrMaster(user: any) {
  return user?.isMasterAdmin === true || user?.role === "Admin";
}

function userLevel(user: any): UserLevel {
  if (user?.isMasterAdmin === true) return "Master Admin";
  return (user?.role as Role) ?? "Customer";
}

function canUserUseTemplate(user: any, tpl: FormTemplate) {
  if (tpl.status === "Archived") return false;

  const lvl = userLevel(user);
  if (lvl === "Master Admin") return true;
  if (lvl === "Admin") return true;

  if (lvl === "Manager") return tpl.allowed.manager;
  if (lvl === "Crew") return tpl.allowed.crew;
  return tpl.allowed.customer;
}

function defaultAllowedAll(): FormTemplate["allowed"] {
  return { masterAdmin: true, admin: true, manager: true, crew: true, customer: true };
}

function makeNewTemplate(): FormTemplate {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: "Untitled Form",
    purposeType: "General",
    status: "Draft",
    allowed: defaultAllowedAll(),
    createdAt: now,
    updatedAt: now,
    pages: [{ id: uid(), fields: [] }],
  };
}

function clampToCanvas(f: Pick<FormField, "x" | "y" | "w" | "h">) {
  const minW = 140;
  const minH = 44;
  const w = Math.max(minW, Math.round(f.w));
  const h = Math.max(minH, Math.round(f.h));
  const maxX = LETTER.w - LETTER.pad - w;
  const maxY = LETTER.h - LETTER.pad - h;
  const x = Math.min(Math.max(LETTER.pad, Math.round(f.x)), maxX);
  const y = Math.min(Math.max(LETTER.pad, Math.round(f.y)), maxY);
  return { x, y, w, h };
}

function makeFieldFromPalette(label: string): FormField {
  const type = FIELD_TYPE_MAP[label] ?? "unknown";
  const base: FormField = {
    id: uid(),
    type,
    paletteLabel: label,
    x: LETTER.pad + 16,
    y: LETTER.pad + 16,
    w: 360,
    h: type === "header" || type === "paragraph" ? 96 : 64,
    required: false,
    label: { en: label, es: label },
    help: { en: "", es: "" },
    rules: { futureOnly: type === "appointment" },
  };

  if (type === "dropdown" || type === "singleChoice" || type === "multipleChoice") {
    base.options = [
      { id: uid(), label: { en: "Option 1", es: "Opción 1" } },
      { id: uid(), label: { en: "Option 2", es: "Opción 2" } },
    ];
  }
  return base;
}

function useMiniToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const timer = window.setTimeout(() => setMsg(null), 1400);
    return () => window.clearTimeout(timer);
  }, [msg]);
  return {
    showToast: (m: string) => setMsg(m),
    ToastNode: msg ? (
      <div className="fixed bottom-5 left-1/2 z-[9999] -translate-x-1/2 rounded-xl bg-black px-3 py-2 text-sm text-white shadow-lg">
        {msg}
      </div>
    ) : null,
  };
}

type DragState =
  | { kind: "none" }
  | { kind: "move"; fieldId: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: "resize"; fieldId: string; startX: number; startY: number; originW: number; originH: number };

export default function FormBuilder1() {
  const { user } = useAuth();
  const admin = isAdminOrMaster(user);
  const { showToast, ToastNode } = useMiniToast();

  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<"use" | "build">("use");

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const [useSelectedTemplateId, setUseSelectedTemplateId] = useState<string | null>(null);
  const [fillValues, setFillValues] = useState<Record<string, any>>({});
  const [fillErrors, setFillErrors] = useState<Record<string, string>>({});

  const [templateSearch, setTemplateSearch] = useState("");
  const [paletteSearch, setPaletteSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<PurposeType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | "All">("All");

  const [paletteTab, setPaletteTab] = useState(PALETTE_GROUPS[0]?.id ?? "1");

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>({ kind: "none" });

  useEffect(() => {
    const tpls = safeJsonParse<FormTemplate[]>(localStorage.getItem(LS_KEYS.templates), []);
    const subs = safeJsonParse<Submission[]>(localStorage.getItem(LS_KEYS.submissions), []);
    setTemplates(tpls);
    setSubmissions(subs);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("templateId");
    const view = params.get("view");
    if (view === "build" && admin) setMode("build");
    if (view === "use") setMode("use");
    if (templateId) {
      setMode("use");
      setUseSelectedTemplateId(templateId);
    }
  }, [admin]);

  const activeTemplate = useMemo(
    () => templates.find((tp) => tp.id === activeTemplateId) ?? null,
    [templates, activeTemplateId]
  );

  const activePage = useMemo(() => {
    if (!activeTemplate) return null;
    return activeTemplate.pages[activePageIndex] ?? activeTemplate.pages[0] ?? null;
  }, [activeTemplate, activePageIndex]);

  const selectedField = useMemo(() => {
    if (!activePage || !selectedFieldId) return null;
    return activePage.fields.find((f) => f.id === selectedFieldId) ?? null;
  }, [activePage, selectedFieldId]);

  const useTemplate = useMemo(
    () => templates.find((tp) => tp.id === useSelectedTemplateId) ?? null,
    [templates, useSelectedTemplateId]
  );

  const filteredTemplatesBuild = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates
      .filter((tpl) => (purposeFilter === "All" ? true : tpl.purposeType === purposeFilter))
      .filter((tpl) => (statusFilter === "All" ? true : tpl.status === statusFilter))
      .filter((tpl) => (q ? tpl.name.toLowerCase().includes(q) || tpl.purposeType.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [templates, templateSearch, purposeFilter, statusFilter]);

  const filteredTemplatesUse = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates
      .filter((tpl) => tpl.status !== "Archived")
      .filter((tpl) => canUserUseTemplate(user, tpl))
      .filter((tpl) => (purposeFilter === "All" ? true : tpl.purposeType === purposeFilter))
      .filter((tpl) => (statusFilter === "All" ? true : tpl.status === statusFilter))
      .filter((tpl) => (q ? tpl.name.toLowerCase().includes(q) || tpl.purposeType.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [templates, templateSearch, purposeFilter, statusFilter, user]);

  const paletteItemsForTab = useMemo(() => {
    const group = PALETTE_GROUPS.find((g) => g.id === paletteTab) ?? PALETTE_GROUPS[0];
    const q = paletteSearch.trim().toLowerCase();
    const items = group?.items ?? [];
    return q ? items.filter((i) => i.toLowerCase().includes(q)) : items;
  }, [paletteTab, paletteSearch]);

  function persistTemplates(next: FormTemplate[], msg = "Saved") {
    setTemplates(next);
    localStorage.setItem(LS_KEYS.templates, JSON.stringify(next));
    showToast(msg);
  }

  function persistSubmissions(next: Submission[], msg = "Submitted") {
    setSubmissions(next);
    localStorage.setItem(LS_KEYS.submissions, JSON.stringify(next));
    showToast(msg);
  }

  function updateTemplate(templateId: string, patch: Partial<FormTemplate>) {
    const tpl = templates.find((tp) => tp.id === templateId);
    if (!tpl) return;
    const updated = { ...tpl, ...patch, updatedAt: new Date().toISOString() };
    persistTemplates(templates.map((tp) => (tp.id === templateId ? updated : tp)));
  }

  function updateActivePageFields(updateFn: (fields: FormField[]) => FormField[]) {
    if (!activeTemplate || !activePage) return;
    const pages = activeTemplate.pages.map((p, idx) => (idx === activePageIndex ? { ...p, fields: updateFn(p.fields) } : p));
    updateTemplate(activeTemplate.id, { pages });
  }

  function createTemplate() {
    const tpl = makeNewTemplate();
    persistTemplates([tpl, ...templates], "Created");
    setActiveTemplateId(tpl.id);
    setActivePageIndex(0);
    setSelectedFieldId(null);
  }

  function duplicateTemplate(id: string) {
    const src = templates.find((tp) => tp.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    const dup: FormTemplate = {
      ...src,
      id: uid(),
      name: `${src.name} (Copy)`,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
      pages: src.pages.map((p) => ({
        ...p,
        id: uid(),
        fields: p.fields.map((f) => ({ ...f, id: uid() })),
      })),
    };
    persistTemplates([dup, ...templates], "Copied");
    setActiveTemplateId(dup.id);
    setActivePageIndex(0);
    setSelectedFieldId(null);
  }

  function addPage() {
    if (!activeTemplate) return;
    const pages = [...activeTemplate.pages, { id: uid(), fields: [] as FormField[] }];
    updateTemplate(activeTemplate.id, { pages });
    setActivePageIndex(pages.length - 1);
    setSelectedFieldId(null);
  }

  function addField(paletteLabel: string, x?: number, y?: number) {
    if (!activeTemplate || !activePage) return;
    const base = makeFieldFromPalette(paletteLabel);
    if (typeof x === "number") base.x = x;
    if (typeof y === "number") base.y = y;
    const clamped = clampToCanvas(base);
    const field: FormField = { ...base, ...clamped };
    updateActivePageFields((fields) => [...fields, field]);
    setSelectedFieldId(field.id);
  }

  function deleteSelectedField() {
    if (!selectedFieldId) return;
    updateActivePageFields((fields) => fields.filter((f) => f.id !== selectedFieldId));
    setSelectedFieldId(null);
  }

  async function shareTemplate(templateId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "use");
    url.searchParams.set("templateId", templateId);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast("Link copied");
    } catch {
      window.open(
        `mailto:?subject=${encodeURIComponent("CompanyHQ Form")}&body=${encodeURIComponent(url.toString())}`,
        "_blank"
      );
    }
  }

  function printCurrent() {
    window.print();
  }

  function resetFill(_tpl: FormTemplate | null) {
    setFillValues({});
    setFillErrors({});
  }

  function validateAndSubmit(tpl: FormTemplate) {
    const errors: Record<string, string> = {};
    const values = fillValues;

    if (!canUserUseTemplate(user, tpl)) return;

    for (const page of tpl.pages) {
      for (const field of page.fields) {
        const v = values[field.id];

        if (field.required) {
          const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
          if (empty) errors[field.id] = "Required";
        }

        if (field.type === "appointment" && field.rules?.futureOnly && v) {
          const dt = new Date(v).getTime();
          if (!Number.isFinite(dt) || dt <= Date.now()) errors[field.id] = "Must be in the future";
        }

        if (field.type === "email" && v) {
          const ok = String(v).includes("@");
          if (!ok) errors[field.id] = "Invalid email format";
        }
      }
    }

    setFillErrors(errors);
    if (Object.keys(errors).length) {
      showToast("Fix highlighted fields");
      return;
    }

    const sub: Submission = {
      id: uid(),
      templateId: tpl.id,
      templateName: tpl.name,
      purposeType: tpl.purposeType,
      submittedAt: new Date().toISOString(),
      submittedBy: {
        userId: user?.id,
        name: user?.name ?? user?.username ?? "User",
        role: user?.role as Role | undefined,
        isMasterAdmin: user?.isMasterAdmin === true,
      },
      valuesByFieldId: values,
    };

    persistSubmissions([sub, ...submissions], "Submitted");
    setFillValues({});
    setFillErrors({});
  }

  function onPaletteDragStart(e: React.DragEvent, paletteLabel: string) {
    e.dataTransfer.setData("text/plain", paletteLabel);
  }

  function onCanvasDragOver(e: React.DragEvent) {
    if (!admin) return;
    e.preventDefault();
  }

  function onCanvasDrop(e: React.DragEvent) {
    if (!admin) return;
    e.preventDefault();
    const label = e.dataTransfer.getData("text/plain");
    if (!label) return;
    if (!activeTemplate || !activePage) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      addField(label);
      return;
    }

    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    addField(label, x, y);
  }

  function onFieldPointerDownMove(e: React.PointerEvent, fieldId: string) {
    e.stopPropagation();
    e.preventDefault();
    if (!admin) return;
    setSelectedFieldId(fieldId);
    const field = activePage?.fields.find((f) => f.id === fieldId);
    if (!field) return;

    dragRef.current = {
      kind: "move",
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      originX: field.x,
      originY: field.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onFieldPointerDownResize(e: React.PointerEvent, fieldId: string) {
    e.stopPropagation();
    e.preventDefault();
    if (!admin) return;
    setSelectedFieldId(fieldId);
    const field = activePage?.fields.find((f) => f.id === fieldId);
    if (!field) return;

    dragRef.current = {
      kind: "resize",
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      originW: field.w,
      originH: field.h,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    const st = dragRef.current;
    if (st.kind === "none") return;
    if (!activePage) return;

    if (st.kind === "move") {
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      updateActivePageFields((fields) =>
        fields.map((f) => {
          if (f.id !== st.fieldId) return f;
          const next = clampToCanvas({ x: st.originX + dx, y: st.originY + dy, w: f.w, h: f.h });
          return { ...f, x: next.x, y: next.y };
        })
      );
    } else {
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      updateActivePageFields((fields) =>
        fields.map((f) => {
          if (f.id !== st.fieldId) return f;
          const next = clampToCanvas({ x: f.x, y: f.y, w: st.originW + dx, h: st.originH + dy });
          return { ...f, w: next.w, h: next.h };
        })
      );
    }
  }

  function onCanvasPointerUp() {
    dragRef.current = { kind: "none" };
  }

  const templatesForMode = mode === "build" ? filteredTemplatesBuild : filteredTemplatesUse;

  const [smallPanelTab, setSmallPanelTab] = useState<"palette" | "canvas" | "props">("canvas");

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1100) {
        setSmallPanelTab("canvas");
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="p-4" data-testid="form-builder-1-page">
      {ToastNode}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold" data-testid="text-builder-title">Form Builder 1</h1>
          <Badge variant="secondary">v1</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
            <span className="text-xs text-muted-foreground">Language</span>
            <Button variant={lang === "en" ? "default" : "secondary"} size="sm" onClick={() => setLang("en")} data-testid="button-lang-en">
              English
            </Button>
            <Button variant={lang === "es" ? "default" : "secondary"} size="sm" onClick={() => setLang("es")} data-testid="button-lang-es">
              Español
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
            <span className="text-xs text-muted-foreground">Mode</span>
            <Button variant={mode === "use" ? "default" : "secondary"} size="sm" onClick={() => setMode("use")} data-testid="button-mode-use">
              Use Forms
            </Button>
            <Button
              variant={mode === "build" ? "default" : "secondary"}
              size="sm"
              onClick={() => setMode("build")}
              disabled={!admin}
              title={!admin ? "Admins only" : undefined}
              data-testid="button-mode-build"
            >
              Build Forms
            </Button>
          </div>

          <Button variant="secondary" onClick={printCurrent} data-testid="button-print">
            Print / PDF
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Input value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="Search templates…" data-testid="input-search" />
            </div>
            <div>
              <Select value={purposeFilter} onValueChange={(v) => setPurposeFilter(v as any)}>
                <SelectTrigger data-testid="select-purpose-filter"><SelectValue placeholder="Purpose Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {PURPOSE_TYPES_DEFAULT.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {(["Draft", "Active", "On Hold", "Archived"] as TemplateStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex gap-2 lg:hidden">
        <Button variant={smallPanelTab === "palette" ? "default" : "secondary"} size="sm" onClick={() => setSmallPanelTab("palette")} data-testid="button-panel-fields">
          Fields
        </Button>
        <Button variant={smallPanelTab === "canvas" ? "default" : "secondary"} size="sm" onClick={() => setSmallPanelTab("canvas")} data-testid="button-panel-form">
          Form
        </Button>
        <Button variant={smallPanelTab === "props" ? "default" : "secondary"} size="sm" onClick={() => setSmallPanelTab("props")} data-testid="button-panel-props">
          Properties
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr_360px]">
        <div className={smallPanelTab !== "palette" ? "hidden lg:block" : ""}>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Templates</span>
                {mode === "build" && admin && (
                  <Button size="sm" onClick={createTemplate} data-testid="button-new-template">+ New</Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!templatesForMode.length ? (
                <div className="text-sm text-muted-foreground" data-testid="text-no-templates">
                  {mode === "build" ? "No templates yet. Click + New." : "No forms assigned to your role yet."}
                </div>
              ) : (
                templatesForMode.map((tpl) => {
                  const selected = (mode === "build" ? activeTemplateId === tpl.id : useSelectedTemplateId === tpl.id);
                  return (
                    <button
                      key={tpl.id}
                      className={[
                        "w-full rounded-xl border p-3 text-left transition",
                        selected ? "border-black bg-black text-white" : "bg-white hover:bg-gray-50",
                      ].join(" ")}
                      onClick={() => {
                        if (mode === "build") {
                          setActiveTemplateId(tpl.id);
                          setActivePageIndex(0);
                          setSelectedFieldId(null);
                        } else {
                          setUseSelectedTemplateId(tpl.id);
                          resetFill(tpl);
                        }
                      }}
                      data-testid={`button-template-${tpl.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{tpl.name}</div>
                        <Badge variant="secondary">{tpl.purposeType}</Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs opacity-80">
                        <span>{tpl.status}</span>
                        <span>{allowedRolesSummary(tpl)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={paletteSearch} onChange={(e) => setPaletteSearch(e.target.value)} placeholder="Search fields…" data-testid="input-palette-search" />
              <Tabs value={paletteTab} onValueChange={setPaletteTab}>
                <TabsList className="flex flex-wrap">
                  {PALETTE_GROUPS.map((g) => (
                    <TabsTrigger key={g.id} value={g.id} data-testid={`tab-palette-${g.id}`}>{g.id}</TabsTrigger>
                  ))}
                </TabsList>
                {PALETTE_GROUPS.map((g) => (
                  <TabsContent key={g.id} value={g.id}>
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">{g.title}</div>
                    <div className="flex flex-col gap-2">
                      {(g.id === paletteTab ? paletteItemsForTab : g.items).map((label) => (
                        <div
                          key={label}
                          draggable={mode === "build" && admin}
                          onDragStart={(e) => onPaletteDragStart(e, label)}
                          className={[
                            "rounded-xl border px-3 py-2 text-sm",
                            mode === "build" && admin ? "cursor-grab hover:bg-gray-50 active:cursor-grabbing" : "cursor-not-allowed opacity-50",
                          ].join(" ")}
                          onDoubleClick={() => {
                            if (mode === "build" && admin) addField(label);
                          }}
                          title={mode === "build" && admin ? "Drag to the page or double-click to add" : "Switch to Build mode as Admin"}
                          data-testid={`palette-item-${label.toLowerCase().replace(/[\s/]+/g, "-")}`}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="text-xs text-muted-foreground">
                Tip: Drag onto the page. Double-click adds instantly.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={smallPanelTab !== "canvas" ? "hidden lg:block" : ""}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{mode === "build" ? "Builder" : "Use Form"}</span>
                <div className="flex flex-wrap gap-2">
                  {mode === "build" && activeTemplate && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => shareTemplate(activeTemplate.id)} data-testid="button-share-build">Share</Button>
                      <Button variant="secondary" size="sm" onClick={() => duplicateTemplate(activeTemplate.id)} data-testid="button-duplicate">Duplicate</Button>
                      {activeTemplate.status !== "Archived" ? (
                        <Button variant="destructive" size="sm" onClick={() => updateTemplate(activeTemplate.id, { status: "Archived" })} data-testid="button-archive">Archive</Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => updateTemplate(activeTemplate.id, { status: "Draft" })} data-testid="button-restore">Restore</Button>
                      )}
                    </>
                  )}
                  {mode === "use" && useTemplate && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => shareTemplate(useTemplate.id)} data-testid="button-share-use">Share</Button>
                      <Button size="sm" onClick={() => validateAndSubmit(useTemplate)} data-testid="button-submit-form">Submit</Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {mode === "build" ? (
                !admin ? (
                  <div className="text-sm text-muted-foreground">Admins only.</div>
                ) : !activeTemplate ? (
                  <div className="text-sm text-muted-foreground" data-testid="text-select-template">Select a template or click + New.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">Template Name</div>
                        <Input
                          value={activeTemplate.name}
                          onChange={(e) => updateTemplate(activeTemplate.id, { name: e.target.value })}
                          data-testid="input-template-name"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Purpose Type</div>
                        <Select
                          value={activeTemplate.purposeType}
                          onValueChange={(v) => updateTemplate(activeTemplate.id, { purposeType: v as PurposeType })}
                        >
                          <SelectTrigger data-testid="select-purpose"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PURPOSE_TYPES_DEFAULT.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Status</div>
                        <Select
                          value={activeTemplate.status}
                          onValueChange={(v) => updateTemplate(activeTemplate.id, { status: v as TemplateStatus })}
                        >
                          <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["Draft", "Active", "On Hold", "Archived"] as TemplateStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">Allowed Roles</div>
                        <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-3">
                          <RoleToggle
                            label="Master Admin"
                            checked={activeTemplate.allowed.masterAdmin}
                            onChange={(v) => updateTemplate(activeTemplate.id, { allowed: { ...activeTemplate.allowed, masterAdmin: v } })}
                          />
                          <RoleToggle
                            label="Admin"
                            checked={activeTemplate.allowed.admin}
                            onChange={(v) => updateTemplate(activeTemplate.id, { allowed: { ...activeTemplate.allowed, admin: v } })}
                          />
                          <RoleToggle
                            label="Manager"
                            checked={activeTemplate.allowed.manager}
                            onChange={(v) => updateTemplate(activeTemplate.id, { allowed: { ...activeTemplate.allowed, manager: v } })}
                          />
                          <RoleToggle
                            label="Crew"
                            checked={activeTemplate.allowed.crew}
                            onChange={(v) => updateTemplate(activeTemplate.id, { allowed: { ...activeTemplate.allowed, crew: v } })}
                          />
                          <RoleToggle
                            label="Customer"
                            checked={activeTemplate.allowed.customer}
                            onChange={(v) => updateTemplate(activeTemplate.id, { allowed: { ...activeTemplate.allowed, customer: v } })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {activeTemplate.pages.map((p, idx) => (
                          <Button
                            key={p.id}
                            variant={idx === activePageIndex ? "default" : "secondary"}
                            size="sm"
                            onClick={() => {
                              setActivePageIndex(idx);
                              setSelectedFieldId(null);
                            }}
                            data-testid={`button-page-${idx}`}
                          >
                            Page {idx + 1}
                          </Button>
                        ))}
                        <Button variant="secondary" size="sm" onClick={addPage} data-testid="button-add-page">+ Add Page</Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Drag fields from left • Click to select • Drag to move • Resize handle
                      </div>
                    </div>

                    <div className="w-full overflow-auto rounded-xl border bg-gray-50 p-3">
                      <div
                        ref={canvasRef}
                        className="relative bg-white shadow-sm"
                        style={{
                          width: LETTER.w,
                          height: LETTER.h,
                          padding: LETTER.pad,
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                        }}
                        onPointerMove={onCanvasPointerMove}
                        onPointerUp={onCanvasPointerUp}
                        onPointerLeave={onCanvasPointerUp}
                        onDragOver={onCanvasDragOver}
                        onDrop={onCanvasDrop}
                        onMouseDown={() => setSelectedFieldId(null)}
                        data-testid="form-canvas"
                      >
                        {(activePage?.fields ?? []).map((field) => (
                          <BuilderField
                            key={field.id}
                            lang={lang}
                            field={field}
                            selected={selectedField?.id === field.id}
                            onPointerDownMove={(e) => onFieldPointerDownMove(e, field.id)}
                            onPointerDownResize={(e) => onFieldPointerDownResize(e, field.id)}
                            onSelect={() => setSelectedFieldId(field.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )
              ) : (
                !useTemplate ? (
                  <div className="text-sm text-muted-foreground" data-testid="text-choose-template">Select a form from Templates on the left.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold" data-testid="text-use-template-name">{useTemplate.name}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{useTemplate.purposeType}</Badge>
                        <Badge variant={useTemplate.status === "Active" ? "default" : "secondary"}>{useTemplate.status}</Badge>
                      </div>
                    </div>
                    {!canUserUseTemplate(user, useTemplate) ? (
                      <div className="text-sm text-muted-foreground">You don't have access to this form.</div>
                    ) : useTemplate.status === "On Hold" ? (
                      <div className="text-sm text-muted-foreground">This form is On Hold.</div>
                    ) : (
                      <FillRenderer
                        lang={lang}
                        template={useTemplate}
                        fillValues={fillValues}
                        setFillValues={setFillValues}
                        fillErrors={fillErrors}
                      />
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        <div className={smallPanelTab !== "props" ? "hidden lg:block" : ""}>
          {mode === "build" ? (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!admin ? (
                  <div className="text-sm text-muted-foreground">Admins only.</div>
                ) : !activeTemplate ? (
                  <div className="text-sm text-muted-foreground">Select a template.</div>
                ) : !selectedField ? (
                  <div className="text-sm text-muted-foreground" data-testid="text-select-field">
                    Click a field on the page to edit it.
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border bg-white p-3">
                      <div className="text-xs text-muted-foreground">Type</div>
                      <div className="font-semibold" data-testid="text-field-type">{selectedField.paletteLabel}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">Label ({lang.toUpperCase()})</div>
                      <Input
                        value={selectedField.label?.[lang] ?? selectedField.paletteLabel}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateActivePageFields((fields) =>
                            fields.map((f) =>
                              f.id === selectedField.id ? { ...f, label: { ...f.label, [lang]: v } } : f
                            )
                          );
                        }}
                        data-testid="input-field-label"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">Help Text ({lang.toUpperCase()})</div>
                      <Input
                        value={selectedField.help?.[lang] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateActivePageFields((fields) =>
                            fields.map((f) =>
                              f.id === selectedField.id ? { ...f, help: { ...f.help, [lang]: v } } : f
                            )
                          );
                        }}
                        data-testid="input-field-help"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedField.required}
                        onCheckedChange={(c) => {
                          updateActivePageFields((fields) =>
                            fields.map((f) => (f.id === selectedField.id ? { ...f, required: !!c } : f))
                          );
                        }}
                        data-testid="checkbox-required"
                      />
                      <span className="text-sm">Required</span>
                    </div>

                    {["dropdown", "singleChoice", "multipleChoice"].includes(selectedField.type) && (
                      <OptionsEditor
                        lang={lang}
                        field={selectedField}
                        onChange={(nextOptions) => {
                          updateActivePageFields((fields) =>
                            fields.map((f) => (f.id === selectedField.id ? { ...f, options: nextOptions } : f))
                          );
                        }}
                      />
                    )}

                    {selectedField.type === "appointment" && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!selectedField.rules?.futureOnly}
                          onCheckedChange={(v) => {
                            updateActivePageFields((fields) =>
                              fields.map((f) =>
                                f.id === selectedField.id ? { ...f, rules: { ...f.rules, futureOnly: v } } : f
                              )
                            );
                          }}
                          data-testid="switch-future-only"
                        />
                        <span className="text-sm">Future-only</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => {
                        updateActivePageFields((fields) =>
                          fields.map((f) =>
                            f.id === selectedField.id ? { ...f, ...clampToCanvas({ x: f.x, y: f.y, w: f.w - 40, h: f.h }) } : f
                          )
                        );
                      }} data-testid="button-smaller">
                        Smaller
                      </Button>
                      <Button variant="secondary" onClick={() => {
                        updateActivePageFields((fields) =>
                          fields.map((f) =>
                            f.id === selectedField.id ? { ...f, ...clampToCanvas({ x: f.x, y: f.y, w: f.w + 40, h: f.h }) } : f
                          )
                        );
                      }} data-testid="button-bigger">
                        Bigger
                      </Button>
                    </div>

                    <Button variant="destructive" onClick={deleteSelectedField} data-testid="button-delete-field">
                      Delete Field
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Submissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tabs defaultValue="mine">
                  <TabsList className="w-full">
                    <TabsTrigger value="mine" className="flex-1" data-testid="tab-my-submissions">My Completed</TabsTrigger>
                    {admin && <TabsTrigger value="admin" className="flex-1" data-testid="tab-admin-inbox">Admin Inbox</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="mine">
                    <SubmissionsList submissions={filterSubsMine(submissions, user)} />
                  </TabsContent>

                  {admin && (
                    <TabsContent value="admin">
                      <SubmissionsList submissions={submissions} />
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function allowedRolesSummary(tpl: FormTemplate) {
  const parts: string[] = [];
  if (tpl.allowed.masterAdmin) parts.push("Master");
  if (tpl.allowed.admin) parts.push("Admin");
  if (tpl.allowed.manager) parts.push("Manager");
  if (tpl.allowed.crew) parts.push("Crew");
  if (tpl.allowed.customer) parts.push("Customer");
  return parts.join(", ");
}

function RoleToggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const { label, checked, onChange } = props;
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(!!c)} data-testid={`checkbox-role-${label.toLowerCase().replace(/\s+/g, "-")}`} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function BuilderField(props: {
  lang: Lang;
  field: FormField;
  selected: boolean;
  onPointerDownMove: (e: React.PointerEvent) => void;
  onPointerDownResize: (e: React.PointerEvent) => void;
  onSelect: () => void;
}) {
  const { lang, field, selected, onPointerDownMove, onPointerDownResize, onSelect } = props;
  const label = field.label?.[lang] ?? field.paletteLabel;

  return (
    <div
      className={[
        "absolute rounded-xl border bg-white/95 p-2 shadow-sm",
        selected ? "border-black ring-2 ring-black/10" : "border-gray-400",
      ].join(" ")}
      style={{
        transform: `translate(${field.x}px, ${field.y}px)`,
        width: field.w,
        height: field.h,
        overflow: "hidden",
        touchAction: "none",
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={onPointerDownMove}
      data-testid={`canvas-field-${field.id}`}
    >
      <div className="mb-1 text-xs font-semibold">{label}</div>
      <div className="pointer-events-none">
        <FieldPreview type={field.type} />
      </div>

      <div
        className="absolute bottom-1 right-1 h-3 w-3 cursor-nwse-resize rounded-full bg-black"
        onPointerDown={(e) => onPointerDownResize(e)}
        title="Resize"
        data-testid={`handle-resize-${field.id}`}
      />
    </div>
  );
}

function FieldPreview({ type }: { type: FieldType }) {
  switch (type) {
    case "header":
      return <div className="text-xs text-muted-foreground">Header</div>;
    case "paragraph":
      return <div className="text-xs text-muted-foreground">Paragraph</div>;
    case "email":
      return <div className="text-xs text-muted-foreground">email</div>;
    case "phone":
      return <div className="text-xs text-muted-foreground">phone</div>;
    case "number":
      return <div className="text-xs text-muted-foreground">number</div>;
    case "date":
      return <div className="text-xs text-muted-foreground">date</div>;
    case "time":
      return <div className="text-xs text-muted-foreground">time</div>;
    case "appointment":
      return <div className="text-xs text-muted-foreground">date+time (future)</div>;
    case "file":
      return <div className="text-xs text-muted-foreground">file upload</div>;
    case "image":
      return <div className="text-xs text-muted-foreground">image upload</div>;
    case "dropdown":
      return <div className="text-xs text-muted-foreground">dropdown</div>;
    case "singleChoice":
      return <div className="text-xs text-muted-foreground">single choice</div>;
    case "multipleChoice":
      return <div className="text-xs text-muted-foreground">multiple choice</div>;
    case "longText":
      return <div className="text-xs text-muted-foreground">long text</div>;
    default:
      return <div className="text-xs text-muted-foreground">input</div>;
  }
}

function OptionsEditor(props: { lang: Lang; field: FormField; onChange: (opts: Option[]) => void }) {
  const { lang, field, onChange } = props;
  const opts = field.options ?? [];

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">Options</div>
      <div className="space-y-2">
        {opts.map((opt, idx) => (
          <div key={opt.id} className="flex gap-2">
            <Input
              value={opt.label?.[lang] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const next = opts.map((o, i) => (i === idx ? { ...o, label: { ...o.label, [lang]: v } } : o));
                onChange(next);
              }}
              data-testid={`input-option-${opt.id}`}
            />
            <Button
              variant="secondary"
              onClick={() => {
                const next = opts.filter((_, i) => i !== idx);
                onChange(next);
              }}
              data-testid={`button-remove-option-${opt.id}`}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="mt-2"
        variant="secondary"
        onClick={() => onChange([...opts, { id: uid(), label: { en: "Option", es: "Opción" } }])}
        data-testid="button-add-option"
      >
        + Add Option
      </Button>
    </div>
  );
}

function FillRenderer(props: {
  lang: Lang;
  template: FormTemplate;
  fillValues: Record<string, any>;
  setFillValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  fillErrors: Record<string, string>;
}) {
  const { lang, template, fillValues, setFillValues, fillErrors } = props;

  return (
    <div className="space-y-4">
      {template.pages.map((page, idx) => (
        <div key={page.id} className="rounded-xl border bg-white p-4" data-testid={`fill-page-${page.id}`}>
          <div className="mb-2 text-sm font-semibold text-muted-foreground">Page {idx + 1}</div>
          <div className="space-y-3">
            {page.fields
              .filter((f) => f.type !== "divider" && f.type !== "pageBreak")
              .map((field) => (
                <FillField
                  key={field.id}
                  lang={lang}
                  field={field}
                  value={fillValues[field.id]}
                  error={fillErrors[field.id]}
                  onChange={(v) => setFillValues((prev) => ({ ...prev, [field.id]: v }))}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FillField(props: {
  lang: Lang;
  field: FormField;
  value: any;
  error?: string;
  onChange: (v: any) => void;
}) {
  const { lang, field, value, error, onChange } = props;
  const label = field.label?.[lang] ?? field.paletteLabel;
  const help = field.help?.[lang] ?? "";

  const common = (
    <>
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold">{label}</div>
        {field.required && <Badge variant="secondary">Required</Badge>}
      </div>
      {help ? <div className="text-xs text-muted-foreground">{help}</div> : null}
    </>
  );

  const errNode = error ? <div className="text-xs text-red-600">{error}</div> : null;

  switch (field.type) {
    case "header":
      return (
        <div className="rounded-xl border bg-white p-3">
          <div className="text-lg font-bold">{label}</div>
          {help ? <div className="mt-1 text-sm text-muted-foreground">{help}</div> : null}
        </div>
      );
    case "paragraph":
      return (
        <div className="rounded-xl border bg-white p-3">
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      );
    case "email":
      return (
        <div className="space-y-1">
          {common}
          <Input type="email" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
    case "phone":
      return (
        <div className="space-y-1">
          {common}
          <Input type="tel" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          {common}
          <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
    case "date":
      return (
        <div className="space-y-1">
          {common}
          <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
    case "time":
      return (
        <div className="space-y-1">
          {common}
          <Input type="time" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
    case "appointment":
      return (
        <div className="space-y-1">
          {common}
          <Input type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
    case "file":
      return (
        <div className="space-y-1">
          {common}
          <Input
            type="file"
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0] ?? null;
              onChange(file ? { name: file.name, size: file.size, type: file.type } : null);
            }}
            className={error ? "border-red-500" : ""}
            data-testid={`input-fill-${field.id}`}
          />
          <div className="text-xs text-muted-foreground">v1 stores file metadata only.</div>
          {errNode}
        </div>
      );
    case "image":
      return (
        <div className="space-y-1">
          {common}
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0] ?? null;
              onChange(file ? { name: file.name, size: file.size, type: file.type } : null);
            }}
            className={error ? "border-red-500" : ""}
            data-testid={`input-fill-${field.id}`}
          />
          <div className="text-xs text-muted-foreground">v1 stores image metadata only.</div>
          {errNode}
        </div>
      );
    case "dropdown":
    case "singleChoice":
      return (
        <div className="space-y-1">
          {common}
          <Select value={value ?? ""} onValueChange={(v) => onChange(v)}>
            <SelectTrigger className={error ? "border-red-500" : ""} data-testid={`select-fill-${field.id}`}><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>{opt.label?.[lang] ?? "Option"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errNode}
        </div>
      );
    case "multipleChoice":
      return (
        <div className="space-y-1">
          {common}
          <div className="space-y-2 rounded-xl border bg-white p-3">
            {(field.options ?? []).map((opt) => {
              const arr: string[] = Array.isArray(value) ? value : [];
              const checked = arr.includes(opt.id);
              return (
                <label key={opt.id} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const next = new Set(arr);
                      if (c) next.add(opt.id);
                      else next.delete(opt.id);
                      onChange(Array.from(next));
                    }}
                    data-testid={`checkbox-fill-${field.id}-${opt.id}`}
                  />
                  <span className="text-sm">{opt.label?.[lang] ?? "Option"}</span>
                </label>
              );
            })}
          </div>
          {errNode}
        </div>
      );
    case "longText":
      return (
        <div className="space-y-1">
          {common}
          <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
    default:
      return (
        <div className="space-y-1">
          {common}
          <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} data-testid={`input-fill-${field.id}`} />
          {errNode}
        </div>
      );
  }
}

function SubmissionsList({ submissions }: { submissions: Submission[] }) {
  if (!submissions.length) return <div className="text-sm text-muted-foreground" data-testid="text-no-submissions">No submissions yet (local v1).</div>;
  return (
    <div className="space-y-2">
      {submissions
        .slice()
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
        .map((s) => (
          <div key={s.id} className="rounded-xl border bg-white p-3" data-testid={`submission-${s.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{s.templateName}</div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{s.purposeType}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(s.submittedAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              By: {s.submittedBy?.name ?? "User"} ({s.submittedBy?.isMasterAdmin ? "Master Admin" : s.submittedBy?.role ?? "Customer"})
            </div>
          </div>
        ))}
    </div>
  );
}

function filterSubsMine(all: Submission[], user: any) {
  const me = user?.name ?? user?.username ?? "User";
  return all.filter((s) => (s.submittedBy?.name ?? "") === me);
}
