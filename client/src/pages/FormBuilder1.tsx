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

type Role = "Customer" | "Crew" | "Manager" | "Admin";
type UserLevel = "Master Admin" | Role;

type TemplateStatus = "Draft" | "Active" | "On Hold" | "Archived";

const LS_KEYS = {
  templates: "companyhq_formbuilder1_templates_v1",
  submissions: "companyhq_formbuilder1_submissions_v1",
} as const;

const LETTER = {
  w: 816,
  h: 1056,
  pad: 24,
};

type PaletteGroup = { id: string; title: string; items: string[] };

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: "standard",
    title: "1. Standard Form Items",
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
    id: "survey",
    title: "2. Survey & Data Items",
    items: ["Input Table", "Star Rating", "Scale Rating", "Spinner", "Fill In The Blank", "Signature"],
  },
  {
    id: "payments",
    title: "3. Payment Processing Items",
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
    id: "widgets",
    title: "4. Advanced Widgets",
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
  { id: "layout", title: "5. Page Layout Structure", items: ["Page Break", "Section Collapse", "Divider"] },
  {
    id: "behind",
    title: "6. Behind-the-Scenes Features",
    items: ["Conditional Logic", "Input Masking", "Hidden Fields", "Pre-populate Fields", "Translation", "Custom CSS"],
  },
  {
    id: "post",
    title: "7. Post Submission & Automation",
    items: ["Autoresponder Email", "Notification Email", "Thank You Page", "PDF Converter", "Approval Flows"],
  },
  {
    id: "integrations",
    title: "8. Integrations (expanded)",
    items: [
      "CRM: Salesforce",
      "CRM: HubSpot",
      "CRM: Zoho",
      "CRM: Pipedrive",
      "CRM: Microsoft Dynamics",
      "Cloud Storage: Google Drive",
      "Cloud Storage: Dropbox",
      "Cloud Storage: OneDrive",
      "Cloud Storage: Box",
      "Cloud Storage: SharePoint",
      "Project Mgmt: Trello",
      "Project Mgmt: Asana",
      "Project Mgmt: Monday.com",
      "Project Mgmt: ClickUp",
      "Project Mgmt: Jira",
      "Email Marketing: Mailchimp",
      "Email Marketing: Constant Contact",
      "Email Marketing: Klaviyo",
      "Email Marketing: ActiveCampaign",
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
      "Chat: Microsoft Teams",
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

type Lang = "en" | "es";

const UI_TEXT: Record<Lang, Record<string, string>> = {
  en: {
    useForms: "Use Forms",
    buildForms: "Build Forms",
    templates: "Templates",
    submissions: "Submissions",
    myCompleted: "My Completed Forms",
    adminInbox: "Admin Submissions Inbox",
    search: "Search",
    purpose: "Purpose Type",
    status: "Status",
    roles: "Allowed Roles",
    save: "Save",
    duplicate: "Duplicate",
    archive: "Archive",
    restore: "Restore",
    hold: "On Hold",
    activate: "Set Active",
    draft: "Set Draft",
    share: "Share",
    print: "Print / PDF",
    fill: "Fill",
    submit: "Submit",
    required: "Required",
    language: "Language",
    english: "English",
    spanish: "Spanish",
    addPage: "Add Page",
    page: "Page",
    properties: "Properties",
    label: "Label",
    help: "Help Text",
    options: "Options",
    futureOnly: "Future-only date/time",
    notAllowed: "You don't have access to Build Forms.",
    onHoldBlocked: "This form is On Hold and cannot be used.",
    archivedBlocked: "This form is Archived and cannot be used.",
    chooseTemplate: "Choose a template",
    noTemplates: "No templates yet. Admins can create one in Build Forms.",
    noAllowedTemplates: "No forms assigned to your role yet.",
    saved: "Saved",
    copiedLink: "Link copied",
    submitted: "Submitted",
    invalid: "Please fix the highlighted fields.",
    appointmentFuture: "Appointment must be in the future.",
  },
  es: {
    useForms: "Usar formularios",
    buildForms: "Crear formularios",
    templates: "Plantillas",
    submissions: "Envíos",
    myCompleted: "Mis formularios completados",
    adminInbox: "Bandeja de envíos (Admin)",
    search: "Buscar",
    purpose: "Tipo de propósito",
    status: "Estado",
    roles: "Roles permitidos",
    save: "Guardar",
    duplicate: "Duplicar",
    archive: "Archivar",
    restore: "Restaurar",
    hold: "En espera",
    activate: "Activar",
    draft: "Borrador",
    share: "Compartir",
    print: "Imprimir / PDF",
    fill: "Completar",
    submit: "Enviar",
    required: "Requerido",
    language: "Idioma",
    english: "Inglés",
    spanish: "Español",
    addPage: "Agregar página",
    page: "Página",
    properties: "Propiedades",
    label: "Etiqueta",
    help: "Texto de ayuda",
    options: "Opciones",
    futureOnly: "Solo fecha/hora futura",
    notAllowed: "No tienes acceso para crear formularios.",
    onHoldBlocked: "Este formulario está en espera y no se puede usar.",
    archivedBlocked: "Este formulario está archivado y no se puede usar.",
    chooseTemplate: "Elige una plantilla",
    noTemplates: "Aún no hay plantillas. Los admins pueden crear una en Crear formularios.",
    noAllowedTemplates: "Aún no hay formularios asignados a tu rol.",
    saved: "Guardado",
    copiedLink: "Enlace copiado",
    submitted: "Enviado",
    invalid: "Corrige los campos marcados.",
    appointmentFuture: "La cita debe ser en el futuro.",
  },
};

function t(lang: Lang, key: string) {
  return UI_TEXT[lang][key] ?? key;
}

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
  rules?: {
    futureOnly?: boolean;
  };
};

type FormPage = {
  id: string;
  fields: FormField[];
};

type FormTemplate = {
  id: string;
  name: string;
  purposeType: PurposeType;
  status: TemplateStatus;
  allowed: {
    masterAdmin: boolean;
    admin: boolean;
    manager: boolean;
    crew: boolean;
    customer: boolean;
  };
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
  submittedBy: {
    userId?: string | number;
    name?: string;
    role?: string;
    isMasterAdmin?: boolean;
  };
  valuesByFieldId: Record<string, any>;
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampToCanvas(f: Pick<FormField, "x" | "y" | "w" | "h">) {
  const minW = 120;
  const minH = 42;
  const w = Math.max(minW, Math.round(f.w));
  const h = Math.max(minH, Math.round(f.h));
  const maxX = LETTER.w - LETTER.pad - w;
  const maxY = LETTER.h - LETTER.pad - h;
  const x = Math.min(Math.max(LETTER.pad, Math.round(f.x)), maxX);
  const y = Math.min(Math.max(LETTER.pad, Math.round(f.y)), maxY);
  return { x, y, w, h };
}

function isAdminOrMaster(user: any) {
  return user?.isMasterAdmin === true || user?.role === "Admin";
}

function userLevel(user: any): UserLevel {
  if (user?.isMasterAdmin === true) return "Master Admin";
  const r = user?.role as Role | undefined;
  return r ?? "Customer";
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

function canUserSeeTemplateInLibrary(user: any, tpl: FormTemplate) {
  const admin = isAdminOrMaster(user);
  if (tpl.status === "Archived") return admin;
  if (!admin) return canUserUseTemplate(user, tpl);
  return true;
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

function makeFieldFromPalette(label: string): FormField {
  const type = FIELD_TYPE_MAP[label] ?? "unknown";
  const base = {
    id: uid(),
    type,
    paletteLabel: label,
    x: LETTER.pad + 16,
    y: LETTER.pad + 16,
    w: 340,
    h: type === "header" || type === "paragraph" ? 90 : 62,
    required: false,
    label: { en: label, es: label },
    help: { en: "", es: "" },
    rules: { futureOnly: type === "appointment" },
  } as FormField;

  if (type === "dropdown" || type === "singleChoice" || type === "multipleChoice") {
    base.options = [
      { id: uid(), label: { en: "Option 1", es: "Opción 1" } },
      { id: uid(), label: { en: "Option 2", es: "Opción 2" } },
    ];
  }
  return base;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const formStorage = {
  async loadTemplates(): Promise<FormTemplate[]> {
    return safeJsonParse<FormTemplate[]>(localStorage.getItem(LS_KEYS.templates), []);
  },
  async saveTemplates(templates: FormTemplate[]): Promise<void> {
    localStorage.setItem(LS_KEYS.templates, JSON.stringify(templates));
  },
  async loadSubmissions(): Promise<Submission[]> {
    return safeJsonParse<Submission[]>(localStorage.getItem(LS_KEYS.submissions), []);
  },
  async saveSubmissions(subs: Submission[]): Promise<void> {
    localStorage.setItem(LS_KEYS.submissions, JSON.stringify(subs));
  },
};

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

function FormBuilder1Inner() {
  const { user } = useAuth();
  const admin = isAdminOrMaster(user);

  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<"use" | "build">("use");

  const { showToast, ToastNode } = useMiniToast();

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const [useSelectedTemplateId, setUseSelectedTemplateId] = useState<string | null>(null);
  const [fillValues, setFillValues] = useState<Record<string, any>>({});
  const [fillErrors, setFillErrors] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<PurposeType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | "All">("All");

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>({ kind: "none" });

  const templatesRef = useRef(templates);
  templatesRef.current = templates;
  const activeTemplateIdRef = useRef(activeTemplateId);
  activeTemplateIdRef.current = activeTemplateId;
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;

  useEffect(() => {
    (async () => {
      const [tpls, subs] = await Promise.all([formStorage.loadTemplates(), formStorage.loadSubmissions()]);
      setTemplates(tpls);
      setSubmissions(subs);
    })();
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

  useEffect(() => {
    if (activeTemplateId && !templates.some((tp) => tp.id === activeTemplateId)) {
      setActiveTemplateId(null);
      setSelectedFieldId(null);
      setActivePageIndex(0);
    }
    if (useSelectedTemplateId && !templates.some((tp) => tp.id === useSelectedTemplateId)) {
      setUseSelectedTemplateId(null);
      setFillValues({});
      setFillErrors({});
    }
  }, [templates, activeTemplateId, useSelectedTemplateId]);

  useEffect(() => {
    const handler = (evt: Event) => {
      const e = evt as CustomEvent;
      const fieldId = e.detail?.fieldId as string | undefined;
      const updater = e.detail?.updater as ((f: FormField) => FormField) | undefined;
      if (!fieldId || !updater) return;

      const curTemplates = templatesRef.current;
      const curActiveId = activeTemplateIdRef.current;
      const curPageIdx = activePageIndexRef.current;
      if (!curActiveId) return;

      const tpl = curTemplates.find((tp) => tp.id === curActiveId);
      if (!tpl) return;

      const pages = tpl.pages.map((p, idx) => {
        if (idx !== curPageIdx) return p;
        return { ...p, fields: p.fields.map((f) => (f.id === fieldId ? updater(f) : f)) };
      });

      const updated: FormTemplate = { ...tpl, pages, updatedAt: new Date().toISOString() };
      const next = curTemplates.map((tp) => (tp.id === updated.id ? updated : tp));
      setTemplates(next);
      localStorage.setItem(LS_KEYS.templates, JSON.stringify(next));
    };

    window.addEventListener("__FB1_UPDATE_FIELD__", handler as any);
    return () => window.removeEventListener("__FB1_UPDATE_FIELD__", handler as any);
  }, []);

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

  const filteredTemplatesForBuild = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter((tpl) => admin || tpl.status !== "Archived")
      .filter((tpl) => (purposeFilter === "All" ? true : tpl.purposeType === purposeFilter))
      .filter((tpl) => (statusFilter === "All" ? true : tpl.status === statusFilter))
      .filter((tpl) => (q ? tpl.name.toLowerCase().includes(q) || tpl.purposeType.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [templates, search, purposeFilter, statusFilter, admin]);

  const filteredTemplatesForUse = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter((tpl) => canUserSeeTemplateInLibrary(user, tpl))
      .filter((tpl) => tpl.status !== "Archived")
      .filter((tpl) => (purposeFilter === "All" ? true : tpl.purposeType === purposeFilter))
      .filter((tpl) => (statusFilter === "All" ? true : tpl.status === statusFilter))
      .filter((tpl) => (q ? tpl.name.toLowerCase().includes(q) || tpl.purposeType.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [templates, search, purposeFilter, statusFilter, user]);

  const mySubmissions = useMemo(() => {
    const meName = user?.name ?? user?.username ?? "User";
    return submissions
      .filter((s) => (s.submittedBy?.name ?? "") === meName)
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  }, [submissions, user]);

  const adminInbox = useMemo(() => {
    if (!admin) return [];
    return [...submissions].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  }, [submissions, admin]);

  async function persistTemplates(next: FormTemplate[]) {
    setTemplates(next);
    await formStorage.saveTemplates(next);
    showToast(t(lang, "saved"));
  }

  async function persistSubmissions(next: Submission[]) {
    setSubmissions(next);
    await formStorage.saveSubmissions(next);
    showToast(t(lang, "submitted"));
  }

  function updateActiveTemplate(patch: Partial<FormTemplate>) {
    if (!activeTemplate) return;
    const updated: FormTemplate = { ...activeTemplate, ...patch, updatedAt: new Date().toISOString() };
    const next = templates.map((tp) => (tp.id === updated.id ? updated : tp));
    void persistTemplates(next);
  }

  function updateActivePageFields(updateFn: (fields: FormField[]) => FormField[]) {
    if (!activeTemplate || !activePage) return;
    const pages = activeTemplate.pages.map((p, idx) => (idx === activePageIndex ? { ...p, fields: updateFn(p.fields) } : p));
    updateActiveTemplate({ pages });
  }

  function createTemplate() {
    const tpl = makeNewTemplate();
    const next = [tpl, ...templates];
    void persistTemplates(next);
    setActiveTemplateId(tpl.id);
    setSelectedFieldId(null);
    setActivePageIndex(0);
  }

  function duplicateTemplate(templateId: string) {
    const src = templates.find((tp) => tp.id === templateId);
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
    const next = [dup, ...templates];
    void persistTemplates(next);
    setActiveTemplateId(dup.id);
    setSelectedFieldId(null);
    setActivePageIndex(0);
  }

  function setTemplateStatus(templateId: string, status: TemplateStatus) {
    const next = templates.map((tp) =>
      tp.id === templateId ? { ...tp, status, updatedAt: new Date().toISOString() } : tp
    );
    void persistTemplates(next);
  }

  function archiveTemplate(templateId: string) {
    setTemplateStatus(templateId, "Archived");
    if (activeTemplateId === templateId) {
      setActiveTemplateId(null);
      setSelectedFieldId(null);
      setActivePageIndex(0);
    }
  }

  function restoreTemplate(templateId: string) {
    setTemplateStatus(templateId, "Draft");
  }

  function addPage() {
    if (!activeTemplate) return;
    const pages = [...activeTemplate.pages, { id: uid(), fields: [] as FormField[] }];
    updateActiveTemplate({ pages });
    setActivePageIndex(pages.length - 1);
    setSelectedFieldId(null);
  }

  function addFieldFromPalette(paletteLabel: string) {
    if (!activeTemplate || !activePage) return;
    const f = makeFieldFromPalette(paletteLabel);
    const { x, y, w, h } = clampToCanvas(f);
    const field = { ...f, x, y, w, h };
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
      showToast(t(lang, "copiedLink"));
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

  function resetFill(_template: FormTemplate | null) {
    setFillValues({});
    setFillErrors({});
  }

  function validateAndSubmit(template: FormTemplate) {
    const errors: Record<string, string> = {};
    const values = fillValues;

    if (template.status === "On Hold") {
      showToast(t(lang, "onHoldBlocked"));
      return;
    }
    if (template.status === "Archived") {
      showToast(t(lang, "archivedBlocked"));
      return;
    }
    if (!canUserUseTemplate(user, template)) {
      showToast(t(lang, "notAllowed"));
      return;
    }

    for (const page of template.pages) {
      for (const field of page.fields) {
        const v = values[field.id];
        if (field.required) {
          const empty =
            v === undefined ||
            v === null ||
            v === "" ||
            (Array.isArray(v) && v.length === 0);
          if (empty) errors[field.id] = t(lang, "required");
        }
        if (field.type === "appointment" && field.rules?.futureOnly && v) {
          const dt = new Date(v).getTime();
          if (!Number.isFinite(dt) || dt <= Date.now()) {
            errors[field.id] = t(lang, "appointmentFuture");
          }
        }
      }
    }

    setFillErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast(t(lang, "invalid"));
      return;
    }

    const sub: Submission = {
      id: uid(),
      templateId: template.id,
      templateName: template.name,
      purposeType: template.purposeType,
      submittedAt: new Date().toISOString(),
      submittedBy: {
        userId: user?.id,
        name: user?.name ?? user?.username ?? "User",
        role: user?.role,
        isMasterAdmin: user?.isMasterAdmin === true,
      },
      valuesByFieldId: values,
    };

    void persistSubmissions([sub, ...submissions]);
    setFillValues({});
    setFillErrors({});
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
    } else if (st.kind === "resize") {
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
    const paletteLabel = e.dataTransfer.getData("text/plain");
    if (!paletteLabel) return;
    if (!activeTemplate || !activePage) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    const base = makeFieldFromPalette(paletteLabel);

    if (rect) {
      base.x = Math.round(e.clientX - rect.left);
      base.y = Math.round(e.clientY - rect.top);
    }
    const clamped = clampToCanvas(base);
    const field: FormField = { ...base, ...clamped };

    updateActivePageFields((fields) => [...fields, field]);
    setSelectedFieldId(field.id);
  }

  function statusBadge(status: TemplateStatus) {
    const map: Record<TemplateStatus, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      Draft: { variant: "secondary", label: "Draft" },
      Active: { variant: "default", label: "Active" },
      "On Hold": { variant: "secondary", label: "On Hold" },
      Archived: { variant: "destructive", label: "Archived" },
    };
    const s = map[status];
    return (
      <Badge className="ml-2" variant={s.variant as any}>
        {s.label}
      </Badge>
    );
  }

  return (
    <div className="p-4" data-testid="form-builder-1-page">
      {ToastNode}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold" data-testid="text-builder-title">Form Builder 1</h1>
          <Badge variant="secondary" className="ml-2">
            v1 (local storage)
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
            <span className="text-xs text-muted-foreground">{t(lang, "language")}</span>
            <Button
              variant={lang === "en" ? "default" : "secondary"}
              size="sm"
              onClick={() => setLang("en")}
              data-testid="button-lang-en"
            >
              {t(lang, "english")}
            </Button>
            <Button
              variant={lang === "es" ? "default" : "secondary"}
              size="sm"
              onClick={() => setLang("es")}
              data-testid="button-lang-es"
            >
              {t(lang, "spanish")}
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
            <span className="text-xs text-muted-foreground">Mode</span>
            <Button
              variant={mode === "use" ? "default" : "secondary"}
              size="sm"
              onClick={() => setMode("use")}
              data-testid="button-mode-use"
            >
              {t(lang, "useForms")}
            </Button>
            <Button
              variant={mode === "build" ? "default" : "secondary"}
              size="sm"
              onClick={() => setMode("build")}
              disabled={!admin}
              title={!admin ? t(lang, "notAllowed") : undefined}
              data-testid="button-mode-build"
            >
              {t(lang, "buildForms")}
            </Button>
          </div>

          <Button variant="secondary" onClick={printCurrent} data-testid="button-print">
            {t(lang, "print")}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`${t(lang, "search")}…`}
                data-testid="input-search"
              />
            </div>
            <div>
              <Select value={purposeFilter} onValueChange={(v) => setPurposeFilter(v as any)}>
                <SelectTrigger data-testid="select-purpose-filter">
                  <SelectValue placeholder={t(lang, "purpose")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {PURPOSE_TYPES_DEFAULT.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder={t(lang, "status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {(["Draft", "Active", "On Hold", "Archived"] as TemplateStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === "use" ? (
        <UseMode
          lang={lang}
          user={user}
          admin={admin}
          templates={filteredTemplatesForUse}
          allTemplates={templates}
          useTemplate={useTemplate}
          useSelectedTemplateId={useSelectedTemplateId}
          setUseSelectedTemplateId={(id) => {
            setUseSelectedTemplateId(id);
            resetFill(templates.find((tp) => tp.id === id) ?? null);
          }}
          fillValues={fillValues}
          setFillValues={setFillValues}
          fillErrors={fillErrors}
          setFillErrors={setFillErrors}
          onSubmit={() => useTemplate && validateAndSubmit(useTemplate)}
          onShare={(id) => void shareTemplate(id)}
          submissions={submissions}
          mySubmissions={mySubmissions}
          adminInbox={adminInbox}
        />
      ) : (
        <BuildMode
          lang={lang}
          user={user}
          admin={admin}
          templates={filteredTemplatesForBuild}
          activeTemplate={activeTemplate}
          activeTemplateId={activeTemplateId}
          setActiveTemplateId={(id) => {
            setActiveTemplateId(id);
            setSelectedFieldId(null);
            setActivePageIndex(0);
          }}
          createTemplate={createTemplate}
          duplicateTemplate={duplicateTemplate}
          archiveTemplate={archiveTemplate}
          restoreTemplate={restoreTemplate}
          setTemplateStatus={setTemplateStatus}
          updateActiveTemplate={updateActiveTemplate}
          activePageIndex={activePageIndex}
          setActivePageIndex={(idx) => {
            setActivePageIndex(idx);
            setSelectedFieldId(null);
          }}
          addPage={addPage}
          activePage={activePage}
          selectedField={selectedField}
          selectedFieldId={selectedFieldId}
          setSelectedFieldId={setSelectedFieldId}
          addFieldFromPalette={addFieldFromPalette}
          onPaletteDragStart={onPaletteDragStart}
          onCanvasDragOver={onCanvasDragOver}
          onCanvasDrop={onCanvasDrop}
          canvasRef={canvasRef}
          onCanvasPointerMove={onCanvasPointerMove}
          onCanvasPointerUp={onCanvasPointerUp}
          onFieldPointerDownMove={onFieldPointerDownMove}
          onFieldPointerDownResize={onFieldPointerDownResize}
          deleteSelectedField={deleteSelectedField}
          onShare={(id) => void shareTemplate(id)}
        />
      )}
    </div>
  );
}

function UseMode(props: {
  lang: Lang;
  user: any;
  admin: boolean;
  templates: FormTemplate[];
  allTemplates: FormTemplate[];
  useTemplate: FormTemplate | null;
  useSelectedTemplateId: string | null;
  setUseSelectedTemplateId: (id: string | null) => void;
  fillValues: Record<string, any>;
  setFillValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  fillErrors: Record<string, string>;
  setFillErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: () => void;
  onShare: (id: string) => void;
  submissions: Submission[];
  mySubmissions: Submission[];
  adminInbox: Submission[];
}) {
  const {
    lang,
    user,
    admin,
    templates,
    useTemplate,
    useSelectedTemplateId,
    setUseSelectedTemplateId,
    fillValues,
    setFillValues,
    fillErrors,
    onSubmit,
    onShare,
    mySubmissions,
    adminInbox,
  } = props;

  const hasAllowedTemplates = templates.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t(lang, "templates")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasAllowedTemplates ? (
            <div className="text-sm text-muted-foreground">
              {t(lang, "noAllowedTemplates")}
              <div className="mt-2">
                <span className="text-xs">
                  {t(lang, "noTemplates")}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => {
                const usable = canUserUseTemplate(user, tpl) && tpl.status !== "On Hold";
                return (
                  <button
                    key={tpl.id}
                    className={[
                      "w-full rounded-xl border p-3 text-left transition",
                      useSelectedTemplateId === tpl.id ? "border-black bg-black text-white" : "bg-white hover:bg-gray-50",
                    ].join(" ")}
                    onClick={() => setUseSelectedTemplateId(tpl.id)}
                    data-testid={`button-use-template-${tpl.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{tpl.name}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{tpl.purposeType}</Badge>
                        <Badge variant={tpl.status === "Active" ? "default" : "secondary"}>{tpl.status}</Badge>
                      </div>
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      Roles: {allowedRolesSummary(tpl)}
                    </div>
                    {!usable && (
                      <div className="mt-2 text-xs text-red-600">
                        {tpl.status === "On Hold" ? t(lang, "onHoldBlocked") : t(lang, "notAllowed")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {useSelectedTemplateId && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => onShare(useSelectedTemplateId)}
                data-testid="button-share-use"
              >
                {t(lang, "share")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {t(lang, "fill")}{" "}
              <span className="text-muted-foreground">
                {useTemplate ? `— ${useTemplate.name}` : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!useTemplate ? (
              <div className="text-sm text-muted-foreground" data-testid="text-choose-template">{t(lang, "chooseTemplate")}</div>
            ) : (
              <FillRenderer
                lang={lang}
                user={user}
                template={useTemplate}
                fillValues={fillValues}
                setFillValues={setFillValues}
                fillErrors={fillErrors}
              />
            )}

            {useTemplate && (
              <div className="mt-4 flex gap-2">
                <Button onClick={onSubmit} disabled={useTemplate.status !== "Active" && useTemplate.status !== "Draft"} data-testid="button-submit-form">
                  {t(lang, "submit")}
                </Button>
                <Button variant="secondary" onClick={() => window.print()} data-testid="button-print-use">
                  {t(lang, "print")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine" data-testid="tab-my-submissions">{t(lang, "myCompleted")}</TabsTrigger>
            {admin && <TabsTrigger value="admin" data-testid="tab-admin-inbox">{t(lang, "adminInbox")}</TabsTrigger>}
          </TabsList>

          <TabsContent value="mine">
            <Card>
              <CardContent className="pt-6">
                <SubmissionsList submissions={mySubmissions} />
              </CardContent>
            </Card>
          </TabsContent>

          {admin && (
            <TabsContent value="admin">
              <Card>
                <CardContent className="pt-6">
                  <SubmissionsList submissions={adminInbox} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
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

function SubmissionsList({ submissions }: { submissions: Submission[] }) {
  if (!submissions.length) {
    return <div className="text-sm text-muted-foreground" data-testid="text-no-submissions">No submissions yet (v1 local).</div>;
  }
  return (
    <div className="space-y-2">
      {submissions.map((s) => (
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

function FillRenderer(props: {
  lang: Lang;
  user: any;
  template: FormTemplate;
  fillValues: Record<string, any>;
  setFillValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  fillErrors: Record<string, string>;
}) {
  const { lang, user, template, fillValues, setFillValues, fillErrors } = props;

  const canUse = canUserUseTemplate(user, template);
  const blockedReason =
    template.status === "On Hold"
      ? t(lang, "onHoldBlocked")
      : template.status === "Archived"
      ? t(lang, "archivedBlocked")
      : !canUse
      ? t(lang, "notAllowed")
      : null;

  if (blockedReason) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm text-red-600">{blockedReason}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {template.pages.map((page, idx) => (
        <div key={page.id} className="rounded-xl border bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-muted-foreground">
            {t(lang, "page")} {idx + 1}
          </div>
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
          <Input type="email" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
          {errNode}
        </div>
      );
    case "phone":
      return (
        <div className="space-y-1">
          {common}
          <Input type="tel" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
          {errNode}
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          {common}
          <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
          {errNode}
        </div>
      );
    case "date":
      return (
        <div className="space-y-1">
          {common}
          <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
          {errNode}
        </div>
      );
    case "time":
      return (
        <div className="space-y-1">
          {common}
          <Input type="time" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
          {errNode}
        </div>
      );
    case "appointment":
      return (
        <div className="space-y-1">
          {common}
          <Input type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
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
          />
          <div className="text-xs text-muted-foreground">v1 stores file metadata only (not the file).</div>
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
          />
          <div className="text-xs text-muted-foreground">v1 stores image metadata only (not the image).</div>
          {errNode}
        </div>
      );
    case "dropdown":
    case "singleChoice":
      return (
        <div className="space-y-1">
          {common}
          <Select value={value ?? ""} onValueChange={(v) => onChange(v)}>
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label?.[lang] ?? "Option"}
                </SelectItem>
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
          <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
          {errNode}
        </div>
      );
    default:
      return (
        <div className="space-y-1">
          {common}
          <Input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
          {errNode}
        </div>
      );
  }
}

function BuildMode(props: {
  lang: Lang;
  user: any;
  admin: boolean;
  templates: FormTemplate[];
  activeTemplate: FormTemplate | null;
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  createTemplate: () => void;
  duplicateTemplate: (id: string) => void;
  archiveTemplate: (id: string) => void;
  restoreTemplate: (id: string) => void;
  setTemplateStatus: (id: string, s: TemplateStatus) => void;
  updateActiveTemplate: (patch: Partial<FormTemplate>) => void;
  activePageIndex: number;
  setActivePageIndex: (idx: number) => void;
  addPage: () => void;
  activePage: FormPage | null;
  selectedField: FormField | null;
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;
  addFieldFromPalette: (label: string) => void;
  onPaletteDragStart: (e: React.DragEvent, label: string) => void;
  onCanvasDragOver: (e: React.DragEvent) => void;
  onCanvasDrop: (e: React.DragEvent) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onCanvasPointerMove: (e: React.PointerEvent) => void;
  onCanvasPointerUp: () => void;
  onFieldPointerDownMove: (e: React.PointerEvent, id: string) => void;
  onFieldPointerDownResize: (e: React.PointerEvent, id: string) => void;
  deleteSelectedField: () => void;
  onShare: (id: string) => void;
}) {
  const {
    lang,
    admin,
    templates,
    activeTemplate,
    activeTemplateId,
    setActiveTemplateId,
    createTemplate,
    duplicateTemplate,
    archiveTemplate,
    restoreTemplate,
    updateActiveTemplate,
    activePageIndex,
    setActivePageIndex,
    addPage,
    activePage,
    selectedField,
    setSelectedFieldId,
    addFieldFromPalette,
    onPaletteDragStart,
    onCanvasDragOver,
    onCanvasDrop,
    canvasRef,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onFieldPointerDownMove,
    onFieldPointerDownResize,
    deleteSelectedField,
    onShare,
  } = props;

  if (!admin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">{t(lang, "notAllowed")}</div>
        </CardContent>
      </Card>
    );
  }

  function updateField(fieldId: string, updater: (f: FormField) => FormField) {
    window.dispatchEvent(
      new CustomEvent("__FB1_UPDATE_FIELD__", { detail: { fieldId, updater } })
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr_380px]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t(lang, "templates")}</span>
            <Button size="sm" onClick={createTemplate} data-testid="button-new-template">
              + New
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!templates.length ? (
            <div className="text-sm text-muted-foreground">{t(lang, "noTemplates")}</div>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                className={[
                  "w-full rounded-xl border p-3 text-left transition",
                  activeTemplateId === tpl.id ? "border-black bg-black text-white" : "bg-white hover:bg-gray-50",
                ].join(" ")}
                onClick={() => setActiveTemplateId(tpl.id)}
                data-testid={`button-template-${tpl.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{tpl.name}</div>
                  <Badge variant="secondary">{tpl.purposeType}</Badge>
                </div>
                <div className="mt-1 text-xs opacity-80">
                  <span>Status: {tpl.status}</span>
                </div>
              </button>
            ))
          )}

          {activeTemplate && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => onShare(activeTemplate.id)} data-testid="button-share-build">
                {t(lang, "share")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => duplicateTemplate(activeTemplate.id)} data-testid="button-duplicate">
                {t(lang, "duplicate")}
              </Button>
              {activeTemplate.status !== "Archived" ? (
                <Button variant="destructive" size="sm" onClick={() => archiveTemplate(activeTemplate.id)} data-testid="button-archive">
                  {t(lang, "archive")}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => restoreTemplate(activeTemplate.id)} data-testid="button-restore">
                  {t(lang, "restore")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Builder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!activeTemplate ? (
              <div className="text-sm text-muted-foreground">Select a template or create a new one.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground">Template Name</div>
                    <Input
                      value={activeTemplate.name}
                      onChange={(e) => updateActiveTemplate({ name: e.target.value })}
                      data-testid="input-template-name"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t(lang, "purpose")}</div>
                    <Select
                      value={activeTemplate.purposeType}
                      onValueChange={(v) => updateActiveTemplate({ purposeType: v as PurposeType })}
                    >
                      <SelectTrigger data-testid="select-purpose">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSE_TYPES_DEFAULT.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{t(lang, "status")}</div>
                    <Select
                      value={activeTemplate.status}
                      onValueChange={(v) => updateActiveTemplate({ status: v as TemplateStatus })}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Draft", "Active", "On Hold", "Archived"] as TemplateStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground">{t(lang, "roles")}</div>
                    <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-3">
                      <RoleToggle
                        label="Master Admin"
                        checked={activeTemplate.allowed.masterAdmin}
                        onChange={(v) => updateActiveTemplate({ allowed: { ...activeTemplate.allowed, masterAdmin: v } })}
                      />
                      <RoleToggle
                        label="Admin"
                        checked={activeTemplate.allowed.admin}
                        onChange={(v) => updateActiveTemplate({ allowed: { ...activeTemplate.allowed, admin: v } })}
                      />
                      <RoleToggle
                        label="Manager"
                        checked={activeTemplate.allowed.manager}
                        onChange={(v) => updateActiveTemplate({ allowed: { ...activeTemplate.allowed, manager: v } })}
                      />
                      <RoleToggle
                        label="Crew"
                        checked={activeTemplate.allowed.crew}
                        onChange={(v) => updateActiveTemplate({ allowed: { ...activeTemplate.allowed, crew: v } })}
                      />
                      <RoleToggle
                        label="Customer"
                        checked={activeTemplate.allowed.customer}
                        onChange={(v) => updateActiveTemplate({ allowed: { ...activeTemplate.allowed, customer: v } })}
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
                        onClick={() => setActivePageIndex(idx)}
                        data-testid={`button-page-${idx}`}
                      >
                        {t(lang, "page")} {idx + 1}
                      </Button>
                    ))}
                    <Button variant="secondary" size="sm" onClick={addPage} data-testid="button-add-page">
                      + {t(lang, "addPage")}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Drag fields from palette onto the page - Click to select - Drag to move - Handle to resize
                  </div>
                </div>

                <div className="w-full overflow-auto rounded-xl border bg-gray-50 p-3">
                  <div
                    ref={canvasRef}
                    className="relative bg-white shadow-sm"
                    style={{ width: LETTER.w, height: LETTER.h, padding: LETTER.pad, borderRadius: 12, border: "1px solid #e5e7eb" }}
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {PALETTE_GROUPS.map((g) => (
                <div key={g.id} className="rounded-xl border bg-white p-3">
                  <div className="mb-2 text-xs font-semibold text-muted-foreground">{g.title}</div>
                  <div className="flex flex-col gap-2">
                    {g.items.map((label) => (
                      <div
                        key={label}
                        draggable
                        onDragStart={(e) => onPaletteDragStart(e, label)}
                        className="cursor-grab rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50 active:cursor-grabbing"
                        onDoubleClick={() => addFieldFromPalette(label)}
                        title="Drag to canvas or double-click to add"
                        data-testid={`palette-item-${label.toLowerCase().replace(/[\s/]+/g, "-")}`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t(lang, "properties")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activeTemplate ? (
            <div className="text-sm text-muted-foreground">Select a template.</div>
          ) : !selectedField ? (
            <div className="text-sm text-muted-foreground" data-testid="text-select-field">Select a field on the page.</div>
          ) : (
            <>
              <div>
                <div className="text-xs text-muted-foreground">{t(lang, "label")} ({lang.toUpperCase()})</div>
                <Input
                  value={selectedField.label?.[lang] ?? selectedField.paletteLabel}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateField(selectedField.id, (f) => ({
                      ...f,
                      label: { ...f.label, [lang]: v },
                    }));
                  }}
                  data-testid="input-field-label"
                />
              </div>

              <div>
                <div className="text-xs text-muted-foreground">{t(lang, "help")} ({lang.toUpperCase()})</div>
                <Input
                  value={selectedField.help?.[lang] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateField(selectedField.id, (f) => ({
                      ...f,
                      help: { ...f.help, [lang]: v },
                    }));
                  }}
                  data-testid="input-field-help"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedField.required}
                  onCheckedChange={(c) => updateField(selectedField.id, (f) => ({ ...f, required: !!c }))}
                  data-testid="checkbox-required"
                />
                <span className="text-sm">{t(lang, "required")}</span>
              </div>

              {["dropdown", "singleChoice", "multipleChoice"].includes(selectedField.type) && (
                <OptionsEditor
                  lang={lang}
                  field={selectedField}
                  onChange={(nextOptions) =>
                    updateField(selectedField.id, (f) => ({ ...f, options: nextOptions }))
                  }
                />
              )}

              {selectedField.type === "appointment" && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!selectedField.rules?.futureOnly}
                    onCheckedChange={(v) =>
                      updateField(selectedField.id, (f) => ({ ...f, rules: { ...f.rules, futureOnly: v } }))
                    }
                  />
                  <span className="text-sm">{t(lang, "futureOnly")}</span>
                </div>
              )}

              <Button variant="destructive" onClick={deleteSelectedField} data-testid="button-delete-field">
                Delete Field
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RoleToggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const { label, checked, onChange } = props;
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(!!c)} />
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
      />
    </div>
  );
}

function FieldPreview({ type }: { type: FieldType }) {
  switch (type) {
    case "header":
      return <div className="text-sm font-bold text-muted-foreground">Header / Subheader</div>;
    case "paragraph":
      return <div className="text-xs text-muted-foreground">Paragraph…</div>;
    case "email":
      return <div className="text-xs text-muted-foreground">email input</div>;
    case "phone":
      return <div className="text-xs text-muted-foreground">phone input</div>;
    case "number":
      return <div className="text-xs text-muted-foreground">number input</div>;
    case "date":
      return <div className="text-xs text-muted-foreground">date picker</div>;
    case "time":
      return <div className="text-xs text-muted-foreground">time picker</div>;
    case "appointment":
      return <div className="text-xs text-muted-foreground">appointment (date+time)</div>;
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
      return <div className="text-xs text-muted-foreground">[{type}]</div>;
  }
}

function OptionsEditor(props: { lang: Lang; field: FormField; onChange: (opts: Option[]) => void }) {
  const { lang, field, onChange } = props;
  const opts = field.options ?? [];

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{t(lang, "options")}</div>
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
            />
            <Button
              variant="secondary"
              onClick={() => {
                const next = opts.filter((_, i) => i !== idx);
                onChange(next);
              }}
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
      >
        + Add Option
      </Button>
    </div>
  );
}

export default function FormBuilder1() {
  return <FormBuilder1Inner />;
}
