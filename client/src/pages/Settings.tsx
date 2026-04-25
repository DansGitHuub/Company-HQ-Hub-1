import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User, Bell, BellOff, Globe, Shield, Save, Loader2, Lock, Eye, EyeOff, Check,
  Settings as SettingsIcon, Mail, Monitor, Sun, Moon, Layers, Tag, FileText, Building2,
  Plus, Pencil, Trash2, Link2, Link2Off, RefreshCw, CheckCircle, XCircle, AlertCircle,
  ArrowLeftRight, Info, Calendar, Clock,
} from "lucide-react";
type SettingsSection = "profile" | "notifications" | "language" | "work-areas" | "divisions" | "estimate-templates" | "company" | "quickbooks" | "terms" | "availability";

function TermsSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"install" | "maintenance" | "snow">("install");
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data: termsList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/settings/terms"],
    queryFn: () => apiRequest("GET", "/api/settings/terms").then(r => r.json()),
  });

  const activeRecord = termsList.find(t => t.type === activeTab);
  const content = editContent[activeTab] ?? activeRecord?.content ?? "";

  async function handleSave() {
    if (!activeRecord) return;
    setSaving(activeTab);
    try {
      await apiRequest("PUT", `/api/settings/terms/${activeRecord.id}`, { content });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/terms"] });
      toast({ title: t("settings.toast.termsSaved") });
    } catch {
      toast({ title: t("common.failedToSave"), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…</div>;

  const tabs: { key: "install" | "maintenance" | "snow"; label: string }[] = [
    { key: "install", label: "Install" },
    { key: "maintenance", label: "Maintenance" },
    { key: "snow", label: "Snow Removal" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Terms &amp; Conditions</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage the legal terms that appear on customer proposals and the portal acceptance page.</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            data-testid={`tc-tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{activeRecord?.title ?? "Terms & Conditions"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={content}
            onChange={e => setEditContent(prev => ({ ...prev, [activeTab]: e.target.value }))}
            className="min-h-[420px] font-mono text-xs"
            placeholder="Enter terms and conditions text…"
            data-testid={`tc-textarea-${activeTab}`}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving === activeTab}
              data-testid="btn-save-terms"
            >
              {saving === activeTab ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Terms</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Availability Section
// ═══════════════════════════════════════════════════════════════════════════════
const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABELS: Record<string, string> = {
  monday:"Monday",tuesday:"Tuesday",wednesday:"Wednesday",thursday:"Thursday",
  friday:"Friday",saturday:"Saturday",sunday:"Sunday",
};

function timeOptions() {
  const opts = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2,"0");
      const mm = String(m).padStart(2,"0");
      opts.push(`${hh}:${mm}`);
    }
  }
  return opts;
}

interface DaySlot { enabled: boolean; start: string; end: string; }
type WeekSchedule = Record<string, DaySlot>;

function defaultSchedule(): WeekSchedule {
  return Object.fromEntries(
    DAYS.map(d => [d, { enabled: d !== "saturday" && d !== "sunday", start: "08:00", end: "17:00" }])
  );
}

function AvailabilitySection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule());
  const [timezone, setTimezone] = useState("America/New_York");
  const [slotDuration, setSlotDuration] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/user/availability", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.schedule) setSchedule(data.schedule);
        if (data?.timezone) setTimezone(data.timezone);
        if (data?.slot_duration) setSlotDuration(data.slot_duration);
        if (data?.buffer_minutes != null) setBufferMinutes(data.buffer_minutes);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function toggleDay(day: string) {
    setSchedule(s => ({ ...s, [day]: { ...s[day], enabled: !s[day].enabled } }));
  }
  function setStart(day: string, val: string) {
    setSchedule(s => ({ ...s, [day]: { ...s[day], start: val } }));
  }
  function setEnd(day: string, val: string) {
    setSchedule(s => ({ ...s, [day]: { ...s[day], end: val } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/availability", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule, timezone, slot_duration: slotDuration, buffer_minutes: bufferMinutes }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("settings.toast.availabilitySaved") });
    } catch {
      toast({ title: t("common.failedToSave"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const times = timeOptions();

  return (
    <div className="space-y-5" data-testid="availability-section">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" /> Consultation Availability
            </CardTitle>
            <CardDescription>
              Set your available hours for the public booking calendar
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || !loaded} data-testid="btn-save-availability">
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-1" />{t("common.save")}</>}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {!loaded ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Slot Duration</Label>
                  <Select value={String(slotDuration)} onValueChange={v => setSlotDuration(Number(v))}>
                    <SelectTrigger data-testid="select-slot-duration"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[30,45,60,90,120].map(d => <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Buffer Between Appointments</Label>
                  <Select value={String(bufferMinutes)} onValueChange={v => setBufferMinutes(Number(v))}>
                    <SelectTrigger data-testid="select-buffer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0,15,30,45,60].map(b => <SelectItem key={b} value={String(b)}>{b === 0 ? "None" : `${b} min`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Weekly Schedule</Label>
                {DAYS.map(day => (
                  <div key={day} className="flex items-center gap-3" data-testid={`avail-row-${day}`}>
                    <Switch
                      checked={schedule[day]?.enabled ?? false}
                      onCheckedChange={() => toggleDay(day)}
                      data-testid={`toggle-${day}`}
                    />
                    <span className={`w-24 text-sm font-medium ${!schedule[day]?.enabled ? "text-muted-foreground" : ""}`}>
                      {DAY_LABELS[day]}
                    </span>
                    {schedule[day]?.enabled ? (
                      <>
                        <Select value={schedule[day]?.start || "08:00"} onValueChange={v => setStart(day, v)}>
                          <SelectTrigger className="w-28 h-8 text-sm" data-testid={`start-${day}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-48">
                            {times.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground text-sm">to</span>
                        <Select value={schedule[day]?.end || "17:00"} onValueChange={v => setEnd(day, v)}>
                          <SelectTrigger className="w-28 h-8 text-sm" data-testid={`end-${day}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-48">
                            {times.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">{t("common.unavailable")}</span>
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Your Booking Page
                </Label>
                <p className="text-xs text-muted-foreground">
                  Share this link with customers to let them book a consultation directly on your calendar.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/book/${(user as any)?.username || "your-username"}`}
                    className="font-mono text-xs"
                    data-testid="input-booking-url"
                  />
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/book/${(user as any)?.username || ""}`);
                      toast({ title: t("common.linkCopied") });
                    }}
                    data-testid="btn-copy-booking-link"
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";
  const isAdminOrManager = isAdmin || user?.role === "Manager";

  // Handle ?tab=quickbooks from OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") as SettingsSection | null;
  const qbParam  = urlParams.get("qb");
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    tabParam && ["quickbooks","company","work-areas","divisions","estimate-templates","terms"].includes(tabParam)
      ? tabParam
      : "profile"
  );

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
  });

  const sections = [
    { id: "profile" as const, label: "Profile & Account", icon: User },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "language" as const, label: "Language & Display", icon: Globe },
    { id: "availability" as const, label: "Availability", icon: Calendar },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4" data-testid="settings-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-settings-title">
          <SettingsIcon className="h-6 w-6" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-56 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`settings-nav-${s.id}`}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {activeSection === "profile" && <ProfileSection profile={profile} />}
          {activeSection === "notifications" && <NotificationsSection profile={profile} />}
          {activeSection === "language" && <LanguageSection profile={profile} />}
          {activeSection === "availability" && <AvailabilitySection />}
          {activeSection === "work-areas" && isAdminOrManager && <WorkAreasSection />}
          {activeSection === "company" && isAdminOrManager && <CompanyInfoSection />}
          {(["divisions", "estimate-templates", "quickbooks", "terms"] as const).includes(activeSection as any) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 flex gap-3 items-start">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">{t("settings.movedToAdminPanel")}</p>
                <p className="text-sm text-blue-700">
                  Company-wide settings — <span className="font-medium">Divisions, Estimate Templates, QuickBooks,</span> and <span className="font-medium">Terms &amp; Conditions</span> — are now managed in <span className="font-medium">Admin Panel → Company Settings</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ profile }: { profile: any }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [fullName, setFullName] = useState(profile?.name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: t("settings.toast.profileUpdated") });
    },
    onError: () => toast({ title: t("settings.toast.failedToUpdateProfile"), variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("settings.toast.passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    },
    onError: () => toast({ title: t("settings.toast.failedToChangePassword"), variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> {t("settings.profileInformation")}</CardTitle>
          <CardDescription>{t("settings.updatePersonalDetails")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("common.fullName")}</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="input-settings-fullname" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-settings-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("common.phone")}</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-settings-phone" />
            </div>
            <div className="space-y-2">
              <Label>{t("common.role")}</Label>
              <div className="flex items-center h-10">
                <Badge variant="outline">{user?.isMasterAdmin ? "Master Admin" : (user?.role || "")}</Badge>
              </div>
            </div>
          </div>
          <Button
            onClick={() => updateProfileMutation.mutate({ name: fullName, email, phone })}
            disabled={updateProfileMutation.isPending}
            data-testid="button-save-profile"
          >
            {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("settings.saveChanges")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Password</CardTitle>
          <CardDescription>{t("settings.changeAccountPassword")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button variant="outline" onClick={() => setShowPasswordForm(true)} data-testid="button-change-password">
              <Lock className="h-4 w-4 mr-2" /> {t("settings.changePassword")}
            </Button>
          ) : (
            <div className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label>{t("settings.currentPassword")}</Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    data-testid="input-current-password"
                  />
                  <button className="absolute right-2 top-2.5 text-muted-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("settings.newPassword")}</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                  <button className="absolute right-2 top-2.5 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("settings.confirmNewPassword")}</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (newPassword !== confirmPassword) {
                      toast({ title: t("common.passwordsDontMatch"), variant: "destructive" });
                      return;
                    }
                    changePasswordMutation.mutate({ currentPassword, newPassword });
                  }}
                  disabled={changePasswordMutation.isPending || !currentPassword || !newPassword}
                  data-testid="button-submit-password"
                >
                  {changePasswordMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Update Password
                </Button>
                <Button variant="ghost" onClick={() => setShowPasswordForm(false)}>{t("common.cancel")}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationsSection({ profile }: { profile: any }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [emailNotifs, setEmailNotifs] = useState(profile?.emailNotifications !== false);

  useEffect(() => {
    setEmailNotifs(profile?.emailNotifications !== false);
  }, [profile?.emailNotifications]);

  const toggle = (field: string, value: boolean) => {
    apiRequest("PATCH", "/api/profile", { [field]: value }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: value ? "Enabled" : "Disabled" });
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notification Preferences</CardTitle>
          <CardDescription>{t("settings.chooseNotifications")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Mail className="h-4 w-4" /> Email Notifications
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.emailAlerts")}</p>
            </div>
            <Switch
              checked={emailNotifs}
              onCheckedChange={(val) => {
                setEmailNotifs(val);
                toggle("emailNotifications", val);
              }}
              data-testid="switch-email-notifications"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LanguageSection({ profile }: { profile: any }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [language, setLanguage] = useState(profile?.language || "en");

  useEffect(() => {
    setLanguage(profile?.language || "en");
  }, [profile?.language]);

  const handleLanguageChange = (val: string) => {
    setLanguage(val);
    i18n.changeLanguage(val);
    apiRequest("PATCH", "/api/profile", { language: val }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: val === "en" ? "Language set to English" : "Idioma cambiado a Español" });
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Language</CardTitle>
          <CardDescription>{t("settings.choosePreferredLanguage")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label>{t("settings.displayLanguage")}</Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger data-testid="select-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">🇺🇸 English</SelectItem>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DIVISIONS_LIST = ["Maintenance", "Install", "Snow", "General"] as const;
const TEMPLATE_TYPES = [
  "Maintenance Contract", "Landscape Project", "Snow & Ice Contract", "Custom",
];
const DIV_COLORS_DEFAULT: Record<string, string> = {
  Maintenance: "#22c55e", Install: "#3b82f6", Snow: "#94a3b8", General: "#f59e0b",
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Work Areas Section
// ═══════════════════════════════════════════════════════════════════════════════
interface WorkAreaType {
  id: string; name: string; division: string | null; is_active: boolean; sort_order: number;
}

function WorkAreasSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkAreaType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkAreaType | null>(null);
  const emptyForm = { name: "", division: "Maintenance", is_active: true, sort_order: 0 };
  const [form, setForm] = useState(emptyForm);

  const { data: workAreas = [], isLoading } = useQuery<WorkAreaType[]>({
    queryKey: ["/api/work-area-types?all=true"],
    queryFn: () => fetch("/api/work-area-types?all=true", { credentials: "include" }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => apiRequest("POST", "/api/work-area-types", d),
    onSuccess: () => { toast({ title: t("settings.toast.workAreaCreated") }); invalidateWA(); closeModal(); },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) =>
      apiRequest("PUT", `/api/work-area-types/${id}`, d),
    onSuccess: () => { toast({ title: t("settings.toast.workAreaUpdated") }); invalidateWA(); closeModal(); },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/work-area-types/${id}`),
    onSuccess: () => { toast({ title: t("common.deletedSuccessfully") }); invalidateWA(); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: t("common.cannotDelete"), description: e.message, variant: "destructive" }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiRequest("PUT", `/api/work-area-types/${id}`, { is_active }),
    onSuccess: () => invalidateWA(),
  });

  function invalidateWA() {
    qc.invalidateQueries({ queryKey: ["/api/work-area-types?all=true"] });
    qc.invalidateQueries({ queryKey: ["/api/work-area-types"] });
  }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(wa: WorkAreaType) {
    setEditing(wa);
    setForm({ name: wa.name, division: wa.division || "Maintenance", is_active: wa.is_active, sort_order: wa.sort_order });
    setModalOpen(true);
  }
  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) updateMut.mutate({ id: editing.id, d: form });
    else createMut.mutate(form);
  }

  const grouped = DIVISIONS_LIST.reduce<Record<string, WorkAreaType[]>>((acc, div) => {
    acc[div] = workAreas.filter(wa => (wa.division || "General") === div);
    return acc;
  }, {} as any);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-5 w-5" /> Work Area Types</CardTitle>
            <CardDescription>{t("settings.workAreasSubtext")}</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd} data-testid="btn-add-work-area">
            <Plus className="h-4 w-4 mr-1" /> Add Work Area
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <Table data-testid="work-areas-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.division")}</TableHead>
                  <TableHead className="w-20">{t("common.active")}</TableHead>
                  <TableHead className="w-20">{t("common.sort")}</TableHead>
                  <TableHead className="w-20 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DIVISIONS_LIST.flatMap((div) => {
                  const items = grouped[div] || [];
                  if (items.length === 0) return [];
                  return [
                    <TableRow key={`hdr-${div}`} className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={5} className="py-1.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        {div}
                      </TableCell>
                    </TableRow>,
                    ...items.map(wa => (
                      <TableRow key={wa.id} data-testid={`wa-row-${wa.id}`}>
                        <TableCell className="font-medium">{wa.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: DIV_COLORS_DEFAULT[wa.division || ""] || "#e5e7eb" }}>
                            {wa.division || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch checked={wa.is_active}
                            data-testid={`toggle-wa-${wa.id}`}
                            onCheckedChange={v => toggleMut.mutate({ id: wa.id, is_active: v })} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{wa.sort_order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(wa)} data-testid={`btn-edit-wa-${wa.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(wa)} data-testid={`btn-delete-wa-${wa.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )),
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={o => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Work Area" : "Add Work Area"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t("common.name")}</Label>
              <Input data-testid="input-wa-name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mulch Beds" />
            </div>
            <div className="space-y-1">
              <Label>{t("common.division")}</Label>
              <Select value={form.division} onValueChange={v => setForm(f => ({ ...f, division: v }))}>
                <SelectTrigger data-testid="select-wa-division"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIVISIONS_LIST.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("common.sortOrder")}</Label>
              <Input type="number" data-testid="input-wa-sort" value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} data-testid="switch-wa-active"
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t("common.active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>{t("common.cancel")}</Button>
            <Button data-testid="btn-save-wa" onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? t("settings.savingDots") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>{t("common.thisCannotBeUndone")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Divisions Section
// ═══════════════════════════════════════════════════════════════════════════════
function DivisionsSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: setting } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/settings/division_colors"],
  });

  const parsed: Record<string, string> = setting?.value
    ? (() => { try { return JSON.parse(setting.value); } catch { return DIV_COLORS_DEFAULT; } })()
    : DIV_COLORS_DEFAULT;

  const [colors, setColors] = useState<Record<string, string>>(parsed);

  useEffect(() => {
    if (setting?.value) {
      try { setColors(JSON.parse(setting.value)); } catch {}
    }
  }, [setting?.value]);

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/settings/division_colors", { value: JSON.stringify(colors) }),
    onSuccess: () => {
      toast({ title: t("settings.toast.divisionColorsSaved") });
      qc.invalidateQueries({ queryKey: ["/api/settings/division_colors"] });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Tag className="h-5 w-5" /> Division Colors</CardTitle>
          <CardDescription>Color coding used across jobs, scheduling, and estimates</CardDescription>
        </div>
        <Button size="sm" data-testid="btn-save-divisions" onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}>
          {saveMut.isPending ? t("settings.savingDots") : t("settings.saveChanges")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {DIVISIONS_LIST.map(div => (
          <div key={div} className="flex items-center gap-4" data-testid={`division-row-${div}`}>
            <div className="w-8 h-8 rounded-full border border-border shrink-0"
              style={{ backgroundColor: colors[div] || "#e5e7eb" }} />
            <span className="w-32 font-medium">{div}</span>
            <Input type="color" className="w-14 h-9 p-1 cursor-pointer"
              value={colors[div] || "#000000"} data-testid={`color-input-${div}`}
              onChange={e => setColors(c => ({ ...c, [div]: e.target.value }))} />
            <Input className="w-28 font-mono text-sm" value={colors[div] || ""}
              data-testid={`color-hex-${div}`}
              onChange={e => setColors(c => ({ ...c, [div]: e.target.value }))} placeholder="#000000" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Estimate Templates Section
// ═══════════════════════════════════════════════════════════════════════════════
interface EstimateTemplate {
  id: string; name: string; estimate_type: string | null;
  default_customer_message: string | null; default_terms: string | null; is_active: boolean;
}

function EstimateTemplatesSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EstimateTemplate | null>(null);
  const emptyForm = { name: "", estimate_type: "Custom", default_customer_message: "", default_terms: "", is_active: true };
  const [form, setForm] = useState(emptyForm);

  const { data: templates = [], isLoading } = useQuery<EstimateTemplate[]>({
    queryKey: ["/api/estimate-templates?all=true"],
    queryFn: () => fetch("/api/estimate-templates?all=true", { credentials: "include" }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => apiRequest("POST", "/api/estimate-templates", d),
    onSuccess: () => { toast({ title: t("settings.toast.templateCreated") }); invalidateT(); closeModal(); },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) =>
      apiRequest("PUT", `/api/estimate-templates/${id}`, d),
    onSuccess: () => { toast({ title: t("settings.toast.templateUpdated") }); invalidateT(); closeModal(); },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/estimate-templates/${id}`),
    onSuccess: () => { toast({ title: t("common.deletedSuccessfully") }); invalidateT(); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  function invalidateT() {
    qc.invalidateQueries({ queryKey: ["/api/estimate-templates?all=true"] });
    qc.invalidateQueries({ queryKey: ["/api/estimate-templates"] });
  }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(t: EstimateTemplate) {
    setEditing(t);
    setForm({ name: t.name, estimate_type: t.estimate_type || "Custom",
      default_customer_message: t.default_customer_message || "",
      default_terms: t.default_terms || "", is_active: t.is_active });
    setModalOpen(true);
  }
  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) updateMut.mutate({ id: editing.id, d: form });
    else createMut.mutate(form);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" /> {t("settings.estimateTemplatesHeader")}</CardTitle>
            <CardDescription>{t("settings.estimateTemplatesSubtext")}</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd} data-testid="btn-add-template">
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("settings.noTemplatesYet")}</div>
          ) : (
            <Table data-testid="templates-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead className="w-24">{t("common.status")}</TableHead>
                  <TableHead className="w-20 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(tpl => (
                  <TableRow key={tpl.id} data-testid={`template-row-${tpl.id}`}>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{tpl.estimate_type || "—"}</Badge></TableCell>
                    <TableCell>
                      {tpl.is_active
                        ? <Badge className="bg-green-100 text-green-700 text-xs">{t("common.active")}</Badge>
                        : <Badge variant="secondary" className="text-xs">{t("common.inactive")}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)}
                          data-testid={`btn-edit-template-${tpl.id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(tpl)}
                          data-testid={`btn-delete-template-${tpl.id}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={o => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Template" : "New Estimate Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t("settings.templateName")}</Label>
              <Input data-testid="input-template-name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Cleanup" />
            </div>
            <div className="space-y-1">
              <Label>{t("common.type")}</Label>
              <Select value={form.estimate_type} onValueChange={v => setForm(f => ({ ...f, estimate_type: v }))}>
                <SelectTrigger data-testid="select-template-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("settings.defaultCustomerMessage")}</Label>
              <Textarea rows={3} data-testid="input-template-message" value={form.default_customer_message}
                onChange={e => setForm(f => ({ ...f, default_customer_message: e.target.value }))}
                placeholder="Thank you for the opportunity…" />
            </div>
            <div className="space-y-1">
              <Label>{t("settings.defaultTerms")}</Label>
              <Textarea rows={3} data-testid="input-template-terms" value={form.default_terms}
                onChange={e => setForm(f => ({ ...f, default_terms: e.target.value }))}
                placeholder="Payment due upon completion…" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} data-testid="switch-template-active"
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t("common.active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>{t("common.cancel")}</Button>
            <Button data-testid="btn-save-template" onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? t("settings.savingDots") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>{t("common.thisCannotBeUndone")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Company Info Section
// ═══════════════════════════════════════════════════════════════════════════════
interface CompanyInfo {
  name: string; phone: string; email: string; address: string;
  website: string; tax_rate: string; payment_terms: string;
}

function CompanyInfoSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: setting } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/settings/company_info"],
  });

  const empty: CompanyInfo = {
    name: "", phone: "", email: "", address: "", website: "", tax_rate: "0", payment_terms: "Net 30",
  };
  const [form, setForm] = useState<CompanyInfo>(empty);

  useEffect(() => {
    if (setting?.value) {
      try { setForm({ ...empty, ...JSON.parse(setting.value) }); } catch {}
    }
  }, [setting?.value]);

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/settings/company_info", { value: JSON.stringify(form) }),
    onSuccess: () => {
      toast({ title: t("settings.toast.companyInfoSaved") });
      qc.invalidateQueries({ queryKey: ["/api/settings/company_info"] });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="max-w-2xl">
      <CardHeader className="py-4">
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5" /> {t("settings.companyInfoHeader")}</CardTitle>
        <CardDescription>Defaults used across estimates, invoices, and communications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="ci-name">{t("settings.companyName")}</Label>
          <Input id="ci-name" data-testid="input-ci-name" value={form.name}
            placeholder="Chapin Landscapes" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="ci-phone">{t("common.phone")}</Label>
            <Input id="ci-phone" type="tel" data-testid="input-ci-phone" value={form.phone}
              placeholder="(555) 000-0000" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ci-email">{t("common.email")}</Label>
            <Input id="ci-email" type="email" data-testid="input-ci-email" value={form.email}
              placeholder="info@company.com" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-address">{t("common.address")}</Label>
          <Input id="ci-address" data-testid="input-ci-address" value={form.address}
            placeholder="123 Main St, City, State 00000" onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-website">{t("common.website")}</Label>
          <Input id="ci-website" type="url" data-testid="input-ci-website" value={form.website}
            placeholder="https://company.com" onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="ci-tax">Default Tax Rate (%)</Label>
            <Input id="ci-tax" type="number" min="0" max="100" step="0.01"
              data-testid="input-ci-tax_rate" value={form.tax_rate}
              onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ci-terms">{t("settings.defaultPaymentTerms")}</Label>
            <Input id="ci-terms" data-testid="input-ci-payment_terms" value={form.payment_terms}
              placeholder="Net 30" onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} />
          </div>
        </div>
        <div className="pt-2">
          <Button data-testid="btn-save-company" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />{t("settings.saveCompanyInfo")}</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

//  QuickBooks Section
// ═══════════════════════════════════════════════════════════════════════════════
function QuickBooksSection({ qbParam }: { qbParam: string | null }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();

  useEffect(() => {
    if (qbParam === "connected") toast({ title: t("settings.toast.qboConnected") });
    if (qbParam === "error") toast({ title: t("settings.toast.qboConnectionFailed"), description: t("common.pleaseTryAgain"), variant: "destructive" });
    if (qbParam === "not-configured") toast({ title: "QuickBooks not configured", description: t("common.qboConfigMissing"), variant: "destructive" });
  }, [qbParam]);

  const { data: qbConfig } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/quickbooks/config"],
    queryFn: () => apiRequest("GET", "/api/quickbooks/config").then(r => r.json()),
  });

  const { data: status, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/quickbooks/status"],
    refetchInterval: 30000,
    enabled: qbConfig?.configured === true,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/quickbooks/sync/logs"],
    enabled: status?.connected === true,
  });

  const disconnectMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/quickbooks/disconnect"),
    onSuccess: () => {
      toast({ title: "QuickBooks disconnected" });
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/sync/logs"] });
    },
    onError: () => toast({ title: "Disconnect failed", variant: "destructive" }),
  });

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiRequest("POST", "/api/quickbooks/sync");
      const data = await res.json();
      setSyncResult(data);
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/sync/logs"] });
      toast({ title: "Sync complete" });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return "Never";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function logStatusBadge(s: string) {
    if (s === "success") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />{t("common.success")}</span>;
    if (s === "partial") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700"><AlertCircle className="h-3 w-3" />{t("common.partial")}</span>;
    if (s === "error")   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600"><XCircle className="h-3 w-3" />{t("common.error")}</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"><RefreshCw className="h-3 w-3 animate-spin" />{t("common.running")}</span>;
  }

  return (
    <div className="space-y-5" data-testid="quickbooks-section">
      {/* Connection Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-5 w-5 text-[#2CA01C]" />
            {t("settings.qboHeader")}
          </CardTitle>
          <CardDescription>
            {t("settings.qboSubtext")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qbConfig?.configured === false ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20">
                <div className="p-2 rounded-full bg-amber-100 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-amber-700">{t("settings.qboCredentialsNotConfigured")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set <code className="bg-muted px-1 rounded text-xs">QB_CLIENT_ID</code> and{" "}
                    <code className="bg-muted px-1 rounded text-xs">QB_CLIENT_SECRET</code> environment variables,
                    then restart the server to enable QuickBooks integration.
                  </p>
                </div>
              </div>
            </div>
          ) : statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              {/* Connected state */}
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
                <div className="p-2 rounded-full bg-green-100 text-green-700">
                  <Link2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-green-700">{t("settings.connectedToQbo")}</p>
                  <p className="text-xs text-muted-foreground">
                    Realm: {status.realm_id} · Last sync: {fmtDate(status.last_sync)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  data-testid="btn-qb-sync"
                >
                  {syncing
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing…</>
                    : <><RefreshCw className="h-4 w-4 mr-2" />{t("settings.syncNow")}</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                  data-testid="btn-qb-disconnect"
                >
                  <Link2Off className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>

              {/* Sync result summary */}
              {syncResult?.results && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {Object.entries(syncResult.results).map(([entity, r]: [string, any]) => (
                    <div key={entity} className="p-3 rounded-lg border bg-muted/30 text-center">
                      <p className="text-xs font-medium capitalize text-muted-foreground">{entity}</p>
                      <p className="text-xl font-bold mt-1">{r.synced}</p>
                      <p className="text-[10px] text-muted-foreground">synced</p>
                      {r.errors?.length > 0 && (
                        <p className="text-[10px] text-destructive mt-0.5">{r.errors.length} error{r.errors.length !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="p-2 rounded-full bg-muted text-muted-foreground">
                  <Link2Off className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t("settings.notConnected")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.qboConnectSubtext")}</p>
                </div>
              </div>
              <Button
                onClick={() => { window.location.href = "/api/quickbooks/auth"; }}
                className="bg-[#2CA01C] hover:bg-[#238016] text-white"
                data-testid="btn-qb-connect"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Connect to QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Capabilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("settings.whatGetsSynced")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "Customers", push: "New local customers → QB", pull: "New QB customers → local", icon: "👤" },
              { name: "Invoices",  push: "Sent invoices → QB",       pull: "QB invoice statuses → local", icon: "📄" },
              { name: "Payments",  push: "—",                         pull: "QB payments mark invoices paid", icon: "💳" },
            ].map(item => (
              <div key={item.name} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <span>{item.icon}</span> {item.name}
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <span className="text-green-600 font-bold mt-0.5">↑</span> {item.push}
                  </div>
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <span className="text-blue-600 font-bold mt-0.5">↓</span> {item.pull}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync Log */}
      {status?.connected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("settings.syncHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t("settings.noSyncHistoryYet")}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="qb-sync-log-table">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>{t("common.entity")}</TableHead>
                      <TableHead>{t("common.direction")}</TableHead>
                      <TableHead>{t("common.records")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("common.started")}</TableHead>
                      <TableHead>{t("common.duration")}</TableHead>
                      <TableHead>{t("common.errors")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any) => {
                      const duration = log.completed_at
                        ? `${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                        : "—";
                      return (
                        <TableRow key={log.id} data-testid={`qb-log-row-${log.id}`}>
                          <TableCell className="capitalize text-sm font-medium">{log.entity_type}</TableCell>
                          <TableCell className="text-sm capitalize text-muted-foreground">{log.direction}</TableCell>
                          <TableCell className="text-sm font-mono">{log.records_synced}</TableCell>
                          <TableCell>{logStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(log.started_at)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{duration}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={log.errors ?? ""}>
                            {log.errors ?? "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
    </div>
  );
}
