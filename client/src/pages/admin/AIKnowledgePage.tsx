import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Brain, CheckCircle2, Circle } from "lucide-react";
import { Redirect } from "wouter";

interface CompanyPolicy {
  id: number;
  slug: string;
  question: string;
  category: string;
  answer_type: "yes_no" | "multiple_choice" | "short_text";
  options: string[] | null;
  answer: string | null;
  is_active: boolean;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
}

const CATEGORY_META: Record<string, { blurb: string }> = {
  "Customer Communication": { blurb: "How the AI speaks and behaves with your customers." },
  "Estimates & Deposits": { blurb: "Pricing policies applied when generating or reviewing estimates." },
  "Scheduling & Cancellation": { blurb: "Policies around booking, rescheduling, and cancellations." },
  "Safety & Quality": { blurb: "Standards the AI reinforces for crew quality and safety." },
  "Service Area & Pricing": { blurb: "Geographic and surcharge rules for pricing guidance." },
};

function AnswerModal({
  policy,
  open,
  onClose,
  onSaved,
}: {
  policy: CompanyPolicy;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("aiKnowledge");
  const { toast } = useToast();
  const [draft, setDraft] = useState(policy.answer ?? "");

  const saveMut = useMutation({
    mutationFn: (answer: string) =>
      apiRequest("PATCH", `/api/company-policies/${policy.slug}`, { answer }),
    onSuccess: () => {
      toast({ title: t("saved") });
      onSaved();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: t("saveFailed"), description: e.message, variant: "destructive" }),
  });

  const options =
    policy.answer_type === "multiple_choice"
      ? (policy.options ?? [])
      : policy.answer_type === "yes_no"
        ? [t("yes"), t("no")]
        : [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="modal-answer-policy">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-fuchsia-500" />
            {t("modalTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {policy.question}
          </p>

          {policy.answer_type === "short_text" ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("shortTextPlaceholder")}
              className="min-h-[80px] text-sm"
              data-testid="textarea-policy-answer"
            />
          ) : (
            <div className="space-y-2" data-testid="radio-group-policy">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDraft(opt)}
                  data-testid={`radio-option-${opt.replace(/\s+/g, "-").toLowerCase()}`}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-colors hover:bg-muted/60"
                  style={{
                    borderColor: draft === opt ? "hsl(var(--primary))" : undefined,
                    backgroundColor: draft === opt ? "hsl(var(--primary) / 0.06)" : undefined,
                  }}
                >
                  {draft === opt ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span>{opt}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="btn-cancel-policy">
            {t("cancel")}
          </Button>
          <Button
            onClick={() => saveMut.mutate(draft)}
            disabled={!draft.trim() || saveMut.isPending}
            data-testid="btn-save-policy"
          >
            {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {t("saveAnswer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyRow({
  policy,
  onAnswer,
}: {
  policy: CompanyPolicy;
  onAnswer: (p: CompanyPolicy) => void;
}) {
  const { t } = useTranslation("aiKnowledge");
  const answered = !!policy.answer;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b last:border-b-0"
      data-testid={`row-policy-${policy.slug}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{policy.question}</span>
          {!answered && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50" data-testid={`badge-unanswered-${policy.slug}`}>
              {t("unanswered")}
            </Badge>
          )}
        </div>
        {answered && (
          <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-answer-${policy.slug}`}>
            <span className="font-medium text-foreground/80">{t("currentAnswer")}:</span> {policy.answer}
          </p>
        )}
        {answered && policy.updated_at && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            {t("lastUpdated")} {new Date(policy.updated_at).toLocaleDateString()}
            {policy.updated_by ? ` ${t("by")} ${policy.updated_by}` : ""}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <Button
          size="sm"
          variant={answered ? "outline" : "default"}
          onClick={() => onAnswer(policy)}
          data-testid={`btn-answer-${policy.slug}`}
        >
          {answered ? t("editAnswer") : t("answerButton")}
        </Button>
      </div>
    </div>
  );
}

export default function AIKnowledgePage() {
  const { t } = useTranslation("aiKnowledge");
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const [activePolicy, setActivePolicy] = useState<CompanyPolicy | null>(null);

  if (!["Admin", "Master Admin"].includes(effectiveRole ?? "")) {
    return <Redirect to="/" />;
  }

  const { data: policies = [], isLoading } = useQuery<CompanyPolicy[]>({
    queryKey: ["/api/company-policies"],
    queryFn: () =>
      fetch("/api/company-policies", { credentials: "include" }).then((r) => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/company-policies"] });

  const grouped: Record<string, CompanyPolicy[]> = {};
  for (const p of policies) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  const categoryOrder = Object.keys(CATEGORY_META);

  const total = policies.length;
  const answered = policies.filter((p) => p.answer).length;

  return (
    <div className="flex flex-col h-full" data-testid="ai-knowledge-page">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-fuchsia-500" />
            {t("pageTitle")}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("pageSubtitle")}</p>
        </div>
        {total > 0 && (
          <Badge
            variant="outline"
            className="text-xs gap-1.5"
            data-testid="badge-progress"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {answered}/{total} {t("answered")}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          categoryOrder
            .filter((cat) => grouped[cat]?.length)
            .map((cat) => {
              const meta = CATEGORY_META[cat];
              return (
                <Card key={cat} data-testid={`card-category-${cat.replace(/\s+/g, "-").toLowerCase()}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-fuchsia-500" />
                      <span className="text-sm font-semibold">{cat}</span>
                    </div>
                    {meta?.blurb && (
                      <p className="text-xs text-muted-foreground">{meta.blurb}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {grouped[cat].map((policy) => (
                      <PolicyRow
                        key={policy.slug}
                        policy={policy}
                        onAnswer={setActivePolicy}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>

      {activePolicy && (
        <AnswerModal
          policy={activePolicy}
          open={true}
          onClose={() => setActivePolicy(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}
