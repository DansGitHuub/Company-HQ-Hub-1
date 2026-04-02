import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft, ChevronDown, Pencil, User, Briefcase,
  Calendar, DollarSign, Loader2, Trash2, Plus, CreditCard,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { StatusBadge, STATUS_MAP } from "./index";
import { InvoiceFormModal } from "./InvoiceFormModal";
import { useAuth } from "@/hooks/use-auth";

interface LineItem {
  id: string; description: string; quantity: string;
  unit_price: string; amount: string; sort_order: number;
}
interface Payment {
  id: string; amount: string; payment_method: string;
  payment_date: string; reference_number: string | null; notes: string | null;
}
interface InvoiceDetail {
  id: string; invoice_number: string; status: string;
  customer_id: string | null; job_id: string | null;
  issued_date: string; due_date: string | null;
  subtotal: string; tax_rate: string; tax_amount: string; discount_amount: string;
  total: string; amount_paid: string; balance_due: string;
  notes: string | null; terms: string | null; customer_message: string | null; customer_response: string | null;
  cust_first: string | null; cust_last: string | null; cust_company: string | null;
  job_title: string | null; job_client: string | null; job_address: string | null;
  created_at: string; updated_at: string;
  line_items: LineItem[];
  payments: Payment[];
}

const INVOICE_STATUSES = [
  { value: "draft",             label: "Draft" },
  { value: "sent",              label: "Sent" },
  { value: "viewed",            label: "Viewed" },
  { value: "accepted",          label: "Accepted" },
  { value: "declined",          label: "Declined" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "paid",              label: "Paid" },
  { value: "void",              label: "Void" },
];

const PAYMENT_METHODS = ["cash","check","card","ach","zelle","other"];

function fmtMoney(v: any) {
  const n = parseFloat(v ?? "0");
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMMM d, yyyy"); } catch { return d; }
}

