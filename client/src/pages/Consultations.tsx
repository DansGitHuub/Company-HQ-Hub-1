import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Loader2, Search, ExternalLink, Filter, LayoutGrid, List, Clock, Image as ImageIcon,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
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
  pipeline_stage: string | null;
  budget_range: string | null;
  project_description: string | null;
  best_time_to_reach: string | null;
  utilities_marked: boolean;
  permit_required: boolean;
  permit_status: string | null;
  service_type: string | null;
  lost_reason: string | null;
  desired_timeline: string | null;
  photo_urls: string[] | null;
  created_at: string;
}

interface Stats {
  total_scheduled: number;
  completed_this_month: number;
  no_shows: number;
  pipeline_value: number;
}

interface Customer { id: string; first_name: string; last_name: string; company_name: string | null; }
interface Employee { id: string; first_name: string; last_name: string; }
interface ServiceType { id: string; name: string; category: string; is_active: boolean; }

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUSES: { value: Status; label: string; cls: string }[] = [
  { value: "scheduled",  label: "Scheduled",  cls: "bg-blue-100 text-blue-700" },
  { value: "completed",  label: "Completed",  cls: "bg-green-100 text-green-700" },
  { value: "cancelled",  label: "Cancelled",  cls: "bg-gray-100 text-gray-600" },
  { value: "no_show",    label: "No Show",    cls: "bg-red-100 text-red-600" },
];

const LEAD_SOURCES = [
  "Website", "Referral", "Google", "Social Media",
  "Door Hanger", "Direct Mail", "Existing Customer", "Other",
];

const DURATIONS = [30, 45, 60, 90, 120];

const BUDGET_RANGES = [
  "$1k-$5k", "$5k-$15k", "$15k-$30k", "$30k-$60k", "$60k+", "Not Sure",
];

const BEST_TIMES = ["Morning", "Afternoon", "Evening", "Anytime"];

const PERMIT_STATUSES = ["Not Required", "Pending", "Applied", "Approved", "Denied"];

