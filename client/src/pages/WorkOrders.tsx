import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Plus, Search, ClipboardList, Camera, Trash2, MoreHorizontal,
  Edit2, X, Loader2, FileText, CheckSquare, Boxes, Clock, Image as ImageIcon,
  BookOpen, ChevronDown, ChevronRight, Wrench, HardHat, MapPin, Phone,
  User, Calendar, DollarSign, AlertTriangle, CheckCircle2, Circle,
  Package, Shield, Leaf, Zap, Snowflake, Settings,
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

type WOStatus   = "draft" | "ready" | "in_progress" | "on_hold" | "complete";
type WOType     = "maintenance_visit" | "landscape_project" | "hardscape_project" | "service_call" | "snow_ice" | "internal_shop";
type WOPriority = "low" | "normal" | "high" | "urgent";
type MatStatus  = "needed" | "loaded" | "used";

interface WorkOrder {
  id: number;
  job_id: string | null;
  job_title: string | null;
  title: string;
  description: string | null;
  status: WOStatus;
  wo_type: WOType;
  priority: WOPriority;
  scheduled_date: string | null;
  estimated_completion_date: string | null;
  estimated_hours: number | null;
  office_notes: string | null;
  property_notes: string | null;
  site_access_notes: string | null;
  safety_notes: string | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_phone: string | null;
  contract_value: string | null;
  companycam_project_id: string | null;
  service_type_id: string | null;
  service_type_name: string | null;
  crew_leader_id: string | null;
  crew_leader_name: string | null;
  assigned_crew: { id: number; name: string }[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_tasks?: number;
  complete_tasks?: number;
  total_areas?: number;
  total_materials?: number;
  areas?: Area[];
  wo_materials?: Material[];
  wo_tools?: Tool[];
  wo_checklist?: ChecklistItem[];
  steps?: any[];
  daily_logs?: DailyLog[];
  time_entries?: TimeEntry[];
  companycam_photos?: CcPhoto[];
  closeout_ready_at?: string | null;
}

interface Area {
  id: number;
  work_order_id: number;
  name: string;
  description: string | null;
  estimated_hours: number | null;
  sort_order: number;
  tasks: Task[];
  materials: Material[];
  tools: Tool[];
  checklist: ChecklistItem[];
  hold_points: HoldPoint[];
}

interface Task {
  id: number;
  area_id: number;
  title: string;
  description: string | null;
  is_complete: boolean;
  completed_by: string | null;
  completed_at: string | null;
  requires_photo: boolean;
  photos: { url: string; uploaded_at: string }[];
  sort_order: number;
}

interface Material {
  id: number;
  work_order_id: number;
  area_id: number | null;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  status: MatStatus;
  notes: string | null;
  catalog_name: string | null;
}

interface Tool {
  id: number;
  work_order_id: number;
  area_id: number | null;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  status: MatStatus;
  notes: string | null;
}

interface ChecklistItem {
  id: number;
  area_id: number | null;
  label: string;
  is_complete: boolean;
  completed_by: string | null;
  sort_order: number;
}

interface HoldPoint {
  id: number;
  area_id: number | null;
  label: string;
  description: string | null;
  is_approved: boolean;
  approved_by: string | null;
  sort_order: number;
}

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  entry_type: string;
  notes: string | null;
  username: string;
  first_name: string | null;
  last_name: string | null;
}

interface CcPhoto {
  id: string;
  companycam_photo_id: string;
  photo_url_web: string | null;
  photo_url_thumbnail: string | null;
  captured_at: string | null;
  captured_by_name: string | null;
  description: string | null;
}

interface DailyLog {
  id: number;
  log_date: string;
  work_completed: string | null;
  crew_notes: string | null;
  materials_needed_tomorrow: string | null;
  truck_emptied: boolean;
  truck_loaded: boolean;
  truck_fueled: boolean;
  truck_clean: boolean;
  truck_notes: string | null;
  office_update: string | null;
  submitted_by: string | null;
  submitted_at: string;
}

// ─── Configs ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<WOStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: "Draft",       color: "text-slate-600",  bg: "bg-slate-100" },
  ready:       { label: "Ready",       color: "text-blue-700",   bg: "bg-blue-100" },
  in_progress: { label: "In Progress", color: "text-amber-700",  bg: "bg-amber-100" },
  on_hold:     { label: "On Hold",     color: "text-orange-700", bg: "bg-orange-100" },
  complete:    { label: "Complete",    color: "text-green-700",  bg: "bg-green-100" },
};
const STATUS_ORDER: WOStatus[] = ["draft", "ready", "in_progress", "on_hold", "complete"];

const TYPE_CFG: Record<WOType, { label: string; color: string; bg: string; Icon: any }> = {
  maintenance_visit:  { label: "Maintenance Visit",  color: "text-emerald-700", bg: "bg-emerald-100", Icon: Wrench },
  landscape_project:  { label: "Landscape Project",  color: "text-green-700",   bg: "bg-green-100",   Icon: Leaf },
  hardscape_project:  { label: "Hardscape Project",  color: "text-purple-700",  bg: "bg-purple-100",  Icon: HardHat },
  service_call:       { label: "Service Call",        color: "text-blue-700",    bg: "bg-blue-100",    Icon: Zap },
  snow_ice:           { label: "Snow & Ice",          color: "text-cyan-700",    bg: "bg-cyan-100",    Icon: Snowflake },
  internal_shop:      { label: "Internal/Shop",       color: "text-slate-700",   bg: "bg-slate-100",   Icon: Settings },
};

const PRIORITY_CFG: Record<WOPriority, { label: string; color: string; bg: string }> = {
  low:    { label: "Low",    color: "text-slate-500",  bg: "bg-slate-50 border border-slate-200" },
  normal: { label: "Normal", color: "text-blue-600",   bg: "bg-blue-50 border border-blue-200" },
  high:   { label: "High",   color: "text-orange-600", bg: "bg-orange-50 border border-orange-200" },
  urgent: { label: "Urgent", color: "text-red-600 font-bold", bg: "bg-red-50 border border-red-300" },
};

// Project types that show contract/completion date and hold points
const PROJECT_TYPES: WOType[] = ["landscape_project", "hardscape_project"];

const MAT_STATUS_CYCLE: Record<MatStatus, MatStatus> = { needed: "loaded", loaded: "used", used: "needed" };
const MAT_STATUS_CFG: Record<MatStatus, { label: string; cls: string }> = {
  needed: { label: "Needed", cls: "bg-red-100 text-red-700 border-red-200" },
  loaded: { label: "Loaded", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  used:   { label: "Used",   cls: "bg-green-100 text-green-700 border-green-200" },
};

// ─── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WOStatus }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.color}`}>{c.label}</span>;
}

