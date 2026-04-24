import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Customer { id: string; first_name: string; last_name: string; company_name: string | null; }
interface Job { id: string; title: string; client: string; }

interface LineItem { description: string; quantity: string; unit_price: string; }

interface InvoiceFormData {
  customer_id: string;
  job_id: string;
  issued_date: string;
  due_date: string;
  tax_rate: string;
  discount_amount: string;
  notes: string;
  terms: string;
  customer_message: string;
  customer_response: string;
  customer_response_note: string;
  line_items: LineItem[];
}

const EMPTY_ITEM = (): LineItem => ({ description: "", quantity: "1", unit_price: "" });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialData?: Partial<InvoiceFormData> & { id?: string };
  lockedCustomerId?: string;
  lockedJobId?: string;
  onSuccess?: (inv: any) => void;
}

function calcTotal(items: LineItem[], taxRate: string, discountAmount: string) {
  const subtotal = items.reduce((s, i) => {
    const q = parseFloat(i.quantity || "0");
    const p = parseFloat(i.unit_price || "0");
    return s + (isNaN(q) || isNaN(p) ? 0 : q * p);
  }, 0);
  const discount = parseFloat(discountAmount || "0") || 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (parseFloat(taxRate || "0") / 100);
  return { subtotal, discount, tax, total: taxable + tax };
}

