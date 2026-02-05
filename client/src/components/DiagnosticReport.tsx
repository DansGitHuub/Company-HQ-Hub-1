import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Hammer,
  Info,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";
import DevelopmentTracker from "./DevelopmentTracker";

interface ErrorLog {
  id: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  endpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  feature?: string;
  severity?: string;
  userId?: string;
  userRole?: string;
  isResolved: boolean;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  action: string;
  feature: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userRole?: string;
  success: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface SimpleReport {
  generatedAt: string;
  mode: string;
  systemHealth: {
    status: string;
    unresolvedIssues: number;
    totalIssuesLogged: number;
  };
  quickStats: {
    totalUsers: number;
    activeUsers: number;
    totalSOPs: number;
    totalMaterials: number;
    activeJobs: number;
    pendingTodos: number;
  };
  recentIssues: Array<{
    id: string;
    when: string;
    what: string;
    summary: string;
    severity: string;
  }>;
  recentActivity: Array<{
    when: string;
    action: string;
    feature: string;
    description?: string;
  }>;
}

interface AdvancedReport {
  generatedAt: string;
  mode: string;
  systemHealth: {
    status: string;
    totalErrors: number;
    unresolvedErrors: number;
    errorsBySeverity: Record<string, number>;
    errorsByFeature: Record<string, number>;
  };
  systemUsage: {
    users: { total: number; active: number; byRole: Record<string, number> };
    sops: { total: number; active: number; archived: number };
    materials: { total: number };
    jobs: { total: number; byStatus: Record<string, number> };
    hiring: { totalCandidates: number };
    equipment: { total: number };
    forms: { total: number; published: number; draft: number };
    todos: { total: number; pending: number; inProgress: number; completed: number };
  };
  errorAnalysis: {
    byEndpoint: Array<{ endpoint: string; count: number }>;
    byTimeHour: Array<{ hour: string; count: number }>;
  };
  recentErrors: ErrorLog[];
  recentActivity: ActivityLog[];
  mostActiveUsers: Array<{
    userId: string;
    username: string;
    role?: string;
    actionCount: number;
  }>;
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical": return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "error": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "warning": return <Info className="h-4 w-4 text-yellow-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getSeverityBadge(severity: string) {
  const variants: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
    critical: "destructive",
    error: "destructive",
    warning: "secondary",
    info: "outline"
  };
  return <Badge variant={variants[severity] || "outline"}>{severity}</Badge>;
}

function getStatusBadge(status: string) {
  if (status === "excellent") {
    return <Badge className="bg-green-500 hover:bg-green-600">Excellent</Badge>;
  } else if (status === "good") {
    return <Badge className="bg-blue-500 hover:bg-blue-600">Good</Badge>;
  } else {
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">Needs Attention</Badge>;
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function SimpleReportView({ report }: { report: SimpleReport }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              System Health
            </CardTitle>
            {getStatusBadge(report.systemHealth.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold">{report.systemHealth.unresolvedIssues}</p>
              <p className="text-sm text-muted-foreground">Unresolved Issues</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold">{report.systemHealth.totalIssuesLogged}</p>
              <p className="text-sm text-muted-foreground">Total Issues Logged</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{report.quickStats.activeUsers}/{report.quickStats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Active Users</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <FileText className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{report.quickStats.totalSOPs}</p>
              <p className="text-xs text-muted-foreground">SOPs</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Zap className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{report.quickStats.totalMaterials}</p>
              <p className="text-xs text-muted-foreground">Materials</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Activity className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{report.quickStats.activeJobs}</p>
              <p className="text-xs text-muted-foreground">Active Jobs</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Clock className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{report.quickStats.pendingTodos}</p>
              <p className="text-xs text-muted-foreground">Pending To-Dos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {report.recentIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Recent Issues
            </CardTitle>
            <CardDescription>Latest unresolved problems that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.recentIssues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{issue.what}</p>
                    <p className="text-sm text-muted-foreground truncate">{issue.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(issue.when)}</p>
                  </div>
                  {getSeverityBadge(issue.severity)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {report.recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 text-sm">
                    <Badge variant="outline" className="shrink-0">{activity.action}</Badge>
                    <span className="text-muted-foreground">{activity.feature}</span>
                    {activity.description && <span className="truncate">{activity.description}</span>}
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatDate(activity.when)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdvancedReportView({ report }: { report: AdvancedReport }) {
  const [expandedError, setExpandedError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                System Health
              </CardTitle>
              {getStatusBadge(report.systemHealth.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total Errors</span>
                <span className="font-medium">{report.systemHealth.totalErrors}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Unresolved</span>
                <span className="font-medium text-orange-500">{report.systemHealth.unresolvedErrors}</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">By Severity</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(report.systemHealth.errorsBySeverity).map(([sev, count]) => (
                    <Badge key={sev} variant="outline">{sev}: {count}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              Errors by Feature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(report.systemHealth.errorsByFeature)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([feature, count]) => (
                <div key={feature} className="flex justify-between items-center text-sm">
                  <span className="capitalize">{feature.replace(/_/g, " ")}</span>
                  <Badge variant={count > 5 ? "destructive" : "secondary"}>{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            System Usage Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Users</p>
              <p className="text-lg font-bold">{report.systemUsage.users.active}/{report.systemUsage.users.total}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(report.systemUsage.users.byRole).map(([role, count]) => (
                  <Badge key={role} variant="outline" className="text-xs">{role}: {count}</Badge>
                ))}
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">SOPs</p>
              <p className="text-lg font-bold">{report.systemUsage.sops.active}</p>
              <p className="text-xs text-muted-foreground">{report.systemUsage.sops.archived} archived</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Jobs</p>
              <p className="text-lg font-bold">{report.systemUsage.jobs.total}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(report.systemUsage.jobs.byStatus).slice(0, 3).map(([status, count]) => (
                  <Badge key={status} variant="outline" className="text-xs">{status}: {count}</Badge>
                ))}
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">To-Dos</p>
              <p className="text-lg font-bold">{report.systemUsage.todos.total}</p>
              <p className="text-xs text-muted-foreground">
                {report.systemUsage.todos.pending} pending, {report.systemUsage.todos.completed} done
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="errors">
        <TabsList>
          <TabsTrigger value="errors">Recent Errors ({report.recentErrors.length})</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity ({report.recentActivity.length})</TabsTrigger>
          <TabsTrigger value="users">Most Active Users</TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {report.recentErrors.map((error) => (
                    <Collapsible key={error.id} open={expandedError === error.id}>
                      <CollapsibleTrigger asChild>
                        <div 
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                          onClick={() => setExpandedError(expandedError === error.id ? null : error.id)}
                        >
                          {getSeverityIcon(error.severity || "error")}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{error.errorMessage}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>{error.httpMethod} {error.endpoint}</span>
                              {error.statusCode && <span>({error.statusCode})</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(error.severity || "error")}
                            {error.isResolved ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            )}
                            {expandedError === error.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3 text-xs bg-muted/30 rounded-b-lg space-y-2 mt-1">
                          <div className="grid grid-cols-2 gap-2">
                            <div><span className="text-muted-foreground">Type:</span> {error.errorType}</div>
                            <div><span className="text-muted-foreground">Feature:</span> {error.feature || "N/A"}</div>
                            <div><span className="text-muted-foreground">User:</span> {error.userRole || "Unknown"}</div>
                            <div><span className="text-muted-foreground">Time:</span> {formatDate(error.createdAt)}</div>
                          </div>
                          {error.stackTrace && (
                            <div>
                              <p className="text-muted-foreground mb-1">Stack Trace:</p>
                              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                                {error.stackTrace}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Feature</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.recentActivity.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="text-xs">{formatDate(activity.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{activity.action}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{activity.feature.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{activity.description || "-"}</TableCell>
                        <TableCell>
                          {activity.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.mostActiveUsers.map((user, i) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role || "Unknown"}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{user.actionCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DiagnosticReport() {
  const [isAdvanced, setIsAdvanced] = useState(false);
  const { toast } = useToast();

  const { data: simpleReport, isLoading: isLoadingSimple, refetch: refetchSimple } = useQuery<SimpleReport>({
    queryKey: ["/api/admin/diagnostics/report/simple"],
    enabled: !isAdvanced,
  });

  const { data: advancedReport, isLoading: isLoadingAdvanced, refetch: refetchAdvanced } = useQuery<AdvancedReport>({
    queryKey: ["/api/admin/diagnostics/report/advanced"],
    enabled: isAdvanced,
  });

  const isLoading = isAdvanced ? isLoadingAdvanced : isLoadingSimple;
  const report = isAdvanced ? advancedReport : simpleReport;

  const handleRefresh = () => {
    if (isAdvanced) {
      refetchAdvanced();
    } else {
      refetchSimple();
    }
    toast({
      title: "Report Refreshed",
      description: "The diagnostic report has been updated with the latest data.",
    });
  };

  const handleDownload = () => {
    if (!report) return;
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-report-${isAdvanced ? "advanced" : "simple"}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report Downloaded",
      description: "The diagnostic report has been saved to your downloads.",
    });
  };

  const [activeTab, setActiveTab] = useState("system");

  return (
    <div className="space-y-6" data-testid="diagnostic-report">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="h-6 w-6" />
            Diagnostics & Development
          </h2>
          <p className="text-muted-foreground">
            Monitor system health, track errors, and manage incomplete features
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="system" data-testid="tab-system-report">
            <Bug className="h-4 w-4 mr-2" />
            System Report
          </TabsTrigger>
          <TabsTrigger value="development" data-testid="tab-development-tracker">
            <Hammer className="h-4 w-4 mr-2" />
            Development Tracker
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <div className="space-y-6">
            <div className="flex items-center justify-end gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="report-mode" className="text-sm">Simple</Label>
                <Switch
                  id="report-mode"
                  checked={isAdvanced}
                  onCheckedChange={setIsAdvanced}
                  data-testid="switch-report-mode"
                />
                <Label htmlFor="report-mode" className="text-sm">Advanced</Label>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh-report">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!report} data-testid="button-download-report">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : report ? (
              isAdvanced ? (
                <AdvancedReportView report={report as AdvancedReport} />
              ) : (
                <SimpleReportView report={report as SimpleReport} />
              )
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No Report Data Available</p>
                  <p className="text-muted-foreground">Click refresh to generate a diagnostic report.</p>
                </CardContent>
              </Card>
            )}

            {report && (
              <p className="text-xs text-muted-foreground text-center">
                Report generated at {formatDate(report.generatedAt)}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="development">
          <DevelopmentTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
}
