import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { fmtDateOnly } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, Pencil, User, MapPin, Calendar, Clock,
  DollarSign, Briefcase, Timer, ChevronDown, Loader2, FileText,
  Plus, Trash2, HardHat, MessageSquare, ShieldCheck, GitMerge, CheckSquare, ClipboardCheck, Award, Truck, Users, Package,
  TrendingUp, TrendingDown, Camera, Image, ExternalLink,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import { JobFormModal, JOB_STATUSES } from "./JobFormModal";
import { InvoiceFormModal } from "@/pages/invoices/InvoiceFormModal";
import { useAuth } from "@/hooks/use-auth";
import JobWorkOrderTab from "./JobWorkOrderTab";
import JobPacketGate from "./JobPacketGate";
import JobChangeOrders from "./JobChangeOrders";
import JobCheckpoints from "./JobCheckpoints";
import JobCloseout from "./JobCloseout";
import JobWarranty from "./JobWarranty";
import JobEquipment from "./JobEquipment";
import JobCrew from "./JobCrew";
import JobMaterials from "./JobMaterials";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimeEntry {
  id: string; clock_in: string; clock_out: string | null;
  duration_minutes: number | null; entry_type: string; employee_name: string | null;
}
interface JobDetail {
  id: string; title: string; client: string; status: string; stage: string;
  job_type: string | null; type: string | null; description: string | null;
  scheduled_date: string | null; scheduled_start_time: string | null;
  scheduled_end_time: string | null; completion_date: string | null;
  estimated_hours: string | null; actual_hours: string | null;
  price: string | null; value: number | null; crew_notes: string | null; notes: string | null;
  customer_id: string | null; property_id: string | null;
  cust_first: string | null; cust_last: string | null; cust_company: string | null;
  prop_address: string | null; prop_city: string | null; prop_state: string | null; prop_zip: string | null;
  created_at: string; updated_at: string;
  time_entries: TimeEntry[];
  linked_invoice_id: string | null;
  linked_invoice_number: string | null;
  companycam_project_id: string | null;
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  lead:        { label: "Lead",        cls: "bg-gray-100 text-gray-700 border-gray-200",         dot: "bg-gray-400" },
  scheduled:   { label: "Scheduled",   cls: "bg-blue-100 text-blue-800 border-blue-200",         dot: "bg-blue-500" },
  sold:        { label: "Sold",        cls: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-800 border-amber-200",      dot: "bg-amber-500 animate-pulse" },
  completed:   { label: "Completed",   cls: "bg-green-100 text-green-800 border-green-200",      dot: "bg-green-500" },
  invoiced:    { label: "Invoiced",    cls: "bg-purple-100 text-purple-800 border-purple-200",dot: "bg-purple-500" },
  cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-800 border-red-200",         dot: "bg-red-500" },
};

function fmtDate(d: string | null) {
  if (!d) return null;
  try { return format(parseISO(d), "MMMM d, yyyy"); } catch { return d; }
}
function fmtTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}
function fmtMoney(v: any) {
  const n = Number(v);
  if (!v && v !== 0) return null;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtMinutes(mins: number | null) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: React.ReactNode; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        {href
          ? <a href={href} className="text-sm font-medium text-primary hover:underline">{value}</a>
          : <p className="text-sm font-medium">{value}</p>}
      </div>
    </div>
  );
}

// ── Invoice helpers ───────────────────────────────────────────────────────────
const INV_STATUS_CLS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  changes_requested: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-gray-100 text-gray-400 line-through",
};

interface InvoiceSummary {
  id: string; invoice_number: string; status: string;
  issued_date: string; due_date: string | null;
  total: string; balance_due: string;
}

