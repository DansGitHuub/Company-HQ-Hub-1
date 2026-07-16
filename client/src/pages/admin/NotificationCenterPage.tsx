import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Bell, BellOff, Mail, MessageSquare, Smartphone, MonitorSmartphone,
  Check, Info, ChevronDown, AlertTriangle, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface NotifRow {
  type: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
  // Company defaults
  chan_in_app: boolean;
  chan_email: boolean;
  chan_sms: boolean;
  chan_push: boolean;
  cadence: string;
  // User overrides (null = using company default)
  user_in_app: boolean | null;
  user_email: boolean | null;
  user_sms: boolean | null;
  user_push: boolean | null;
  user_cadence: string | null;
}

type Channel = "in_app" | "email" | "sms" | "push";
type Cadence = "immediate" | "daily_digest" | "weekly" | "off";

const CADENCE_LABELS: Record<string, string> = {
  immediate:    "Immediate",
  daily_digest: "Daily Digest",
  weekly:       "Weekly",
  off:          "Off",
};

const CATEGORY_ORDER = [
  "Operations", "Financial", "HR & Time", "Hiring", "Customer", "System"
];

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    "Operations": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "Financial":  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "HR & Time":  "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "Hiring":     "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "Customer":   "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    "System":     "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return map[cat] ?? "bg-slate-100 text-slate-700";
}

// ── Inline save indicator ──────────────────────────────────────────────────────
function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 font-medium animate-in fade-in duration-200">
      <Check className="h-3 w-3" /> Saved
    </span>
  );
}

// ── Channel icon helper ────────────────────────────────────────────────────────
function ChanIcon({ channel }: { channel: Channel }) {
  if (channel === "in_app") return <MonitorSmartphone className="h-4 w-4" />;
  if (channel === "email")  return <Mail className="h-4 w-4" />;
  if (channel === "sms")    return <MessageSquare className="h-4 w-4" />;
  return <Smartphone className="h-4 w-4" />;  // push
}

function channelLabel(c: Channel) {
  if (c === "in_app") return "In-App";
  if (c === "email")  return "Email";
  if (c === "sms")    return "SMS";
  return "Push";
}