export const PIPELINE_STAGES: { value: string; label: string; color: string; bg: string; group: string }[] = [
  { value: "new_lead",            label: "New Lead",            color: "text-orange-700", bg: "bg-orange-50 border-orange-200", group: "new" },
  { value: "needs_review",        label: "Needs Review",        color: "text-orange-600", bg: "bg-orange-50 border-orange-200", group: "new" },
  { value: "qualified",           label: "Qualified",           color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",   group: "qualified" },
  { value: "appointment_scheduled",label: "Appt. Scheduled",   color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",   group: "qualified" },
  { value: "pre_visit_ready",     label: "Pre-Visit Ready",     color: "text-blue-500",   bg: "bg-blue-50 border-blue-200",   group: "qualified" },
  { value: "site_visit_complete", label: "Site Visit Done",     color: "text-purple-700", bg: "bg-purple-50 border-purple-200", group: "estimate" },
  { value: "estimate_in_progress",label: "Estimate In Progress",color: "text-purple-600", bg: "bg-purple-50 border-purple-200", group: "estimate" },
  { value: "estimate_ready",      label: "Estimate Ready",      color: "text-purple-600", bg: "bg-purple-50 border-purple-200", group: "estimate" },
  { value: "estimate_sent",       label: "Estimate Sent",       color: "text-purple-500", bg: "bg-purple-50 border-purple-200", group: "estimate" },
  { value: "follow_up",           label: "Follow Up",           color: "text-purple-500", bg: "bg-purple-50 border-purple-200", group: "estimate" },
  { value: "sold_approved",       label: "Sold / Approved",     color: "text-green-700",  bg: "bg-green-50 border-green-200",  group: "sold" },
  { value: "lost_nurture",        label: "Lost / Nurture",      color: "text-red-600",    bg: "bg-red-50 border-red-200",     group: "lost" },
  { value: "handoff_production",  label: "Handoff to Production",color: "text-green-600", bg: "bg-green-50 border-green-200",  group: "sold" },
  { value: "job_scheduled",       label: "Job Scheduled",       color: "text-green-600",  bg: "bg-green-50 border-green-200",  group: "sold" },
  { value: "in_progress",         label: "In Progress",         color: "text-green-600",  bg: "bg-green-50 border-green-200",  group: "sold" },
  { value: "punch_list",          label: "Punch List",          color: "text-green-600",  bg: "bg-green-50 border-green-200",  group: "sold" },
  { value: "complete",            label: "Complete",            color: "text-green-700",  bg: "bg-green-50 border-green-200",  group: "complete" },
  { value: "invoice_review",      label: "Invoice Review",      color: "text-green-700",  bg: "bg-green-50 border-green-200",  group: "complete" },
  { value: "closed",              label: "Closed",              color: "text-green-800",  bg: "bg-green-50 border-green-200",  group: "complete" },
];

function getStageMeta(value: string) {
  return PIPELINE_STAGES.find(s => s.value === value) || PIPELINE_STAGES[0];
}

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const s = STATUSES.find(s => s.value === status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s?.cls ?? "bg-muted"}`}>
      {s?.label ?? status}
    </span>
  );
}

function StageBadge({ stage }: { stage: string | null }) {
  const s = getStageMeta(stage || "new_lead");
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  );
}

// ─── Empty form ────────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    customer_id:         "",
    contact_name:        "",
    contact_phone:       "",
    contact_email:       "",
    scheduled_date:      "",
    scheduled_time:      "09:00",
    duration_minutes:    60,
    status:              "scheduled" as Status,
    address:             "",
    notes:               "",
    follow_up_required:  false,
    follow_up_date:      "",
    next_follow_up_date: "",
    assigned_to:         "",
    estimated_value:     "",
    lead_source:         "",
    pipeline_stage:      "new_lead",
    budget_range:        "",
    project_description: "",
    best_time_to_reach:  "",
    utilities_marked:    false,
    permit_required:     false,
    permit_status:       "",
    service_type:        "",
    lost_reason:         "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Consultation Form Modal
// ═══════════════════════════════════════════════════════════════════════════════
function ConsultationModal({
  open, onClose, editing, customers, employees, serviceTypes,
}: {
  open: boolean;
  onClose: () => void;
  editing: Consultation | null;
  customers: Customer[];
  employees: Employee[];
  serviceTypes: ServiceType[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [form, setForm] = useState(emptyForm());
  const [custSearch, setCustSearch] = useState("");
  const [custDropOpen, setCustDropOpen] = useState(false);

  useMemo(() => {
    if (open) {
      if (editing) {
        setForm({
          customer_id:         editing.customer_id ?? "",
          contact_name:        editing.contact_name ?? "",
          contact_phone:       editing.contact_phone ?? "",
          contact_email:       editing.contact_email ?? "",
          scheduled_date:      editing.scheduled_date ?? "",
          scheduled_time:      editing.scheduled_time?.slice(0, 5) ?? "09:00",
          duration_minutes:    editing.duration_minutes ?? 60,
          status:              editing.status,
          address:             editing.address ?? "",
          notes:               editing.notes ?? "",
          follow_up_required:  editing.follow_up_required ?? false,
          follow_up_date:      editing.follow_up_date ?? "",
          next_follow_up_date: (editing as any).next_follow_up_date ?? "",
          assigned_to:         editing.assigned_to ?? "",
          estimated_value:     editing.estimated_value != null ? String(editing.estimated_value) : "",
          lead_source:         editing.lead_source ?? "",
          pipeline_stage:      editing.pipeline_stage ?? "new_lead",
          budget_range:        editing.budget_range ?? "",
          project_description: editing.project_description ?? "",
          best_time_to_reach:  editing.best_time_to_reach ?? "",
          utilities_marked:    editing.utilities_marked ?? false,
          permit_required:     editing.permit_required ?? false,
          permit_status:       editing.permit_status ?? "",
          service_type:        editing.service_type ?? "",
          lost_reason:         editing.lost_reason ?? "",
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
    onSuccess: () => { toast({ title: "Consultation created" }); invalidate(); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => apiRequest("PATCH", `/api/consultations/${editing?.id}`, d),
    onSuccess: () => { toast({ title: "Consultation updated" }); invalidate(); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // A20: actually create a draft estimate from this consultation, then navigate to it.
  const convertMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/consultations/${editing?.id}/convert-to-estimate`, {}).then(r => r.json()),
    onSuccess: (newEstimate: any) => {
      toast({ title: "Estimate created", description: newEstimate?.estimate_number ? `Created ${newEstimate.estimate_number}` : undefined });
      invalidate();
      onClose();
      navigate(`/estimates/${newEstimate.id}`);
    },
    onError: (e: any) => toast({ title: "Could not convert", description: e.message, variant: "destructive" }),
  });

  function handleSave() {
    const payload = {
      ...form,
      customer_id:     form.customer_id || null,
      assigned_to:     form.assigned_to || null,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      follow_up_date:      form.follow_up_date || null,
      next_follow_up_date: (form as any).next_follow_up_date || null,
      lead_source:     form.lead_source || null,
      budget_range:    form.budget_range || null,
      permit_status:   form.permit_status || null,
      service_type:    form.service_type || null,
      best_time_to_reach: form.best_time_to_reach || null,
      lost_reason: (form as any).lost_reason || null,
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
            {editing ? "Edit Consultation" : "New Consultation"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Pipeline Stage */}
          <div className="space-y-1">
            <Label>Pipeline Stage</Label>
            <Select value={form.pipeline_stage} onValueChange={v => f("pipeline_stage", v)}>
              <SelectTrigger data-testid="select-pipeline-stage"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="space-y-1 relative">
            <Label>Customer</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search customers…"
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
              <Label>Contact Name</Label>
              <Input placeholder="Jane Smith" data-testid="input-contact-name"
                value={form.contact_name} onChange={e => f("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Contact Phone</Label>
              <Input type="tel" placeholder="(555) 000-0000" data-testid="input-contact-phone"
                value={form.contact_phone} onChange={e => f("contact_phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Contact Email</Label>
              <Input type="email" placeholder="jane@example.com" data-testid="input-contact-email"
                value={form.contact_email} onChange={e => f("contact_email", e.target.value)} />
            </div>
          </div>

          {/* Service Type & Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Service Type</Label>
              <Select value={form.service_type || "_none"} onValueChange={v => f("service_type", v === "_none" ? "" : v)}>
                <SelectTrigger data-testid="select-service-type"><SelectValue placeholder="Select service type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Not specified —</SelectItem>
                  {serviceTypes.map(st => <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Budget Range</Label>
              <Select value={form.budget_range || "_none"} onValueChange={v => f("budget_range", v === "_none" ? "" : v)}>
                <SelectTrigger data-testid="select-budget-range"><SelectValue placeholder="Select budget" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Not specified —</SelectItem>
                  {BUDGET_RANGES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* From Customer (inquiry) — read-only callout */}
          {editing && (editing.desired_timeline || (editing.photo_urls && editing.photo_urls.length > 0)) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                📋 From Customer (inquiry submission)
              </div>
              {editing.desired_timeline && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Timeline:</span>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                    {editing.desired_timeline}
                  </span>
                </div>
              )}
              {editing.photo_urls && editing.photo_urls.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Photos ({editing.photo_urls.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editing.photo_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`inquiry-photo-${i}`}
                      >
                        <img
                          src={url}
                          alt={`Inquiry photo ${i + 1}`}
                          className="h-16 w-16 object-cover rounded border border-blue-200 hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date / Time / Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" data-testid="input-consult-date"
                value={form.scheduled_date} onChange={e => f("scheduled_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Time</Label>
              <Input type="time" data-testid="input-consult-time"
                value={form.scheduled_time} onChange={e => f("scheduled_time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Duration</Label>
              <Select value={String(form.duration_minutes)} onValueChange={v => f("duration_minutes", Number(v))}>
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => f("status", v as Status)}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Lead Source</Label>
              <Select value={form.lead_source || "_none"} onValueChange={v => f("lead_source", v === "_none" ? "" : v)}>
                <SelectTrigger data-testid="select-lead-source"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estimated Value ($)</Label>
              <Input type="number" min="0" step="100" placeholder="0" data-testid="input-est-value"
                value={form.estimated_value} onChange={e => f("estimated_value", e.target.value)} />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <Label>Address / Location</Label>
            <Input placeholder="123 Main St, City, State" data-testid="input-address"
              value={form.address} onChange={e => f("address", e.target.value)} />
          </div>

          {/* Assigned To & Best Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Assigned To</Label>
              <Select value={form.assigned_to || "_none"} onValueChange={v => f("assigned_to", v === "_none" ? "" : v)}>
                <SelectTrigger data-testid="select-assigned"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Unassigned</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Best Time to Reach</Label>
              <Select value={form.best_time_to_reach || "_none"} onValueChange={v => f("best_time_to_reach", v === "_none" ? "" : v)}>
                <SelectTrigger data-testid="select-best-time"><SelectValue placeholder="Select time" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Not specified —</SelectItem>
                  {BEST_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project Description */}
          <div className="space-y-1">
            <Label>Project Description</Label>
            <Textarea rows={3} placeholder="Describe the project scope…"
              data-testid="input-project-description"
              value={form.project_description} onChange={e => f("project_description", e.target.value)} />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Internal Notes</Label>
            <Textarea rows={2} placeholder="Internal notes…"
              data-testid="input-notes"
              value={form.notes} onChange={e => f("notes", e.target.value)} />
          </div>

          {/* Utilities / Permit */}
          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-2">
              <Switch checked={form.utilities_marked}
                data-testid="switch-utilities"
                onCheckedChange={v => f("utilities_marked", v)} />
              <Label className="cursor-pointer text-sm">Utilities Marked (811)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.permit_required}
                data-testid="switch-permit"
                onCheckedChange={v => f("permit_required", v)} />
              <Label className="cursor-pointer text-sm">Permit Required</Label>
            </div>
            {form.permit_required && (
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Permit Status</Label>
                <Select value={form.permit_status || "_none"} onValueChange={v => f("permit_status", v === "_none" ? "" : v)}>
                  <SelectTrigger data-testid="select-permit-status"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Not set —</SelectItem>
                    {PERMIT_STATUSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Follow-up */}
          <div className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 pt-0.5">
              <Switch checked={form.follow_up_required}
                data-testid="switch-followup"
                onCheckedChange={v => f("follow_up_required", v)} />
              <Label className="cursor-pointer">Follow-up Required</Label>
            </div>
            {form.follow_up_required && (
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Follow-up Date</Label>
                <Input type="date" className="max-w-xs" data-testid="input-followup-date"
                  value={form.follow_up_date} onChange={e => f("follow_up_date", e.target.value)} />
              </div>
            )}
          </div>

          {/* Next Follow-up Date (CRM) */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Next Follow-up Date</Label>
            <Input type="date" className="max-w-xs" data-testid="input-next-followup-date"
              value={(form as any).next_follow_up_date ?? ""}
              onChange={e => f("next_follow_up_date" as any, e.target.value)} />
            <p className="text-xs text-muted-foreground">Set to track when this lead needs a follow-up call or email. Overdue dates appear on the Overdue page.</p>
          </div>

          {/* Lost Reason — show when stage is "lost" group or reason already set */}
          {(PIPELINE_STAGES.find(s => s.value === form.pipeline_stage)?.group === "lost" || (form as any).lost_reason) && (
            <div className="space-y-1.5 p-3 rounded-lg border border-red-200 bg-red-50">
              <Label className="text-xs font-semibold text-red-700">Lost Reason</Label>
              <Textarea
                value={(form as any).lost_reason ?? ""}
                onChange={e => f("lost_reason" as any, e.target.value)}
                rows={2}
                placeholder="Why was this lead lost or marked for nurture?"
                className="resize-none bg-white border-red-200 text-sm"
                data-testid="input-lost-reason"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {editing && (
            <Button variant="outline" className="mr-auto"
              data-testid="btn-convert-estimate"
              disabled={convertMut.isPending}
              onClick={() => {
                if (!editing?.customer_id) {
                  toast({ title: "Link a customer first", description: "Pick a customer in the Customer field, save, then convert.", variant: "destructive" });
                  return;
                }
                convertMut.mutate();
              }}>
              {convertMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Convert to Estimate
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isBusy} data-testid="btn-save-consultation">
            {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Save Changes" : "Create Consultation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lead Source Stats Bar ────────────────────────────────────────────────────
// ─── Lead Settings Modal ────────────────────────────────────────────────────
function LeadSettingsModal({
  open, onClose, employees,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"none" | "specific" | "round_robin">("none");
  const [defaultAssignee, setDefaultAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery<{ mode: string; default_assignee: string }>({
    queryKey: ["/api/settings/lead-assignment"],
    queryFn: () => fetch("/api/settings/lead-assignment", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  useEffect(() => {
    if (settings) {
      setMode((settings.mode as "none" | "specific" | "round_robin") || "none");
      setDefaultAssignee(settings.default_assignee || "");
    }
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/settings/lead-assignment", {
        mode,
        default_assignee: defaultAssignee || "",
      });
      toast({ title: "Lead assignment settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/settings/lead-assignment"] });
      onClose();
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="lead-settings-modal">
        <DialogHeader>
          <DialogTitle>Lead Auto-Assignment Settings</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Assignment Mode</Label>
              <Select value={mode} onValueChange={v => setMode(v as "none" | "specific" | "round_robin")}>
                <SelectTrigger data-testid="select-assign-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Off — assign manually</SelectItem>
                  <SelectItem value="specific">Specific person — always assign the same person</SelectItem>
                  <SelectItem value="round_robin">Round robin — rotate among all active managers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "specific" && (
              <div className="space-y-1.5">
                <Label>Default Assignee</Label>
                <Select value={defaultAssignee || "_none"} onValueChange={v => setDefaultAssignee(v === "_none" ? "" : v)}>
                  <SelectTrigger data-testid="select-default-assignee">
                    <SelectValue placeholder="Select a person…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="btn-save-lead-settings">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceStatsBar() {
  const { data } = useQuery<{ source: string; count: number }[]>({
    queryKey: ["/api/consultations/source-stats"],
    queryFn: () => fetch("/api/consultations/source-stats", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  const total = data.reduce((s, r) => s + r.count, 0);

  return (
    <div className="p-3 rounded-lg border bg-card text-xs" data-testid="source-stats-bar">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Lead Sources
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
        {data.map(row => (
          <div key={row.source} className="flex items-center gap-2 min-w-[140px]">
            <span className="w-24 truncate font-medium text-foreground">{row.source || "Unknown"}</span>
            <div className="flex-1 min-w-[60px] bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.round((row.count / total) * 100)}%` }}
              />
            </div>
            <span className="text-muted-foreground tabular-nums">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Kanban View
// ═══════════════════════════════════════════════════════════════════════════════
function KanbanView({
  consultations, onEdit, updateStage,
}: {
  consultations: Consultation[];
  onEdit: (c: Consultation) => void;
  updateStage: (id: string, stage: string) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, Consultation[]> = {};
    PIPELINE_STAGES.forEach(s => { map[s.value] = []; });
    consultations.forEach(c => {
      const stage = c.pipeline_stage || "new_lead";
      if (map[stage]) map[stage].push(c);
    });
    return map;
  }, [consultations]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]" data-testid="kanban-view">
      {PIPELINE_STAGES.map(stage => {
        const cards = grouped[stage.value] || [];
        return (
          <div
            key={stage.value}
            className="flex-shrink-0 w-56 flex flex-col"
          >
            <div className={`px-3 py-2 rounded-t-lg border border-b-0 ${stage.bg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${stage.bg} ${stage.color} border ${stage.bg.replace("bg-", "border-")}`}>
                  {cards.length}
                </span>
              </div>
            </div>
            <div className={`flex-1 rounded-b-lg border ${stage.bg} p-2 space-y-2 min-h-[200px]`}>
              {cards.map(c => (
                <div
                  key={c.id}
                  className="bg-background rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow text-xs"
                  onClick={() => onEdit(c)}
                  data-testid={`kanban-card-${c.id}`}
                >
                  <div className="font-semibold text-sm truncate">
                    {c.customer_name || c.contact_name || "Unknown"}
                  </div>
                  {c.service_type && (
                    <div className="text-muted-foreground mt-0.5 truncate">{c.service_type}</div>
                  )}
                  {c.budget_range && (
                    <div className="text-muted-foreground mt-0.5">{c.budget_range}</div>
                  )}
                  {c.scheduled_date && (
                    <div className="text-muted-foreground mt-1">{fmtDate(c.scheduled_date)}</div>
                  )}
                  {c.assigned_name && (
                    <div className="mt-1 pt-1 border-t text-muted-foreground truncate">{c.assigned_name}</div>
                  )}
                  {!c.assigned_to && (
                    <div className="mt-1 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5" data-testid={`badge-unassigned-${c.id}`}>
                      ⚠ Unassigned
                    </div>
                  )}
                  {c.follow_up_required && c.follow_up_date && c.follow_up_date < new Date().toISOString().slice(0, 10) && (
                    <div className="mt-0.5 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5" data-testid={`badge-overdue-followup-${c.id}`}>
                      ⚠ Follow-up overdue
                    </div>
                  )}
                  {c.lost_reason && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground italic truncate" data-testid={`text-lost-reason-${c.id}`}>
                      &ldquo;{c.lost_reason}&rdquo;
                    </div>
                  )}
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {PIPELINE_STAGES.filter(s => s.value !== (c.pipeline_stage || "new_lead")).slice(0, 3).map(s => (
                      <button
                        key={s.value}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${s.bg} ${s.color} hover:opacity-80`}
                        onClick={e => { e.stopPropagation(); updateStage(c.id, s.value); }}
                        data-testid={`move-to-${s.value}-${c.id}`}
                      >
                        → {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function Consultations() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [statusFilter,    setStatusFilter]    = useState("");
  const [dateFrom,        setDateFrom]        = useState("");
  const [dateTo,          setDateTo]          = useState("");
  const [assignedFilter,  setAssignedFilter]  = useState("");
  const [searchText,      setSearchText]      = useState("");
  const [unassignedOnly,  setUnassignedOnly]  = useState(false);
  const [overdueFollowup, setOverdueFollowup] = useState(false);

  const [modalOpen,         setModalOpen]         = useState(false);
  const [editing,           setEditing]           = useState<Consultation | null>(null);
  const [deleteTarget,      setDeleteTarget]       = useState<Consultation | null>(null);
  const [lostReasonTarget,  setLostReasonTarget]  = useState<{ id: string; stage: string } | null>(null);
  const [lostReasonInput,   setLostReasonInput]   = useState("");
  const [showLeadSettings,  setShowLeadSettings]  = useState(false);

  const listParams = new URLSearchParams();
  if (statusFilter)   listParams.set("status",      statusFilter);
  if (dateFrom)       listParams.set("date_from",   dateFrom);
  if (dateTo)         listParams.set("date_to",     dateTo);
  if (assignedFilter) listParams.set("assigned_to", assignedFilter);
  if (searchText)     listParams.set("search",      searchText);
  if (unassignedOnly)  listParams.set("unassigned_only", "true");
  if (overdueFollowup) listParams.set("overdue_followup", "true");

  const { data: consultations = [], isLoading } = useQuery<Consultation[]>({
    queryKey: ["/api/consultations", statusFilter, dateFrom, dateTo, assignedFilter, searchText, unassignedOnly, overdueFollowup],
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

  const { data: serviceTypes = [] } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types/active"],
    queryFn: () => fetch("/api/service-types/active").then(r => r.json()),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/consultations/${id}`),
    onSuccess: () => {
      toast({ title: "Consultation deleted" });
      qc.invalidateQueries({ queryKey: ["/api/consultations"] });
      qc.invalidateQueries({ queryKey: ["/api/consultations/stats"] });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const stageMut = useMutation({
    mutationFn: ({ id, stage, lostReason }: { id: string; stage: string; lostReason?: string }) =>
      apiRequest("PATCH", `/api/consultations/${id}`, {
        pipeline_stage: stage,
        ...(lostReason !== undefined ? { lost_reason: lostReason } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/consultations"] });
      qc.invalidateQueries({ queryKey: ["/api/consultations/source-stats"] });
    },
    onError: (e: any) => toast({ title: "Stage update failed", description: e.message, variant: "destructive" }),
  });

  function handleUpdateStage(id: string, stage: string) {
    const stageObj = PIPELINE_STAGES.find(s => s.value === stage);
    if (stageObj?.group === "lost") {
      setLostReasonInput("");
      setLostReasonTarget({ id, stage });
      return;
    }
    stageMut.mutate({ id, stage });
  }

  function openNew() { setEditing(null); setModalOpen(true); }
  function openEdit(c: Consultation) { setEditing(c); setModalOpen(true); }

  const clearFilters = () => {
    setStatusFilter(""); setDateFrom(""); setDateTo("");
    setAssignedFilter(""); setSearchText("");
    setUnassignedOnly(false); setOverdueFollowup(false);
  };
  const hasFilters = !!(statusFilter || dateFrom || dateTo || assignedFilter || searchText || unassignedOnly || overdueFollowup);

  return (
    <div className="flex flex-col h-full" data-testid="consultations-page">
      {/* ── Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Consultations
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track site visits and sales consultations before estimates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setViewMode("list")}
              data-testid="btn-list-view"
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setViewMode("kanban")}
              data-testid="btn-kanban-view"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
            </button>
          </div>
          {user?.role === "Admin" && (
            <Button variant="outline" size="sm" onClick={() => setShowLeadSettings(true)} data-testid="btn-lead-settings">
              ⚙ Lead Settings
            </Button>
          )}
          <Button onClick={openNew} data-testid="btn-new-consultation">
            <Plus className="h-4 w-4 mr-2" /> New Consultation
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* ── Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="stat-card-scheduled">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Scheduled</p>
                    <p className="text-2xl font-bold mt-1">{stats?.total_scheduled ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">upcoming</p>
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed This Month</p>
                    <p className="text-2xl font-bold mt-1">{stats?.completed_this_month ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">this month</p>
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">No Shows</p>
                    <p className="text-2xl font-bold mt-1">{stats?.no_shows ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">all time</p>
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Est. Pipeline Value</p>
                    <p className="text-2xl font-bold mt-1">{fmt$(stats?.pipeline_value ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">from scheduled</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Lead Source Breakdown */}
          <SourceStatsBar />

          {/* ── Filter Bar */}
          <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg border bg-muted/20">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7 h-8 text-sm w-44" placeholder="Search…"
                value={searchText} onChange={e => setSearchText(e.target.value)}
                data-testid="filter-search" />
            </div>
            <Select value={statusFilter || "_all"} onValueChange={v => setStatusFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm w-36" data-testid="filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input type="date" className="h-8 text-sm w-36" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)} data-testid="filter-date-from" />
              <span className="text-muted-foreground text-xs">–</span>
              <Input type="date" className="h-8 text-sm w-36" value={dateTo}
                onChange={e => setDateTo(e.target.value)} data-testid="filter-date-to" />
            </div>
            <Select value={assignedFilter || "_all"} onValueChange={v => setAssignedFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm w-40" data-testid="filter-assigned">
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Assignees</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={unassignedOnly ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setUnassignedOnly(v => !v)}
              data-testid="btn-filter-unassigned"
            >
              ⚠ Unassigned
            </Button>
            <Button
              variant={overdueFollowup ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setOverdueFollowup(v => !v)}
              data-testid="btn-filter-overdue"
            >
              🔴 Overdue Follow-up
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}
                data-testid="btn-clear-filters">Clear</Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {consultations.length} result{consultations.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* ── Views */}
          {viewMode === "kanban" ? (
            <KanbanView
              consultations={consultations}
              onEdit={openEdit}
              updateStage={handleUpdateStage}
            />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : consultations.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-sm">No consultations found</p>
                  <p className="text-xs mt-1">
                    {hasFilters ? "Try adjusting your filters" : "Click \"New Consultation\" to schedule one"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="consultations-table">
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-36">Date / Time</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Service / Budget</TableHead>
                        <TableHead className="w-28">Pipeline Stage</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="w-24 text-right">Est. Value</TableHead>
                        <TableHead className="w-20 text-right">Actions</TableHead>
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
                            {c.scheduled_time && <div className="text-muted-foreground">{fmtTime(c.scheduled_time)}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{c.customer_name ?? "—"}</div>
                            {c.lead_source && <div className="text-xs text-muted-foreground">{c.lead_source}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {c.contact_name && <div className="font-medium">{c.contact_name}</div>}
                            {c.contact_phone && <div className="text-muted-foreground">{c.contact_phone}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {c.service_type && <div className="font-medium">{c.service_type}</div>}
                            {c.budget_range && <div className="text-muted-foreground">{c.budget_range}</div>}
                          </TableCell>
                          <TableCell>
                            <StageBadge stage={c.pipeline_stage} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={c.status} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">
                            {fmt$(c.estimated_value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => openEdit(c)} data-testid={`btn-edit-${c.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(c)} data-testid={`btn-delete-${c.id}`}>
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
          )}
        </div>
      </div>

      {/* ── Modals */}
      <ConsultationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        customers={customers}
        employees={employees}
        serviceTypes={serviceTypes}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Consultation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this consultation? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Lead Settings Modal */}
      <LeadSettingsModal
        open={showLeadSettings}
        onClose={() => setShowLeadSettings(false)}
        employees={employees}
      />

      {/* ── Lost Reason Dialog */}
      <AlertDialog open={!!lostReasonTarget} onOpenChange={o => { if (!o) setLostReasonTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Lost / Nurture</AlertDialogTitle>
            <AlertDialogDescription>
              Optionally capture why this lead was lost to help improve future follow-up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Textarea
              value={lostReasonInput}
              onChange={e => setLostReasonInput(e.target.value)}
              placeholder="e.g. Budget too high, went with competitor…"
              rows={3}
              className="resize-none"
              data-testid="input-lost-reason-dialog"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLostReasonTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!lostReasonTarget) return;
                stageMut.mutate({
                  id: lostReasonTarget.id,
                  stage: lostReasonTarget.stage,
                  lostReason: lostReasonInput.trim() || undefined,
                });
                setLostReasonTarget(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
