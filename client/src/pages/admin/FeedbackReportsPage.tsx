import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquareWarning, Bug, Lightbulb } from "lucide-react";
import { Redirect } from "wouter";

interface FeedbackReport {
  id: string;
  user_id: string;
  user_name: string;
  type: "Bug" | "Feedback";
  description: string;
  page_context: string | null;
  status: "new" | "in progress" | "resolved";
  created_at: string;
}

const STATUS_OPTIONS: FeedbackReport["status"][] = ["new", "in progress", "resolved"];

function statusBadgeVariant(status: FeedbackReport["status"]) {
  if (status === "new") return "default";
  if (status === "in progress") return "secondary";
  return "outline";
}

function ReportRow({ report, onSaved }: { report: FeedbackReport; onSaved: () => void }) {
  const { toast } = useToast();

  const statusMut = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/feedback-reports/${report.id}`, { status }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid={`row-report-${report.id}`}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={report.type === "Bug" ? "destructive" : "secondary"} className="gap-1" data-testid={`badge-type-${report.id}`}>
              {report.type === "Bug" ? <Bug className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
              {report.type}
            </Badge>
            <Badge variant={statusBadgeVariant(report.status)} data-testid={`badge-status-${report.id}`}>
              {report.status}
            </Badge>
            {report.page_context && (
              <span className="text-[11px] text-muted-foreground" data-testid={`text-page-${report.id}`}>
                on {report.page_context}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap" data-testid={`text-description-${report.id}`}>
            {report.description}
          </p>
          <p className="text-xs text-muted-foreground" data-testid={`text-meta-${report.id}`}>
            {report.user_name} &middot; {new Date(report.created_at).toLocaleString()}
          </p>
        </div>
        <Select
          value={report.status}
          onValueChange={(v) => statusMut.mutate(v)}
          disabled={statusMut.isPending}
        >
          <SelectTrigger className="w-[140px] shrink-0" data-testid={`select-status-${report.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export default function FeedbackReportsPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();

  if (!["Admin", "Master Admin"].includes(effectiveRole ?? "")) {
    return <Redirect to="/" />;
  }

  const { data: reports = [], isLoading } = useQuery<FeedbackReport[]>({
    queryKey: ["/api/feedback-reports"],
    queryFn: () => fetch("/api/feedback-reports", { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/feedback-reports"] });

  const newCount = reports.filter(r => r.status === "new").length;

  return (
    <div className="flex flex-col h-full" data-testid="feedback-reports-page">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-primary" /> Bug Reports &amp; Feedback
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reports submitted by staff from anywhere in the app during alpha testing.
          </p>
        </div>
        {newCount > 0 && (
          <Badge data-testid="badge-new-count">{newCount} new</Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4" data-testid="text-empty">
            No bug reports or feedback submitted yet.
          </p>
        ) : (
          reports.map(report => (
            <ReportRow key={report.id} report={report} onSaved={invalidate} />
          ))
        )}
      </div>
    </div>
  );
}
