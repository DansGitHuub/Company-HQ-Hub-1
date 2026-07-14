import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  DragDropContext, Droppable, Draggable, DropResult,
} from "@hello-pangea/dnd";
import {
  Plus, Pencil, Trash2, Upload, GripVertical,
  Route, CheckCircle2, XCircle, ChevronDown, ChevronUp, Search, X, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CADENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-Weekly (Every 2 Weeks)" },
  { value: "custom", label: "Custom Interval (Days)" },
];

type MaintenanceRoute = {
  id: string;
  name: string;
  description: string | null;
  assigned_crew_id: string | null;
  crew_first_name: string | null;
  crew_last_name: string | null;
  cadence: string;
  interval_days: number | null;
  days_of_week: string[] | null;
  season_start: string | null;
  season_end: string | null;
  is_active: boolean;
  notes: string | null;
  stop_count: number;
};

type RouteStop = {
  id: string;
  route_id: string;
  property_id: string | null;
  sequence_order: number;
  expected_duration_minutes: number | null;
  service_notes: string | null;
  expected_services: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  cust_first_name: string | null;
  cust_last_name: string | null;
  company_name: string | null;
};

type Property = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
};

// ── blank form shapes ─────────────────────────────────────────────────────────
const BLANK_ROUTE = {
  name: "",
  description: "",
  assigned_crew_id: "",
  cadence: "weekly",
  interval_days: "",
  days_of_week: [] as string[],
  season_start: "",
  season_end: "",
  is_active: true,
  notes: "",
};

// ── property label helper ─────────────────────────────────────────────────────
function stopLabel(stop: RouteStop) {
  const addr = [stop.address, stop.city, stop.state].filter(Boolean).join(", ");
  const who  = stop.company_name
    ? stop.company_name
    : [stop.cust_first_name, stop.cust_last_name].filter(Boolean).join(" ");
  return addr || who || "(unknown property)";
}

