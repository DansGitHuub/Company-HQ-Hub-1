import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, PackageOpen, Receipt, StickyNote,
  Users, ClipboardCheck, PenLine, Eraser, CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Material {
  id: number;
  material_name: string | null;
  quantity: string | null;
  unit: string | null;
  unit_cost: string | null;
}

interface Expense {
  id: number;
  description: string | null;
  amount: string | null;
  category: string | null;
}

interface TeamMember {
  id: number;
  user_name: string | null;
  username: string;
}

interface Worksheet {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  materials: Material[];
  expenses: Expense[];
  teamMembers: TeamMember[];
}

interface ActiveEntry {
  id: number;
  clock_in: string;
  job_name: string | null;
}

// ─── Signature Pad ───────────────────────────────────────────────────────────

function SignaturePad({
  onSigned,
  onCleared,
  clearLabel,
}: {
  onSigned: (dataUrl: string) => void;
  onCleared: () => void;
  clearLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasMark = useRef(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasMark.current = true;
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    if (hasMark.current && canvasRef.current) {
      onSigned(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasMark.current = false;
    onCleared();
  }, [onCleared]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          data-testid="canvas-signature"
          width={800}
          height={180}
          className="w-full h-44 cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="button-clear-signature"
          onClick={clear}
          className="gap-1.5"
        >
          <Eraser className="h-3.5 w-3.5" />
          {clearLabel}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClockOutReviewPage() {
  const { t } = useTranslation("clockOutReview");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [checkedMaterials, setCheckedMaterials] = useState(false);
  const [checkedExpenses, setCheckedExpenses] = useState(false);
  const [checkedNotes, setCheckedNotes] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const allChecked = checkedMaterials && checkedExpenses && checkedNotes;
  const canSubmit = allChecked && signatureDataUrl !== null;

  const { data: worksheet, isLoading: wsLoading, error: wsError } = useQuery<Worksheet>({
    queryKey: ["/api/worksheets/today"],
    queryFn: () => apiRequest("GET", "/api/worksheets/today").then((r) => r.json()),
  });

  const { data: activeEntry } = useQuery<ActiveEntry | null>({
    queryKey: ["/api/time/active"],
    queryFn: () => apiRequest("GET", "/api/time/active").then((r) => r.json()),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!worksheet) throw new Error("Worksheet not loaded");

      await apiRequest("PATCH", `/api/worksheets/${worksheet.id}`, {
        status: "submitted",
        signature_url: signatureDataUrl,
      });

      if (activeEntry?.id) {
        await apiRequest("POST", "/api/time/clock-out", {
          time_entry_id: activeEntry.id,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: t("clockedOut"),
        description: t("clockedOutDesc"),
      });
      navigate("/");
    },
    onError: (err: any) => {
      toast({
        title: t("submitFailed"),
        description: err.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <button
        data-testid="link-back-worksheet"
        onClick={() => navigate("/daily-worksheet")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToWorksheet")}
      </button>

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Day Summary Card */}
      {wsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : wsError ? (
        <Card className="border-destructive">
          <CardContent className="py-6 text-center text-sm text-destructive">
            {t("failedLoad")}
          </CardContent>
        </Card>
      ) : worksheet ? (
        <Card data-testid="card-day-summary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t("daySummary")}
              </CardTitle>
              <Badge
                variant={worksheet.status === "submitted" ? "default" : "secondary"}
                data-testid="badge-worksheet-status"
              >
                {worksheet.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(worksheet.date).toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Materials */}
            <div data-testid="section-materials">
              <div className="flex items-center gap-2 mb-2">
                <PackageOpen className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">{t("materialsUsed")}</span>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {worksheet.materials.length}
                </Badge>
              </div>
              {worksheet.materials.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6">{t("noMaterials")}</p>
              ) : (
                <ul className="pl-6 space-y-1">
                  {worksheet.materials.map((m) => (
                    <li
                      key={m.id}
                      data-testid={`item-material-${m.id}`}
                      className="text-sm text-foreground"
                    >
                      <span className="font-medium">{m.material_name ?? "\u2014"}</span>
                      {m.quantity && (
                        <span className="text-muted-foreground ml-1.5">
                          &times; {m.quantity} {m.unit ?? ""}
                        </span>
                      )}
                      {m.unit_cost && (
                        <span className="text-muted-foreground ml-1.5">
                          @ ${parseFloat(m.unit_cost).toFixed(2)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <hr />

            {/* Expenses */}
            <div data-testid="section-expenses">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">{t("expenses")}</span>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {worksheet.expenses.length}
                </Badge>
              </div>
              {worksheet.expenses.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6">{t("noExpenses")}</p>
              ) : (
                <ul className="pl-6 space-y-1">
                  {worksheet.expenses.map((e) => (
                    <li
                      key={e.id}
                      data-testid={`item-expense-${e.id}`}
                      className="text-sm text-foreground"
                    >
                      <span className="font-medium">{e.description ?? "\u2014"}</span>
                      {e.amount && (
                        <span className="text-muted-foreground ml-1.5">
                          ${parseFloat(e.amount).toFixed(2)}
                        </span>
                      )}
                      {e.category && (
                        <span className="text-muted-foreground ml-1.5">({e.category})</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <hr />

            {/* Team */}
            <div data-testid="section-team">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{t("team")}</span>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {worksheet.teamMembers.length}
                </Badge>
              </div>
              {worksheet.teamMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6">{t("noTeam")}</p>
              ) : (
                <ul className="pl-6 space-y-1">
                  {worksheet.teamMembers.map((tm) => (
                    <li
                      key={tm.id}
                      data-testid={`item-team-${tm.id}`}
                      className="text-sm"
                    >
                      {tm.user_name ?? tm.username}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <hr />

            {/* Notes */}
            <div data-testid="section-notes">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-700">{t("notes")}</span>
              </div>
              {worksheet.notes ? (
                <p className="pl-6 text-sm text-foreground whitespace-pre-wrap">{worksheet.notes}</p>
              ) : (
                <p className="pl-6 text-xs text-muted-foreground">{t("noNotes")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Accuracy Checkboxes */}
      <Card data-testid="card-accuracy-checks">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t("confirmAccuracy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="check-materials"
              data-testid="checkbox-materials"
              checked={checkedMaterials}
              onCheckedChange={(v) => setCheckedMaterials(Boolean(v))}
            />
            <Label htmlFor="check-materials" className="text-sm leading-snug cursor-pointer">
              {t("checkMaterials")}
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="check-expenses"
              data-testid="checkbox-expenses"
              checked={checkedExpenses}
              onCheckedChange={(v) => setCheckedExpenses(Boolean(v))}
            />
            <Label htmlFor="check-expenses" className="text-sm leading-snug cursor-pointer">
              {t("checkExpenses")}
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="check-notes"
              data-testid="checkbox-notes"
              checked={checkedNotes}
              onCheckedChange={(v) => setCheckedNotes(Boolean(v))}
            />
            <Label htmlFor="check-notes" className="text-sm leading-snug cursor-pointer">
              {t("checkNotes")}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Signature Pad */}
      <Card data-testid="card-signature">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            {t("signatureTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("signatureSubtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <SignaturePad
            onSigned={(url) => setSignatureDataUrl(url)}
            onCleared={() => setSignatureDataUrl(null)}
            clearLabel={t("clear")}
          />
        </CardContent>
      </Card>

      {/* Validation hint */}
      {!canSubmit && (
        <p className="text-xs text-muted-foreground text-center" data-testid="text-validation-hint">
          {!allChecked && !signatureDataUrl
            ? t("hintAllBoxes")
            : !allChecked
            ? t("hintBoxesOnly")
            : t("hintSignOnly")}
        </p>
      )}

      {/* Submit button */}
      <Button
        data-testid="button-submit-clock-out"
        size="lg"
        className="w-full"
        disabled={!canSubmit || submitMutation.isPending}
        onClick={handleSubmit}
      >
        {submitMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t("submitting")}&hellip;
          </>
        ) : (
          t("submitClockOut")
        )}
      </Button>
    </div>
  );
}
