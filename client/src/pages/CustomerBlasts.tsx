import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone,
  Users,
  Mail,
  MessageSquareText,
  Globe,
  Ban,
  Send,
  Loader2,
  History,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceType {
  id: string;
  name: string;
  category: string;
}

interface SegmentFilters {
  zone?: string;
  serviceType?: string;
  jobStage?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  overdueInvoice?: boolean;
}

interface ReachableCustomer {
  customerId: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  channel: "portal" | "email" | "sms" | "none";
  email: string | null;
  phone: string | null;
}

interface SegmentResult {
  count: number;
  reachable: number;
  unreachable: number;
  customers: ReachableCustomer[];
}

interface BlastHistoryRow {
  id: string;
  subject: string | null;
  template_key: string | null;
  body: string;
  filters: SegmentFilters | null;
  created_at: string;
  sent_at: string | null;
  created_by_name: string | null;
  recipient_count: string;
  sent_count: string;
  failed_count: string;
  skipped_count: string;
}

interface BlastRecipient {
  id: string;
  customer_id: string;
  channel: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  sent_at: string | null;
  first_name: string;
  last_name: string;
}

interface BlastDetail extends BlastHistoryRow {
  recipients: BlastRecipient[];
}

const TEMPLATES: { key: string; label: string; subject: string; body: string }[] = [
  {
    key: "seasonal_reminder",
    label: "Seasonal Reminder",
    subject: "A note from Chapin Landscapes",
    body: "Hi {{customer_name}},\n\nJust a friendly reminder that seasonal service is coming up. Let us know if you'd like to schedule anything!\n\nThanks,\nChapin Landscapes",
  },
  {
    key: "holiday_hours",
    label: "Holiday Hours",
    subject: "Holiday Hours Update",
    body: "Hi {{customer_name}},\n\nOur office hours will be adjusted for the upcoming holiday. We'll be back to our normal schedule shortly after.\n\nThanks,\nChapin Landscapes",
  },
  {
    key: "general_announcement",
    label: "General Announcement",
    subject: "An update from Chapin Landscapes",
    body: "Hi {{customer_name}},\n\n[Write your announcement here]\n\nThanks,\nChapin Landscapes",
  },
  {
    key: "route_delay",
    label: "Route Delay Notice",
    subject: "Service Delay Today — Chapin Landscapes",
    body: "Hi {{customer_name}},\n\nWe wanted to give you a heads-up that our crew is running a bit behind schedule today due to unexpected conditions. We still plan to complete your service and will be in touch if anything changes significantly.\n\nWe appreciate your patience and understanding!\n\nThank you,\nChapin Landscapes",
  },
];

const CHANNEL_ICON: Record<string, any> = {
  portal: Globe,
  email: Mail,
  sms: MessageSquareText,
  none: Ban,
};

