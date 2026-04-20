import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, CalendarClock, DollarSign, CheckCircle, XCircle,
  Loader2, Search, ExternalLink, Filter,
} from "lucide-react";

type Status = "scheduled" | "completed" | "cancelled" | "no_show";

interface Consultation {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number;
  status: Status;
  address: string | null;
  notes: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  estimated_value: number | null;
  lead_source: string | null;
  created_at: string;
}

interface Stats {
  total_scheduled: number;
  completed_this_month: number;
  no_shows: number;
  pipeline_value: number;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  phone?: string;
  email?: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

const STATUS_CLS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed:  "bg-green-100 text-green-700",
  cancelled:  "bg-gray-100 text-gray-600",
  no_show:    "bg-red-100 text-red-600",
};

const LEAD_SOURCES = [
  "Website", "Referral", "Google", "Social Media",
  "Door Hanger", "Direct Mail", "Existing Customer", "Other",
];

const DURATIONS = [30, 45, 60, 90, 120];

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${suffix}`;
}

function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation("consultations");
  const labels: Record<string, string> = {
    scheduled: t("statusScheduled"),
    completed:  t("statusCompleted"),
    cancelled:  t("statusCancelled"),
    no_show:    t("statusNoShow"),
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[status] ?? "bg-muted"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function emptyForm() {
  return {
    customer_id:        "",
    contact_name:       "",
    contact_phone:      "",
    contact_email:      "",
    scheduled_date:     "",
    scheduled_time:     "09:00",
    duration_minutes:   60,
    status:             "scheduled" as Status,
    address:            "",
    notes:              "",
    follow_up_required: false,
    follow_up_date:     "",
    assigned_to:        "",
    estimated_value:    "",
    lead_source:        "",
  };
}

function ConsultationModal({
  open, onClose, editing, customers, employees,
}: {
  open: boolean;
  onClose: () => void;
  editing: Consultation | null;
  customers: Customer[];
  employees: Employee[];
}) {
  const { t } = useTranslation("consultations");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [form, setForm] = useState(emptyForm());
  const [custSearch, setCustSearch] = useState("");
  const [custDropOpen, setCustDropOpen] = useState(false);

  const statusOptions: { value: Status; label: string }[] = [
    { value: "scheduled", label: t("statusScheduled") },
    { value: "completed", label: t("statusCompleted") },
    { value: "cancelled", label: t("statusCancelled") },
    { value: "no_show",   label: t("statusNoShow") },
  ];

  useMemo(() => {
    if (open) {
      if (editing) {
        setForm({
          customer_id:        editing.customer_id ?? "",
          contact_name:       editing.contact_name ?? "",
          contact_phone:      editing.contact_phone ?? "",
          contact_email:      editing.contact_email ?? "",
          scheduled_date:     editing.scheduled_date ?? "",
          scheduled_time:     editing.scheduled_time?.slice(0, 5) ?? "09:00",
          duration_minutes:   editing.duration_minutes ?? 60,
          status:             editing.status,
          address:            editing.address ?? "",
          notes:              editing.notes ?? "",
          follow_up_required: editing.follow_up_required ?? false,
          follow_up_date:     editing.follow_up_date ?? "",
          assigned_to:        editing.assigned_to ?? "",
          estimated_value:    editing.estimated_value != null ? String(editing.estimated_value) : "",
          lead_source:        editing.lead_source ?? "",
        });
        setCustSearch(editing.customer_name ?? "");
      } else {
        setForm(emptyForm());
        setCustSearch("");
      }
    }
  }, [open, editing?.id]);

  const f = (k: keyof ReturnType<typeof emptyForm>, v: any) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const filteredCustomers = useMemo(() =>
    customers.filter(c => {
      const full = `${c.first_name} ${c.last_name} ${c.company_name ?? ""}`.toLowerCase();
      return full.includes(custSearch.toLowerCase());
    }).slice(0, 10),
    [customers, custSearch]
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/consultations"] });
    qc.invalidateQueries({ queryKey: ["/api/consultations/stats"] });
  };

  const createMut = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/consultations", d),
    onSuccess: () => { toast({ title: t("consultationCreated") }); invalidate(); onClose(); },
    onError: (e: any) => toast({ title: t("error", { ns: "common" }), description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => apiRequest("PATCH", `/api/consultations/${editing?.id}`, d),
    onSuccess: () => { toast({ title: t("consultationUpdated") }); invalidate(); onClose(); },
    onError: (e: any) => toast({ title: t("error", { ns: "common" }), description: e.message, variant: "destructive" }),
  });

  function handleSave() {
    const payload = {
      ...form,
      customer_id:      form.customer_id || null,
      assigned_to:      form.assigned_to || null,
      estimated_value:  form.estimated_value ? parseFloat(form.estimated_value) : null,
      follow_up_date:   form.follow_up_date || null,
      lead_source:      form.lead_source || null,
    };
    if (editing) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  const isBusy = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            {editing ? t("editConsultation") : t("newConsultation")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Customer */}
          <div className="space-y-1 relative">
            <Label>{t("customerName")}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={t("searchPlaceholder")}
                value={custSearch}
                data-testid="input-cust-search"
                onChange={e => { setCustSearch(e.target.value); setCustDropOpen(true); if (!e.target.value) f("customer_id", ""); }}
                onFocus={() => setCustDropOpen(true)}
              />
            </div>
            {custDropOpen && custSearch && filteredCustomers.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button key={c.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    data-testid={`cust-option-${c.id}`}
                    onClick={() => {
                      f("customer_id", c.id);
                      setCustSearch(c.company_name || `${c.first_name} ${c.last_name}`);
                      setCustDropOpen(false);
                    }}>
                    <span className="font-medium">{c.company_name || `${c.first_name} ${c.last_name}`}</span>
                    {c.company_name && <span className="text-muted-foreground ml-2 text-xs">{c.first_name} {c.last_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("contactName")}</Label>
              <Input placeholder="Jane Smith" data-testid="input-contact-name"
                value={form.contact_name} onChange={e => f("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("contactPhone")}</Label>
              <Input type="tel" placeholder="(555) 000-0000" data-testid="input-contact-phone"
                value={form.contact_phone} onChange={e => f("contact_phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("contactEmail")}</Label>
              <Input type="email" placeholder="jane@example.com" data-testid="input-contact-email"
                value={form.contact_email} onChange={e => f("contact_email", e.target.value)} />
            </div>
          </div>

          {/* Date / Time / Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("scheduledDate")}</Label>
              <Input type="date" data-testid="input-consult-date"
                value={form.scheduled_date} onChange={e => f("scheduled_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("scheduledTime")}</Label>
              <Input type="time" data-testid="input-consult-time"
                value={form.scheduled_time} onChange={e => f("scheduled_time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("duration")}</Label>
              <Select value={String(form.duration_minutes)}
                onValueChange={v => f("duration_minutes", Number(v))}>
                <SelectTrigger data-testid="select-duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status / Lead Source / Estimated Value */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("status", { ns: "common" })}</Label>
              <Select value={form.status} onValueChange={v => f("status", v as Status)}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("leadSource")}</Label>
              <Select value={form.lead_source || "_none"} onValueChange={v => f("lead_source", v === "_none" ? "" : v)}>
                <SelectTrigger data-testid="select-lead-source"><SelectValue placeholder={t("select", { ns: "common" })} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("none")}</SelectItem>
                  {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("estimatedValue")} ($)</Label>
              <Input type="number" min="0" step="100" placeholder="0" data-testid="input-est-value"
                value={form.estimated_value} onChange={e => f("estimated_value", e.target.value)} />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <Label>{t("address")}</Label>
            <Input placeholder="123 Main St, City, State" data-testid="input-address"
              value={form.address} onChange={e => f("address", e.target.value)} />
          </div>

          {/* Assigned To */}
          <div className="space-y-1">
            <Label>{t("assignedTo")}</Label>
            <Select value={form.assigned_to || "_none"}
              onValueChange={v => f("assigned_to", v === "_none" ? "" : v)}>
              <SelectTrigger data-testid="select-assigned"><SelectValue placeholder={t("unassigned")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t("unassigned")}</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>{t("notes")}</Label>
            <Textarea rows={3} placeholder="Details about the site visit, scope, special requests…"
              data-testid="input-notes"
              value={form.notes} onChange={e => f("notes", e.target.value)} />
          </div>

          {/* Follow-up */}
          <div className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 pt-0.5">
              <Switch checked={form.follow_up_required}
                data-testid="switch-followup"
                onCheckedChange={v => f("follow_up_required", v)} />
              <Label className="cursor-pointer">{t("followUpRequired")}</Label>
            </div>
            {form.follow_up_required && (
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t("followUpDate")}</Label>
                <Input type="date" className="max-w-xs" data-testid="input-followup-date"
                  value={form.follow_up_date} onChange={e => f("follow_up_date", e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {editing && (
            <Button variant="outline" className="mr-auto"
              data-testid="btn-convert-estimate"
              onClick={() => {
                onClose();
                navigate(`/estimates?customer_id=${editing.customer_id ?? ""}`);
              }}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("convertToEstimate")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t("cancel", { ns: "common" })}</Button>
          <Button onClick={handleSave} disabled={isBusy} data-testid="btn-save-consultation">
            {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? t("saveChanges") : t("createConsultation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Consultations() {
  const { t } = useTranslation("consultations");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter,    setStatusFilter]    = useState("");
  const [dateFrom,        setDateFrom]        = useState("");
  const [dateTo,          setDateTo]          = useState("");
  const [assignedFilter,  setAssignedFilter]  = useState("");
  const [searchText,      setSearchText]      = useState("");

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Consultation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Consultation | null>(null);

  const statusOptions: { value: Status; label: string }[] = [
    { value: "scheduled", label: t("statusScheduled") },
    { value: "completed", label: t("statusCompleted") },
    { value: "cancelled", label: t("statusCancelled") },
    { value: "no_show",   label: t("statusNoShow") },
  ];

  const listParams = new URLSearchParams();
  if (statusFilter)   listParams.set("status",      statusFilter);
  if (dateFrom)       listParams.set("date_from",   dateFrom);
  if (dateTo)         listParams.set("date_to",     dateTo);
  if (assignedFilter) listParams.set("assigned_to", assignedFilter);
  if (searchText)     listParams.set("search",      searchText);

  const { data: consultations = [], isLoading } = useQuery<Consultation[]>({
    queryKey: ["/api/consultations", statusFilter, dateFrom, dateTo, assignedFilter, searchText],
    queryFn: () => fetch(`/api/consultations?${listParams}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/consultations/stats"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: () => fetch("/api/customers?limit=500", { credentials: "include" }).then(r => r.json()),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/scheduling/employees"],
    queryFn: () => fetch("/api/scheduling/employees", { credentials: "include" }).then(r => r.json()),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/consultations/${id}`),
    onSuccess: () => {
      toast({ title: t("consultationDeleted") });
      qc.invalidateQueries({ queryKey: ["/api/consultations"] });
      qc.invalidateQueries({ queryKey: ["/api/consultations/stats"] });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: t("deleteFailed"), variant: "destructive" }),
  });

  function openNew() { setEditing(null); setModalOpen(true); }
  function openEdit(c: Consultation) { setEditing(c); setModalOpen(true); }

  const clearFilters = () => {
    setStatusFilter(""); setDateFrom(""); setDateTo("");
    setAssignedFilter(""); setSearchText("");
  };
  const hasFilters = statusFilter || dateFrom || dateTo || assignedFilter || searchText;

  return (
    <div className="flex flex-col h-full" data-testid="consultations-page">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> {t("title")}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("subtitle")}</p>
        </div>
        <Button onClick={openNew} data-testid="btn-new-consultation">
          <Plus className="h-4 w-4 mr-2" /> {t("newConsultation")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="stat-card-scheduled">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("totalScheduled")}</p>
                    <p className="text-2xl font-bold mt-1">{stats?.total_scheduled ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("upcoming")}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-card-completed">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("completedThisMonth")}</p>
                    <p className="text-2xl font-bold mt-1">{stats?.completed_this_month ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("thisMonth")}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-100 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-card-noshows">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("noShows")}</p>
                    <p className="text-2xl font-bold mt-1">{stats?.no_shows ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("allTime")}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-100 text-red-600">
                    <XCircle className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-card-pipeline">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("pipelineValue")}</p>
                    <p className="text-2xl font-bold mt-1">{fmt$(stats?.pipeline_value ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("fromScheduled")}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg border bg-muted/20">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7 h-8 text-sm w-44" placeholder={t("searchPlaceholder")}
                value={searchText} onChange={e => setSearchText(e.target.value)}
                data-testid="filter-search" />
            </div>

            <Select value={statusFilter || "_all"} onValueChange={v => setStatusFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm w-36" data-testid="filter-status">
                <SelectValue placeholder={t("allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("allStatuses")}</SelectItem>
                {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Input type="date" className="h-8 text-sm w-36" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)} data-testid="filter-date-from" />
              <span className="text-muted-foreground text-xs">–</span>
              <Input type="date" className="h-8 text-sm w-36" value={dateTo}
                onChange={e => setDateTo(e.target.value)} data-testid="filter-date-to" />
            </div>

            <Select value={assignedFilter || "_all"}
              onValueChange={v => setAssignedFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm w-40" data-testid="filter-assigned">
                <SelectValue placeholder={t("allAssignees")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("allAssignees")}</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}
                data-testid="btn-clear-filters">
                {t("clear")}
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {consultations.length}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : consultations.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-sm">{t("noConsultations")}</p>
                <p className="text-xs mt-1">
                  {hasFilters ? t("adjustFilters") : t("newConsultation")}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="consultations-table">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-36">{t("dateTime")}</TableHead>
                      <TableHead>{t("customerName")}</TableHead>
                      <TableHead>{t("contact")}</TableHead>
                      <TableHead>{t("address")}</TableHead>
                      <TableHead className="w-28">{t("status", { ns: "common" })}</TableHead>
                      <TableHead>{t("assignedTo")}</TableHead>
                      <TableHead className="w-24 text-right">{t("estValue")}</TableHead>
                      <TableHead className="w-20 text-right">{t("actions", { ns: "common" })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consultations.map(c => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => openEdit(c)}
                        data-testid={`consultation-row-${c.id}`}
                      >
                        <TableCell className="text-xs">
                          <div className="font-medium">{fmtDate(c.scheduled_date)}</div>
                          {c.scheduled_time && (
                            <div className="text-muted-foreground">{fmtTime(c.scheduled_time)}</div>
                          )}
                          {c.duration_minutes && (
                            <div className="text-muted-foreground">{c.duration_minutes} min</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{c.customer_name ?? "—"}</div>
                          {c.lead_source && (
                            <div className="text-xs text-muted-foreground">{c.lead_source}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.contact_name && <div className="font-medium">{c.contact_name}</div>}
                          {c.contact_phone && <div className="text-muted-foreground">{c.contact_phone}</div>}
                          {c.contact_email && <div className="text-muted-foreground truncate max-w-[160px]">{c.contact_email}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {c.address ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                          {c.follow_up_required && (
                            <div className="text-[10px] text-amber-600 mt-0.5">
                              {t("followUpLabel")} {c.follow_up_date ? fmtDate(c.follow_up_date) : t("followUpNeeded")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.assigned_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {fmt$(c.estimated_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex justify-end gap-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => openEdit(c)}
                              data-testid={`btn-edit-${c.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(c)}
                              data-testid={`btn-delete-${c.id}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConsultationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        customers={customers}
        employees={employees}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConsultation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDesc")}
              {deleteTarget?.customer_name ? ` ${deleteTarget.customer_name}` : ""} —{" "}
              {deleteTarget ? fmtDate(deleteTarget.scheduled_date) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", { ns: "common" })}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              data-testid="btn-confirm-delete"
            >
              {t("delete", { ns: "common" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
