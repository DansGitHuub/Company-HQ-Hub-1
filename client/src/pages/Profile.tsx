import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, Save, User, Mail, Phone, FileText, Palette, Check, Lock, Eye, EyeOff, Bell, BellOff, Volume2, VolumeX, Mic, Play, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { themes, getTheme, applyTheme, type ThemeId } from "@/lib/themes";

function EmailNotificationToggle({ profile }: { profile: any }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(profile?.emailNotifications !== false);

  useEffect(() => {
    setEnabled(profile?.emailNotifications !== false);
  }, [profile?.emailNotifications]);

  return (
    <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
      <Label className="flex items-center gap-2">
        <Bell className="h-4 w-4" /> {t("profile.emailNotifications")}
      </Label>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("profile.emailNotificationsDesc")}
        </p>
        <Button
          type="button"
          variant={enabled ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => {
            const newValue = !enabled;
            setEnabled(newValue);
            apiRequest("PATCH", "/api/profile", { emailNotifications: newValue }).then(() => {
              queryClient.invalidateQueries({ queryKey: ["/api/user"] });
              queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
              toast({ title: newValue ? "Email notifications enabled" : "Email notifications disabled" });
            });
          }}
          data-testid="button-toggle-email-notifications"
        >
          {enabled ? (
            <><Bell className="h-4 w-4" /> On</>
          ) : (
            <><BellOff className="h-4 w-4" /> Off</>
          )}
        </Button>
      </div>
    </div>
  );
}

const VOICE_OPTIONS = [
  { value: "alloy", label: "Alloy", description: "Neutral, balanced" },
  { value: "echo", label: "Echo", description: "Male, conversational" },
  { value: "fable", label: "Fable", description: "Male, expressive" },
  { value: "onyx", label: "Onyx", description: "Male, deep" },
  { value: "nova", label: "Nova", description: "Female, warm" },
  { value: "shimmer", label: "Shimmer", description: "Female, clear" },
];

