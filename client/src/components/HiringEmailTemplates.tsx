import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Mail, CheckCircle, Info, Bell, Plus, X } from "lucide-react";

const STAGES = [
  {
    key: "Application Received",
    label: "Application Received",
    description: "Sent to applicant immediately when they submit their application.",
    icon: "📩",
  },
  {
    key: "1st Interview",
    label: "1st Interview",
    description: "Sent when a candidate is moved to the 1st Interview stage.",
    icon: "🤝",
  },
  {
    key: "Offer Extended",
    label: "Offer Extended",
    description: "Sent when a candidate is moved to the Offer Extended stage.",
    icon: "📄",
  },
  {
    key: "Hired",
    label: "Hired (Welcome)",
    description: "A welcome email is sent automatically on hire. You can customize that welcome message here.",
    icon: "🎉",
  },
  {
    key: "Declined / Not a Fit",
    label: "Declined / Not a Fit",
    description: "Optional rejection email when a candidate is moved to Declined.",
    icon: "📭",
  },
  {
    key: "Offer Letter",
    label: "Offer Letter",
    description: "A congratulatory letter with offer details. Send manually — not triggered automatically.",
    icon: "🎁",
  },
  {
    key: "Decline Letter",
    label: "Decline Letter",
    description: "A polite rejection for candidates who are not selected. Send manually — not triggered automatically.",
    icon: "🚫",
  },
  {
    key: "Onboarding / Start Date",
    label: "Onboarding / Start Date",
    description: "Welcome message covering what to bring and what to expect on day one. Send manually — not triggered automatically.",
    icon: "🚀",
  },
];

const VARIABLE_GUIDE = [
  { var: "{{name}}", desc: "Applicant's full name" },
  { var: "{{firstName}}", desc: "Applicant's first name" },
  { var: "{{position}}", desc: "Job role / position" },
  { var: "{{payRate}}", desc: "Offered pay rate" },
  { var: "{{startDate}}", desc: "Employment start date" },
  { var: "{{address}}", desc: "Office / report-to address" },
  { var: "{{date}}", desc: "Interview date (if applicable)" },
  { var: "{{time}}", desc: "Interview time (if applicable)" },
  { var: "{{location}}", desc: "Interview location (if applicable)" },
];

interface Template {
  id: string;
  stage: string;
  subject: string;
  body: string;
  isEnabled: boolean;
  updatedAt: string;
}

