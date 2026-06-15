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
  Package, Shield
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

type WOStatus = "draft" | "ready" | "in_progress" | "on_hold" | "complete";
type WOType   = "maintenance" | "installation";
type MatStatus = "needed" | "loaded" | "used";

interface WorkOrder {
  id: number;
  job_id: string | null;
  job_title: string | null;
  title: string;
  description: string | null;
  status: WOStatus;
  wo_type: WOType;
  scheduled_date: string | null;
  estimated_completion_date: string | null;
  estimated_duration: string | null;
  office_notes: string | null;
  property_notes: string | null;
  site_access_notes: string | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_phone: string | null;
  contract_value: string | null;
  companycam_project_id: string | null;
  service_type_id: number | null;
  service_type_name: string | null;
  crew_leader_id: string | null;
  crew_leader_name: string | null;
  crew_leader_first: string | null;
  crew_leader_last: string | null;
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
  wo_checklist?: ChecklistItem[];
  steps?: any[];
  daily_logs?: DailyLog[];
  time_entries?: TimeEntry[];
  companycam_photos?: CcPhoto[];
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
  return type === "installation"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"><HardHat className="w-3 h-3" />Installation</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><Wrench className="w-3 h-3" />Maintenance</span>;
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
        <div className="flex gap-1 flex-wrap">
          {["all", ...STATUS_ORDER].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} data-testid={`filter-status-${s}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {s === "all" ? "All Status" : STATUS_CFG[s as WOStatus]?.label}
            </button>
          ))}
          <button onClick={() => setTypeFilter(typeFilter === "maintenance" ? "all" : "maintenance")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${typeFilter === "maintenance" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            <Wrench className="w-3 h-3 inline mr-1" />Maint.
          </button>
          <button onClick={() => setTypeFilter(typeFilter === "installation" ? "all" : "installation")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${typeFilter === "installation" ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            <HardHat className="w-3 h-3 inline mr-1" />Install
          </button>
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
  const [woType, setWoType] = useState<WOType>("maintenance");
  const [form, setForm] = useState({
    title: "", description: "", job_id: "none", service_type_id: "none",
    crew_leader_id: "none", scheduled_date: "", estimated_duration: "",
    property_notes: "", site_access_notes: "", customer_name: "", customer_address: "",
    customer_phone: "", office_notes: "", contract_value: "", estimated_completion_date: "",
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
        service_type_id: form.service_type_id !== "none" ? Number(form.service_type_id) : null,
        crew_leader_id: form.crew_leader_id !== "none" ? form.crew_leader_id : null,
        contract_value: form.contract_value ? Number(form.contract_value) : null,
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
          {/* WO Type */}
          <div>
            <Label className="mb-2 block">Work Order Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setWoType("maintenance")} data-testid="btn-type-maintenance"
                className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-colors ${woType === "maintenance" ? "border-emerald-500 bg-emerald-50" : "border-muted hover:border-muted-foreground/40"}`}>
                <Wrench className={`w-6 h-6 ${woType === "maintenance" ? "text-emerald-600" : "text-muted-foreground"}`} />
                <span className="font-semibold text-sm">Maintenance</span>
                <span className="text-xs text-muted-foreground text-center">Recurring service, cleanups, mowing</span>
              </button>
              <button onClick={() => setWoType("installation")} data-testid="btn-type-installation"
                className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-colors ${woType === "installation" ? "border-purple-500 bg-purple-50" : "border-muted hover:border-muted-foreground/40"}`}>
                <HardHat className={`w-6 h-6 ${woType === "installation" ? "text-purple-600" : "text-muted-foreground"}`} />
                <span className="font-semibold text-sm">Installation</span>
                <span className="text-xs text-muted-foreground text-center">Patios, walls, plantings, full projects</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label>Work Order Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder={woType === "maintenance" ? "e.g. Spring Cleanup — Smith Residence" : "e.g. Back Patio Installation — Johnson Property"} data-testid="input-wo-title" />
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          {/* Scheduling */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scheduled Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} data-testid="input-wo-date" />
            </div>
            <div>
              <Label>Est. Duration</Label>
              <Input value={form.estimated_duration} onChange={e => set("estimated_duration", e.target.value)} placeholder="e.g. 6 hours, 2 days" />
            </div>
          </div>

          {/* Installation-only fields */}
          {woType === "installation" && (
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
            <Textarea value={form.office_notes} onChange={e => set("office_notes", e.target.value)} placeholder="Special instructions, safety notes, priority areas…" rows={2} />
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

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/work-orders", id] });
    onRefresh();
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
                <Select value={detail.status} onValueChange={onStatusChange}>
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
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ detail }: { detail: WorkOrder }) {
  return (
    <div className="space-y-4">
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {detail.scheduled_date && <div><span className="text-muted-foreground">Date:</span> {format(parseISO(detail.scheduled_date), "MMMM d, yyyy")}</div>}
            {detail.estimated_duration && <div><span className="text-muted-foreground">Duration:</span> {detail.estimated_duration}</div>}
            {detail.wo_type === "installation" && detail.estimated_completion_date && (
              <div><span className="text-muted-foreground">Est. Complete:</span> {format(parseISO(detail.estimated_completion_date), "MMMM d, yyyy")}</div>
            )}
            {detail.contract_value && (
              <div><span className="text-muted-foreground">Contract:</span> ${Number(detail.contract_value).toLocaleString()}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Crew */}
      {(detail.crew_leader_first || detail.crew_leader_name) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Crew</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {detail.crew_leader_first && detail.crew_leader_last
                    ? `${detail.crew_leader_first} ${detail.crew_leader_last}`
                    : detail.crew_leader_name}
                </p>
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

function AreasTab({ detail, isAdmin, woId, onRefresh }: { detail: WorkOrder; isAdmin: boolean; woId: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const [addAreaOpen, setAddAreaOpen] = useState(false);
  const [areaForm, setAreaForm] = useState({ name: "", description: "", estimated_hours: "" });
  const [savingArea, setSavingArea] = useState(false);

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

  const areas = detail.areas || [];

  return (
    <div className="space-y-4">
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
        <AreaCard key={area.id} area={area} woId={woId} isAdmin={isAdmin} woType={detail.wo_type} onRefresh={onRefresh} />
      ))}

      {/* WO-level materials (not scoped to an area) */}
      {(detail.wo_materials || []).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">General Materials</p>
            <div className="space-y-2">
              {(detail.wo_materials || []).map(m => <MaterialRow key={m.id} mat={m} woId={woId} onRefresh={onRefresh} isAdmin={isAdmin} />)}
            </div>
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

function AreaCard({ area, woId, isAdmin, woType, onRefresh }: { area: Area; woId: number; isAdmin: boolean; woType: WOType; onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addMatOpen, setAddMatOpen] = useState(false);
  const [addCheckOpen, setAddCheckOpen] = useState(false);
  const [addHoldOpen, setAddHoldOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", requires_photo: false });
  const [matForm, setMatForm] = useState({ item_name: "", quantity: "", unit: "", notes: "" });
  const [checkLabel, setCheckLabel] = useState("");
  const [holdForm, setHoldForm] = useState({ label: "", description: "" });

  const done  = area.tasks.filter(t => t.is_complete).length;
  const total = area.tasks.length;

  const save = async (path: string, body: object) => {
    await apiRequest("POST", path, body);
    onRefresh();
  };

  const deleteArea = async () => {
    if (!confirm(`Delete area "${area.name}"?`)) return;
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/areas/${area.id}`, {});
      onRefresh();
    } catch { toast({ title: "Failed to delete area", variant: "destructive" }); }
  };

  return (
    <Card>
      <div className="px-4 pt-4 pb-2">
        {/* Area header */}
        <div className="flex items-center justify-between">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 text-left">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <span className="font-semibold">{area.name}</span>
            {total > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${done === total ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{done}/{total}</span>
            )}
            {area.estimated_hours && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Clock className="w-3 h-3" />{area.estimated_hours}h est.</span>
            )}
          </button>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive" onClick={deleteArea}><Trash2 className="w-3.5 h-3.5 mr-2" />Delete Area</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {area.description && open && <p className="text-sm text-muted-foreground mt-1 ml-6">{area.description}</p>}
      </div>

      {open && (
        <CardContent className="px-4 pb-4 pt-2 space-y-4">
          {/* Tasks */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tasks</p>
            {area.tasks.length === 0 && <p className="text-sm text-muted-foreground italic">No tasks added</p>}
            <div className="space-y-1">
              {area.tasks.map(task => (
                <TaskRow key={task.id} task={task} woId={woId} areaId={area.id} isAdmin={isAdmin} onRefresh={onRefresh} />
              ))}
            </div>
            {isAdmin && !addTaskOpen && (
              <button onClick={() => setAddTaskOpen(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1" data-testid={`btn-add-task-${area.id}`}>
                <Plus className="w-3 h-3" />Add task
              </button>
            )}
            {isAdmin && addTaskOpen && (
              <div className="mt-2 space-y-2 p-3 bg-muted/40 rounded-lg">
                <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task description…" data-testid="input-task-title" />
                <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional details (optional)" rows={2} />
                <div className="flex items-center gap-2">
                  <Checkbox id="rp" checked={taskForm.requires_photo} onCheckedChange={c => setTaskForm(f => ({ ...f, requires_photo: !!c }))} />
                  <label htmlFor="rp" className="text-xs cursor-pointer">Requires photo</label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    if (!taskForm.title.trim()) return;
                    await save(`/api/work-orders/${woId}/areas/${area.id}/tasks`, taskForm);
                    setTaskForm({ title: "", description: "", requires_photo: false });
                    setAddTaskOpen(false);
                  }}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Materials */}
          {(area.materials.length > 0 || isAdmin) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Materials</p>
              {area.materials.length === 0 && <p className="text-sm text-muted-foreground italic">No materials listed</p>}
              <div className="space-y-1.5">
                {area.materials.map(m => <MaterialRow key={m.id} mat={m} woId={woId} onRefresh={onRefresh} isAdmin={isAdmin} />)}
              </div>
              {isAdmin && !addMatOpen && (
                <button onClick={() => setAddMatOpen(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1" data-testid={`btn-add-mat-${area.id}`}>
                  <Plus className="w-3 h-3" />Add material
                </button>
              )}
              {isAdmin && addMatOpen && (
                <div className="mt-2 space-y-2 p-3 bg-muted/40 rounded-lg">
                  <Input value={matForm.item_name} onChange={e => setMatForm(f => ({ ...f, item_name: e.target.value }))} placeholder="Item name" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" value={matForm.quantity} onChange={e => setMatForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Qty" />
                    <Input value={matForm.unit} onChange={e => setMatForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unit (bags, sqft…)" />
                  </div>
                  <Input value={matForm.notes} onChange={e => setMatForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      if (!matForm.item_name.trim()) return;
                      await save(`/api/work-orders/${woId}/materials`, { ...matForm, area_id: area.id, quantity: matForm.quantity ? Number(matForm.quantity) : null });
                      setMatForm({ item_name: "", quantity: "", unit: "", notes: "" });
                      setAddMatOpen(false);
                    }}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddMatOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quality Checklist */}
          {(area.checklist.length > 0 || isAdmin) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quality Checklist</p>
              {area.checklist.length === 0 && <p className="text-sm text-muted-foreground italic">No checklist items</p>}
              <div className="space-y-1">
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
                <div className="mt-2 flex gap-2">
                  <Input value={checkLabel} onChange={e => setCheckLabel(e.target.value)} placeholder="Checklist item…" className="flex-1" />
                  <Button size="sm" onClick={async () => {
                    if (!checkLabel.trim()) return;
                    await save(`/api/work-orders/${woId}/checklists`, { label: checkLabel, area_id: area.id });
                    setCheckLabel(""); setAddCheckOpen(false);
                  }}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddCheckOpen(false)}>Cancel</Button>
                </div>
              )}
            </div>
          )}

          {/* Hold Points (installation only) */}
          {woType === "installation" && (area.hold_points.length > 0 || isAdmin) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1"><Shield className="w-3 h-3" />Inspection Hold Points</p>
              {area.hold_points.length === 0 && <p className="text-sm text-muted-foreground italic">No hold points</p>}
              <div className="space-y-1.5">
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
        </CardContent>
      )}
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
    estimated_duration: detail.estimated_duration || "",
    estimated_completion_date: detail.estimated_completion_date || "",
    property_notes: detail.property_notes || "",
    site_access_notes: detail.site_access_notes || "",
    customer_name: detail.customer_name || "",
    customer_address: detail.customer_address || "",
    customer_phone: detail.customer_phone || "",
    office_notes: detail.office_notes || "",
    contract_value: detail.contract_value || "",
    companycam_project_id: detail.companycam_project_id || "",
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
        service_type_id: form.service_type_id !== "none" ? Number(form.service_type_id) : null,
        crew_leader_id: form.crew_leader_id !== "none" ? form.crew_leader_id : null,
        contract_value: form.contract_value ? Number(form.contract_value) : null,
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
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setWoType("maintenance")} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${woType === "maintenance" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-muted"}`}><Wrench className="w-4 h-4" />Maintenance</button>
            <button onClick={() => setWoType("installation")} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${woType === "installation" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-muted"}`}><HardHat className="w-4 h-4" />Installation</button>
          </div>
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Scheduled Date</Label><Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} /></div>
            <div><Label>Est. Duration</Label><Input value={form.estimated_duration} onChange={e => set("estimated_duration", e.target.value)} /></div>
          </div>
          {woType === "installation" && (
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
