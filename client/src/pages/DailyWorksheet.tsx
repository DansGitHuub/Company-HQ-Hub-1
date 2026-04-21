import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardList, Plus, Trash2, Send, Save, Loader2, PackageOpen,
  Receipt, Users, StickyNote, Clock, Briefcase, ChevronDown, ChevronRight,
  ImagePlus, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Material {
  id: number;
  material_name: string | null;
  quantity: string | null;
  unit: string | null;
  unit_cost: string | null;
  notes: string | null;
}

interface Expense {
  id: number;
  description: string | null;
  amount: string | null;
  category: string | null;
  receipt_url: string | null;
}

interface TeamMember {
  id: number;
  user_id: string;
  user_name: string | null;
  username: string;
}

interface Worksheet {
  id: string;
  user_id: string;
  job_id: string | null;
  date: string;
  notes: string | null;
  status: string;
  materials: Material[];
  expenses: Expense[];
  teamMembers: TeamMember[];
}

interface ActiveEntry {
  id: number;
  job_id: string | null;
  job_name: string | null;
  work_area_name: string | null;
  clock_in: string;
  entry_type: string;
}

interface CrewUser {
  id: string;
  name: string;
  username: string;
  role: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(_dateStr?: string) {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, count, color, children,
}: {
  icon: any; title: string; count?: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none flex flex-row items-center justify-between"
        style={{ background: `${color}18`, borderBottom: `2px solid ${color}30` }}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md" style={{ background: color }}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm font-semibold" style={{ color }}>
            {title}
          </CardTitle>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">{count}</Badge>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </CardHeader>
      {open && <CardContent className="p-4">{children}</CardContent>}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyWorksheet() {
  const { t } = useTranslation("dailyWorksheet");
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Elapsed timer ────────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);

  const { data: activeEntry } = useQuery<ActiveEntry | null>({
    queryKey: ["/api/time/active"],
    queryFn: async () => {
      const res = await fetch("/api/time/active");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30000,
    retry: false,
  });

  useEffect(() => {
    if (!activeEntry?.clock_in) { setElapsed(0); return; }
    const update = () => setElapsed(
      Math.floor((Date.now() - new Date(activeEntry.clock_in).getTime()) / 1000)
    );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeEntry?.clock_in]);

  // ── Today's worksheet ────────────────────────────────────────────────────────
  const { data: ws, isLoading } = useQuery<Worksheet>({
    queryKey: ["/api/worksheets/today"],
    queryFn: () => fetch("/api/worksheets/today").then((r) => r.json()),
  });

  // ── Crew users list (for team member picker) ─────────────────────────────────
  const { data: crewUsers = [] } = useQuery<CrewUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
    select: (data) => data.filter((u) => u.role !== "Customer"),
  });