function TemplateCard({ stage, existingTemplate, onSave }: {
  stage: typeof STAGES[0];
  existingTemplate?: Template;
  onSave: (stage: string, data: { subject: string; body: string; isEnabled: boolean }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(existingTemplate?.subject || "");
  const [body, setBody] = useState(existingTemplate?.body || "");
  const [isEnabled, setIsEnabled] = useState(existingTemplate?.isEnabled ?? false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (existingTemplate) {
      setSubject(existingTemplate.subject);
      setBody(existingTemplate.body);
      setIsEnabled(existingTemplate.isEnabled);
    }
  }, [existingTemplate]);

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await onSave(stage.key, { subject, body, isEnabled });
    } finally {
      setSaving(false);
    }
  };

  const configured = !!existingTemplate;
  const hasChanges = existingTemplate
    ? subject !== existingTemplate.subject || body !== existingTemplate.body || isEnabled !== existingTemplate.isEnabled
    : subject.trim().length > 0 || body.trim().length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={`border transition-colors ${isEnabled ? "border-green-200 bg-green-50/30" : ""}`} data-testid={`template-card-${stage.key.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "")}`}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="w-full" asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <span className="text-xl">{stage.icon}</span>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">{stage.label}</CardTitle>
                    {configured && isEnabled && (
                      <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>
                    )}
                    {configured && !isEnabled && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>
                    )}
                    {!configured && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Not configured</Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-0.5">{stage.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">Available variables:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {VARIABLE_GUIDE.map(v => (
                    <span key={v.var}><code className="font-mono bg-blue-100 px-1 rounded">{v.var}</code> — {v.desc}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Enable this template</Label>
                <p className="text-xs text-muted-foreground mt-0.5">When enabled, this email will be sent automatically when a candidate reaches this stage.</p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                data-testid={`toggle-enabled-${stage.key.toLowerCase().replace(/\s+/g, "-")}`}
              />
            </div>

            <div>
              <Label className="text-sm">Subject Line <span className="text-red-500">*</span></Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={`e.g., We received your application — {{position}}`}
                className="mt-1"
                data-testid={`input-subject-${stage.key.toLowerCase().replace(/\s+/g, "-")}`}
              />
            </div>

            <div>
              <Label className="text-sm">Email Body <span className="text-red-500">*</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">HTML is supported. Use the variables above to personalize the message.</p>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="<p>Dear {{name}},</p><p>...</p>"
                className="font-mono text-xs"
                data-testid={`textarea-body-${stage.key.toLowerCase().replace(/\s+/g, "-")}`}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !subject.trim() || !body.trim()}
                size="sm"
                data-testid={`button-save-${stage.key.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {saving ? "Saving..." : configured ? "Save Changes" : "Create Template"}
              </Button>
              {existingTemplate && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(existingTemplate.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function NotificationRecipients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.role === "Admin" || (user as any)?.isMasterAdmin;

  const { data: setting } = useQuery<{ key: string; value: string } | null>({
    queryKey: ["/api/settings/hiring_notification_emails"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/hiring_notification_emails");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!isAdmin,
  });

  const emails: string[] = React.useMemo(() => {
    if (!setting?.value) return ["dan@chapinlandscapes.com"];
    try { return JSON.parse(setting.value); } catch { return []; }
  }, [setting]);

  const save = async (updated: string[]) => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/settings/hiring_notification_emails", { value: JSON.stringify(updated) });
      await queryClient.invalidateQueries({ queryKey: ["/api/settings/hiring_notification_emails"] });
      toast({ title: "Recipients updated" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || emails.includes(trimmed)) return;
    save([...emails, trimmed]);
    setNewEmail("");
  };

  const removeEmail = (email: string) => save(emails.filter((e) => e !== email));

  if (!isAdmin) return null;

  return (
    <Card className="border-blue-100 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-sm font-medium">New Application Notification Recipients</CardTitle>
        </div>
        <CardDescription className="text-xs mt-0.5">
          These addresses receive an email whenever a new job application is submitted. Add anyone who should be notified — e.g. Matt, Doug, Lindsey, or the Office inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="space-y-1.5">
          {emails.map((email) => (
            <div key={email} className="flex items-center justify-between bg-white border border-blue-100 rounded-md px-3 py-1.5">
              <span className="text-sm font-mono text-gray-700">{email}</span>
              <button
                onClick={() => removeEmail(email)}
                disabled={saving}
                className="text-muted-foreground hover:text-destructive transition-colors ml-2 disabled:opacity-40"
                data-testid={`button-remove-recipient-${email}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {emails.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-1">No recipients — add at least one address.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="name@chapinlandscapes.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
            className="h-8 text-sm"
            data-testid="input-new-recipient"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addEmail}
            disabled={saving || !newEmail.trim().includes("@")}
            className="h-8 shrink-0"
            data-testid="button-add-recipient"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HiringEmailTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/hiring-email-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/hiring-email-templates")).json(),
  });

  const saveTemplate = async (stage: string, data: { subject: string; body: string; isEnabled: boolean }) => {
    const encodedStage = encodeURIComponent(stage);
    const res = await apiRequest("PUT", `/api/hiring-email-templates/${encodedStage}`, data);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to save template");
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/hiring-email-templates"] });
    toast({ title: "Template saved", description: `Email template for "${stage}" has been updated.` });
  };

  const activeCount = templates.filter((t) => t.isEnabled).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading templates...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Hiring Pipeline Email Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automatic emails sent to applicants at each stage of the hiring pipeline. Enable only the stages you want to send.
          </p>
        </div>
        <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          {activeCount} of {STAGES.length} active
        </Badge>
      </div>

      <NotificationRecipients />

      <div className="space-y-3">
        {STAGES.map((stage) => {
          const existing = templates.find((t) => t.stage === stage.key);
          return (
            <TemplateCard
              key={stage.key}
              stage={stage}
              existingTemplate={existing}
              onSave={saveTemplate}
            />
          );
        })}
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <p className="font-medium mb-1">Important notes:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Interview Scheduled emails use a dedicated template with Zoom/In-Person details and are always sent.</li>
          <li>Hired emails (credentials + welcome) are always sent automatically; the template above adds an additional welcome message.</li>
          <li>Disabled templates will not send even if the stage is triggered.</li>
        </ul>
      </div>
    </div>
  );
}
