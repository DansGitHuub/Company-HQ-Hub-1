import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Clock, Circle, AlertCircle, FileText, ChevronRight } from "lucide-react";
import W4Form from "@/components/forms/W4Form";
import I9Form from "@/components/forms/I9Form";
import OhioIT4Form from "@/components/forms/OhioIT4Form";
import DirectDepositForm from "@/components/forms/DirectDepositForm";
import EmergencyContactForm from "@/components/forms/EmergencyContactForm";
import NDAForm from "@/components/forms/NDAForm";
import HandbookAcknowledgmentForm from "@/components/forms/HandbookAcknowledgmentForm";

type OnboardingStatus = "Pending" | "In Progress" | "Complete";

const STATUS_CYCLE: Record<OnboardingStatus, OnboardingStatus> = {
  Pending: "In Progress",
  "In Progress": "Complete",
  Complete: "Pending",
};

const STATUS_CONFIG: Record<OnboardingStatus, { label: string; icon: React.FC<any>; badgeClass: string; iconClass: string }> = {
  Pending: {
    label: "Not Started",
    icon: Circle,
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    iconClass: "text-slate-400",
  },
  "In Progress": {
    label: "In Progress",
    icon: Clock,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    iconClass: "text-amber-500",
  },
  Complete: {
    label: "Completed",
    icon: CheckCircle2,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    iconClass: "text-green-600",
  },
};

function getFormComponent(title: string): React.FC<any> | null {
  const t = title.toLowerCase();
  if (t.includes("direct deposit")) return DirectDepositForm;
  if (t.includes("emergency contact")) return EmergencyContactForm;
  if (t.includes("i-9") || t.includes("i9") || t.includes("employment eligibility")) return I9Form;
  if (t.includes("w-4") || t.includes("w4")) return W4Form;
  if (t.includes("it-4") || t.includes("it4") || t.includes("ohio")) return OhioIT4Form;
  if (t.includes("nda") || t.includes("non-disclosure")) return NDAForm;
  if (t.includes("handbook")) return HandbookAcknowledgmentForm;
  return null;
}

interface OnboardingChecklistProps {
  employeeId: string;
  showCard?: boolean;
}

export default function OnboardingChecklist({ employeeId, showCard = true }: OnboardingChecklistProps) {
  const queryClient = useQueryClient();
  const [openFormItem, setOpenFormItem] = useState<{ id: string; title: string } | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [`/api/employees/${employeeId}/onboarding`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/onboarding`)).json(),
    enabled: !!employeeId,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/onboarding-items/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/onboarding`] });
    },
  });

  const completed = items.filter((i: any) => i.status === "Complete").length;
  const inProgress = items.filter((i: any) => i.status === "In Progress").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const outstanding = items.filter((i: any) => i.status !== "Complete").length;

  const categories = Array.from(new Set(items.map((i: any) => i.category as string))) as string[];

  const FormComponent = openFormItem ? getFormComponent(openFormItem.title) : null;

  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{pct}%</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          {completed} completed
        </Badge>
        {inProgress > 0 && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="h-3 w-3 text-amber-500" />
            {inProgress} in progress
          </Badge>
        )}
        {outstanding > 0 && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Circle className="h-3 w-3 text-slate-400" />
            {outstanding} outstanding
          </Badge>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-4">Loading checklist…</p>
      )}

      {!isLoading && total === 0 && (
        <div className="text-center py-6">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No onboarding items assigned yet.</p>
        </div>
      )}

      {categories.map((category) => {
        const catItems = items.filter((i: any) => i.category === category);
        if (catItems.length === 0) return null;
        return (
          <div key={category}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4">
              {category}
            </h4>
            <div className="space-y-1.5">
              {catItems.map((item: any) => {
                const status = (item.status || "Pending") as OnboardingStatus;
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
                const StatusIcon = cfg.icon;
                const hasForm = !!getFormComponent(item.title);
                const isComplete = status === "Complete";

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      isComplete
                        ? "bg-green-50/50 border-green-100 opacity-70"
                        : status === "In Progress"
                        ? "bg-amber-50/50 border-amber-100"
                        : "bg-background border-border hover:bg-muted/30"
                    }`}
                    data-testid={`onboarding-item-${item.id}`}
                  >
                    <button
                      type="button"
                      className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                      title={`Mark as ${STATUS_CYCLE[status]}`}
                      onClick={() =>
                        updateMutation.mutate({ id: item.id, status: STATUS_CYCLE[status] })
                      }
                      data-testid={`toggle-status-${item.id}`}
                    >
                      <StatusIcon className={`h-4 w-4 ${cfg.iconClass}`} />
                    </button>

                    <span
                      className={`flex-1 text-sm ${isComplete ? "line-through text-muted-foreground" : ""}`}
                    >
                      {item.title}
                    </span>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badgeClass}`}
                      >
                        {cfg.label}
                      </span>

                      {hasForm && !isComplete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary"
                          onClick={() => setOpenFormItem({ id: item.id, title: item.title })}
                          data-testid={`open-form-${item.id}`}
                        >
                          <FileText className="h-3 w-3" />
                          Fill Out
                        </Button>
                      )}

                      {hasForm && isComplete && item.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {outstanding === 0 && total > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          All onboarding items are complete!
        </div>
      )}

      {openFormItem && FormComponent && (
        <Dialog open={!!openFormItem} onOpenChange={() => setOpenFormItem(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {openFormItem.title}
              </DialogTitle>
            </DialogHeader>
            <FormComponent
              employeeId={employeeId}
              onComplete={() => {
                updateMutation.mutate({ id: openFormItem.id, status: "Complete" });
                setOpenFormItem(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  if (!showCard) return content;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Onboarding Checklist</CardTitle>
        <Badge variant={pct === 100 ? "default" : "outline"}>
          {completed}/{total}
        </Badge>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
