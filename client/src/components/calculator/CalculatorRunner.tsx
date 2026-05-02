import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Calculator, AlertCircle, CheckCircle2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InputField {
  name: string;
  label: string;
  type: "number" | "select";
  default?: string | number;
  unit?: string;
  min?: number;
  options?: { value: string; label: string }[];
}

interface InputSchema {
  inputs: InputField[];
}

interface CalcSummary {
  id: string;
  name: string;
  display_name: string | null;
  category: string | null;
  description: string | null;
  input_schema: InputSchema | null;
  sort_order: number;
  is_active: boolean;
}

interface CalcDetail extends CalcSummary {
  formula: unknown;
  default_class_id: number | null;
}

interface LineItemPreview {
  id?: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  is_optional: boolean;
  sort_order: number;
}

interface RunResult {
  lineItems: LineItemPreview[];
  summary: {
    totalAmount: number;
    lineItemCount: number;
    derived: Record<string, number>;
  };
  run_id?: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  workAreaId: string;
  onInserted: () => void;
  trigger?: React.ReactNode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildDefaults(schema: InputSchema | null | undefined): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const f of schema?.inputs ?? []) {
    out[f.name] = f.default !== undefined ? f.default : (f.type === "number" ? 0 : "");
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalculatorRunner({ workAreaId, onInserted, trigger }: Props) {
  const [open, setOpen]             = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [values, setValues]         = useState<Record<string, string | number>>({});
  const [preview, setPreview]       = useState<RunResult | null>(null);
  const [calcErr, setCalcErr]       = useState<string>("");
  const [insertErr, setInsertErr]   = useState<string>("");

  // ── Fetch calculator list ──────────────────────────────────────────────────
  const {
    data: calculators = [],
    isLoading: listLoading,
    error: listError,
  } = useQuery<CalcSummary[]>({
    queryKey: ["/api/calculators"],
    enabled: open,
  });

  // ── Fetch selected calculator detail (includes input_schema) ──────────────
  const {
    data: calcDetail,
    isLoading: detailLoading,
  } = useQuery<CalcDetail>({
    queryKey: ["/api/calculators", selectedId],
    enabled: open && !!selectedId,
  });

  // Reset form values + clear preview when the selected calculator changes.
  useEffect(() => {
    if (calcDetail) {
      setValues(buildDefaults(calcDetail.input_schema));
    }
    setPreview(null);
    setCalcErr("");
    setInsertErr("");
  }, [calcDetail]);

  // Reset everything when dialog closes.
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setSelectedId("");
      setValues({});
      setPreview(null);
      setCalcErr("");
      setInsertErr("");
    }
  }

  // ── Preview mutation (persist: false) ─────────────────────────────────────
  const calcMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/calculators/${selectedId}/run`, {
        inputs: values,
        estimate_work_area_id: workAreaId || "",
        persist: false,
      });
      return res.json() as Promise<RunResult>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setCalcErr("");
    },
    onError: (err: any) => {
      setCalcErr(err?.message ?? "Calculation failed");
      setPreview(null);
    },
  });

  // ── Insert mutation (persist: true) ───────────────────────────────────────
  const insertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/calculators/${selectedId}/run`, {
        inputs: values,
        estimate_work_area_id: workAreaId,
        persist: true,
      });
      return res.json() as Promise<RunResult>;
    },
    onSuccess: () => {
      onInserted();
      handleOpenChange(false);
    },
    onError: (err: any) => {
      setInsertErr(err?.message ?? "Failed to insert line items");
    },
  });

  const inputFields: InputField[] = calcDetail?.input_schema?.inputs ?? [];
  const canInsert = !!workAreaId && !!selectedId;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        style={{ display: "contents" }}
        data-testid="btn-open-calculator-runner"
      >
        {trigger ?? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-xs gap-1 px-2"
            data-testid="btn-run-calculator-default"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          >
            <Calculator className="h-3 w-3" />
            Run Calculator
          </Button>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Run a calculator
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">

            {/* ── Calculator picker ── */}
            <div>
              <Label className="text-xs mb-1 block">Calculator</Label>
              {listLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading calculators…
                </div>
              ) : listError ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Failed to load calculators.
                </p>
              ) : (
                <Select
                  value={selectedId}
                  onValueChange={(v) => { setSelectedId(v); }}
                >
                  <SelectTrigger data-testid="select-calculator-pick">
                    <SelectValue placeholder="Select a calculator…" />
                  </SelectTrigger>
                  <SelectContent>
                    {calculators.map((c) => (
                      <SelectItem key={c.id} value={c.id} data-testid={`option-calc-${c.id}`}>
                        {c.display_name ?? c.name}
                        {c.category && (
                          <span className="text-muted-foreground ml-1 text-xs">— {c.category}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {calcDetail?.description && (
                <p className="text-xs text-muted-foreground mt-1">{calcDetail.description}</p>
              )}
            </div>

            {/* ── Dynamic input fields ── */}
            {detailLoading && selectedId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading inputs…
              </div>
            )}

            {!detailLoading && inputFields.length > 0 && (
              <div className="space-y-3">
                {inputFields.map((field) => (
                  <div key={field.name}>
                    <Label className="text-xs mb-1 block">
                      {field.label}
                      {field.unit && (
                        <span className="text-muted-foreground ml-1">({field.unit})</span>
                      )}
                    </Label>

                    {field.type === "number" ? (
                      <Input
                        type="number"
                        min={field.min}
                        step="any"
                        value={String(values[field.name] ?? (field.default ?? 0))}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                        className="h-8 text-sm"
                        data-testid={`input-calc-${field.name}`}
                      />
                    ) : (
                      <Select
                        value={String(values[field.name] ?? (field.default ?? ""))}
                        onValueChange={(v) =>
                          setValues((prev) => ({ ...prev, [field.name]: v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-calc-${field.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Action buttons ── */}
            {selectedId && !detailLoading && (
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={calcMutation.isPending}
                  onClick={() => calcMutation.mutate()}
                  data-testid="btn-calculate-preview"
                >
                  {calcMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Calculating…</>
                    : "Calculate"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={!canInsert || insertMutation.isPending || !preview}
                  onClick={() => insertMutation.mutate()}
                  data-testid="btn-insert-into-estimate"
                  title={!canInsert ? "Save the estimate first to enable insertion" : undefined}
                >
                  {insertMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Inserting…</>
                    : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Insert into estimate</>}
                </Button>
              </div>
            )}

            {/* ── Calc error ── */}
            {calcErr && (
              <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-calc-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {calcErr}
              </p>
            )}

            {/* ── Insert error ── */}
            {insertErr && (
              <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-insert-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {insertErr}
              </p>
            )}

            {/* ── Preview table ── */}
            {preview && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Preview — {preview.summary.lineItemCount} line item{preview.summary.lineItemCount !== 1 ? "s" : ""}
                </p>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left px-2 py-1.5 font-medium">Description</th>
                        <th className="text-right px-2 py-1.5 font-medium w-14">Qty</th>
                        <th className="text-left px-2 py-1.5 font-medium w-16">Unit</th>
                        <th className="text-right px-2 py-1.5 font-medium w-20">Unit $</th>
                        <th className="text-right px-2 py-1.5 font-medium w-20">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lineItems.map((li, i) => (
                        <tr
                          key={i}
                          className="border-t"
                          data-testid={`row-preview-item-${i}`}
                        >
                          <td className="px-2 py-1.5">{li.description}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{li.quantity}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{li.unit}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(li.unit_price)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtMoney(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20">
                        <td colSpan={4} className="px-2 py-1.5 text-right text-muted-foreground font-medium">
                          Total
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-bold" data-testid="text-preview-total">
                          {fmtMoney(preview.summary.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!canInsert && (
                  <p className="text-xs text-amber-600">
                    Save the estimate first to enable "Insert into estimate".
                  </p>
                )}
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