// ── inline property search ────────────────────────────────────────────────────
function PropertySearch({ onSelect }: { onSelect: (p: Property) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: results } = useQuery<Property[]>({
    queryKey: ["/api/properties", q],
    queryFn: () =>
      q.length >= 2
        ? fetch(`/api/properties?search=${encodeURIComponent(q)}`).then((r) => r.json())
        : Promise.resolve([]),
    enabled: q.length >= 2,
  });

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          data-testid="input-property-search"
          placeholder="Search property address or customer…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {q && (
          <Button size="icon" variant="ghost" onClick={() => { setQ(""); setOpen(false); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && results && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-56 overflow-y-auto">
          {results.map((p) => {
            const addr = [p.address, p.city, p.state].filter(Boolean).join(", ");
            const who  = p.company_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
            return (
              <button
                key={p.id}
                data-testid={`option-property-${p.id}`}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex flex-col"
                onMouseDown={() => {
                  onSelect(p);
                  setQ("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{addr}</span>
                {who && <span className="text-muted-foreground text-xs">{who}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Route Builder Dialog ──────────────────────────────────────────────────────
type BuilderProps = {
  route: MaintenanceRoute | null;
  open: boolean;
  onClose: () => void;
};

function RouteBuilderDialog({ route, open, onClose }: BuilderProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!route;

  const [form, setForm] = useState({ ...BLANK_ROUTE });
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [tab, setTab] = useState("details");
  const [stopBeingEdited, setStopBeingEdited] = useState<string | null>(null);

  // Load employees for crew picker
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
    enabled: open,
  });

  // When dialog opens/changes, seed form
  const handleOpen = useCallback(() => {
    if (route) {
      setForm({
        name: route.name || "",
        description: route.description || "",
        assigned_crew_id: route.assigned_crew_id || "",
        cadence: route.cadence || "weekly",
        interval_days: route.interval_days?.toString() || "",
        days_of_week: route.days_of_week || [],
        season_start: route.season_start || "",
        season_end: route.season_end || "",
        is_active: route.is_active,
        notes: route.notes || "",
      });
    } else {
      setForm({ ...BLANK_ROUTE });
    }
    setTab("details");
  }, [route]);

  // Load stops when editing
  const { data: loadedStops } = useQuery<RouteStop[]>({
    queryKey: [`/api/maintenance-routes/${route?.id}/stops`],
    queryFn: () => fetch(`/api/maintenance-routes/${route?.id}/stops`).then((r) => r.json()),
    enabled: !!route?.id && open,
  });

  // Sync loaded stops into local state
  useState(() => {
    if (loadedStops) setStops(loadedStops);
  });
  if (loadedStops && stops !== loadedStops && stops.length === 0 && loadedStops.length > 0) {
    setStops(loadedStops);
  }

  // Save route mutation
  const saveRoute = useMutation({
    mutationFn: async (payload: typeof BLANK_ROUTE) => {
      const body = {
        ...payload,
        interval_days: payload.cadence === "custom" && payload.interval_days
          ? parseInt(payload.interval_days, 10) : null,
        assigned_crew_id: payload.assigned_crew_id || null,
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/maintenance-routes/${route!.id}`, body);
      }
      return apiRequest("POST", "/api/maintenance-routes", body);
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance-routes"] });
      toast({ title: isEdit ? "Route updated" : "Route created", description: form.name });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Add stop
  const addStop = useMutation({
    mutationFn: (property: Property) =>
      apiRequest("POST", `/api/maintenance-routes/${route!.id}/stops`, {
        property_id: property.id,
      }),
    onSuccess: (data: RouteStop) => {
      setStops((prev) => [...prev, data]);
      qc.invalidateQueries({ queryKey: ["/api/maintenance-routes"] });
    },
    onError: (e: any) => toast({ title: "Error adding stop", description: e.message, variant: "destructive" }),
  });

  // Remove stop
  const removeStop = useMutation({
    mutationFn: (stopId: string) =>
      apiRequest("DELETE", `/api/maintenance-routes/${route!.id}/stops/${stopId}`, {}),
    onSuccess: (_, stopId) => {
      setStops((prev) => prev.filter((s) => s.id !== stopId));
      qc.invalidateQueries({ queryKey: ["/api/maintenance-routes"] });
    },
    onError: (e: any) => toast({ title: "Error removing stop", description: e.message, variant: "destructive" }),
  });

  // Update stop inline
  const updateStop = useMutation({
    mutationFn: ({ stopId, patch }: { stopId: string; patch: Partial<RouteStop> }) =>
      apiRequest("PUT", `/api/maintenance-routes/${route!.id}/stops/${stopId}`, patch),
    onSuccess: (updated: RouteStop) => {
      setStops((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    },
    onError: (e: any) => toast({ title: "Error updating stop", description: e.message, variant: "destructive" }),
  });

  // Reorder drag-end
  const reorderMutation = useMutation({
    mutationFn: (order: Array<{ id: string; sequence_order: number }>) =>
      apiRequest("POST", `/api/maintenance-routes/${route!.id}/stops/reorder`, { order }),
    onError: (e: any) => toast({ title: "Reorder failed", description: e.message, variant: "destructive" }),
  });

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const reordered = Array.from(stops);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const withOrder = reordered.map((s, i) => ({ ...s, sequence_order: i + 1 }));
    setStops(withOrder);
    reorderMutation.mutate(withOrder.map((s) => ({ id: s.id, sequence_order: s.sequence_order })));
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter((d) => d !== day)
        : [...f.days_of_week, day],
    }));
  }

  const crewOptions = employees?.filter((e) =>
    ["Admin", "Manager"].includes(e.role) || e.status === "active"
  ) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Route: ${route!.name}` : "New Maintenance Route"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="details" data-testid="tab-route-details">Route Details</TabsTrigger>
            <TabsTrigger value="stops" data-testid="tab-route-stops" disabled={!isEdit}>
              Stops {isEdit ? `(${stops.length})` : "— save first"}
            </TabsTrigger>
          </TabsList>

          {/* ── Details Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Route Name *</Label>
                <Input
                  data-testid="input-route-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. North Side Residential"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Input
                  data-testid="input-route-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <Label>Cadence</Label>
                <Select
                  value={form.cadence}
                  onValueChange={(v) => setForm((f) => ({ ...f, cadence: v }))}
                >
                  <SelectTrigger data-testid="select-cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CADENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.cadence === "custom" && (
                <div>
                  <Label>Repeat Every (days)</Label>
                  <Input
                    data-testid="input-interval-days"
                    type="number"
                    min="1"
                    value={form.interval_days}
                    onChange={(e) => setForm((f) => ({ ...f, interval_days: e.target.value }))}
                    placeholder="e.g. 10"
                  />
                </div>
              )}

              <div className="col-span-2">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <Checkbox
                        data-testid={`checkbox-day-${d}`}
                        checked={form.days_of_week.includes(d)}
                        onCheckedChange={() => toggleDay(d)}
                      />
                      <span className="text-sm">{d.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Season Start (MM-DD)</Label>
                <Input
                  data-testid="input-season-start"
                  value={form.season_start}
                  onChange={(e) => setForm((f) => ({ ...f, season_start: e.target.value }))}
                  placeholder="04-01"
                />
              </div>
              <div>
                <Label>Season End (MM-DD)</Label>
                <Input
                  data-testid="input-season-end"
                  value={form.season_end}
                  onChange={(e) => setForm((f) => ({ ...f, season_end: e.target.value }))}
                  placeholder="11-30"
                />
              </div>

              <div className="col-span-2">
                <Label>Assigned Crew</Label>
                <Select
                  value={form.assigned_crew_id || "__none__"}
                  onValueChange={(v) => setForm((f) => ({ ...f, assigned_crew_id: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-crew">
                    <SelectValue placeholder="Select crew member…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {crewOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.first_name} {e.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea
                  data-testid="textarea-route-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Internal notes…"
                />
              </div>

              <div className="col-span-2 flex items-center gap-3">
                <Switch
                  data-testid="switch-is-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label>Active Route</Label>
              </div>
            </div>
          </TabsContent>

          {/* ── Stops Tab ───────────────────────────────────────────────────── */}
          <TabsContent value="stops" className="space-y-4">
            <div>
              <Label className="mb-2 block">Add Property Stop</Label>
              <PropertySearch
                onSelect={(p) => {
                  if (!route) return;
                  addStop.mutate(p);
                }}
              />
            </div>

            {stops.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No stops yet. Search for a property above to add the first stop.
              </p>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="stops">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {stops.map((stop, idx) => (
                        <Draggable key={stop.id} draggableId={stop.id} index={idx}>
                          {(dp) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              data-testid={`stop-row-${stop.id}`}
                              className="border rounded-lg p-3 bg-card"
                            >
                              <div className="flex items-start gap-2">
                                <div {...dp.dragHandleProps} className="mt-1 cursor-grab text-muted-foreground">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-sm truncate">
                                      <span className="text-muted-foreground mr-1">#{idx + 1}</span>
                                      {stopLabel(stop)}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        data-testid={`btn-expand-stop-${stop.id}`}
                                        onClick={() => setStopBeingEdited(stopBeingEdited === stop.id ? null : stop.id)}
                                      >
                                        {stopBeingEdited === stop.id
                                          ? <ChevronUp className="h-3 w-3" />
                                          : <ChevronDown className="h-3 w-3" />}
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        data-testid={`btn-remove-stop-${stop.id}`}
                                        onClick={() => removeStop.mutate(stop.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>

                                  {stopBeingEdited === stop.id && (
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-xs">Duration (min)</Label>
                                        <Input
                                          type="number"
                                          data-testid={`input-stop-duration-${stop.id}`}
                                          defaultValue={stop.expected_duration_minutes ?? ""}
                                          onBlur={(e) => {
                                            const v = e.target.value ? parseInt(e.target.value, 10) : null;
                                            updateStop.mutate({
                                              stopId: stop.id,
                                              patch: {
                                                property_id: stop.property_id,
                                                sequence_order: stop.sequence_order,
                                                expected_duration_minutes: v,
                                                service_notes: stop.service_notes,
                                                expected_services: stop.expected_services,
                                              },
                                            });
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">Expected Services</Label>
                                        <Input
                                          data-testid={`input-stop-services-${stop.id}`}
                                          defaultValue={stop.expected_services ?? ""}
                                          placeholder="Mow, Edge, Blow…"
                                          onBlur={(e) => {
                                            updateStop.mutate({
                                              stopId: stop.id,
                                              patch: {
                                                property_id: stop.property_id,
                                                sequence_order: stop.sequence_order,
                                                expected_duration_minutes: stop.expected_duration_minutes,
                                                service_notes: stop.service_notes,
                                                expected_services: e.target.value || null,
                                              },
                                            });
                                          }}
                                        />
                                      </div>
                                      <div className="col-span-2">
                                        <Label className="text-xs">Service Notes</Label>
                                        <Textarea
                                          data-testid={`textarea-stop-notes-${stop.id}`}
                                          rows={2}
                                          defaultValue={stop.service_notes ?? ""}
                                          placeholder="Gate code, pet, special instructions…"
                                          onBlur={(e) => {
                                            updateStop.mutate({
                                              stopId: stop.id,
                                              patch: {
                                                property_id: stop.property_id,
                                                sequence_order: stop.sequence_order,
                                                expected_duration_minutes: stop.expected_duration_minutes,
                                                service_notes: e.target.value || null,
                                                expected_services: stop.expected_services,
                                              },
                                            });
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="btn-cancel-route">
            Cancel
          </Button>
          {tab === "details" && (
            <Button
              onClick={() => saveRoute.mutate(form)}
              disabled={saveRoute.isPending || !form.name.trim()}
              data-testid="btn-save-route"
            >
              {saveRoute.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Route"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MaintenanceRoutesPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<MaintenanceRoute | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRoute | null>(null);
  const [search, setSearch] = useState("");

  const { data: routes, isLoading } = useQuery<MaintenanceRoute[]>({
    queryKey: ["/api/maintenance-routes"],
    queryFn: () => fetch("/api/maintenance-routes").then((r) => r.json()),
  });

  const deleteRoute = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/maintenance-routes/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance-routes"] });
      toast({ title: "Route deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = (routes ?? []).filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  function cadenceLabel(r: MaintenanceRoute) {
    if (r.cadence === "weekly") return "Weekly";
    if (r.cadence === "bi-weekly") return "Bi-Weekly";
    if (r.cadence === "custom" && r.interval_days) return `Every ${r.interval_days}d`;
    return r.cadence;
  }

  function openCreate() {
    setEditingRoute(null);
    setBuilderOpen(true);
  }

  function openEdit(route: MaintenanceRoute) {
    setEditingRoute(route);
    setBuilderOpen(true);
  }

  const generateVisitsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/maintenance-visits/generate").then((r: any) => r.json()),
    onSuccess: (data: any) => {
      toast({
        title: "Visits generated",
        description: data.message ?? "Done.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message ?? "Failed to generate visits.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Route className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Maintenance Routes</h1>
            <p className="text-sm text-muted-foreground">
              Manage recurring maintenance routes with cadence, season windows, and ordered stops.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => generateVisitsMutation.mutate()}
            disabled={generateVisitsMutation.isPending}
            data-testid="btn-generate-visits"
          >
            {generateVisitsMutation.isPending
              ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              : <><RefreshCw className="h-4 w-4 mr-2" />Generate Visits</>
            }
          </Button>
          <Button variant="outline" onClick={() => navigate("/maintenance-routes/import")} data-testid="btn-import-csv">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={openCreate} data-testid="btn-new-route">
            <Plus className="h-4 w-4 mr-2" />
            New Route
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-routes"
          className="pl-9"
          placeholder="Filter routes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Route Name</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cadence</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Days</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Season</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Crew</th>
              <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Stops</th>
              <th className="text-center px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {search ? "No routes match your filter." : "No maintenance routes yet. Click \"New Route\" to create one."}
                  </td>
                </tr>
              )
              : filtered.map((route) => (
                <tr key={route.id} data-testid={`row-route-${route.id}`} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium">{route.name}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="secondary">{cadenceLabel(route)}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {route.days_of_week?.map((d) => d.slice(0, 3)).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {route.season_start && route.season_end
                      ? `${route.season_start} – ${route.season_end}`
                      : route.season_start || route.season_end || "Year-round"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {route.crew_first_name
                      ? `${route.crew_first_name} ${route.crew_last_name}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <Badge variant="outline">{route.stop_count}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {route.is_active
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`btn-edit-route-${route.id}`}
                        onClick={() => openEdit(route)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`btn-delete-route-${route.id}`}
                        onClick={() => setDeleteTarget(route)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Builder dialog */}
      <RouteBuilderDialog
        route={editingRoute}
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingRoute(null); }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all of its stops.
              Visits already completed are removed too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-confirm-delete"
              onClick={() => deleteRoute.mutate(deleteTarget!.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
