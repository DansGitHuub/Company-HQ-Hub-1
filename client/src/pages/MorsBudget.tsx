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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plus, Pencil, Trash2, Loader2, ChevronRight, TrendingUp, DollarSign,
  Users, Clock, Wrench, ShoppingCart, Building2, Target, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = "overview" | "labor" | "materials" | "equipment" | "subcontractors" | "overhead" | "sales";

interface Budget {
  id: number; name: string; year: number; status: string;
  target_margin_percent: number; work_season_start: string; work_season_end: string;
  working_days_per_week: number; production_days: number;
}

interface Employee {
  id: number; budget_id: number; role: string; name: string;
  employee_type: "hourly" | "salaried"; hourly_wage: number; annual_salary: number;
  total_hours_per_year: number; unbillable_hours_per_year: number;
  overtime_hours: number; overtime_multiplier: number; bonuses: number;
  is_overhead_staff: boolean; sort_order: number;
}

interface Summary {
  total_direct_labor: number; total_unbillable_labor: number; total_overhead_staff_cost: number;
  total_labor_hours: number; total_unbillable_hours: number; total_billable_hours: number;
  avg_wage: number; unbillable_pct: number;
  equipment_overhead_total: number; overhead_items_total: number;
  additional_overhead: number; total_overhead: number;
  total_materials: number; total_subcontractors: number; total_cogs: number;
  total_costs: number; required_revenue: number; net_profit: number; net_margin_pct: number;
  breakeven_rate: number; labor_rate: number; display_labor_rate: number; display_breakeven_rate: number;
  overhead_markup_on_labor_pct: number;
  employee_details: (Employee & { total_compensation: number; unbillable_cost: number; direct_labor_cost: number })[];
  equipment_owned_details: any[]; equipment_leased_details: any[];
}

// ─── Formatters ────────────────────────────────────────────────────────────────
const $ = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const $2 = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (n?: number | null) => n == null ? "—" : `${(+n).toFixed(1)}%`;
const num = (n?: number | null) => n == null ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

// ─── Editable row hook ─────────────────────────────────────────────────────────
function useDeleteConfirm() {
  const [target, setTarget] = useState<any>(null);
  return { target, ask: setTarget, clear: () => setTarget(null) };
}

