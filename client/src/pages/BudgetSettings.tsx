import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, DollarSign, RefreshCw } from "lucide-react";

const CLASS_NAMES: Record<number, string> = {
  1: "Labor",
  2: "Equipment",
  3: "Materials",
  4: "Subcontracting",
};

const CLASS_COLORS: Record<number, string> = {
  1: "bg-blue-100 text-blue-800",
  2: "bg-purple-100 text-purple-800",
  3: "bg-green-100 text-green-800",
  4: "bg-orange-100 text-orange-800",
};

interface ClassRow {
  classId: number;
  className?: string;
  year: number;
  overheadPct: string;
  profitMarginPct: string;
}

function pctToDisplay(val: string | number | null | undefined): string {
  if (val == null || val === "") return "";
  const n = parseFloat(String(val));
  if (isNaN(n)) return "";
  return (n * 100).toFixed(2);
}

function displayToPct(val: string): number {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return n / 100;
}

export default function BudgetSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: defaults, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/class-pricing-defaults"],
    queryFn: () => apiRequest("GET", "/api/class-pricing-defaults").then((r) => r.json()),
    staleTime: 60_000,
  });

  const [rows, setRows] = useState<ClassRow[]>([]);

  useEffect(() => {
    if (defaults && defaults.length > 0) {
      setRows(
        defaults.map((d: any) => ({
          classId: d.class_id ?? d.classId,
          className: d.class_name ?? undefined,
          year: d.year ?? new Date().getFullYear(),
          overheadPct: pctToDisplay(d.overhead_pct ?? d.overheadPct ?? 0.15),
          profitMarginPct: pctToDisplay(d.profit_margin_pct ?? d.profitMarginPct ?? 0.20),
        }))
      );
    } else if (!isLoading) {
      setRows(
        [1, 2, 3, 4].map((classId) => ({
          classId,
          year: new Date().getFullYear(),
          overheadPct: "15.00",
          profitMarginPct: "20.00",
        }))
      );
    }
  }, [defaults, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (rows: ClassRow[]) => {
      await Promise.all(
        rows.map((row) =>
          apiRequest("PUT", `/api/class-pricing-defaults/${row.classId}`, {
            overheadPct: displayToPct(row.overheadPct),
            profitMarginPct: displayToPct(row.profitMarginPct),
            year: row.year,
          }).then((r) => r.json())
        )
      );
    },
    onSuccess: () => {
      toast({ title: "✓ Pricing defaults saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/class-pricing-defaults"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  function updateRow(classId: number, field: "overheadPct" | "profitMarginPct", value: string) {
    setRows((prev) => prev.map((r) => (r.classId === classId ? { ...r, [field]: value } : r)));
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-3xl mx-auto px-4 pb-12 pt-4 space-y-6">
      <div>
        <h1 data-testid="budget-settings-title" className="text-2xl font-bold text-gray-900">
          Budget &amp; Pricing Settings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Set default overhead and profit margin percentages by class for {currentYear}. These apply when no per-item override is set.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            Class Pricing Defaults — {currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide px-3">
                <span>Class</span>
                <span>Overhead %</span>
                <span>Profit Margin %</span>
                <span>Effective Price Multiplier</span>
              </div>

              {rows.map((row) => {
                const oh = parseFloat(row.overheadPct) || 0;
                const pm = parseFloat(row.profitMarginPct) || 0;
                const multiplier = (1 + oh / 100) * (1 + pm / 100);

                return (
                  <div
                    key={row.classId}
                    data-testid={`class-row-${row.classId}`}
                    className="grid grid-cols-4 gap-4 items-center bg-gray-50 rounded-xl px-3 py-3"
                  >
                    <div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${CLASS_COLORS[row.classId] ?? "bg-gray-100 text-gray-800"}`}
                      >
                        {row.className ?? CLASS_NAMES[row.classId] ?? ("Class " + row.classId)}
                      </span>
                    </div>

                    <div>
                      <Label className="sr-only">Overhead %</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.overheadPct}
                          onChange={(e) => updateRow(row.classId, "overheadPct", e.target.value)}
                          className="pr-6 text-sm h-9"
                          data-testid={`input-overhead-${row.classId}`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                      </div>
                    </div>

                    <div>
                      <Label className="sr-only">Profit Margin %</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.profitMarginPct}
                          onChange={(e) => updateRow(row.classId, "profitMarginPct", e.target.value)}
                          className="pr-6 text-sm h-9"
                          data-testid={`input-profit-${row.classId}`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                      </div>
                    </div>

                    <div className="text-sm font-mono text-gray-700">
                      {multiplier.toFixed(4)}×
                      <span className="text-xs text-gray-400 ml-1">
                        (cost × {multiplier.toFixed(2)})
                      </span>
                    </div>
                  </div>
                );
              })}

              <p className="text-xs text-gray-400 px-3">
                Formula: Sell Price = Cost × (1 + Overhead%) × (1 + Profit Margin%). Per-item overrides on the Item Catalog take precedence.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate(rows)}
          disabled={saveMutation.isPending || isLoading}
          className="bg-green-600 hover:bg-green-700 text-white gap-2"
          data-testid="save-pricing-button"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Saving…" : "Save Pricing Defaults"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          data-testid="refresh-pricing"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
