import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, SlidersHorizontal, DollarSign, CalendarClock, GitMerge } from "lucide-react";
import { Redirect } from "wouter";

interface BusinessRule {
  id: string;
  key: string;
  label: string;
  description: string;
  category: "Financial" | "Scheduling" | "Workflow";
  value: string;
  value_type: "percentage" | "days" | "minutes" | "currency" | "select";
  options: string | null;
  updated_at: string;
  updated_by: string | null;
}

const CATEGORY_META: Record<string, { icon: any; blurb: string }> = {
  Financial: { icon: DollarSign, blurb: "Late fees, payment terms, and deposit requirements." },
  Scheduling: { icon: CalendarClock, blurb: "Lead time and double-booking safeguards for the dispatch calendar." },
  Workflow: { icon: GitMerge, blurb: "Approval thresholds for sales documents." },
};

function suffixFor(valueType: BusinessRule["value_type"]) {
  switch (valueType) {
    case "percentage": return "%";
    case "days": return "days";
    case "minutes": return "min";
    case "currency": return "$";
    default: return "";
  }
}

function RuleRow({ rule, onSaved }: { rule: BusinessRule; onSaved: () => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(rule.value);

  useEffect(() => { setDraft(rule.value); }, [rule.value]);

  const saveMut = useMutation({
    mutationFn: (value: string) => apiRequest("PATCH", `/api/business-rules/${rule.key}`, { value }),
    onSuccess: () => { toast({ title: `${rule.label} updated` }); onSaved(); },
    onError: (e: any) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const dirty = draft !== rule.value;
  const options = (rule.options ?? "").split(",").map(o => o.trim()).filter(Boolean);

  function handleSave() {
    if (rule.value_type !== "select") {
      const num = Number(draft);
      if (!Number.isFinite(num) || num < 0) {
        toast({ title: "Invalid value", description: "Please enter a positive number.", variant: "destructive" });
        return;
      }
      if (rule.value_type === "percentage" && num > 100) {
        toast({ title: "Invalid value", description: "Percentage cannot exceed 100.", variant: "destructive" });
        return;
      }
    }
    saveMut.mutate(draft);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b last:border-b-0" data-testid={`row-rule-${rule.key}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground" data-testid={`text-label-${rule.key}`}>{rule.label}</div>
        <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-description-${rule.key}`}>{rule.description}</p>
        {rule.updated_at && (
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Last updated {new Date(rule.updated_at).toLocaleDateString()}
            {rule.updated_by ? ` by ${rule.updated_by}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rule.value_type === "select" ? (
          <Select value={draft} onValueChange={setDraft}>
            <SelectTrigger className="w-[140px]" data-testid={`select-value-${rule.key}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="relative w-[140px]">
            <Input
              type="number"
              min="0"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              data-testid={`input-value-${rule.key}`}
              className={rule.value_type === "currency" ? "pl-6" : ""}
            />
            {rule.value_type === "currency" && (
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            )}
            {rule.value_type !== "currency" && suffixFor(rule.value_type) && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {suffixFor(rule.value_type)}
              </span>
            )}
          </div>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saveMut.isPending}
          data-testid={`btn-save-${rule.key}`}
        >
          {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

export default function BusinessRulesPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();

  if (!["Admin", "Master Admin"].includes(effectiveRole ?? "")) {
    return <Redirect to="/" />;
  }

  const { data: rules = [], isLoading } = useQuery<BusinessRule[]>({
    queryKey: ["/api/business-rules"],
    queryFn: () => fetch("/api/business-rules", { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/business-rules"] });

  const grouped: Record<string, BusinessRule[]> = {};
  for (const r of rules) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }
  const categoryOrder = ["Financial", "Scheduling", "Workflow"];

  return (
    <div className="flex flex-col h-full" data-testid="business-rules-page">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" /> Business Rules
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Central configuration for financial, scheduling, and workflow rules used across the app
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          categoryOrder
            .filter(cat => grouped[cat]?.length)
            .map(cat => {
              const meta = CATEGORY_META[cat];
              const Icon = meta?.icon ?? SlidersHorizontal;
              return (
                <Card key={cat} data-testid={`card-category-${cat.toLowerCase()}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{cat}</span>
                    </div>
                    {meta?.blurb && <p className="text-xs text-muted-foreground">{meta.blurb}</p>}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {grouped[cat].map(rule => (
                      <RuleRow key={rule.key} rule={rule} onSaved={invalidate} />
                    ))}
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
}
