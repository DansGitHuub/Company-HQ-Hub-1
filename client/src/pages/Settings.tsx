import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
  User, Bell, BellOff, Globe, Palette, Shield, Save, Loader2, Lock, Eye, EyeOff, Check, Settings as SettingsIcon, Mail, Monitor, Sun, Moon
} from "lucide-react";
import { themes, getTheme, applyTheme, type ThemeId } from "@/lib/themes";

type SettingsSection = "profile" | "notifications" | "language" | "appearance" | "admin";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
  });

  const sections = [
    { id: "profile" as const, label: "Profile & Account", icon: User },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "language" as const, label: "Language & Display", icon: Globe },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    ...(isAdmin ? [{ id: "admin" as const, label: "Admin Settings", icon: Shield }] : []),
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
