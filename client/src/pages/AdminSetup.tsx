import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle } from "lucide-react";

export default function AdminSetup() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSetup = async () => {
    if (!code.trim()) {
      toast({ title: "Please enter a setup code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/setup-master-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupCode: code }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        toast({ title: "Success!", description: data.message });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("admin.pleaseLoginFirst")}</CardTitle>
            <CardDescription>{t("admin.loginToSetupMaster")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle>{t("admin.masterAdminSuccess")}</CardTitle>
            <CardDescription>{t("admin.masterAdminSuccessDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.href = "/"}>
              {t("common.backToDashboard")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-2" />
          <CardTitle>{t("admin.masterAdminSetup")}</CardTitle>
          <CardDescription>
            {t("admin.masterAdminSetupDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder={t("admin.enterSetupCode")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              data-testid="input-setup-code"
            />
          </div>
          <Button 
            className="w-full" 
            onClick={handleSetup} 
            disabled={isLoading}
            data-testid="button-setup-admin"
          >
            {isLoading ? t("admin.settingUp") : t("admin.activateMasterAdmin")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
