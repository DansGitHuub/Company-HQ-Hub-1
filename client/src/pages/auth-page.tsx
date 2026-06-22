import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Loader2, TreePine, Users, Building2, Shield, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface CompanySettings {
  id: string;
  companyName: string | null;
  logoUrl: string | null;
  logoShape: string | null;
  logoCornerRadius: number | null;
}

export default function AuthPage() {
  const { user, loginMutation, registerMutation, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({
    username: "",
    password: "",
    email: "",
    name: "",
  });
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
    staleTime: 60000,
  });

  if (user) {
    setLocation(user.role === "Crew" ? "/my-day" : "/");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerData);
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    try {
      const res = await fetch("/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      if (res.ok) {
        setRecoverySent(true);
        toast({
          title: "Recovery email sent",
          description: `Check your inbox at ${recoveryEmail} for the recovery token`,
          duration: Infinity,
        });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: data.message || "Failed to send recovery email",
          variant: "destructive",
          duration: 10000,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send recovery email",
        variant: "destructive",
        duration: 10000,
      });
    }
    setRecoveryLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Success",
          description: "Password reset successful. You can now log in.",
        });
        setShowResetForm(false);
        setResetToken("");
        setNewPassword("");
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to reset password",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to reset password",
        variant: "destructive",
      });
    }
  };

  const getLogoClasses = () => {
    const shape = companySettings?.logoShape || "square";
    const cornerRadius = companySettings?.logoCornerRadius || 0;
    
    let shapeClass = "";
    if (shape === "circle") {
      shapeClass = "rounded-full";
    } else if (cornerRadius > 0) {
      if (cornerRadius <= 4) shapeClass = "rounded";
      else if (cornerRadius <= 8) shapeClass = "rounded-md";
      else if (cornerRadius <= 12) shapeClass = "rounded-lg";
      else shapeClass = "rounded-xl";
    }
    
    return shapeClass;
  };

  const { t } = useTranslation();
  const hasLogo = !!companySettings?.logoUrl;
  const companyName = companySettings?.companyName || "Company HQ";
  const logoShapeClass = getLogoClasses();

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md shadow-xl border-border">
          <CardHeader className="text-center pb-2">
            <img 
              src={hasLogo ? companySettings!.logoUrl! : "/images/companyhq-logo.png"} 
              alt={`${companyName} Logo`}
              className={`mx-auto w-20 h-20 object-cover mb-4 ${hasLogo ? logoShapeClass : 'rounded-xl'}`}
            />
            <CardTitle className="text-2xl font-heading text-foreground">{companyName}</CardTitle>
            <CardDescription className="text-muted-foreground">{t("auth.signInDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {showResetForm ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="mb-4"
                  onClick={() => setShowResetForm(false)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> {t("auth.backToLogin")}
                </Button>
                <div className="space-y-2">
                  <Label htmlFor="reset-token">{t("auth.recoveryToken")}</Label>
                  <Input
                    id="reset-token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste your recovery token"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("profile.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                      data-testid="button-toggle-new-password"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full">{t("auth.resetPassword")}</Button>
              </form>
            ) : (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">{t("auth.signIn")}</TabsTrigger>
                  <TabsTrigger value="register">{t("auth.createAccount")}</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">{t("auth.username")}</Label>
                      <Input
                        id="login-username"
                        data-testid="input-login-username"
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">{t("auth.password")}</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          data-testid="input-login-password"
                          type={showLoginPassword ? "text" : "password"}
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          placeholder="Enter your password"
                          required
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          tabIndex={-1}
                          data-testid="button-toggle-login-password"
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      data-testid="button-login"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t("auth.signIn")}
                    </Button>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="link"
                        className="text-sm text-muted-foreground"
                        onClick={() => setRecoveryOpen(true)}
                      >
                        {t("auth.forgotPassword")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowResetForm(true)}
                        className="text-xs"
                      >
                        {t("auth.haveRecoveryToken")}
                      </Button>
                    </div>
                  </form>
                  <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("auth.passwordRecovery")}</DialogTitle>
                        <DialogDescription>
                          {t("auth.recoveryDescription")}
                        </DialogDescription>
                      </DialogHeader>
                      {recoverySent ? (
                        <div className="text-center py-6">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                          <p className="font-medium">{t("auth.recoverySent")}</p>
                          <p className="text-sm text-muted-foreground mt-2">
                            We've sent a recovery token to <strong>{recoveryEmail}</strong>. Check your inbox and then click below to reset your password.
                          </p>
                          <Button
                            className="mt-4"
                            onClick={() => {
                              setRecoveryOpen(false);
                              setShowResetForm(true);
                              setRecoverySent(false);
                            }}
                          >
                            {t("auth.enterRecoveryToken")}
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleRecovery} className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="recovery-email">{t("profile.emailAddress")}</Label>
                            <Input
                              id="recovery-email"
                              type="email"
                              value={recoveryEmail}
                              onChange={(e) => setRecoveryEmail(e.target.value)}
                              placeholder="Enter your email"
                              required
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={recoveryLoading}
                          >
                            {recoveryLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {t("auth.sendRecoveryEmail")}
                          </Button>
                        </form>
                      )}
                    </DialogContent>
                  </Dialog>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">{t("auth.fullName")}</Label>
                      <Input
                        id="reg-name"
                        data-testid="input-register-name"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                        placeholder="John Smith"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">{t("common.email")}</Label>
                      <Input
                        id="reg-email"
                        data-testid="input-register-email"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        placeholder="john@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-username">{t("auth.username")}</Label>
                      <Input
                        id="reg-username"
                        data-testid="input-register-username"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                        placeholder="johnsmith"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">{t("auth.password")}</Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          data-testid="input-register-password"
                          type={showRegisterPassword ? "text" : "password"}
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          placeholder="Create a strong password"
                          required
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          tabIndex={-1}
                          data-testid="button-toggle-register-password"
                          aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                        >
                          {showRegisterPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      data-testid="button-register"
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t("auth.createAccount")}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-1 bg-sidebar text-sidebar-foreground p-12 items-center justify-center">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <img 
                src={hasLogo ? companySettings!.logoUrl! : "/images/companyhq-logo.png"} 
                alt={`${companyName} Logo`}
                className={`w-16 h-16 object-cover ${hasLogo ? logoShapeClass : 'rounded-xl'}`}
              />
              <div>
                <h2 className="text-2xl font-heading font-bold">{companyName}</h2>
                <p className="text-sidebar-foreground/60">{t("auth.landscapeManagement")}</p>
              </div>
            </div>
            <h1 className="text-3xl font-heading font-bold">{t("auth.heroTitle")}</h1>
            <p className="text-lg text-sidebar-foreground/80">
              {t("auth.heroSubtitle")}
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: TreePine, text: t("auth.featureSop") },
              { icon: Users, text: t("auth.featureHiring") },
              { icon: Building2, text: t("auth.featureMaterials") },
              { icon: Shield, text: t("auth.featureRbac") },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="p-2 bg-sidebar-foreground/10 rounded-lg">
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