// ─── Summary cards ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color ?? ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Generic simple CRUD table ─────────────────────────────────────────────────
function SimpleTable({
  cols, rows, budgetId, endpoint, renderCell, buildDefault, renderEditFields, keyCalc,
}: {
  cols: string[];
  rows: any[];
  budgetId: number;
  endpoint: string;
  renderCell: (row: any, col: string) => React.ReactNode;
  buildDefault: () => Record<string, any>;
  renderEditFields: (form: Record<string, any>, setForm: (f: Record<string, any>) => void) => React.ReactNode;
  keyCalc?: (row: any) => string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const del = useDeleteConfirm();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/mors/budgets/${budgetId}`] });
    qc.invalidateQueries({ queryKey: [`/api/mors/budgets/${budgetId}/summary`] });
  };
  const saveMut = useMutation({
    mutationFn: (data: any) =>
      editing?.id
        ? apiRequest("PUT", `/api/mors/budgets/${budgetId}/${endpoint}/${editing.id}`, data)
        : apiRequest("POST", `/api/mors/budgets/${budgetId}/${endpoint}`, data),
    onSuccess: () => { invalidate(); setEditing(null); toast({ title: editing?.id ? "Updated" : "Added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mors/budgets/${budgetId}/${endpoint}/${id}`),
    onSuccess: () => { invalidate(); del.clear(); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" onClick={() => setEditing(buildDefault())} data-testid={`btn-add-${endpoint}`}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {cols.map(c => <TableHead key={c}>{c}</TableHead>)}
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={cols.length + 1} className="text-center py-8 text-muted-foreground text-sm">No items yet</TableCell></TableRow>
            )}
            {rows.map((row, i) => (
              <TableRow key={keyCalc ? keyCalc(row) : row.id ?? i}>
                {cols.map(c => <TableCell key={c} className="text-sm">{renderCell(row, c)}</TableCell>)}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({ ...row })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => del.ask(row)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {editing && renderEditFields(editing, setEditing)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate(editing)} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del.target} onOpenChange={o => { if (!o) del.clear(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => del.target && delMut.mutate(del.target.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ summary, budget }: { summary: Summary | undefined; budget: Budget | undefined }) {
  if (!summary || !budget) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const chartData = [
    { name: "Direct Labor",   value: Math.round(summary.total_direct_labor),   fill: "#3b82f6" },
    { name: "Materials",      value: Math.round(summary.total_materials),       fill: "#10b981" },
    { name: "Subcontractors", value: Math.round(summary.total_subcontractors),  fill: "#8b5cf6" },
    { name: "Overhead",       value: Math.round(summary.total_overhead),        fill: "#f59e0b" },
    { name: "Net Profit",     value: Math.round(summary.net_profit),            fill: "#22c55e" },
  ];

  const steps = [
    { label: "Total Billable Hours", formula: "Field staff total hours − unbillable hours", value: num(summary.total_billable_hours) + " hrs" },
    { label: "Average Wage",        formula: "Direct labor ÷ billable hours",               value: $2(summary.avg_wage) + " / hr" },
    { label: "Total Direct Labor",  formula: "All field staff compensation (billable portion)", value: $(summary.total_direct_labor) },
    { label: "Unbillable Labor",    formula: "Field staff compensation × unbillable %",     value: $(summary.total_unbillable_labor) + ` (${pct(summary.unbillable_pct * 100)})` },
    { label: "Equipment Overhead",  formula: "All owned + leased equipment annual costs",   value: $(summary.equipment_overhead_total) },
    { label: "Additional Overhead", formula: "All overhead line items + overhead staff cost", value: $(summary.additional_overhead) },
    { label: "Total Overhead",      formula: "Unbillable labor + equipment + additional",   value: $(summary.total_overhead), bold: true },
    { label: "Total COGS",          formula: "Direct labor + materials + subcontractors",   value: $(summary.total_cogs) },
    { label: "Required Revenue",    formula: `(COGS + overhead) ÷ (1 − ${summary.net_margin_pct}%)`, value: $(summary.required_revenue), bold: true },
    { label: "Breakeven Rate",      formula: "(Direct labor + overhead) ÷ billable hours",  value: $2(summary.breakeven_rate) + " / hr" },
    { label: "Labor Rate (actual)", formula: `Breakeven rate ÷ (1 − ${summary.net_margin_pct}%)`, value: $2(summary.labor_rate) + " / hr", bold: true },
    { label: "Overhead Markup",     formula: "Total overhead ÷ direct labor × 100",         value: pct(summary.overhead_markup_on_labor_pct) },
  ];

  return (
    <div className="space-y-5">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Labor Cost" value={$(summary.total_direct_labor + summary.total_unbillable_labor + summary.total_overhead_staff_cost)} sub="direct + unbillable + overhead staff" />
        <SummaryCard label="Total Overhead"   value={$(summary.total_overhead)} sub="unbillable + equip + additional" color="text-amber-600" />
        <SummaryCard label="Required Revenue" value={$(summary.required_revenue)} sub={`at ${pct(summary.net_margin_pct)} margin`} color="text-primary" />
        <SummaryCard label="Net Profit"       value={$(summary.net_profit)} sub={pct(summary.net_margin_pct) + " margin"} color="text-green-600" />
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Average Wage",     value: $2(summary.avg_wage) + " /hr",     icon: Users },
          { label: "Breakeven Rate",   value: $2(summary.display_breakeven_rate) + " /hr", icon: TrendingUp },
          { label: "Labor Rate",       value: $2(summary.display_labor_rate) + " /hr",   icon: DollarSign },
          { label: "Overhead Markup",  value: pct(summary.overhead_markup_on_labor_pct), icon: Building2 },
        ].map(card => (
          <Card key={card.label}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <card.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-base font-bold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget health chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Composition</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} fontSize={10} />
                <YAxis type="category" dataKey="name" width={90} fontSize={10} />
                <Tooltip formatter={(v: any) => $(v)} />
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {chartData.map(d => <Cell key={d.name} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Work Season</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Season",            `${budget.work_season_start} → ${budget.work_season_end}`],
              ["Production Days",   num(budget.production_days) + " days"],
              ["Days / Week",       budget.working_days_per_week + " days"],
              ["Total Labor Hrs",   num(summary.total_labor_hours) + " hrs"],
              ["Billable Hrs",      num(summary.total_billable_hours) + " hrs"],
              ["Unbillable Hrs",    `${num(summary.total_unbillable_hours)} hrs (${pct(summary.unbillable_pct * 100)})`],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Calculation transparency */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Calculation Breakdown — How the Labor Rate Is Derived</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {steps.map((s, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${s.bold ? "bg-muted/40" : ""}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className={`text-sm ${s.bold ? "font-semibold" : "font-medium"}`}>{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.formula}</p>
                  </div>
                </div>
                <p className={`text-sm font-mono shrink-0 ml-4 ${s.bold ? "font-bold text-primary" : ""}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── LABOR TAB ────────────────────────────────────────────────────────────────
function LaborTab({ budgetId, data, summary }: { budgetId: number; data: any; summary: Summary | undefined }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<"field" | "overhead">("field");
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);
  const del = useDeleteConfirm();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/mors/budgets/${budgetId}`] });
    qc.invalidateQueries({ queryKey: [`/api/mors/budgets/${budgetId}/summary`] });
  };

  const saveMut = useMutation({
    mutationFn: (d: any) =>
      d.id
        ? apiRequest("PUT", `/api/mors/budgets/${budgetId}/employees/${d.id}`, d)
        : apiRequest("POST", `/api/mors/budgets/${budgetId}/employees`, d),
    onSuccess: () => { invalidate(); setEditing(null); toast({ title: "Saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mors/budgets/${budgetId}/employees/${id}`),
    onSuccess: () => { invalidate(); del.clear(); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fieldEmps = (data?.employees ?? []).filter((e: Employee) => !e.is_overhead_staff);
  const ohStaff   = (data?.employees ?? []).filter((e: Employee) => e.is_overhead_staff);
  const empDetails = summary?.employee_details ?? [];

  const fieldTotal   = summary?.total_direct_labor ?? 0;
  const unbillTotal  = summary?.total_unbillable_labor ?? 0;
  const ohTotal      = summary?.total_overhead_staff_cost ?? 0;
  const billHrs      = summary?.total_billable_hours ?? 0;
  const unbillHrs    = summary?.total_unbillable_hours ?? 0;

  const newEmployee = (isOverhead: boolean) => ({
    role: "", name: "", employee_type: "hourly" as const,
    hourly_wage: 0, annual_salary: 0, total_hours_per_year: 0,
    unbillable_hours_per_year: 0, overtime_hours: 0, overtime_multiplier: 1.5,
    bonuses: 0, is_overhead_staff: isOverhead,
  });

  const f = (k: keyof Partial<Employee>, v: any) => setEditing(prev => prev ? { ...prev, [k]: v } : null);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Direct Labor"     value={$(fieldTotal)} sub="billable field staff" />
        <SummaryCard label="Unbillable Labor"  value={$(unbillTotal)} sub="non-billable overhead" color="text-amber-600" />
        <SummaryCard label="Overhead Staff"   value={$(ohTotal)} sub="salaries" />
        <SummaryCard label="Billable Hours"   value={num(billHrs) + " hrs"} sub="chargeable hours" />
        <SummaryCard label="Unbillable Hours" value={num(unbillHrs) + " hrs"} sub={pct((summary?.unbillable_pct ?? 0) * 100)} />
      </div>

      {/* Sub-tab selector */}
      <div className="flex gap-2 border-b">
        {(["field", "overhead"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "field" ? `Field Staff (${fieldEmps.length})` : `Overhead Staff (${ohStaff.length})`}
          </button>
        ))}
        <div className="ml-auto pb-1">
          <Button size="sm" onClick={() => setEditing(newEmployee(subTab === "overhead"))}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Field staff table */}
      {subTab === "field" && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {["Role","Name","Wage","Total Hrs","Unbill Hrs","OT Hrs","OT Mult","Bonus","Total Comp","Unbill $","Direct Labor"].map(h =>
                  <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                )}
                <TableHead className="w-16 text-right">✎</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fieldEmps.map((emp: Employee) => {
                const detail = empDetails.find(d => d.id === emp.id);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="text-xs">{emp.role}</TableCell>
                    <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                    <TableCell className="text-xs">{$2(emp.hourly_wage)}</TableCell>
                    <TableCell className="text-xs">{num(emp.total_hours_per_year)}</TableCell>
                    <TableCell className="text-xs">{num(emp.unbillable_hours_per_year)}</TableCell>
                    <TableCell className="text-xs">{num(emp.overtime_hours)}</TableCell>
                    <TableCell className="text-xs">{emp.overtime_multiplier}×</TableCell>
                    <TableCell className="text-xs">{$(emp.bonuses)}</TableCell>
                    <TableCell className="text-xs font-medium">{$(detail?.total_compensation)}</TableCell>
                    <TableCell className="text-xs text-amber-600">{$(detail?.unbillable_cost)}</TableCell>
                    <TableCell className="text-xs font-semibold text-blue-600">{$(detail?.direct_labor_cost)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({ ...emp })}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.ask(emp)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Overhead staff table */}
      {subTab === "overhead" && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {["Role","Name","Annual Salary","Bonus","Total Comp"].map(h => <TableHead key={h}>{h}</TableHead>)}
                <TableHead className="w-16 text-right">✎</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ohStaff.map((emp: Employee) => {
                const detail = empDetails.find(d => d.id === emp.id);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="text-sm">{emp.role}</TableCell>
                    <TableCell className="text-sm font-medium">{emp.name}</TableCell>
                    <TableCell className="text-sm">{$(emp.annual_salary)}</TableCell>
                    <TableCell className="text-sm">{$(emp.bonuses)}</TableCell>
                    <TableCell className="text-sm font-semibold">{$(detail?.total_compensation)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({ ...emp })}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.ask(emp)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Employee edit modal */}
      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="space-y-1"><Label>Role</Label><Input value={editing.role ?? ""} onChange={e => f("role", e.target.value)} /></div>
              <div className="space-y-1"><Label>Name</Label><Input value={editing.name ?? ""} onChange={e => f("name", e.target.value)} /></div>
              <div className="space-y-1 col-span-2">
                <Label>Type</Label>
                <Select value={editing.employee_type ?? "hourly"} onValueChange={v => f("employee_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="hourly">Hourly</SelectItem><SelectItem value="salaried">Salaried</SelectItem></SelectContent>
                </Select>
              </div>
              {editing.employee_type === "hourly" ? (
                <>
                  <div className="space-y-1"><Label>Hourly Wage ($)</Label><Input type="number" value={editing.hourly_wage ?? 0} onChange={e => f("hourly_wage", +e.target.value)} /></div>
                  <div className="space-y-1"><Label>Total Hours/Yr</Label><Input type="number" value={editing.total_hours_per_year ?? 0} onChange={e => f("total_hours_per_year", +e.target.value)} /></div>
                  <div className="space-y-1"><Label>Unbillable Hrs</Label><Input type="number" value={editing.unbillable_hours_per_year ?? 0} onChange={e => f("unbillable_hours_per_year", +e.target.value)} /></div>
                  <div className="space-y-1"><Label>OT Hours</Label><Input type="number" value={editing.overtime_hours ?? 0} onChange={e => f("overtime_hours", +e.target.value)} /></div>
                  <div className="space-y-1"><Label>OT Multiplier</Label><Input type="number" step="0.1" value={editing.overtime_multiplier ?? 1.5} onChange={e => f("overtime_multiplier", +e.target.value)} /></div>
                </>
              ) : (
                <div className="space-y-1 col-span-2"><Label>Annual Salary ($)</Label><Input type="number" value={editing.annual_salary ?? 0} onChange={e => f("annual_salary", +e.target.value)} /></div>
              )}
              <div className="space-y-1"><Label>Bonuses ($)</Label><Input type="number" value={editing.bonuses ?? 0} onChange={e => f("bonuses", +e.target.value)} /></div>
              <div className="space-y-1 flex items-center gap-2 pt-5">
                <Switch checked={!!editing.is_overhead_staff} onCheckedChange={v => f("is_overhead_staff", v)} />
                <Label>Overhead Staff</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate(editing)} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del.target} onOpenChange={o => { if (!o) del.clear(); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {del.target?.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => del.target && delMut.mutate(del.target.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── EQUIPMENT TAB ────────────────────────────────────────────────────────────
function EquipmentTab({ budgetId, data, summary }: { budgetId: number; data: any; summary: Summary | undefined }) {
  const [subTab, setSubTab] = useState<"owned" | "leased">("owned");
  const ownedDetails  = summary?.equipment_owned_details  ?? data?.equipOwned  ?? [];
  const leasedDetails = summary?.equipment_leased_details ?? data?.equipLeased ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Equipment Overhead Total" value={$(summary?.equipment_overhead_total)} sub="all owned + leased" color="text-amber-600" />
        <SummaryCard label="Owned Equipment" value={num(ownedDetails.length) + " assets"} sub={$(ownedDetails.reduce((s: number, e: any) => s + (e.total_annual_cost ?? 0), 0)) + " /yr"} />
      </div>

      <div className="flex gap-2 border-b">
        {(["owned", "leased"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "owned" ? `Owned (${data?.equipOwned?.length ?? 0})` : `Leased (${data?.equipLeased?.length ?? 0})`}
          </button>
        ))}
      </div>

      {subTab === "owned" && (
        <SimpleTable
          cols={["Name","Qty","Replacement","Life (yrs)","Sell Price","Overhead","Cost to Own","Total/Yr"]}
          rows={ownedDetails}
          budgetId={budgetId}
          endpoint="equipment-owned"
          renderCell={(row, col) => {
            if (col === "Name") return row.name;
            if (col === "Qty") return row.quantity;
            if (col === "Replacement") return $(row.replacement_cost);
            if (col === "Life (yrs)") return row.useful_life_years;
            if (col === "Sell Price") return $(row.sell_price);
            if (col === "Overhead") return row.is_overhead ? <Badge variant="secondary" className="text-xs">Overhead</Badge> : <Badge variant="outline" className="text-xs">Billable</Badge>;
            if (col === "Cost to Own") return $2(row.annual_cost_to_own);
            if (col === "Total/Yr") return <span className="font-semibold">{$(row.total_annual_cost)}</span>;
          }}
          buildDefault={() => ({ name: "", quantity: 1, replacement_cost: 0, useful_life_years: 5, sell_price: 0, is_overhead: true, billable_hours_per_year: 0 })}
          renderEditFields={(form, setForm) => (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2"><Label>Name</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Qty</Label><Input type="number" value={form.quantity ?? 1} onChange={e => setForm({ ...form, quantity: +e.target.value })} /></div>
                <div className="space-y-1"><Label>Replacement Cost ($)</Label><Input type="number" value={form.replacement_cost ?? 0} onChange={e => setForm({ ...form, replacement_cost: +e.target.value })} /></div>
                <div className="space-y-1"><Label>Useful Life (yrs)</Label><Input type="number" value={form.useful_life_years ?? 5} onChange={e => setForm({ ...form, useful_life_years: +e.target.value })} /></div>
                <div className="space-y-1"><Label>Sell Price ($)</Label><Input type="number" value={form.sell_price ?? 0} onChange={e => setForm({ ...form, sell_price: +e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_overhead} onCheckedChange={v => setForm({ ...form, is_overhead: v })} />
                <Label>Is Overhead (vs Billable)</Label>
              </div>
            </>
          )}
        />
      )}

      {subTab === "leased" && (
        <SimpleTable
          cols={["Name","Qty","Monthly","Annual Cost","Overhead"]}
          rows={leasedDetails}
          budgetId={budgetId}
          endpoint="equipment-leased"
          renderCell={(row, col) => {
            if (col === "Name") return row.name;
            if (col === "Qty") return row.quantity;
            if (col === "Monthly") return $(row.monthly_payment);
            if (col === "Annual Cost") return <span className="font-semibold">{$(row.total_annual_cost)}</span>;
            if (col === "Overhead") return row.is_overhead ? <Badge variant="secondary" className="text-xs">Overhead</Badge> : <Badge variant="outline" className="text-xs">Billable</Badge>;
          }}
          buildDefault={() => ({ name: "", quantity: 1, monthly_payment: 0, is_overhead: true })}
          renderEditFields={(form, setForm) => (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><Label>Name</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Qty</Label><Input type="number" value={form.quantity ?? 1} onChange={e => setForm({ ...form, quantity: +e.target.value })} /></div>
              <div className="space-y-1"><Label>Monthly Payment ($)</Label><Input type="number" value={form.monthly_payment ?? 0} onChange={e => setForm({ ...form, monthly_payment: +e.target.value })} /></div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch checked={!!form.is_overhead} onCheckedChange={v => setForm({ ...form, is_overhead: v })} />
                <Label>Is Overhead</Label>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

// ─── OVERHEAD TAB ─────────────────────────────────────────────────────────────
function OverheadTab({ budgetId, data, summary }: { budgetId: number; data: any; summary: Summary | undefined }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [editItem, setEditItem] = useState<any>(null);
  const del = useDeleteConfirm();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/mors/budgets/${budgetId}`] });
    qc.invalidateQueries({ queryKey: [`/api/mors/budgets/${budgetId}/summary`] });
  };

  const cats: any[] = data?.overheadCats ?? [];
  const items: any[] = data?.overheadItems ?? [];

  const saveItemMut = useMutation({
    mutationFn: (d: any) =>
      d.id
        ? apiRequest("PUT", `/api/mors/budgets/${budgetId}/overhead-items/${d.id}`, d)
        : apiRequest("POST", `/api/mors/budgets/${budgetId}/overhead-items`, d),
    onSuccess: () => { invalidate(); setEditItem(null); toast({ title: "Saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const delItemMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mors/budgets/${budgetId}/overhead-items/${id}`),
    onSuccess: () => { invalidate(); del.clear(); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggle = (catId: number) => setCollapsed(prev => {
    const s = new Set(prev);
    s.has(catId) ? s.delete(catId) : s.add(catId);
    return s;
  });

  return (
    <div className="space-y-4">
      {/* Auto-calculated header cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Unbillable Labor"   value={$(summary?.total_unbillable_labor)} sub="auto-calculated" color="text-amber-600" />
        <SummaryCard label="Equipment Overhead" value={$(summary?.equipment_overhead_total)} sub="auto-calculated" />
        <SummaryCard label="Additional Overhead" value={$(summary?.additional_overhead)} sub="items + overhead staff" />
        <SummaryCard label="Total Overhead"     value={$(summary?.total_overhead)} sub="unbillable + equip + additional" color="text-primary" />
      </div>

      {/* Overhead items by category */}
      <div className="space-y-3">
        {cats.map((cat: any) => {
          const catItems = items.filter((i: any) => i.category_id === cat.id);
          const catTotal = catItems.reduce((s: number, i: any) => s + parseFloat(i.annual_cost || 0), 0);
          const isCollapsed = collapsed.has(cat.id);
          return (
            <Card key={cat.id}>
              <div className="flex items-center justify-between px-4 py-3 border-b cursor-pointer hover:bg-muted/20"
                onClick={() => toggle(cat.id)}>
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-medium text-sm">{cat.name}</span>
                  <Badge variant="outline" className="text-xs">{catItems.length} items</Badge>
                </div>
                <span className="font-semibold text-sm">{$(catTotal)} / yr</span>
              </div>
              {!isCollapsed && (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10">
                        <TableHead>Expense</TableHead>
                        <TableHead className="w-28 text-right">Monthly</TableHead>
                        <TableHead className="w-28 text-right">Annual</TableHead>
                        <TableHead className="w-16 text-right">✎</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.name}</TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground">{$(item.monthly_cost)}</TableCell>
                          <TableCell className="text-sm text-right font-medium">{$(item.annual_cost)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem({ ...item })}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.ask(item)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="px-4 py-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => setEditItem({ category_id: cat.id, name: "", monthly_cost: 0, annual_cost: 0 })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add item to {cat.name}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Edit/Add item modal */}
      <Dialog open={!!editItem} onOpenChange={o => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editItem?.id ? "Edit" : "Add"} Overhead Item</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-3 py-1">
              <div className="space-y-1"><Label>Name</Label><Input value={editItem.name ?? ""} onChange={e => setEditItem({ ...editItem, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Monthly ($)</Label>
                  <Input type="number" value={editItem.monthly_cost ?? 0}
                    onChange={e => setEditItem({ ...editItem, monthly_cost: +e.target.value, annual_cost: +e.target.value * 12 })} />
                </div>
                <div className="space-y-1">
                  <Label>Annual ($)</Label>
                  <Input type="number" value={editItem.annual_cost ?? 0}
                    onChange={e => setEditItem({ ...editItem, annual_cost: +e.target.value, monthly_cost: Math.round(+e.target.value / 12) })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={() => saveItemMut.mutate(editItem)} disabled={saveItemMut.isPending}>
              {saveItemMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del.target} onOpenChange={o => { if (!o) del.clear(); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this item?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => del.target && delItemMut.mutate(del.target.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── SALES TAB ────────────────────────────────────────────────────────────────
function SalesTab({ budgetId, data, summary }: { budgetId: number; data: any; summary: Summary | undefined }) {
  const targets: any[] = data?.salesTargets ?? [];
  const totalTargets = targets.reduce((s, t) => s + parseFloat(t.annual_revenue_target || 0), 0);
  const required = summary?.required_revenue ?? 0;
  const gap = totalTargets - required;
  const onTrack = totalTargets >= required;

  return (
    <div className="space-y-4">
      {/* Required revenue card */}
      <Card className={`border-2 ${onTrack ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Required Revenue (MORS)</p>
              <p className="text-3xl font-bold mt-1">{$(required)}</p>
              <p className="text-sm text-muted-foreground mt-1">at {pct(summary?.net_margin_pct)} target margin</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">Total Sales Targets</p>
              <p className="text-2xl font-bold">{$(totalTargets)}</p>
              <p className={`text-sm font-semibold mt-1 ${onTrack ? "text-green-600" : "text-red-600"}`}>
                {onTrack ? "▲" : "▼"} {$(Math.abs(gap))} {onTrack ? "above" : "below"} required
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SimpleTable
        cols={["Division", "Annual Target", "% of Required"]}
        rows={targets}
        budgetId={budgetId}
        endpoint="sales-targets"
        renderCell={(row, col) => {
          if (col === "Division") return row.division_name;
          if (col === "Annual Target") return <span className="font-semibold">{$(row.annual_revenue_target)}</span>;
          if (col === "% of Required") return required > 0 ? pct((parseFloat(row.annual_revenue_target) / required) * 100) : "—";
        }}
        buildDefault={() => ({ division_name: "", annual_revenue_target: 0 })}
        renderEditFields={(form, setForm) => (
          <div className="space-y-3">
            <div className="space-y-1"><Label>Division Name</Label><Input value={form.division_name ?? ""} onChange={e => setForm({ ...form, division_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Annual Revenue Target ($)</Label><Input type="number" value={form.annual_revenue_target ?? 0} onChange={e => setForm({ ...form, annual_revenue_target: +e.target.value })} /></div>
          </div>
        )}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════════════════════
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview",       label: "Overview",        icon: TrendingUp },
  { id: "labor",          label: "Labor",           icon: Users },
  { id: "materials",      label: "Materials",       icon: ShoppingCart },
  { id: "equipment",      label: "Equipment",       icon: Wrench },
  { id: "subcontractors", label: "Subcontractors",  icon: Building2 },
  { id: "overhead",       label: "Overhead",        icon: DollarSign },
  { id: "sales",          label: "Sales",           icon: Target },
];

export default function MorsBudget() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [, nav] = useLocation();
  const [budgetId, setBudgetId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Admin-only guard
  useEffect(() => {
    if (user && user.role !== "Admin" && !(user as any).isMasterAdmin) {
      nav("/");
      toast({ title: "Access denied", description: "MORS Budget is for Admins only.", variant: "destructive" });
    }
  }, [user]);

  // Load budget list
  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ["/api/mors/budgets"],
  });

  // Auto-select active or first budget
  useEffect(() => {
    if (!budgetId && budgets.length > 0) {
      const active = budgets.find((b: Budget) => b.status === "active") ?? budgets[0];
      setBudgetId(active.id);
    }
  }, [budgets, budgetId]);

  // Load full budget data
  const { data: budgetData, isLoading: dataLoading } = useQuery<any>({
    queryKey: [`/api/mors/budgets/${budgetId}`],
    enabled: !!budgetId,
  });

  // Load summary (calculations)
  const { data: summary } = useQuery<Summary>({
    queryKey: [`/api/mors/budgets/${budgetId}/summary`],
    enabled: !!budgetId,
  });

  const budget: Budget | undefined = budgetData?.budget;

  return (
    <div className="flex h-full" data-testid="mors-budget-page">
      {/* ── Left sidebar ───────────────────────────────────────────────────── */}
      <div className="w-52 shrink-0 border-r flex flex-col bg-muted/10">
        {/* Budget selector */}
        <div className="p-3 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Budget</p>
          <Select value={budgetId ? String(budgetId) : ""} onValueChange={v => setBudgetId(Number(v))}>
            <SelectTrigger className="h-8 text-sm" data-testid="budget-selector"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {budgets.map(b => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {budget && (
            <div className="flex items-center gap-1 mt-1.5">
              <Badge variant={budget.status === "active" ? "default" : "secondary"} className="text-[10px] h-4">
                {budget.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{budget.year}</span>
            </div>
          )}
        </div>

        {/* Key metrics in sidebar */}
        {summary && (
          <div className="px-3 py-2 border-b space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Required Rev</span>
              <span className="font-semibold text-primary">{$(summary.required_revenue)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Labor Rate</span>
              <span className="font-semibold">{$2(summary.display_labor_rate)}/hr</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Net Profit</span>
              <span className="font-semibold text-green-600">{$(summary.net_profit)}</span>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Right content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-background flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              {budget?.name ?? "MORS Budget"} — {TABS.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Labor Rate, Overhead Recovery &amp; Sales Planning
            </p>
          </div>
          {budget && (
            <div className="text-right text-xs text-muted-foreground">
              <div>Season: {budget.work_season_start} → {budget.work_season_end}</div>
              <div>{budget.production_days} production days · {budget.working_days_per_week} days/week</div>
            </div>
          )}
        </div>

        <div className="p-6">
          {dataLoading || !budgetId ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {activeTab === "overview"       && <OverviewTab summary={summary} budget={budget} />}
              {activeTab === "labor"          && <LaborTab budgetId={budgetId} data={budgetData} summary={summary} />}
              {activeTab === "materials"      && (
                <SimpleTable
                  cols={["Name","Monthly Cost","Annual Cost"]}
                  rows={budgetData?.materials ?? []}
                  budgetId={budgetId}
                  endpoint="materials"
                  renderCell={(row, col) => {
                    if (col === "Name") return row.name;
                    if (col === "Monthly Cost") return $(row.monthly_cost);
                    if (col === "Annual Cost") return <span className="font-semibold">{$(row.annual_cost)}</span>;
                  }}
                  buildDefault={() => ({ name: "", monthly_cost: 0, annual_cost: 0 })}
                  renderEditFields={(form, setForm) => (
                    <div className="space-y-3">
                      <div className="space-y-1"><Label>Name</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>Monthly ($)</Label><Input type="number" value={form.monthly_cost ?? 0} onChange={e => setForm({ ...form, monthly_cost: +e.target.value, annual_cost: Math.round(+e.target.value * 12) })} /></div>
                        <div className="space-y-1"><Label>Annual ($)</Label><Input type="number" value={form.annual_cost ?? 0} onChange={e => setForm({ ...form, annual_cost: +e.target.value, monthly_cost: Math.round(+e.target.value / 12) })} /></div>
                      </div>
                    </div>
                  )}
                />
              )}
              {activeTab === "equipment"      && <EquipmentTab budgetId={budgetId} data={budgetData} summary={summary} />}
              {activeTab === "subcontractors" && (
                <SimpleTable
                  cols={["Name","Monthly Cost","Annual Cost"]}
                  rows={budgetData?.subs ?? []}
                  budgetId={budgetId}
                  endpoint="subcontractors"
                  renderCell={(row, col) => {
                    if (col === "Name") return row.name;
                    if (col === "Monthly Cost") return $(row.monthly_cost);
                    if (col === "Annual Cost") return <span className="font-semibold">{$(row.annual_cost)}</span>;
                  }}
                  buildDefault={() => ({ name: "", monthly_cost: 0, annual_cost: 0 })}
                  renderEditFields={(form, setForm) => (
                    <div className="space-y-3">
                      <div className="space-y-1"><Label>Name</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>Monthly ($)</Label><Input type="number" value={form.monthly_cost ?? 0} onChange={e => setForm({ ...form, monthly_cost: +e.target.value, annual_cost: Math.round(+e.target.value * 12) })} /></div>
                        <div className="space-y-1"><Label>Annual ($)</Label><Input type="number" value={form.annual_cost ?? 0} onChange={e => setForm({ ...form, annual_cost: +e.target.value, monthly_cost: Math.round(+e.target.value / 12) })} /></div>
                      </div>
                    </div>
                  )}
                />
              )}
              {activeTab === "overhead"       && <OverheadTab budgetId={budgetId} data={budgetData} summary={summary} />}
              {activeTab === "sales"          && <SalesTab budgetId={budgetId} data={budgetData} summary={summary} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
