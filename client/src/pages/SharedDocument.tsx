import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Lock, FileText, Clock, AlertTriangle, TreePine } from "lucide-react";

export default function SharedDocument() {
  const { t } = useTranslation();
  const [, params] = useRoute("/shared/:token");
  const token = params?.token;
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState<any>(null);
  const [passwordError, setPasswordError] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/shared/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/shared/${token}`);
      if (res.status === 410) {
        const body = await res.json();
        throw new Error(body.message || "expired");
      }
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error("error");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const verifyMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await fetch(`/api/shared/${token}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (res.status === 401) throw new Error("Incorrect password");
      if (res.status === 410) {
        const body = await res.json();
        throw new Error(body.message);
      }
      if (!res.ok) throw new Error("Verification failed");
      return res.json();
    },
    onSuccess: (result) => {
      setUnlocked(result);
      setPasswordError("");
    },
    onError: (err: Error) => {
      setPasswordError(err.message);
    },
  });

  const docData = unlocked || (data && !data.needsPassword ? data : null);

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-green-700" />
        </div>
      </Shell>
    );
  }

  if (error) {
    const msg = (error as Error).message;
    if (msg === "not_found") {
      return (
        <Shell>
          <Card className="max-w-lg mx-auto mt-12 border-red-200">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <h2 className="text-xl font-semibold mb-2" data-testid="text-share-not-found">{t("shared.linkNotFound")}</h2>
              <p className="text-muted-foreground">{t("shared.linkNotFoundDesc")}</p>
            </CardContent>
          </Card>
        </Shell>
      );
    }
    return (
      <Shell>
        <Card className="max-w-lg mx-auto mt-12 border-amber-200">
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold mb-2" data-testid="text-share-expired">{t("shared.linkExpired")}</h2>
            <p className="text-muted-foreground">{msg || t("shared.linkExpiredDesc")}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (data?.needsPassword && !unlocked) {
    return (
      <Shell>
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader className="text-center">
            <Lock className="h-10 w-10 mx-auto mb-2 text-green-700" />
            <CardTitle data-testid="text-password-required">{t("shared.passwordRequired")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t("shared.passwordProtected")}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium mb-3">{data.documentName}</p>
            <form onSubmit={(e) => { e.preventDefault(); verifyMutation.mutate(password); }} className="space-y-3">
              <Input
                type="password"
                placeholder={t("shared.enterPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-share-password"
              />
              {passwordError && <p className="text-sm text-red-500" data-testid="text-password-error">{passwordError}</p>}
              <Button type="submit" className="w-full bg-green-700 hover:bg-green-800" disabled={!password || verifyMutation.isPending} data-testid="button-unlock">
                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                {t("shared.unlockDocument")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (docData) {
    return (
      <Shell>
        <Card className="max-w-2xl mx-auto mt-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-green-700" />
                </div>
                <div>
                  <CardTitle className="text-lg" data-testid="text-document-name">{docData.documentName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("shared.sharedBy", { name: docData.createdByName })}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs" data-testid="badge-doc-type">
                {docData.documentType}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {docData.note && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="text-share-note">
                <p className="text-sm font-medium text-amber-800 mb-1">{t("shared.noteFrom", { name: docData.createdByName })}:</p>
                <p className="text-sm text-amber-700">{docData.note}</p>
              </div>
            )}

            {docData.documentUrl && (
              <div className="bg-gray-50 border rounded-lg p-6 text-center">
                {docData.documentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img src={docData.documentUrl} alt={docData.documentName} className="max-w-full max-h-96 mx-auto rounded" />
                ) : docData.documentUrl.match(/\.pdf$/i) ? (
                  <iframe src={docData.documentUrl} className="w-full h-[500px] border rounded" title={docData.documentName} />
                ) : (
                  <div className="py-8">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-muted-foreground">{t("shared.previewNotAvailable")}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("common.expires")}: {new Date(docData.expiresAt).toLocaleDateString(t("common.locale"), { month: "long", day: "numeric", year: "numeric" })}
              </div>
              {docData.documentUrl && (
                <Button asChild className="bg-green-700 hover:bg-green-800" data-testid="button-download">
                  <a href={`/api/shared/${token}/download`} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" /> {t("common.download")}
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <header className="bg-[#1E3A2F] text-white py-4 px-6 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center">
            <TreePine className="h-5 w-5 text-[#C9A84C]" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Chapin Landscapes</h1>
            <p className="text-xs text-white/60">{t("shared.sharedDocument")}</p>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 pb-12">
        {children}
      </main>
      <footer className="text-center py-6 text-xs text-muted-foreground border-t">
        <p>&copy; {new Date().getFullYear()} Chapin Landscapes. All rights reserved.</p>
      </footer>
    </div>
  );
}