// ── Row component (company tab) ────────────────────────────────────────────────
function CompanyRow({
  row,
  onSave,
}: {
  row: NotifRow;
  onSave: (type: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  async function handleChannel(channel: string, value: boolean) {
    setSaving(channel);
    const key = `chan_${channel}`;
    await onSave(row.type, { [key]: value });
    setSaving(null);
    setSavedKeys((s) => new Set([...s, channel]));
    setTimeout(() => setSavedKeys((s) => { const n = new Set(s); n.delete(channel); return n; }), 2000);
  }

  async function handleCadence(value: string) {
    setSaving("cadence");
    await onSave(row.type, { cadence: value });
    setSaving(null);
    setSavedKeys((s) => new Set([...s, "cadence"]));
    setTimeout(() => setSavedKeys((s) => { const n = new Set(s); n.delete("cadence"); return n; }), 2000);
  }

  const channels: Channel[] = ["in_app", "email", "sms", "push"];

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 w-[220px]">
        <div className="font-medium text-sm">{row.label}</div>
        {row.description && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{row.description}</div>
        )}
      </td>
      <td className="py-3 px-3 w-[110px]">
        <Badge className={`text-xs font-normal ${categoryColor(row.category)}`}>
          {row.category}
        </Badge>
      </td>
      {channels.map((ch) => {
        const key = `chan_${ch}` as keyof NotifRow;
        const val = row[key] as boolean;
        const isSms = ch === "sms";
        const isPush = ch === "push";
        return (
          <td key={ch} className="py-3 px-3 text-center w-[90px]">
            <div className="flex flex-col items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch
                        checked={val}
                        disabled={saving === ch || isPush}
                        onCheckedChange={(v) => handleChannel(ch, v)}
                        data-testid={`company-${row.type}-${ch}`}
                        className={isSms && !val ? "opacity-60" : ""}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPush
                      ? "Push notifications coming soon"
                      : isSms && !val
                      ? "SMS is OFF by default — costs per text. Enable only if needed."
                      : `Toggle ${channelLabel(ch)} for this notification`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <SavedBadge show={savedKeys.has(ch)} />
            </div>
          </td>
        );
      })}
      <td className="py-3 px-4 w-[160px]">
        <div className="flex items-center gap-1">
          <Select
            value={row.cadence}
            onValueChange={handleCadence}
            disabled={saving === "cadence"}
          >
            <SelectTrigger className="h-8 text-xs w-[130px]" data-testid={`company-cadence-${row.type}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CADENCE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SavedBadge show={savedKeys.has("cadence")} />
        </div>
      </td>
    </tr>
  );
}

// ── Row component (user preferences tab) ──────────────────────────────────────
function UserRow({
  row,
  onSave,
  onReset,
}: {
  row: NotifRow;
  onSave: (type: string, patch: Record<string, unknown>) => Promise<void>;
  onReset: (type: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  // Effective values (user override ?? company default)
  const eff = {
    in_app: row.user_in_app  ?? row.chan_in_app,
    email:  row.user_email   ?? row.chan_email,
    sms:    row.user_sms     ?? row.chan_sms,
    push:   row.user_push    ?? row.chan_push,
    cadence:row.user_cadence ?? row.cadence,
  };

  const hasOverride =
    row.user_in_app  !== null ||
    row.user_email   !== null ||
    row.user_sms     !== null ||
    row.user_push    !== null ||
    row.user_cadence !== null;

  async function handleChannel(channel: string, value: boolean) {
    setSaving(channel);
    await onSave(row.type, { [`chan_${channel}`]: value });
    setSaving(null);
    setSavedKeys((s) => new Set([...s, channel]));
    setTimeout(() => setSavedKeys((s) => { const n = new Set(s); n.delete(channel); return n; }), 2000);
  }

  async function handleCadence(value: string) {
    setSaving("cadence");
    await onSave(row.type, { cadence: value });
    setSaving(null);
    setSavedKeys((s) => new Set([...s, "cadence"]));
    setTimeout(() => setSavedKeys((s) => { const n = new Set(s); n.delete("cadence"); return n; }), 2000);
  }

  async function handleReset() {
    setSaving("reset");
    await onReset(row.type);
    setSaving(null);
  }

  const channels: Channel[] = ["in_app", "email", "sms", "push"];

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 w-[220px]">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{row.label}</span>
          {hasOverride && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              Custom
            </Badge>
          )}
        </div>
        {row.description && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{row.description}</div>
        )}
      </td>
      <td className="py-3 px-3 w-[110px]">
        <Badge className={`text-xs font-normal ${categoryColor(row.category)}`}>
          {row.category}
        </Badge>
      </td>
      {channels.map((ch) => {
        const val = eff[ch as keyof typeof eff] as boolean;
        const isPush = ch === "push";
        const isSms = ch === "sms";
        return (
          <td key={ch} className="py-3 px-3 text-center w-[90px]">
            <div className="flex flex-col items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch
                        checked={val}
                        disabled={saving === ch || isPush}
                        onCheckedChange={(v) => handleChannel(ch, v)}
                        data-testid={`user-${row.type}-${ch}`}
                        className={isSms && !val ? "opacity-60" : ""}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPush
                      ? "Push notifications coming soon"
                      : isSms && !val
                      ? "SMS is OFF by default. Enable only if you want text messages for this."
                      : `Override ${channelLabel(ch)} for yourself`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <SavedBadge show={savedKeys.has(ch)} />
            </div>
          </td>
        );
      })}
      <td className="py-3 px-4 w-[160px]">
        <div className="flex items-center gap-1">
          <Select
            value={eff.cadence}
            onValueChange={handleCadence}
            disabled={saving === "cadence"}
          >
            <SelectTrigger className="h-8 text-xs w-[130px]" data-testid={`user-cadence-${row.type}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CADENCE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SavedBadge show={savedKeys.has("cadence")} />
        </div>
      </td>
      <td className="py-3 px-3 w-[80px] text-center">
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 px-2"
            disabled={saving === "reset"}
            onClick={handleReset}
            title="Revert to company default"
            data-testid={`reset-${row.type}`}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </td>
    </tr>
  );
}

// ── Section / category group ───────────────────────────────────────────────────
function CategoryGroup({
  category,
  rows,
  mode,
  onSaveCompany,
  onSaveUser,
  onResetUser,
}: {
  category: string;
  rows: NotifRow[];
  mode: "company" | "user";
  onSaveCompany: (type: string, patch: Record<string, unknown>) => Promise<void>;
  onSaveUser: (type: string, patch: Record<string, unknown>) => Promise<void>;
  onResetUser: (type: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-4 rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted text-sm font-semibold"
        data-testid={`category-toggle-${category}`}
      >
        <span className="flex items-center gap-2">
          <Badge className={`text-xs ${categoryColor(category)}`}>{category}</Badge>
          <span className="text-muted-foreground font-normal">{rows.length} type{rows.length !== 1 ? "s" : ""}</span>
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-muted-foreground text-xs">
                <th className="py-2 px-4 text-left font-medium w-[220px]">Notification</th>
                <th className="py-2 px-3 text-left font-medium w-[110px]">Category</th>
                <th className="py-2 px-3 text-center font-medium w-[90px]">
                  <div className="flex flex-col items-center">
                    <MonitorSmartphone className="h-3.5 w-3.5 mb-0.5" />
                    In-App
                  </div>
                </th>
                <th className="py-2 px-3 text-center font-medium w-[90px]">
                  <div className="flex flex-col items-center">
                    <Mail className="h-3.5 w-3.5 mb-0.5" />
                    Email
                  </div>
                </th>
                <th className="py-2 px-3 text-center font-medium w-[90px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <MessageSquare className="h-3.5 w-3.5 mb-0.5" />
                    <span className="flex items-center gap-0.5">
                      SMS
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px]">
                            SMS costs money per text. All types default to OFF.
                            Enable only the types that are worth the cost.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  </div>
                </th>
                <th className="py-2 px-3 text-center font-medium w-[90px]">
                  <div className="flex flex-col items-center">
                    <Smartphone className="h-3.5 w-3.5 mb-0.5" />
                    Push
                  </div>
                </th>
                <th className="py-2 px-4 text-left font-medium w-[160px]">Cadence</th>
                {mode === "user" && (
                  <th className="py-2 px-3 text-center font-medium w-[80px]"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                mode === "company" ? (
                  <CompanyRow key={r.type} row={r} onSave={onSaveCompany} />
                ) : (
                  <UserRow key={r.type} row={r} onSave={onSaveUser} onReset={onResetUser} />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function NotificationCenterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdminOrManager =
    user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;

  const { data: rows = [], isLoading, refetch } = useQuery<NotifRow[]>({
    queryKey: ["/api/notification-settings"],
  });

  // Group by category
  const grouped = (() => {
    const map = new Map<string, NotifRow[]>();
    for (const r of rows) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return CATEGORY_ORDER
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, rows: map.get(c)! }))
      .concat(
        [...map.entries()]
          .filter(([c]) => !CATEGORY_ORDER.includes(c))
          .map(([c, rs]) => ({ category: c, rows: rs }))
      );
  })();

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveCompany = async (type: string, patch: Record<string, unknown>) => {
    try {
      await apiRequest("PUT", `/api/notification-settings/company/${type}`, patch);
      qc.invalidateQueries({ queryKey: ["/api/notification-settings"] });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  const saveUser = async (type: string, rawPatch: Record<string, unknown>) => {
    // Map chan_X keys to the API's expected format
    const patch: Record<string, unknown> = {};
    if ("chan_in_app" in rawPatch) patch.chan_in_app = rawPatch.chan_in_app;
    if ("chan_email"  in rawPatch) patch.chan_email  = rawPatch.chan_email;
    if ("chan_sms"    in rawPatch) patch.chan_sms    = rawPatch.chan_sms;
    if ("chan_push"   in rawPatch) patch.chan_push   = rawPatch.chan_push;
    if ("cadence"     in rawPatch) patch.cadence    = rawPatch.cadence;
    try {
      await apiRequest("PUT", `/api/notification-settings/user/${type}`, patch);
      qc.invalidateQueries({ queryKey: ["/api/notification-settings"] });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  const resetUser = async (type: string) => {
    try {
      await apiRequest("DELETE", `/api/notification-settings/user/${type}`);
      qc.invalidateQueries({ queryKey: ["/api/notification-settings"] });
      toast({ title: "Reset to company default" });
    } catch (e: any) {
      toast({ title: "Failed to reset", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  // ── Payroll-ready trigger (Admin only) ───────────────────────────────────────
  const [payrollLabel, setPayrollLabel] = useState("");
  const [firingPayroll, setFiringPayroll] = useState(false);
  const firePayroll = async () => {
    setFiringPayroll(true);
    try {
      await apiRequest("POST", "/api/payroll/notify-ready", {
        period_label: payrollLabel || undefined,
      });
      toast({ title: "Payroll Ready notification sent to all Admin/Manager users" });
      setPayrollLabel("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setFiringPayroll(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notification Center</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Control which notifications are sent, on which channels, and how often.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="refresh-notif-settings">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* SMS Warning */}
      <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <strong className="text-amber-800 dark:text-amber-300">SMS defaults to OFF for all types.</strong>
          <span className="text-amber-700 dark:text-amber-400 ml-1">
            Each outbound text costs money. Enable SMS per notification only if the value justifies the cost.
            Actual sends are also gated by the <code className="font-mono text-xs">SMS_SENDING_LIVE</code> environment flag.
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={isAdminOrManager ? "company" : "mine"}>
        <TabsList className="mb-4">
          {isAdminOrManager && (
            <TabsTrigger value="company" data-testid="tab-company-defaults">
              Company Defaults
            </TabsTrigger>
          )}
          <TabsTrigger value="mine" data-testid="tab-my-preferences">
            My Preferences
          </TabsTrigger>
          {isAdminOrManager && (
            <TabsTrigger value="triggers" data-testid="tab-manual-triggers">
              Manual Triggers
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Company Defaults tab ─────────────────────────────────────────── */}
        {isAdminOrManager && (
          <TabsContent value="company">
            <div className="mb-3 text-sm text-muted-foreground flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              These are the organisation-wide defaults. Individual users can override them in "My Preferences".
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading notification types…</div>
            ) : (
              grouped.map(({ category, rows: catRows }) => (
                <CategoryGroup
                  key={category}
                  category={category}
                  rows={catRows}
                  mode="company"
                  onSaveCompany={saveCompany}
                  onSaveUser={saveUser}
                  onResetUser={resetUser}
                />
              ))
            )}
          </TabsContent>
        )}

        {/* ── My Preferences tab ──────────────────────────────────────────── */}
        <TabsContent value="mine">
          <div className="mb-3 text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            Your personal overrides. Where you haven't set one, the company default applies.
            <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">Custom</Badge>
            <span>= you have a personal override for that type.</span>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading notification types…</div>
          ) : (
            grouped.map(({ category, rows: catRows }) => (
              <CategoryGroup
                key={category}
                category={category}
                rows={catRows}
                mode="user"
                onSaveCompany={saveCompany}
                onSaveUser={saveUser}
                onResetUser={resetUser}
              />
            ))
          )}
        </TabsContent>

        {/* ── Manual Triggers tab ─────────────────────────────────────────── */}
        {isAdminOrManager && (
          <TabsContent value="triggers">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                <Info className="h-3.5 w-3.5" />
                Fire specific one-off notification triggers manually. Useful for announcements or testing.
                Sends respect the channel &amp; cadence settings above.
              </div>

              {/* Payroll Ready */}
              <div className="rounded-lg border border-border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold mb-1 flex items-center gap-2">
                      💰 Payroll Ready
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Financial
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Notifies all Admin and Manager users that payroll has been finalised and is ready for processing.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={payrollLabel}
                        onChange={(e) => setPayrollLabel(e.target.value)}
                        placeholder="Pay period label (e.g. July 1–15, 2026)"
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="payroll-period-label"
                      />
                      <Button
                        onClick={firePayroll}
                        disabled={firingPayroll}
                        data-testid="fire-payroll-ready"
                      >
                        {firingPayroll ? "Sending…" : "Send Notification"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Over Budget */}
              <div className="rounded-lg border border-border p-5">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  📊 Job Over Budget
                  <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    Operations
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  This trigger fires automatically when a job's logged material costs exceed the job's
                  set budget amount. To set a budget on a job, use:
                </p>
                <code className="block mt-2 text-xs font-mono bg-muted p-2 rounded">
                  PATCH /api/jobs/:id/budget-amount  {"{ amount: 12500 }"}
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  The notification fires once per 24 hours per job to avoid spam. All Admin/Manager users are notified.
                </p>
              </div>

              {/* Weather Delay */}
              <div className="rounded-lg border border-border p-5">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  🌧 Weather Delay
                  <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    Operations
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Mark a job as weather-delayed via the job detail page (Weather Delay button) or directly:
                </p>
                <code className="block mt-2 text-xs font-mono bg-muted p-2 rounded">
                  PATCH /api/jobs/:id/weather-delay  {"{ notify_customer: true, custom_message: \"optional\" }"}
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Notifies all Admin/Manager users in-app. With <code className="font-mono">notify_customer: true</code>,
                  also notifies the linked customer if they have a portal account.
                </p>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
