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
  User, Bell, BellOff, Globe, Palette, Shield, Save, Loader2, Lock, Eye, EyeOff, Check,
  Settings as SettingsIcon, Mail, Monitor, Sun, Moon, Layers, Tag, FileText, Building2,
  Plus, Pencil, Trash2,
} from "lucide-react";
import { themes, getTheme, applyTheme, type ThemeId } from "@/lib/themes";

type SettingsSection = "profile" | "notifications" | "language" | "appearance" | "admin" | "work-areas" | "divisions" | "estimate-templates" | "company";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";
  const isAdminOrManager = isAdmin || user?.role === "Manager";

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
  });

  const sections = [
    { id: "profile" as const, label: "Profile & Account", icon: User },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "language" as const, label: "Language & Display", icon: Globe },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    ...(isAdmin ? [{ id: "admin" as const, label: "Admin Settings", icon: Shield }] : []),
    ...(isAdminOrManager ? [
      { id: "work-areas" as const, label: "Work Areas", icon: Layers },
      { id: "divisions" as const, label: "Divisions", icon: Tag },
      { id: "estimate-templates" as const, label: "Estimate Templates", icon: FileText },
      { id: "company" as const, label: "Company Info", icon: Building2 },
    ] : []),
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
        <p className="text-muted-foreground mt-1">Manage your account preferences and application settings</p>
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
          {activeSection === "appearance" && <AppearanceSection />}
          {activeSection === "admin" && isAdmin && <AdminSection />}
          {activeSection === "work-areas" && isAdminOrManager && <WorkAreasSection />}
          {activeSection === "divisions" && isAdminOrManager && <DivisionsSection />}
          {activeSection === "estimate-templates" && isAdminOrManager && <EstimateTemplatesSection />}
          {activeSection === "company" && isAdminOrManager && <CompanyInfoSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ profile }: { profile: any }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName || "");
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
      setFullName(profile.fullName || "");
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
      toast({ title: "Profile updated" });
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    },
    onError: () => toast({ title: "Failed to change password", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="input-settings-fullname" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-settings-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-settings-phone" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center h-10">
                <Badge variant="outline">{user?.role}</Badge>
              </div>
            </div>
          </div>
          <Button
            onClick={() => updateProfileMutation.mutate({ fullName, email, phone })}
            disabled={updateProfileMutation.isPending}
            data-testid="button-save-profile"
          >
            {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button variant="outline" onClick={() => setShowPasswordForm(true)} data-testid="button-change-password">
              <Lock className="h-4 w-4 mr-2" /> Change Password
            </Button>
          ) : (
            <div className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label>Current Password</Label>
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
                <Label>New Password</Label>
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
                <Label>Confirm New Password</Label>
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
                      toast({ title: "Passwords don't match", variant: "destructive" });
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
                <Button variant="ghost" onClick={() => setShowPasswordForm(false)}>Cancel</Button>
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
          <CardDescription>Choose how you want to be notified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Mail className="h-4 w-4" /> Email Notifications
              </div>
              <p className="text-xs text-muted-foreground">Receive email alerts for messages and updates</p>
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
          <CardDescription>Choose your preferred language</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label>Display Language</Label>
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

function AppearanceSection() {
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(() => {
    return (localStorage.getItem("selectedTheme") as ThemeId) || "default";
  });

  const handleThemeChange = (themeId: ThemeId) => {
    setSelectedTheme(themeId);
    const theme = getTheme(themeId);
    applyTheme(theme);
    localStorage.setItem("selectedTheme", themeId);
    toast({ title: `Theme changed to ${theme.name}` });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Theme</CardTitle>
          <CardDescription>Choose a visual theme for the application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                  selectedTheme === theme.id ? "border-primary ring-2 ring-primary/20" : "border-muted hover:border-foreground/20"
                }`}
                data-testid={`theme-option-${theme.id}`}
              >
                <div
                  className="w-full h-8 rounded-md mb-2 flex gap-1 overflow-hidden"
                >
                  <div className="flex-1 h-full" style={{ background: `hsl(${theme.colors.primary})` }} />
                  <div className="flex-1 h-full" style={{ background: `hsl(${theme.colors.accent})` }} />
                  <div className="flex-1 h-full" style={{ background: `hsl(${theme.colors.sidebar})` }} />
                </div>
                <p className="text-sm font-medium">{theme.name}</p>
                {selectedTheme === theme.id && (
                  <div className="absolute top-1 right-1">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Admin Settings</CardTitle>
          <CardDescription>Administrative configuration options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border bg-muted/30 text-center">
            <Shield className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="font-medium text-sm">Admin settings are managed from the Admin Panel</p>
            <p className="text-xs text-muted-foreground mt-1">Company branding, user management, and system configuration are available in the Admin Panel.</p>
            <a href="/admin" className="text-xs text-primary hover:underline mt-2 inline-block" data-testid="link-admin-panel">
              Go to Admin Panel →
            </a>
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
    onSuccess: () => { toast({ title: "Work area created" }); invalidateWA(); closeModal(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) =>
      apiRequest("PUT", `/api/work-area-types/${id}`, d),
    onSuccess: () => { toast({ title: "Work area updated" }); invalidateWA(); closeModal(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/work-area-types/${id}`),
    onSuccess: () => { toast({ title: "Deleted" }); invalidateWA(); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
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
            <CardDescription>Manage the catalog of work area types for job tracking</CardDescription>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead className="w-20">Active</TableHead>
                  <TableHead className="w-20">Sort</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
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
              <Label>Name</Label>
              <Input data-testid="input-wa-name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mulch Beds" />
            </div>
            <div className="space-y-1">
              <Label>Division</Label>
              <Select value={form.division} onValueChange={v => setForm(f => ({ ...f, division: v }))}>
                <SelectTrigger data-testid="select-wa-division"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIVISIONS_LIST.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sort Order</Label>
              <Input type="number" data-testid="input-wa-sort" value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} data-testid="switch-wa-active"
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button data-testid="btn-save-wa" onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>Delete</AlertDialogAction>
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
      toast({ title: "Division colors saved" });
      qc.invalidateQueries({ queryKey: ["/api/settings/division_colors"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
          {saveMut.isPending ? "Saving…" : "Save Changes"}
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
    onSuccess: () => { toast({ title: "Template created" }); invalidateT(); closeModal(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) =>
      apiRequest("PUT", `/api/estimate-templates/${id}`, d),
    onSuccess: () => { toast({ title: "Template updated" }); invalidateT(); closeModal(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/estimate-templates/${id}`),
    onSuccess: () => { toast({ title: "Deleted" }); invalidateT(); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" /> Estimate Templates</CardTitle>
            <CardDescription>Pre-built templates for the estimate form</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd} data-testid="btn-add-template">
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No templates yet</div>
          ) : (
            <Table data-testid="templates-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id} data-testid={`template-row-${t.id}`}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{t.estimate_type || "—"}</Badge></TableCell>
                    <TableCell>
                      {t.is_active
                        ? <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                        : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}
                          data-testid={`btn-edit-template-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(t)}
                          data-testid={`btn-delete-template-${t.id}`}><Trash2 className="h-4 w-4" /></Button>
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
              <Label>Template Name</Label>
              <Input data-testid="input-template-name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Cleanup" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.estimate_type} onValueChange={v => setForm(f => ({ ...f, estimate_type: v }))}>
                <SelectTrigger data-testid="select-template-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Customer Message</Label>
              <Textarea rows={3} data-testid="input-template-message" value={form.default_customer_message}
                onChange={e => setForm(f => ({ ...f, default_customer_message: e.target.value }))}
                placeholder="Thank you for the opportunity…" />
            </div>
            <div className="space-y-1">
              <Label>Default Terms</Label>
              <Textarea rows={3} data-testid="input-template-terms" value={form.default_terms}
                onChange={e => setForm(f => ({ ...f, default_terms: e.target.value }))}
                placeholder="Payment due upon completion…" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} data-testid="switch-template-active"
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button data-testid="btn-save-template" onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>Delete</AlertDialogAction>
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
      toast({ title: "Company info saved" });
      qc.invalidateQueries({ queryKey: ["/api/settings/company_info"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="max-w-2xl">
      <CardHeader className="py-4">
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5" /> Company Information</CardTitle>
        <CardDescription>Defaults used across estimates, invoices, and communications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="ci-name">Company Name</Label>
          <Input id="ci-name" data-testid="input-ci-name" value={form.name}
            placeholder="Chapin Landscapes" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="ci-phone">Phone</Label>
            <Input id="ci-phone" type="tel" data-testid="input-ci-phone" value={form.phone}
              placeholder="(555) 000-0000" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ci-email">Email</Label>
            <Input id="ci-email" type="email" data-testid="input-ci-email" value={form.email}
              placeholder="info@company.com" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-address">Address</Label>
          <Input id="ci-address" data-testid="input-ci-address" value={form.address}
            placeholder="123 Main St, City, State 00000" onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-website">Website</Label>
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
            <Label htmlFor="ci-terms">Default Payment Terms</Label>
            <Input id="ci-terms" data-testid="input-ci-payment_terms" value={form.payment_terms}
              placeholder="Net 30" onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} />
          </div>
        </div>
        <div className="pt-2">
          <Button data-testid="btn-save-company" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Company Info</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
