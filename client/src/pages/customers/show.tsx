import React, { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, Phone, Mail, MapPin, Building2, FileText, Star,
  Loader2, Pencil, Plus, Trash2, CheckCircle2, XCircle,
  Briefcase, DollarSign, CalendarDays, Clock, Home, LayoutGrid, Calculator,
  AlertTriangle, Archive, ArchiveRestore, Link2,
  ClipboardList, FolderOpen, MessageSquare, ExternalLink, Download, CalendarClock, Save,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO } from "date-fns";
import { CustomerFormModal, CustomerFormData, EMPTY_FORM } from "./CustomerFormModal";
import { CannotArchiveDialog, type Blocker } from "@/components/CannotArchiveDialog";
import { EstimateFormModal } from "@/pages/estimates/EstimateFormModal";

// ── Invoice status badge helper ─────────────────────────────────────────────
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

function CustomerInvoicesTab({ customerId }: { customerId: string }) {
  const { t } = useTranslation("customers");
  const [, nav] = useLocation();
  const { data: invoices = [], isLoading } = useQuery<InvoiceSummary[]>({
    queryKey: ["/api/invoices", "customer", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices?customer_id=${customerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json();
    },
  });

  const fmtMoney = (v: any) => `$${parseFloat(v ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) => { if (!d) return "—"; try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; } };

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{t("invoicesTab")}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => nav("/invoices")} className="text-xs h-7 px-2">
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("newInvoice")}
        </Button>
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
                <TableHead className="pl-6">{t("invoiceNumber")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("issued")}</TableHead>
                <TableHead>{t("due")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead className="text-right pr-6">{t("balance")}</TableHead>
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
                  <TableCell className="text-sm">{fmtDate(inv.issued_date)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(inv.due_date)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtMoney(inv.total)}</TableCell>
                  <TableCell className={`text-right text-sm font-medium pr-6 ${parseFloat(inv.balance_due) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {fmtMoney(inv.balance_due)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Customer Estimates Tab ────────────────────────────────────────────────────
function CustomerEstimatesTab({ customerId, customerName }: { customerId: string; customerName: string }) {
  const { t } = useTranslation("customers");
  const [, nav] = useLocation();
  const qcEst = useQueryClient();
  const [showNewEstimate, setShowNewEstimate] = useState(false);
  const fmtMoney = (v: any) => `$${parseFloat(v ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) => { if (!d) return "—"; try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; } };

  const EST_STATUS_CLS: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700",
    viewed: "bg-sky-100 text-sky-700", approved: "bg-emerald-100 text-emerald-700",
    declined: "bg-red-100 text-red-700", converted: "bg-purple-100 text-purple-700",
  };

  const { data: estimates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/estimates", "customer", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/estimates?customer_id=${customerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <>
    <Card>
      <CardHeader className="pb-3 pt-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{t("estimatesTab")}</CardTitle>
        <Button
          size="sm" variant="outline"
          onClick={() => setShowNewEstimate(true)}
          className="text-xs h-7 px-2"
          data-testid="btn-new-estimate-for-customer"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("newEstimate")}
        </Button>
      </CardHeader>
      <CardContent className="pb-4 px-0">
        {estimates.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("noEstimates")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">{t("estimateNumber")}</TableHead>
                <TableHead>{t("estimateTitle")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("issued")}</TableHead>
                <TableHead className="text-right pr-6">{t("total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((est: any) => (
                <TableRow key={est.id} className="cursor-pointer hover:bg-muted/40"
                  onClick={() => nav(`/estimates/${est.id}`)} data-testid={`row-estimate-${est.id}`}>
                  <TableCell className="pl-6 font-mono text-sm font-medium">{est.estimate_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">{est.title}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${EST_STATUS_CLS[est.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {est.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(est.issued_date)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold pr-6">{fmtMoney(est.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    <EstimateFormModal
      open={showNewEstimate}
      onClose={() => {
        setShowNewEstimate(false);
        qcEst.invalidateQueries({ queryKey: ["/api/estimates", "customer", customerId] });
      }}
      lockedCustomerId={customerId}
      lockedCustomerName={customerName}
    />
    </>
  );
}

// ── Pipeline stage badge helper ───────────────────────────────────────────────
const STAGE_COLOR: Record<string, string> = {
  new_lead: "bg-orange-100 text-orange-700",
  needs_review: "bg-amber-100 text-amber-700",
  qualified: "bg-blue-100 text-blue-700",
  appointment_scheduled: "bg-blue-100 text-blue-700",
  pre_visit_ready: "bg-sky-100 text-sky-700",
  site_visit_complete: "bg-indigo-100 text-indigo-700",
  estimate_in_progress: "bg-violet-100 text-violet-700",
  estimate_ready: "bg-purple-100 text-purple-700",
  estimate_sent: "bg-purple-100 text-purple-700",
  follow_up: "bg-amber-100 text-amber-700",
  sold_approved: "bg-green-100 text-green-700",
  lost_nurture: "bg-red-100 text-red-700",
  handoff_production: "bg-green-100 text-green-700",
  job_scheduled: "bg-teal-100 text-teal-700",
  in_progress: "bg-blue-100 text-blue-700",
  punch_list: "bg-yellow-100 text-yellow-700",
  complete: "bg-emerald-100 text-emerald-700",
  invoice_review: "bg-cyan-100 text-cyan-700",
  closed: "bg-gray-100 text-gray-600",
};

// ── Customer Consultations Tab ────────────────────────────────────────────────
function CustomerConsultationsTab({ customerId }: { customerId: string }) {
  const [, nav] = useLocation();
  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
  };
  const fmtMoney = (v: any) => v ? `$${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "—";

  const { data: consultations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/consultations", "customer", customerId],
    queryFn: () =>
      fetch(`/api/consultations?customer_id=${customerId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!customerId,
  });

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Consultations & Leads</CardTitle>
        <Button size="sm" variant="outline" className="text-xs h-7 px-2"
          onClick={() => nav("/consultations")} data-testid="btn-go-to-consultations">
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> View All
        </Button>
      </CardHeader>
      <CardContent className="pb-4 px-0">
        {consultations.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No consultations or leads on record</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Service Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right pr-6">Est. Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultations.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40"
                  data-testid={`row-consultation-${c.id}`}>
                  <TableCell className="pl-6 text-sm">{fmtDate(c.scheduled_date)}</TableCell>
                  <TableCell className="text-sm">{c.contact_name || c.customer_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.service_type || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[c.pipeline_stage] ?? "bg-gray-100 text-gray-600"}`}>
                      {(c.pipeline_stage ?? "—").replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium pr-6">{fmtMoney(c.estimated_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Customer Documents Tab ────────────────────────────────────────────────────
function CustomerDocumentsTab({ customerId }: { customerId: string }) {
  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
  };

  const { data: docs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "documents"],
    queryFn: () =>
      fetch(`/api/customers/${customerId}/documents`, { credentials: "include" }).then(r => r.json()),
    enabled: !!customerId,
  });

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-sm">Customer Documents</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">Documents shared with this customer via the portal</p>
      </CardHeader>
      <CardContent className="pb-4 px-0">
        {docs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No documents on file</p>
            <p className="text-xs mt-1 opacity-70">Documents are shared when the customer has a portal account</p>
          </div>
        ) : (
          <div className="divide-y">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 px-6 py-3" data-testid={`row-doc-${doc.id}`}>
                <div className="flex items-start gap-2.5 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">{doc.folder || "Other"}</Badge>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${doc.status === "Available" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {doc.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{fmtDate(doc.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0" data-testid={`link-doc-${doc.id}`}
                    onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Customer Messages Tab ─────────────────────────────────────────────────────
const MSG_STATUS_CLS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

function CustomerMessagesTab({ customerId }: { customerId: string }) {
  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(parseISO(d), "MMM d, yyyy 'at' h:mm a"); } catch { return d; }
  };

  const { data: threads = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "messages"],
    queryFn: () =>
      fetch(`/api/customers/${customerId}/messages`, { credentials: "include" }).then(r => r.json()),
    enabled: !!customerId,
  });

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-sm">Portal Messages</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">Messages sent through the customer portal</p>
      </CardHeader>
      <CardContent className="pb-4 px-0">
        {threads.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No portal messages found</p>
            <p className="text-xs mt-1 opacity-70">Messages appear here once the customer has a portal account and sends a message</p>
          </div>
        ) : (
          <div className="divide-y">
            {threads.map((thread: any) => (
              <div key={thread.id} className="px-6 py-3 flex items-start justify-between gap-3" data-testid={`row-thread-${thread.id}`}>
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${thread.unreadByEmployee ? "bg-blue-500" : "bg-transparent"}`} />
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${thread.unreadByEmployee ? "font-semibold" : "font-medium"}`}>{thread.subject}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${MSG_STATUS_CLS[thread.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {(thread.status ?? "open").replace(/_/g, " ")}
                      </span>
                      {thread.priority && thread.priority !== "normal" && (
                        <Badge variant="outline" className="text-xs capitalize">{thread.priority}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{fmtDate(thread.lastMessageAt)}</span>
                    </div>
                  </div>
                </div>
                {thread.unreadByEmployee && (
                  <Badge className="shrink-0 text-xs bg-blue-600 hover:bg-blue-600">New</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CustomerPhone { id: string; phone: string; phone_type: string | null; is_primary: boolean; }
interface CustomerEmail { id: string; email: string; email_type: string | null; is_primary: boolean; }
interface Property {
  id: string; address: string; city: string | null; state: string | null;
  zip: string | null; property_type: string | null; notes: string | null;
  access_notes: string | null; gate_code: string | null; has_pets: boolean | null;
  created_at?: string;
}
interface CustomerDetail {
  id: string; first_name: string; last_name: string; company_name: string | null;
  billing_address: string | null; billing_city: string | null; billing_state: string | null;
  billing_zip: string | null; source: string | null; notes: string | null;
  is_active: boolean; created_at: string;
  phones: CustomerPhone[]; emails: CustomerEmail[];
  contacts: any[]; properties: Property[];
  // Wave 2: CompanyCam project sync
  companycam_project_id: string | null;
  companycam_create_status: string | null;
  companycam_create_error: string | null;
}
interface Job {
  id: string; client: string; type: string; stage: string; category: string;
  value: number | null; scheduled_date: string | null; completion_date: string | null;
  created_at: string;
}
interface PropertyFormState {
  address: string; city: string; state: string; zip: string;
  property_type: string; notes: string;
  access_notes: string; gate_code: string; has_pets: boolean;
}
const EMPTY_PROP: PropertyFormState = { address: "", city: "", state: "", zip: "", property_type: "", notes: "", access_notes: "", gate_code: "", has_pets: false };
const PROP_TYPES = ["Residential", "Commercial", "HOA", "Municipal", "Other"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
function addrLine(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ");
}
function stageBadgeClass(stage: string) {
  const s = stage.toLowerCase();
  if (s === "complete" || s === "completed") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (s === "in progress") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (s === "sold") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
  if (s === "cancelled") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, sub, icon: Icon, color = "text-green-600" }:
  { title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Property Modal ─────────────────────────────────────────────────────────────
function PropertyModal({ open, onClose, customerId, editing, onSaved }:
  { open: boolean; onClose: () => void; customerId: string; editing: Property | null; onSaved: () => void }) {
  const { t } = useTranslation("customers");
  const { toast } = useToast();
  const [form, setForm] = useState<PropertyFormState>(EMPTY_PROP);

  React.useEffect(() => {
    if (open) {
      setForm(editing ? {
        address: editing.address, city: editing.city ?? "", state: editing.state ?? "",
        zip: editing.zip ?? "", property_type: editing.property_type ?? "", notes: editing.notes ?? "",
        access_notes: editing.access_notes ?? "", gate_code: editing.gate_code ?? "",
        has_pets: editing.has_pets ?? false,
      } : EMPTY_PROP);
    }
  }, [open, editing]);

  const set = (k: keyof PropertyFormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim()) { toast({ title: t("addressRequired"), variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/properties/${editing.id}` : `/api/customers/${customerId}/properties`;
      const method = editing ? "PUT" : "POST";
      const res = await apiRequest(method, url, form);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast({ title: editing ? t("propertyUpdated") : t("propertyAdded") });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("editProperty") : t("addProperty")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("streetAddress")} <span className="text-red-500">*</span></Label>
            <Input placeholder="123 Main St" value={form.address}
              onChange={(e) => set("address", e.target.value)} data-testid="input-prop-address" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label>{t("city")}</Label>
              <Input placeholder="Springfield" value={form.city}
                onChange={(e) => set("city", e.target.value)} data-testid="input-prop-city" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("state")}</Label>
              <Input placeholder="MA" value={form.state}
                onChange={(e) => set("state", e.target.value)} data-testid="input-prop-state" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("zip")}</Label>
              <Input placeholder="01001" value={form.zip}
                onChange={(e) => set("zip", e.target.value)} data-testid="input-prop-zip" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("propertyType")}</Label>
            <select value={form.property_type} onChange={(e) => set("property_type", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="select-prop-type">
              <option value="">{t("selectType")}</option>
              {PROP_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Textarea placeholder={t("propertyNotesPlaceholder")} value={form.notes}
              onChange={(e) => set("notes", e.target.value)} rows={2} data-testid="textarea-prop-notes" />
          </div>
          <div className="space-y-1.5">
            <Label>Access Notes</Label>
            <Textarea placeholder="e.g. Enter through back gate, code on keypad" value={form.access_notes}
              onChange={(e) => set("access_notes", e.target.value)} rows={2} data-testid="textarea-prop-access-notes" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Gate Code</Label>
              <Input placeholder="e.g. #1234" value={form.gate_code}
                onChange={(e) => set("gate_code", e.target.value)} data-testid="input-prop-gate-code" />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={form.has_pets}
                  onChange={(e) => setForm((f) => ({ ...f, has_pets: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                  data-testid="checkbox-prop-has-pets"
                />
                <span className="text-sm">Pets on property</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t("cancel")}</Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white"
              disabled={saving} data-testid="button-save-property">
              {saving ? t("saving") : editing ? t("saveChanges") : t("addProperty")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Follow-up Date Card ────────────────────────────────────────────────────────
function FollowUpDateCard({
  customerId,
  currentDate,
  isAdminOrManager,
}: {
  customerId: string;
  currentDate: string | null;
  isAdminOrManager: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dateVal, setDateVal] = useState(currentDate ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDateVal(currentDate ?? "");
  }, [currentDate]);

  const mut = useMutation({
    mutationFn: (date: string) =>
      fetch(`/api/customers/${customerId}/follow-up-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ next_follow_up_date: date || null }),
      }).then(r => { if (!r.ok) throw new Error("Save failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers", customerId] });
      qc.invalidateQueries({ queryKey: ["/api/follow-ups/overdue"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: "Follow-up date saved" });
    },
    onError: () => toast({ title: "Failed to save follow-up date", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-teal-500" />
          Next Follow-up Date
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isAdminOrManager ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="max-w-[180px] text-sm"
              value={dateVal}
              data-testid="input-customer-follow-up-date"
              onChange={e => setDateVal(e.target.value)}
              onBlur={e => { if (e.target.value !== (currentDate ?? "")) mut.mutate(e.target.value); }}
            />
            <Button
              size="sm"
              variant="outline"
              data-testid="btn-save-follow-up-date"
              disabled={mut.isPending}
              onClick={() => mut.mutate(dateVal)}
              className={saved ? "border-green-500 text-green-600" : ""}
            >
              {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {currentDate ? format(new Date(currentDate), "MMMM d, yyyy") : "Not set"}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          {currentDate ? (
            new Date(currentDate) < new Date(new Date().toDateString())
              ? <span className="text-amber-600 font-medium">Overdue — follow-up was {format(new Date(currentDate), "MMM d, yyyy")}</span>
              : `Follow-up scheduled for ${format(new Date(currentDate), "MMMM d, yyyy")}`
          ) : "No follow-up date set"}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { t } = useTranslation("customers");
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showEdit, setShowEdit] = useState(false);
  const [propModal, setPropModal] = useState<{ open: boolean; editing: Property | null }>({ open: false, editing: null });
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showInviteConfirm, setShowInviteConfirm] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [cannotArchiveBlockers, setCannotArchiveBlockers] = useState<Blocker[] | null>(null);
  const [mergeDialogDup, setMergeDialogDup] = useState<{ id: string; label: string } | null>(null);
  const [mergeKeep, setMergeKeep] = useState<"current" | "other">("current");

  // ── Queries ──
  const { data: customer, isLoading, isError } = useQuery<CustomerDetail>({
    queryKey: ["/api/customers", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers/${id}`);
      if (!res.ok) throw new Error("Customer not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/customers", id, "jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers/${id}/jobs`);
      return res.json();
    },
    enabled: !!id,
  });

  // A22: load this customer's invoices so the summary tiles can aggregate real numbers.
  const { data: customerInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices", "customer", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices?customer_id=${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json();
    },
    enabled: !!id,
  });

  // A27: duplicate detection — runs once per page load, results cached 5 min
  const { data: duplicates = [] } = useQuery<Array<{ id: string; label: string; matched_on: ("email" | "phone")[] }>>({
    queryKey: ["/api/customers", id, "duplicates"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers/${id}/duplicates`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!customer,
    staleTime: 5 * 60 * 1000,
  });

  // ── Active toggle ──
  const activeMutation = useMutation({
    mutationFn: async (is_active: boolean) => {
      const res = await apiRequest("PATCH", `/api/customers/${id}/active`, { is_active });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
    onError: () => toast({ title: t("couldNotUpdateStatus"), variant: "destructive" }),
  });

  // ── Archive / Unarchive ──
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/customers/${id}/archive`);
      if (!res.ok) throw new Error("Failed to archive");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer archived" });
    },
    onError: () => toast({ title: "Could not archive customer", variant: "destructive" }),
  });

  // Checks eligibility before showing the archive confirm dialog.
  async function handleArchiveClick() {
    setIsCheckingEligibility(true);
    try {
      const res = await apiRequest("GET", `/api/customers/${id}/archive-eligibility`);
      const data = await res.json();
      if (data.canArchive) {
        setShowArchiveConfirm(true);
      } else {
        setCannotArchiveBlockers(data.blockers ?? []);
      }
    } catch {
      // Network or unexpected error — fall through to the standard confirm dialog.
      setShowArchiveConfirm(true);
    } finally {
      setIsCheckingEligibility(false);
    }
  }

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/customers/${id}/unarchive`);
      if (!res.ok) throw new Error("Failed to unarchive");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer unarchived" });
    },
    onError: () => toast({ title: "Could not unarchive customer", variant: "destructive" }),
  });

  // ── Wave 2: CompanyCam project retry ──
  const retryCC = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/customers/${id}/retry-companycam-project`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || (err as any).message || "Retry failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      toast({ title: "CompanyCam project created successfully" });
    },
    onError: (e: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      toast({ title: "Retry failed: " + e.message, variant: "destructive" });
    },
  });

  // ── Portal Invite ──
  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/customers/${id}/portal-invite`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to generate invite link");
      }
      return res.json() as Promise<{ url: string; expires_at: string }>;
    },
    onSuccess: async (data) => {
      try {
        await navigator.clipboard.writeText(data.url);
        toast({ title: "Invite link copied to clipboard. Expires in 24h." });
      } catch {
        toast({ title: `Invite link: ${data.url}`, description: "Copy it manually." });
      }
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleInviteClick = () => {
    if (duplicates.length > 0) {
      setShowInviteConfirm(true);
    } else {
      inviteMutation.mutate();
    }
  };

  // ── A27: Duplicate banner actions (dismiss / merge) ──
  const [dismissingDupId, setDismissingDupId] = useState<string | null>(null);
  const dismissDupMutation = useMutation({
    mutationFn: async (dupId: string) => {
      const res = await apiRequest("POST", "/api/admin/customers/duplicate-pairs/dismiss", {
        customer_id_a: id, customer_id_b: dupId,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to dismiss");
      }
      return res.json();
    },
    onMutate: (dupId) => setDismissingDupId(dupId),
    onSuccess: () => {
      toast({ title: "Marked as not a duplicate" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id, "duplicates"] });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
    onSettled: () => setDismissingDupId(null),
  });

  const mergeDupMutation = useMutation({
    mutationFn: async ({ keepId, mergeId }: { keepId: string; mergeId: string }) => {
      const res = await apiRequest("POST", "/api/admin/customers/merge", { keep_id: keepId, merge_id: mergeId });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Merge failed");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Customers merged successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id, "duplicates"] });
      if (variables.mergeId === id) {
        // The current customer record was merged away — redirect to the surviving record.
        setLocation(`/customers/${variables.keepId}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      }
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const confirmMergeDup = () => {
    if (!mergeDialogDup) return;
    const keepId = mergeKeep === "current" ? (id as string) : mergeDialogDup.id;
    const mergeId = mergeKeep === "current" ? mergeDialogDup.id : (id as string);
    mergeDupMutation.mutate({ keepId, mergeId });
    setMergeDialogDup(null);
  };

  // ── Delete property ──
  const deleteProp = async (propId: string) => {
    if (!confirm(t("removePropertyConfirm"))) return;
    try {
      await apiRequest("DELETE", `/api/properties/${propId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      toast({ title: t("propertyRemoved") });
    } catch {
      toast({ title: t("failedToRemoveProperty"), variant: "destructive" });
    }
  };

  // ── Edit modal initial data ──
  const editInitialData = useMemo<CustomerFormData | undefined>(() => {
    if (!customer) return undefined;
    return {
      first_name: customer.first_name,
      last_name: customer.last_name,
      company_name: customer.company_name ?? "",
      source: customer.source ?? "",
      billing_address: customer.billing_address ?? "",
      billing_city: customer.billing_city ?? "",
      billing_state: customer.billing_state ?? "",
      billing_zip: customer.billing_zip ?? "",
      notes: customer.notes ?? "",
      phones: customer.phones.length > 0
        ? customer.phones.map((p) => ({ phone: p.phone, phone_type: p.phone_type ?? "Mobile", is_primary: p.is_primary }))
        : EMPTY_FORM.phones,
      emails: customer.emails.length > 0
        ? customer.emails.map((e) => ({ email: e.email, email_type: e.email_type ?? "Work", is_primary: e.is_primary }))
        : EMPTY_FORM.emails,
    };
  }, [customer]);

  // ── Stats ──
  // A22: real billed/outstanding sourced from invoices. Excludes voided.
  const hasEmail = (customer?.emails?.length ?? 0) > 0;
  const isAdminOrManager =
    user?.role === "Admin" || user?.role === "Manager" || !!(user as any)?.isMasterAdmin;

  const billableInvoices = customerInvoices.filter((inv: any) => inv.status !== "void");
  const totalBilled = billableInvoices.reduce((sum: number, inv: any) => sum + Number(inv.total ?? 0), 0);
  const totalOutstanding = billableInvoices.reduce((sum: number, inv: any) => sum + Math.max(0, Number(inv.balance_due ?? 0)), 0);
  const lastVisit = useMemo(() => {
    const dates = jobs
      .map((j) => j.completion_date || j.scheduled_date)
      .filter(Boolean)
      .sort()
      .reverse();
    return dates[0] ? format(new Date(dates[0]), "MMM d, yyyy") : "—";
  }, [jobs]);

  // ── Loading / error states ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("loadingCustomer")}
      </div>
    );
  }
  if (isError || !customer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/customers")} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("backToCustomers")}
        </Button>
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  const billingFull = [
    customer.billing_address,
    addrLine(customer.billing_city, customer.billing_state, customer.billing_zip),
  ].filter(Boolean).join("\n");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => setLocation("/customers")}
        className="-ml-2" data-testid="button-back-customers">
        <ChevronLeft className="h-4 w-4 mr-1" /> {t("backToCustomers")}
      </Button>

      {/* A27: Duplicate-customer warning banner */}
      {duplicates.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900"
          data-testid="banner-duplicate-customers"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
          <div className="flex-1 space-y-2">
            <span className="font-semibold">Possible duplicate {duplicates.length === 1 ? "record" : "records"} detected.</span>
            <div className="space-y-1.5">
              {duplicates.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/customers/${d.id}`}
                    className="underline underline-offset-2 font-medium hover:text-yellow-700"
                    data-testid={`link-duplicate-customer-${d.id}`}
                  >
                    {d.label}
                  </a>
                  <span className="text-yellow-700 text-xs">
                    ({d.matched_on.join(" & ")})
                  </span>
                  {isAdminOrManager && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs bg-white"
                        disabled={dismissingDupId === d.id}
                        onClick={() => dismissDupMutation.mutate(d.id)}
                        data-testid={`button-dismiss-duplicate-${d.id}`}
                      >
                        {dismissingDupId === d.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : null}
                        Not a duplicate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs bg-white"
                        onClick={() => { setMergeKeep("current"); setMergeDialogDup(d); }}
                        data-testid={`button-merge-duplicate-${d.id}`}
                      >
                        Merge
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* A27: Merge confirmation dialog for banner-initiated merges */}
      <Dialog open={!!mergeDialogDup} onOpenChange={(open) => { if (!open) setMergeDialogDup(null); }}>
        <DialogContent data-testid="dialog-merge-duplicate">
          <DialogHeader>
            <DialogTitle>Merge Duplicate Customer</DialogTitle>
            <DialogDescription>
              Choose which record to keep. All jobs, estimates, invoices, and other records linked to the
              other record will be reassigned, and the other record will be deactivated. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {mergeDialogDup && (
            <div className="space-y-2 py-2">
              <button
                type="button"
                onClick={() => setMergeKeep("current")}
                className={`w-full text-left rounded-lg border-2 p-3 text-sm transition-all ${
                  mergeKeep === "current" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
                data-testid="option-keep-current"
              >
                <div className="font-medium">Keep: {customer.company_name?.trim() || `${customer.first_name} ${customer.last_name}`}</div>
                <div className="text-xs text-muted-foreground">This record — {mergeDialogDup.label} will be merged into it</div>
              </button>
              <button
                type="button"
                onClick={() => setMergeKeep("other")}
                className={`w-full text-left rounded-lg border-2 p-3 text-sm transition-all ${
                  mergeKeep === "other" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
                data-testid="option-keep-other"
              >
                <div className="font-medium">Keep: {mergeDialogDup.label}</div>
                <div className="text-xs text-muted-foreground">This record will be merged into it</div>
              </button>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMergeDialogDup(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={mergeDupMutation.isPending}
              onClick={confirmMergeDup}
              data-testid="button-confirm-merge-duplicate"
            >
              {mergeDupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Yes, merge customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Two-column layout */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">

        {/* ── LEFT: Info Card ─────────────────────────────────────────────── */}
        <div className="w-full xl:w-[300px] shrink-0">
          <Card className="overflow-hidden">
            {/* Green header */}
            <div className="bg-gradient-to-br from-green-700 to-green-600 p-5 text-white">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg font-bold shrink-0">
                  {initials(customer.first_name, customer.last_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold leading-tight flex items-center gap-2 flex-wrap" data-testid="text-customer-name">
                    {customer.first_name} {customer.last_name}
                    {!customer.is_active && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-500/40 text-white/80 shrink-0"
                        data-testid="pill-archived"
                      >
                        Archived
                      </span>
                    )}
                  </h1>
                  {customer.company_name && (
                    <div className="flex items-center gap-1 mt-0.5 opacity-80">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="text-sm truncate">{customer.company_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {customer.source && (
                  <Badge className="bg-white/20 text-white border-0 text-xs" data-testid="badge-source">
                    {customer.source}
                  </Badge>
                )}
                {/* Wave 2: CompanyCam failure badge */}
                {customer.companycam_create_status === "failed" && isAdminOrManager && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => retryCC.mutate()}
                          disabled={retryCC.isPending}
                          data-testid="button-retry-companycam"
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/30 text-white hover:bg-red-400/40 transition-colors disabled:opacity-60"
                        >
                          {retryCC.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <AlertTriangle className="h-3 w-3" />}
                          CompanyCam: not connected · <span className="underline">Retry</span>
                        </button>
                      </TooltipTrigger>
                      {customer.companycam_create_error && (
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs">{customer.companycam_create_error}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
                <button
                  onClick={() => activeMutation.mutate(!customer.is_active)}
                  data-testid="toggle-active"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    customer.is_active
                      ? "bg-green-400/30 text-white hover:bg-red-400/30"
                      : "bg-red-400/30 text-white hover:bg-green-400/30"
                  }`}
                >
                  {customer.is_active
                    ? <><CheckCircle2 className="h-3 w-3" /> {t("active")}</>
                    : <><XCircle className="h-3 w-3" /> {t("inactive")}</>}
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary"
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => setShowEdit(true)} data-testid="button-edit-customer">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> {t("editCustomer")}
                  </Button>
                  {customer.is_active ? (
                    <Button size="sm" variant="secondary"
                      className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={handleArchiveClick}
                      disabled={archiveMutation.isPending || isCheckingEligibility}
                      data-testid="button-archive-customer">
                      {isCheckingEligibility
                        ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        : <Archive className="h-3.5 w-3.5 mr-1.5" />}
                      Archive
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary"
                      className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={() => unarchiveMutation.mutate()}
                      disabled={unarchiveMutation.isPending}
                      data-testid="button-unarchive-customer">
                      <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" /> Unarchive
                    </Button>
                  )}
                </div>
                {isAdminOrManager && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full bg-white/20 hover:bg-white/30 text-white border-0"
                            disabled={!hasEmail || inviteMutation.isPending}
                            onClick={handleInviteClick}
                            data-testid="button-portal-invite"
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1.5" />
                            {inviteMutation.isPending ? "Generating…" : "Send Portal Invite"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!hasEmail && (
                        <TooltipContent>
                          <p>Add an email first.</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Details */}
            <CardContent className="p-4 space-y-4">
              {/* Phones */}
              {customer.phones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("phone")}</p>
                  {customer.phones.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm" data-testid={`phone-${p.id}`}>
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={`tel:${p.phone}`} className="hover:underline flex-1">{p.phone}</a>
                      {p.phone_type && <span className="text-xs text-muted-foreground">{p.phone_type}</span>}
                      {p.is_primary && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Emails */}
              {customer.emails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("email")}</p>
                  {customer.emails.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-sm" data-testid={`email-${e.id}`}>
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={`mailto:${e.email}`} className="hover:underline flex-1 truncate">{e.email}</a>
                      {e.is_primary && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Billing Address */}
              {billingFull && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("billingAddress")}</p>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-muted-foreground whitespace-pre-line">{billingFull}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              {customer.notes && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("notes")}</p>
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="prose max-w-none text-xs leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: customer.notes || '' }} />
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {t("addedOn")} {format(new Date(customer.created_at), "MMMM d, yyyy")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Tabs ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="overview">
            <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-1 bg-muted p-1 rounded-lg">
              <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs" data-testid="tab-overview">
                <LayoutGrid className="h-3.5 w-3.5" /> {t("overview")}
              </TabsTrigger>
              <TabsTrigger value="properties" className="flex items-center gap-1.5 text-xs" data-testid="tab-properties">
                <Home className="h-3.5 w-3.5" /> {t("properties")}
                {customer.properties.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs px-1">
                    {customer.properties.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="jobs" className="flex items-center gap-1.5 text-xs" data-testid="tab-jobs">
                <Briefcase className="h-3.5 w-3.5" /> {t("jobs")}
                {jobs.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs px-1">{jobs.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="estimates" className="flex items-center gap-1.5 text-xs" data-testid="tab-estimates">
                <Calculator className="h-3.5 w-3.5" /> {t("estimates")}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-1.5 text-xs" data-testid="tab-invoices">
                <FileText className="h-3.5 w-3.5" /> {t("invoices")}
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-1.5 text-xs" data-testid="tab-payments">
                <DollarSign className="h-3.5 w-3.5" /> {t("payments")}
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1.5 text-xs" data-testid="tab-activity">
                <Clock className="h-3.5 w-3.5" /> {t("activity")}
              </TabsTrigger>
              <TabsTrigger value="consultations" className="flex items-center gap-1.5 text-xs" data-testid="tab-consultations">
                <ClipboardList className="h-3.5 w-3.5" /> Leads
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-1.5 text-xs" data-testid="tab-documents">
                <FolderOpen className="h-3.5 w-3.5" /> Docs
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-1.5 text-xs" data-testid="tab-messages">
                <MessageSquare className="h-3.5 w-3.5" /> Messages
              </TabsTrigger>
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title={t("totalJobs")} value={jobs.length}
                  sub={jobs.length === 1 ? "1 job linked" : `${jobs.length} jobs linked`}
                  icon={Briefcase} />
                <StatCard title={t("totalBilled")} value={`$${totalBilled.toLocaleString()}`}
                  sub="across all jobs" icon={DollarSign} color="text-blue-600" />
                <StatCard title={t("outstanding")} value={`$${totalOutstanding.toLocaleString()}`} sub={totalOutstanding > 0 ? "invoices outstanding" : "all paid"} icon={FileText} color={totalOutstanding > 0 ? "text-orange-500" : "text-green-600"} />
                <StatCard title={t("lastVisit")} value={lastVisit}
                  sub="most recent job date" icon={CalendarDays} color="text-purple-600" />
              </div>

              {/* Quick summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("quickSummary")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("propertiesOnFile")}</span>
                    <span className="font-medium">{customer.properties.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("contactNumbers")}</span>
                    <span className="font-medium">{customer.phones.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("emailAddresses")}</span>
                    <span className="font-medium">{customer.emails.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("source")}</span>
                    <span className="font-medium">{customer.source || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("customerSince")}</span>
                    <span className="font-medium">{format(new Date(customer.created_at), "MMMM yyyy")}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Next Follow-up Date */}
              <FollowUpDateCard customerId={customer.id} currentDate={(customer as any).next_follow_up_date ?? null} isAdminOrManager={isAdminOrManager} />

              {/* Recent jobs preview */}
              {jobs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">{t("recentJobs")}</CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs h-7"
                      onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="tab-jobs"]')?.click()}>
                      {t("viewAll")}
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {jobs.slice(0, 3).map((job) => (
                          <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setLocation(`/jobs/${job.id}`)}
                            data-testid={`row-job-${job.id}`}>
                            <TableCell className="py-2 font-medium text-sm">{job.client}</TableCell>
                            <TableCell className="py-2 text-sm text-muted-foreground">{job.type}</TableCell>
                            <TableCell className="py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageBadgeClass(job.stage)}`}>
                                {job.stage}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 text-sm text-right font-medium">
                              {job.value ? `$${job.value.toLocaleString()}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Properties ── */}
            <TabsContent value="properties" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">{t("properties")}</CardTitle>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setPropModal({ open: true, editing: null })}
                    data-testid="button-add-property">
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t("addProperty")}
                  </Button>
                </CardHeader>
                <CardContent>
                  {customer.properties.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Home className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{t("noProperties")}</p>
                      <Button variant="outline" size="sm" className="mt-3"
                        onClick={() => setPropModal({ open: true, editing: null })}>
                        {t("addFirstProperty")}
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {customer.properties.map((prop) => (
                        <div key={prop.id} className="py-3 flex items-start justify-between gap-3"
                          data-testid={`property-${prop.id}`}>
                          <div className="flex items-start gap-2.5 min-w-0">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{prop.address}</p>
                              {(prop.city || prop.state || prop.zip) && (
                                <p className="text-xs text-muted-foreground">
                                  {addrLine(prop.city, prop.state, prop.zip)}
                                </p>
                              )}
                              {prop.property_type && (
                                <Badge variant="outline" className="text-xs mt-1">{prop.property_type}</Badge>
                              )}
                              {prop.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">{prop.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => setPropModal({ open: true, editing: prop })}
                              data-testid={`button-edit-property-${prop.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                              onClick={() => deleteProp(prop.id)}
                              data-testid={`button-delete-property-${prop.id}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Jobs ── */}
            <TabsContent value="jobs" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("linkedJobs")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {jobs.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{t("noLinkedJobs")}</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("clientJob")}</TableHead>
                          <TableHead>{t("type")}</TableHead>
                          <TableHead>{t("stage")}</TableHead>
                          <TableHead>{t("date")}</TableHead>
                          <TableHead className="text-right">{t("value")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setLocation(`/jobs/${job.id}`)}
                            data-testid={`row-job-${job.id}`}>
                            <TableCell className="font-medium">{job.client}</TableCell>
                            <TableCell className="text-muted-foreground">{job.type}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageBadgeClass(job.stage)}`}>
                                {job.stage}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {job.scheduled_date
                                ? format(new Date(job.scheduled_date), "MMM d, yyyy")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {job.value ? `$${job.value.toLocaleString()}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Estimates ── */}
            <TabsContent value="estimates" className="mt-4">
              <CustomerEstimatesTab
                customerId={customer.id}
                customerName={`${customer.first_name} ${customer.last_name}${customer.company_name ? ` (${customer.company_name})` : ""}`}
              />
            </TabsContent>

            {/* ── Invoices ── */}
            <TabsContent value="invoices" className="mt-4">
              <CustomerInvoicesTab customerId={customer.id} />
            </TabsContent>

            {/* ── Payments (placeholder) ── */}
            <TabsContent value="payments" className="mt-4">
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">{t("paymentHistoryComingSoon")}</p>
                  <p className="text-xs mt-1 opacity-70">{t("paymentTrackingDesc")}</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Activity ── */}
            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("activityLog")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative space-y-0">
                    {/* Customer created */}
                    <ActivityItem
                      date={customer.created_at}
                      icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                      label={t("activityCustomerCreated")}
                    />
                    {/* Properties added */}
                    {customer.properties.map((prop) => (
                      <ActivityItem
                        key={prop.id}
                        date={prop.created_at ?? customer.created_at}
                        icon={<Home className="h-3.5 w-3.5 text-blue-500" />}
                        label={`${t("activityPropertyAdded")} ${prop.address}`}
                      />
                    ))}
                    {/* Jobs */}
                    {jobs.map((job) => (
                      <ActivityItem
                        key={job.id}
                        date={job.created_at}
                        icon={<Briefcase className="h-3.5 w-3.5 text-purple-500" />}
                        label={`${t("activityJobLinked")} ${job.client} — ${job.type} (${job.stage})`}
                        onClick={() => setLocation(`/jobs/${job.id}`)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Consultations / Leads ── */}
            <TabsContent value="consultations" className="mt-4">
              <CustomerConsultationsTab customerId={id ?? ""} />
            </TabsContent>

            {/* ── Documents ── */}
            <TabsContent value="documents" className="mt-4">
              <CustomerDocumentsTab customerId={id ?? ""} />
            </TabsContent>

            {/* ── Portal Messages ── */}
            <TabsContent value="messages" className="mt-4">
              <CustomerMessagesTab customerId={id ?? ""} />
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Archive confirm dialog */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive {customer?.first_name} {customer?.last_name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This hides them from the active list. You can unarchive later.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}
              data-testid="button-cancel-archive">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={archiveMutation.isPending}
              data-testid="button-confirm-archive"
              onClick={() => { setShowArchiveConfirm(false); archiveMutation.mutate(); }}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cannot-archive blocker dialog */}
      {cannotArchiveBlockers !== null && (
        <CannotArchiveDialog
          open={cannotArchiveBlockers !== null}
          onOpenChange={(open) => { if (!open) setCannotArchiveBlockers(null); }}
          customerName={`${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim()}
          customerId={id ?? ""}
          blockers={cannotArchiveBlockers}
        />
      )}

      {/* Portal invite — duplicate-gate confirmation dialog */}
      <Dialog open={showInviteConfirm} onOpenChange={setShowInviteConfirm}>
        <DialogContent className="max-w-sm" data-testid="dialog-invite-confirm">
          <DialogHeader>
            <DialogTitle>Send Portal Invite?</DialogTitle>
            <DialogDescription>
              This customer shares email or phone with{" "}
              {duplicates.length} other record{duplicates.length === 1 ? "" : "s"}:
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 my-1 list-disc list-inside text-muted-foreground">
            {duplicates.map((d) => (
              <li key={d.id} data-testid={`invite-dupe-label-${d.id}`}>{d.label}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            The invite link binds to <span className="font-semibold text-foreground">this record only</span>.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowInviteConfirm(false)}
              data-testid="button-cancel-invite">
              Cancel
            </Button>
            <Button
              disabled={inviteMutation.isPending}
              data-testid="button-confirm-invite"
              onClick={() => { setShowInviteConfirm(false); inviteMutation.mutate(); }}
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> Send to this customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <CustomerFormModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        editing={customer ? { id: customer.id } : null}
        initialData={editInitialData}
        onAfterSave={() => queryClient.invalidateQueries({ queryKey: ["/api/customers", id] })}
      />

      <PropertyModal
        open={propModal.open}
        onClose={() => setPropModal({ open: false, editing: null })}
        customerId={id!}
        editing={propModal.editing}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/customers", id] })}
      />
    </div>
  );
}

// ── Activity Item ─────────────────────────────────────────────────────────────
function ActivityItem({ date, icon, label, onClick }:
  { date: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div className={`flex items-start gap-3 py-3 border-b last:border-0 ${onClick ? "cursor-pointer hover:bg-muted/30 -mx-4 px-4 rounded" : ""}`}
      onClick={onClick} data-testid="activity-item">
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(date), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </div>
  );
}
