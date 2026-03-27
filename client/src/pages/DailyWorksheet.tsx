import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Send, Save, Trash2, ClipboardList, ChevronRight,
  Calendar, User, MapPin, FileText, CheckSquare, FlaskConical, Truck,
  Loader2, Eye, StickyNote
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const WEATHER_OPTIONS = [
  "Sunny", "Cloudy", "Windy", "Rainy", "Hot", "Cold", "Morning Frost", "PM Rain",
];

const CHEMICALS = [
  { key: "dimension",    name: "Dimension 62719-542" },
  { key: "brush_master", name: "Brush Master 2217-774" },
  { key: "cross_check",  name: "Cross Check 279315610404" },
  { key: "three_way",    name: "Three Way 10404-43" },
  { key: "roundup",      name: "Round-Up Quik Pro" },
];

const EQUIPMENT = [
  { key: "skid_steer",      name: "Skid Steer" },
  { key: "excavator",       name: "Excavator" },
  { key: "mt50",            name: "MT-50" },
  { key: "other_equipment", name: "Other Equipment" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamMember { name: string; arrival_time: string; departure_time: string; total_hours: string; notes: string; }
interface WorkItem    { description: string; man_hours: string; material: string; quantity: string; }
interface PunchItem   { description: string; }
interface ChemEntry   { quantity_gallons: string; location_of_spray: string; vendor: string; amount_dollars: string; }
interface EquipEntry  { purpose: string; hours: string; }

interface FormState {
  weatherConditions: string[];
  customerName: string; date: string; dayOfWeek: string;
  addressLine1: string; addressLine2: string;
  estimateNumber: string; contactPhone: string;
  foremanName: string; foremanArrivalTime: string; foremanDepartureTime: string;
  foremanTotalHours: string; foremanNotes: string;
  teamMembers: TeamMember[];
  workItems: WorkItem[];
  punchItems: PunchItem[];
  chemicalLog: Record<string, ChemEntry>;
  equipmentLog: Record<string, EquipEntry>;
  additionalNotes: string;
  signatureName: string;
  dateSigned: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcHours(arrival: string, departure: string): string {
  if (!arrival || !departure) return "";
  const parse = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return NaN;
    let h = parseInt(m[1]); const min = parseInt(m[2]); const ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
  };
  const a = parse(arrival), d = parse(departure);
  if (isNaN(a) || isNaN(d) || d <= a) return "";
  return ((d - a) / 60).toFixed(2).replace(/\.?0+$/, "");
}

function getDayOfWeek(dateStr: string): string {
  if (!dateStr) return "";
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? "" : days[d.getDay()];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  const today = todayStr();
  return {
    weatherConditions: [],
    customerName: "", date: today, dayOfWeek: getDayOfWeek(today),
    addressLine1: "", addressLine2: "", estimateNumber: "", contactPhone: "",
    foremanName: "", foremanArrivalTime: "", foremanDepartureTime: "", foremanTotalHours: "", foremanNotes: "",
    teamMembers: Array(5).fill(null).map(() => ({ name: "", arrival_time: "", departure_time: "", total_hours: "", notes: "" })),
    workItems: Array(6).fill(null).map(() => ({ description: "", man_hours: "", material: "", quantity: "" })),
    punchItems: Array(5).fill(null).map(() => ({ description: "" })),
    chemicalLog: Object.fromEntries(CHEMICALS.map(c => [c.key, { quantity_gallons: "", location_of_spray: "", vendor: "", amount_dollars: "" }])),
    equipmentLog: Object.fromEntries(EQUIPMENT.map(e => [e.key, { purpose: "", hours: "" }])),
    additionalNotes: "", signatureName: "", dateSigned: "",
  };
}

function wsToForm(ws: any): FormState {
  return {
    weatherConditions: ws.weather_conditions || [],
    customerName: ws.customer_name || "", date: ws.date || todayStr(),
    dayOfWeek: ws.day_of_week || getDayOfWeek(ws.date || ""),
    addressLine1: ws.address_line_1 || "", addressLine2: ws.address_line_2 || "",
    estimateNumber: ws.estimate_number || "", contactPhone: ws.contact_phone || "",
    foremanName: ws.foreman_name || "", foremanArrivalTime: ws.foreman_arrival_time || "",
    foremanDepartureTime: ws.foreman_departure_time || "", foremanTotalHours: ws.foreman_total_hours || "",
    foremanNotes: ws.foreman_notes || "",
    teamMembers: (ws.team_members && ws.team_members.length > 0)
      ? [...ws.team_members, ...Array(Math.max(0, 5 - ws.team_members.length)).fill(null).map(() => ({ name: "", arrival_time: "", departure_time: "", total_hours: "", notes: "" }))]
      : Array(5).fill(null).map(() => ({ name: "", arrival_time: "", departure_time: "", total_hours: "", notes: "" })),
    workItems: (ws.work_items && ws.work_items.length > 0)
      ? [...ws.work_items, ...Array(Math.max(0, 6 - ws.work_items.length)).fill(null).map(() => ({ description: "", man_hours: "", material: "", quantity: "" }))]
      : Array(6).fill(null).map(() => ({ description: "", man_hours: "", material: "", quantity: "" })),
    punchItems: (ws.punch_items && ws.punch_items.length > 0)
      ? [...ws.punch_items, ...Array(Math.max(0, 5 - ws.punch_items.length)).fill(null).map(() => ({ description: "" }))]
      : Array(5).fill(null).map(() => ({ description: "" })),
    chemicalLog: Object.fromEntries(CHEMICALS.map(c => [c.key, (ws.chemical_log || {})[c.key] || { quantity_gallons: "", location_of_spray: "", vendor: "", amount_dollars: "" }])),
    equipmentLog: Object.fromEntries(EQUIPMENT.map(e => [e.key, (ws.equipment_log || {})[e.key] || { purpose: "", hours: "" }])),
    additionalNotes: ws.additional_notes || "",
    signatureName: ws.signature_name || "", dateSigned: ws.date_signed || "",
  };
}

function formToPayload(f: FormState) {
  return {
    weatherConditions: f.weatherConditions,
    customerName: f.customerName, date: f.date, dayOfWeek: getDayOfWeek(f.date),
    addressLine1: f.addressLine1, addressLine2: f.addressLine2,
    estimateNumber: f.estimateNumber, contactPhone: f.contactPhone,
    foremanName: f.foremanName, foremanArrivalTime: f.foremanArrivalTime,
    foremanDepartureTime: f.foremanDepartureTime,
    foremanTotalHours: calcHours(f.foremanArrivalTime, f.foremanDepartureTime) || f.foremanTotalHours,
    foremanNotes: f.foremanNotes,
    teamMembers: f.teamMembers.filter(m => m.name),
    workItems: f.workItems.filter(w => w.description),
    punchItems: f.punchItems.filter(p => p.description),
    chemicalLog: f.chemicalLog,
    equipmentLog: f.equipmentLog,
    additionalNotes: f.additionalNotes,
    signatureName: f.signatureName, dateSigned: f.dateSigned,
  };
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color = "#2d6a4f" }: { icon: any; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-2 border-b-2" style={{ borderColor: color }}>
      <div className="p-1.5 rounded-md" style={{ background: color }}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <h2 className="text-base font-semibold" style={{ color }}>{title}</h2>
    </div>
  );
}

// ─── Input helpers ────────────────────────────────────────────────────────────

function TH({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200">{children}</th>;
}
function TD({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 border border-gray-200 ${className}`}>{children}</td>;
}

// ─── List View ────────────────────────────────────────────────────────────────

function WorksheetRow({ ws, onOpen, onDelete, isAdmin }: { ws: any; onOpen: () => void; onDelete: () => void; isAdmin: boolean }) {
  const isDraft = ws.status === "draft";
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <TD>
        <div className="font-medium text-sm">{ws.customer_name || <span className="text-gray-400 italic">Untitled</span>}</div>
      </TD>
      <TD><span className="text-sm">{ws.date}</span></TD>
      <TD><span className="text-sm text-gray-600">{ws.day_of_week || getDayOfWeek(ws.date)}</span></TD>
      {isAdmin && (
        <TD><span className="text-sm text-gray-600">{ws.submitted_by_name || ws.submitted_by_username || "—"}</span></TD>
      )}
      <TD>
        <Badge variant={isDraft ? "secondary" : "default"} className={isDraft ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}>
          {isDraft ? "Draft" : "Submitted"}
        </Badge>
      </TD>
      <TD>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onOpen} data-testid={`btn-open-worksheet-${ws.id}`} className="h-7 text-xs">
            <Eye className="h-3 w-3 mr-1" /> {isDraft ? "Edit" : "View"}
          </Button>
          {isDraft && (
            <Button size="sm" variant="ghost" onClick={onDelete} data-testid={`btn-delete-worksheet-${ws.id}`} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </TD>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyWorksheet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;

  // View state: "list" | "new" | worksheet-id
  const [view, setView] = useState<"list" | string>("list");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // List query
  const { data: worksheets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/daily-worksheets"],
  });

  // Single worksheet query (when editing existing)
  const editingId = view !== "list" && view !== "new" ? view : null;
  const { data: existingWs } = useQuery<any>({
    queryKey: ["/api/daily-worksheets", editingId],
    queryFn: () => apiRequest("GET", `/api/daily-worksheets/${editingId}`).then(r => r.json()),
    enabled: !!editingId,
  });

  useEffect(() => {
    if (existingWs) {
      setForm(wsToForm(existingWs));
      setIsSubmitted(existingWs.status === "submitted");
    }
  }, [existingWs]);

  // Field updaters
  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const setTeamMember = useCallback((i: number, field: keyof TeamMember, value: string) => {
    setForm(f => {
      const members = [...f.teamMembers];
      members[i] = { ...members[i], [field]: value };
      if ((field === "arrival_time" || field === "departure_time")) {
        const arr = field === "arrival_time" ? value : members[i].arrival_time;
        const dep = field === "departure_time" ? value : members[i].departure_time;
        members[i].total_hours = calcHours(arr, dep);
      }
      return { ...f, teamMembers: members };
    });
  }, []);

  const setWorkItem = useCallback((i: number, field: keyof WorkItem, value: string) => {
    setForm(f => {
      const items = [...f.workItems];
      items[i] = { ...items[i], [field]: value };
      return { ...f, workItems: items };
    });
  }, []);

  const setPunchItem = useCallback((i: number, value: string) => {
    setForm(f => {
      const items = [...f.punchItems];
      items[i] = { description: value };
      return { ...f, punchItems: items };
    });
  }, []);

  const setChem = useCallback((key: string, field: keyof ChemEntry, value: string) => {
    setForm(f => ({
      ...f,
      chemicalLog: { ...f.chemicalLog, [key]: { ...f.chemicalLog[key], [field]: value } },
    }));
  }, []);

  const setEquip = useCallback((key: string, field: keyof EquipEntry, value: string) => {
    setForm(f => ({
      ...f,
      equipmentLog: { ...f.equipmentLog, [key]: { ...f.equipmentLog[key], [field]: value } },
    }));
  }, []);

  const toggleWeather = useCallback((opt: string) => {
    setForm(f => ({
      ...f,
      weatherConditions: f.weatherConditions.includes(opt)
        ? f.weatherConditions.filter(w => w !== opt)
        : [...f.weatherConditions, opt],
    }));
  }, []);

  const handleForemanTime = (field: "foremanArrivalTime" | "foremanDepartureTime", value: string) => {
    setForm(f => {
      const updated = { ...f, [field]: value };
      const arr = field === "foremanArrivalTime" ? value : f.foremanArrivalTime;
      const dep = field === "foremanDepartureTime" ? value : f.foremanDepartureTime;
      updated.foremanTotalHours = calcHours(arr, dep);
      return updated;
    });
  };

  // Save draft
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = formToPayload(form);
      let saved: any;
      if (view === "new") {
        const res = await apiRequest("POST", "/api/daily-worksheets", payload);
        saved = await res.json();
        setView(saved.id);
        queryClient.invalidateQueries({ queryKey: ["/api/daily-worksheets"] });
        toast({ title: "Saved", description: "Draft saved successfully." });
      } else if (editingId) {
        const res = await apiRequest("PATCH", `/api/daily-worksheets/${editingId}`, payload);
        saved = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/daily-worksheets"] });
        queryClient.invalidateQueries({ queryKey: ["/api/daily-worksheets", editingId] });
        toast({ title: "Saved", description: "Draft saved." });
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Submit & email
  const handleSubmit = async () => {
    if (!form.customerName || !form.date) {
      toast({ title: "Missing required fields", description: "Customer name and date are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      // Save first
      let wsId = editingId;
      const payload = formToPayload(form);
      if (view === "new") {
        const res = await apiRequest("POST", "/api/daily-worksheets", payload);
        const saved = await res.json();
        wsId = saved.id;
        setView(saved.id);
      } else if (wsId) {
        await apiRequest("PATCH", `/api/daily-worksheets/${wsId}`, payload);
      }
      // Then submit
      const res = await apiRequest("POST", `/api/daily-worksheets/${wsId}/submit`, {});
      const submitted = await res.json();
      setIsSubmitted(true);
      setForm(wsToForm(submitted));
      queryClient.invalidateQueries({ queryKey: ["/api/daily-worksheets"] });
      toast({ title: "Worksheet submitted!", description: "Email has been sent to all managers." });
    } catch (err: any) {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete draft
  const handleDelete = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/daily-worksheets/${id}`, undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/daily-worksheets"] });
      toast({ title: "Deleted", description: "Draft worksheet deleted." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openNew = () => {
    setForm(emptyForm());
    setIsSubmitted(false);
    setView("new");
  };

  const openExisting = (ws: any) => {
    setForm(wsToForm(ws));
    setIsSubmitted(ws.status === "submitted");
    setView(ws.id);
  };

  const backToList = () => {
    setView("list");
    queryClient.invalidateQueries({ queryKey: ["/api/daily-worksheets"] });
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  if (view === "list") {
    const drafts = worksheets.filter(w => w.status === "draft");
    const submitted = worksheets.filter(w => w.status === "submitted");

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-700">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Daily Crew Worksheets</h1>
                <p className="text-sm text-gray-500">Track daily job activity, crew hours, materials, and chemicals</p>
              </div>
            </div>
            <Button onClick={openNew} data-testid="btn-new-worksheet" className="bg-green-700 hover:bg-green-800">
              <Plus className="h-4 w-4 mr-2" /> New Worksheet
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-green-700" />
            </div>
          ) : worksheets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <ClipboardList className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500 text-sm">No worksheets yet. Click "New Worksheet" to start your first daily report.</p>
                <Button onClick={openNew} className="bg-green-700 hover:bg-green-800 mt-2">
                  <Plus className="h-4 w-4 mr-2" /> New Worksheet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {drafts.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4 border-b bg-amber-50">
                    <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                      <Save className="h-4 w-4" /> Drafts ({drafts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <TH>Customer</TH>
                            <TH>Date</TH>
                            <TH>Day</TH>
                            {isAdmin && <TH>Created By</TH>}
                            <TH>Status</TH>
                            <TH>Actions</TH>
                          </tr>
                        </thead>
                        <tbody>
                          {drafts.map(ws => (
                            <WorksheetRow key={ws.id} ws={ws} isAdmin={isAdmin}
                              onOpen={() => openExisting(ws)}
                              onDelete={() => handleDelete(ws.id)} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {submitted.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4 border-b bg-green-50">
                    <CardTitle className="text-sm font-semibold text-green-800 flex items-center gap-2">
                      <Send className="h-4 w-4" /> Submitted ({submitted.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <TH>Customer</TH>
                            <TH>Date</TH>
                            <TH>Day</TH>
                            {isAdmin && <TH>Created By</TH>}
                            <TH>Status</TH>
                            <TH>Actions</TH>
                          </tr>
                        </thead>
                        <tbody>
                          {submitted.map(ws => (
                            <WorksheetRow key={ws.id} ws={ws} isAdmin={isAdmin}
                              onOpen={() => openExisting(ws)}
                              onDelete={() => handleDelete(ws.id)} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── FORM VIEW ──────────────────────────────────────────────────────────────

  const inputCls = "h-8 text-sm";
  const readOnly = isSubmitted && !isAdmin;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky header bar */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={backToList} className="h-8 px-2" data-testid="btn-back-to-list">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <ClipboardList className="h-4 w-4 text-green-700 shrink-0" />
            <span className="text-sm font-semibold text-gray-800 truncate">
              {form.customerName || "New Worksheet"} {form.date ? `· ${form.date}` : ""}
            </span>
            {isSubmitted && (
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Submitted</Badge>
            )}
            {!isSubmitted && view !== "new" && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Draft</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isSubmitted && (
              <>
                <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving} className="h-8" data-testid="btn-save-draft">
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Save Draft
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="h-8 bg-green-700 hover:bg-green-800" data-testid="btn-submit-worksheet">
                  {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  Submit & Email
                </Button>
              </>
            )}
            {isSubmitted && isAdmin && (
              <Badge className="bg-green-100 text-green-800 text-xs">Read-only (submitted)</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Section 1: Job Information ────────────────────────────────── */}
        <Card>
          <CardContent className="pt-5">
            <SectionHeader icon={MapPin} title="Job Information" />
            {/* Weather conditions */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">Weather / Conditions</label>
              <div className="flex flex-wrap gap-2">
                {WEATHER_OPTIONS.map(opt => (
                  <button key={opt} type="button" onClick={() => !readOnly && toggleWeather(opt)}
                    data-testid={`chip-weather-${opt.replace(/\s+/g, "-")}`}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.weatherConditions.includes(opt)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    } ${readOnly ? "cursor-default opacity-70" : "cursor-pointer"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <Input className={inputCls} value={form.customerName} readOnly={readOnly}
                  onChange={e => set("customerName", e.target.value)}
                  placeholder="Enter customer name" data-testid="input-customer-name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" className={inputCls} value={form.date} readOnly={readOnly}
                  onChange={e => { set("date", e.target.value); set("dayOfWeek", getDayOfWeek(e.target.value)); }}
                  data-testid="input-date" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Day of Week</label>
                <Input className={inputCls} value={getDayOfWeek(form.date)} readOnly placeholder="Auto-filled from date" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estimate Number</label>
                <Input className={inputCls} value={form.estimateNumber} readOnly={readOnly}
                  onChange={e => set("estimateNumber", e.target.value)}
                  placeholder="e.g. EST-2024-001" data-testid="input-estimate-number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address Line 1</label>
                <Input className={inputCls} value={form.addressLine1} readOnly={readOnly}
                  onChange={e => set("addressLine1", e.target.value)}
                  placeholder="Street address" data-testid="input-address-line-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address Line 2</label>
                <Input className={inputCls} value={form.addressLine2} readOnly={readOnly}
                  onChange={e => set("addressLine2", e.target.value)}
                  placeholder="City, State, ZIP" data-testid="input-address-line-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
                <Input className={inputCls} value={form.contactPhone} readOnly={readOnly}
                  onChange={e => set("contactPhone", e.target.value)}
                  placeholder="(555) 555-5555" data-testid="input-contact-phone" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Team Members & Time Log ───────────────────────── */}
        <Card>
          <CardContent className="pt-5">
            <SectionHeader icon={User} title="Team Members & Time Log" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Arrival Time</TH>
                    <TH>Departure Time</TH>
                    <TH>Total Hours</TH>
                    <TH>Notes</TH>
                  </tr>
                </thead>
                <tbody>
                  {/* Foreman row */}
                  <tr className="bg-green-50">
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-green-800 shrink-0">Foreman</span>
                        <Input className="h-7 text-xs" value={form.foremanName} readOnly={readOnly}
                          onChange={e => set("foremanName", e.target.value)}
                          placeholder="Foreman name" data-testid="input-foreman-name" />
                      </div>
                    </TD>
                    <TD>
                      <Input className="h-7 text-xs" value={form.foremanArrivalTime} readOnly={readOnly}
                        onChange={e => handleForemanTime("foremanArrivalTime", e.target.value)}
                        placeholder="7:00 AM" data-testid="input-foreman-arrival" />
                    </TD>
                    <TD>
                      <Input className="h-7 text-xs" value={form.foremanDepartureTime} readOnly={readOnly}
                        onChange={e => handleForemanTime("foremanDepartureTime", e.target.value)}
                        placeholder="3:00 PM" data-testid="input-foreman-departure" />
                    </TD>
                    <TD>
                      <Input className="h-7 text-xs bg-gray-50" readOnly
                        value={calcHours(form.foremanArrivalTime, form.foremanDepartureTime) || form.foremanTotalHours}
                        placeholder="Auto-calc" />
                    </TD>
                    <TD>
                      <Input className="h-7 text-xs" value={form.foremanNotes} readOnly={readOnly}
                        onChange={e => set("foremanNotes", e.target.value)}
                        placeholder="Notes" data-testid="input-foreman-notes" />
                    </TD>
                  </tr>

                  {/* Dynamic team member rows */}
                  {form.teamMembers.map((m, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <TD>
                        <Input className="h-7 text-xs" value={m.name} readOnly={readOnly}
                          onChange={e => setTeamMember(i, "name", e.target.value)}
                          placeholder={`Member ${i + 1}`} data-testid={`input-team-name-${i}`} />
                      </TD>
                      <TD>
                        <Input className="h-7 text-xs" value={m.arrival_time} readOnly={readOnly}
                          onChange={e => setTeamMember(i, "arrival_time", e.target.value)}
                          placeholder="7:00 AM" data-testid={`input-team-arrival-${i}`} />
                      </TD>
                      <TD>
                        <Input className="h-7 text-xs" value={m.departure_time} readOnly={readOnly}
                          onChange={e => setTeamMember(i, "departure_time", e.target.value)}
                          placeholder="3:00 PM" data-testid={`input-team-departure-${i}`} />
                      </TD>
                      <TD>
                        <Input className="h-7 text-xs bg-gray-50" readOnly value={m.total_hours} placeholder="Auto" />
                      </TD>
                      <TD>
                        <Input className="h-7 text-xs" value={m.notes} readOnly={readOnly}
                          onChange={e => setTeamMember(i, "notes", e.target.value)}
                          placeholder="Notes" data-testid={`input-team-notes-${i}`} />
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">Enter time as 7:00 AM or 15:00 — hours are calculated automatically.</p>
          </CardContent>
        </Card>

        {/* ── Section 3: Work Description ───────────────────────────────── */}
        <Card>
          <CardContent className="pt-5">
            <SectionHeader icon={FileText} title="Work Description" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <TH>#</TH>
                    <TH>Description of Work</TH>
                    <TH>Man Hrs</TH>
                    <TH>Material / Product</TH>
                    <TH>Quantity</TH>
                  </tr>
                </thead>
                <tbody>
                  {form.workItems.map((w, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <TD className="text-center text-gray-400 font-mono text-xs w-8">{i + 1}</TD>
                      <TD>
                        <Input className="h-7 text-xs" value={w.description} readOnly={readOnly}
                          onChange={e => setWorkItem(i, "description", e.target.value)}
                          placeholder="Describe the work done" data-testid={`input-work-desc-${i}`} />
                      </TD>
                      <TD className="w-20">
                        <Input className="h-7 text-xs" value={w.man_hours} readOnly={readOnly}
                          onChange={e => setWorkItem(i, "man_hours", e.target.value)}
                          placeholder="2.5" data-testid={`input-work-manhrs-${i}`} />
                      </TD>
                      <TD>
                        <Input className="h-7 text-xs" value={w.material} readOnly={readOnly}
                          onChange={e => setWorkItem(i, "material", e.target.value)}
                          placeholder="Mulch, stone, etc." data-testid={`input-work-material-${i}`} />
                      </TD>
                      <TD className="w-24">
                        <Input className="h-7 text-xs" value={w.quantity} readOnly={readOnly}
                          onChange={e => setWorkItem(i, "quantity", e.target.value)}
                          placeholder="e.g. 3 yds" data-testid={`input-work-qty-${i}`} />
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 4: Punch List ────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-5">
            <SectionHeader icon={CheckSquare} title="Things to Fix / Change / Add (Punch List)" color="#c2410c" />
            <div className="space-y-2">
              {form.punchItems.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                  <Input className={inputCls + " flex-1"} value={p.description} readOnly={readOnly}
                    onChange={e => setPunchItem(i, e.target.value)}
                    placeholder={`Punch list item ${i + 1}`} data-testid={`input-punch-${i}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Section 5: Chemical Application Log ─────────────────────── */}
        <Card>
          <CardContent className="pt-5">
            <SectionHeader icon={FlaskConical} title="Chemical Application Log" color="#7c3aed" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <TH>Chemical / Product</TH>
                    <TH>Quantity (Gal)</TH>
                    <TH>Location of Spray</TH>
                    <TH>Vendor</TH>
                    <TH>Amount ($)</TH>
                  </tr>
                </thead>
                <tbody>
                  {CHEMICALS.map((c, i) => {
                    const entry = form.chemicalLog[c.key] || { quantity_gallons: "", location_of_spray: "", vendor: "", amount_dollars: "" };
                    return (
                      <tr key={c.key} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <TD><span className="text-xs font-medium text-gray-700">{c.name}</span></TD>
                        <TD>
                          <Input className="h-7 text-xs" value={entry.quantity_gallons} readOnly={readOnly}
                            onChange={e => setChem(c.key, "quantity_gallons", e.target.value)}
                            placeholder="0.0" data-testid={`input-chem-qty-${c.key}`} />
                        </TD>
                        <TD>
                          <Input className="h-7 text-xs" value={entry.location_of_spray} readOnly={readOnly}
                            onChange={e => setChem(c.key, "location_of_spray", e.target.value)}
                            placeholder="Area treated" data-testid={`input-chem-location-${c.key}`} />
                        </TD>
                        <TD>
                          <Input className="h-7 text-xs" value={entry.vendor} readOnly={readOnly}
                            onChange={e => setChem(c.key, "vendor", e.target.value)}
                            placeholder="Vendor name" data-testid={`input-chem-vendor-${c.key}`} />
                        </TD>
                        <TD>
                          <Input className="h-7 text-xs" value={entry.amount_dollars} readOnly={readOnly}
                            onChange={e => setChem(c.key, "amount_dollars", e.target.value)}
                            placeholder="0.00" data-testid={`input-chem-amount-${c.key}`} />
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 6: Equipment Log ─────────────────────────────────── */}
        <Card>
          <CardContent className="pt-5">
            <SectionHeader icon={Truck} title="Equipment Log" color="#0369a1" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <TH>Equipment</TH>
                    <TH>Purpose / Task</TH>
                    <TH>Hours Used</TH>
                  </tr>
                </thead>
                <tbody>
                  {EQUIPMENT.map((e, i) => {
                    const entry = form.equipmentLog[e.key] || { purpose: "", hours: "" };
                    return (
                      <tr key={e.key} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <TD><span className="text-xs font-medium text-gray-700">{e.name}</span></TD>
                        <TD>
                          <Input className="h-7 text-xs" value={entry.purpose} readOnly={readOnly}
                            onChange={ev => setEquip(e.key, "purpose", ev.target.value)}
                            placeholder="What was it used for?" data-testid={`input-equip-purpose-${e.key}`} />
                        </TD>
                        <TD>
                          <Input className="h-7 text-xs" value={entry.hours} readOnly={readOnly}
                            onChange={ev => setEquip(e.key, "hours", ev.target.value)}
                            placeholder="3.5" data-testid={`input-equip-hours-${e.key}`} />
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 7: Notes & Signature ─────────────────────────────── */}
        <Card>
          <CardContent className="pt-5">
            <SectionHeader icon={StickyNote} title="Additional Notes & Signature" color="#374151" />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes / Comments</label>
                <Textarea className="text-sm resize-none" rows={4} value={form.additionalNotes} readOnly={readOnly}
                  onChange={e => set("additionalNotes", e.target.value)}
                  placeholder="Any additional notes, issues, or observations for the day..."
                  data-testid="input-additional-notes" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Foreman / Crew Lead Signature (Print Name)</label>
                  <Input className={inputCls} value={form.signatureName} readOnly={readOnly}
                    onChange={e => set("signatureName", e.target.value)}
                    placeholder="Print full name" data-testid="input-signature-name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Signed</label>
                  <Input type="date" className={inputCls} value={form.dateSigned} readOnly={readOnly}
                    onChange={e => set("dateSigned", e.target.value)}
                    data-testid="input-date-signed" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom action bar */}
        {!isSubmitted && (
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={backToList} data-testid="btn-back-bottom">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSave} disabled={isSaving} data-testid="btn-save-draft-bottom">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Draft
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-700 hover:bg-green-800" data-testid="btn-submit-bottom">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Submit & Email
              </Button>
            </div>
          </div>
        )}

        {isSubmitted && (
          <div className="flex justify-center pt-2">
            <div className="bg-green-50 border border-green-200 rounded-lg px-6 py-4 text-center">
              <Send className="h-5 w-5 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">This worksheet has been submitted and emailed to management.</p>
              <Button variant="outline" onClick={backToList} className="mt-3 text-xs h-8" data-testid="btn-back-submitted">
                <ArrowLeft className="h-3 w-3 mr-1" /> Back to All Worksheets
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
