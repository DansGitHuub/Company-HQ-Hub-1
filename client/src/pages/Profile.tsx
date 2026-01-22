import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, Save, User, Mail, Phone, FileText, Palette, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { themes, getTheme, applyTheme, type ThemeId } from "@/lib/themes";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
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
    },
  });

  const handleThemeChange = (themeId: ThemeId) => {
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
      toast({ title: "Profile updated successfully" });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

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
        <h1 className="text-3xl font-heading font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and profile picture</p>
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
              <Badge className="mt-2" variant="outline">{displayProfile?.role}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your profile details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Full Name
              </Label>
              <Input
                id="name"
                value={formData.name || displayProfile?.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Your full name"
                data-testid="input-profile-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email || displayProfile?.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="your.email@example.com"
                data-testid="input-profile-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || displayProfile?.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
                data-testid="input-profile-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Bio
              </Label>
              <Textarea
                id="bio"
                value={formData.bio || displayProfile?.bio || ""}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder="Tell us a little about yourself..."
                rows={4}
                data-testid="input-profile-bio"
              />
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
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>These details are managed by an administrator</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Username</span>
            <span className="font-medium">{displayProfile?.username}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="outline">{displayProfile?.role}</Badge>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">Member Since</span>
            <span className="font-medium">
              {displayProfile?.createdAt 
                ? new Date(displayProfile.createdAt).toLocaleDateString() 
                : "Unknown"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Preferences
          </CardTitle>
          <CardDescription>Choose a color theme inspired by the outdoors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                data-testid={`theme-${theme.id}`}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-300 
                  hover:scale-105 hover:shadow-lg group
                  ${selectedTheme === theme.id 
                    ? 'border-primary ring-2 ring-primary/20 shadow-md' 
                    : 'border-border hover:border-primary/50'}
                `}
                style={{
                  background: `linear-gradient(135deg, hsl(${theme.colors.gradientFrom}) 0%, hsl(${theme.colors.gradientTo}) 100%)`
                }}
              >
                {selectedTheme === theme.id && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                <div className="text-center space-y-2">
                  <span className="text-2xl block">{theme.icon}</span>
                  <span className="text-sm font-medium text-white drop-shadow-md block">
                    {theme.name}
                  </span>
                </div>
                <div className="mt-2 flex justify-center gap-1">
                  <div 
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                  />
                  <div 
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: `hsl(${theme.colors.accent})` }}
                  />
                </div>
              </button>
            ))}
          </div>
          {themeMutation.isPending && (
            <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving theme preference...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
