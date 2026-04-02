import React, { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, Phone, Mail, MapPin, Building2, FileText, Star,
  Loader2, Pencil, Plus, Trash2, CheckCircle2, XCircle,
  Briefcase, DollarSign, CalendarDays, Clock, Home, LayoutGrid,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { CustomerFormModal, CustomerFormData, EMPTY_FORM } from "./CustomerFormModal";

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
        <CardTitle className="text-sm">Invoices</CardTitle>
        <Button size="sm" variant="outline" onClick={() => nav("/invoices")} className="text-xs h-7 px-2">
          <Plus className="h-3.5 w-3.5 mr-1" /> New Invoice
        </Button>
      </CardHeader>
      <CardContent className="pb-4 px-0">
        {invoices.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No invoices yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Invoice #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right pr-6">Balance</TableHead>
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface CustomerPhone { id: string; phone: string; phone_type: string | null; is_primary: boolean; }
interface CustomerEmail { id: string; email: string; email_type: string | null; is_primary: boolean; }
interface Property {
  id: string; address: string; city: string | null; state: string | null;
  zip: string | null; property_type: string | null; notes: string | null;
  created_at?: string;
}
interface CustomerDetail {
  id: string; first_name: string; last_name: string; company_name: string | null;
  billing_address: string | null; billing_city: string | null; billing_state: string | null;
  billing_zip: string | null; source: string | null; notes: string | null;
  is_active: boolean; created_at: string;
  phones: CustomerPhone[]; emails: CustomerEmail[];
  contacts: any[]; properties: Property[];
}
interface Job {
  id: string; client: string; type: string; stage: string; category: string;
  value: number | null; scheduled_date: string | null; completion_date: string | null;
  created_at: string;
}
interface PropertyFormState {
  address: string; city: string; state: string; zip: string;
  property_type: string; notes: string;
}
const EMPTY_PROP: PropertyFormState = { address: "", city: "", state: "", zip: "", property_type: "", notes: "" };
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
  const { toast } = useToast();
  const [form, setForm] = useState<PropertyFormState>(EMPTY_PROP);

  React.useEffect(() => {
    if (open) {
      setForm(editing ? {
        address: editing.address, city: editing.city ?? "", state: editing.state ?? "",
        zip: editing.zip ?? "", property_type: editing.property_type ?? "", notes: editing.notes ?? "",
      } : EMPTY_PROP);
    }
  }, [open, editing]);

  const set = (k: keyof PropertyFormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim()) { toast({ title: "Address is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/properties/${editing.id}` : `/api/customers/${customerId}/properties`;
      const method = editing ? "PUT" : "POST";
      const res = await apiRequest(method, url, form);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast({ title: editing ? "Property updated" : "Property added" });
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
          <DialogTitle>{editing ? "Edit Property" : "Add Property"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Street Address <span className="text-red-500">*</span></Label>
            <Input placeholder="123 Main St" value={form.address}
              onChange={(e) => set("address", e.target.value)} data-testid="input-prop-address" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label>City</Label>
              <Input placeholder="Springfield" value={form.city}
                onChange={(e) => set("city", e.target.value)} data-testid="input-prop-city" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input placeholder="MA" value={form.state}
                onChange={(e) => set("state", e.target.value)} data-testid="input-prop-state" />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP</Label>
              <Input placeholder="01001" value={form.zip}
                onChange={(e) => set("zip", e.target.value)} data-testid="input-prop-zip" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Property Type</Label>
            <select value={form.property_type} onChange={(e) => set("property_type", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="select-prop-type">
              <option value="">Select type…</option>
              {PROP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Any notes about this property…" value={form.notes}
              onChange={(e) => set("notes", e.target.value)} rows={2} data-testid="textarea-prop-notes" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white"
              disabled={saving} data-testid="button-save-property">
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [propModal, setPropModal] = useState<{ open: boolean; editing: Property | null }>({ open: false, editing: null });

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

  // ── Active toggle ──
  const activeMutation = useMutation({
    mutationFn: async (is_active: boolean) => {
      const res = await apiRequest("PATCH", `/api/customers/${id}/active`, { is_active });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
    onError: () => toast({ title: "Could not update status", variant: "destructive" }),
  });

  // ── Delete property ──
  const deleteProp = async (propId: string) => {
    if (!confirm("Remove this property?")) return;
    try {
      await apiRequest("DELETE", `/api/properties/${propId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      toast({ title: "Property removed" });
    } catch {
      toast({ title: "Failed to remove property", variant: "destructive" });
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
  const totalBilled = jobs.reduce((sum, j) => sum + (j.value ?? 0), 0);
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
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading customer…
      </div>
    );
  }
  if (isError || !customer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/customers")} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Customers
        </Button>
        <p className="text-muted-foreground">Customer not found.</p>
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
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Customers
      </Button>

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
                  <h1 className="text-lg font-bold leading-tight" data-testid="text-customer-name">
                    {customer.first_name} {customer.last_name}
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
                    ? <><CheckCircle2 className="h-3 w-3" /> Active</>
                    : <><XCircle className="h-3 w-3" /> Inactive</>}
                </button>
              </div>

              <Button size="sm" variant="secondary"
                className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setShowEdit(true)} data-testid="button-edit-customer">
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Customer
              </Button>
            </div>

            {/* Details */}
            <CardContent className="p-4 space-y-4">
              {/* Phones */}
              {customer.phones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing Address</p>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-muted-foreground text-xs leading-relaxed">{customer.notes}</p>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Added {format(new Date(customer.created_at), "MMMM d, yyyy")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Tabs ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="overview">
            <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-1 bg-muted p-1 rounded-lg">
              <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs" data-testid="tab-overview">
                <LayoutGrid className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="properties" className="flex items-center gap-1.5 text-xs" data-testid="tab-properties">
                <Home className="h-3.5 w-3.5" /> Properties
                {customer.properties.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs px-1">
                    {customer.properties.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="jobs" className="flex items-center gap-1.5 text-xs" data-testid="tab-jobs">
                <Briefcase className="h-3.5 w-3.5" /> Jobs
                {jobs.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs px-1">{jobs.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-1.5 text-xs" data-testid="tab-invoices">
                <FileText className="h-3.5 w-3.5" /> Invoices
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-1.5 text-xs" data-testid="tab-payments">
                <DollarSign className="h-3.5 w-3.5" /> Payments
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1.5 text-xs" data-testid="tab-activity">
                <Clock className="h-3.5 w-3.5" /> Activity
              </TabsTrigger>
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Total Jobs" value={jobs.length}
                  sub={jobs.length === 1 ? "1 job linked" : `${jobs.length} jobs linked`}
                  icon={Briefcase} />
                <StatCard title="Total Billed" value={`$${totalBilled.toLocaleString()}`}
                  sub="across all jobs" icon={DollarSign} color="text-blue-600" />
                <StatCard title="Outstanding" value="$0"
                  sub="invoices coming soon" icon={FileText} color="text-orange-500" />
                <StatCard title="Last Visit" value={lastVisit}
                  sub="most recent job date" icon={CalendarDays} color="text-purple-600" />
              </div>

              {/* Quick summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Quick Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Properties on file</span>
                    <span className="font-medium">{customer.properties.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contact numbers</span>
                    <span className="font-medium">{customer.phones.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email addresses</span>
                    <span className="font-medium">{customer.emails.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead source</span>
                    <span className="font-medium">{customer.source || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer since</span>
                    <span className="font-medium">{format(new Date(customer.created_at), "MMMM yyyy")}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Recent jobs preview */}
              {jobs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Recent Jobs</CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs h-7"
                      onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="tab-jobs"]')?.click()}>
                      View all
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
                  <CardTitle className="text-base">Properties</CardTitle>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setPropModal({ open: true, editing: null })}
                    data-testid="button-add-property">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Property
                  </Button>
                </CardHeader>
                <CardContent>
                  {customer.properties.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Home className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No properties on file yet.</p>
                      <Button variant="outline" size="sm" className="mt-3"
                        onClick={() => setPropModal({ open: true, editing: null })}>
                        Add First Property
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
                  <CardTitle className="text-base">Linked Jobs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {jobs.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No jobs linked to this customer yet.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client / Job</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Value</TableHead>
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

            {/* ── Invoices ── */}
            <TabsContent value="invoices" className="mt-4">
              <CustomerInvoicesTab customerId={customer.id} />
            </TabsContent>

            {/* ── Payments (placeholder) ── */}
            <TabsContent value="payments" className="mt-4">
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Payment History Coming Soon</p>
                  <p className="text-xs mt-1 opacity-70">Payment tracking will be available once invoicing is set up.</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Activity ── */}
            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Activity Log</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative space-y-0">
                    {/* Customer created */}
                    <ActivityItem
                      date={customer.created_at}
                      icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                      label="Customer record created"
                    />
                    {/* Properties added */}
                    {customer.properties.map((prop) => (
                      <ActivityItem
                        key={prop.id}
                        date={prop.created_at ?? customer.created_at}
                        icon={<Home className="h-3.5 w-3.5 text-blue-500" />}
                        label={`Property added: ${prop.address}`}
                      />
                    ))}
                    {/* Jobs */}
                    {jobs.map((job) => (
                      <ActivityItem
                        key={job.id}
                        date={job.created_at}
                        icon={<Briefcase className="h-3.5 w-3.5 text-purple-500" />}
                        label={`Job linked: ${job.client} — ${job.type} (${job.stage})`}
                        onClick={() => setLocation(`/jobs/${job.id}`)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

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