export function InvoiceFormModal({ open, onOpenChange, initialData, lockedCustomerId, lockedJobId, onSuccess }: Props) {
  const { t } = useTranslation("invoices");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData?.id;

  // Build today's date from local parts — toISOString() returns UTC which can be tomorrow
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState<InvoiceFormData>({
    customer_id: lockedCustomerId ?? "",
    job_id: lockedJobId ?? "",
    issued_date: today,
    due_date: "",
    tax_rate: "0",
    discount_amount: "0",
    notes: "",
    terms: t("defaultTerms"),
    customer_message: "",
    customer_response: "",
    customer_response_note: "",
    line_items: [EMPTY_ITEM()],
    ...initialData,
  });

  useEffect(() => {
    if (open) setForm({
      customer_id: lockedCustomerId ?? "",
      job_id: lockedJobId ?? "",
      issued_date: today,
      due_date: "",
      tax_rate: "0",
      discount_amount: "0",
      notes: "",
      terms: t("defaultTerms"),
      customer_message: "",
      customer_response: "",
      customer_response_note: "",
      line_items: [EMPTY_ITEM()],
      ...initialData,
    });
  }, [open]);

  // When a job is selected on a new invoice, auto-populate line items from
  // the estimate that originated the job (if any). Only fires when all current
  // lines are blank so user-entered content is never overwritten.
  useEffect(() => {
    if (!form.job_id || isEdit) return;
    const allBlank = form.line_items.every(li => !li.description.trim());
    if (!allBlank) return;
    fetch(`/api/jobs/${form.job_id}/suggested-line-items`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : []))
      .then((items: Array<{ description: string; quantity: string; unit_price: string }>) => {
        if (items.length > 0) {
          setForm(f => ({ ...f, line_items: items }));
        }
      })
      .catch(() => {}); // silent failure — user can always enter lines manually
  }, [form.job_id]);

  const set = (k: keyof Omit<InvoiceFormData, "line_items">, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => (await apiRequest("GET", "/api/customers")).json(),
    enabled: open && !lockedCustomerId,
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !lockedJobId,
  });

  // Line item helpers
  const updateItem = (idx: number, field: keyof LineItem, val: string) => {
    setForm((f) => {
      const items = f.line_items.map((li, i) => i === idx ? { ...li, [field]: val } : li);
      return { ...f, line_items: items };
    });
  };
  const addItem = () => setForm((f) => ({ ...f, line_items: [...f.line_items, EMPTY_ITEM()] }));
  const removeItem = (idx: number) => setForm((f) => ({
    ...f, line_items: f.line_items.filter((_, i) => i !== idx),
  }));

  const { subtotal, discount, tax, total } = calcTotal(form.line_items, form.tax_rate, form.discount_amount);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        customer_id: lockedCustomerId || form.customer_id || null,
        job_id: lockedJobId || form.job_id || null,
        tax_rate: parseFloat(form.tax_rate || "0") / 100,
        discount_amount: parseFloat(form.discount_amount || "0"),
        line_items: form.line_items
          .filter((li) => li.description.trim())
          .map((li) => ({
            description: li.description,
            quantity: parseFloat(li.quantity || "1"),
            unit_price: parseFloat(li.unit_price || "0"),
          })),
      };
      const url = isEdit ? `/api/invoices/${initialData!.id}` : "/api/invoices";
      const method = isEdit ? "PUT" : "POST";
      const res = await apiRequest(method, url, payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: isEdit ? t("invoiceUpdated") : t("invoiceCreated") });
      onOpenChange(false);
      onSuccess?.(inv);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editInvoice") : t("newInvoice")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Customer + Job */}
          <div className="grid grid-cols-2 gap-3">
            {!lockedCustomerId && (
              <div className="space-y-1">
                <Label>{t("customer")}</Label>
                <select value={form.customer_id} onChange={(e) => set("customer_id", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid="select-customer">
                  <option value="">{t("noSpecificCustomer")}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{c.company_name ? ` — ${c.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!lockedJobId && (
              <div className="space-y-1">
                <Label>{t("jobOptional")}</Label>
                <select value={form.job_id} onChange={(e) => set("job_id", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid="select-job">
                  <option value="">{t("noLinkedJob")}</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title || j.client}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>{t("issueDateLabel")}</Label>
              <Input type="date" value={form.issued_date} onChange={(e) => set("issued_date", e.target.value)}
                data-testid="input-issue-date" />
            </div>
            <div className="space-y-1">
              <Label>{t("dueDateLabel")}</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)}
                data-testid="input-due-date" />
            </div>
            <div className="space-y-1">
              <Label>{t("taxRateLabel")}</Label>
              <Input type="number" min="0" max="100" step="0.1" value={form.tax_rate}
                onChange={(e) => set("tax_rate", e.target.value)}
                placeholder="0" data-testid="input-tax-rate" />
            </div>
            <div className="space-y-1">
              <Label>{t("discountDollarLabel")}</Label>
              <Input type="number" min="0" step="0.01" value={form.discount_amount}
                onChange={(e) => set("discount_amount", e.target.value)}
                placeholder="0.00" data-testid="input-discount" />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{t("lineItems")}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("addLine")}
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[1fr,80px,100px,36px] gap-0 bg-muted/40 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">{t("description")}</span>
                <span className="text-xs font-medium text-muted-foreground text-center">{t("qty")}</span>
                <span className="text-xs font-medium text-muted-foreground text-right">{t("unitPrice")}</span>
                <span />
              </div>
              {form.line_items.map((item, idx) => {
                return (
                  <div key={idx} className="grid grid-cols-[1fr,80px,100px,36px] gap-1 px-2 py-1.5 border-t items-center">
                    <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)}
                      placeholder={t("descPlaceholder")}
                      className="h-8 text-sm border-0 shadow-none focus-visible:ring-0 px-1"
                      data-testid={`input-line-desc-${idx}`} />
                    <Input type="number" min="0" step="0.5" value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      className="h-8 text-sm text-center border-0 shadow-none focus-visible:ring-0 px-1"
                      data-testid={`input-line-qty-${idx}`} />
                    <div className="flex items-center gap-0.5">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                        className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-0 px-1"
                        data-testid={`input-line-price-${idx}`} />
                    </div>
                    <button onClick={() => removeItem(idx)} disabled={form.line_items.length === 1}
                      className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors"
                      data-testid={`button-remove-line-${idx}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Totals */}
              <div className="border-t bg-muted/20 px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>{t("discount")}</span>
                    <span>−${discount.toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(form.tax_rate) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("taxWithRate", { rate: form.tax_rate })}</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t pt-1.5 mt-1">
                  <span>{t("total")}</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes + Terms + Customer Message */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                {t("internalNotes")}{" "}
                <span className="text-muted-foreground/60 text-xs">({t("internalNotesNotShown")})</span>
              </Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
                rows={3} placeholder={t("internalNotesPlaceholder")} data-testid="textarea-notes" />
            </div>
            <div className="space-y-1">
              <Label>{t("termsLabel")}</Label>
              <Textarea value={form.terms} onChange={(e) => set("terms", e.target.value)}
                rows={3} placeholder={t("termsPlaceholder")} data-testid="textarea-terms" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                {t("customerMessageLabel")}{" "}
                <span className="text-muted-foreground/60 text-xs">({t("customerMessageSent")})</span>
              </Label>
              <Textarea value={form.customer_message} onChange={(e) => set("customer_message", e.target.value)}
                rows={2} placeholder={t("customerMessagePlaceholder")}
                data-testid="textarea-customer-message" />
            </div>
            <div className="space-y-1">
              <Label>
                {t("customerResponseLabel")}{" "}
                <span className="text-muted-foreground/60 text-xs">({t("theirReply")})</span>
              </Label>
              <Textarea value={form.customer_response} onChange={(e) => set("customer_response", e.target.value)}
                rows={2} placeholder={t("customerResponsePlaceholder")}
                data-testid="textarea-customer-response" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>
              {t("responseNoteLabel")}{" "}
              <span className="text-muted-foreground/60 text-xs">({t("internalFollowUp")})</span>
            </Label>
            <Textarea value={form.customer_response_note} onChange={(e) => set("customer_response_note", e.target.value)}
              rows={2} placeholder={t("responseNotePlaceholder")}
              data-testid="textarea-customer-response-note" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-primary"
            data-testid="button-save-invoice">
            {mutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("saving")}</>
              : isEdit ? t("saveChanges") : t("createInvoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
