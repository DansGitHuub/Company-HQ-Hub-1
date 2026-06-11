import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Plus, Search, ClipboardList, CheckCircle2, Circle, Camera,
  Truck, Package, BookOpen, Calendar, Users, ChevronRight, Trash2,
  MoreHorizontal, Edit2, Upload, X, AlertCircle, Loader2, FileText,
  CheckSquare, Boxes
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

type WOStatus = "draft" | "ready" | "in_progress" | "on_hold" | "complete";

interface WorkOrder {
  id: number;
  job_id: number | null;
  job_title: string | null;
  title: string;
  description: string | null;
  status: WOStatus;
  scheduled_date: string | null;
  office_notes: string | null;
  assigned_crew: { id: number; name: string }[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_steps?: number;
  complete_steps?: number;
  total_materials?: number;
  steps?: Step[];
  materials?: Material[];
  daily_logs?: DailyLog[];
}

interface Step {
  id: number;
  work_order_id: number;
  step_number: number;
  title: string;
  description: string | null;
  requires_photo: boolean;
  is_complete: boolean;
  completed_by: string | null;
  completed_at: string | null;
  completion_note: string | null;
  photos: { url: string; uploaded_at: string }[];
}

interface Material {
  id: number;
  work_order_id: number;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  status: "needed" | "loaded" | "used";
  notes: string | null;
}

interface DailyLog {
  id: number;
  work_order_id: number;
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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WOStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: "Draft",       color: "text-slate-600",  bg: "bg-slate-100" },
  ready:       { label: "Ready",       color: "text-blue-700",   bg: "bg-blue-100" },
  in_progress: { label: "In Progress", color: "text-amber-700",  bg: "bg-amber-100" },
  on_hold:     { label: "On Hold",     color: "text-orange-700", bg: "bg-orange-100" },
  complete:    { label: "Complete",    color: "text-green-700",  bg: "bg-green-100" },
};

const STATUS_ORDER: WOStatus[] = ["draft", "ready", "in_progress", "on_hold", "complete"];