  // ── Notes state (local, saved on blur or submit) ─────────────────────────────
  const [notes, setNotes] = useState("");
  const notesInitialized = useRef(false);
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (ws && !notesInitialized.current) {
      setNotes(ws.notes ?? "");
      notesInitialized.current = true;
      wsIdRef.current = ws.id;
    }
  }, [ws]);

  // ── Save notes ───────────────────────────────────────────────────────────────
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const flashSaved = () => {
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const saveNotes = async () => {
    if (!ws) return;
    setIsSavingNotes(true);
    try {
      await apiRequest("PATCH", `/api/worksheets/${ws.id}`, { notes });
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      flashSaved();
    } finally {
      setIsSavingNotes(false);
    }
  };

  // ── Debounced 1s auto-save for notes ─────────────────────────────────────────
  useEffect(() => {
    if (!notesInitialized.current || !wsIdRef.current) return;
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(async () => {
      if (!wsIdRef.current) return;
      try {
        setIsSavingNotes(true);
        await apiRequest("PATCH", `/api/worksheets/${wsIdRef.current}`, { notes });
        flashSaved();
      } catch { /* silent */ } finally {
        setIsSavingNotes(false);
      }
    }, 1000);
    return () => { if (notesDebounce.current) clearTimeout(notesDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // ── Submit worksheet ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!ws) return;
    setIsSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/worksheets/${ws.id}`, { notes });
      await apiRequest("POST", `/api/worksheets/${ws.id}/submit`, {});
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      toast({ title: "Worksheet submitted!", description: "Your worksheet has been submitted." });
    } catch (err: any) {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitted = ws?.status === "submitted" || ws?.status === "approved";

  // ─── Materials form state ─────────────────────────────────────────────────────
  const [matForm, setMatForm] = useState({ material_name: "", quantity: "", unit: "", unit_cost: "", notes: "" });
  const [addingMat, setAddingMat] = useState(false);
  const [showMatForm, setShowMatForm] = useState(false);

  // Catalog autocomplete
  const [catalogSuggestions, setCatalogSuggestions] = useState<{ id: string; name: string; unit: string | null; unit_cost: string | null }[]>([]);
  const [showCatalogDrop, setShowCatalogDrop] = useState(false);
  const catalogDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (catalogDebounce.current) clearTimeout(catalogDebounce.current);
    const q = matForm.material_name.trim();
    if (q.length < 2) { setCatalogSuggestions([]); setShowCatalogDrop(false); return; }
    catalogDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/materials/catalog?q=${encodeURIComponent(q)}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCatalogSuggestions(data);
          setShowCatalogDrop(data.length > 0);
        }
      } catch { /* silent */ }
    }, 280);
    return () => { if (catalogDebounce.current) clearTimeout(catalogDebounce.current); };
  }, [matForm.material_name]);

  const addMaterial = async () => {
    if (!ws || !matForm.material_name) return;
    setAddingMat(true);
    try {
      await apiRequest("POST", `/api/worksheets/${ws.id}/materials`, {
        material_name: matForm.material_name,
        quantity: matForm.quantity ? parseFloat(matForm.quantity) : null,
        unit: matForm.unit || null,
        unit_cost: matForm.unit_cost ? parseFloat(matForm.unit_cost) : null,
        notes: matForm.notes || null,
      });
      setMatForm({ material_name: "", quantity: "", unit: "", unit_cost: "", notes: "" });
      setShowMatForm(false);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      toast({ title: "Material added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingMat(false);
    }
  };

  const deleteMaterial = async (materialId: number) => {
    if (!ws) return;
    try {
      await apiRequest("DELETE", `/api/worksheets/${ws.id}/materials/${materialId}`, undefined);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ─── Expenses form state ──────────────────────────────────────────────────────
  const EXPENSE_CATEGORIES = ["Fuel", "Materials", "Equipment Rental", "Dump Fee", "Food", "Other"];
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [expForm, setExpForm] = useState({ description: "", amount: "", category: "", receipt_url: "" });
  const [addingExp, setAddingExp] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);

  const handleReceiptFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setExpForm((f) => ({ ...f, receipt_url: e.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const addExpense = async () => {
    if (!ws || !expForm.description) return;
    setAddingExp(true);
    try {
      await apiRequest("POST", `/api/worksheets/${ws.id}/expenses`, {
        description: expForm.description,
        amount: expForm.amount ? parseFloat(expForm.amount) : null,
        category: expForm.category || null,
        receipt_url: expForm.receipt_url || null,
      });
      setExpForm({ description: "", amount: "", category: "", receipt_url: "" });
      setShowExpForm(false);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
      toast({ title: "Expense added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingExp(false);
    }
  };

  const deleteExpense = async (expenseId: number) => {
    if (!ws) return;
    try {
      await apiRequest("DELETE", `/api/worksheets/${ws.id}/expenses/${expenseId}`, undefined);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ─── Team members ─────────────────────────────────────────────────────────────
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const addTeamMember = async () => {
    if (!ws || !selectedUserId) return;
    setAddingMember(true);
    try {
      await apiRequest("POST", `/api/worksheets/${ws.id}/team-members`, { user_id: selectedUserId });
      setSelectedUserId("");
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingMember(false);
    }
  };

  const removeTeamMember = async (memberId: number) => {
    if (!ws) return;
    try {
      await apiRequest("DELETE", `/api/worksheets/${ws.id}/team-members/${memberId}`, undefined);
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-green-700" />
      </div>
    );
  }

  if (!ws) return null;

  const addedMemberIds = new Set(ws.teamMembers.map((m) => m.user_id));
  const availableUsers = crewUsers.filter((u) => u.id !== user?.id && !addedMemberIds.has(u.id));

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* ── HEADER ── */}
      <div className="bg-green-700 text-white px-4 pt-5 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{t("title")}</span>
            {isSubmitted && (
              <Badge className="ml-2 bg-white/20 text-white border-white/30 text-xs">Submitted</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{formatDate(ws.date)}</h1>

          {activeEntry ? (
            <div className="mt-3 space-y-1.5">
              {(activeEntry.job_name || activeEntry.work_area_name) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-90">
                  {activeEntry.job_name && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span className="font-semibold">{activeEntry.job_name}</span>
                    </div>
                  )}
                  {activeEntry.work_area_name && (
                    <div className="flex items-center gap-1 opacity-80">
                      <span className="text-white/50">·</span>
                      <span>{activeEntry.work_area_name}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 opacity-90">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-mono font-bold text-base">{formatElapsed(elapsed)}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-75 text-xs">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Clocked In
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-70">{t("notClockedIn")}</p>
          )}
        </div>
      </div>

      {/* ── SECTIONS ── */}
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* Section 1 — Materials Used */}
        <Section icon={PackageOpen} title={t("materialsUsed")} count={ws.materials.length} color="#2563eb">
          {ws.materials.length > 0 && (
            <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
              {ws.materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2.5 bg-white text-sm" data-testid={`material-row-${m.id}`}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 truncate block">{m.material_name || "—"}</span>
                    <span className="text-xs text-gray-500">
                      {[m.quantity && `${m.quantity}${m.unit ? ` ${m.unit}` : ""}`, m.unit_cost && `$${parseFloat(m.unit_cost).toFixed(2)} each`]
                        .filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {!isSubmitted && (
                    <button
                      onClick={() => deleteMaterial(m.id)}
                      className="ml-3 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      data-testid={`btn-delete-material-${m.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isSubmitted && (
            showMatForm ? (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 relative">
                    <Input
                      placeholder="Material name *"
                      value={matForm.material_name}
                      onChange={(e) => setMatForm((f) => ({ ...f, material_name: e.target.value }))}
                      onBlur={() => setTimeout(() => setShowCatalogDrop(false), 150)}
                      className="h-8 text-sm"
                      data-testid="input-material-name"
                    />
                    {showCatalogDrop && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {catalogSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center gap-2"
                            onMouseDown={() => {
                              setMatForm((f) => ({
                                ...f,
                                material_name: s.name,
                                unit: s.unit ?? f.unit,
                                unit_cost: s.unit_cost ?? f.unit_cost,
                              }));
                              setShowCatalogDrop(false);
                            }}
                          >
                            <span className="font-medium text-gray-800">{s.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {s.unit ? s.unit : ""}{s.unit_cost ? ` · $${parseFloat(s.unit_cost).toFixed(2)}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input placeholder="Qty" value={matForm.quantity} onChange={(e) => setMatForm((f) => ({ ...f, quantity: e.target.value }))} className="h-8 text-sm" data-testid="input-material-qty" />
                  <Input placeholder="Unit (bag, gal…)" value={matForm.unit} onChange={(e) => setMatForm((f) => ({ ...f, unit: e.target.value }))} className="h-8 text-sm" data-testid="input-material-unit" />
                  <Input placeholder="Unit cost ($)" value={matForm.unit_cost} onChange={(e) => setMatForm((f) => ({ ...f, unit_cost: e.target.value }))} className="h-8 text-sm" data-testid="input-material-cost" />
                  <Input placeholder="Notes" value={matForm.notes} onChange={(e) => setMatForm((f) => ({ ...f, notes: e.target.value }))} className="h-8 text-sm" data-testid="input-material-notes" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={addMaterial} disabled={!matForm.material_name || addingMat} className="h-7 text-xs bg-blue-600 hover:bg-blue-700" data-testid="btn-add-material">
                    {addingMat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />} Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMatForm(false)} className="h-7 text-xs">Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowMatForm(true)} className="h-8 text-xs border-dashed" data-testid="btn-show-material-form">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("addMaterial")}
              </Button>
            )
          )}
        </Section>

        {/* Section 2 — Expenses */}
        <Section icon={Receipt} title={t("expenses")} count={ws.expenses.length} color="#7c3aed">
          {ws.expenses.length > 0 && (
            <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
              {ws.expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2.5 bg-white text-sm" data-testid={`expense-row-${e.id}`}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 truncate block">{e.description || "—"}</span>
                    <span className="text-xs text-gray-500">
                      {[e.category, e.amount && `$${parseFloat(e.amount).toFixed(2)}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {!isSubmitted && (
                    <button onClick={() => deleteExpense(e.id)} className="ml-3 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0" data-testid={`btn-delete-expense-${e.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isSubmitted && (
            showExpForm ? (
              <div className="space-y-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Description *" value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} className="h-8 text-sm col-span-2" data-testid="input-expense-desc" />
                  <Input placeholder="Amount ($)" value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} className="h-8 text-sm" data-testid="input-expense-amount" />
                  <select value={expForm.category} onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))} className="h-8 text-sm rounded-md border border-input bg-background px-3" data-testid="select-expense-category">
                    <option value="">Category…</option>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Receipt upload */}
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="input-receipt-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptFile(f); }}
                />
                {expForm.receipt_url ? (
                  <div className="relative w-24 h-20 rounded-md overflow-hidden border border-purple-200">
                    <img src={expForm.receipt_url} alt="Receipt" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setExpForm((f) => ({ ...f, receipt_url: "" })); if (receiptInputRef.current) receiptInputRef.current.value = ""; }}
                      className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 py-1"
                    data-testid="btn-upload-receipt"
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> Attach receipt photo
                  </button>
                )}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={addExpense} disabled={!expForm.description || addingExp} className="h-7 text-xs bg-purple-600 hover:bg-purple-700" data-testid="btn-add-expense">
                    {addingExp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />} Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowExpForm(false); setExpForm({ description: "", amount: "", category: "", receipt_url: "" }); if (receiptInputRef.current) receiptInputRef.current.value = ""; }} className="h-7 text-xs">Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowExpForm(true)} className="h-8 text-xs border-dashed" data-testid="btn-show-expense-form">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("addExpense")}
              </Button>
            )
          )}
        </Section>

        {/* Section 3 — Team Members */}
        <Section icon={Users} title={t("crewOnSite")} count={ws.teamMembers.length + 1} color="#059669">
          <div className="mb-3 flex flex-wrap gap-2">
            {/* Logged-in user — always shown, no remove button */}
            <div className="flex items-center gap-1.5 bg-green-100 border border-green-300 text-green-900 text-sm px-3 py-1.5 rounded-full" data-testid="member-chip-self">
              <span className="font-medium">{user?.name || user?.username}</span>
              <span className="text-xs text-green-600 font-normal">({t("you")})</span>
            </div>
            {/* Other crew members */}
            {ws.teamMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-1.5 rounded-full" data-testid={`member-chip-${m.id}`}>
                <span className="font-medium">{m.user_name || m.username}</span>
                {!isSubmitted && (
                  <button onClick={() => removeTeamMember(m.id)} className="ml-1 text-green-500 hover:text-red-500 transition-colors" data-testid={`btn-remove-member-${m.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isSubmitted && availableUsers.length > 0 && (
            <div className="flex gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 h-8 text-sm rounded-md border border-input bg-background px-3"
                data-testid="select-team-member"
              >
                <option value="">{t("addCrewMember")}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.username}</option>
                ))}
              </select>
              <Button size="sm" onClick={addTeamMember} disabled={!selectedUserId || addingMember} className="h-8 text-xs bg-green-700 hover:bg-green-800" data-testid="btn-add-member">
                {addingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </Section>

        {/* Section 4 — Notes */}
        <Section icon={StickyNote} title={t("notes")} color="#d97706">
          <Textarea
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            disabled={isSubmitted}
            className="text-sm resize-none"
            data-testid="textarea-notes"
          />
          {!isSubmitted && (
            <div className="flex items-center gap-3 mt-2">
              <Button size="sm" variant="outline" onClick={saveNotes} disabled={isSavingNotes} className="h-7 text-xs" data-testid="btn-save-notes">
                {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} {t("saveNotes")}
              </Button>
              {notesSaved && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1" data-testid="text-notes-saved">
                  <span>✓</span> Saved
                </span>
              )}
              {isSavingNotes && !notesSaved && (
                <span className="text-xs text-gray-400">Saving…</span>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* ── STICKY FOOTER ── */}
      {!isSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
          <div className="max-w-2xl mx-auto flex gap-3">
            <Button
              variant="outline"
              onClick={saveNotes}
              disabled={isSavingNotes}
              className="flex-1 h-10"
              data-testid="btn-save-draft"
            >
              {isSavingNotes ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t("saveDraft")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 h-10 bg-green-700 hover:bg-green-800"
              data-testid="btn-submit-worksheet"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t("submitWorksheet")}
            </Button>
          </div>
        </div>
      )}

      {isSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-green-50 border-t border-green-200 px-4 py-3 z-30 text-center">
          <p className="text-sm font-medium text-green-700">
            ✓ Worksheet submitted for {formatDate(ws.date)}
          </p>
        </div>
      )}
    </div>
  );
}