function JobMessagesTab({ jobId }: { jobId: string }) {
  const { t } = useTranslation("jobDetail");
  const { data: msgs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dm/by-job", jobId],
    queryFn: () => fetch(`/api/dm/by-job/${jobId}`, { credentials: "include" }).then(r => r.json()),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground py-4 text-center">{t("loading")}</p>;
  if (msgs.length === 0) return (
    <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
      {t("noMessages")}
    </CardContent></Card>
  );
  return (
    <div className="space-y-2" data-testid="job-messages-list">
      {msgs.map((m: any) => (
        <Card key={m.id} className="hover:bg-muted/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium">{m.sender_name}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-xs font-medium">{m.recipient_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(m.sent_at).toLocaleDateString()}
                  </span>
                </div>
                {m.subject && <p className="text-xs font-semibold text-muted-foreground mb-0.5">{m.subject}</p>}
                <p className="text-sm text-gray-700 line-clamp-2">{m.body}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Daily Logs Tab ────────────────────────────────────────────────────────────
interface DailyLog {
  id: number;
  job_id: string;
  employee_id: string;
  employee_name: string | null;
  employee_username: string | null;
  log_date: string;
  work_description: string;
  hours_worked: string | number;
  notes: string | null;
  created_at: string;
}

function DailyLogsTab({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    log_date: new Date().toISOString().split("T")[0],
    work_description: "",
    hours_worked: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: logs = [], isLoading } = useQuery<DailyLog[]>({
    queryKey: ["/api/jobs/daily-logs", jobId],
    queryFn: () =>
      fetch(`/api/jobs/${jobId}/daily-logs`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () =>
      fetch("/api/admin/users", { credentials: "include" }).then((r) => r.json()),
  });

  const resetForm = () =>
    setForm({
      employee_id: "",
      log_date: new Date().toISOString().split("T")[0],
      work_description: "",
      hours_worked: "",
      notes: "",
    });

  async function handleSave() {
    if (!form.employee_id || !form.log_date || !form.work_description) {
      toast({ title: "Required fields", description: "Employee, date, and description are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/daily-logs`, form);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Save failed.");
      }
      await qc.invalidateQueries({ queryKey: ["/api/jobs/daily-logs", jobId] });
      toast({ title: "Entry saved", description: "The journal entry was added." });
      resetForm();
      setShowForm(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await apiRequest("DELETE", `/api/daily-logs/${id}`);
      await qc.invalidateQueries({ queryKey: ["/api/jobs/daily-logs", jobId] });
      toast({ title: "Eliminado", description: "Registro eliminado correctamente." });
    } catch {
      toast({ title: "Error", description: "Could not delete the entry.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  function fmtLogDate(d: string) {
    try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Work Journal</h3>
        <Button size="sm" onClick={() => setShowForm(true)} data-testid="button-add-log">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Entry
        </Button>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No journal entries for this job yet.</p>
            <p className="text-xs mt-1 text-gray-400">Use the "Add Entry" button to log the day's work.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pb-2 px-0 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="pr-4 w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                      <TableCell className="pl-5 whitespace-nowrap text-sm font-medium text-gray-800">
                        {fmtLogDate(log.log_date)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {log.employee_name || log.employee_username || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-gray-800">
                        {Number(log.hours_worked).toFixed(1)}h
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="text-sm text-gray-700 truncate" title={log.work_description}>
                          {log.work_description}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="text-sm text-gray-500 truncate">{log.notes || "—"}</p>
                      </TableCell>
                      <TableCell className="pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingId === log.id}
                          data-testid={`button-delete-log-${log.id}`}
                        >
                          {deletingId === log.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Log Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { resetForm(); setShowForm(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-green-600" />
              New journal entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="log-employee">Employee <span className="text-red-500">*</span></Label>
                <select
                  id="log-employee"
                  value={form.employee_id}
                  onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="select-log-employee"
                >
                  <option value="">Seleccionar empleado…</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="log-date">Date <span className="text-red-500">*</span></Label>
                <Input
                  id="log-date"
                  type="date"
                  value={form.log_date}
                  onChange={(e) => setForm((f) => ({ ...f, log_date: e.target.value }))}
                  data-testid="input-log-date"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-hours">Hours worked</Label>
              <Input
                id="log-hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="ej. 7.5"
                value={form.hours_worked}
                onChange={(e) => setForm((f) => ({ ...f, hours_worked: e.target.value }))}
                data-testid="input-log-hours"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-desc">Work description <span className="text-red-500">*</span></Label>
              <Textarea
                id="log-desc"
                placeholder="What was done on this job today?…"
                value={form.work_description}
                onChange={(e) => setForm((f) => ({ ...f, work_description: e.target.value }))}
                rows={3}
                data-testid="input-log-description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-notes">Notes / issues (optional)</Label>
              <Textarea
                id="log-notes"
                placeholder="Problemas encontrados, materiales usados, observaciones…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                data-testid="input-log-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-log">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Files & Photos Tab ────────────────────────────────────────────────────────
function FilesPhotosTab({ jobId }: { jobId: string }) {
  const { data: docs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs", jobId, "documents"],
    queryFn: () => fetch(`/api/jobs/${jobId}/documents`, { credentials: "include" }).then((r) => r.json()),
  });
  const { data: ccData } = useQuery<any>({
    queryKey: ["/api/jobs", jobId, "companycam-photos"],
    queryFn: () => fetch(`/api/jobs/${jobId}/companycam-photos`, { credentials: "include" }).then((r) => r.json()),
  });
  const { data: wsPhotos = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs", jobId, "worksheet-photos"],
    queryFn: () => fetch(`/api/jobs/${jobId}/worksheet-photos`, { credentials: "include" }).then((r) => r.json()),
  });

  const ccPhotos: any[] = ccData?.photos ?? [];

  const typeColor = (t: string) =>
    t === "before" ? "bg-blue-100 text-blue-700" :
    t === "after"  ? "bg-green-100 text-green-700" :
    t === "damage" ? "bg-red-100 text-red-700" :
    "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-5">
      {/* ── Job Documents ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Job Documents
            <span className="ml-auto text-xs font-normal text-muted-foreground">{docs.length} file{docs.length !== 1 ? "s" : ""}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No documents attached to this job</p>
          ) : (
            <div className="divide-y">
              {docs.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 py-2.5" data-testid={`row-doc-${doc.id}`}>
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{doc.type}</p>
                  </div>
                  {doc.uploadedAt && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(doc.uploadedAt), "MMM d, yyyy")}
                    </span>
                  )}
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid={`button-open-doc-${doc.id}`}>
                      <ExternalLink className="h-3 w-3" /> Open
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CompanyCam Photos ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            CompanyCam Photos
            <span className="ml-auto text-xs font-normal text-muted-foreground">{ccPhotos.length} photo{ccPhotos.length !== 1 ? "s" : ""}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {ccPhotos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              {ccData?.project ? "No photos in this CompanyCam project yet" : "No CompanyCam project linked to this job"}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {ccPhotos.map((photo: any) => (
                <a
                  key={photo.companycam_photo_id}
                  href={photo.app_url || photo.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="block group"
                  data-testid={`img-companycam-${photo.companycam_photo_id}`}
                >
                  <div className="aspect-square rounded-md overflow-hidden bg-muted border">
                    <img
                      src={photo.uri}
                      alt={photo.description || "Site photo"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  {photo.captured_at && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-center truncate">
                      {format(new Date(photo.captured_at), "MMM d")}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Worksheet Photos ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Image className="h-4 w-4 text-muted-foreground" />
            Worksheet Photos
            <span className="ml-auto text-xs font-normal text-muted-foreground">{wsPhotos.length} photo{wsPhotos.length !== 1 ? "s" : ""}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {wsPhotos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No worksheet photos linked to this job</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {wsPhotos.map((photo: any) => (
                <a
                  key={photo.id}
                  href={photo.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block group"
                  data-testid={`img-worksheet-${photo.id}`}
                >
                  <div className="aspect-square rounded-md overflow-hidden bg-muted border">
                    <img
                      src={photo.photo_url}
                      alt={`${photo.photo_type} photo`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="flex justify-center mt-0.5">
                    <span className={`text-[10px] font-medium capitalize px-1.5 py-0.5 rounded ${typeColor(photo.photo_type)}`}>
                      {photo.photo_type}
                    </span>
                  </div>
                  {photo.employee_name && (
                    <p className="text-[10px] text-muted-foreground text-center truncate mt-0.5">{photo.employee_name}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobInvoicesTab({ jobId, customerId }: { jobId: string; customerId: string }) {
  const { t } = useTranslation("jobDetail");
  const [, nav] = useLocation();
  const qcInv = useQueryClient();
  const [showNewInvoice, setShowNewInvoice] = useState(false);

  const { data: invoices = [], isLoading } = useQuery<InvoiceSummary[]>({
    queryKey: ["/api/invoices", "job", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices?job_id=${jobId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json();
    },
  });

  const fmtMoneyLocal = (v: any) => `$${parseFloat(v ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <>
    <Card>
      <CardHeader className="pb-3 pt-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{t("invoicesCardTitle")}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="default"
            onClick={() => setShowNewInvoice(true)}
            className="text-xs h-7 px-2"
            data-testid="btn-create-invoice-for-job"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Invoice
          </Button>
          <Button size="sm" variant="outline" onClick={() => nav("/invoices")} className="text-xs h-7 px-2">
            <FileText className="h-3.5 w-3.5 mr-1" /> {t("allInvoices")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4 px-0">
        {invoices.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("noInvoices")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">{t("invColNumber")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("invColIssued")}</TableHead>
                <TableHead>{t("invColDue")}</TableHead>
                <TableHead className="text-right">{t("invColTotal")}</TableHead>
                <TableHead className="text-right pr-6">{t("invColBalance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40"
                  onClick={() => nav(`/invoices/${inv.id}`)} data-testid={`row-invoice-${inv.id}`}>
                  <TableCell className="pl-6 font-mono text-sm font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${INV_STATUS_CLS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{fmtDateOnly(inv.issued_date)}</TableCell>
                  <TableCell className="text-sm">{fmtDateOnly(inv.due_date)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtMoneyLocal(inv.total)}</TableCell>
                  <TableCell className={`text-right text-sm font-medium pr-6 ${parseFloat(inv.balance_due) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {fmtMoneyLocal(inv.balance_due)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    <InvoiceFormModal
      open={showNewInvoice}
      onOpenChange={(v) => {
        setShowNewInvoice(v);
        if (!v) qcInv.invalidateQueries({ queryKey: ["/api/invoices", "job", jobId] });
      }}
      lockedJobId={jobId}
      lockedCustomerId={customerId || undefined}
      onSuccess={() => {
        setShowNewInvoice(false);
        qcInv.invalidateQueries({ queryKey: ["/api/invoices", "job", jobId] });
      }}
    />
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JobDetailPage() {
  const { t } = useTranslation("jobDetail");
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveRole } = useAuth();
  const isAdminOrManager = ["Admin", "Manager", "Master Admin"].includes(effectiveRole ?? "");

  const [showEdit, setShowEdit] = useState(false);
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false);
  const [crewNotes, setCrewNotes] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  // Work Areas modal state
  const [showAddArea, setShowAddArea] = useState(false);
  const [addAreaTypeId, setAddAreaTypeId] = useState("");
  const [addAreaHours, setAddAreaHours] = useState("");

  const { data: job, isLoading, error } = useQuery<JobDetail>({
    queryKey: ["/api/jobs", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${id}`);
      if (!res.ok) throw new Error("Job not found");
      const data = await res.json();
      setCrewNotes(data.crew_notes ?? data.notes ?? "");
      return data;
    },
  });

  // Work area types (for the add dialog)
  const { data: workAreaTypes = [] } = useQuery<Array<{ id: string; name: string; division: string | null }>>({
    queryKey: ["/api/work-area-types"],
    queryFn: async () => {
      const res = await fetch("/api/work-area-types", { credentials: "include" });
      return res.json();
    },
    enabled: showAddArea,
  });

  // Job work areas
  const { data: jobWorkAreas = [], refetch: refetchAreas } = useQuery<Array<{
    id: string; name: string; estimated_hours: string | null; actual_hours_computed: string; status: string; area_description: string | null;
  }>>({
    queryKey: ["/api/jobs", id, "work-areas"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${id}/work-areas`, { credentials: "include" });
      return res.json();
    },
    enabled: !!id,
  });

  const addAreaMutation = useMutation({
    mutationFn: async () => {
      if (!addAreaTypeId) throw new Error("Please select a work area type");
      const res = await apiRequest("POST", `/api/jobs/${id}/work-areas`, {
        work_area_type_id: addAreaTypeId,
        estimated_hours: addAreaHours ? parseFloat(addAreaHours) : undefined,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      refetchAreas();
      setShowAddArea(false);
      setAddAreaTypeId("");
      setAddAreaHours("");
      toast({ title: t("workAreaAdded") });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (areaId: string) => {
      const res = await apiRequest("DELETE", `/api/job-work-areas/${areaId}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { refetchAreas(); toast({ title: t("workAreaRemoved") }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/jobs/${id}/status`, { status: newStatus });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: t("statusUpdated") });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const saveNotes = async () => {
    if (!job) return;
    setSavingNotes(true);
    try {
      await apiRequest("PATCH", `/api/jobs/${id}`, { crew_notes: crewNotes, notes: crewNotes });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      toast({ title: t("notesSaved") });
    } catch {
      toast({ title: t("failedSaveNotes"), variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !job) {
    return <div className="p-8 text-center text-muted-foreground">{t("notFound")}</div>;
  }

  const status = job.status || "lead";
  const statusInfo = STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-muted", dot: "bg-muted" };
  const custName = job.cust_first ? `${job.cust_first} ${job.cust_last}` : (job.cust_company ?? job.client);
  const propAddr = [job.prop_address, job.prop_city, job.prop_state, job.prop_zip].filter(Boolean).join(", ");

  const actualHours = job.actual_hours ? parseFloat(String(job.actual_hours)) : 0;
  const estimatedHours = job.estimated_hours ? parseFloat(String(job.estimated_hours)) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")} className="text-muted-foreground"
          data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("title")}
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{job.title || job.client}</h1>
        </div>
        {isAdminOrManager && job.linked_invoice_id && (
          <Button size="sm" variant="outline" onClick={() => navigate(`/invoices/${job.linked_invoice_id}`)}
            data-testid="link-view-invoice">
            <FileText className="h-4 w-4 mr-1.5" /> View Invoice {job.linked_invoice_number}
          </Button>
        )}
        {isAdminOrManager && job.status === "completed" && !job.linked_invoice_id && (
          <Button size="sm" onClick={() => setShowGenerateInvoice(true)} data-testid="button-generate-invoice"
            className="bg-green-600 hover:bg-green-700 text-white">
            <FileText className="h-4 w-4 mr-1.5" /> Generate Invoice
          </Button>
        )}
        {isAdminOrManager && (
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-edit-job">
            <Pencil className="h-4 w-4 mr-1.5" /> {t("editJob")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
        {/* ── Left Column ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              {/* Status — big, clickable */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">{t("status")}</p>
                {isAdminOrManager ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors hover:opacity-90 ${statusInfo.cls}`}
                        data-testid="button-status">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                        <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {JOB_STATUSES.map((s) => (
                        <DropdownMenuItem
                          key={s.value}
                          className={`cursor-pointer ${status === s.value ? "font-bold" : ""}`}
                          onClick={() => statusMutation.mutate(s.value)}
                        >
                          {s.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${statusInfo.cls}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </span>
                )}
              </div>

              <Separator className="mb-3" />

              {/* Info rows */}
              <InfoRow
                icon={User} label={t("customer")} value={custName}
                href={job.customer_id ? `/customers/${job.customer_id}` : undefined}
              />
              {propAddr && <InfoRow icon={MapPin} label={t("property")} value={propAddr} />}
              <InfoRow icon={Briefcase} label={t("jobType")} value={job.job_type || job.type} />
              <InfoRow
                icon={Calendar} label={t("scheduledLabel")}
                value={fmtDate(job.scheduled_date) ?? undefined}
              />
              {(job.scheduled_start_time || job.scheduled_end_time) && (
                <InfoRow
                  icon={Clock} label={t("timeLabel")}
                  value={[fmtTime(job.scheduled_start_time), fmtTime(job.scheduled_end_time)].filter(Boolean).join(" – ")}
                />
              )}
              <InfoRow icon={DollarSign} label={t("priceLabel")} value={fmtMoney(job.price ?? job.value) ?? undefined} />
              {job.companycam_project_id && (
                <div className="flex items-center gap-3 py-1.5">
                  <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground w-20 shrink-0">CompanyCam</span>
                  <a
                    href={`https://app.companycam.com/projects/${job.companycam_project_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    data-testid="link-open-companycam"
                  >
                    Open Project <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Crew Notes (left col quick view) */}
          {(job.crew_notes || job.notes) && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground font-medium">{t("crewNotes")}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm whitespace-pre-wrap">{job.crew_notes || job.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Work Areas */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <HardHat className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">{t("workAreas")}</CardTitle>
              </div>
              {isAdminOrManager && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                  onClick={() => setShowAddArea(true)} data-testid="button-add-work-area">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {jobWorkAreas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t("noWorkAreas")}
                </p>
              ) : (
                <div className="space-y-2">
                  {jobWorkAreas.map((area) => {
                    const estH = area.estimated_hours ? parseFloat(area.estimated_hours) : null;
                    const actH = parseFloat(area.actual_hours_computed ?? "0");
                    const statusCls =
                      area.status === "completed"   ? "bg-green-100 text-green-700" :
                      area.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                                                       "bg-gray-100 text-gray-600";
                    return (
                      <div key={area.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-b-0"
                        data-testid={`row-work-area-${area.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{area.area_description || area.name}</p>
                          {area.area_description && area.area_description !== area.name && (
                            <p className="text-[11px] text-muted-foreground truncate">{area.name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusCls}`}>
                              {area.status.replace("_", " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {actH.toFixed(1)}h{estH ? ` / ${estH}h est.` : ""}
                            </span>
                          </div>
                        </div>
                        {isAdminOrManager && (
                          <button
                            onClick={() => deleteAreaMutation.mutate(area.id)}
                            disabled={deleteAreaMutation.isPending}
                            className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                            title={t("removeWorkArea")}
                            data-testid={`button-delete-area-${area.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
            <TabsTrigger value="work-order" data-testid="tab-work-order">Work Order</TabsTrigger>
            <TabsTrigger value="time">{t("tabTime")}</TabsTrigger>
            <TabsTrigger value="notes">{t("tabNotes")}</TabsTrigger>
            <TabsTrigger value="invoices">{t("tabInvoices")}</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">{t("tabMessages")}</TabsTrigger>
            <TabsTrigger value="activity">{t("tabActivity")}</TabsTrigger>
            <TabsTrigger value="daily-logs" data-testid="tab-daily-logs">Journal</TabsTrigger>
            {isAdminOrManager && (
              <TabsTrigger value="materials" data-testid="tab-materials">
                <Package className="h-3.5 w-3.5 mr-1" />
                Materials
              </TabsTrigger>
            )}
            {isAdminOrManager && (
              <TabsTrigger value="crew" data-testid="tab-crew">
                <Users className="h-3.5 w-3.5 mr-1" />
                Crew
              </TabsTrigger>
            )}
            {isAdminOrManager && (
              <TabsTrigger value="equipment" data-testid="tab-equipment">
                <Truck className="h-3.5 w-3.5 mr-1" />
                Equipment
              </TabsTrigger>
            )}
            {isAdminOrManager && (
              <TabsTrigger value="change-orders" data-testid="tab-change-orders">
                <GitMerge className="h-3.5 w-3.5 mr-1" />
                Change Orders
              </TabsTrigger>
            )}
            <TabsTrigger value="checkpoints" data-testid="tab-checkpoints">
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Checkpoints
            </TabsTrigger>
            {isAdminOrManager && (
              <TabsTrigger value="closeout" data-testid="tab-closeout">
                <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                Closeout
              </TabsTrigger>
            )}
            {isAdminOrManager && (
              <TabsTrigger value="warranty" data-testid="tab-warranty">
                <Award className="h-3.5 w-3.5 mr-1" />
                Warranty
              </TabsTrigger>
            )}
            {isAdminOrManager && (
              <TabsTrigger value="packet-gate" data-testid="tab-packet-gate">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                Job Gate
              </TabsTrigger>
            )}
            <TabsTrigger value="files-photos" data-testid="tab-files-photos">
              <Camera className="h-3.5 w-3.5 mr-1" />
              Files &amp; Photos
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Timer className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("estimatedHours")}</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-est-hours">
                    {estimatedHours != null ? `${estimatedHours}h` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("actualHours")}</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-actual-hours">
                    {actualHours > 0 ? `${actualHours.toFixed(1)}h` : "—"}
                  </p>
                  {estimatedHours && actualHours > 0 && (
                    <p className={`text-xs mt-1 ${actualHours > estimatedHours ? "text-red-500" : "text-green-600"}`}>
                      {actualHours > estimatedHours
                        ? `${(actualHours - estimatedHours).toFixed(1)}${t("hoursOver")}`
                        : `${(estimatedHours - actualHours).toFixed(1)}${t("hoursRemaining")}`}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("jobValue")}</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-price">
                    {fmtMoney(job.price ?? job.value) ?? "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("timeEntries")}</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-entries-count">
                    {job.time_entries.length}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Job Costing Card */}
            {isAdminOrManager && <JobCostingCard jobId={id} job={job} actualHours={actualHours} />}

            {job.description && (
              <Card className="mt-4">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm">{t("scopeOfWork")}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{job.description}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Time Entries Tab */}
          <TabsContent value="time">
            <Card>
              <CardContent className="p-0">
                {job.time_entries.length === 0 ? (
                  <div className="py-12 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">{t("noTimeEntries")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("noTimeEntriesHint")}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("colEmployee")}</TableHead>
                        <TableHead>{t("colClockIn")}</TableHead>
                        <TableHead>{t("colClockOut")}</TableHead>
                        <TableHead>{t("duration")}</TableHead>
                        <TableHead>{t("colType")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {job.time_entries.map((te) => (
                        <TableRow key={te.id} data-testid={`row-te-${te.id}`}>
                          <TableCell className="font-medium text-sm">
                            {te.employee_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {te.clock_in ? format(parseISO(te.clock_in), "MMM d, h:mm a") : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {te.clock_out ? format(parseISO(te.clock_out), "MMM d, h:mm a") : (
                              <span className="text-green-600 dark:text-green-400 font-medium">{t("active")}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {fmtMinutes(te.duration_minutes)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground capitalize">
                            {te.entry_type?.replace("_", " ") ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm">{t("crewNotes")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={crewNotes ?? ""}
                  onChange={(e) => setCrewNotes(e.target.value)}
                  rows={8}
                  placeholder={t("crewNotesTabPlaceholder")}
                  className="resize-none"
                  data-testid="textarea-crew-notes"
                  readOnly={!isAdminOrManager}
                />
                {isAdminOrManager && (
                  <Button size="sm" onClick={saveNotes} disabled={savingNotes} data-testid="button-save-notes">
                    {savingNotes ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    {t("saveNotes")}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <JobInvoicesTab jobId={job.id} customerId={job.customer_id ?? ""} />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <JobMessagesTab jobId={job.id} />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t("jobCreatedActivity")}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.created_at ? format(parseISO(job.created_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                    </p>
                  </div>
                </div>
                {job.updated_at && job.updated_at !== job.created_at && (
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t("lastUpdatedActivity")}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(job.updated_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${STATUS_MAP[status]?.dot ?? "bg-muted"}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {t("currentStatus")} <span className="font-semibold">{STATUS_MAP[status]?.label ?? status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status === "completed" && job.completion_date
                        ? `${t("completedOn")} ${fmtDate(job.completion_date)}`
                        : t("setViaStatus")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Work Order Tab */}
          <TabsContent value="work-order">
            <JobWorkOrderTab jobId={id} isAdminOrManager={isAdminOrManager} />
          </TabsContent>

          {/* Daily Logs Tab */}
          <TabsContent value="daily-logs">
            <DailyLogsTab jobId={id} />
          </TabsContent>

          {/* Materials Tab */}
          {isAdminOrManager && (
            <TabsContent value="materials">
              <JobMaterials jobId={id} isAdminOrManager={isAdminOrManager} />
            </TabsContent>
          )}

          {/* Crew Tab */}
          {isAdminOrManager && (
            <TabsContent value="crew">
              <JobCrew jobId={id} isAdminOrManager={isAdminOrManager} />
            </TabsContent>
          )}

          {/* Equipment Tab */}
          {isAdminOrManager && (
            <TabsContent value="equipment">
              <JobEquipment jobId={id} isAdminOrManager={isAdminOrManager} />
            </TabsContent>
          )}

          {/* Change Orders Tab */}
          {isAdminOrManager && (
            <TabsContent value="change-orders">
              <JobChangeOrders jobId={id} isAdminOrManager={isAdminOrManager} />
            </TabsContent>
          )}

          {/* Checkpoints Tab */}
          <TabsContent value="checkpoints">
            <JobCheckpoints jobId={id} isAdminOrManager={isAdminOrManager} />
          </TabsContent>

          {/* Closeout Tab */}
          {isAdminOrManager && (
            <TabsContent value="closeout">
              <JobCloseout jobId={id} isAdminOrManager={isAdminOrManager} />
            </TabsContent>
          )}

          {/* Warranty Tab */}
          {isAdminOrManager && (
            <TabsContent value="warranty">
              <JobWarranty jobId={id} isAdminOrManager={isAdminOrManager} />
            </TabsContent>
          )}

          {/* Job Packet Gate Tab */}
          {isAdminOrManager && (
            <TabsContent value="packet-gate">
              <JobPacketGate jobId={id} isAdminOrManager={isAdminOrManager} />
            </TabsContent>
          )}

          {/* Files & Photos Tab */}
          <TabsContent value="files-photos">
            <FilesPhotosTab jobId={id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Work Area Dialog */}
      <Dialog open={showAddArea} onOpenChange={(o) => { if (!o) { setShowAddArea(false); setAddAreaTypeId(""); setAddAreaHours(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addWorkArea")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">{t("workAreaType")}</Label>
              <select
                value={addAreaTypeId}
                onChange={(e) => setAddAreaTypeId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="select-add-area-type"
              >
                <option value="">{t("selectType")}</option>
                {Object.entries(
                  workAreaTypes.reduce<Record<string, typeof workAreaTypes>>((acc, wt) => {
                    const div = wt.division ?? "Other";
                    (acc[div] = acc[div] ?? []).push(wt);
                    return acc;
                  }, {})
                ).map(([div, types]) => (
                  <optgroup key={div} label={div}>
                    {types.map((wt) => (
                      <option key={wt.id} value={wt.id}>{wt.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("estimatedHoursOptional")}</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 2.5"
                value={addAreaHours}
                onChange={(e) => setAddAreaHours(e.target.value)}
                data-testid="input-area-hours"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddArea(false)}>{t("cancel")}</Button>
            <Button onClick={() => addAreaMutation.mutate()} disabled={addAreaMutation.isPending || !addAreaTypeId}>
              {addAreaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {t("addWorkArea")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {showEdit && job && (
        <JobFormModal
          open={showEdit}
          onOpenChange={setShowEdit}
          initialData={{
            id: job.id,
            title: job.title,
            customer_id: job.customer_id ?? "",
            property_id: job.property_id ?? "",
            job_type: job.job_type ?? "",
            status: job.status,
            scheduled_date: job.scheduled_date?.split("T")[0] ?? "",
            scheduled_start_time: job.scheduled_start_time ?? "",
            scheduled_end_time: job.scheduled_end_time ?? "",
            estimated_hours: job.estimated_hours ? String(job.estimated_hours) : "",
            price: job.price ? String(job.price) : job.value ? String(job.value) : "",
            description: job.description ?? "",
            crew_notes: job.crew_notes ?? job.notes ?? "",
          }}
        />
      )}

      {/* Generate Invoice Modal — pre-filled with this job and its customer */}
      {job && (
        <InvoiceFormModal
          open={showGenerateInvoice}
          onOpenChange={setShowGenerateInvoice}
          lockedJobId={job.id}
          lockedCustomerId={job.customer_id ?? undefined}
          onSuccess={() => setShowGenerateInvoice(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Costing Card — shown in Overview tab for Admin/Manager
// ─────────────────────────────────────────────────────────────────────────────
function JobCostingCard({ jobId, job, actualHours }: { jobId: string; job: any; actualHours: number }) {
  const fmt$ = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  // Materials cost from job_materials
  const { data: materials = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs", jobId, "materials"],
    queryFn: () => fetch(`/api/jobs/${jobId}/materials`, { credentials: "include" }).then(r => r.json()),
  });

  // Invoice totals
  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices", { job_id: jobId }],
    queryFn: () => fetch(`/api/invoices?job_id=${jobId}`, { credentials: "include" }).then(r => r.json()),
  });

  const materialsCost = materials.reduce((s: number, m: any) =>
    s + (Number(m.quantity ?? 0) * Number(m.unit_cost ?? 0)), 0);

  const invoiceTotal = invoices
    .filter((inv: any) => inv.status !== "void")
    .reduce((s: number, inv: any) => s + Number(inv.total ?? 0), 0);

  const contractValue = Number(job.price ?? job.value ?? 0);
  const grossProfit = contractValue - materialsCost;
  const margin = contractValue > 0 ? (grossProfit / contractValue) * 100 : 0;
  const hasData = materialsCost > 0 || invoiceTotal > 0 || contractValue > 0;

  if (!hasData) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-green-600" /> Job Costing Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Contract Value</p>
            <p className="text-lg font-bold">{contractValue > 0 ? fmt$(contractValue) : "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Materials Cost</p>
            <p className="text-lg font-bold text-amber-600">{materialsCost > 0 ? fmt$(materialsCost) : "—"}</p>
            {materials.length > 0 && (
              <p className="text-xs text-muted-foreground">{materials.length} item{materials.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoiced</p>
            <p className="text-lg font-bold text-blue-600">{invoiceTotal > 0 ? fmt$(invoiceTotal) : "—"}</p>
            {invoices.filter((i: any) => i.status !== "void").length > 0 && (
              <p className="text-xs text-muted-foreground">{invoices.filter((i: any) => i.status !== "void").length} invoice{invoices.filter((i: any) => i.status !== "void").length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Gross Margin</p>
            <p className={`text-lg font-bold flex items-center gap-1 ${margin >= 30 ? "text-green-600" : margin >= 0 ? "text-amber-500" : "text-red-600"}`}>
              {margin >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {contractValue > 0 ? `${margin.toFixed(1)}%` : "—"}
            </p>
            {contractValue > 0 && materialsCost > 0 && (
              <p className={`text-xs ${grossProfit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt$(grossProfit)}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
