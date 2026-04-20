import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, PackageOpen, Receipt, StickyNote, Users,
  CheckCircle2, PenLine, ThumbsUp, RotateCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  user_name: string | null;
  username: string;
}

interface Worksheet {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  signature_url: string | null;
  user_id: string;
  materials: Material[];
  expenses: Expense[];
  teamMembers: TeamMember[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function fmt(val: string | number | null | undefined) {
  if (val === null || val === undefined) return "\u2014";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "\u2014";
  return `$${n.toFixed(2)}`;
}

const STATUS_VARIANT: Record<string, any> = {
  draft: "secondary",
  submitted: "default",
  approved: "outline",
};

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, color, count, children,
}: {
  icon: any; title: string; color: string; count?: number; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="py-3 px-4" style={{ background: `${color}12`, borderBottom: `2px solid ${color}25` }}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md" style={{ background: color }}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm font-semibold" style={{ color }}>
            {title}
          </CardTitle>
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">{count}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WorksheetReviewDetail() {
  const { t } = useTranslation("worksheetDetail");
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: ws, isLoading, error } = useQuery<Worksheet>({
    queryKey: [`/api/worksheets/${id}`],
    queryFn: () => apiRequest("GET", `/api/worksheets/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const patchMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/worksheets/${id}`, { status }).then((r) => r.json()),
    onSuccess: (_data, status) => {
      qc.invalidateQueries({ queryKey: ["/api/worksheets"] });
      qc.invalidateQueries({ queryKey: [`/api/worksheets/${id}`] });
      toast({
        title: status === "approved" ? t("approved") : t("sentBack"),
        description: status === "approved" ? t("approvedDesc") : t("sentBackDesc"),
      });
      navigate("/worksheet-review");
    },
    onError: (err: any) => {
      toast({
        title: t("actionFailed"),
        description: err.message ?? "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ws) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center text-sm text-destructive">
        {t("failedToLoad")}
      </div>
    );
  }

  const materialsTotalRaw = ws.materials.reduce((sum, m) => {
    const qty = parseFloat(m.quantity ?? "0") || 0;
    const cost = parseFloat(m.unit_cost ?? "0") || 0;
    return sum + qty * cost;
  }, 0);

  const expensesTotalRaw = ws.expenses.reduce((sum, e) => {
    return sum + (parseFloat(e.amount ?? "0") || 0);
  }, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <button
        data-testid="link-back-review-list"
        onClick={() => navigate("/worksheet-review")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToReview")}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{fmtDate(ws.date)}</p>
        </div>
        <Badge
          variant={STATUS_VARIANT[ws.status] ?? "secondary"}
          className="capitalize text-sm px-3 py-1"
          data-testid="badge-status"
        >
          {ws.status}
        </Badge>
      </div>

      {/* Cost summary strip */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xl font-bold">{fmt(materialsTotalRaw)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("materialsTotal")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xl font-bold">{fmt(expensesTotalRaw)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("expensesTotal")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Materials */}
      <Section icon={PackageOpen} title={t("materialsUsed")} color="#10b981" count={ws.materials.length}>
        {ws.materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMaterials")}</p>
        ) : (
          <ul className="space-y-2">
            {ws.materials.map((m) => (
              <li
                key={m.id}
                data-testid={`item-material-${m.id}`}
                className="flex items-start justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{m.material_name ?? "\u2014"}</span>
                  {m.quantity && (
                    <span className="text-muted-foreground ml-2">
                      &times; {m.quantity} {m.unit ?? ""}
                    </span>
                  )}
                  {m.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>
                  )}
                </div>
                {m.unit_cost && (
                  <span className="text-muted-foreground ml-4 whitespace-nowrap">
                    {fmt(m.unit_cost)} / {t("perUnit")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Expenses */}
      <Section icon={Receipt} title={t("expenses")} color="#f97316" count={ws.expenses.length}>
        {ws.expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExpenses")}</p>
        ) : (
          <ul className="space-y-2">
            {ws.expenses.map((e) => (
              <li
                key={e.id}
                data-testid={`item-expense-${e.id}`}
                className="flex items-start justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{e.description ?? "\u2014"}</span>
                  {e.category && (
                    <span className="text-muted-foreground ml-2">({e.category})</span>
                  )}
                </div>
                <span className="text-muted-foreground ml-4 whitespace-nowrap">
                  {fmt(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Team */}
      <Section icon={Users} title={t("teamMembers")} color="#3b82f6" count={ws.teamMembers.length}>
        {ws.teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTeam")}</p>
        ) : (
          <ul className="space-y-1">
            {ws.teamMembers.map((tm) => (
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
      </Section>

      {/* Notes */}
      <Section icon={StickyNote} title={t("notes")} color="#eab308">
        {ws.notes ? (
          <p className="text-sm whitespace-pre-wrap">{ws.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
        )}
      </Section>

      {/* Signature */}
      <Section icon={PenLine} title={t("signature")} color="#8b5cf6">
        {ws.signature_url ? (
          <div className="border rounded-lg overflow-hidden bg-white">
            <img
              src={ws.signature_url}
              alt="Employee signature"
              data-testid="img-signature"
              className="w-full max-h-36 object-contain"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noSignature")}</p>
        )}
      </Section>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          data-testid="button-approve"
          className="flex-1 gap-2"
          disabled={patchMutation.isPending || ws.status === "approved"}
          onClick={() => patchMutation.mutate("approved")}
        >
          {patchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsUp className="h-4 w-4" />
          )}
          {t("approve")}
        </Button>
        <Button
          data-testid="button-send-back"
          variant="outline"
          className="flex-1 gap-2"
          disabled={patchMutation.isPending || ws.status === "draft"}
          onClick={() => patchMutation.mutate("draft")}
        >
          {patchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {t("sendBack")}
        </Button>
      </div>
    </div>
  );
}