function StatusBadge({ status }: { status: WOStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

const MATERIAL_STATUS: Record<string, { label: string; color: string }> = {
  needed: { label: "Needed",  color: "bg-red-100 text-red-700" },
  loaded: { label: "Loaded",  color: "bg-blue-100 text-blue-700" },
  used:   { label: "Used",    color: "bg-green-100 text-green-700" },
};

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ done, total, size = 44 }: { done: number; total: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct === 1 ? "#16a34a" : "#f59e0b"} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#374151">
        {total > 0 ? `${Math.round(pct * 100)}%` : "—"}
      </text>
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdmin = user?.role === "Admin" || user?.role === "Manager" || (user as any)?.isMasterAdmin;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // ── List query ──
  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      return fetch(`/api/work-orders?${params}`).then(r => r.json());
    },
  });

  // ── Detail query ──
  const { data: detail, isLoading: detailLoading } = useQuery<WorkOrder>({
    queryKey: ["/api/work-orders", selectedId],
    queryFn: () => fetch(`/api/work-orders/${selectedId}`).then(r => r.json()),
    enabled: selectedId !== null,
  });

  // ── Jobs for dropdown ──
  const { data: jobs = [] } = useQuery<{ id: number; title: string }[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => fetch("/api/jobs").then(r => r.json()),
    enabled: createOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/work-orders"] });
  };

  // ── Status mutation ──
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/work-orders/${id}/status`, { status }),
    onSuccess: () => { invalidate(); toast({ title: "Status updated" }); },
  });

  // ── Delete mutation ──
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
        onBack={() => { setSelectedId(null); setActiveTab("overview"); }}
        onStatusChange={(status) => statusMut.mutate({ id: selectedId, status })}
        onDelete={() => deleteMut.mutate(selectedId)}
        onRefresh={invalidate}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Work Orders
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Step-by-step crew job guides with progress tracking</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-wo">
            <Plus className="w-4 h-4 mr-1" /> New Work Order
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search work orders..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-wo"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", ...STATUS_ORDER].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              data-testid={`filter-${s}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s as WOStatus]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
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
            const done = Number(wo.complete_steps || 0);
            const total = Number(wo.total_steps || 0);
            return (
              <Card
                key={wo.id}
                className="cursor-pointer hover:shadow-md transition-shadow border"
                onClick={() => setSelectedId(wo.id)}
                data-testid={`card-wo-${wo.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug truncate">{wo.title}</p>
                      {wo.job_title && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Job: {wo.job_title}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={wo.status} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      {wo.scheduled_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(wo.scheduled_date), "MMM d, yyyy")}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckSquare className="w-3 h-3" />
                        {done}/{total} steps
                      </div>
                      {Number(wo.total_materials) > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Boxes className="w-3 h-3" />
                          {wo.total_materials} materials
                        </div>
                      )}
                    </div>
                    <ProgressRing done={done} total={total} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <CreateWODialog
          jobs={jobs}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => { setCreateOpen(false); invalidate(); setSelectedId(id); }}
          user={user}
        />
      )}
    </div>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateWODialog({
  jobs, onClose, onCreated, user
}: {
  jobs: { id: number; title: string }[];
  onClose: () => void;
  onCreated: (id: number) => void;
  user: any;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "", description: "", job_id: "", scheduled_date: "", office_notes: ""
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/work-orders", {
        ...form,
        job_id: form.job_id || null,
        assigned_crew: [],
      });
      const data = await res.json();
      onCreated(data.id);
      toast({ title: "Work order created" });
    } catch {
      toast({ title: "Failed to create", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Install Back Patio — Smith Residence"
              data-testid="input-wo-title"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief overview of the work..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Linked Job (optional)</Label>
              <Select value={form.job_id} onValueChange={v => setForm(f => ({ ...f, job_id: v }))}>
                <SelectTrigger data-testid="select-wo-job">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                data-testid="input-wo-date"
              />
            </div>
          </div>
          <div>
            <Label>Office Notes / Instructions to Crew</Label>
            <Textarea
              value={form.office_notes}
              onChange={e => setForm(f => ({ ...f, office_notes: e.target.value }))}
              placeholder="Special instructions, safety notes, access codes..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} data-testid="button-save-wo">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create Work Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function DetailView({
  id, detail, isLoading, isAdmin, user, activeTab, setActiveTab, onBack, onStatusChange, onDelete, onRefresh
}: {
  id: number; detail?: WorkOrder; isLoading: boolean; isAdmin: boolean; user: any;
  activeTab: string; setActiveTab: (t: string) => void;
  onBack: () => void; onStatusChange: (s: string) => void; onDelete: () => void; onRefresh: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading || !detail) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const done = detail.steps?.filter(s => s.is_complete).length || 0;
  const total = detail.steps?.length || 0;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="mb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors" data-testid="button-back-wo">
          <ArrowLeft className="w-4 h-4" /> Back to Work Orders
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{detail.title}</h1>
              <StatusBadge status={detail.status} />
            </div>
            {detail.job_title && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">Job:</span> {detail.job_title}
              </p>
            )}
            {detail.scheduled_date && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Scheduled:</span> {format(parseISO(detail.scheduled_date), "MMMM d, yyyy")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <>
                <Select value={detail.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-wo-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                      <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-3.5 h-3.5 mr-1" /> Overview
          </TabsTrigger>
          <TabsTrigger value="steps" data-testid="tab-steps">
            <CheckSquare className="w-3.5 h-3.5 mr-1" /> Steps
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{done}/{total}</span>
          </TabsTrigger>
          <TabsTrigger value="materials" data-testid="tab-materials">
            <Boxes className="w-3.5 h-3.5 mr-1" /> Materials
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{detail.materials?.length || 0}</span>
          </TabsTrigger>
          <TabsTrigger value="daily-log" data-testid="tab-dailylog">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Daily Log
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{detail.daily_logs?.length || 0}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab detail={detail} done={done} total={total} />
        </TabsContent>
        <TabsContent value="steps">
          <StepsTab detail={detail} isAdmin={isAdmin} user={user} onRefresh={onRefresh} woId={id} />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsTab detail={detail} isAdmin={isAdmin} onRefresh={onRefresh} woId={id} />
        </TabsContent>
        <TabsContent value="daily-log">
          <DailyLogTab detail={detail} isAdmin={isAdmin} user={user} onRefresh={onRefresh} woId={id} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {editOpen && (
        <EditWODialog detail={detail} onClose={() => setEditOpen(false)} onSaved={onRefresh} />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Work Order?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will permanently delete the work order and all its steps, materials, and logs.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" onClick={onDelete}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ detail, done, total }: { detail: WorkOrder; done: number; total: number }) {
  const photoCount = detail.steps?.reduce((acc, s) => acc + (s.photos?.length || 0), 0) || 0;
  const loadedMats = detail.materials?.filter(m => m.status !== "needed").length || 0;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Steps Done" value={`${done}/${total}`} icon={<CheckSquare className="w-4 h-4" />} color="text-amber-600" />
        <StatCard label="Photos Taken" value={String(photoCount)} icon={<Camera className="w-4 h-4" />} color="text-blue-600" />
        <StatCard label="Materials Ready" value={`${loadedMats}/${detail.materials?.length || 0}`} icon={<Boxes className="w-4 h-4" />} color="text-purple-600" />
        <StatCard label="Log Entries" value={String(detail.daily_logs?.length || 0)} icon={<BookOpen className="w-4 h-4" />} color="text-green-600" />
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-lg">
        <ProgressRing done={done} total={total} size={60} />
        <div>
          <p className="font-medium text-sm">{total === 0 ? "No steps added yet" : done === total ? "All steps complete!" : `${total - done} step${total - done !== 1 ? "s" : ""} remaining`}</p>
          <p className="text-xs text-muted-foreground">{done} of {total} steps completed</p>
        </div>
      </div>

      {/* Description */}
      {detail.description && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Description</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.description}</p>
        </div>
      )}

      {/* Office notes */}
      {detail.office_notes && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> Office Notes / Instructions
          </h3>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{detail.office_notes}</p>
        </div>
      )}

      {/* Assigned crew */}
      {detail.assigned_crew?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Assigned Crew</h3>
          <div className="flex flex-wrap gap-2">
            {detail.assigned_crew.map((c, i) => (
              <span key={i} className="px-2 py-1 bg-secondary rounded-full text-xs font-medium">{c.name}</span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t">
        Created by {detail.created_by || "unknown"} · Last updated {format(parseISO(detail.updated_at), "MMM d, yyyy h:mm a")}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card border rounded-lg p-3 text-center">
      <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Steps Tab ────────────────────────────────────────────────────────────────

function StepsTab({ detail, isAdmin, user, onRefresh, woId }: {
  detail: WorkOrder; isAdmin: boolean; user: any; onRefresh: () => void; woId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editStep, setEditStep] = useState<Step | null>(null);
  const [completing, setCompleting] = useState<number | null>(null);
  const [completeNote, setCompleteNote] = useState("");
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/work-orders", woId] });

  const toggleComplete = async (step: Step) => {
    try {
      await apiRequest("PATCH", `/api/work-orders/${woId}/steps/${step.id}/complete`, {
        is_complete: !step.is_complete,
        completion_note: !step.is_complete ? completeNote : null,
      });
      setCompleting(null);
      setCompleteNote("");
      invalidate();
      onRefresh();
    } catch {
      toast({ title: "Failed to update step", variant: "destructive" });
    }
  };

  const deleteStep = async (stepId: number) => {
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/steps/${stepId}`);
      invalidate();
      onRefresh();
    } catch {
      toast({ title: "Failed to delete step", variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (stepId: number, file: File) => {
    setUploading(stepId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/work-orders/${woId}/steps/${stepId}/photos`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      invalidate();
      onRefresh();
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const deletePhoto = async (stepId: number, url: string) => {
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/steps/${stepId}/photos`, { url });
      invalidate();
      onRefresh();
    } catch {
      toast({ title: "Failed to delete photo", variant: "destructive" });
    }
  };

  const steps = detail.steps || [];

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-step">
            <Plus className="w-4 h-4 mr-1" /> Add Step
          </Button>
        </div>
      )}

      {steps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No steps yet</p>
          {isAdmin && <p className="text-sm">Add steps to guide the crew through this job</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              data-testid={`step-${step.id}`}
              className={`border rounded-lg p-4 transition-colors ${step.is_complete ? "bg-green-50 border-green-200" : "bg-card"}`}
            >
              <div className="flex items-start gap-3">
                {/* Step number / check */}
                <button
                  onClick={() => {
                    if (step.is_complete) {
                      toggleComplete(step);
                    } else {
                      setCompleting(step.id);
                    }
                  }}
                  className="flex-shrink-0 mt-0.5"
                  data-testid={`step-toggle-${step.id}`}
                >
                  {step.is_complete
                    ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                    : <Circle className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground">STEP {step.step_number}</span>
                    {step.requires_photo && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                        <Camera className="w-3 h-3" /> Photo required
                      </span>
                    )}
                  </div>
                  <p className={`font-semibold mt-0.5 ${step.is_complete ? "line-through text-muted-foreground" : ""}`}>
                    {step.title}
                  </p>
                  {step.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{step.description}</p>}
                  {step.is_complete && step.completed_by && (
                    <p className="text-xs text-green-700 mt-1">
                      ✓ Completed by {step.completed_by} · {step.completed_at ? format(parseISO(step.completed_at), "MMM d, h:mm a") : ""}
                    </p>
                  )}
                  {step.completion_note && (
                    <p className="text-xs text-muted-foreground italic mt-1">Note: {step.completion_note}</p>
                  )}

                  {/* Photos */}
                  {step.photos?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {step.photos.map((p, i) => (
                        <div key={i} className="relative group w-20 h-20">
                          <img src={p.url} alt="" className="w-20 h-20 object-cover rounded-md border" />
                          {isAdmin && (
                            <button
                              onClick={() => deletePhoto(step.id, p.url)}
                              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Photo upload */}
                  {(step.requires_photo || isAdmin) && !step.is_complete && (
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={uploadTargetId === step.id ? fileRef : undefined}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload(step.id, f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => {
                          setUploadTargetId(step.id);
                          setTimeout(() => fileRef.current?.click(), 50);
                        }}
                        disabled={uploading === step.id}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        data-testid={`upload-photo-${step.id}`}
                      >
                        {uploading === step.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                        {step.photos?.length ? "Add another photo" : "Upload photo"}
                      </button>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditStep(step)}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteStep(step.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Complete confirmation panel */}
              {completing === step.id && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <Textarea
                    placeholder="Add a completion note (optional)..."
                    value={completeNote}
                    onChange={e => setCompleteNote(e.target.value)}
                    rows={2}
                    className="text-sm"
                    data-testid={`complete-note-${step.id}`}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => toggleComplete(step)} data-testid={`confirm-complete-${step.id}`}>
                      Mark Complete
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setCompleting(null); setCompleteNote(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Step Dialog */}
      {(addOpen || editStep) && (
        <StepFormDialog
          woId={woId}
          step={editStep}
          nextNumber={(detail.steps?.length || 0) + 1}
          onClose={() => { setAddOpen(false); setEditStep(null); }}
          onSaved={() => { setAddOpen(false); setEditStep(null); invalidate(); onRefresh(); }}
        />
      )}
    </div>
  );
}

function StepFormDialog({ woId, step, nextNumber, onClose, onSaved }: {
  woId: number; step: Step | null; nextNumber: number;
  onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: step?.title || "",
    description: step?.description || "",
    requires_photo: step?.requires_photo || false,
    step_number: step?.step_number || nextNumber,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (step) {
        await apiRequest("PUT", `/api/work-orders/${woId}/steps/${step.id}`, form);
      } else {
        await apiRequest("POST", `/api/work-orders/${woId}/steps`, form);
      }
      onSaved();
      toast({ title: step ? "Step updated" : "Step added" });
    } catch {
      toast({ title: "Failed to save step", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{step ? "Edit Step" : "Add Step"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Step #</Label>
              <Input
                type="number"
                value={form.step_number}
                onChange={e => setForm(f => ({ ...f, step_number: Number(e.target.value) }))}
                min={1}
              />
            </div>
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Excavate area to 6 inches"
                data-testid="input-step-title"
              />
            </div>
          </div>
          <div>
            <Label>Description / Instructions</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detailed instructions for this step..."
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="req-photo"
              checked={form.requires_photo}
              onCheckedChange={v => setForm(f => ({ ...f, requires_photo: !!v }))}
            />
            <label htmlFor="req-photo" className="text-sm cursor-pointer flex items-center gap-1">
              <Camera className="w-4 h-4 text-blue-600" /> Require photo before marking complete
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-step">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {step ? "Save Changes" : "Add Step"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Materials Tab ────────────────────────────────────────────────────────────

function MaterialsTab({ detail, isAdmin, onRefresh, woId }: {
  detail: WorkOrder; isAdmin: boolean; onRefresh: () => void; woId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ item_name: "", quantity: "", unit: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/work-orders", woId] });

  const updateStatus = async (matId: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/work-orders/${woId}/materials/${matId}/status`, { status });
      invalidate();
      onRefresh();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const deleteMat = async (matId: number) => {
    try {
      await apiRequest("DELETE", `/api/work-orders/${woId}/materials/${matId}`);
      invalidate();
      onRefresh();
    } catch {
      toast({ title: "Failed to delete material", variant: "destructive" });
    }
  };

  const addMaterial = async () => {
    if (!form.item_name.trim()) { toast({ title: "Item name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apiRequest("POST", `/api/work-orders/${woId}/materials`, {
        ...form,
        quantity: form.quantity ? Number(form.quantity) : null,
      });
      setForm({ item_name: "", quantity: "", unit: "", notes: "" });
      setAddOpen(false);
      invalidate();
      onRefresh();
      toast({ title: "Material added" });
    } catch {
      toast({ title: "Failed to add material", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const materials = detail.materials || [];
  const statusGroups = {
    needed: materials.filter(m => m.status === "needed"),
    loaded: materials.filter(m => m.status === "loaded"),
    used:   materials.filter(m => m.status === "used"),
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-material">
            <Plus className="w-4 h-4 mr-1" /> Add Material
          </Button>
        </div>
      )}

      {materials.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Boxes className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No materials listed</p>
          {isAdmin && <p className="text-sm">Add materials to track what's needed on this job</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="text-left py-2 pr-3">Item</th>
                <th className="text-left py-2 pr-3">Qty</th>
                <th className="text-left py-2 pr-3">Unit</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Notes</th>
                {isAdmin && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.map(mat => (
                <tr key={mat.id} data-testid={`material-${mat.id}`} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 pr-3 font-medium">{mat.item_name}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{mat.quantity ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{mat.unit || "—"}</td>
                  <td className="py-2.5 pr-3">
                    <Select value={mat.status} onValueChange={v => updateStatus(mat.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-28" data-testid={`material-status-${mat.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needed">Needed</SelectItem>
                        <SelectItem value="loaded">Loaded</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground text-xs">{mat.notes || "—"}</td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => deleteMat(mat.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary chips */}
          <div className="flex gap-3 mt-4 flex-wrap">
            {Object.entries(statusGroups).map(([status, items]) => (
              <div key={status} className={`px-3 py-1 rounded-full text-xs font-medium ${MATERIAL_STATUS[status]?.color}`}>
                {items.length} {MATERIAL_STATUS[status]?.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Material Dialog */}
      {addOpen && (
        <Dialog open onOpenChange={() => setAddOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add Material</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Item Name *</Label>
                <Input
                  value={form.item_name}
                  onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
                  placeholder="e.g. Patio blocks"
                  data-testid="input-material-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="bags, sq ft..." />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={addMaterial} disabled={saving} data-testid="button-save-material">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Daily Log Tab ────────────────────────────────────────────────────────────

function DailyLogTab({ detail, isAdmin, user, onRefresh, woId }: {
  detail: WorkOrder; isAdmin: boolean; user: any; onRefresh: () => void; woId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const todayLog = detail.daily_logs?.find(l => l.log_date.slice(0, 10) === today);
  const pastLogs = detail.daily_logs?.filter(l => l.log_date.slice(0, 10) !== today) || [];

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/work-orders", woId] });

  const saveLog = async () => {
    setSaving(true);
    try {
      await apiRequest("POST", `/api/work-orders/${woId}/daily-logs`, { ...form, log_date: today });
      invalidate();
      onRefresh();
      toast({ title: "Daily log saved" });
    } catch {
      toast({ title: "Failed to save log", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const truckChecks: { key: keyof typeof form; label: string }[] = [
    { key: "truck_emptied", label: "Truck emptied / debris removed" },
    { key: "truck_loaded", label: "Truck loaded for tomorrow" },
    { key: "truck_fueled", label: "Truck fueled" },
    { key: "truck_clean", label: "Truck cleaned" },
  ];

  return (
    <div className="space-y-6">
      {/* Today's log form */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-1">
            <Calendar className="w-4 h-4 text-primary" />
            Today's Log — {format(new Date(), "MMMM d, yyyy")}
          </h3>
          {todayLog && (
            <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              ✓ Submitted {format(parseISO(todayLog.submitted_at), "h:mm a")}
            </span>
          )}
        </div>

        <div>
          <Label>What was completed today? *</Label>
          <Textarea
            value={form.work_completed}
            onChange={e => setForm(f => ({ ...f, work_completed: e.target.value }))}
            placeholder="Describe the work completed today..."
            rows={3}
            data-testid="input-log-completed"
          />
        </div>

        <div>
          <Label>Crew Notes / Issues</Label>
          <Textarea
            value={form.crew_notes}
            onChange={e => setForm(f => ({ ...f, crew_notes: e.target.value }))}
            placeholder="Any issues, concerns, or notes for the office..."
            rows={2}
            data-testid="input-log-notes"
          />
        </div>

        <div>
          <Label>Materials Needed Tomorrow</Label>
          <Textarea
            value={form.materials_needed_tomorrow}
            onChange={e => setForm(f => ({ ...f, materials_needed_tomorrow: e.target.value }))}
            placeholder="List any materials or supplies needed for the next day..."
            rows={2}
            data-testid="input-log-materials-tomorrow"
          />
        </div>

        <Separator />

        {/* Truck checklist */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
            <Truck className="w-4 h-4 text-primary" /> End-of-Day Truck Checklist
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {truckChecks.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={!!form[key]}
                  onCheckedChange={v => setForm(f => ({ ...f, [key]: !!v }))}
                  data-testid={`check-${key}`}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-2">
            <Label>Truck Notes</Label>
            <Input
              value={form.truck_notes}
              onChange={e => setForm(f => ({ ...f, truck_notes: e.target.value }))}
              placeholder="Any truck issues or notes..."
              data-testid="input-truck-notes"
            />
          </div>
        </div>

        {isAdmin && (
          <>
            <Separator />
            <div>
              <Label>Office Update (Admin / Manager only)</Label>
              <Textarea
                value={form.office_update}
                onChange={e => setForm(f => ({ ...f, office_update: e.target.value }))}
                placeholder="Notes from the office for this day..."
                rows={2}
                data-testid="input-office-update"
              />
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button onClick={saveLog} disabled={saving} data-testid="button-save-log">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {todayLog ? "Update Today's Log" : "Submit Daily Log"}
          </Button>
        </div>
      </div>

      {/* Past logs */}
      {pastLogs.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Previous Log Entries</h3>
          <div className="space-y-3">
            {pastLogs.map(log => (
              <div key={log.id} className="border rounded-lg p-4 bg-muted/20" data-testid={`log-${log.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{format(parseISO(log.log_date), "EEEE, MMMM d, yyyy")}</span>
                  {log.submitted_by && <span className="text-xs text-muted-foreground">by {log.submitted_by}</span>}
                </div>
                {log.work_completed && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-0.5">Completed</p>
                    <p className="text-sm whitespace-pre-wrap">{log.work_completed}</p>
                  </div>
                )}
                {log.crew_notes && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-0.5">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{log.crew_notes}</p>
                  </div>
                )}
                {log.materials_needed_tomorrow && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-0.5">Materials Needed Next Day</p>
                    <p className="text-sm whitespace-pre-wrap">{log.materials_needed_tomorrow}</p>
                  </div>
                )}
                {/* Truck status chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { checked: log.truck_emptied, label: "Emptied" },
                    { checked: log.truck_loaded, label: "Loaded" },
                    { checked: log.truck_fueled, label: "Fueled" },
                    { checked: log.truck_clean, label: "Clean" },
                  ].map(({ checked, label }) => (
                    <span
                      key={label}
                      className={`text-xs px-2 py-0.5 rounded-full ${checked ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"}`}
                    >
                      {checked ? "✓" : "✗"} Truck {label}
                    </span>
                  ))}
                </div>
                {log.office_update && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                    <span className="font-semibold">Office:</span> {log.office_update}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit WO Dialog ───────────────────────────────────────────────────────────

function EditWODialog({ detail, onClose, onSaved }: { detail: WorkOrder; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: detail.title,
    description: detail.description || "",
    job_id: detail.job_id ? String(detail.job_id) : "",
    scheduled_date: detail.scheduled_date ? detail.scheduled_date.slice(0, 10) : "",
    office_notes: detail.office_notes || "",
    status: detail.status,
  });
  const [saving, setSaving] = useState(false);

  const { data: jobs = [] } = useQuery<{ id: number; title: string }[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => fetch("/api/jobs").then(r => r.json()),
  });

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/work-orders/${detail.id}`, {
        ...form,
        job_id: form.job_id ? Number(form.job_id) : null,
        assigned_crew: detail.assigned_crew || [],
      });
      onSaved();
      onClose();
      toast({ title: "Work order updated" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Work Order</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Linked Job</Label>
              <Select value={form.job_id} onValueChange={v => setForm(f => ({ ...f, job_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {jobs.map(j => <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scheduled Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Office Notes</Label>
            <Textarea value={form.office_notes} onChange={e => setForm(f => ({ ...f, office_notes: e.target.value }))} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
