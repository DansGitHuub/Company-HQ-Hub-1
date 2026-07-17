import React, { useState, useEffect } from "react";
import SignaturePad from "@/components/forms/SignaturePad";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  MoreHorizontal, 
  Shield, 
  UserCheck, 
  UserX,
  Key,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  Crown,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Upload,
  Image,
  Building2,
  GripVertical,
  LayoutDashboard,
  BookOpen,
  Hammer,
  Users,
  Megaphone,
  FileText,
  Settings,
  GraduationCap,
  User as UserIcon,
  Sparkles,
  HelpCircle,
  Inbox,
  Truck,
  Bot,
  Power,
  DollarSign,
  Calendar,
  Play,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  Copy,
  Globe,
  Wrench,
  Star,
  Zap,
  ClipboardCheck,
  ClipboardList,
  Puzzle,
  Mail,
  FileSignature,
  Layers,
  Archive,
  Tag,
  ArrowLeftRight,
  Link2Off,
  Pencil,
  Leaf,
  Camera,
  GitMerge,
  Activity,
  Save,
  Sun,
  MessageSquare,
  CalendarClock,
  Calculator,
  CheckSquare,
  CalendarCheck,
  Timer,
  BarChart2,
  SlidersHorizontal,
  FlagTriangleRight,
  MessageSquareWarning,
  FlaskConical,
  Bell,
  Rocket,
  ChevronRight,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import AssistantAgentManager from "@/components/AssistantAgentManager";
import ConversationLogViewer from "@/components/ConversationLogViewer";
import SystemStatusReport from "@/components/SystemStatusReport";
import SOPPipeline from "@/components/SOPPipeline";
import ProcessAuditor from "@/pages/ProcessAuditor";
import IntegrationWizard from "@/pages/IntegrationWizard";
import AgreementTemplatesPanel from "@/components/admin/AgreementTemplatesPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import type { User, AccessRequest, CompanySettings } from "@shared/schema";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import ArticleReportsCenter from "@/components/ArticleReportsCenter";
import DiagnosticReport from "@/components/DiagnosticReport";
import AdminDocumentLibrary from "@/components/AdminDocumentLibrary";
import SecurityAuditLogPanel from "@/components/admin/SecurityAuditLogPanel";

// ─── Constants & types for Company Settings in-panel sections ─────────────────
const DIVISIONS_LIST = ["Maintenance", "Install", "Snow", "General"] as const;
const TEMPLATE_TYPES = [
  "Maintenance Contract", "Landscape Project", "Snow & Ice Contract", "Custom",
];
const DIV_COLORS_DEFAULT: Record<string, string> = {
  Maintenance: "#22c55e", Install: "#3b82f6", Snow: "#94a3b8", General: "#f59e0b",
};

interface EstimateTemplate {
  id: string; name: string; estimate_type: string | null;
  default_customer_message: string | null; default_terms: string | null; is_active: boolean;
}

function TermsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"install" | "maintenance" | "snow">("install");
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data: termsList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/settings/terms"],
    queryFn: () => apiRequest("GET", "/api/settings/terms").then(r => r.json()),
  });

  const activeRecord = termsList.find(t => t.type === activeTab);
  const content = editContent[activeTab] ?? activeRecord?.content ?? "";

  async function handleSave() {
    if (!activeRecord) return;
    setSaving(activeTab);
    try {
      await apiRequest("PUT", `/api/settings/terms/${activeRecord.id}`, { content });
      qc.invalidateQueries({ queryKey: ["/api/settings/terms"] });
      toast({ title: "Terms & Conditions saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…</div>;

  const tabs: { key: "install" | "maintenance" | "snow"; label: string }[] = [
    { key: "install", label: "Install" },
    { key: "maintenance", label: "Maintenance" },
    { key: "snow", label: "Snow Removal" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Terms &amp; Conditions</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage the legal terms that appear on customer proposals and the portal acceptance page.</p>
      </div>
      <div className="flex gap-2 border-b pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            data-testid={`tc-tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{activeRecord?.title ?? "Terms & Conditions"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={content}
            onChange={e => setEditContent(prev => ({ ...prev, [activeTab]: e.target.value }))}
            className="min-h-[420px] font-mono text-xs"
            placeholder="Enter terms and conditions text…"
            data-testid={`tc-textarea-${activeTab}`}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving === activeTab} data-testid="btn-save-terms">
              {saving === activeTab ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Terms</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DivisionsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: setting } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/settings/division_colors"],
  });

  const parsed: Record<string, string> = setting?.value
    ? (() => { try { return JSON.parse(setting.value); } catch { return DIV_COLORS_DEFAULT; } })()
    : DIV_COLORS_DEFAULT;

  const [colors, setColors] = useState<Record<string, string>>(parsed);

  useEffect(() => {
    if (setting?.value) {
      try { setColors(JSON.parse(setting.value)); } catch {}
    }
  }, [setting?.value]);

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/settings/division_colors", { value: JSON.stringify(colors) }),
    onSuccess: () => {
      toast({ title: "Division colors saved" });
      qc.invalidateQueries({ queryKey: ["/api/settings/division_colors"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Tag className="h-5 w-5" /> Division Colors</CardTitle>
          <CardDescription>Color coding used across jobs, scheduling, and estimates</CardDescription>
        </div>
        <Button size="sm" data-testid="btn-save-divisions" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {DIVISIONS_LIST.map(div => (
          <div key={div} className="flex items-center gap-4" data-testid={`division-row-${div}`}>
            <div className="w-8 h-8 rounded-full border border-border shrink-0" style={{ backgroundColor: colors[div] || "#e5e7eb" }} />
            <span className="w-32 font-medium">{div}</span>
            <Input type="color" className="w-14 h-9 p-1 cursor-pointer" value={colors[div] || "#000000"} data-testid={`color-input-${div}`}
              onChange={e => setColors(c => ({ ...c, [div]: e.target.value }))} />
            <Input className="w-28 font-mono text-sm" value={colors[div] || ""} data-testid={`color-hex-${div}`}
              onChange={e => setColors(c => ({ ...c, [div]: e.target.value }))} placeholder="#000000" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EstimateTemplatesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EstimateTemplate | null>(null);
  const emptyForm = { name: "", estimate_type: "Custom", default_customer_message: "", default_terms: "", is_active: true };
  const [form, setForm] = useState(emptyForm);

  const { data: templates = [], isLoading } = useQuery<EstimateTemplate[]>({
    queryKey: ["/api/estimate-templates?all=true"],
    queryFn: () => fetch("/api/estimate-templates?all=true", { credentials: "include" }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => apiRequest("POST", "/api/estimate-templates", d),
    onSuccess: () => { toast({ title: "Template created" }); invalidateT(); closeModal(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) => apiRequest("PUT", `/api/estimate-templates/${id}`, d),
    onSuccess: () => { toast({ title: "Template updated" }); invalidateT(); closeModal(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/estimate-templates/${id}`),
    onSuccess: () => { toast({ title: "Deleted" }); invalidateT(); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function invalidateT() {
    qc.invalidateQueries({ queryKey: ["/api/estimate-templates?all=true"] });
    qc.invalidateQueries({ queryKey: ["/api/estimate-templates"] });
  }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(t: EstimateTemplate) {
    setEditing(t);
    setForm({ name: t.name, estimate_type: t.estimate_type || "Custom",
      default_customer_message: t.default_customer_message || "",
      default_terms: t.default_terms || "", is_active: t.is_active });
    setModalOpen(true);
  }
  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) updateMut.mutate({ id: editing.id, d: form });
    else createMut.mutate(form);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" /> Estimate Templates</CardTitle>
            <CardDescription>Pre-built templates for the estimate form</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd} data-testid="btn-add-template">
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No templates yet</div>
          ) : (
            <Table data-testid="templates-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id} data-testid={`template-row-${t.id}`}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{t.estimate_type || "—"}</Badge></TableCell>
                    <TableCell>
                      {t.is_active
                        ? <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                        : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} data-testid={`btn-edit-template-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(t)} data-testid={`btn-delete-template-${t.id}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={o => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Template" : "New Estimate Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Template Name</Label>
              <Input data-testid="input-template-name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Cleanup" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.estimate_type ?? ""} onValueChange={v => setForm(f => ({ ...f, estimate_type: v }))}>
                <SelectTrigger data-testid="select-template-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Customer Message</Label>
              <Textarea rows={3} data-testid="input-template-message" value={form.default_customer_message}
                onChange={e => setForm(f => ({ ...f, default_customer_message: e.target.value }))}
                placeholder="Thank you for the opportunity…" />
            </div>
            <div className="space-y-1">
              <Label>Default Terms</Label>
              <Textarea rows={3} data-testid="input-template-terms" value={form.default_terms}
                onChange={e => setForm(f => ({ ...f, default_terms: e.target.value }))}
                placeholder="Payment due upon completion…" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} data-testid="switch-template-active"
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button data-testid="btn-save-template" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuickBooksSection({ qbParam }: { qbParam: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (qbParam === "connected") toast({ title: "QuickBooks connected successfully!" });
    if (qbParam === "error") toast({ title: "QuickBooks connection failed", description: "Please try again.", variant: "destructive" });
    if (qbParam === "not-configured") toast({ title: "QuickBooks not configured", description: "QB_CLIENT_ID and QB_CLIENT_SECRET must be set in environment variables.", variant: "destructive" });
  }, [qbParam]);

  const { data: qbConfig } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/quickbooks/config"],
    queryFn: () => apiRequest("GET", "/api/quickbooks/config").then(r => r.json()),
  });

  const { data: status, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/quickbooks/status"],
    refetchInterval: 30000,
    enabled: qbConfig?.configured === true,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/quickbooks/sync/logs"],
    enabled: status?.connected === true,
  });

  const disconnectMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/quickbooks/disconnect"),
    onSuccess: () => {
      toast({ title: "QuickBooks disconnected" });
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/sync/logs"] });
    },
    onError: () => toast({ title: "Disconnect failed", variant: "destructive" }),
  });

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiRequest("POST", "/api/quickbooks/sync");
      const data = await res.json();
      setSyncResult(data);
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/sync/logs"] });
      toast({ title: "Sync complete" });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  function fmtQbDate(d: string | null) {
    if (!d) return "Never";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function logStatusBadge(s: string) {
    if (s === "success") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Success</span>;
    if (s === "partial")  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700"><AlertCircle className="h-3 w-3" />Partial</span>;
    if (s === "error")    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600"><XCircle className="h-3 w-3" />Error</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"><RefreshCw className="h-3 w-3 animate-spin" />Running</span>;
  }

  return (
    <div className="space-y-5" data-testid="quickbooks-section">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-5 w-5 text-[#2CA01C]" />
            QuickBooks Online
          </CardTitle>
          <CardDescription>Bidirectional sync of customers, invoices, and payments with QuickBooks Online.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qbConfig?.configured === false ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-amber-50">
              <div className="p-2 rounded-full bg-amber-100 text-amber-700"><AlertCircle className="h-5 w-5" /></div>
              <div>
                <p className="font-medium text-sm text-amber-700">QuickBooks credentials not configured</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set <code className="bg-muted px-1 rounded text-xs">QB_CLIENT_ID</code> and{" "}
                  <code className="bg-muted px-1 rounded text-xs">QB_CLIENT_SECRET</code> environment variables, then restart the server.
                </p>
              </div>
            </div>
          ) : statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Checking connection…</div>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-green-50">
                <div className="p-2 rounded-full bg-green-100 text-green-700"><Link2 className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-green-700">Connected to QuickBooks Online</p>
                  <p className="text-xs text-muted-foreground">Realm: {status.realm_id} · Last sync: {fmtQbDate(status.last_sync)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSync} disabled={syncing} data-testid="btn-qb-sync">
                  {syncing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing…</> : <><RefreshCw className="h-4 w-4 mr-2" />Sync Now</>}
                </Button>
                <Button variant="outline" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending} data-testid="btn-qb-disconnect">
                  <Link2Off className="h-4 w-4 mr-2" />Disconnect
                </Button>
              </div>
              {syncResult?.results && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {Object.entries(syncResult.results).map(([entity, r]: [string, any]) => (
                    <div key={entity} className="p-3 rounded-lg border bg-muted/30 text-center">
                      <p className="text-xs font-medium capitalize text-muted-foreground">{entity}</p>
                      <p className="text-xl font-bold mt-1">{r.synced}</p>
                      <p className="text-[10px] text-muted-foreground">synced</p>
                      {r.errors?.length > 0 && <p className="text-[10px] text-destructive mt-0.5">{r.errors.length} error{r.errors.length !== 1 ? "s" : ""}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : status?.needs_reauth ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-red-50" data-testid="qb-reauth-banner">
                <div className="p-2 rounded-full bg-red-100 text-red-700"><AlertCircle className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-red-700">Reauthorize required</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The QuickBooks refresh token is invalid. Reconnect to restore sync.
                    {status.realm_id && <> · Realm: {status.realm_id}</>}
                    {status.last_sync && <> · Last sync: {fmtQbDate(status.last_sync)}</>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => { window.location.href = "/api/quickbooks/auth"; }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-qb-reconnect"
                >
                  <Link2 className="h-4 w-4 mr-2" />Reconnect QuickBooks
                </Button>
                <Button variant="outline" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending} data-testid="btn-qb-disconnect">
                  <Link2Off className="h-4 w-4 mr-2" />Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="p-2 rounded-full bg-muted text-muted-foreground"><Link2Off className="h-5 w-5" /></div>
                <div>
                  <p className="font-medium text-sm">Not connected</p>
                  <p className="text-xs text-muted-foreground">Connect to sync customers, invoices, and payments with QuickBooks Online.</p>
                </div>
              </div>
              <Button onClick={() => { window.location.href = "/api/quickbooks/auth"; }}
                className="bg-[#2CA01C] hover:bg-[#238016] text-white" data-testid="btn-qb-connect">
                <Link2 className="h-4 w-4 mr-2" />Connect to QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">What Gets Synced</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "Customers", push: "New local customers → QB", pull: "New QB customers → local", icon: "👤" },
              { name: "Invoices",  push: "Sent invoices → QB",       pull: "QB invoice statuses → local", icon: "📄" },
              { name: "Payments",  push: "—",                         pull: "QB payments mark invoices paid", icon: "💳" },
            ].map(item => (
              <div key={item.name} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center gap-2 font-medium text-sm"><span>{item.icon}</span> {item.name}</div>
                <div className="text-xs space-y-1">
                  <div className="flex items-start gap-1.5 text-muted-foreground"><span className="text-green-600 font-bold mt-0.5">↑</span> {item.push}</div>
                  <div className="flex items-start gap-1.5 text-muted-foreground"><span className="text-blue-600 font-bold mt-0.5">↓</span> {item.pull}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {status?.connected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sync History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No sync history yet. Run your first sync above.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="qb-sync-log-table">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Entity</TableHead><TableHead>Direction</TableHead><TableHead>Records</TableHead>
                      <TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Duration</TableHead><TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any) => {
                      const duration = log.completed_at
                        ? `${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                        : "—";
                      return (
                        <TableRow key={log.id} data-testid={`qb-log-row-${log.id}`}>
                          <TableCell className="capitalize text-sm font-medium">{log.entity_type}</TableCell>
                          <TableCell className="text-sm capitalize text-muted-foreground">{log.direction}</TableCell>
                          <TableCell className="text-sm font-mono">{log.records_synced}</TableCell>
                          <TableCell>{logStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtQbDate(log.started_at)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{duration}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={log.errors ?? ""}>{log.errors ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdminSidebar({ activeTab, setActiveTab, pendingRequests, isMasterAdmin, t }: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingRequests: any[];
  isMasterAdmin: boolean;
  t: any;
}) {
  const [, navigate] = useLocation();
  const [aiExpanded, setAiExpanded] = useState(false);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const groups = [
    {
      label: "Daily Operations",
      items: [
        { value: "time-reports", label: "Time Reports", icon: ClipboardList, href: "/admin/time-reports" },
        { value: "time-admin", label: "Time Admin", icon: Clock, href: "/admin/time" },
        { value: "worksheet-review", label: "Worksheet Review", icon: ClipboardCheck, href: "/worksheet-review" },
        { value: "qbo-export", label: "QuickBooks Export", icon: Upload, href: "/admin/qbo-export" },
        { value: "archive", label: "Time Archive", icon: Archive, href: "/admin/archive" },
      ],
    },
    {
      label: "People",
      items: [
        { value: "users", label: t("nav.employees"), icon: Users },
        { value: "requests", label: "Access Requests", icon: Megaphone, badge: pendingRequests.length > 0 ? pendingRequests.length : undefined },
        { value: "agreements", label: "Agreement Templates", icon: FileSignature },
      ],
    },
    {
      label: "Company Settings",
      items: [
        { value: "setup-wizard", label: "Setup Wizard", icon: Rocket, href: "/admin/setup-wizard" },
        { value: "company", label: "Company Info & Branding", icon: Building2 },
        { value: "divisions", label: "Division Colors", icon: Layers },
        { value: "estimate-templates", label: "Estimate Templates", icon: FileText },
        { value: "terms", label: "Terms & Conditions", icon: FileSignature },
        { value: "business-rules", label: "Business Rules", icon: SlidersHorizontal, href: "/admin/business-rules" },
        { value: "regional-settings", label: "Regional & Seasonal", icon: Globe, href: "/admin/regional-settings" },
        { value: "notification-center", label: "Notification Center", icon: Bell, href: "/admin/notification-center" },
        { value: "feedback-reports", label: "Bug Reports & Feedback", icon: MessageSquareWarning, href: "/admin/feedback" },
        { value: "admin-tools", label: "Admin Tools", icon: Wrench, href: "/tools" },
      ],
    },
    {
      label: "Catalogs & Integrations",
      items: [
        { value: "work-areas", label: "Work Areas", icon: Layers, href: "/admin/work-areas" },
        { value: "service-types", label: "Service Types", icon: Tag, href: "/admin/service-types" },
        { value: "quickbooks", label: "QuickBooks Online", icon: DollarSign },
        { value: "catalog-link", label: "Item Catalog", icon: BookOpen, href: "/catalog" },
        { value: "plant-cards-link", label: "Plant Library", icon: Leaf, href: "/plant-cards" },
        { value: "cc-reconciliation", label: "CompanyCam Reconciliation Queue", icon: Camera, href: "/admin/companycam-reconciliation" },
        { value: "cc-health", label: "CompanyCam Webhook Health", icon: Activity, href: "/admin/companycam-health" },
      ],
    },
    {
      label: "Automation & Flags",
      items: [
        { value: "automation-center", label: "Automation Center", icon: Zap, href: "/admin/automation-center" },
        { value: "feature-flags", label: "Feature Flags", icon: FlagTriangleRight, href: "/admin/feature-flags" },
      ],
    },
    {
      label: "Content & SOPs",
      items: [
        { value: "sop-pipeline", label: "SOP Pipeline", icon: Zap },
        { value: "documents", label: "Document Library", icon: FileText },
        { value: "shared-links", label: "External Share Links", icon: ExternalLink },
      ],
    },
    {
      label: "AI & Automation Tools",
      items: [
        { value: "assistant-agents", label: "Assistant Agents", icon: Sparkles },
        { value: "ai-logs", label: "Usage Summary", icon: Bot },
        ...(isMasterAdmin ? [{ value: "ai-agents", label: "AI Agents", icon: Bot }] : []),
        { value: "integration-wizard", label: "Integration Wizard", icon: Puzzle },
      ],
    },
    {
      label: "System Health & Data Quality",
      items: [
        { value: "todos", label: "To-Do User Management", icon: CheckCircle },
        { value: "process-auditor", label: "Process Auditor", icon: ClipboardCheck },
        { value: "help-reports", label: "Article Reports", icon: HelpCircle },
        { value: "customer-duplicates", label: "Customer Duplicates", icon: GitMerge, href: "/admin/customer-duplicates" },
        { value: "app-testing", label: "App Testing", icon: Eye },
        { value: "system-status", label: "System Status", icon: AlertCircle },
        { value: "security-audit-log", label: "Security Audit Log", icon: AlertTriangle },
        ...(isMasterAdmin ? [{ value: "diagnostics", label: "Diagnostics", icon: Wrench }] : []),
      ],
    },
  ];

  const groupLabelColor = (label: string) => {
    switch (label) {
      case "Daily Operations": return "text-green-600 dark:text-green-400";
      case "People": return "text-blue-600 dark:text-blue-400";
      case "Company Settings": return "text-purple-600 dark:text-purple-400";
      case "Catalogs & Integrations": return "text-teal-600 dark:text-teal-400";
      case "Automation & Flags": return "text-indigo-600 dark:text-indigo-400";
      case "Content & SOPs": return "text-amber-600 dark:text-amber-400";
      case "AI & Automation Tools": return "text-fuchsia-600 dark:text-fuchsia-400";
      case "System Health & Data Quality": return "text-slate-600 dark:text-slate-400";
      default: return "text-muted-foreground/60";
    }
  };

  const navItemRow = (item: any) => {
    const Icon = item.icon;
    const isActive = item.href ? false : activeTab === item.value;
    const handleClick = () => {
      if (item.href) {
        navigate(item.href);
      } else {
        setActiveTab(item.value);
      }
    };
    return (
      <button
        key={item.value}
        onClick={handleClick}
        data-testid={`admin-nav-${item.value}`}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.badge && (
          <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1 text-xs shrink-0">
            {item.badge}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <nav className="flex flex-col gap-1 py-1" data-testid="admin-sidebar">
      {groups.map((group) => {
        const isAi = group.label === "AI & Automation Tools";
        const isHealth = group.label === "System Health & Data Quality";
        const isCollapsible = isAi || isHealth;
        const expanded = isAi ? aiExpanded : healthExpanded;
        const setExpanded = isAi ? setAiExpanded : setHealthExpanded;
        return (
          <div key={group.label} className="mb-3">
            {isCollapsible ? (
              <button
                onClick={() => setExpanded((v: boolean) => !v)}
                className="w-full flex items-center justify-between px-3 mb-1 hover:opacity-80 transition-opacity"
                data-testid={`admin-nav-${isAi ? "ai" : "health"}-toggle`}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-widest select-none ${groupLabelColor(group.label)}`}>
                  {group.label}
                </span>
                {expanded
                  ? <ChevronUp className="h-3 w-3 text-muted-foreground/60" />
                  : <ChevronDown className="h-3 w-3 text-muted-foreground/60" />}
              </button>
            ) : (
              <p className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest select-none ${groupLabelColor(group.label)}`}>
                {group.label}
              </p>
            )}
            {(!isCollapsible || expanded) && group.items.map(navItemRow)}
          </div>
        );
      })}
    </nav>
  );
}

type SafeUser = Omit<User, "password">;
type TodoActiveUser = { id: string; userId: string; activatedBy: string | null; activatedAt: Date | null };

function TodoActiveUsersManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: activeUsers = [] } = useQuery<TodoActiveUser[]>({
    queryKey: ["/api/todo-active-users"],
  });

  const activateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/todo-active-users/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to activate user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todo-active-users"] });
      toast({ title: "User activated for To-Do system" });
    },
    onError: (error) => showErrorToast(error, "Failed to activate user"),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/todo-active-users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to deactivate user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todo-active-users"] });
      toast({ title: "User deactivated from To-Do system" });
    },
    onError: (error) => showErrorToast(error, "Failed to deactivate user"),
  });

  const isUserActive = (userId: string) => activeUsers.some(a => a.userId === userId);
  const internalUsers = users.filter(u => u.role !== "Customer");

  return (
    <Card>
      <CardHeader>
        <CardTitle>To-Do User Management</CardTitle>
        <CardDescription>
          Control which users can see and interact with the To-Do list system. 
          Active users will see a notification icon when they have unread tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {internalUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No internal users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">To-Do Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internalUsers.map((u) => {
                  const active = isUserActive(u.id);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={active}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              activateMutation.mutate(u.id);
                            } else {
                              deactivateMutation.mutate(u.id);
                            }
                          }}
                          disabled={activateMutation.isPending || deactivateMutation.isPending}
                          data-testid={`switch-todo-access-${u.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("home");
  const [homeAiExpanded, setHomeAiExpanded] = useState(false);
  const [homeHealthExpanded, setHomeHealthExpanded] = useState(false);

  // On mount: honour ?tab= param so OAuth callbacks (e.g. QuickBooks) land on
  // the correct section rather than defaulting to "users".
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab) setActiveTab(tab);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) setActiveTab(detail.tab);
    };
    window.addEventListener("admin-set-tab", handler);
    return () => window.removeEventListener("admin-set-tab", handler);
  }, []);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<SafeUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmRealAccountReset, setConfirmRealAccountReset] = useState(false);
  const isMasterAdmin = user?.isMasterAdmin === true;

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "Admin",
  });

  const { data: accessRequests = [], isLoading: requestsLoading } = useQuery<AccessRequest[]>({
    queryKey: ["/api/access-requests"],
    enabled: user?.role === "Admin",
  });

  const pendingRequests = accessRequests.filter(r => r.status === "pending");

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
    enabled: user?.role === "Admin",
  });

  const { data: wizardProgress } = useQuery<Record<string, string>>({
    queryKey: ["/api/setup-wizard/progress"],
    enabled: user?.role === "Admin" || !!(user as any)?.isMasterAdmin,
  });

  const wizardStepIds = ["business_info","branding","regional","employees","catalog","integrations","routes","permissions","notifications"];
  const wizardComplete = wizardProgress
    ? wizardStepIds.filter((id) => wizardProgress[id] === "complete").length
    : 0;
  const wizardPct = Math.round((wizardComplete / wizardStepIds.length) * 100);
  const wizardAllDone = wizardProgress ? wizardStepIds.every((id) => wizardProgress[id] === "complete" || wizardProgress[id] === "skipped") : false;
  const wizardDismissed = !!(wizardProgress?.dismissed_at);
  const showWizardBanner = !!(wizardProgress) && !wizardAllDone && !wizardDismissed;

  const dismissWizardBannerMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/setup-wizard/progress", { dismissed_at: new Date().toISOString() }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/setup-wizard/progress"] }); },
  });

  type DailyPulseSection = { count: number; items: any[] };
  type DailyPulse = {
    date: string;
    missingWorksheets: DailyPulseSection;
    readyForInvoice: DailyPulseSection;
    overdueJobs: DailyPulseSection;
    scheduleConflicts: DailyPulseSection;
    openWorkRequests: DailyPulseSection;
    behindScheduleJobs: DailyPulseSection;
    overdueFollowUps: DailyPulseSection;
  };
  const { data: dailyPulse, isLoading: dailyPulseLoading } = useQuery<DailyPulse>({
    queryKey: ["/api/admin/daily-pulse"],
    enabled: user?.role === "Admin",
    refetchInterval: 5 * 60 * 1000,
  });

  const [logoUrl, setLogoUrl] = useState("");
  const [logoShape, setLogoShape] = useState<string>("square");
  const [logoCornerRadius, setLogoCornerRadius] = useState(0);
  const [companyName, setCompanyName] = useState("Company HQ");
  const [isUploading, setIsUploading] = useState(false);
  const [companySignature, setCompanySignature] = useState("");
  const [editingSignature, setEditingSignature] = useState(false);
  const [drawingSignature, setDrawingSignature] = useState("");

  // All sidebar items that can be reordered
  const allSidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "hq", label: "Company HQ", icon: Building2 },
    { id: "my_hours", label: "My Hours", icon: ClipboardList },
    { id: "my_day", label: "My Day", icon: Sun },
    { id: "daily_worksheet", label: "Daily Worksheet", icon: ClipboardList },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "customers", label: "Customers", icon: Users },
    { id: "consultations", label: "Consultations", icon: CalendarClock },
    { id: "estimates", label: "Estimates", icon: Calculator },
    { id: "jobs", label: "Jobs", icon: LayoutDashboard },
    { id: "todos", label: "Tasks", icon: CheckSquare },
    { id: "scheduling", label: "Scheduling", icon: CalendarCheck },
    { id: "time_tracking", label: "Team Time Tracking", icon: Timer },
    { id: "equipment", label: "Equipment", icon: Truck },
    { id: "forms", label: "Forms", icon: FileText },
    { id: "sops", label: "SOP Library", icon: BookOpen },
    { id: "education", label: "Customer Hub", icon: GraduationCap },
    { id: "catalog", label: "Materials Catalog", icon: Hammer },
    { id: "hiring", label: "Hiring", icon: Users },
    { id: "employees", label: "Employees", icon: UserIcon },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "reports", label: "Reports", icon: BarChart2 },
    { id: "marketing", label: "Marketing", icon: Megaphone },
    { id: "help", label: "Help", icon: HelpCircle },
    { id: "integrations", label: "Integrations", icon: Settings },
    { id: "admin", label: "Admin Panel", icon: Shield },
  ];

  const defaultOrder = allSidebarItems.map(item => item.id);
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(defaultOrder);

  React.useEffect(() => {
    if (companySettings) {
      setLogoUrl(companySettings.logoUrl || "");
      setLogoShape(companySettings.logoShape || "square");
      setLogoCornerRadius(companySettings.logoCornerRadius || 0);
      setCompanyName(companySettings.companyName || "Company HQ");
      setCompanySignature(companySettings.companySignature || "");
      if (companySettings.sidebarOrder && Array.isArray(companySettings.sidebarOrder)) {
        setSidebarOrder(companySettings.sidebarOrder as string[]);
      }
    }
  }, [companySettings]);

  const updateCompanySettingsMutation = useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      const res = await apiRequest("PATCH", "/api/company-settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      toast({ title: "Company settings updated" });
    },
    onError: (error) => {
      showErrorToast(error, "Failed to update settings");
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Step 1: Request a presigned upload URL
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: Upload file directly to presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // Use the object path as the logo URL
      setLogoUrl(objectPath);
      await updateCompanySettingsMutation.mutateAsync({ logoUrl: objectPath });
    } catch (err) {
      showErrorToast(err, "Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  };

  const saveLogoSettings = () => {
    updateCompanySettingsMutation.mutate({
      logoUrl,
      logoShape,
      logoCornerRadius,
      companyName,
    });
  };

  const handleSidebarDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(sidebarOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSidebarOrder(items);
  };

  const saveSidebarOrder = () => {
    updateCompanySettingsMutation.mutate({ sidebarOrder });
  };

  const resetSidebarOrder = () => {
    setSidebarOrder(defaultOrder);
  };

  const orderedSidebarItems = sidebarOrder
    .map(id => allSidebarItems.find(item => item.id === id))
    .filter(Boolean) as typeof allSidebarItems;

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (error: any) => {
      showErrorToast(error, "Failed to update user");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/access-requests"] });
      toast({ title: "User deleted" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password, confirmRealAccountPasswordReset }: { id: string; password: string; confirmRealAccountPasswordReset?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, { password, confirmRealAccountPasswordReset });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Password reset", description: "The user's password has been updated" });
      setResetPasswordUser(null);
      setNewPassword("");
      setConfirmRealAccountReset(false);
    },
    onError: (error) => {
      showErrorToast(error, "Failed to reset password");
    },
  });

  const toggleTestAccountMutation = useMutation({
    mutationFn: async ({ id, isTestAccount }: { id: string; isTestAccount: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, { isTestAccount });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: variables.isTestAccount ? "Marked as test account" : "Unmarked as test account",
        description: variables.isTestAccount
          ? "Password resets on this account will no longer require confirmation or send an email."
          : "This account is now treated as a real user — password resets require confirmation.",
      });
    },
    onError: (error) => {
      showErrorToast(error, "Failed to update test account status");
    },
  });

  const crewInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/employees/${userId}/portal-invite`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to generate invite link");
      }
      return res.json() as Promise<{ url: string; expires_at: string }>;
    },
    onSuccess: async (data) => {
      try {
        await navigator.clipboard.writeText(data?.url ?? "");
        toast({ title: "Crew portal invite copied to clipboard expires in 24h" });
      } catch {
        toast({ title: `Crew invite link: ${data?.url}`, description: "Copy it manually." });
      }
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleAccessRequest = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/access-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Access request processed" });
    },
    onError: (error: any) => {
      showErrorToast(error, "Failed to process request");
    },
  });

  const canModifyUser = (targetUser: SafeUser) => {
    if (targetUser.isMasterAdmin) return false;
    return true;
  };

  const canAssignRole = (role: string) => {
    if (role === "Admin" && !isMasterAdmin) return false;
    return true;
  };

  if (user?.role !== "Admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md text-center p-8">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need Admin privileges to view this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Gradient page header */}
      <div className="rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-5 text-white flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-3">
            <Shield className="w-7 h-7" /> {t("nav.adminPanel")}
            {isMasterAdmin && (
              <Badge className="bg-white/20 text-white border-white/30 text-xs">
                <Crown className="w-3 h-3 mr-1" /> Master
              </Badge>
            )}
          </h1>
          <p className="text-green-100 text-sm mt-0.5">{t("settings.adminSettingsDesc")}</p>
        </div>
        <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} isMasterAdmin={isMasterAdmin} />
      </div>

      {/* Stat cards with colored left-border accents */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{users.length}</div>
            <p className="text-sm text-muted-foreground">{t("common.total")} {t("nav.employees")}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">
              {users.filter(u => u.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">{t("status.active")}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-600">
              {pendingRequests.length}
            </div>
            <p className="text-sm text-muted-foreground">{t("status.pending")} {t("hiring.communications")}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600">
              {users.filter(u => u.role === "Admin").length}
            </div>
            <p className="text-sm text-muted-foreground">{t("common.roles.admin")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile section picker — visible only on small screens */}
      <div className="block md:hidden">
        <Select value={activeTab} onValueChange={(v) => {
          if (v === "time-reports") { navigate("/admin/time-reports"); return; }
          if (v === "time-admin") { navigate("/admin/time"); return; }
          if (v === "worksheet-review") { navigate("/worksheet-review"); return; }
          if (v === "qbo-export") { navigate("/admin/qbo-export"); return; }
          if (v === "archive") { navigate("/admin/archive"); return; }
          if (v === "work-areas") { navigate("/admin/work-areas"); return; }
          if (v === "service-types") { navigate("/admin/service-types"); return; }
          if (v === "catalog-link") { navigate("/catalog"); return; }
          if (v === "plant-cards-link") { navigate("/plant-cards"); return; }
          if (v === "admin-tools") { navigate("/tools"); return; }
          if (v === "business-rules") { navigate("/admin/business-rules"); return; }
          if (v === "regional-settings") { navigate("/admin/regional-settings"); return; }
          if (v === "notification-center") { navigate("/admin/notification-center"); return; }
          if (v === "automation-center") { navigate("/admin/automation-center"); return; }
          if (v === "feature-flags") { navigate("/admin/feature-flags"); return; }
          setActiveTab(v);
        }}>
          <SelectTrigger className="w-full" data-testid="admin-mobile-nav">
            <SelectValue placeholder="Select section…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">⬅ Overview</SelectItem>
            <SelectGroup>
              <SelectLabel>Daily Operations</SelectLabel>
              <SelectItem value="time-reports">Time Reports</SelectItem>
              <SelectItem value="time-admin">Time Admin</SelectItem>
              <SelectItem value="worksheet-review">Worksheet Review</SelectItem>
              <SelectItem value="qbo-export">QuickBooks Export</SelectItem>
              <SelectItem value="archive">Time Archive</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>People</SelectLabel>
              <SelectItem value="users">{t("nav.employees")}</SelectItem>
              <SelectItem value="requests">Access Requests</SelectItem>
              <SelectItem value="agreements">Agreement Templates</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Settings</SelectLabel>
              <SelectItem value="company">Company Info &amp; Branding</SelectItem>
              <SelectItem value="divisions">Division Colors</SelectItem>
              <SelectItem value="work-areas">Work Areas</SelectItem>
              <SelectItem value="service-types">Service Types</SelectItem>
              <SelectItem value="estimate-templates">Estimate Templates</SelectItem>
              <SelectItem value="terms">Terms &amp; Conditions</SelectItem>
              <SelectItem value="quickbooks">QuickBooks Online</SelectItem>
              <SelectItem value="catalog-link">Item Catalog</SelectItem>
              <SelectItem value="plant-cards-link">Plant Library</SelectItem>
              <SelectItem value="business-rules">Business Rules</SelectItem>
              <SelectItem value="regional-settings">Regional &amp; Seasonal</SelectItem>
              <SelectItem value="notification-center">Notification Center</SelectItem>
              <SelectItem value="feedback-reports">Bug Reports & Feedback</SelectItem>
              <SelectItem value="admin-tools">Admin Tools</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Automation &amp; Flags</SelectLabel>
              <SelectItem value="automation-center">Automation Center</SelectItem>
              <SelectItem value="feature-flags">Feature Flags</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Content &amp; SOPs</SelectLabel>
              <SelectItem value="sop-pipeline">SOP Pipeline</SelectItem>
              <SelectItem value="documents">Document Library</SelectItem>
              <SelectItem value="shared-links">External Share Links</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>AI &amp; Automation Tools</SelectLabel>
              <SelectItem value="assistant-agents">Assistant Agents</SelectItem>
              <SelectItem value="ai-logs">Usage Summary</SelectItem>
              {isMasterAdmin && <SelectItem value="ai-agents">AI Agents</SelectItem>}
              <SelectItem value="integration-wizard">Integration Wizard</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>System Health &amp; Data Quality</SelectLabel>
              <SelectItem value="todos">To-Do User Management</SelectItem>
              <SelectItem value="process-auditor">Process Auditor</SelectItem>
              <SelectItem value="help-reports">Article Reports</SelectItem>
              <SelectItem value="app-testing">App Testing</SelectItem>
              <SelectItem value="system-status">System Status</SelectItem>
              {isMasterAdmin && <SelectItem value="diagnostics">Diagnostics</SelectItem>}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-6 items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* ── Home overview card grid ── */}
        <TabsContent value="home" className="mt-0">
          <div className="space-y-4">

            {/* ── Setup Wizard first-run banner ───────────────────────────── */}
            {showWizardBanner && (
              <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="rounded-md bg-primary/10 p-2 shrink-0 mt-0.5">
                    <Rocket className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">Complete your company setup</span>
                      <span className="text-xs text-muted-foreground">
                        {wizardComplete} of {wizardStepIds.length} steps done ({wizardPct}%)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Finish setting up Company HQ — add your branding, employees, catalog, and integrations.
                    </p>
                    <div className="w-full bg-primary/10 rounded-full h-1.5 mt-2 mb-3">
                      <div
                        className="bg-primary rounded-full h-1.5 transition-all"
                        style={{ width: `${wizardPct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate("/admin/setup-wizard")}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                        data-testid="setup-wizard-banner-go"
                      >
                        Open Setup Wizard
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      <span className="text-muted-foreground/40">·</span>
                      <button
                        onClick={() => dismissWizardBannerMutation.mutate()}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        data-testid="setup-wizard-banner-dismiss"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Pulse — read-only pane of glass */}
            <div className="rounded-xl border border-red-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b bg-red-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground">Daily Pulse</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Things that need attention today, at a glance</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-px bg-border/30" data-testid="daily-pulse-cards">
                {([
                  {
                    key: "missingWorksheets",
                    label: "Missing Worksheets",
                    desc: "Crew who haven't submitted today",
                    icon: ClipboardCheck,
                    href: "/worksheet-review",
                  },
                  {
                    key: "readyForInvoice",
                    label: "Ready to Invoice",
                    desc: "Completed, not yet invoiced",
                    icon: FileSignature,
                    href: "/jobs?status=completed",
                  },
                  {
                    key: "overdueJobs",
                    label: "Overdue Jobs",
                    desc: "Behind schedule",
                    icon: Clock,
                    href: "/overdue",
                  },
                  {
                    key: "scheduleConflicts",
                    label: "Schedule Conflicts",
                    desc: "Crew/equipment double-booked today",
                    icon: AlertTriangle,
                    href: `/daily-plan?date=${new Date().toISOString().slice(0, 10)}`,
                  },
                  {
                    key: "openWorkRequests",
                    label: "Open Work Requests",
                    desc: "Awaiting review",
                    icon: MessageSquare,
                    href: "/admin/inbox",
                  },
                  {
                    key: "behindScheduleJobs",
                    label: "Behind Schedule",
                    desc: "In-progress past end · scheduled past start",
                    icon: Timer,
                    href: "/jobs?behind_schedule=true",
                  },
                  {
                    key: "overdueFollowUps",
                    label: "Overdue Follow-ups",
                    desc: "Customers & leads past follow-up date",
                    icon: CalendarClock,
                    href: "/overdue",
                  },
                ] as { key: keyof DailyPulse; label: string; desc: string; icon: any; href: string }[]).map((item) => {
                  const count = dailyPulse?.[item.key]?.count ?? 0;
                  return (
                    <button
                      key={item.key}
                      onClick={() => navigate(item.href)}
                      data-testid={`daily-pulse-card-${item.key}`}
                      className="flex flex-col gap-1.5 px-4 py-3 text-left transition-colors bg-card hover:bg-red-500/5"
                    >
                      <div className="flex items-center justify-between">
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {dailyPulseLoading ? (
                          <span className="text-lg font-bold text-muted-foreground">…</span>
                        ) : (
                          <span
                            className={`text-2xl font-bold ${count > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                            data-testid={`daily-pulse-count-${item.key}`}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Operations */}
            <div className="rounded-xl border border-green-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b bg-green-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">Daily Operations</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">⭐ Quick access</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Payroll, hours &amp; billing — used every day</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30">
                {([
                  { label: "Time Reports", desc: "View & adjust all employee hours", icon: ClipboardList, href: "/admin/time-reports", daily: true },
                  { label: "Time Admin", desc: "Manage clock-in/out records", icon: Clock, href: "/admin/time", daily: false },
                  { label: "Worksheet Review", desc: "Review daily crew worksheets", icon: ClipboardCheck, href: "/worksheet-review", daily: true },
                  { label: "QuickBooks Export", desc: "Export time to QuickBooks payroll", icon: Upload, href: "/admin/qbo-export", daily: true },
                  { label: "Time Archive", desc: "Archive old completed entries", icon: Archive, href: "/admin/archive", daily: false },
                ] as { label: string; desc: string; icon: any; href: string; daily: boolean }[]).map((item) => (
                  <button key={item.label} onClick={() => navigate(item.href)} data-testid={`admin-home-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 ${item.daily ? "border-l-green-500 hover:bg-green-500/10" : "border-l-transparent hover:bg-muted/50"}`}>
                    <item.icon className={`h-4 w-4 shrink-0 ${item.daily ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                    <div>
                      <div className={`text-xs font-medium flex items-center gap-1.5 flex-wrap ${item.daily ? "text-green-700 dark:text-green-300" : "text-foreground"}`}>
                        {item.label}
                        {item.daily && <span className="text-[9px] font-bold bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-px rounded">DAILY USE</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* People */}
            <div className="rounded-xl border border-blue-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b bg-blue-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">People</span>
                    {pendingRequests.length > 0 && (
                      <Badge variant="destructive" className="h-5 px-2 text-xs">{pendingRequests.length} pending</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Staff, hiring &amp; HR communications</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border/30">
                {([
                  { label: "User Management", desc: "Roles, access & permissions", icon: Users, tab: "users" },
                  { label: "Access Requests", desc: "Messages & requests", icon: Megaphone, tab: "requests" },
                  { label: "Agreement Templates", desc: "Position-based agreements", icon: FileSignature, tab: "agreements" },
                ] as { label: string; desc: string; icon: any; tab: string }[]).map((item) => (
                  <button key={item.label} onClick={() => setActiveTab(item.tab)} data-testid={`admin-home-${item.tab}`}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 border-l-transparent hover:bg-muted/50">
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Company Settings */}
            <div className="rounded-xl border border-purple-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b bg-purple-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground">Company Settings</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Company profile, business rules &amp; core config</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30">
                {([
                  { label: "Company Info & Branding", desc: "Name, logo, colors", icon: Building2, tab: "company" },
                  { label: "Division Colors", desc: "Business divisions", icon: Layers, tab: "divisions" },
                  { label: "Estimate Templates", desc: "Default estimate types", icon: FileText, tab: "estimate-templates" },
                  { label: "Terms & Conditions", desc: "Legal terms", icon: FileSignature, tab: "terms" },
                  { label: "Business Rules", desc: "Financial, scheduling & workflow settings", icon: SlidersHorizontal, href: "/admin/business-rules" },
                  { label: "Bug Reports & Feedback", desc: "Review bugs & suggestions submitted by staff", icon: MessageSquareWarning, href: "/admin/feedback" },
                  { label: "Admin Tools", desc: "Form builder & admin utilities", icon: Wrench, href: "/tools" },
                ] as { label: string; desc: string; icon: any; tab?: string; href?: string }[]).map((item) => (
                  <button key={item.label} onClick={() => item.href ? navigate(item.href) : setActiveTab(item.tab!)} data-testid={`admin-home-${item.tab ?? item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 border-l-transparent hover:bg-muted/50">
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Catalogs & Integrations */}
            <div className="rounded-xl border border-teal-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b bg-teal-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground">Catalogs &amp; Integrations</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Reference data, catalogs &amp; third-party connections</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30">
                {([
                  { label: "Work Areas", desc: "Service zones", icon: Layers, href: "/admin/work-areas" },
                  { label: "Service Types", desc: "Job service categories", icon: Tag, href: "/admin/service-types" },
                  { label: "QuickBooks Online", desc: "QB connection settings", icon: DollarSign, tab: "quickbooks" },
                  { label: "Item Catalog", desc: "Materials & labor catalog", icon: BookOpen, href: "/catalog" },
                  { label: "Plant Library", desc: "Plant card database", icon: Leaf, href: "/plant-cards" },
                  { label: "CompanyCam Reconciliation Queue", desc: "CompanyCam sync", icon: Camera, href: "/admin/companycam-reconciliation" },
                  { label: "CompanyCam Webhook Health", desc: "Webhook status", icon: Activity, href: "/admin/companycam-health" },
                ] as { label: string; desc: string; icon: any; tab?: string; href?: string }[]).map((item) => (
                  <button key={item.label} onClick={() => item.href ? navigate(item.href) : setActiveTab(item.tab!)} data-testid={`admin-home-${item.tab ?? item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 border-l-transparent hover:bg-muted/50">
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Automation & Flags */}
            <div className="rounded-xl border border-indigo-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b bg-indigo-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground">Automation &amp; Flags</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Automation rules &amp; feature flags</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30">
                {([
                  { label: "Automation Center", desc: "Turn on job, invoice & recurring job automations", icon: Zap, href: "/admin/automation-center" },
                  { label: "Feature Flags", desc: "Hide unfinished modules from regular users during alpha", icon: FlagTriangleRight, href: "/admin/feature-flags" },
                ] as { label: string; desc: string; icon: any; tab?: string; href?: string }[]).map((item) => (
                  <button key={item.label} onClick={() => item.href ? navigate(item.href) : setActiveTab(item.tab!)} data-testid={`admin-home-${item.tab ?? item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 border-l-transparent hover:bg-muted/50">
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Content & SOPs */}
            <div className="rounded-xl border border-amber-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b bg-amber-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground">Content &amp; SOPs</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Training, documents &amp; shared resources</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30">
                {([
                  { label: "SOP Pipeline", desc: "Create & schedule SOPs", icon: Zap, tab: "sop-pipeline" },
                  { label: "Document Library", desc: "Shared file library", icon: FileText, tab: "documents" },
                  { label: "External Share Links", desc: "External resource links", icon: ExternalLink, tab: "shared-links" },
                ] as { label: string; desc: string; icon: any; tab: string }[]).map((item) => (
                  <button key={item.label} onClick={() => setActiveTab(item.tab)} data-testid={`admin-home-${item.tab}`}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 border-l-transparent hover:bg-muted/50">
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI & Automation Tools — collapsible */}
            <div className="rounded-xl border border-fuchsia-500/20 bg-card overflow-hidden opacity-80">
              <button
                onClick={() => setHomeAiExpanded(v => !v)}
                className="w-full flex items-center gap-3 px-5 py-3 border-b bg-fuchsia-500/5 hover:bg-fuchsia-500/10 transition-colors"
                data-testid="admin-home-ai-toggle"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shrink-0" />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">AI &amp; Automation Tools</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-500 dark:text-fuchsia-400 border border-fuchsia-500/20">🔒 Advanced</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">AI features & automation tooling — rarely needed</p>
                </div>
                {homeAiExpanded
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  : <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">▼ expand</span>}
              </button>
              {homeAiExpanded && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30">
                  {([
                    { label: "Assistant Agents", desc: "AI assistant configuration", icon: Sparkles, tab: "assistant-agents" },
                    { label: "Usage Summary", desc: "AI usage history", icon: Bot, tab: "ai-logs" },
                    ...(isMasterAdmin ? [{ label: "AI Agents", desc: "Manage AI agent definitions", icon: Bot, tab: "ai-agents" }] : []),
                    { label: "Integration Wizard", desc: "Connect services", icon: Puzzle, tab: "integration-wizard" },
                  ] as { label: string; desc: string; icon: any; tab?: string; href?: string }[]).map((item) => (
                    <button key={item.label} onClick={() => item.href ? navigate(item.href) : setActiveTab(item.tab!)} data-testid={`admin-home-ai-${item.tab ?? item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className="flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 border-l-transparent hover:bg-muted/50">
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <div className="text-xs font-medium text-foreground">{item.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* System Health & Data Quality — collapsible */}
            <div className="rounded-xl border border-slate-500/20 bg-card overflow-hidden opacity-80">
              <button
                onClick={() => setHomeHealthExpanded(v => !v)}
                className="w-full flex items-center gap-3 px-5 py-3 border-b bg-slate-500/5 hover:bg-slate-500/10 transition-colors"
                data-testid="admin-home-health-toggle"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">System Health &amp; Data Quality</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">🔒 Advanced</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Diagnostics, logs & data integrity — rarely needed</p>
                </div>
                {homeHealthExpanded
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  : <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">▼ expand</span>}
              </button>
              {homeHealthExpanded && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30">
                  {([
                    { label: "To-Do User Management", desc: "Who can see tasks", icon: CheckCircle, tab: "todos" },
                    { label: "Process Auditor", desc: "Run process audits", icon: ClipboardCheck, tab: "process-auditor" },
                    { label: "Article Reports", desc: "Reported help articles", icon: HelpCircle, tab: "help-reports" },
                    { label: "Customer Duplicates", desc: "Find duplicate records", icon: GitMerge, href: "/admin/customer-duplicates" },
                    { label: "App Testing", desc: "Internal testing tools", icon: Eye, tab: "app-testing" },
                    { label: "System Status", desc: "System diagnostics", icon: AlertCircle, tab: "system-status" },
                    { label: "Security Audit Log", desc: "Security event history", icon: AlertTriangle, tab: "security-audit-log" },
                    ...(isMasterAdmin ? [{ label: "Diagnostics", desc: "Deep diagnostics", icon: Wrench, tab: "diagnostics" }] : []),
                  ] as { label: string; desc: string; icon: any; tab?: string; href?: string }[]).map((item) => (
                    <button key={item.label} onClick={() => item.href ? navigate(item.href) : setActiveTab(item.tab!)} data-testid={`admin-home-health-${item.tab ?? item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className="flex items-center gap-3 px-4 py-3 text-left transition-colors bg-card border-l-2 border-l-transparent hover:bg-muted/50">
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <div className="text-xs font-medium text-foreground">{item.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all users in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {u.name}
                                {u.isMasterAdmin && <Crown className="w-4 h-4 text-amber-500" />}
                              </div>
                              <div className="text-xs text-muted-foreground">{u.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          {u.isMasterAdmin ? (
                            <Badge className="bg-amber-100 text-amber-800">Master Admin</Badge>
                          ) : (
                            <Select
                              defaultValue={u.role}
                              onValueChange={(value) => {
                                if (!canAssignRole(value)) {
                                  toast({ title: "Permission denied", description: "Only the Master Admin can assign Admin role", variant: "destructive" });
                                  return;
                                }
                                updateUserMutation.mutate({ id: u.id, updates: { role: value } });
                              }}
                              disabled={!canModifyUser(u)}
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {isMasterAdmin && <SelectItem value="Admin">Admin</SelectItem>}
                                <SelectItem value="Manager">Manager</SelectItem>
                                <SelectItem value="Crew">Crew</SelectItem>
                                <SelectItem value="Customer">Customer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {u.isActive ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                            ) : (
                              <Badge variant="destructive">Deactivated</Badge>
                            )}
                            {u.isTestAccount && (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50" data-testid={`badge-test-account-${u.id}`}>
                                Test
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canModifyUser(u) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => updateUserMutation.mutate({ 
                                    id: u.id, 
                                    updates: { isActive: !u.isActive } 
                                  })}
                                >
                                  {u.isActive ? (
                                    <>
                                      <UserX className="w-4 h-4 mr-2" /> Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-4 h-4 mr-2" /> Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                {/* Reset Password - for staff users (admin can reset) */}
                                {u.role !== "Customer" && (
                                  <DropdownMenuItem onClick={() => setResetPasswordUser(u)}>
                                    <Key className="w-4 h-4 mr-2" /> Reset Password
                                  </DropdownMenuItem>
                                )}
                                {/* For customers - show message about password recovery */}
                                {u.role === "Customer" && (
                                  <DropdownMenuItem disabled className="text-muted-foreground">
                                    <Key className="w-4 h-4 mr-2" /> Customer uses recovery
                                  </DropdownMenuItem>
                                )}
                                {!u.isMasterAdmin && (
                                  <DropdownMenuItem
                                    data-testid={`button-toggle-test-account-${u.id}`}
                                    onClick={() => toggleTestAccountMutation.mutate({ id: u.id, isTestAccount: !u.isTestAccount })}
                                  >
                                    <FlaskConical className="w-4 h-4 mr-2" />
                                    {u.isTestAccount ? "Unmark as test account" : "Mark as test account"}
                                  </DropdownMenuItem>
                                )}
                                {/* Send Crew Portal Invite — staff (non-Customer, non-MasterAdmin) */}
                                {u.role !== "Customer" && !u.isMasterAdmin && (
                                  <DropdownMenuItem
                                    data-testid={`button-crew-portal-invite-${u.id}`}
                                    onClick={() => crewInviteMutation.mutate(u.id)}
                                    disabled={crewInviteMutation.isPending}
                                  >
                                    <Link2 className="w-4 h-4 mr-2" /> Send Crew Portal Invite
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this user?")) {
                                      deleteUserMutation.mutate(u.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Protected</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Requests</CardTitle>
              <CardDescription>Review and approve role upgrade requests from users</CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : accessRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No access requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accessRequests.map((req) => {
                    const requestUser = users.find(u => u.id === req.userId);
                    return (
                      <div key={req.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{requestUser?.name || "Unknown User"}</h4>
                            <p className="text-sm text-muted-foreground">
                              {requestUser?.username && <span className="mr-2">{requestUser.username}</span>}
                              Requesting: <Badge variant="outline">{req.requestedRole}</Badge>
                            </p>
                            {req.reason && <p className="text-sm mt-2">{req.reason}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {req.status === "pending" ? (
                              <>
                                {(req.requestedRole !== "Admin" || isMasterAdmin) && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAccessRequest.mutate({ id: req.id, status: "approved" })}
                                    disabled={handleAccessRequest.isPending}
                                    className="gap-1"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Approve
                                  </Button>
                                )}
                                {req.requestedRole === "Admin" && !isMasterAdmin && (
                                  <Badge variant="outline">Only Master Admin can approve</Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAccessRequest.mutate({ id: req.id, status: "denied" })}
                                  disabled={handleAccessRequest.isPending}
                                  className="gap-1"
                                >
                                  <XCircle className="w-4 h-4" /> Deny
                                </Button>
                              </>
                            ) : (
                              <Badge className={req.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {req.status === "approved" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                                {req.status}
                              </Badge>
                            )}
                            {requestUser && !requestUser.isMasterAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid={`button-delete-user-${req.id}`}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete the user "${requestUser.name}"? This cannot be undone.`)) {
                                    deleteUserMutation.mutate(requestUser.id);
                                  }
                                }}
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="todos" className="mt-6">
          <TodoActiveUsersManager />
        </TabsContent>

        <TabsContent value="help-reports" className="mt-6">
          <ArticleReportsCenter />
        </TabsContent>

        <TabsContent value="company" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>Upload your logo and customize how it appears in the sidebar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company HQ"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      {logoUrl ? (
                        <div className="space-y-3">
                          <img 
                            src={logoUrl} 
                            alt="Company Logo" 
                            className="max-h-24 mx-auto object-contain"
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setLogoUrl("")}
                          >
                            Remove Logo
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">Upload your company logo</p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploading}
                            className="max-w-xs mx-auto"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Logo Shape</Label>
                    <Select value={logoShape} onValueChange={setLogoShape}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="rectangle">Rectangle (Wide)</SelectItem>
                        <SelectItem value="circle">Circle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {logoShape !== "circle" && (
                    <div className="space-y-2">
                      <Label>Corner Rounding: {logoCornerRadius}px</Label>
                      <Slider
                        value={[logoCornerRadius]}
                        onValueChange={(v) => setLogoCornerRadius(v[0])}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        0 = Sharp corners, 20 = Very rounded
                      </p>
                    </div>
                  )}

                  <Button onClick={saveLogoSettings} disabled={updateCompanySettingsMutation.isPending} className="w-full">
                    {updateCompanySettingsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Save Changes
                  </Button>
                </div>

                <div className="space-y-4">
                  <Label>Preview</Label>
                  <div className="bg-sidebar p-6 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img 
                          src={logoUrl} 
                          alt="Logo Preview"
                          className={`object-cover shrink-0 ${
                            logoShape === "rectangle" ? "h-10 w-16" : "h-10 w-10"
                          } ${
                            logoShape === "circle" ? "rounded-full" : 
                            logoCornerRadius === 0 ? "rounded-none" :
                            logoCornerRadius <= 4 ? "rounded" :
                            logoCornerRadius <= 8 ? "rounded-md" :
                            logoCornerRadius <= 12 ? "rounded-lg" : "rounded-xl"
                          }`}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
                          <span className="font-heading font-bold text-xl text-primary-foreground">HQ</span>
                        </div>
                      )}
                      <div>
                        <h1 className="font-heading font-semibold text-lg leading-none text-sidebar-foreground">
                          {companyName || "Company HQ"}
                        </h1>
                        <p className="text-xs text-sidebar-accent-foreground/70 mt-1">Landscape Management</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This is how your logo will appear in the sidebar navigation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Company Signature</CardTitle>
              <CardDescription>Draw and save your official company signature. Use it on offer letters, contracts, and other documents with one click.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {companySignature && !editingSignature ? (
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Saved Signature</Label>
                  <div className="border rounded-lg bg-white p-4 flex items-center justify-center" style={{ minHeight: 100 }}>
                    <img src={companySignature} alt="Company Signature" className="max-h-20 object-contain" data-testid="img-company-signature" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingSignature(true); setDrawingSignature(""); }}
                      data-testid="button-edit-signature"
                    >
                      Update Signature
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        await updateCompanySettingsMutation.mutateAsync({ companySignature: "" });
                        setCompanySignature("");
                        setDrawingSignature("");
                      }}
                      data-testid="button-clear-signature"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">
                    {editingSignature ? "Draw your new signature below" : "No signature saved yet — draw one below"}
                  </Label>
                  <div className="max-w-md">
                    <SignaturePad
                      value={drawingSignature}
                      onChange={setDrawingSignature}
                      height={120}
                      testId="company-signature-pad"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!drawingSignature) return;
                        await updateCompanySettingsMutation.mutateAsync({ companySignature: drawingSignature });
                        setCompanySignature(drawingSignature);
                        setDrawingSignature("");
                        setEditingSignature(false);
                      }}
                      disabled={!drawingSignature || updateCompanySettingsMutation.isPending}
                      data-testid="button-save-signature"
                    >
                      {updateCompanySettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Signature
                    </Button>
                    {editingSignature && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingSignature(false); setDrawingSignature(""); }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Sidebar Menu Order</CardTitle>
              <CardDescription>Drag and drop to reorder the sidebar menu items for all users</CardDescription>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleSidebarDragEnd}>
                <Droppable droppableId="sidebar-items">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2"
                    >
                      {orderedSidebarItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-3 p-3 bg-card border rounded-lg ${
                                snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""
                              }`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <item.icon className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{item.label}</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveSidebarOrder} disabled={updateCompanySettingsMutation.isPending}>
                  {updateCompanySettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Order
                </Button>
                <Button variant="outline" onClick={resetSidebarOrder}>
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> AI Image Generation
              </CardTitle>
              <CardDescription>Control who can generate AI images in the SOP Builder</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable AI Image Generation</Label>
                  <p className="text-xs text-muted-foreground">Allow users to generate images with AI in the SOP Builder</p>
                </div>
                <Switch
                  checked={companySettings?.aiImagesEnabled ?? true}
                  onCheckedChange={(checked) => updateCompanySettingsMutation.mutate({ aiImagesEnabled: checked })}
                  data-testid="switch-ai-images-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>Allowed Roles</Label>
                <p className="text-xs text-muted-foreground">Which roles can use AI image generation</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["Admin", "Manager", "Crew"].map((role) => {
                    const currentRoles = (companySettings?.aiImagesAllowedRoles as string[]) || ["Admin", "Manager"];
                    const isSelected = currentRoles.includes(role);
                    return (
                      <Badge
                        key={role}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const updated = isSelected
                            ? currentRoles.filter((r: string) => r !== role)
                            : [...currentRoles, role];
                          updateCompanySettingsMutation.mutate({ aiImagesAllowedRoles: updated });
                        }}
                        data-testid={`badge-role-${role.toLowerCase()}`}
                      >
                        {role}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Limit (per user)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={companySettings?.aiImagesDailyLimit ?? 10}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) updateCompanySettingsMutation.mutate({ aiImagesDailyLimit: val });
                    }}
                    data-testid="input-daily-limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Limit (company)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    defaultValue={companySettings?.aiImagesMonthlyLimit ?? 200}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) updateCompanySettingsMutation.mutate({ aiImagesMonthlyLimit: val });
                    }}
                    data-testid="input-monthly-limit"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Watermark by Default</Label>
                  <p className="text-xs text-muted-foreground">Add "AI Generated" watermark to images</p>
                </div>
                <Switch
                  checked={companySettings?.aiImagesWatermarkDefault ?? true}
                  onCheckedChange={(checked) => updateCompanySettingsMutation.mutate({ aiImagesWatermarkDefault: checked })}
                  data-testid="switch-ai-watermark"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assistant-agents" className="mt-6">
          <AssistantAgentManager />
        </TabsContent>

        <TabsContent value="ai-logs" className="mt-6">
          <ConversationLogViewer />
        </TabsContent>

        <TabsContent value="sop-pipeline" className="mt-6">
          <SOPPipeline />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <AdminDocumentLibrary />
        </TabsContent>

        <TabsContent value="shared-links" className="mt-6">
          <SharedLinksManager />
        </TabsContent>


        <TabsContent value="app-testing" className="mt-6">
          <AppTestingPanel />
        </TabsContent>

        <TabsContent value="system-status" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">System Status Report</h3>
                  <p className="text-sm text-muted-foreground">View the current status of all platform modules, connections, and live system data.</p>
                </div>
              </div>
              <SystemStatusReport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security-audit-log" className="mt-6">
          <SecurityAuditLogPanel />
        </TabsContent>

        {user?.isMasterAdmin && (
          <TabsContent value="ai-agents" className="mt-6">
            <AiAgentsPanel />
          </TabsContent>
        )}

        {user?.isMasterAdmin && (
          <TabsContent value="diagnostics" className="mt-6">
            <DiagnosticReport />
          </TabsContent>
        )}

        <TabsContent value="process-auditor" className="mt-6">
          <ProcessAuditor />
        </TabsContent>

        <TabsContent value="integration-wizard" className="mt-6">
          <IntegrationWizard />
        </TabsContent>

        <TabsContent value="divisions" className="mt-6">
          <DivisionsSection />
        </TabsContent>

        <TabsContent value="estimate-templates" className="mt-6">
          <EstimateTemplatesSection />
        </TabsContent>

        <TabsContent value="quickbooks" className="mt-6">
          <QuickBooksSection qbParam={new URLSearchParams(window.location.search).get("qb")} />
        </TabsContent>

        <TabsContent value="terms" className="mt-6">
          <TermsSection />
        </TabsContent>

        <TabsContent value="agreements" className="mt-6">
          <AgreementTemplatesPanel />
        </TabsContent>
      </Tabs>
        </div>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {resetPasswordUser?.name || resetPasswordUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                data-testid="input-reset-password"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will immediately change the user's password. Make sure to share the new password with them securely.
            </p>
            {resetPasswordUser && !resetPasswordUser.isTestAccount && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm text-amber-900">
                  This is a <strong>real user account</strong>, not marked as a test account. Resetting this
                  password will email {resetPasswordUser.name || resetPasswordUser.username} to notify them.
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="confirm-real-reset"
                    checked={confirmRealAccountReset}
                    onCheckedChange={(checked) => setConfirmRealAccountReset(checked === true)}
                    data-testid="checkbox-confirm-real-account-reset"
                  />
                  <Label htmlFor="confirm-real-reset" className="text-sm font-normal leading-snug">
                    I confirm I intend to reset this real user's password.
                  </Label>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setResetPasswordUser(null); setConfirmRealAccountReset(false); }}>
              Cancel
            </Button>
            <Button
              onClick={() => resetPasswordUser && resetPasswordMutation.mutate({ id: resetPasswordUser.id, password: newPassword, confirmRealAccountPasswordReset: confirmRealAccountReset })}
              disabled={!newPassword || resetPasswordMutation.isPending || (!resetPasswordUser?.isTestAccount && !confirmRealAccountReset)}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// AI Agents Panel Component - Master Admin only
function AiAgentsPanel() {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Fetch AI agents
  const { data: agents = [], isLoading: agentsLoading, refetch: refetchAgents } = useQuery<any[]>({
    queryKey: ["/api/ai-agents"],
  });

  // Fetch cost summary
  const { data: costSummary } = useQuery<any>({
    queryKey: ["/api/ai-agents/costs/summary"],
  });

  // Mutation to toggle agent
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/ai-agents/${id}`, { isEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
    },
  });

  // Mutation to run agent
  const runAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/ai-agents/${agentId}/run`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents/costs/summary"] });
    },
  });

  // Mutation to delete agent
  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("DELETE", `/api/ai-agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents/costs/summary"] });
    },
  });

  // Fetch suggestions for an agent
  const fetchSuggestions = async (agentId: string) => {
    const res = await fetch(`/api/ai-agents/${agentId}/suggestions`, { credentials: "include" });
    return res.json();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(4)}`;
  };

  if (agentsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cost Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            AI Usage & Costs
          </CardTitle>
          <CardDescription>Track your AI agent usage and estimated costs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(costSummary?.totalCost || 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total Cost (This Period)</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {costSummary?.totalRuns || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total Runs</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(costSummary?.projectedMonthly || 0)}
              </div>
              <p className="text-sm text-muted-foreground">Projected Monthly</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {costSummary?.nextBillingDate ? new Date(costSummary.nextBillingDate).toLocaleDateString() : "N/A"}
              </div>
              <p className="text-sm text-muted-foreground">Next Billing Date</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Agents List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Agents
            </CardTitle>
            <CardDescription>
              Control your autonomous AI agents. They analyze your data and suggest improvements.
            </CardDescription>
          </div>
          <CreateAgentDialog onCreated={() => refetchAgents()} />
        </CardHeader>
        <CardContent className="space-y-4">
          {agents.map((agent: any) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isExpanded={expandedAgent === agent.id}
              onToggleExpand={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
              onToggleEnabled={(enabled) => toggleAgentMutation.mutate({ id: agent.id, isEnabled: enabled })}
              onRun={() => runAgentMutation.mutate(agent.id)}
              onDelete={() => deleteAgentMutation.mutate(agent.id)}
              isRunning={runAgentMutation.isPending && runAgentMutation.variables === agent.id}
              costData={costSummary?.agentCosts?.find((c: any) => c.agentId === agent.id)}
              fetchSuggestions={fetchSuggestions}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Individual Agent Card
function AgentCard({
  agent,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  onRun,
  onDelete,
  isRunning,
  costData,
  fetchSuggestions,
}: {
  agent: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onRun: () => void;
  onDelete: () => void;
  isRunning: boolean;
  costData?: any;
  fetchSuggestions: (agentId: string) => Promise<any[]>;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const data = await fetchSuggestions(agent.id);
      setSuggestions(data);
    } catch (e) {
      console.error("Failed to load suggestions:", e);
    }
    setLoadingSuggestions(false);
  };

  React.useEffect(() => {
    if (isExpanded) {
      loadSuggestions();
    }
  }, [isExpanded]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "forms":
      case "forms_builder":
        return <FileText className="h-5 w-5" />;
      case "sops":
      case "sop_builder":
        return <BookOpen className="h-5 w-5" />;
      case "communications":
        return <Inbox className="h-5 w-5" />;
      case "hiring":
        return <Users className="h-5 w-5" />;
      case "content_creator":
        return <GraduationCap className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case "daily":
        return "Runs Daily";
      case "weekly":
        return "Runs Weekly";
      case "monthly":
        return "Runs Monthly";
      default:
        return "Manual Only";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Agent Header */}
      <div
        className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-full ${agent.isEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
            {getCategoryIcon(agent.category)}
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              {agent.name}
              {agent.isEnabled ? (
                <Badge variant="default" className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="text-muted-foreground">{getFrequencyLabel(agent.runFrequency)}</div>
            <div className="text-xs">Last: {agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleDateString() : 'Never'}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={agent.isEnabled ? "outline" : "default"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled(!agent.isEnabled);
              }}
              className="gap-1"
            >
              <Power className="h-4 w-4" />
              {agent.isEnabled ? "Turn Off" : "Turn On"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              disabled={!agent.isEnabled || isRunning}
              className="gap-1"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this agent and all its suggestions?")) {
                  onDelete();
                }
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t bg-background">
          {/* Cost Info */}
          <div className="flex gap-4 mb-4 text-sm">
            <div className="bg-muted/50 rounded px-3 py-2">
              <span className="text-muted-foreground">Total Cost:</span>{" "}
              <span className="font-semibold">${(costData?.totalCost || 0).toFixed(4)}</span>
            </div>
            <div className="bg-muted/50 rounded px-3 py-2">
              <span className="text-muted-foreground">Runs:</span>{" "}
              <span className="font-semibold">{costData?.runCount || 0}</span>
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Suggestions
              </h4>
              <Button variant="ghost" size="sm" onClick={loadSuggestions} disabled={loadingSuggestions}>
                <RefreshCw className={`h-4 w-4 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loadingSuggestions ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No suggestions yet. Run the agent to generate improvement ideas.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion: any) => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Suggestion Card
function SuggestionCard({ suggestion }: { suggestion: any }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500 bg-red-50";
      case "low":
        return "text-green-500 bg-green-50";
      default:
        return "text-amber-500 bg-amber-50";
    }
  };

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/ai-suggestions/${id}`, { status, implementedAt: status === "implemented" ? new Date() : null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
    },
  });

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="font-medium">{suggestion.title}</h5>
            <Badge className={getPriorityColor(suggestion.priority)} variant="outline">
              {suggestion.priority}
            </Badge>
            {suggestion.status === "implemented" && (
              <Badge variant="default" className="bg-green-500">Implemented</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{suggestion.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <DollarSign className="h-3 w-3" />
              Est. Cost: {suggestion.estimatedCost}
            </span>
            <span className="text-muted-foreground">
              Created: {new Date(suggestion.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        {suggestion.status !== "implemented" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, status: "implemented" })}
            disabled={updateSuggestionMutation.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Mark Done
          </Button>
        )}
      </div>
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, isMasterAdmin }: { open: boolean; onOpenChange: (open: boolean) => void; isMasterAdmin: boolean }) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    name: "",
    role: "Crew",
    isTestAccount: false,
  });

  useEffect(() => {
    if (open) {
      setFormData({ username: "", password: "", email: "", name: "", role: "Crew", isTestAccount: false });
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4" autoComplete="off">
          <div className="grid gap-2">
            <Label>Full Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Username</Label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isMasterAdmin && <SelectItem value="Admin">Admin</SelectItem>}
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Crew">Crew</SelectItem>
                <SelectItem value="Customer">Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="create-user-is-test"
              checked={formData.isTestAccount}
              onCheckedChange={(checked) => setFormData({ ...formData, isTestAccount: checked === true })}
              data-testid="checkbox-create-user-test-account"
            />
            <Label htmlFor="create-user-is-test" className="text-sm font-normal leading-snug">
              This is a test account (use "TEST TEST" or "ZZZ Safe to Delete" in the name). Test accounts
              can have their password reset without confirmation and never receive reset emails.
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateAgentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "custom",
    runFrequency: "manual" as "manual" | "daily" | "weekly" | "monthly",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/ai-agents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      setOpen(false);
      setFormData({ name: "", description: "", category: "custom", runFrequency: "manual" });
      onCreated();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const categoryOptions = [
    { value: "custom", label: "Custom Agent" },
    { value: "sop_builder", label: "SOP Builder" },
    { value: "forms_builder", label: "Forms Builder" },
    { value: "content_creator", label: "Content Creator" },
    { value: "forms", label: "Forms Analyzer" },
    { value: "sops", label: "SOP Analyzer" },
    { value: "communications", label: "Hiring/HR Comms AI" },
    { value: "hiring", label: "Hiring" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-agent">
          <Plus className="w-4 h-4" /> Create Agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Create AI Agent
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label>Agent Name</Label>
            <Input
              placeholder="e.g., Equipment Maintenance Analyzer"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-agent-name"
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input
              placeholder="What should this agent do?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-agent-description"
            />
          </div>
          <div className="grid gap-2">
            <Label>Category / Type</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
              <SelectTrigger data-testid="select-agent-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Run Frequency</Label>
            <Select value={formData.runFrequency} onValueChange={(val: any) => setFormData({ ...formData, runFrequency: val })}>
              <SelectTrigger data-testid="select-agent-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Only</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-agent">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Agent
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AppTestingPanel() {
  const { user, previewRole, setPreviewRole, effectiveRole } = useAuth();
  const roles = ["Admin", "Manager", "Crew", "Customer"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          App Testing
        </CardTitle>
        <CardDescription>
          Preview the app as different roles to see what each access level experiences. This only changes your view — not your actual permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {roles.map(role => (
            <Button
              key={role}
              variant={effectiveRole === role ? "default" : "outline"}
              className="h-20 flex-col gap-2"
              data-testid={`button-preview-${role.toLowerCase()}`}
              onClick={() => {
                setPreviewRole(role === user?.role ? null : role);
              }}
            >
              {role === "Admin" && <Shield className="h-5 w-5" />}
              {role === "Manager" && <Users className="h-5 w-5" />}
              {role === "Crew" && <Wrench className="h-5 w-5" />}
              {role === "Customer" && <Star className="h-5 w-5" />}
              <span className="font-medium">{role}</span>
              {role === user?.role && <Badge variant="secondary" className="text-xs">Your Role</Badge>}
            </Button>
          ))}
        </div>
        {previewRole && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-amber-800">
                <strong>Preview Mode Active:</strong> You're viewing the app as <strong>{previewRole}</strong>. 
                Navigate to any page to see what a {previewRole} user would see.
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewRole(null)} data-testid="button-exit-preview">
              <EyeOff className="h-4 w-4 mr-2" /> Exit Preview
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SharedLinksManager() {
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["/api/shared-links"],
    queryFn: async () => (await apiRequest("GET", "/api/shared-links")).json(),
  });

  const { data: accessLogs = [] } = useQuery({
    queryKey: [`/api/shared-links/${selectedLink}/access-logs`],
    queryFn: async () => (await apiRequest("GET", `/api/shared-links/${selectedLink}/access-logs`)).json(),
    enabled: !!selectedLink,
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shared-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-links"] });
      toast({ title: "Link revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke link", variant: "destructive" });
    },
  });

  const getStatus = (link: any) => {
    if (link.isRevoked) return { label: "Revoked", color: "bg-red-100 text-red-800" };
    if (new Date(link.expiresAt) < new Date()) return { label: "Expired", color: "bg-amber-100 text-amber-800" };
    return { label: "Active", color: "bg-green-100 text-green-800" };
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" /> External Share Links
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {links.length} total · {links.filter((l: any) => !l.isRevoked && new Date(l.expiresAt) >= new Date()).length} active
          </p>
        </div>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No shared links yet</p>
            <p className="text-sm text-muted-foreground mt-1">Use the "Share Externally" button on any document to create a share link.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => {
            const status = getStatus(link);
            return (
              <Card key={link.id} className="overflow-hidden" data-testid={`shared-link-${link.id}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{link.documentName}</span>
                        <Badge className={`text-[10px] shrink-0 ${status.color}`} variant="outline" data-testid={`status-${link.id}`}>
                          {status.label}
                        </Badge>
                        {link.passwordHash && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            <Key className="h-2.5 w-2.5 mr-0.5" /> Protected
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Type: {link.documentType}</span>
                        <span>By: {link.createdByName}</span>
                        <span>Created: {new Date(link.createdAt).toLocaleDateString()}</span>
                        <span>Expires: {new Date(link.expiresAt).toLocaleDateString()}</span>
                        <span className="font-medium">{link.viewCount} view{link.viewCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const domain = window.location.origin;
                          navigator.clipboard.writeText(`${domain}/shared/${link.token}`);
                          toast({ title: "Link copied" });
                        }}
                        data-testid={`copy-link-${link.id}`}
                        disabled={status.label !== "Active"}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLink(selectedLink === link.id ? null : link.id)}
                        data-testid={`view-logs-${link.id}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Logs
                      </Button>
                      {status.label === "Active" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeMutation.mutate(link.id)}
                          disabled={revokeMutation.isPending}
                          data-testid={`revoke-link-${link.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Revoke
                        </Button>
                      )}
                    </div>
                  </div>

                  {selectedLink === link.id && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium mb-2">Access Log ({accessLogs.length} entries)</p>
                      {accessLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No accesses recorded yet.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Time</TableHead>
                                <TableHead className="text-xs">IP Address</TableHead>
                                <TableHead className="text-xs">User Agent</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {accessLogs.map((log: any) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-xs">{new Date(log.accessedAt).toLocaleString()}</TableCell>
                                  <TableCell className="text-xs font-mono">{log.ipAddress || "—"}</TableCell>
                                  <TableCell className="text-xs truncate max-w-[200px]">{log.userAgent || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
