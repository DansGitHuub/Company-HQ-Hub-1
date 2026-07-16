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
import { Separator } from "@/components/ui/separator";
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
  AlertTriangle,
  FlaskConical,
  Eye,
  EyeOff,
  Smartphone,
  RadioTower,
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
  hasSmsConsent: boolean;
}

interface SegmentResult {
  count: number;
  reachable: number;
  unreachable: number;
  smsConsentCount: number;
  smsPhoneCount: number;
  customers: ReachableCustomer[];
}

interface BlastHistoryRow {
  id: string;
  subject: string | null;
  template_key: string | null;
  body: string;
  filters: SegmentFilters | null;
  channels: string[] | null;
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

interface TestResult {
  channel: string;
  success: boolean;
  note?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const CHANNEL_LABEL: Record<string, string> = {
  portal: "Portal",
  email: "Email",
  sms: "SMS",
};

const STATUS_BADGE: Record<string, { icon: any; className: string; label: string }> = {
  sent: { icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-300", label: "Sent" },
  failed: { icon: XCircle, className: "bg-red-100 text-red-700 border-red-300", label: "Failed" },
  skipped: { icon: MinusCircle, className: "bg-muted text-muted-foreground border-muted-foreground/30", label: "Skipped" },
};

// ── SMS segment calculator ────────────────────────────────────────────────────

// GSM-7 basic character set (extended chars like { } \ ~ | etc. count as 2 chars but we simplify here)
const GSM7_REGEX = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|]*$/;

function calcSmsSegments(text: string): { chars: number; segments: number; charsPerSegment: number } {
  const chars = text.length;
  const isGsm7 = GSM7_REGEX.test(text);
  const charsPerSegment = isGsm7 ? 160 : 70;
  const segments = chars === 0 ? 0 : Math.ceil(chars / charsPerSegment);
  return { chars, segments, charsPerSegment };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomerBlasts() {
  const { toast } = useToast();

  // Audience filters
  const [zone, setZone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [jobStage, setJobStage] = useState("");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [overdueInvoice, setOverdueInvoice] = useState(false);

  // Channel selector — SMS off by default (costs money + requires consent)
  const [channelPortal, setChannelPortal] = useState(true);
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelSms, setChannelSms] = useState(false);

  // Message composition
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedBlastId, setExpandedBlastId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);

  const filters: SegmentFilters = {
    zone: zone || undefined,
    serviceType: serviceType || undefined,
    jobStage: jobStage || undefined,
    scheduledFrom: scheduledFrom || undefined,
    scheduledTo: scheduledTo || undefined,
    overdueInvoice: overdueInvoice || undefined,
  };

  const hasAnyFilter = Object.values(filters).some((v) => v !== undefined);

  const selectedChannels = [
    ...(channelPortal ? ["portal"] : []),
    ...(channelEmail ? ["email"] : []),
    ...(channelSms ? ["sms"] : []),
  ];
  const atLeastOneChannel = selectedChannels.length > 0;

  const smsInfo = calcSmsSegments(body);

  // ── Data fetching ──────────────────────────────────────────────────────────

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

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/message-blasts/test", {
        subject: channelEmail ? (subject || undefined) : undefined,
        body,
        channels: selectedChannels,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setTestResults(data.results ?? []);
      const sent = (data.results ?? []).filter((r: TestResult) => r.success).map((r: TestResult) => r.channel);
      toast({
        title: "Test sent",
        description: sent.length > 0
          ? `Delivered to your account via: ${sent.join(", ")}`
          : "No channels delivered — see notes below.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Test send failed", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/message-blasts", {
        subject: channelEmail ? (subject || undefined) : undefined,
        body,
        filters,
        channels: selectedChannels,
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
      setTestResults(null);
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  function applyTemplate(key: string) {
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    setSubject(tpl.subject);
    setBody(tpl.body);
  }

  const segment = segmentMutation.data;
  const canSend = body.trim().length > 0 && !!segment && segment.count > 0 && atLeastOneChannel;
  const previewBody = body.replace(/\{\{\s*customer_name\s*\}\}/g, "Customer Name");
  const previewSubject = subject || "Message from Chapin Landscapes";

  // Per-channel audience breakdown for confirm dialog
  const portalCount = segment?.customers.filter((c) => c.channel === "portal").length ?? 0;
  const emailCount = segment?.customers.filter((c) => !!c.email).length ?? 0;
  const smsConsentCount = segment?.smsConsentCount ?? 0;
  const smsPhoneCount = segment?.smsPhoneCount ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────

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

          {/* Audience */}
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
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary" data-testid="badge-audience-count">{segment.count} matched</Badge>
                    <Badge className="bg-green-100 text-green-700 border-green-300" data-testid="badge-audience-reachable">
                      {segment.reachable} reachable
                    </Badge>
                    {segment.unreachable > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300" data-testid="badge-audience-unreachable">
                        {segment.unreachable} unreachable
                      </Badge>
                    )}
                    {channelSms && (
                      <Badge
                        className="bg-blue-100 text-blue-700 border-blue-300"
                        data-testid="badge-audience-sms-consent"
                        title={`${smsPhoneCount} have a phone number; ${smsConsentCount} have opted in to promotional SMS`}
                      >
                        <Smartphone className="h-3 w-3 mr-1" />
                        {smsConsentCount} SMS consented
                      </Badge>
                    )}
                  </div>
                  {channelSms && smsPhoneCount > smsConsentCount && (
                    <p className="text-xs text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {smsPhoneCount - smsConsentCount} customer{smsPhoneCount - smsConsentCount !== 1 ? "s" : ""} have a phone but no SMS opt-in and will be skipped for text.
                    </p>
                  )}
                  {segment.customers.length > 0 && (
                    <div className="max-h-40 overflow-y-auto text-sm divide-y">
                      {segment.customers.map((c) => {
                        const Icon = CHANNEL_ICON[c.channel];
                        return (
                          <div key={c.customerId} className="flex items-center justify-between py-1.5" data-testid={`row-audience-${c.customerId}`}>
                            <span>{c.firstName} {c.lastName}{c.companyName ? ` (${c.companyName})` : ""}</span>
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              {c.hasSmsConsent && channelSms && (
                                <span className="text-blue-600" title="SMS consented">
                                  <Smartphone className="h-3 w-3 inline" />
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Icon className="h-3.5 w-3.5" />
                                {c.channel === "none" ? "no contact info" : c.channel}
                              </span>
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

          {/* Channel Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RadioTower className="h-4 w-4" /> Channels
              </CardTitle>
              <CardDescription>
                Choose how customers will receive this blast. At least one channel is required.
                Each customer is messaged only via channels they support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="panel-channel-selector">
                {/* Portal */}
                <label
                  htmlFor="channel-portal"
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    channelPortal ? "border-primary/50 bg-primary/5" : "border-muted bg-muted/20 hover:bg-muted/40"
                  }`}
                  data-testid="label-channel-portal"
                >
                  <Checkbox
                    id="channel-portal"
                    checked={channelPortal}
                    onCheckedChange={(v) => setChannelPortal(v === true)}
                    data-testid="checkbox-channel-portal"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      <Globe className="h-3.5 w-3.5 text-primary" /> Portal Message
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Sent to customers with a portal login account.</p>
                  </div>
                </label>

                {/* Email */}
                <label
                  htmlFor="channel-email"
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    channelEmail ? "border-primary/50 bg-primary/5" : "border-muted bg-muted/20 hover:bg-muted/40"
                  }`}
                  data-testid="label-channel-email"
                >
                  <Checkbox
                    id="channel-email"
                    checked={channelEmail}
                    onCheckedChange={(v) => setChannelEmail(v === true)}
                    data-testid="checkbox-channel-email"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      <Mail className="h-3.5 w-3.5 text-primary" /> Email
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Sent to customers with an email address on file.</p>
                  </div>
                </label>

                {/* SMS */}
                <label
                  htmlFor="channel-sms"
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    channelSms ? "border-blue-500/50 bg-blue-500/5" : "border-muted bg-muted/20 hover:bg-muted/40"
                  }`}
                  data-testid="label-channel-sms"
                >
                  <Checkbox
                    id="channel-sms"
                    checked={channelSms}
                    onCheckedChange={(v) => setChannelSms(v === true)}
                    data-testid="checkbox-channel-sms"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      <MessageSquareText className="h-3.5 w-3.5 text-blue-600" /> Text (SMS)
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">SMS opt-in required. Sent from the Chapin 844 number.</p>
                  </div>
                </label>
              </div>

              {!atLeastOneChannel && (
                <p className="mt-3 text-xs text-destructive flex items-center gap-1" data-testid="text-no-channel-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> Select at least one channel to send a blast.
                </p>
              )}

              {channelSms && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800" data-testid="panel-sms-cost-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>SMS costs money.</strong> Each text segment costs ~$0.0075. Customers without a
                    verified SMS opt-in are automatically skipped. Only use SMS for time-sensitive updates.
                    Messages are sent from the Chapin Landscapes 844 customer number.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message */}
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

              {/* Subject — only shown when Email is selected */}
              {channelEmail && (
                <div className="space-y-1.5" data-testid="panel-subject-field">
                  <Label htmlFor="subject">
                    Subject <span className="text-muted-foreground font-normal text-xs">(email only)</span>
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Message from Chapin Landscapes"
                    data-testid="input-subject"
                  />
                </div>
              )}

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

                {/* SMS character / segment counter */}
                {channelSms && body.length > 0 && (
                  <div
                    className={`flex items-center gap-2 text-xs px-1 ${
                      smsInfo.segments > 2 ? "text-amber-600" : "text-muted-foreground"
                    }`}
                    data-testid="panel-sms-counter"
                  >
                    <Smartphone className="h-3 w-3" />
                    <span>
                      {smsInfo.chars} chars ·{" "}
                      <strong>{smsInfo.segments} SMS segment{smsInfo.segments !== 1 ? "s" : ""}</strong>
                      {" "}(~{smsInfo.charsPerSegment} chars/{smsInfo.charsPerSegment === 160 ? "GSM-7" : "Unicode"})
                    </span>
                    {smsInfo.segments > 2 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Long message — consider shortening.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Per-channel preview */}
              {body.trim() && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-preview"
                  >
                    {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showPreview ? "Hide preview" : "Show per-channel preview"}
                  </button>

                  {showPreview && (
                    <div className="border rounded-lg overflow-hidden" data-testid="panel-channel-preview">
                      <Tabs defaultValue={channelPortal ? "portal" : channelEmail ? "email" : "sms"}>
                        <TabsList className="bg-muted/60 w-full justify-start rounded-none border-b px-2 h-9 gap-1">
                          {channelPortal && (
                            <TabsTrigger value="portal" className="h-7 text-xs gap-1" data-testid="preview-tab-portal">
                              <Globe className="h-3 w-3" /> Portal
                            </TabsTrigger>
                          )}
                          {channelEmail && (
                            <TabsTrigger value="email" className="h-7 text-xs gap-1" data-testid="preview-tab-email">
                              <Mail className="h-3 w-3" /> Email
                            </TabsTrigger>
                          )}
                          {channelSms && (
                            <TabsTrigger value="sms" className="h-7 text-xs gap-1" data-testid="preview-tab-sms">
                              <MessageSquareText className="h-3 w-3" /> SMS
                            </TabsTrigger>
                          )}
                          {!channelPortal && !channelEmail && !channelSms && (
                            <span className="text-xs text-muted-foreground px-2 self-center">Select a channel to preview</span>
                          )}
                        </TabsList>

                        {/* Portal preview */}
                        {channelPortal && (
                          <TabsContent value="portal" className="p-4 m-0 bg-background" data-testid="preview-content-portal">
                            <p className="text-xs text-muted-foreground mb-2">How it appears in the customer portal inbox:</p>
                            <div className="flex gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Globe className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Chapin Landscapes</p>
                                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm whitespace-pre-wrap max-w-md">
                                  {previewBody}
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        )}

                        {/* Email preview */}
                        {channelEmail && (
                          <TabsContent value="email" className="p-4 m-0 bg-background" data-testid="preview-content-email">
                            <p className="text-xs text-muted-foreground mb-2">How it appears as an email:</p>
                            <div className="border rounded-md overflow-hidden text-sm">
                              <div className="bg-muted/50 px-4 py-2.5 border-b space-y-1 text-xs font-mono">
                                <div><span className="text-muted-foreground w-16 inline-block">From:</span> Chapin Landscapes &lt;noreply@chapinlandscapes.com&gt;</div>
                                <div><span className="text-muted-foreground w-16 inline-block">Subject:</span> {previewSubject}</div>
                                <div><span className="text-muted-foreground w-16 inline-block">To:</span> customer@email.com</div>
                              </div>
                              <div className="px-4 py-3 whitespace-pre-wrap text-sm font-sans">
                                {previewBody}
                              </div>
                            </div>
                          </TabsContent>
                        )}

                        {/* SMS preview */}
                        {channelSms && (
                          <TabsContent value="sms" className="p-4 m-0 bg-background" data-testid="preview-content-sms">
                            <p className="text-xs text-muted-foreground mb-2">How it appears as a text message (SMS opted-in customers only):</p>
                            <div className="flex items-end gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 border text-xs font-bold">CL</div>
                              <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2.5 text-sm max-w-xs whitespace-pre-wrap">
                                {previewBody}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Sent from the Chapin Landscapes 844 customer number ·{" "}
                              {smsInfo.segments} segment{smsInfo.segments !== 1 ? "s" : ""}
                            </p>
                          </TabsContent>
                        )}
                      </Tabs>
                    </div>
                  )}
                </div>
              )}

              {/* Test results from "Send test to myself" */}
              {testResults && (
                <div className="rounded-md border p-3 space-y-1.5" data-testid="panel-test-results">
                  <p className="text-xs font-medium text-muted-foreground">Test send results:</p>
                  {testResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs" data-testid={`row-test-result-${r.channel}`}>
                      {r.success
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                        : <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                      <span>
                        <span className="font-medium capitalize">{r.channel}:</span>{" "}
                        <span className="text-muted-foreground">{r.note || (r.success ? "Sent" : "Not sent")}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setTestResults(null); testMutation.mutate(); }}
                  disabled={!body.trim() || !atLeastOneChannel || testMutation.isPending}
                  data-testid="button-send-test"
                  title="Send this message to your own account via the selected channels"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <FlaskConical className="h-3.5 w-3.5 mr-2" />
                  )}
                  Send test to myself
                </Button>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canSend}
                  title={
                    !body.trim() ? "Write a message first" :
                    !atLeastOneChannel ? "Select at least one channel" :
                    !segment ? "Preview the audience first" : undefined
                  }
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
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span>{h.sent_at ? format(new Date(h.sent_at), "MMM d, yyyy h:mm a") : "Not sent"}
                              {h.created_by_name ? ` · by ${h.created_by_name}` : ""}</span>
                            {h.channels && h.channels.length > 0 && (
                              <span className="flex items-center gap-1">
                                ·
                                {h.channels.map((ch) => {
                                  const Icon = CHANNEL_ICON[ch];
                                  return Icon ? <Icon key={ch} className="h-3 w-3" title={CHANNEL_LABEL[ch]} /> : null;
                                })}
                              </span>
                            )}
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
                              const st = STATUS_BADGE[r.status] ?? STATUS_BADGE.skipped;
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
        <DialogContent data-testid="dialog-confirm-send" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send this blast?</DialogTitle>
            <DialogDescription>
              Review the details below before sending. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Channels selected */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channels</p>
              <div className="flex flex-wrap gap-2">
                {channelPortal && (
                  <div className="flex items-center gap-1.5 text-sm border rounded-md px-2.5 py-1 bg-muted/30" data-testid="confirm-channel-portal">
                    <Globe className="h-3.5 w-3.5 text-primary" /> Portal
                  </div>
                )}
                {channelEmail && (
                  <div className="flex items-center gap-1.5 text-sm border rounded-md px-2.5 py-1 bg-muted/30" data-testid="confirm-channel-email">
                    <Mail className="h-3.5 w-3.5 text-primary" /> Email
                  </div>
                )}
                {channelSms && (
                  <div className="flex items-center gap-1.5 text-sm border rounded-md px-2.5 py-1 bg-blue-50 border-blue-200 text-blue-800" data-testid="confirm-channel-sms">
                    <MessageSquareText className="h-3.5 w-3.5" /> SMS
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Per-channel reach */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estimated reach</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total customers matched</span>
                  <span className="font-medium">{segment?.count ?? 0}</span>
                </div>
                {channelPortal && (
                  <div className="flex justify-between" data-testid="confirm-count-portal">
                    <span className="text-muted-foreground flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Portal recipients</span>
                    <span>{portalCount}</span>
                  </div>
                )}
                {channelEmail && (
                  <div className="flex justify-between" data-testid="confirm-count-email">
                    <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email recipients</span>
                    <span>{emailCount}</span>
                  </div>
                )}
                {channelSms && (
                  <div className="flex justify-between" data-testid="confirm-count-sms">
                    <span className="text-muted-foreground flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5" /> SMS recipients</span>
                    <span>
                      {smsConsentCount}
                      {smsPhoneCount > smsConsentCount && (
                        <span className="text-xs text-muted-foreground ml-1">({smsPhoneCount - smsConsentCount} skipped, no consent)</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SMS cost warning in confirm */}
            {channelSms && smsConsentCount > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800" data-testid="confirm-sms-cost-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Sending {smsConsentCount} SMS message{smsConsentCount !== 1 ? "s" : ""} × {smsInfo.segments} segment{smsInfo.segments !== 1 ? "s" : ""} = ~{smsConsentCount * smsInfo.segments} total segments.
                  Estimated cost: ~${(smsConsentCount * smsInfo.segments * 0.0075).toFixed(2)}.
                </span>
              </div>
            )}
          </div>

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
