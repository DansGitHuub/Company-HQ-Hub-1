import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, PackageOpen, Receipt, StickyNote, Users,
  CheckCircle2, PenLine, ThumbsUp, RotateCcw, ClipboardCheck, AlertTriangle,
  XCircle,
} from "lucide-react";

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
  checklist_work_order_changed: boolean | null;
  checklist_work_order_note: string | null;
  checklist_materials_needed: boolean | null;
  checklist_materials_note: string | null;
  checklist_change_order_needed: boolean | null;
  checklist_change_order_note: string | null;
  checklist_issue_reported: boolean | null;
  checklist_issue_note: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function fmt(val: string | number | null | undefined) {
  if (val === null || val === undefined) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
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
        title: status === "approved" ? "Worksheet approved" : "Sent back for revision",
        description:
          status === "approved"
            ? "The worksheet has been marked as approved."
            : "The worksheet has been returned to draft status.",
      });
      navigate("/worksheet-review");
    },
    onError: (err: any) => {
      toast({
        title: "Action failed",
        description: err.message ?? "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────────

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
        Failed to load worksheet. Please go back and try again.
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
        Back to Worksheet Review
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Worksheet Detail</h1>
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
            <p className="text-xs text-muted-foreground mt-0.5">Materials Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xl font-bold">{fmt(expensesTotalRaw)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Expenses Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Materials */}
      <Section icon={PackageOpen} title="Materials Used" color="#10b981" count={ws.materials.length}>
        {ws.materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials recorded.</p>
        ) : (
          <ul className="space-y-2">
            {ws.materials.map((m) => (
              <li
                key={m.id}
                data-testid={`item-material-${m.id}`}
                className="flex items-start justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{m.material_name ?? "—"}</span>
                  {m.quantity && (
                    <span className="text-muted-foreground ml-2">
                      × {m.quantity} {m.unit ?? ""}
                    </span>
                  )}
                  {m.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>
                  )}
                </div>
                {m.unit_cost && (
                  <span className="text-muted-foreground ml-4 whitespace-nowrap">
                    {fmt(m.unit_cost)} / unit
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Expenses */}
      <Section icon={Receipt} title="Expenses" color="#f97316" count={ws.expenses.length}>
        {ws.expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses recorded.</p>
        ) : (
          <ul className="space-y-2">
            {ws.expenses.map((e) => (
              <li
                key={e.id}
                data-testid={`item-expense-${e.id}`}
                className="flex items-start justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{e.description ?? "—"}</span>
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
      <Section icon={Users} title="Team Members" color="#3b82f6" count={ws.teamMembers.length}>
        {ws.teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members listed.</p>
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
      <Section icon={StickyNote} title="Notes" color="#eab308">
        {ws.notes ? (
          <p className="text-sm whitespace-pre-wrap">{ws.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes added.</p>
        )}
      </Section>

      {/* Field Checklist */}
      <Section icon={ClipboardCheck} title="End-of-Day Field Checklist" color="#6366f1">
        <ul className="space-y-3" data-testid="section-field-checklist">
          {[
            {
              label: "Did anything change from the work order?",
              answered: ws.checklist_work_order_changed,
              note: ws.checklist_work_order_note,
              yesColor: "text-amber-700 bg-amber-50 border-amber-200",
              testId: "checklist-work-order",
            },
            {
              label: "Are more materials needed?",
              answered: ws.checklist_materials_needed,
              note: ws.checklist_materials_note,
              yesColor: "text-blue-700 bg-blue-50 border-blue-200",
              testId: "checklist-materials",
            },
            {
              label: "Might a change order be needed?",
              answered: ws.checklist_change_order_needed,
              note: ws.checklist_change_order_note,
              yesColor: "text-purple-700 bg-purple-50 border-purple-200",
              testId: "checklist-change-order",
            },
            {
              label: "Was there any damage, delay, or customer issue?",
              answered: ws.checklist_issue_reported,
              note: ws.checklist_issue_note,
              yesColor: "text-red-700 bg-red-50 border-red-200",
              testId: "checklist-issue",
            },
          ].map((q) => (
            <li key={q.testId} data-testid={q.testId} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {q.answered ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{q.label}</span>
                  <span
                    className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded border ${
                      q.answered === null || q.answered === undefined
                        ? "text-muted-foreground bg-muted border-border"
                        : q.answered
                        ? q.yesColor
                        : "text-green-700 bg-green-50 border-green-200"
                    }`}
                    data-testid={`${q.testId}-answer`}
                  >
                    {q.answered === null || q.answered === undefined ? "—" : q.answered ? "Yes" : "No"}
                  </span>
                  {q.answered && q.note && (
                    <p className="mt-1 text-xs text-muted-foreground italic whitespace-pre-wrap" data-testid={`${q.testId}-note`}>
                      {q.note}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Signature */}
      <Section icon={PenLine} title="Signature" color="#8b5cf6">
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
          <p className="text-sm text-muted-foreground">No signature captured.</p>
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
          Approve
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
          Send Back
        </Button>
      </div>
    </div>
  );
}