function TypeBadge({ type }: { type: WOType }) {
  const cfg = TYPE_CFG[type] || TYPE_CFG.maintenance_visit;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: WOPriority | null }) {
  if (!priority || priority === "normal") return null;
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.normal;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${cfg.bg} ${cfg.color}`}>
      {priority === "urgent" ? "🚨 " : priority === "high" ? "⚡ " : ""}{cfg.label}
    </span>
  );
}

function fmtMinutes(mins: number | null) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE (List)
// ═══════════════════════════════════════════════════════════════════════════════

export default function WorkOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdmin = user?.role === "Admin" || user?.role === "Manager" || (user as any)?.isMasterAdmin;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("areas");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders", statusFilter, typeFilter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (typeFilter !== "all") p.set("wo_type", typeFilter);
      if (search) p.set("search", search);
      return fetch(`/api/work-orders?${p}`).then(r => r.json());
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery<WorkOrder>({
    queryKey: ["/api/work-orders", selectedId],
    queryFn: () => fetch(`/api/work-orders/${selectedId}`).then(r => r.json()),
    enabled: selectedId !== null,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/work-orders"] });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/work-orders/${id}/status`, { status }),
    onSuccess: () => { invalidate(); toast({ title: "Status updated" }); },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to update status", variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/work-orders/${id}`),
    onSuccess: () => { invalidate(); setSelectedId(null); toast({ title: "Work order deleted" }); },
  });

  if (selectedId !== null) {
    return (
      <DetailView
        id={selectedId}
        detail={detail}
        isLoading={detailLoading}
        isAdmin={isAdmin}
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onBack={() => { setSelectedId(null); setActiveTab("areas"); }}
        onStatusChange={(status) => statusMut.mutate({ id: selectedId, status })}
        onDelete={() => deleteMut.mutate(selectedId)}
        onRefresh={invalidate}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Work Orders
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Crew-ready job guides with areas, tasks, and materials</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-wo">
            <Plus className="w-4 h-4 mr-1" /> New Work Order
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search work orders…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-wo" />
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          {["all", ...STATUS_ORDER].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} data-testid={`filter-status-${s}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {s === "all" ? "All Status" : STATUS_CFG[s as WOStatus]?.label}
            </button>
          ))}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-sm w-[170px]" data-testid="filter-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(Object.entries(TYPE_CFG) as [WOType, any][]).map(([val, cfg]) => (
                <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
      ) : workOrders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No work orders found</p>
          {isAdmin && <p className="text-sm mt-1">Create one to get started</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workOrders.map(wo => {
            const done = Number(wo.complete_tasks || 0);
            const total = Number(wo.total_tasks || 0);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={wo.id} className="cursor-pointer hover:shadow-md transition-shadow border"
                onClick={() => { setSelectedId(wo.id); setActiveTab("areas"); }} data-testid={`card-wo-${wo.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug truncate">{wo.title}</p>
                      {wo.customer_name && <p className="text-xs text-muted-foreground truncate"><MapPin className="w-3 h-3 inline mr-0.5" />{wo.customer_name}</p>}
                      {wo.job_title && !wo.customer_name && <p className="text-xs text-muted-foreground truncate">Job: {wo.job_title}</p>}
                    </div>
                    <StatusBadge status={wo.status} />
                  </div>
                  <div className="flex gap-1 flex-wrap mb-3">
                    <TypeBadge type={wo.wo_type} />
                    <PriorityBadge priority={wo.priority} />
                    {wo.service_type_name && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{wo.service_type_name}</span>}
                  </div>
                  <div className="space-y-1">
                    {wo.scheduled_date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />{format(parseISO(wo.scheduled_date), "MMM d, yyyy")}
                      </div>
                    )}
                    {wo.crew_leader_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />Lead: {wo.crew_leader_name}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckSquare className="w-3 h-3" />{done}/{total} tasks
                        {Number(wo.total_areas) > 0 && <> · {wo.total_areas} areas</>}
                      </div>
                      {total > 0 && (
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${pct === 100 ? "bg-green-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {createOpen && <CreateWODialog onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); invalidate(); setSelectedId(id); setActiveTab("areas"); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CREATE DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function CreateWODialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { toast } = useToast();
  const [woType, setWoType] = useState<WOType>("maintenance_visit");
  const [form, setForm] = useState({
    title: "", description: "", job_id: "none", service_type_id: "none",
    crew_leader_id: "none", scheduled_date: "", estimated_hours: "",
    property_notes: "", site_access_notes: "", safety_notes: "",
    customer_name: "", customer_address: "",
    customer_phone: "", office_notes: "", contract_value: "", estimated_completion_date: "",
    priority: "normal" as WOPriority,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: jobs = [] } = useQuery<{ id: number; title: string }[]>({ queryKey: ["/api/jobs"], queryFn: () => fetch("/api/jobs").then(r => r.json()) });
  const { data: serviceTypes = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/service-types"], queryFn: () => fetch("/api/service-types").then(r => r.json()) });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: () => fetch("/api/users").then(r => r.json()) });

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/work-orders", {
        ...form,
        wo_type: woType,
        job_id: form.job_id !== "none" ? form.job_id : null,
        service_type_id: form.service_type_id !== "none" ? form.service_type_id : null,
        crew_leader_id: form.crew_leader_id !== "none" ? form.crew_leader_id : null,
        contract_value: form.contract_value ? Number(form.contract_value) : null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      });
      const data = await res.json();
      onCreated(data.id);
      toast({ title: "Work order created" });
    } catch {
      toast({ title: "Failed to create", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* WO Type — 6-option grid */}
          <div>
            <Label className="mb-2 block">Work Order Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_CFG) as [WOType, any][]).map(([type, cfg]) => {
                const { Icon } = cfg;
                const active = woType === type;
                return (
                  <button key={type} onClick={() => setWoType(type)} data-testid={`btn-type-${type}`}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs font-medium transition-colors
                      ${active ? `${cfg.bg} ${cfg.color} border-current` : "border-muted hover:border-muted-foreground/40"}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-center leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label>Work Order Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Spring Cleanup — Smith Residence" data-testid="input-wo-title" />
          </div>

          {/* Priority + Service Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type</Label>
              <Select value={form.service_type_id} onValueChange={v => set("service_type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {serviceTypes.map((st: any) => <SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linked Job */}
          <div>
            <Label>Linked Job (optional)</Label>
            <Select value={form.job_id} onValueChange={v => set("job_id", v)}>
              <SelectTrigger data-testid="select-wo-job"><SelectValue placeholder="Select job" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(jobs as any[]).map((j: any) => <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Customer info */}
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer / Site</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Customer Name</Label>
                <Input value={form.customer_name} onChange={e => set("customer_name", e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.customer_phone} onChange={e => set("customer_phone", e.target.value)} placeholder="(555) 555-5555" />
              </div>
            </div>
            <div>
              <Label>Property Address</Label>
              <Input value={form.customer_address} onChange={e => set("customer_address", e.target.value)} placeholder="123 Main St, City, ST 00000" />
            </div>
            <div>
              <Label>Site Access Notes</Label>
              <Textarea value={form.site_access_notes} onChange={e => set("site_access_notes", e.target.value)} placeholder="Gate code: #1234, Dog in backyard, Park on street…" rows={2} />
            </div>
          </div>

          {/* Safety Notes — prominent red section */}
          <div className="border border-red-200 rounded-lg p-3 bg-red-50/50">
            <Label className="text-red-700 font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />Safety Notes
            </Label>
            <Textarea value={form.safety_notes} onChange={e => set("safety_notes", e.target.value)}
              placeholder="Hazards, required PPE, unsafe areas, chemical warnings, electrical concerns…"
              rows={2} className="border-red-200 focus:ring-red-300" />
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scheduled Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} data-testid="input-wo-date" />
            </div>
            <div>
              <Label>Estimated Hours</Label>
              <Input type="number" step="0.5" min="0" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value)} placeholder="e.g. 4 or 8.5" />
            </div>
          </div>

          {/* Project-type-only fields */}
          {PROJECT_TYPES.includes(woType) && (
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contract Value ($)</Label>
                  <Input type="number" step="0.01" value={form.contract_value} onChange={e => set("contract_value", e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>Est. Completion Date</Label>
                  <Input type="date" value={form.estimated_completion_date} onChange={e => set("estimated_completion_date", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Crew */}
          <div>
            <Label>Crew Leader</Label>
            <Select value={form.crew_leader_id} onValueChange={v => set("crew_leader_id", v)}>
              <SelectTrigger><SelectValue placeholder="Assign crew leader" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(users as any[]).filter((u: any) => u.role !== "Customer").map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label>Property Notes</Label>
            <Textarea value={form.property_notes} onChange={e => set("property_notes", e.target.value)} placeholder="Sensitive lawn areas, HOA rules, customer preferences…" rows={2} />
          </div>
          <div>
            <Label>Office Instructions to Crew</Label>
            <Textarea value={form.office_notes} onChange={e => set("office_notes", e.target.value)} placeholder="Special instructions, priority areas…" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} data-testid="button-save-wo">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Create Work Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function DetailView({ id, detail, isLoading, isAdmin, user, activeTab, setActiveTab, onBack, onStatusChange, onDelete, onRefresh }: {
  id: number; detail?: WorkOrder; isLoading: boolean; isAdmin: boolean; user: any;
  activeTab: string; setActiveTab: (t: string) => void;
  onBack: () => void; onStatusChange: (s: string) => void; onDelete: () => void; onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [readinessBlocked, setReadinessBlocked] = useState<string[]>([]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/work-orders", id] });
    onRefresh();
  };

  const handleStatusChange = (status: string) => {
    if (status === "ready" && detail) {
      const allMaterials = [
        ...(detail.wo_materials || []),
        ...(detail.areas || []).flatMap(a => a.materials || []),
      ];
      const allTools = [
        ...(detail.wo_tools || []),
        ...(detail.areas || []).flatMap(a => a.tools || []),
      ];
      const missing: string[] = [];
      if (allMaterials.length === 0) missing.push("at least 1 Materials line item");
      if (allTools.length === 0)     missing.push("at least 1 Tools line item");
      const mNQ = allMaterials.filter(m => !m.quantity || Number(m.quantity) === 0).length;
      if (mNQ > 0) missing.push(`quantity on ${mNQ} material item${mNQ !== 1 ? "s" : ""}`);
      const tNQ = allTools.filter(t => !t.quantity || Number(t.quantity) === 0).length;
      if (tNQ > 0) missing.push(`quantity on ${tNQ} tool item${tNQ !== 1 ? "s" : ""}`);
      if (!detail.site_access_notes?.trim()) missing.push("Site Access Notes");
      if (missing.length > 0) {
        setReadinessBlocked(missing);
        return;
      }
    }
    onStatusChange(status);
  };

  if (isLoading || !detail) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>;
  }

  const totalTasks = detail.areas?.reduce((s, a) => s + a.tasks.length, 0) || 0;
  const doneTasks  = detail.areas?.reduce((s, a) => s + a.tasks.filter(t => t.is_complete).length, 0) || 0;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="mb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3" data-testid="button-back-wo">
          <ArrowLeft className="w-4 h-4" /> Back to Work Orders
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeBadge type={detail.wo_type} />
              <StatusBadge status={detail.status} />
              <PriorityBadge priority={detail.priority} />
            </div>
            <h1 className="text-xl font-bold mt-1">{detail.title}</h1>
            {detail.service_type_name && <p className="text-sm text-muted-foreground">{detail.service_type_name}</p>}
            {detail.job_title && <p className="text-sm text-muted-foreground">Job: {detail.job_title}</p>}
            {totalTasks > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 max-w-32 bg-muted rounded-full h-2">
                  <div className={`h-2 rounded-full ${pct === 100 ? "bg-green-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{doneTasks}/{totalTasks} tasks</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <>
                <Select value={detail.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-wo-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditOpen(true)}><Edit2 className="w-4 h-4 mr-2" />Edit Details</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {detail.closeout_ready_at && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-300 text-sm mb-4" data-testid="banner-closeout-ready">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-green-700">All Tasks Complete</span>
            <span className="text-green-700"> — Ready for closeout review</span>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="areas" data-testid="tab-areas"><CheckSquare className="w-3.5 h-3.5 mr-1" />Work Areas</TabsTrigger>
          <TabsTrigger value="overview" data-testid="tab-overview"><FileText className="w-3.5 h-3.5 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="hours" data-testid="tab-hours"><Clock className="w-3.5 h-3.5 mr-1" />Hours<span className="ml-1 text-xs bg-muted rounded-full px-1.5">{detail.time_entries?.length || 0}</span></TabsTrigger>
          <TabsTrigger value="photos" data-testid="tab-photos"><ImageIcon className="w-3.5 h-3.5 mr-1" />Photos<span className="ml-1 text-xs bg-muted rounded-full px-1.5">{detail.companycam_photos?.length || 0}</span></TabsTrigger>
          <TabsTrigger value="daily-log" data-testid="tab-dailylog"><BookOpen className="w-3.5 h-3.5 mr-1" />Daily Log<span className="ml-1 text-xs bg-muted rounded-full px-1.5">{detail.daily_logs?.length || 0}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="areas">
          <AreasTab detail={detail} isAdmin={isAdmin} woId={id} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="overview">
          <OverviewTab detail={detail} />
        </TabsContent>
        <TabsContent value="hours">
          <HoursTab entries={detail.time_entries || []} />
        </TabsContent>
        <TabsContent value="photos">
          <PhotosTab photos={detail.companycam_photos || []} jobId={detail.job_id} />
        </TabsContent>
        <TabsContent value="daily-log">
          <DailyLogTab detail={detail} isAdmin={isAdmin} user={user} woId={id} onRefresh={refresh} />
        </TabsContent>
      </Tabs>

      {editOpen && <EditWODialog detail={detail} onClose={() => setEditOpen(false)} onSaved={refresh} />}

      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Work Order?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This permanently removes the work order and all its areas, tasks, and materials.</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { onDelete(); setConfirmDelete(false); }}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {readinessBlocked.length > 0 && (
        <Dialog open onOpenChange={() => setReadinessBlocked([])}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-5 h-5" />Cannot Mark Ready
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">
              The following must be completed before this work order can be set to Ready:
            </p>
            <ul className="space-y-2">
              {readinessBlocked.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-5">
              <Button onClick={() => setReadinessBlocked([])}>Got it</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ detail }: { detail: WorkOrder }) {
  return (
    <div className="space-y-4">
      {/* Safety Notes — top, prominent red */}
      {detail.safety_notes && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />⚠ Safety Notes
            </p>
            <p className="text-sm whitespace-pre-wrap text-red-900">{detail.safety_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Customer / Site card */}
      {(detail.customer_name || detail.customer_address || detail.customer_phone) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer / Site</p>
            {detail.customer_name && <p className="font-semibold">{detail.customer_name}</p>}
            {detail.customer_address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(detail.customer_address)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <MapPin className="w-4 h-4 flex-shrink-0" />{detail.customer_address}
              </a>
            )}
            {detail.customer_phone && (
              <a href={`tel:${detail.customer_phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Phone className="w-4 h-4 flex-shrink-0" />{detail.customer_phone}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Site access */}
      {detail.site_access_notes && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">⚠️ Site Access Notes</p>
            <p className="text-sm whitespace-pre-wrap">{detail.site_access_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Scheduling info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule &amp; Details</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Type:</span> <TypeBadge type={detail.wo_type} /></div>
            {detail.priority && detail.priority !== "normal" && (
              <div><span className="text-muted-foreground">Priority:</span> <PriorityBadge priority={detail.priority} /></div>
            )}
            {detail.scheduled_date && <div><span className="text-muted-foreground">Date:</span> {format(parseISO(detail.scheduled_date), "MMMM d, yyyy")}</div>}
            {detail.estimated_hours && <div><span className="text-muted-foreground">Est. Hours:</span> {Number(detail.estimated_hours)}h</div>}
            {PROJECT_TYPES.includes(detail.wo_type) && detail.estimated_completion_date && (
              <div><span className="text-muted-foreground">Est. Complete:</span> {format(parseISO(detail.estimated_completion_date), "MMMM d, yyyy")}</div>
            )}
            {detail.contract_value && (
              <div><span className="text-muted-foreground">Contract:</span> ${Number(detail.contract_value).toLocaleString()}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Crew */}
      {detail.crew_leader_name && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Crew</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{detail.crew_leader_name}</p>
                <p className="text-xs text-muted-foreground">Crew Leader</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property notes */}
      {detail.property_notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Property Notes</p>
            <p className="text-sm whitespace-pre-wrap">{detail.property_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Office notes */}
      {detail.office_notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Office Instructions</p>
            <p className="text-sm whitespace-pre-wrap">{detail.office_notes}</p>
          </CardContent>
        </Card>
      )}

      {detail.description && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap">{detail.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Areas Tab ────────────────────────────────────────────────────────────────

interface ExpectedItem {
  id: number;
  name: string;
  quantity: string;
  unit: string | null;
  work_area_name: string | null;
}

function AreasTab({ detail, isAdmin, woId, onRefresh }: { detail: WorkOrder; isAdmin: boolean; woId: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const [addAreaOpen, setAddAreaOpen] = useState(false);
  const [areaForm, setAreaForm] = useState({ name: "", description: "", estimated_hours: "" });
  const [savingArea, setSavingArea] = useState(false);
  const [addWoToolOpen, setAddWoToolOpen] = useState(false);
  const [woToolForm, setWoToolForm] = useState({ item_name: "", quantity: "", unit: "", notes: "" });

  const { data: expectedItemsData } = useQuery<{ equipment: ExpectedItem[]; materials: ExpectedItem[] }>({
    queryKey: ["/api/my-day/jobs", detail.job_id, "expected-items"],
    queryFn: () => fetch(`/api/my-day/jobs/${detail.job_id}/expected-items`).then(r => r.json()),
    enabled: !!detail.job_id,
  });
  const allExpectedEquipment: ExpectedItem[] = expectedItemsData?.equipment || [];

  const addArea = async () => {
    if (!areaForm.name.trim()) { toast({ title: "Area name required", variant: "destructive" }); return; }
    setSavingArea(true);
    try {
      await apiRequest("POST", `/api/work-orders/${woId}/areas`, {
        name: areaForm.name, description: areaForm.description || null,
        estimated_hours: areaForm.estimated_hours ? Number(areaForm.estimated_hours) : null,
      });
      setAreaForm({ name: "", description: "", estimated_hours: "" });
      setAddAreaOpen(false);
      onRefresh();
    } catch {
      toast({ title: "Failed to add area", variant: "destructive" });
    } finally { setSavingArea(false); }
  };

  const addWoTool = async () => {
    if (!woToolForm.item_name.trim()) return;
    try {
      await apiRequest("POST", `/api/work-orders/${woId}/tools`, { ...woToolForm, area_id: null });
      setWoToolForm({ item_name: "", quantity: "", unit: "", notes: "" });
      setAddWoToolOpen(false);
      onRefresh();
    } catch { toast({ title: "Failed to add tool", variant: "destructive" }); }
  };

  const areas = detail.areas || [];

  return (
    <div className="space-y-4">
      {/* Safety notes — top, red, prominent */}
      {detail.safety_notes && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div><span className="font-bold text-red-700">Safety: </span><span className="text-red-800">{detail.safety_notes}</span></div>
        </div>
      )}

      {/* Site access reminder */}
      {detail.site_access_notes && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div><span className="font-semibold text-amber-700">Site Access: </span><span className="text-amber-800">{detail.site_access_notes}</span></div>
        </div>
      )}

      {/* Office instructions reminder */}
      {detail.office_notes && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div><span className="font-semibold text-blue-700">Instructions: </span><span className="text-blue-800">{detail.office_notes}</span></div>
        </div>
      )}

      {areas.length === 0 && !isAdmin && (
        <div className="text-center py-12 text-muted-foreground">
          <Boxes className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No work areas added yet</p>
        </div>
      )}

      {areas.map(area => (
        <AreaCard key={area.id} area={area} woId={woId} isAdmin={isAdmin} woType={detail.wo_type} onRefresh={onRefresh}
          areaEquipment={allExpectedEquipment.filter(e => (e.work_area_name || "").toLowerCase().trim() === area.name.toLowerCase().trim())} />
      ))}

      {/* WO-level materials (not scoped to an area) */}
      {((detail.wo_materials || []).length > 0 || isAdmin) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />General Materials
            </p>
            <div className="space-y-2">
              {(detail.wo_materials || []).map(m => <MaterialRow key={m.id} mat={m} woId={woId} onRefresh={onRefresh} isAdmin={isAdmin} />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WO-level tools */}
      {((detail.wo_tools || []).length > 0 || isAdmin) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />Tools Needed
            </p>
            <div className="space-y-2">
              {(detail.wo_tools || []).map(t => <ToolRow key={t.id} tool={t} woId={woId} onRefresh={onRefresh} isAdmin={isAdmin} />)}
            </div>
            {isAdmin && (
              addWoToolOpen ? (
                <div className="space-y-2 pt-3 border-t mt-2">
                  <Input value={woToolForm.item_name} onChange={e => setWoToolForm(f => ({ ...f, item_name: e.target.value }))} placeholder="Tool name (e.g. Skid Steer, Plate Compactor)" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input value={woToolForm.quantity} onChange={e => setWoToolForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Qty" type="number" />
                    <Input value={woToolForm.unit} onChange={e => setWoToolForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unit" />
                    <Input value={woToolForm.notes} onChange={e => setWoToolForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addWoTool}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddWoToolOpen(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddWoToolOpen(true)} className="text-xs text-primary hover:underline flex items-center gap-1 mt-2">
                  <Plus className="w-3 h-3" />Add tool
                </button>
              )
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div>
          {addAreaOpen ? (
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">New Work Area</p>
                <Input value={areaForm.name} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} placeholder="Area name (e.g. Front Yard, Patio, Beds)" data-testid="input-area-name" />
                <Textarea value={areaForm.description} onChange={e => setAreaForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the scope of work for this area…" rows={2} />
                <Input type="number" step="0.5" value={areaForm.estimated_hours} onChange={e => setAreaForm(f => ({ ...f, estimated_hours: e.target.value }))} placeholder="Estimated hours (optional)" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={addArea} disabled={savingArea}>{savingArea && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Add Area</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddAreaOpen(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setAddAreaOpen(true)} data-testid="button-add-area">
              <Plus className="w-4 h-4 mr-1" /> Add Work Area
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Area Card ────────────────────────────────────────────────────────────────

function AreaCard({ area, woId, isAdmin, woType, onRefresh, areaEquipment = [] }: {
  area: Area; woId: number; isAdmin: boolean; woType: WOType; onRefresh: () => void;
  areaEquipment?: ExpectedItem[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addMatOpen, setAddMatOpen] = useState(false);
  const [addToolOpen, setAddToolOpen] = useState(false);
  const [addCheckOpen, setAddCheckOpen] = useState(false);
  const [addHoldOpen, setAddHoldOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", requires_photo: false });
  const [matForm, setMatForm] = useState({ item_name: "", quantity: "", unit: "", notes: "" });
  const [toolForm, setToolForm] = useState({ item_name: "", quantity: "", unit: "", notes: "" });
  const [checkLabel, setCheckLabel] = useState("");
  const [holdForm, setHoldForm] = useState({ label: "", description: "" });

  const save = async (url: string, body: any) => {
    try { await apiRequest("POST", url, body); onRefresh(); }
    catch { toast({ title: "Failed to save", variant: "destructive" }); }
  };

  const deleteArea = async () => {
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/areas/${area.id}`, {});
      onRefresh();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  const totalTasks = area.tasks.length;
  const doneTasks  = area.tasks.filter(t => t.is_complete).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <Card className={`border ${pct === 100 && totalTasks > 0 ? "border-green-200" : ""}`}>
      <CardContent className="p-0">
        {/* Area header */}
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg">
          <div className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{area.name}</p>
              {area.description && <p className="text-xs text-muted-foreground truncate">{area.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
            {area.estimated_hours && <span className="text-xs text-muted-foreground">{area.estimated_hours}h est.</span>}
            {totalTasks > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-16 bg-muted rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${pct === 100 ? "bg-green-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{doneTasks}/{totalTasks}</span>
              </div>
            )}
            {isAdmin && (
              <button onClick={(e) => { e.stopPropagation(); deleteArea(); }} className="p-1 text-muted-foreground hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </button>

        {open && (
          <div className="px-4 pb-4 space-y-4">
            {/* Tasks */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tasks</p>
              {area.tasks.length === 0 && <p className="text-xs text-muted-foreground italic">No tasks yet</p>}
              <div className="space-y-1">
                {area.tasks.map(task => (
                  <TaskRow key={task.id} task={task} woId={woId} areaId={area.id} isAdmin={isAdmin} onRefresh={onRefresh} />
                ))}
              </div>
              {isAdmin && !addTaskOpen && (
                <button onClick={() => setAddTaskOpen(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" />Add task
                </button>
              )}
              {isAdmin && addTaskOpen && (
                <div className="mt-2 space-y-2 p-3 bg-muted/40 rounded-lg">
                  <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" data-testid="input-task-title" />
                  <Input value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={taskForm.requires_photo} onCheckedChange={v => setTaskForm(f => ({ ...f, requires_photo: !!v }))} />
                    Requires photo
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      if (!taskForm.title.trim()) return;
                      await save(`/api/work-orders/${woId}/areas/${area.id}/tasks`, taskForm);
                      setTaskForm({ title: "", description: "", requires_photo: false }); setAddTaskOpen(false);
                    }}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Expected Equipment (from job line items — read-only) */}
            {areaEquipment.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <HardHat className="w-3 h-3" />Expected Equipment
                </p>
                <div className="space-y-1">
                  {areaEquipment.map((item, i) => (
                    <div key={item.id ?? i} className="flex items-center justify-between text-sm px-2 py-1.5 rounded bg-muted/30">
                      <span>{item.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Materials */}
            {(area.materials.length > 0 || isAdmin) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Package className="w-3 h-3" />Materials
                </p>
                <div className="space-y-2">
                  {area.materials.map(m => (
                    <MaterialRow key={m.id} mat={m} woId={woId} onRefresh={onRefresh} isAdmin={isAdmin} />
                  ))}
                </div>
                {isAdmin && !addMatOpen && (
                  <button onClick={() => setAddMatOpen(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" />Add material
                  </button>
                )}
                {isAdmin && addMatOpen && (
                  <div className="mt-2 space-y-2 p-3 bg-muted/40 rounded-lg">
                    <Input value={matForm.item_name} onChange={e => setMatForm(f => ({...f, item_name: e.target.value}))} placeholder="Material name" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={matForm.quantity} onChange={e => setMatForm(f => ({...f, quantity: e.target.value}))} placeholder="Qty" type="number" />
                      <Input value={matForm.unit} onChange={e => setMatForm(f => ({...f, unit: e.target.value}))} placeholder="Unit" />
                      <Input value={matForm.notes} onChange={e => setMatForm(f => ({...f, notes: e.target.value}))} placeholder="Notes" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => {
                        if (!matForm.item_name.trim()) return;
                        await save(`/api/work-orders/${woId}/materials`, { ...matForm, area_id: area.id });
                        setMatForm({ item_name: "", quantity: "", unit: "", notes: "" }); setAddMatOpen(false);
                      }}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddMatOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tools */}
            {((area.tools || []).length > 0 || isAdmin) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Wrench className="w-3 h-3" />Tools
                </p>
                <div className="space-y-2">
                  {(area.tools || []).map(t => (
                    <ToolRow key={t.id} tool={t} woId={woId} onRefresh={onRefresh} isAdmin={isAdmin} />
                  ))}
                </div>
                {isAdmin && !addToolOpen && (
                  <button onClick={() => setAddToolOpen(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" />Add tool
                  </button>
                )}
                {isAdmin && addToolOpen && (
                  <div className="mt-2 space-y-2 p-3 bg-muted/40 rounded-lg">
                    <Input value={toolForm.item_name} onChange={e => setToolForm(f => ({...f, item_name: e.target.value}))} placeholder="Tool name (e.g. Skid Steer, Hand tamper)" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={toolForm.quantity} onChange={e => setToolForm(f => ({...f, quantity: e.target.value}))} placeholder="Qty" type="number" />
                      <Input value={toolForm.unit} onChange={e => setToolForm(f => ({...f, unit: e.target.value}))} placeholder="Unit" />
                      <Input value={toolForm.notes} onChange={e => setToolForm(f => ({...f, notes: e.target.value}))} placeholder="Notes" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => {
                        if (!toolForm.item_name.trim()) return;
                        await save(`/api/work-orders/${woId}/tools`, { ...toolForm, area_id: area.id });
                        setToolForm({ item_name: "", quantity: "", unit: "", notes: "" }); setAddToolOpen(false);
                      }}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddToolOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checklist */}
            {(area.checklist.length > 0 || isAdmin) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Checklist</p>
                <div className="space-y-1.5">
                  {area.checklist.map(item => (
                    <ChecklistRow key={item.id} item={item} woId={woId} isAdmin={isAdmin} onRefresh={onRefresh} />
                  ))}
                </div>
                {isAdmin && !addCheckOpen && (
                  <button onClick={() => setAddCheckOpen(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" />Add checklist item
                  </button>
                )}
                {isAdmin && addCheckOpen && (
                  <div className="mt-2 space-y-2 p-3 bg-muted/40 rounded-lg">
                    <Input value={checkLabel} onChange={e => setCheckLabel(e.target.value)} placeholder="Checklist item label" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => {
                        if (!checkLabel.trim()) return;
                        await save(`/api/work-orders/${woId}/checklists`, { label: checkLabel, area_id: area.id });
                        setCheckLabel(""); setAddCheckOpen(false);
                      }}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddCheckOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hold Points (project types only) */}
            {PROJECT_TYPES.includes(woType) && (area.hold_points.length > 0 || isAdmin) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" />Hold Points
                </p>
                <div className="space-y-2">
                  {area.hold_points.map(hp => (
                    <HoldPointRow key={hp.id} hp={hp} woId={woId} isAdmin={isAdmin} onRefresh={onRefresh} />
                  ))}
                </div>
                {isAdmin && !addHoldOpen && (
                  <button onClick={() => setAddHoldOpen(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" />Add hold point
                  </button>
                )}
                {isAdmin && addHoldOpen && (
                  <div className="mt-2 space-y-2 p-3 bg-muted/40 rounded-lg">
                    <Input value={holdForm.label} onChange={e => setHoldForm(f => ({ ...f, label: e.target.value }))} placeholder="Hold point label (e.g. Base compaction check)" />
                    <Input value={holdForm.description} onChange={e => setHoldForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => {
                        if (!holdForm.label.trim()) return;
                        await save(`/api/work-orders/${woId}/hold-points`, { ...holdForm, area_id: area.id });
                        setHoldForm({ label: "", description: "" }); setAddHoldOpen(false);
                      }}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddHoldOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, woId, areaId, isAdmin, onRefresh }: { task: Task; woId: number; areaId: number; isAdmin: boolean; onRefresh: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewPhotos, setViewPhotos] = useState(false);
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    setToggling(true);
    try {
      await apiRequest("PATCH", `/api/work-orders/${woId}/areas/${areaId}/tasks/${task.id}/complete`, { is_complete: !task.is_complete });
      onRefresh();
    } catch { toast({ title: "Failed to update task", variant: "destructive" }); }
    finally { setToggling(false); }
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      await fetch(`/api/work-orders/${woId}/areas/${areaId}/tasks/${task.id}/photos`, { method: "POST", body: fd });
      onRefresh();
    } catch { toast({ title: "Failed to upload", variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const deleteTask = async () => {
    if (!isAdmin) return;
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/areas/${areaId}/tasks/${task.id}`, {});
      onRefresh();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className={`group flex items-start gap-3 p-2 rounded-lg transition-colors ${task.is_complete ? "bg-green-50" : "hover:bg-muted/40"}`}>
      <button onClick={toggle} disabled={toggling} className="mt-0.5 flex-shrink-0" data-testid={`task-check-${task.id}`}>
        {toggling ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> :
          task.is_complete ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.is_complete ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
        {task.requires_photo && !task.is_complete && (
          <span className="text-xs text-amber-600 flex items-center gap-0.5 mt-0.5"><Camera className="w-3 h-3" />Photo required</span>
        )}
        {task.is_complete && task.completed_by && (
          <p className="text-xs text-muted-foreground mt-0.5">✓ {task.completed_by}</p>
        )}
        {task.photos.length > 0 && (
          <button onClick={() => setViewPhotos(!viewPhotos)} className="text-xs text-primary hover:underline mt-0.5 flex items-center gap-0.5">
            <Camera className="w-3 h-3" />{task.photos.length} photo{task.photos.length !== 1 ? "s" : ""}
          </button>
        )}
        {viewPhotos && task.photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {task.photos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.url} alt="" className="w-16 h-16 object-cover rounded border" />
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="p-1 text-muted-foreground hover:text-primary rounded" data-testid={`task-photo-${task.id}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </button>
        {isAdmin && <button onClick={deleteTask} className="p-1 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

// ─── Material Row ─────────────────────────────────────────────────────────────

function MaterialRow({ mat, woId, onRefresh, isAdmin }: { mat: Material; woId: number; onRefresh: () => void; isAdmin: boolean }) {
  const { toast } = useToast();
  const [cycling, setCycling] = useState(false);

  const cycleStatus = async () => {
    setCycling(true);
    try {
      await apiRequest("PATCH", `/api/work-orders/${woId}/materials/${mat.id}/status`, { status: MAT_STATUS_CYCLE[mat.status] });
      onRefresh();
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
    finally { setCycling(false); }
  };

  const deleteMat = async () => {
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/materials/${mat.id}`, {});
      onRefresh();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  const cfg = MAT_STATUS_CFG[mat.status];

  return (
    <div className="group flex items-center gap-2">
      <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm">{mat.item_name}</span>
        {(mat.quantity || mat.unit) && (
          <span className="text-xs text-muted-foreground ml-1">· {mat.quantity}{mat.unit ? ` ${mat.unit}` : ""}</span>
        )}
        {mat.notes && <span className="text-xs text-muted-foreground ml-1">· {mat.notes}</span>}
      </div>
      <button onClick={cycleStatus} disabled={cycling} data-testid={`mat-status-${mat.id}`}
        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls} cursor-pointer hover:opacity-80 transition-opacity`}>
        {cycling ? <Loader2 className="w-3 h-3 animate-spin" /> : cfg.label}
      </button>
      {isAdmin && (
        <button onClick={deleteMat} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-opacity">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Tool Row ─────────────────────────────────────────────────────────────────

function ToolRow({ tool, woId, onRefresh, isAdmin }: { tool: Tool; woId: number; onRefresh: () => void; isAdmin: boolean }) {
  const { toast } = useToast();
  const [cycling, setCycling] = useState(false);

  const cycleStatus = async () => {
    setCycling(true);
    try {
      await apiRequest("PATCH", `/api/work-orders/${woId}/tools/${tool.id}/status`, { status: MAT_STATUS_CYCLE[tool.status] });
      onRefresh();
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
    finally { setCycling(false); }
  };

  const deleteTool = async () => {
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/tools/${tool.id}`, {});
      onRefresh();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  const cfg = MAT_STATUS_CFG[tool.status];

  return (
    <div className="group flex items-center gap-2">
      <Wrench className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm">{tool.item_name}</span>
        {(tool.quantity || tool.unit) && (
          <span className="text-xs text-muted-foreground ml-1">· {tool.quantity}{tool.unit ? ` ${tool.unit}` : ""}</span>
        )}
        {tool.notes && <span className="text-xs text-muted-foreground ml-1">· {tool.notes}</span>}
      </div>
      <button onClick={cycleStatus} disabled={cycling} data-testid={`tool-status-${tool.id}`}
        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls} cursor-pointer hover:opacity-80 transition-opacity`}>
        {cycling ? <Loader2 className="w-3 h-3 animate-spin" /> : cfg.label}
      </button>
      {isAdmin && (
        <button onClick={deleteTool} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-opacity">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Checklist Row ────────────────────────────────────────────────────────────

function ChecklistRow({ item, woId, isAdmin, onRefresh }: { item: ChecklistItem; woId: number; isAdmin: boolean; onRefresh: () => void }) {
  const { toast } = useToast();
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    setToggling(true);
    try {
      await apiRequest("PATCH", `/api/work-orders/${woId}/checklists/${item.id}/complete`, { is_complete: !item.is_complete });
      onRefresh();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setToggling(false); }
  };

  const del = async () => {
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/checklists/${item.id}`, {});
      onRefresh();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className="group flex items-center gap-2">
      <button onClick={toggle} disabled={toggling}>
        {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> :
          item.is_complete ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
      </button>
      <span className={`text-sm flex-1 ${item.is_complete ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
      {item.is_complete && item.completed_by && <span className="text-xs text-muted-foreground">✓ {item.completed_by}</span>}
      {isAdmin && <button onClick={del} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
    </div>
  );
}

// ─── Hold Point Row ───────────────────────────────────────────────────────────

function HoldPointRow({ hp, woId, isAdmin, onRefresh }: { hp: HoldPoint; woId: number; isAdmin: boolean; onRefresh: () => void }) {
  const { toast } = useToast();
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    if (!isAdmin) return;
    setToggling(true);
    try {
      await apiRequest("PATCH", `/api/work-orders/${woId}/hold-points/${hp.id}/approve`, { is_approved: !hp.is_approved });
      onRefresh();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setToggling(false); }
  };

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border ${hp.is_approved ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
      {toggling ? <Loader2 className="w-4 h-4 animate-spin mt-0.5" /> :
        <Shield className={`w-4 h-4 flex-shrink-0 mt-0.5 ${hp.is_approved ? "text-green-600" : "text-orange-500"}`} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{hp.label}</p>
        {hp.description && <p className="text-xs text-muted-foreground">{hp.description}</p>}
        {hp.is_approved && hp.approved_by && <p className="text-xs text-green-600 mt-0.5">✓ Approved by {hp.approved_by}</p>}
        {!hp.is_approved && <p className="text-xs text-orange-600 mt-0.5">⚠ Awaiting inspection approval</p>}
      </div>
      {isAdmin && (
        <Button size="sm" variant={hp.is_approved ? "outline" : "default"} className="h-7 text-xs flex-shrink-0" onClick={toggle} disabled={toggling}>
          {hp.is_approved ? "Revoke" : "Approve"}
        </Button>
      )}
    </div>
  );
}

// ─── Hours Tab ────────────────────────────────────────────────────────────────

function HoursTab({ entries }: { entries: TimeEntry[] }) {
  const totalMins = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="font-medium">No time entries yet</p>
        <p className="text-sm">Time logged to the linked job will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
        <Clock className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">{fmtMinutes(totalMins)} total</p>
          <p className="text-xs text-muted-foreground">{entries.length} entries</p>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map(e => {
          const mins = e.duration_minutes || (e.clock_out ? differenceInMinutes(new Date(e.clock_out), new Date(e.clock_in)) : null);
          const name = e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : e.username;
          return (
            <Card key={e.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.clock_in), "MMM d · h:mm a")}
                      {e.clock_out && ` → ${format(new Date(e.clock_out), "h:mm a")}`}
                    </p>
                    {e.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{e.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtMinutes(mins)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{e.entry_type.replace(/_/g, " ")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Photos Tab ───────────────────────────────────────────────────────────────

function PhotosTab({ photos, jobId }: { photos: CcPhoto[]; jobId: string | null }) {
  const [selected, setSelected] = useState<CcPhoto | null>(null);

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="font-medium">No CompanyCam photos yet</p>
        <p className="text-sm">{jobId ? "Photos taken via CompanyCam on the linked job will appear here" : "Link a job to see CompanyCam photos"}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">{photos.length} photos from CompanyCam</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {photos.map(p => (
          <button key={p.id} onClick={() => setSelected(p)} className="aspect-square rounded overflow-hidden border hover:opacity-90 transition-opacity">
            <img src={p.photo_url_thumbnail || p.photo_url_web || ""} alt={p.description || ""} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selected.captured_by_name || "Photo"}</DialogTitle>
            </DialogHeader>
            <img src={selected.photo_url_web || selected.photo_url_thumbnail || ""} alt="" className="w-full rounded-lg" />
            <div className="text-sm text-muted-foreground space-y-1">
              {selected.captured_at && <p>Taken: {format(new Date(selected.captured_at), "MMM d, yyyy · h:mm a")}</p>}
              {selected.description && <p>{selected.description}</p>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Daily Log Tab ────────────────────────────────────────────────────────────

function DailyLogTab({ detail, isAdmin, user, woId, onRefresh }: { detail: WorkOrder; isAdmin: boolean; user: any; woId: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = detail.daily_logs?.find(l => l.log_date === today);

  const [form, setForm] = useState({
    work_completed: todayLog?.work_completed || "",
    crew_notes: todayLog?.crew_notes || "",
    materials_needed_tomorrow: todayLog?.materials_needed_tomorrow || "",
    truck_emptied: todayLog?.truck_emptied || false,
    truck_loaded: todayLog?.truck_loaded || false,
    truck_fueled: todayLog?.truck_fueled || false,
    truck_clean: todayLog?.truck_clean || false,
    truck_notes: todayLog?.truck_notes || "",
    office_update: todayLog?.office_update || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await apiRequest("POST", `/api/work-orders/${woId}/daily-logs`, { ...form, log_date: today });
      onRefresh();
      toast({ title: "Daily log saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Today's form */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-4">
          <p className="text-sm font-semibold">Today's Log — {format(new Date(), "MMMM d, yyyy")}</p>
          <div>
            <Label>Work Completed Today</Label>
            <Textarea value={form.work_completed} onChange={e => set("work_completed", e.target.value)} placeholder="Describe what was accomplished…" rows={3} />
          </div>
          <div>
            <Label>Crew Notes / Issues</Label>
            <Textarea value={form.crew_notes} onChange={e => set("crew_notes", e.target.value)} placeholder="Any issues, delays, or notes for the office…" rows={2} />
          </div>
          <div>
            <Label>Materials Needed Tomorrow</Label>
            <Textarea value={form.materials_needed_tomorrow} onChange={e => set("materials_needed_tomorrow", e.target.value)} placeholder="List materials to load or order…" rows={2} />
          </div>
          {isAdmin && (
            <div>
              <Label>Office Update (Admin)</Label>
              <Textarea value={form.office_update} onChange={e => set("office_update", e.target.value)} placeholder="Notes from the office…" rows={2} />
            </div>
          )}
          <div>
            <p className="text-sm font-medium mb-2">Truck / Equipment</p>
            <div className="grid grid-cols-2 gap-2">
              {[["truck_emptied", "Emptied"], ["truck_loaded", "Loaded"], ["truck_fueled", "Fueled"], ["truck_clean", "Cleaned"]].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={(form as any)[key]} onCheckedChange={v => set(key, !!v)} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <Textarea value={form.truck_notes} onChange={e => set("truck_notes", e.target.value)} placeholder="Truck notes (damage, issues)…" rows={1} className="mt-2" />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Save Log
          </Button>
        </CardContent>
      </Card>

      {/* Past logs */}
      {(detail.daily_logs || []).filter(l => l.log_date !== today).map(log => (
        <Card key={log.id} className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">{format(parseISO(log.log_date), "MMMM d, yyyy")}</p>
              {log.submitted_by && <span className="text-xs text-muted-foreground">by {log.submitted_by}</span>}
            </div>
            {log.work_completed && <p className="text-sm mb-1"><span className="font-medium">Work done: </span>{log.work_completed}</p>}
            {log.crew_notes && <p className="text-sm mb-1"><span className="font-medium">Notes: </span>{log.crew_notes}</p>}
            {log.materials_needed_tomorrow && <p className="text-sm mb-1"><span className="font-medium">Materials needed: </span>{log.materials_needed_tomorrow}</p>}
            {log.office_update && <p className="text-sm mb-1"><span className="font-medium">Office: </span>{log.office_update}</p>}
            <div className="flex gap-3 mt-2">
              {[["Emptied", log.truck_emptied], ["Loaded", log.truck_loaded], ["Fueled", log.truck_fueled], ["Clean", log.truck_clean]].map(([label, val]) => (
                <span key={label as string} className={`text-xs ${val ? "text-green-600" : "text-muted-foreground"}`}>
                  {val ? "✓" : "✗"} {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Edit WO Dialog ───────────────────────────────────────────────────────────

function EditWODialog({ detail, onClose, onSaved }: { detail: WorkOrder; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [woType, setWoType] = useState<WOType>(detail.wo_type);
  const [form, setForm] = useState({
    title: detail.title || "",
    description: detail.description || "",
    job_id: detail.job_id || "none",
    service_type_id: detail.service_type_id ? String(detail.service_type_id) : "none",
    crew_leader_id: detail.crew_leader_id || "none",
    scheduled_date: detail.scheduled_date || "",
    estimated_hours: detail.estimated_hours ? String(detail.estimated_hours) : "",
    estimated_completion_date: detail.estimated_completion_date || "",
    property_notes: detail.property_notes || "",
    site_access_notes: detail.site_access_notes || "",
    safety_notes: detail.safety_notes || "",
    customer_name: detail.customer_name || "",
    customer_address: detail.customer_address || "",
    customer_phone: detail.customer_phone || "",
    office_notes: detail.office_notes || "",
    contract_value: detail.contract_value || "",
    companycam_project_id: detail.companycam_project_id || "",
    priority: (detail.priority || "normal") as WOPriority,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: jobs = [] } = useQuery<any[]>({ queryKey: ["/api/jobs"], queryFn: () => fetch("/api/jobs").then(r => r.json()) });
  const { data: serviceTypes = [] } = useQuery<any[]>({ queryKey: ["/api/service-types"], queryFn: () => fetch("/api/service-types").then(r => r.json()) });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: () => fetch("/api/users").then(r => r.json()) });

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/work-orders/${detail.id}`, {
        ...form, wo_type: woType, status: detail.status,
        job_id: form.job_id !== "none" ? form.job_id : null,
        service_type_id: form.service_type_id !== "none" ? form.service_type_id : null,
        crew_leader_id: form.crew_leader_id !== "none" ? form.crew_leader_id : null,
        contract_value: form.contract_value ? Number(form.contract_value) : null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      });
      onSaved(); onClose();
      toast({ title: "Work order updated" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Work Order</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {/* WO Type — 6-option grid */}
          <div>
            <Label className="mb-2 block">Work Order Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_CFG) as [WOType, any][]).map(([type, cfg]) => {
                const { Icon } = cfg;
                const active = woType === type;
                return (
                  <button key={type} onClick={() => setWoType(type)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs font-medium transition-colors
                      ${active ? `${cfg.bg} ${cfg.color} border-current` : "border-muted hover:border-muted-foreground/40"}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-center leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority + Title */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type</Label>
              <Select value={form.service_type_id} onValueChange={v => set("service_type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(serviceTypes as any[]).map((st: any) => <SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          <div>
            <Label>Linked Job</Label>
            <Select value={form.job_id} onValueChange={v => set("job_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(jobs as any[]).map((j: any) => <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer / Site</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Customer Name</Label><Input value={form.customer_name} onChange={e => set("customer_name", e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={form.customer_phone} onChange={e => set("customer_phone", e.target.value)} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.customer_address} onChange={e => set("customer_address", e.target.value)} /></div>
            <div><Label>Site Access Notes</Label><Textarea value={form.site_access_notes} onChange={e => set("site_access_notes", e.target.value)} rows={2} /></div>
          </div>

          {/* Safety Notes */}
          <div className="border border-red-200 rounded-lg p-3 bg-red-50/50">
            <Label className="text-red-700 font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />Safety Notes
            </Label>
            <Textarea value={form.safety_notes} onChange={e => set("safety_notes", e.target.value)}
              placeholder="Hazards, required PPE, unsafe areas, chemical warnings, electrical concerns…"
              rows={2} className="border-red-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Scheduled Date</Label><Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} /></div>
            <div>
              <Label>Estimated Hours</Label>
              <Input type="number" step="0.5" min="0" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value)} placeholder="e.g. 4 or 8.5" />
            </div>
          </div>

          {PROJECT_TYPES.includes(woType) && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contract Value ($)</Label><Input type="number" value={form.contract_value} onChange={e => set("contract_value", e.target.value)} /></div>
              <div><Label>Est. Completion</Label><Input type="date" value={form.estimated_completion_date} onChange={e => set("estimated_completion_date", e.target.value)} /></div>
            </div>
          )}

          <div>
            <Label>Crew Leader</Label>
            <Select value={form.crew_leader_id} onValueChange={v => set("crew_leader_id", v)}>
              <SelectTrigger><SelectValue placeholder="Assign crew leader" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(users as any[]).filter((u: any) => u.role !== "Customer").map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Property Notes</Label><Textarea value={form.property_notes} onChange={e => set("property_notes", e.target.value)} rows={2} /></div>
          <div><Label>Office Instructions</Label><Textarea value={form.office_notes} onChange={e => set("office_notes", e.target.value)} rows={2} /></div>
          <div>
            <Label>CompanyCam Project ID</Label>
            <Input value={form.companycam_project_id} onChange={e => set("companycam_project_id", e.target.value)} placeholder="Paste CompanyCam project ID to link photos" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
