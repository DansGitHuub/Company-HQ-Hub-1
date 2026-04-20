import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { EstimateFormModal } from "./EstimateFormModal";
import { EstimateStatusBadge, ESTIMATE_TYPE_LABELS } from "./index";
import {
  Calculator, ArrowLeft, Edit2, Send, CheckCircle2, XCircle,
  Briefcase, Building2, User, Calendar, Trash2, RefreshCw, Loader2, Eye, Globe, Copy, Check,
  ChevronDown, ChevronRight, Pencil, RotateCcw, Upload
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { Link } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItemDetail {
  id: string; item_type: string; description: string;
  quantity: string; unit: string; unit_price: string; amount: string; is_optional: boolean;
}
interface WorkAreaDetail {
  id: string; name: string; sort_order: number;
  category: string | null; area_description: string | null;
  line_items: LineItemDetail[];
}
interface EstimateDetail {
  id: string; estimate_number: string; title: string; status: string;
  estimate_type: string; customer_id: string | null; property_id: string | null;
  customer_name: string | null; customer_email: string | null; customer_phone: string | null;
  property_address: string | null; salesperson_name: string | null; salesperson_id: string | null;
  issued_date: string; valid_until: string | null;
  subtotal: string; tax_rate: string; tax_amount: string;
  discount_amount: string; total: string;
  down_payment_percent: string; down_payment_amount: string;
  notes: string | null; customer_message: string | null; terms: string | null;
  terms_and_conditions_override: string | null;
  deposit_percentage: number | null;
  initials: string | null;
  presentation_style: string | null;
  customer_response: string | null; customer_response_at: string | null;
  customer_response_note: string | null;
  sent_at: string | null; viewed_at: string | null;
  converted_at: string | null; converted_job_id: string | null;
  portal_token: string | null;
  created_at: string; updated_at: string;
  work_areas: WorkAreaDetail[];
  signedAt: string | null;
  signatureType: string | null;
  signatureData: string | null;
  signerName: string | null;
  signerInitials: string | null;
  signerIp: string | null;
  signedDocumentUrl: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(v: any) {
  const n = parseFloat(v ?? "0");
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy h:mm a"); } catch { return d; }
}

const ITEM_TYPE_CLS: Record<string, string> = {
  service:  "text-blue-600 dark:text-blue-400",
  material: "text-amber-600 dark:text-amber-400",
  labor:    "text-green-600 dark:text-green-400",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function EstimateDetail() {
  const [, params] = useRoute("/estimates/:id");
  const [, nav] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const id = params?.id ?? "";

  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [tcExpanded, setTcExpanded] = useState(false);
  const [tcEditing, setTcEditing] = useState(false);
  const [tcDraft, setTcDraft] = useState("");
  const [depositDraft, setDepositDraft] = useState<number | "">("");
  const [savingTC, setSavingTC] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFileUrl, setUploadFileUrl] = useState("");
  const [uploadSignerName, setUploadSignerName] = useState("");

  const { data: estimate, isLoading, error } = useQuery<EstimateDetail>({
    queryKey: ["/api/estimates", id],
    queryFn: async () => {
      const res = await fetch(`/api/estimates/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  // Map estimate type to the correct T&C type slug
  const tcType = (() => {
    const t = estimate?.estimate_type ?? "";
    if (t === "maintenance_contract") return "maintenance";
    if (t === "snow_contract") return "snow";
    return "install";
  })();

  const { data: defaultTC } = useQuery<{ id: string; content: string; title: string } | null>({
    queryKey: ["/api/settings/terms/active", tcType],
    queryFn: () => fetch(`/api/settings/terms/active/${tcType}`, { credentials: "include" }).then(r => r.json()),
  });

  const canEdit   = ["Admin", "Manager", "Master Admin"].includes(user?.role ?? "");
  const canDelete = ["Admin", "Master Admin"].includes(user?.role ?? "");

  // Status mutations
  const sendMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/estimates/${id}/send`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] }); queryClient.invalidateQueries({ queryKey: ["/api/estimates"] }); toast({ title: "Estimate marked as sent" }); },
    onError:   () => toast({ title: "Error", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/estimates/${id}/approve`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] }); queryClient.invalidateQueries({ queryKey: ["/api/estimates"] }); toast({ title: "Estimate approved" }); },
    onError:   () => toast({ title: "Error", variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/estimates/${id}/decline`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] }); queryClient.invalidateQueries({ queryKey: ["/api/estimates"] }); toast({ title: "Estimate declined" }); },
    onError:   () => toast({ title: "Error", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/estimates/${id}/convert`, {}),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Converted to job!", description: "A new job has been created." });
    },
    onError: () => toast({ title: "Error converting", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/estimates/${id}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/estimates"] }); nav("/estimates"); },
    onError:   () => toast({ title: "Error deleting", variant: "destructive" }),
  });

  const sendToPortalMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/estimates/${id}/send-to-portal`, {}).then(r => r.json()),
    onSuccess: (data: { portal_url: string }) => {
      setPortalUrl(data.portal_url);
      setShowPortalDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
    },
    onError: () => toast({ title: "Error generating portal link", variant: "destructive" }),
  });

  const uploadSignedMutation = useMutation({
    mutationFn: async (payload: { fileUrl: string; signerName: string }) => {
      const res = await apiRequest("POST", `/api/estimates/${id}/upload-signed`, payload);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setShowUploadDialog(false);
      setUploadFileUrl("");
      setUploadSignerName("");
      toast({ title: "Signed copy recorded", description: "Physical signature has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  function copyPortalUrl() {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!estimate) {
    return <div className="p-8 text-center text-muted-foreground">Estimate not found.</div>;
  }

  const isExpired = estimate.valid_until
    ? !isAfter(parseISO(estimate.valid_until), new Date())
    : false;

  const subtotal = parseFloat(estimate.subtotal);
  const taxPct = parseFloat(estimate.tax_rate) * 100;
  const taxAmt = parseFloat(estimate.tax_amount);
  const discAmt = parseFloat(estimate.discount_amount);
  const total = parseFloat(estimate.total);
  const dpPct = parseFloat(estimate.down_payment_percent);
  const dpAmt = parseFloat(estimate.down_payment_amount);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => nav("/estimates")} className="hover:text-foreground flex items-center gap-1" data-testid="btn-back-estimates">
            <ArrowLeft className="h-4 w-4" /> Estimates
          </button>
          <span>/</span>
          <span className="text-foreground font-medium">{estimate.estimate_number ?? "Draft"}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status transitions */}
          {estimate.status === "draft" && canEdit && (
            <Button size="sm" variant="outline" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} data-testid="btn-mark-sent">
              <Send className="h-3.5 w-3.5 mr-1.5" /> Mark Sent
            </Button>
          )}
          {(estimate.status === "sent" || estimate.status === "viewed") && canEdit && (
            <>
              <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="btn-approve">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending} data-testid="btn-decline">
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Decline
              </Button>
            </>
          )}
          {estimate.status === "approved" && !estimate.converted_job_id && canEdit && (
            <Button size="sm" variant="outline" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending} data-testid="btn-convert-job">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              {convertMutation.isPending ? "Converting…" : "Convert to Job"}
            </Button>
          )}
          {canEdit && estimate.status !== "converted" && (
            <Button size="sm"
              className="bg-green-600 hover:bg-green-700 text-white border-0"
              onClick={() => {
                if (estimate.portal_token) {
                  setPortalUrl(`https://companyhq.app/portal/${estimate.portal_token}`);
                  setShowPortalDialog(true);
                } else {
                  sendToPortalMutation.mutate();
                }
              }}
              disabled={sendToPortalMutation.isPending}
              data-testid="btn-send-to-portal">
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              {sendToPortalMutation.isPending ? "Generating…" : estimate.portal_token ? "Portal Link" : "Send to Portal"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => nav(`/estimates/${id}/preview`)} data-testid="btn-preview-estimate">
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview / PDF
          </Button>
          {canEdit && estimate.status !== "converted" && (
            <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} data-testid="btn-edit-estimate">
              <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowDeleteDialog(true)} data-testid="btn-delete-estimate">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-[1fr_320px] gap-6">

        {/* LEFT: Estimate body */}
        <div className="space-y-5">
          {/* Header card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="h-5 w-5 text-primary" />
                    <h1 className="text-xl font-bold">{estimate.title}</h1>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span className="font-mono">{estimate.estimate_number ?? "—"}</span>
                    <span>·</span>
                    <span>{ESTIMATE_TYPE_LABELS[estimate.estimate_type] ?? estimate.estimate_type}</span>
                    {isExpired && estimate.status !== "approved" && estimate.status !== "converted" && (
                      <><span>·</span><span className="text-red-500 font-medium">Expired</span></>
                    )}
                  </div>
                </div>
                <EstimateStatusBadge status={estimate.status} />
              </div>

              {estimate.customer_message && (
                <div className="bg-muted/40 rounded-md p-3 text-sm italic text-muted-foreground border">
                  {estimate.customer_message}
                </div>
              )}

              {estimate.converted_job_id && (
                <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-300 rounded-md px-3 py-2 border border-purple-200 dark:border-purple-800">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span>Converted to job. </span>
                  <Link href={`/jobs/${estimate.converted_job_id}`} className="underline font-medium ml-1" data-testid="link-converted-job">
                    View Job →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work areas */}
          {estimate.work_areas.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm">Scope of Work</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-5">
                {estimate.work_areas.map(area => {
                  const areaSub = area.line_items.reduce((s, li) => s + parseFloat(li.amount ?? "0"), 0);
                  return (
                    <div key={area.id}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">{area.name}</h3>
                        <span className="text-sm text-muted-foreground tabular-nums">{fmtMoney(areaSub)}</span>
                      </div>
                      <div className="space-y-0.5">
                        {/* Column headers */}
                        <div className="grid grid-cols-[100px_1fr_60px_60px_90px_80px] gap-2 text-[10px] text-muted-foreground font-medium px-1 pb-1">
                          <span>Class</span>
                          <span>Description</span>
                          <span className="text-right">Qty</span>
                          <span>Unit</span>
                          <span className="text-right">Unit Price</span>
                          <span className="text-right">Amount</span>
                        </div>
                        {area.line_items.map(li => (
                          <div key={li.id} className="grid grid-cols-[100px_1fr_60px_60px_90px_80px] gap-2 text-sm items-center py-1.5 rounded-sm hover:bg-muted/40 px-1">
                            <span className={`text-xs font-medium capitalize ${ITEM_TYPE_CLS[li.item_type] ?? ""}`}>{li.item_type}</span>
                            <span className="text-sm">{li.description}{li.is_optional && <Badge variant="outline" className="ml-2 text-[10px] py-0">Optional</Badge>}</span>
                            <span className="text-right tabular-nums">{li.quantity}</span>
                            <span className="text-muted-foreground text-xs">{li.unit || "—"}</span>
                            <span className="text-right tabular-nums">{fmtMoney(li.unit_price)}</span>
                            <span className="text-right font-medium tabular-nums">{fmtMoney(li.amount)}</span>
                          </div>
                        ))}
                      </div>
                      {area !== estimate.work_areas[estimate.work_areas.length - 1] && <Separator className="mt-4" />}
                    </div>
                  );
                })}

                {/* Pricing summary */}
                <div className="border-t pt-4 flex justify-end">
                  <div className="w-64 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">{fmtMoney(subtotal)}</span>
                    </div>
                    {taxPct > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax ({taxPct.toFixed(2)}%)</span>
                        <span className="tabular-nums">{fmtMoney(taxAmt)}</span>
                      </div>
                    )}
                    {discAmt > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span className="tabular-nums">-{fmtMoney(discAmt)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span className="tabular-nums">{fmtMoney(total)}</span>
                    </div>
                    {dpPct > 0 && (
                      <div className="flex justify-between text-blue-600 text-xs">
                        <span>Down Payment ({dpPct}%)</span>
                        <span className="tabular-nums">{fmtMoney(dpAmt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Terms & Conditions (enhanced) */}
          {(() => {
            const tcContent = estimate.terms_and_conditions_override || defaultTC?.content || estimate.terms;
            const hasOverride = !!estimate.terms_and_conditions_override;
            const depositPct = estimate.deposit_percentage ?? 50;

            async function saveTC() {
              setSavingTC(true);
              try {
                await apiRequest("PATCH", `/api/estimates/${id}/terms`, {
                  terms_and_conditions_override: tcDraft || null,
                  deposit_percentage: typeof depositDraft === "number" ? depositDraft : undefined,
                });
                qc.invalidateQueries({ queryKey: ["/api/estimates", id] });
                toast({ title: "Terms updated" });
                setTcEditing(false);
              } catch { toast({ title: "Failed to save terms", variant: "destructive" }); }
              finally { setSavingTC(false); }
            }

            async function resetTC() {
              setSavingTC(true);
              try {
                await apiRequest("PATCH", `/api/estimates/${id}/terms`, { terms_and_conditions_override: null });
                qc.invalidateQueries({ queryKey: ["/api/estimates", id] });
                toast({ title: "Terms reset to default" });
                setTcEditing(false);
              } catch { toast({ title: "Failed to reset", variant: "destructive" }); }
              finally { setSavingTC(false); }
            }

            return (
              <Card data-testid="card-terms">
                <CardHeader
                  className="pb-2 pt-4 px-5 cursor-pointer flex flex-row items-center justify-between"
                  onClick={() => setTcExpanded(v => !v)}
                >
                  <div className="flex items-center gap-2">
                    {tcExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <CardTitle className="text-sm">Terms &amp; Conditions</CardTitle>
                    {hasOverride && <Badge variant="outline" className="text-xs">Custom</Badge>}
                  </div>
                  {canEdit && tcExpanded && !tcEditing && (
                    <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                      {hasOverride && (
                        <Button size="sm" variant="ghost" onClick={resetTC} disabled={savingTC} className="text-xs h-7 px-2" data-testid="btn-reset-terms">
                          <RotateCcw className="h-3 w-3 mr-1" />Reset to Default
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setTcDraft(estimate.terms_and_conditions_override || defaultTC?.content || ""); setDepositDraft(depositPct); setTcEditing(true); }} className="text-xs h-7 px-2" data-testid="btn-edit-terms">
                        <Pencil className="h-3 w-3 mr-1" />Edit Terms
                      </Button>
                    </div>
                  )}
                </CardHeader>
                {tcExpanded && (
                  <CardContent className="px-5 pb-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Deposit %</span>
                      {tcEditing ? (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={depositDraft}
                          onChange={e => setDepositDraft(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-20 h-7 text-xs"
                          data-testid="input-deposit-pct"
                        />
                      ) : (
                        <span className="text-sm font-semibold">{depositPct}%</span>
                      )}
                    </div>
                    {tcEditing ? (
                      <>
                        <Textarea
                          value={tcDraft}
                          onChange={e => setTcDraft(e.target.value)}
                          className="min-h-[280px] font-mono text-xs"
                          data-testid="textarea-tc-edit"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setTcEditing(false)}>Cancel</Button>
                          <Button size="sm" onClick={saveTC} disabled={savingTC} data-testid="btn-save-terms">
                            {savingTC ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                        {tcContent || <span className="italic">No terms configured. Go to Settings → Terms &amp; Conditions to add them.</span>}
                      </p>
                    )}
                    {estimate.initials && (
                      <p className="text-xs text-muted-foreground pt-1 border-t">Customer initials: <strong>{estimate.initials}</strong></p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })()}

          {/* Notes */}
          {estimate.notes && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{estimate.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: Info sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4 text-muted-foreground" /> Customer
              </div>
              {estimate.customer_name ? (
                <div>
                  {estimate.customer_id ? (
                    <Link href={`/customers/${estimate.customer_id}`} className="text-sm font-medium text-primary hover:underline" data-testid="link-customer">
                      {estimate.customer_name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{estimate.customer_name}</p>
                  )}
                  {estimate.customer_email && <p className="text-xs text-muted-foreground">{estimate.customer_email}</p>}
                  {estimate.customer_phone && <p className="text-xs text-muted-foreground">{estimate.customer_phone}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No customer assigned</p>
              )}
              {estimate.property_address && (
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{estimate.property_address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardContent className="p-4 space-y-2.5">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" /> Dates
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issued</span>
                  <span>{fmtDate(estimate.issued_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span className={isExpired && !["approved","converted"].includes(estimate.status) ? "text-red-500" : ""}>
                    {fmtDate(estimate.valid_until)}
                  </span>
                </div>
                {estimate.sent_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sent</span>
                    <span>{fmtDate(estimate.sent_at)}</span>
                  </div>
                )}
                {estimate.viewed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Viewed</span>
                    <span>{fmtDate(estimate.viewed_at)}</span>
                  </div>
                )}
                {estimate.converted_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Converted</span>
                    <span>{fmtDate(estimate.converted_at)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Salesperson */}
          {estimate.salesperson_name && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Salesperson</p>
                <p className="text-sm font-medium">{estimate.salesperson_name}</p>
              </CardContent>
            </Card>
          )}

          {/* Customer response */}
          {estimate.customer_response && (
            <Card className={estimate.customer_response === "approved" ? "border-emerald-300" : "border-red-300"}>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground">Customer Response</p>
                <EstimateStatusBadge status={estimate.customer_response} />
                {estimate.customer_response_at && (
                  <p className="text-xs text-muted-foreground">{fmtDateTime(estimate.customer_response_at)}</p>
                )}
                {estimate.customer_response_note && (
                  <p className="text-xs mt-1 text-muted-foreground italic">{estimate.customer_response_note}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Signature record */}
        <Card className={estimate.signedAt ? "border-emerald-300" : ""}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Signature</p>
              {!estimate.signedAt && (
                <Button size="sm" variant="outline"
                  onClick={() => setShowUploadDialog(true)}
                  className="text-xs h-7 gap-1" data-testid="btn-upload-signed">
                  <Upload className="h-3 w-3" />Upload Signed Copy
                </Button>
              )}
            </div>
            {estimate.signedAt ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Signed</span>
                  {estimate.signatureType && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({estimate.signatureType === "uploaded" ? "physical copy" : "electronic"})
                    </span>
                  )}
                </div>
                {estimate.signerName && (
                  <p className="text-xs text-muted-foreground">
                    By: <span className="font-medium">{estimate.signerName}</span>
                    {estimate.signerInitials && (
                      <span className="ml-1 text-muted-foreground">({estimate.signerInitials})</span>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{fmtDateTime(estimate.signedAt)}</p>
                {estimate.signerIp && (
                  <p className="text-xs text-muted-foreground">IP: {estimate.signerIp}</p>
                )}
                {estimate.signedDocumentUrl && (
                  <a href={estimate.signedDocumentUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline block">
                    View signed document
                  </a>
                )}
                <Button size="sm" variant="ghost"
                  onClick={() => setShowUploadDialog(true)}
                  className="text-xs h-6 px-2 text-muted-foreground mt-1">
                  Replace signed copy
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No signature recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-xs">{fmtDateTime(estimate.created_at)}</p>
              <p className="text-xs text-muted-foreground mt-2">Last Updated</p>
              <p className="text-xs">{fmtDateTime(estimate.updated_at)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upload signed copy dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-upload-signed">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />Record Physical Signed Copy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Record a scanned or photographed signed document for this estimate.
            </p>
            <div className="space-y-2">
              <Label htmlFor="upload-signer-name">Signer Name</Label>
              <Input id="upload-signer-name" placeholder="Customer's full name"
                value={uploadSignerName}
                onChange={(e) => setUploadSignerName(e.target.value)}
                data-testid="input-upload-signer-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-file-url">Document URL</Label>
              <Input id="upload-file-url" placeholder="https://..."
                value={uploadFileUrl}
                onChange={(e) => setUploadFileUrl(e.target.value)}
                data-testid="input-upload-file-url" />
              <p className="text-xs text-muted-foreground">
                Paste the URL of the uploaded scan (e.g. from Google Drive, Dropbox, etc.)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button
              disabled={!uploadSignerName.trim() || !uploadFileUrl.trim() || uploadSignedMutation.isPending}
              onClick={() => uploadSignedMutation.mutate({ fileUrl: uploadFileUrl.trim(), signerName: uploadSignerName.trim() })}
              data-testid="btn-confirm-upload-signed">
              {uploadSignedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Signed Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      {showEdit && (
        <EstimateFormModal
          open={showEdit}
          onClose={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
          }}
          existing={estimate}
        />
      )}

      {/* Delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{estimate.estimate_number ?? "this estimate"}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              data-testid="btn-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Portal URL dialog */}
      <Dialog open={showPortalDialog} onOpenChange={setShowPortalDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-portal-url">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-600" />
              Customer Portal Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Share this link with the customer so they can review and respond to the estimate online.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={portalUrl}
                className="font-mono text-xs"
                onClick={e => (e.target as HTMLInputElement).select()}
                data-testid="input-portal-url"
              />
              <Button size="sm" variant="outline" onClick={copyPortalUrl} data-testid="btn-copy-portal-url">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {copied && <p className="text-xs text-green-600 font-medium">Copied to clipboard!</p>}
            <p className="text-xs text-muted-foreground">
              The estimate status will update to <strong>Viewed</strong> when the customer opens the link, and to <strong>Approved</strong> or <strong>Declined</strong> when they respond.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
