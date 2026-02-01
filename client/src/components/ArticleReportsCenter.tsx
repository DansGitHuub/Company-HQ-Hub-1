import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Clock, XCircle, FileText, RefreshCw } from "lucide-react";
import type { HelpArticleReport, HelpArticle } from "@shared/schema";

interface ReportWithArticle extends HelpArticleReport {
  article?: HelpArticle;
}

export default function ArticleReportsCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<ReportWithArticle | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [notifyUsers, setNotifyUsers] = useState(true);

  const { data: reports = [], isLoading } = useQuery<ReportWithArticle[]>({
    queryKey: ["/api/help/reports", filterStatus],
    queryFn: async () => {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/help/reports${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      const articles = await fetch("/api/help/articles", { credentials: "include" }).then(r => r.json());
      return data.map((report: HelpArticleReport) => ({
        ...report,
        article: articles.find((a: HelpArticle) => a.id === report.articleId)
      }));
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status, resolutionNote, notifyUsers }: { id: string; status: string; resolutionNote: string; notifyUsers: boolean }) => {
      const res = await fetch(`/api/help/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, resolutionNote, notifyUsers })
      });
      if (!res.ok) throw new Error("Failed to update report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help/reports"] });
      toast({ title: "Report updated", description: "The report status has been updated." });
      setSelectedReport(null);
      setResolutionNote("");
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "in_progress": return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "resolved": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "dismissed": return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "destructive",
      in_progress: "default",
      resolved: "secondary",
      dismissed: "outline"
    };
    return <Badge variant={variants[status] || "default"}>{status.replace("_", " ")}</Badge>;
  };

  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <Card data-testid="article-reports-center">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Article Reports
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>
          )}
        </CardTitle>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]" data-testid="filter-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reports</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No reports found</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                data-testid={`report-${report.id}`}
              >
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(report.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{report.article?.title || "Unknown Article"}</span>
                      {getStatusBadge(report.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {report.description || "No description provided"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported: {new Date(report.createdAt!).toLocaleDateString()}
                      {report.reportType && ` • Type: ${report.reportType}`}
                    </p>
                  </div>
                </div>
                {report.status === "pending" && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReport(report)}
                        data-testid={`resolve-btn-${report.id}`}
                      >
                        Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Review Report</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Article</p>
                          <p className="text-muted-foreground">{report.article?.title}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Issue Reported</p>
                          <p className="text-muted-foreground">{report.description || "No details provided"}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">Resolution Note</label>
                          <Textarea
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="Describe what was fixed or why it was dismissed..."
                            data-testid="resolution-note"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="notify-users"
                            checked={notifyUsers}
                            onCheckedChange={(checked) => setNotifyUsers(checked as boolean)}
                            data-testid="notify-users-checkbox"
                          />
                          <label htmlFor="notify-users" className="text-sm">
                            Notify users when article is updated
                          </label>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => resolveMutation.mutate({ id: report.id, status: "resolved", resolutionNote, notifyUsers })}
                            className="flex-1"
                            data-testid="mark-resolved-btn"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark Resolved
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => resolveMutation.mutate({ id: report.id, status: "dismissed", resolutionNote, notifyUsers: false })}
                            className="flex-1"
                            data-testid="dismiss-btn"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {report.status === "resolved" && report.resolutionNote && (
                  <div className="text-xs text-muted-foreground max-w-[200px]">
                    <span className="font-medium">Resolution:</span> {report.resolutionNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
