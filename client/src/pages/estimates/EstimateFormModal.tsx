import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Loader2, Calculator, Package, Hammer, Wrench
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  _key: string;
  item_type: "service" | "material" | "labor";
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  is_optional: boolean;
}

interface WorkAreaDraft {
  _key: string;
  name: string;
  work_area_type_id: string;
  category: string;
  area_description: string;
  line_items: LineItem[];
  collapsed: boolean;
}

interface Template {
  id: string; name: string; estimate_type: string;
  default_work_areas: any[] | null;
  default_terms: string | null;
  default_customer_message: string | null;
}

interface CustomerRow { id: string; first_name: string; last_name: string; company_name: string; email: string; }
interface PropertyRow { id: string; address: string; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function key() { return Math.random().toString(36).slice(2); }

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ITEM_TYPE_OPTS: { value: "service" | "material" | "labor"; label: string; icon: any }[] = [
  { value: "service",  label: "Service",  icon: Wrench },
  { value: "material", label: "Material", icon: Package },
  { value: "labor",    label: "Labor",    icon: Hammer },
];

const ESTIMATE_TYPES = [
  { value: "project",              label: "Landscape Project" },
  { value: "maintenance_contract", label: "Maintenance Contract" },
  { value: "snow_contract",        label: "Snow & Ice Contract" },
  { value: "other",                label: "Other" },
];

function defaultLineItem(): LineItem {
  return { _key: key(), item_type: "service", description: "", quantity: 1, unit: "", unit_price: 0, amount: 0, is_optional: false };
}

function defaultArea(name = ""): WorkAreaDraft {
  return { _key: key(), name, work_area_type_id: "", category: "", area_description: "", line_items: [defaultLineItem()], collapsed: false };
}

function lineAmount(item: LineItem) {
  return Math.round(item.quantity * item.unit_price * 100) / 100;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  existing?: any;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EstimateFormModal({ open, onClose, existing }: Props) {
  const { toast } = useToast();
  const isEdit = !!existing;

  // Header fields
  const [customerId, setCustomerId] = useState(existing?.customer_id ?? "");
  const [customerSearch, setCustomerSearch] = useState(existing?.customer_name ?? "");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [propertyId, setPropertyId] = useState(existing?.property_id ?? "");
  const [estimateType, setEstimateType] = useState(existing?.estimate_type ?? "project");
  const [title, setTitle] = useState(existing?.title ?? "New Estimate");
  const [salespersonId, setSalespersonId] = useState(existing?.salesperson_id ?? "");
  const [issuedDate, setIssuedDate] = useState(existing?.issued_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(existing?.valid_until?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [customerMessage, setCustomerMessage] = useState(existing?.customer_message ?? "");
  const [terms, setTerms] = useState(existing?.terms ?? "");
  const [taxRate, setTaxRate] = useState(parseFloat(existing?.tax_rate ?? "0") * 100);
  const [discountAmount, setDiscountAmount] = useState(parseFloat(existing?.discount_amount ?? "0"));
  const [downPaymentPct, setDownPaymentPct] = useState(parseFloat(existing?.down_payment_percent ?? "0"));
  const [presentationStyle, setPresentationStyle] = useState<"simple" | "booklet">(existing?.presentation_style ?? "simple");

  // Work areas
  const [areas, setAreas] = useState<WorkAreaDraft[]>(() => {
    if (existing?.work_areas?.length) {
      return existing.work_areas.map((a: any) => ({
        _key: key(),
        name: a.name,
        work_area_type_id: a.work_area_type_id ?? "",
        category: a.category ?? "",
        area_description: a.area_description ?? "",
        collapsed: false,
        line_items: (a.line_items ?? []).map((li: any) => ({
          _key: key(),
          item_type: li.item_type ?? "service",
          description: li.description ?? "",
          quantity: parseFloat(li.quantity ?? "1"),
          unit: li.unit ?? "",
          unit_price: parseFloat(li.unit_price ?? "0"),
          amount: parseFloat(li.amount ?? "0"),
          is_optional: li.is_optional ?? false,
        })),
      }));
    }
    return [defaultArea("Work Area 1")];
  });

  // Queries
  const { data: templates = [] } = useQuery<Template[]>({ queryKey: ["/api/estimate-templates"] });
  const { data: allStaff = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const staff = (allStaff as any[]).filter((u: any) => ["Admin","Manager","Master Admin"].includes(u.role));

  // Customer search
  const { data: customerResults = [] } = useQuery<CustomerRow[]>({
    queryKey: ["/api/customers/search", customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return [];
      const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=8`, { credentials: "include" });
      const d = await res.json();
      return d.customers ?? d;
    },
    enabled: customerSearch.length >= 2 && showCustomerDrop,
  });

  // Properties for selected customer
  const { data: properties = [] } = useQuery<PropertyRow[]>({
    queryKey: ["/api/properties", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const res = await fetch(`/api/properties?customer_id=${customerId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!customerId,
  });

  // Template auto-fill
  function applyTemplate(tpl: Template) {
    if (tpl.estimate_type) setEstimateType(tpl.estimate_type);
    if (tpl.default_terms) setTerms(tpl.default_terms);
    if (tpl.default_customer_message) setCustomerMessage(tpl.default_customer_message);
    if (tpl.default_work_areas?.length) {
      const newAreas: WorkAreaDraft[] = tpl.default_work_areas.map((wa: any) => ({
        _key: key(),
        name: wa.name,
        work_area_type_id: "",
        collapsed: false,
        line_items: (wa.line_items ?? []).map((li: any) => ({
          _key: key(),
          item_type: li.item_type ?? "service",
          description: li.description ?? "",
          quantity: li.quantity ?? 1,
          unit: li.unit ?? "",
          unit_price: li.unit_price ?? 0,
          amount: 0,
          is_optional: false,
        })),
      }));
      setAreas(newAreas);
    }
  }

  // ── Computed totals ──────────────────────────────────────────────────────────
  const subtotal = areas.reduce((sum, a) =>
    sum + a.line_items.reduce((s, li) => s + lineAmount(li), 0), 0
  );
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;
  const downPaymentAmount = Math.round((total * (downPaymentPct / 100)) * 100) / 100;

  // ── Area helpers ─────────────────────────────────────────────────────────────
  const addArea = () => setAreas(prev => [...prev, defaultArea(`Work Area ${prev.length + 1}`)]);

  const removeArea = (aKey: string) => setAreas(prev => prev.filter(a => a._key !== aKey));

  const toggleArea = (aKey: string) =>
    setAreas(prev => prev.map(a => a._key === aKey ? { ...a, collapsed: !a.collapsed } : a));

  const updateArea = (aKey: string, patch: Partial<WorkAreaDraft>) =>
    setAreas(prev => prev.map(a => a._key === aKey ? { ...a, ...patch } : a));

  const addLineItem = (aKey: string) =>
    setAreas(prev => prev.map(a => a._key === aKey ? { ...a, line_items: [...a.line_items, defaultLineItem()] } : a));

  const removeLineItem = (aKey: string, iKey: string) =>
    setAreas(prev => prev.map(a => a._key === aKey
      ? { ...a, line_items: a.line_items.filter(li => li._key !== iKey) }
      : a
    ));

  const updateLineItem = (aKey: string, iKey: string, patch: Partial<LineItem>) =>
    setAreas(prev => prev.map(a => a._key === aKey
      ? {
          ...a, line_items: a.line_items.map(li => {
            if (li._key !== iKey) return li;
            const updated = { ...li, ...patch };
            updated.amount = lineAmount(updated);
            return updated;
          })
        }
      : a
    ));

  // ── Mutation ─────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEdit) {
        const res = await apiRequest("PUT", `/api/estimates/${existing.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/estimates", payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: isEdit ? "Estimate updated" : "Estimate created" });
      onClose();
    },
    onError: () => toast({ title: "Error saving estimate", variant: "destructive" }),
  });

  function handleSubmit() {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    mutation.mutate({
      customer_id: customerId || null,
      property_id: propertyId || null,
      estimate_type: estimateType,
      title,
      salesperson_id: salespersonId || null,
      issued_date: issuedDate,
      valid_until: validUntil || null,
      notes, customer_message: customerMessage, terms,
      presentation_style: presentationStyle,
      subtotal, tax_rate: taxRate / 100, tax_amount: taxAmount,
      discount_amount: discountAmount, total,
      down_payment_percent: downPaymentPct, down_payment_amount: downPaymentAmount,
      work_areas: areas.map(a => ({
        name: a.name,
        work_area_type_id: a.work_area_type_id || null,
        category: a.category || null,
        area_description: a.area_description || null,
        line_items: a.line_items.map(li => ({
          item_type: li.item_type,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unit_price: li.unit_price,
          amount: lineAmount(li),
          is_optional: li.is_optional,
        })),
      })),
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5 text-primary" />
            {isEdit ? "Edit Estimate" : "New Estimate"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6">
          {/* ── Template picker ── */}
          {!isEdit && templates.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Start from a template (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {templates.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    data-testid={`btn-template-${tpl.id}`}
                    className="px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-accent transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Basic info ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="est-title" className="text-xs">Title *</Label>
              <Input id="est-title" value={title} onChange={e => setTitle(e.target.value)}
                data-testid="input-estimate-title" className="mt-1" />
            </div>

            <div className="relative">
              <Label className="text-xs">Customer</Label>
              <Input
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); if (!e.target.value) { setCustomerId(""); setPropertyId(""); } }}
                onFocus={() => setShowCustomerDrop(true)}
                placeholder="Search customers..."
                data-testid="input-customer-search"
                className="mt-1"
              />
              {showCustomerDrop && customerResults.length > 0 && (
                <div className="absolute z-50 w-full bg-popover border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
                  {customerResults.map((c: CustomerRow) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerSearch(`${c.first_name} ${c.last_name}${c.company_name ? ` (${c.company_name})` : ""}`);
                        setShowCustomerDrop(false);
                        setPropertyId("");
                      }}
                    >
                      {c.first_name} {c.last_name}
                      {c.company_name && <span className="text-muted-foreground ml-1">— {c.company_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId} disabled={!customerId}>
                <SelectTrigger className="mt-1" data-testid="select-property">
                  <SelectValue placeholder={customerId ? "Select property" : "Select customer first"} />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p: PropertyRow) => (
                    <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Estimate Type</Label>
              <Select value={estimateType} onValueChange={setEstimateType}>
                <SelectTrigger className="mt-1" data-testid="select-estimate-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTIMATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Salesperson</Label>
              <Select value={salespersonId} onValueChange={setSalespersonId}>
                <SelectTrigger className="mt-1" data-testid="select-salesperson">
                  <SelectValue placeholder="Assign salesperson" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {staff.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="issued-date" className="text-xs">Issued Date</Label>
              <Input id="issued-date" type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)}
                className="mt-1" data-testid="input-issued-date" />
            </div>

            <div>
              <Label htmlFor="valid-until" className="text-xs">Valid Until</Label>
              <Input id="valid-until" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className="mt-1" data-testid="input-valid-until" />
            </div>
          </div>

          {/* ── Customer Message ── */}
          <div>
            <Label className="text-xs">Customer Message / Introduction</Label>
            <Textarea rows={2} value={customerMessage} onChange={e => setCustomerMessage(e.target.value)}
              className="mt-1 resize-none" data-testid="textarea-customer-message"
              placeholder="Brief message shown at the top of the estimate for the customer..." />
          </div>

          {/* ── Presentation Style ── */}
          <div>
            <Label className="text-xs">Presentation Style</Label>
            <div className="flex gap-2 mt-1">
              {(["simple", "booklet"] as const).map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setPresentationStyle(style)}
                  data-testid={`btn-style-${style}`}
                  className={`flex-1 py-1.5 text-sm rounded border font-medium transition-colors ${
                    presentationStyle === style
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-muted hover:border-primary/50"
                  }`}
                >
                  {style === "simple" ? "Simple (1-page summary)" : "Booklet (detailed proposal)"}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Work Areas ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Work Areas &amp; Line Items</h3>
              <Button type="button" size="sm" variant="outline" onClick={addArea} data-testid="btn-add-work-area">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Work Area
              </Button>
            </div>

            <div className="space-y-3">
              {areas.map((area, aIdx) => {
                const areaSub = area.line_items.reduce((s, li) => s + lineAmount(li), 0);
                return (
                  <div key={area._key} className="border rounded-lg overflow-hidden">
                    {/* Area header */}
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
                      <button type="button" onClick={() => toggleArea(area._key)} className="text-muted-foreground hover:text-foreground">
                        {area.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      </button>
                      <Input
                        value={area.name}
                        onChange={e => updateArea(area._key, { name: e.target.value })}
                        className="flex-1 h-7 text-sm font-medium bg-transparent border-0 focus-visible:ring-0 px-0"
                        data-testid={`input-area-name-${aIdx}`}
                      />
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{fmtMoney(areaSub)}</span>
                      <button type="button" onClick={() => removeArea(area._key)}
                        className="text-muted-foreground hover:text-destructive ml-1" data-testid={`btn-remove-area-${aIdx}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Line items */}
                    {!area.collapsed && (
                      <div className="p-3 space-y-2">
                        {/* Category + Description row */}
                        <div className="grid grid-cols-[1fr_1fr] gap-2 mb-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Category</Label>
                            <Select value={area.category || ""} onValueChange={v => updateArea(area._key, { category: v })}>
                              <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-category-${aIdx}`}>
                                <SelectValue placeholder="Select category..." />
                              </SelectTrigger>
                              <SelectContent>
                                {["Landscaping", "Hardscaping", "Irrigation", "Lawn Care", "Tree Service", "Snow Removal", "Lighting", "Drainage", "Cleanup", "Other"].map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Area Description</Label>
                            <Input
                              value={area.area_description}
                              onChange={e => updateArea(area._key, { area_description: e.target.value })}
                              className="h-7 text-xs mt-0.5"
                              placeholder="Brief description of this area..."
                              data-testid={`input-area-desc-${aIdx}`}
                            />
                          </div>
                        </div>
                        {/* Column headers */}
                        <div className="grid grid-cols-[90px_1fr_60px_70px_80px_70px_28px] gap-1 text-[10px] text-muted-foreground font-medium px-1">
                          <span>Type</span>
                          <span>Description</span>
                          <span>Qty</span>
                          <span>Unit</span>
                          <span>Unit Price</span>
                          <span className="text-right">Amount</span>
                          <span />
                        </div>
                        {area.line_items.map((li, iIdx) => (
                          <div key={li._key} className="grid grid-cols-[90px_1fr_60px_70px_80px_70px_28px] gap-1 items-center">
                            <Select value={li.item_type} onValueChange={v => updateLineItem(area._key, li._key, { item_type: v as any })}>
                              <SelectTrigger className="h-7 text-xs" data-testid={`select-item-type-${aIdx}-${iIdx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ITEM_TYPE_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              value={li.description}
                              onChange={e => updateLineItem(area._key, li._key, { description: e.target.value })}
                              className="h-7 text-xs"
                              placeholder="Description..."
                              data-testid={`input-desc-${aIdx}-${iIdx}`}
                            />
                            <Input
                              type="number" min="0" step="0.01"
                              value={li.quantity}
                              onChange={e => updateLineItem(area._key, li._key, { quantity: parseFloat(e.target.value) || 0 })}
                              className="h-7 text-xs"
                              data-testid={`input-qty-${aIdx}-${iIdx}`}
                            />
                            <Input
                              value={li.unit}
                              onChange={e => updateLineItem(area._key, li._key, { unit: e.target.value })}
                              className="h-7 text-xs"
                              placeholder="ea, hr..."
                              data-testid={`input-unit-${aIdx}-${iIdx}`}
                            />
                            <Input
                              type="number" min="0" step="0.01"
                              value={li.unit_price}
                              onChange={e => updateLineItem(area._key, li._key, { unit_price: parseFloat(e.target.value) || 0 })}
                              className="h-7 text-xs"
                              data-testid={`input-uprice-${aIdx}-${iIdx}`}
                            />
                            <div className="text-right text-xs font-medium pr-1 tabular-nums">
                              {fmtMoney(lineAmount(li))}
                            </div>
                            <button type="button" onClick={() => removeLineItem(area._key, li._key)}
                              className="text-muted-foreground hover:text-destructive" data-testid={`btn-remove-item-${aIdx}-${iIdx}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <Button type="button" size="sm" variant="ghost" onClick={() => addLineItem(area._key)}
                          className="h-7 text-xs" data-testid={`btn-add-item-${aIdx}`}>
                          <Plus className="h-3 w-3 mr-1" /> Add Line Item
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* ── Pricing ── */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Tax Rate (%)</Label>
                <Input type="number" min="0" max="100" step="0.01" value={taxRate}
                  onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="mt-1" data-testid="input-tax-rate" />
              </div>
              <div>
                <Label className="text-xs">Discount ($)</Label>
                <Input type="number" min="0" step="0.01" value={discountAmount}
                  onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1" data-testid="input-discount" />
              </div>
              <div>
                <Label className="text-xs">Down Payment Required (%)</Label>
                <Input type="number" min="0" max="100" step="1" value={downPaymentPct}
                  onChange={e => setDownPaymentPct(parseFloat(e.target.value) || 0)}
                  className="mt-1" data-testid="input-down-payment-pct" />
              </div>
            </div>

            <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{fmtMoney(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                  <span className="font-medium tabular-nums">{fmtMoney(taxAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-medium tabular-nums">-{fmtMoney(discountAmount)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(total)}</span>
              </div>
              {downPaymentPct > 0 && (
                <div className="flex justify-between text-blue-600 text-xs">
                  <span>Down Payment ({downPaymentPct}%)</span>
                  <span className="font-medium tabular-nums">{fmtMoney(downPaymentAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Notes & Terms ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Internal Notes</Label>
              <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                className="mt-1 resize-none text-sm" data-testid="textarea-notes"
                placeholder="Private notes for internal use only..." />
            </div>
            <div>
              <Label className="text-xs">Terms &amp; Conditions</Label>
              <Textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)}
                className="mt-1 resize-none text-sm" data-testid="textarea-terms"
                placeholder="Payment terms, cancellation policy..." />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t flex justify-end gap-2 sticky bottom-0 bg-background">
          <Button variant="outline" onClick={onClose} data-testid="btn-cancel-estimate">Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} data-testid="btn-save-estimate">
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Estimate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
