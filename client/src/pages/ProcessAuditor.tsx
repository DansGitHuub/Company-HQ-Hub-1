import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ClipboardCheck,
  Play,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  TrendingUp,
  Users,
  MessageSquare,
  Shield,
  Loader2,
  RefreshCw,
  Info,
  ArrowRight,
} from "lucide-react";
import type { BusinessProcess, ProcessAuditResult } from "@shared/schema";

export default function ProcessAuditor() {
  const { toast } = useToast();
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [pollingAuditId, setPollingAuditId] = useState<string | null>(null);

  const { data: processes = [] } = useQuery<BusinessProcess[]>({
    queryKey: ["/api/business-processes"],
  });

  const { data: auditResults = [], refetch: refetchAudits } = useQuery<ProcessAuditResult[]>({
    queryKey: ["/api/process-audits", selectedProcessId],
    queryFn: async () => {
      const url = selectedProcessId 
        ? `/api/process-audits?processId=${selectedProcessId}` 
        : "/api/process-audits";
      return apiRequest("GET", url).then(r => r.json());
    },
    refetchInterval: pollingAuditId ? 2000 : false,
  });

  const runAuditMutation = useMutation({
    mutationFn: async (processId: string) => {
      const res = await apiRequest("POST", "/api/process-audits/run", { processId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Audit Started", description: `Estimated time: ${data.estimatedTime}` });
      setPollingAuditId(data.auditId);
      setShowRunDialog(false);
      refetchAudits();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start audit", variant: "destructive" });
    },
  });

  // Stop polling when audit completes
  useEffect(() => {
    if (!pollingAuditId) return;
    const runningAudit = auditResults.find(a => a.id === pollingAuditId);
    if (runningAudit && runningAudit.status !== "running") {
      setPollingAuditId(null);
      if (runningAudit.status === "completed") {
        toast({ title: "Audit Complete", description: "Process audit has finished successfully" });
      }
    }
  }, [auditResults, pollingAuditId, toast]);

  const selectedProcess = processes.find(p => p.id === selectedProcessId);
  const latestAudit = auditResults.find(a => a.processId === selectedProcessId && a.status === "completed");

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium": return <Info className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Process Auditor</h1>
            <p className="text-muted-foreground">
              Analyze and optimize your business workflows
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Select Process
            </CardTitle>
            <CardDescription>
              Choose a workflow to audit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
              <SelectTrigger data-testid="select-process">
                <SelectValue placeholder="Select a process..." />
              </SelectTrigger>
              <SelectContent>
                {processes.map((process) => (
                  <SelectItem key={process.id} value={process.id}>
                    {process.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProcess && (
              <div className="space-y-3 pt-2">
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProcess.description || "No description"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{selectedProcess.category}</Badge>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedProcess.estimatedDuration || "N/A"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Roles Involved</p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedProcess.rolesInvolved as string[] || []).map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full" data-testid="button-run-audit">
                      <Play className="h-4 w-4 mr-2" />
                      Run Audit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Run Process Audit</DialogTitle>
                      <DialogDescription>
                        The AI will analyze "{selectedProcess.name}" and provide improvement recommendations.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-sm">Estimated Time</p>
                          <p className="text-sm text-muted-foreground">30-60 seconds</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-sm">Estimated Cost</p>
                          <p className="text-sm text-muted-foreground">$0.02 - $0.05</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        The audit will evaluate efficiency, reliability, customer experience, and communication. 
                        You can safely navigate away - the audit runs in the background.
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowRunDialog(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => runAuditMutation.mutate(selectedProcessId)}
                          disabled={runAuditMutation.isPending}
                          data-testid="button-confirm-audit"
                        >
                          {runAuditMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Start Audit
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {selectedProcess.lastAuditedAt && (
                  <p className="text-xs text-muted-foreground text-center">
                    Last audited: {new Date(selectedProcess.lastAuditedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Audit Results
                </CardTitle>
                <CardDescription>
                  {latestAudit ? "Latest analysis and recommendations" : "Run an audit to see results"}
                </CardDescription>
              </div>
              {pollingAuditId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedProcessId ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a process to view audit results</p>
              </div>
            ) : !latestAudit ? (
              <div className="text-center py-12 text-muted-foreground">
                <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit results yet. Run an audit to analyze this process.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${getScoreColor(latestAudit.overallScore || 0)}`}>
                      {latestAudit.overallScore || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Overall</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${getScoreColor(latestAudit.efficiencyScore || 0)}`}>
                      {latestAudit.efficiencyScore || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Efficiency</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${getScoreColor(latestAudit.reliabilityScore || 0)}`}>
                      {latestAudit.reliabilityScore || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Reliability</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${getScoreColor(latestAudit.customerExperienceScore || 0)}`}>
                      {latestAudit.customerExperienceScore || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Customer XP</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${getScoreColor(latestAudit.communicationScore || 0)}`}>
                      {latestAudit.communicationScore || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Communication</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Run time: {latestAudit.runDurationMs ? `${(latestAudit.runDurationMs / 1000).toFixed(1)}s` : "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>Cost: ${latestAudit.estimatedCost || "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span>Improvement: {(latestAudit.estimatedImprovementTime as string) || "N/A"}</span>
                  </div>
                </div>

                <Accordion type="multiple" defaultValue={["findings", "recommendations"]}>
                  <AccordionItem value="findings">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Findings ({(latestAudit.findingsJson as any[])?.length || 0})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-3">
                          {(latestAudit.findingsJson as any[])?.map((finding: any, idx: number) => (
                            <div key={idx} className="p-3 border rounded-lg">
                              <div className="flex items-start gap-2">
                                {getSeverityIcon(finding.severity)}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{finding.title}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {finding.type}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {finding.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="recommendations">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Recommendations ({(latestAudit.recommendationsJson as any[])?.length || 0})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                          {(latestAudit.recommendationsJson as any[])?.map((rec: any, idx: number) => (
                            <div key={idx} className="p-4 border rounded-lg">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="font-medium">{rec.title}</p>
                                <Badge className={getPriorityColor(rec.priority)}>
                                  {rec.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {rec.description}
                              </p>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Effort: {rec.estimatedEffort}
                                </span>
                                <span className="flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3" />
                                  Impact: {rec.expectedImpact}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedProcess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Process Steps
            </CardTitle>
            <CardDescription>
              Current workflow definition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-center">
              {(selectedProcess.stepsJson as any[])?.map((step: any, idx: number) => (
                <div key={idx} className="flex items-center">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
                    <Badge variant="outline" className="text-xs">{step.role}</Badge>
                    <span>{step.name}</span>
                  </div>
                  {idx < ((selectedProcess.stepsJson as any[])?.length || 0) - 1 && (
                    <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {auditResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit History</CardTitle>
            <CardDescription>
              Previous audit runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditResults.slice(0, 5).map((audit) => {
                const process = processes.find(p => p.id === audit.processId);
                return (
                  <div key={audit.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={audit.status === "completed" ? "default" : audit.status === "running" ? "secondary" : "destructive"}
                      >
                        {audit.status}
                      </Badge>
                      <span className="font-medium">{process?.name || "Unknown"}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(audit.createdAt!).toLocaleString()}
                      </span>
                    </div>
                    {audit.overallScore && (
                      <div className={`font-bold ${getScoreColor(audit.overallScore)}`}>
                        {audit.overallScore}/100
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