function VoiceSettingsSection() {
  const { toast } = useToast();
  const [isPreviewing, setIsPreviewing] = useState(false);

  const { data: voiceSettings, isLoading } = useQuery({
    queryKey: ["/api/users/voice-settings"],
    queryFn: async () => {
      const res = await fetch("/api/users/voice-settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch voice settings");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/users/voice-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/voice-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Voice settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update voice settings", variant: "destructive" });
    },
  });

  const handleToggle = (field: string, value: boolean) => {
    updateMutation.mutate({ [field]: value });
  };

  const handleVoiceChange = (value: string) => {
    updateMutation.mutate({ voiceSelection: value });
  };

  const previewVoice = async (voiceName?: string) => {
    setIsPreviewing(true);
    try {
      // Create AudioContext during the user gesture — this is required so the browser
      // doesn't block playback after the async API call (autoplay policy).
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      await audioCtx.resume();

      const res = await fetch("/api/ai/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hi there! I'm your CompanyHQ assistant. How can I help you today?",
          voice: voiceName || voiceSettings?.voiceSelection || "alloy",
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to generate preview");

      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setIsPreviewing(false);
        audioCtx.close();
      };
      source.start(0);
    } catch (err) {
      setIsPreviewing(false);
      toast({ title: "Failed to preview voice", variant: "destructive" });
    }
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Voice Settings
        </CardTitle>
        <CardDescription>Configure speech-to-text and text-to-speech for the AI Assistant</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Mic className="h-4 w-4" /> Voice Features
            </Label>
            <p className="text-sm text-muted-foreground">Enable voice input and spoken responses</p>
          </div>
          <Switch
            checked={voiceSettings?.voiceEnabled ?? false}
            onCheckedChange={(checked) => handleToggle("voiceEnabled", checked)}
            data-testid="toggle-voice-enabled"
          />
        </div>

        {voiceSettings?.voiceEnabled && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" /> Auto-speak responses
                </Label>
                <p className="text-sm text-muted-foreground">AI responses are read aloud automatically</p>
              </div>
              <Switch
                checked={voiceSettings?.voiceAutoSpeak ?? false}
                onCheckedChange={(checked) => handleToggle("voiceAutoSpeak", checked)}
                data-testid="toggle-voice-auto-speak"
              />
            </div>

            <div className="space-y-2">
              <Label>AI Voice</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={voiceSettings?.voiceSelection || "alloy"}
                  onValueChange={handleVoiceChange}
                >
                  <SelectTrigger className="flex-1" data-testid="select-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{v.label}</span>
                          <span className="text-muted-foreground text-xs">({v.description})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewVoice()}
                  disabled={isPreviewing || updateMutation.isPending}
                  data-testid="button-preview-voice"
                >
                  {isPreviewing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Preview
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose the voice your AI assistant uses when speaking responses
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("forest");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bio: "",
    phone: "",
  });

  const [hasChanges, setHasChanges] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        email: profile.email || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
      });
      if (profile.theme) {
        setSelectedTheme(profile.theme as ThemeId);
      }
    }
  }, [profile]);

  const themeMutation = useMutation({
    mutationFn: async (theme: ThemeId) => {
      const res = await apiRequest("PATCH", "/api/profile", { theme });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Theme updated" });
    },
    onError: (error: Error, themeId: ThemeId) => {
      const previousTheme = profile?.theme as ThemeId || "forest";
      setSelectedTheme(previousTheme);
      applyTheme(getTheme(previousTheme));
      toast({ 
        title: "Failed to save theme", 
        description: "Your theme preference couldn't be saved. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const handleThemeChange = (themeId: ThemeId) => {
    const previousTheme = selectedTheme;
    setSelectedTheme(themeId);
    const theme = getTheme(themeId);
    applyTheme(theme);
    themeMutation.mutate(themeId);
  };

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: t("profile.profileUpdated") });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to change password", description: error.message, variant: "destructive" });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be less than 5MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
        credentials: "include",
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image");

      await updateMutation.mutateAsync({ profilePicture: objectPath });
      toast({ title: "Profile picture updated" });
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const displayProfile = profile || user;
  const initials = displayProfile?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">{t("profile.title")}</h1>
        <p className="text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage 
                  src={displayProfile?.profilePicture || undefined} 
                  alt={displayProfile?.name} 
                />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 hover:bg-primary/90 transition-colors"
                data-testid="button-change-photo"
                aria-label="Change profile photo"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                data-testid="input-profile-photo"
              />
            </div>
            <div>
              <CardTitle className="text-xl">{displayProfile?.name}</CardTitle>
              <CardDescription>@{displayProfile?.username}</CardDescription>
              <Badge className="mt-2" variant="outline">{displayProfile?.isMasterAdmin ? "Master Admin" : displayProfile?.role}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.personalInfo")}</CardTitle>
          <CardDescription>{t("profile.updateDetails")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" /> {t("profile.fullName")}
              </Label>
              <Input
                id="name"
                value={formData.name || displayProfile?.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder={t("profile.namePlaceholder")}
                data-testid="input-profile-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {t("profile.emailAddress")}
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email || displayProfile?.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder={t("profile.emailPlaceholder")}
                data-testid="input-profile-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> {t("profile.phoneNumber")}
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || displayProfile?.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder={t("profile.phonePlaceholder")}
                data-testid="input-profile-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> {t("profile.bio")}
              </Label>
              <Textarea
                id="bio"
                value={formData.bio || displayProfile?.bio || ""}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder={t("profile.bioPlaceholder")}
                rows={4}
                data-testid="input-profile-bio"
              />
            </div>

            <EmailNotificationToggle profile={displayProfile} />

            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" /> {t("profile.language")}
              </Label>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t("profile.languageDesc")}
                </p>
                <Select
                  value={i18n.language}
                  onValueChange={async (value) => {
                    i18n.changeLanguage(value);
                    try {
                      await apiRequest("PATCH", "/api/profile", { language: value });
                      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
                      toast({ title: t("profile.languageUpdated") });
                    } catch {
                      toast({ title: t("profile.languageUpdateFailed"), variant: "destructive" });
                    }
                  }}
                >
                  <SelectTrigger className="w-40" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en" data-testid="option-language-en">{t("language.english")}</SelectItem>
                    <SelectItem value="es" data-testid="option-language-es">{t("language.spanish")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("common.saveChanges")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.accountInfo")}</CardTitle>
          <CardDescription>{t("profile.accountInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">{t("auth.username")}</span>
            <span className="font-medium">{displayProfile?.username}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">{t("employees.role")}</span>
            <Badge variant="outline">{displayProfile?.isMasterAdmin ? "Master Admin" : displayProfile?.role}</Badge>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">{t("profile.memberSince")}</span>
            <span className="font-medium">
              {displayProfile?.createdAt 
                ? new Date(displayProfile.createdAt).toLocaleDateString() 
                : t("profile.unknown")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("profile.changePassword")}
          </CardTitle>
          <CardDescription>{t("profile.changePasswordDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("profile.currentPassword")}</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("profile.currentPasswordPlaceholder")}
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">{t("profile.newPassword")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("profile.newPasswordPlaceholder")}
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("profile.confirmNewPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("profile.confirmPasswordPlaceholder")}
                data-testid="input-confirm-password"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={!currentPassword || !newPassword || !confirmPassword || passwordMutation.isPending}
                data-testid="button-change-password"
              >
                {passwordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {t("profile.changePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <VoiceSettingsSection />

    </div>
  );
}
