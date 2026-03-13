import React from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, ExternalLink, RefreshCw, Construction, Wrench, Plug } from "lucide-react";

export default function Integrations() {
  const { t } = useTranslation();
  const { integrations } = useApp();

  return (
    <div className="space-y-8 max-w-5xl mx-auto relative">
      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
        <div className="text-center space-y-4 p-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Construction className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">{t("common.comingSoon")}</h2>
            <p className="text-muted-foreground max-w-md mx-auto mt-2">
              {t("integrations.comingSoonDesc")}
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plug className="w-4 h-4" />
              <span>QuickBooks</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plug className="w-4 h-4" />
              <span>CompanyCam</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plug className="w-4 h-4" />
              <span>Jobber</span>
            </div>
          </div>
          <Badge variant="secondary" className="mt-4">{t("status.inProgress")}</Badge>
        </div>
      </div>

      {/* Original content (greyed out behind overlay) */}
      <div className="opacity-30 pointer-events-none">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{t("nav.integrations")}</h1>
          <p className="text-muted-foreground">{t("integrations.subtitle")}</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("integrations.connectedServices")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((int) => (
                  <div key={int.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${int.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        <span className="font-bold text-lg">{int.name.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{int.name}</h3>
                        <p className="text-xs text-muted-foreground">{int.connected ? t("integrations.syncingDaily") : t("common.disabled")}</p>
                      </div>
                    </div>
                    <Button variant={int.connected ? "outline" : "default"} disabled>
                      {int.connected ? t("common.disconnect") : t("common.connect")}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("integrations.webhookInbox")}</CardTitle>
                <Button variant="ghost" size="sm" className="gap-2" disabled><RefreshCw className="w-4 h-4" /> {t("common.refresh")}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("common.source")}</TableHead>
                    <TableHead>{t("integrations.payload")}</TableHead>
                    <TableHead className="text-right">{t("common.time")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell><Badge className="bg-green-500">200 OK</Badge></TableCell>
                    <TableCell>CompanyCam</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{"{ type: 'photo_added', project_id: 123 }"}</TableCell>
                    <TableCell className="text-right text-sm">2 mins ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge className="bg-green-500">200 OK</Badge></TableCell>
                    <TableCell>QuickBooks</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{"{ type: 'invoice_paid', amount: 5000 }"}</TableCell>
                    <TableCell className="text-right text-sm">1 hour ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge variant="destructive">500 Err</Badge></TableCell>
                    <TableCell>Zapier</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{"{ error: 'invalid_token' }"}</TableCell>
                    <TableCell className="text-right text-sm">4 hours ago</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("integrations.apiCredentials")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t("integrations.publicKey")}</label>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 bg-secondary rounded border font-mono text-sm truncate">
                    pk_live_51M0dXXXXXXXXXXXXXXXXXXXXXX
                  </div>
                  <Button variant="outline" disabled>{t("common.copy")}</Button>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t("integrations.secretKey")}</label>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 bg-secondary rounded border font-mono text-sm truncate">
                    sk_live_28J9dXXXXXXXXXXXXXXXXXXXXXX
                  </div>
                  <Button variant="outline" disabled>{t("integrations.rollKey")}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