const STATUS_BADGE: Record<string, { icon: any; className: string; label: string }> = {
  sent: { icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-300", label: "Sent" },
  failed: { icon: XCircle, className: "bg-red-100 text-red-700 border-red-300", label: "Failed" },
  skipped: { icon: MinusCircle, className: "bg-muted text-muted-foreground border-muted-foreground/30", label: "Skipped" },
};

export default function CustomerBlasts() {
  const { toast } = useToast();

  const [zone, setZone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [jobStage, setJobStage] = useState("");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [overdueInvoice, setOverdueInvoice] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedBlastId, setExpandedBlastId] = useState<string | null>(null);

  const filters: SegmentFilters = {
    zone: zone || undefined,
    serviceType: serviceType || undefined,
    jobStage: jobStage || undefined,
    scheduledFrom: scheduledFrom || undefined,
    scheduledTo: scheduledTo || undefined,
    overdueInvoice: overdueInvoice || undefined,
  };

  const hasAnyFilter = Object.values(filters).some((v) => v !== undefined);

  const { data: serviceTypes = [] } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types/active"],
    queryFn: () => fetch("/api/service-types/active", { credentials: "include" }).then((r) => r.json()),
  });

  const segmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customers/segment", filters);
      return (await res.json()) as SegmentResult;
    },
    onError: (err: any) => {
      toast({ title: "Failed to preview audience", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/message-blasts", {
        subject: subject || undefined,
        body,
        filters,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Blast sent",
        description: `${data.sent} sent, ${data.skipped} skipped out of ${data.total} customers.`,
      });
      setConfirmOpen(false);
      setSubject("");
      setBody("");
      segmentMutation.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/message-blasts"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send blast", description: err.message, variant: "destructive" });
      setConfirmOpen(false);
    },
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<BlastHistoryRow[]>({
    queryKey: ["/api/message-blasts"],
    queryFn: () => fetch("/api/message-blasts", { credentials: "include" }).then((r) => r.json()),
  });

  const { data: expandedDetail, isLoading: detailLoading } = useQuery<BlastDetail>({
    queryKey: ["/api/message-blasts", expandedBlastId],
    queryFn: () => fetch(`/api/message-blasts/${expandedBlastId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!expandedBlastId,
  });

  function applyTemplate(key: string) {
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    setSubject(tpl.subject);
    setBody(tpl.body);
  }

  const segment = segmentMutation.data;
  const canSend = body.trim().length > 0 && !!segment && segment.count > 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Customer Blasts</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Segment your customer list and send a bulk announcement by portal message, email, or text.
      </p>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose" data-testid="tab-compose">Compose</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-3.5 w-3.5 mr-1" /> History
          </TabsTrigger>
        </TabsList>

        {/* ── Compose Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="compose" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Audience
              </CardTitle>
              <CardDescription>Filter which customers should receive this message. Leave filters blank to include everyone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="zone">Zone</Label>
                  <Input
                    id="zone"
                    placeholder="e.g. North"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    data-testid="input-filter-zone"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Service Type</Label>
                  <Select value={serviceType || "any"} onValueChange={(v) => setServiceType(v === "any" ? "" : v)}>
                    <SelectTrigger data-testid="select-filter-service-type">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {serviceTypes.map((st) => (
                        <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jobStage">Job Stage</Label>
                  <Input
                    id="jobStage"
                    placeholder="e.g. Sold"
                    value={jobStage}
                    onChange={(e) => setJobStage(e.target.value)}
                    data-testid="input-filter-job-stage"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scheduledFrom">Scheduled From</Label>
                  <Input
                    id="scheduledFrom"
                    type="date"
                    value={scheduledFrom}
                    onChange={(e) => setScheduledFrom(e.target.value)}
                    data-testid="input-filter-scheduled-from"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scheduledTo">Scheduled To</Label>
                  <Input
                    id="scheduledTo"
                    type="date"
                    value={scheduledTo}
                    onChange={(e) => setScheduledTo(e.target.value)}
                    data-testid="input-filter-scheduled-to"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="overdueInvoice"
                    checked={overdueInvoice}
                    onCheckedChange={(v) => setOverdueInvoice(v === true)}
                    data-testid="checkbox-filter-overdue-invoice"
                  />
                  <Label htmlFor="overdueInvoice" className="cursor-pointer font-normal">Has overdue invoice</Label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => segmentMutation.mutate()}
                  disabled={segmentMutation.isPending}
                  data-testid="button-preview-audience"
                >
                  {segmentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Preview Audience
                </Button>
                {!hasAnyFilter && (
                  <span className="text-xs text-muted-foreground">No filters set — this will target all active customers.</span>
                )}
              </div>

              {segment && (
                <div className="rounded-md border p-3 space-y-2" data-testid="panel-audience-preview">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Badge variant="secondary" data-testid="badge-audience-count">{segment.count} matched</Badge>
                    <Badge className="bg-green-100 text-green-700 border-green-300" data-testid="badge-audience-reachable">
                      {segment.reachable} reachable
                    </Badge>
                    {segment.unreachable > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300" data-testid="badge-audience-unreachable">
                        {segment.unreachable} unreachable
                      </Badge>
                    )}
                  </div>
                  {segment.customers.length > 0 && (
                    <div className="max-h-40 overflow-y-auto text-sm divide-y">
                      {segment.customers.map((c) => {
                        const Icon = CHANNEL_ICON[c.channel];
                        return (
                          <div key={c.customerId} className="flex items-center justify-between py-1.5" data-testid={`row-audience-${c.customerId}`}>
                            <span>{c.firstName} {c.lastName}{c.companyName ? ` (${c.companyName})` : ""}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Icon className="h-3.5 w-3.5" />
                              {c.channel === "none" ? "no contact info" : c.channel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Message</CardTitle>
              <CardDescription>
                Use <code className="px-1 rounded bg-muted">{"{{customer_name}}"}</code> to personalize the greeting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Quick Template</Label>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger data-testid="select-template" className="max-w-xs">
                    <SelectValue placeholder="Start from a template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject (used for email)</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Message from Chapin Landscapes"
                  data-testid="input-subject"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Write your announcement here..."
                  data-testid="input-body"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!body.trim() || !segment}
                  title={!segment ? "Preview the audience first" : undefined}
                  data-testid="button-open-send-confirm"
                >
                  <Send className="h-4 w-4 mr-2" /> Send Blast
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── History Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {historyLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm" data-testid="text-no-history">
              No blasts sent yet.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const isExpanded = expandedBlastId === h.id;
                return (
                  <Card key={h.id} data-testid={`card-blast-${h.id}`}>
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedBlastId(isExpanded ? null : h.id)}
                      data-testid={`button-expand-blast-${h.id}`}
                    >
                      <CardContent className="py-3 flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{h.subject || "(no subject)"}</div>
                          <div className="text-xs text-muted-foreground">
                            {h.sent_at ? format(new Date(h.sent_at), "MMM d, yyyy h:mm a") : "Not sent"}
                            {h.created_by_name ? ` · by ${h.created_by_name}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <Badge className="bg-green-100 text-green-700 border-green-300">{h.sent_count} sent</Badge>
                          {Number(h.failed_count) > 0 && (
                            <Badge className="bg-red-100 text-red-700 border-red-300">{h.failed_count} failed</Badge>
                          )}
                          {Number(h.skipped_count) > 0 && (
                            <Badge variant="secondary">{h.skipped_count} skipped</Badge>
                          )}
                        </div>
                      </CardContent>
                    </button>
                    {isExpanded && (
                      <CardContent className="pt-0 border-t">
                        <div className="text-sm whitespace-pre-wrap text-muted-foreground py-3 border-b mb-2">{h.body}</div>
                        {detailLoading ? (
                          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                        ) : (
                          <div className="divide-y" data-testid={`list-recipients-${h.id}`}>
                            {expandedDetail?.recipients.map((r) => {
                              const st = STATUS_BADGE[r.status];
                              const StIcon = st.icon;
                              return (
                                <div key={r.id} className="flex items-center justify-between py-1.5 text-sm" data-testid={`row-recipient-${r.id}`}>
                                  <span>{r.first_name} {r.last_name}</span>
                                  <span className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">{r.channel}</span>
                                    <Badge variant="outline" className={st.className}>
                                      <StIcon className="h-3 w-3 mr-1" /> {st.label}
                                    </Badge>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Confirm Send Dialog ─────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="dialog-confirm-send">
          <DialogHeader>
            <DialogTitle>Send this blast?</DialogTitle>
            <DialogDescription>
              This will message {segment?.count ?? 0} customer{segment?.count === 1 ? "" : "s"} ({segment?.reachable ?? 0} reachable) right now. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} data-testid="button-cancel-send">Cancel</Button>
            <Button onClick={() => sendMutation.mutate()} disabled={!canSend || sendMutation.isPending} data-testid="button-confirm-send">
              {sendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