function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value?: React.ReactNode; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        {href
          ? <a href={href} className="text-sm font-medium text-primary hover:underline">{value}</a>
          : <p className="text-sm font-medium">{value}</p>}
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { effectiveRole } = useAuth();
  const isAdminOrManager = ["Admin", "Manager", "Master Admin"].includes(effectiveRole ?? "");

  const [showEdit, setShowEdit] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "", payment_method: "cash", payment_date: new Date().toISOString().split("T")[0],
    reference_number: "", notes: "",
  });

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ["/api/invoices", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invoices/${id}`);
      if (!res.ok) throw new Error("Invoice not found");
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/status`, { status });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices", id] });
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${id}/payments`, {
        amount: parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        payment_date: payForm.payment_date,
        reference_number: payForm.reference_number || null,
        notes: payForm.notes || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices", id] });
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment recorded" });
      setShowPaymentForm(false);
      setPayForm({ amount: "", payment_method: "cash", payment_date: new Date().toISOString().split("T")[0], reference_number: "", notes: "" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (payId: string) => {
      await apiRequest("DELETE", `/api/payments/${payId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices", id] });
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment removed" });
    },
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!invoice) {
    return <div className="p-8 text-center text-muted-foreground">Invoice not found.</div>;
  }

  const statusInfo = STATUS_MAP[invoice.status] ?? { label: invoice.status, cls: "bg-muted text-muted-foreground" };
  const custName = invoice.cust_first
    ? `${invoice.cust_first} ${invoice.cust_last}`
    : invoice.cust_company ?? undefined;
  const balanceDue = parseFloat(invoice.balance_due ?? "0");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")} className="text-muted-foreground"
          data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" /> Invoices
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-mono">{invoice.invoice_number}</h1>
        </div>
        {isAdminOrManager && (
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-edit">
            <Pencil className="h-4 w-4 mr-1.5" /> Edit Invoice
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-6">
        {/* ── Left ─────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              {/* Status */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">Status</p>
                {isAdminOrManager ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold hover:opacity-90 ${statusInfo.cls}`}
                        data-testid="button-status">
                        {statusInfo.label}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {INVOICE_STATUSES.map((s) => (
                        <DropdownMenuItem key={s.value} className="cursor-pointer"
                          onClick={() => statusMutation.mutate(s.value)}>
                          {s.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <StatusBadge status={invoice.status} />
                )}
              </div>

              <Separator className="mb-3" />

              <InfoRow icon={User} label="Customer" value={custName}
                href={invoice.customer_id ? `/customers/${invoice.customer_id}` : undefined} />
              <InfoRow icon={Briefcase} label="Job"
                value={invoice.job_title || invoice.job_client}
                href={invoice.job_id ? `/jobs/${invoice.job_id}` : undefined} />
              <InfoRow icon={Calendar} label="Issued" value={fmtDate(invoice.issued_date)} />
              <InfoRow icon={Calendar} label="Due"
                value={<span className={balanceDue > 0 && invoice.status === "overdue" ? "text-red-600 font-semibold" : ""}>
                  {fmtDate(invoice.due_date)}
                </span>} />
            </CardContent>
          </Card>

          {/* Balance Summary */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmtMoney(invoice.subtotal)}</span>
              </div>
              {parseFloat(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>−{fmtMoney(invoice.discount_amount)}</span>
                </div>
              )}
              {parseFloat(invoice.tax_rate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({(parseFloat(invoice.tax_rate) * 100).toFixed(2)}%)</span>
                  <span>{fmtMoney(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>Total</span>
                <span>{fmtMoney(invoice.total)}</span>
              </div>
              {parseFloat(invoice.amount_paid) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Paid</span>
                  <span>−{fmtMoney(invoice.amount_paid)}</span>
                </div>
              )}
              <div className={`flex justify-between text-base font-bold border-t pt-2 ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
                <span>Balance Due</span>
                <span>{fmtMoney(invoice.balance_due)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right ────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="items">
          <TabsList className="mb-4">
            <TabsTrigger value="items">Line Items</TabsTrigger>
            <TabsTrigger value="payments">
              Payments {invoice.payments.length > 0 && `(${invoice.payments.length})`}
            </TabsTrigger>
            <TabsTrigger value="notes">Notes & Terms</TabsTrigger>
          </TabsList>

          {/* Line Items */}
          <TabsContent value="items">
            <Card>
              <CardContent className="p-0">
                {invoice.line_items.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">No line items.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center w-20">Qty</TableHead>
                        <TableHead className="text-right w-28">Unit Price</TableHead>
                        <TableHead className="text-right w-28">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.line_items.map((li) => (
                        <TableRow key={li.id} data-testid={`row-li-${li.id}`}>
                          <TableCell className="text-sm">{li.description}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{li.quantity}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmtMoney(li.unit_price)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmtMoney(li.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="border-t px-4 py-3 flex justify-end">
                  <div className="space-y-1 text-sm min-w-[200px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{fmtMoney(invoice.subtotal)}</span>
                    </div>
                    {parseFloat(invoice.discount_amount) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span>−{fmtMoney(invoice.discount_amount)}</span>
                      </div>
                    )}
                    {parseFloat(invoice.tax_rate) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax ({(parseFloat(invoice.tax_rate) * 100).toFixed(2)}%)</span>
                        <span>{fmtMoney(invoice.tax_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-1.5 text-base">
                      <span>Total</span>
                      <span>{fmtMoney(invoice.total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            <Card>
              <CardHeader className="pb-3 pt-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Payment History</CardTitle>
                {isAdminOrManager && balanceDue > 0 && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setPayForm((f) => ({ ...f, amount: balanceDue.toFixed(2) }));
                    setShowPaymentForm(true);
                  }} data-testid="button-add-payment">
                    <Plus className="h-4 w-4 mr-1.5" /> Record Payment
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pb-4">
                {showPaymentForm && (
                  <div className="rounded-lg border p-4 space-y-3 mb-4 bg-muted/20">
                    <p className="text-sm font-semibold">New Payment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Amount ($)</Label>
                        <Input type="number" step="0.01" value={payForm.amount}
                          onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                          placeholder="0.00" data-testid="input-pay-amount" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Method</Label>
                        <select value={payForm.payment_method}
                          onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm capitalize"
                          data-testid="select-pay-method">
                          {PAYMENT_METHODS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={payForm.payment_date}
                          onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))}
                          data-testid="input-pay-date" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Reference # <span className="text-muted-foreground/60">(optional)</span></Label>
                        <Input value={payForm.reference_number}
                          onChange={(e) => setPayForm((f) => ({ ...f, reference_number: e.target.value }))}
                          placeholder="Check #, transaction ID…" data-testid="input-pay-ref" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending || !payForm.amount}
                        data-testid="button-save-payment">
                        {paymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                        Save Payment
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {invoice.payments.length === 0 && !showPaymentForm ? (
                  <div className="py-8 text-center">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                  </div>
                ) : invoice.payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        {isAdminOrManager && <TableHead className="w-8" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.payments.map((p) => (
                        <TableRow key={p.id} data-testid={`row-pay-${p.id}`}>
                          <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground capitalize">{p.payment_method}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.reference_number || "—"}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-green-600">
                            {fmtMoney(p.amount)}
                          </TableCell>
                          {isAdminOrManager && (
                            <TableCell>
                              <button onClick={() => deletePaymentMutation.mutate(p.id)}
                                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                data-testid={`button-del-pay-${p.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes & Terms */}
          <TabsContent value="notes">
            <div className="space-y-4">
              {invoice.customer_message && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm text-primary">Message to Customer</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm whitespace-pre-wrap">{invoice.customer_message}</p>
                  </CardContent>
                </Card>
              )}
              {invoice.customer_response && (
                <Card className="border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm text-amber-700 dark:text-amber-400">
                      Customer Response
                      {["accepted","declined","changes_requested"].includes(invoice.status) && (
                        <span className="ml-2 font-normal text-xs">
                          — <span className="capitalize">{invoice.status.replace("_", " ")}</span>
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm whitespace-pre-wrap">{invoice.customer_response}</p>
                  </CardContent>
                </Card>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Internal Notes</CardTitle></CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {invoice.notes || <span className="italic">No internal notes.</span>}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Terms</CardTitle></CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {invoice.terms || <span className="italic">No terms.</span>}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Modal */}
      {showEdit && invoice && (
        <InvoiceFormModal
          open={showEdit}
          onOpenChange={setShowEdit}
          initialData={{
            id: invoice.id,
            customer_id: invoice.customer_id ?? "",
            job_id: invoice.job_id ?? "",
            issued_date: invoice.issued_date?.split("T")[0] ?? "",
            due_date: invoice.due_date?.split("T")[0] ?? "",
            tax_rate: String(parseFloat(invoice.tax_rate ?? "0") * 100),
            discount_amount: String(parseFloat(invoice.discount_amount ?? "0")),
            notes: invoice.notes ?? "",
            terms: invoice.terms ?? "",
            customer_message: invoice.customer_message ?? "",
            customer_response: invoice.customer_response ?? "",
            line_items: invoice.line_items.map((li) => ({
              description: li.description,
              quantity: String(li.quantity),
              unit_price: String(li.unit_price),
            })),
          }}
        />
      )}
    </div>
  );
}
