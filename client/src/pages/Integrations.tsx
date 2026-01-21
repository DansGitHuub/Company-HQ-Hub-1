import React from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, ExternalLink, RefreshCw } from "lucide-react";

export default function Integrations() {
  const { integrations, toggleIntegration } = useApp();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Integrations Hub</h1>
        <p className="text-muted-foreground">Manage API connections and webhooks</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
             <CardTitle>Connected Services</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((int) => (
                  <div key={int.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${int.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                         {/* Mock icons based on name */}
                         <span className="font-bold text-lg">{int.name.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{int.name}</h3>
                        <p className="text-xs text-muted-foreground">{int.connected ? 'Syncing daily' : 'Not connected'}</p>
                      </div>
                    </div>
                    <Button 
                      variant={int.connected ? "outline" : "default"} 
                      onClick={() => toggleIntegration(int.id)}
                    >
                      {int.connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Webhook Inbox (Mock)</CardTitle>
              <Button variant="ghost" size="sm" className="gap-2"><RefreshCw className="w-4 h-4"/> Refresh</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Payload</TableHead>
                  <TableHead className="text-right">Time</TableHead>
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
            <CardTitle>API Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid gap-2">
               <label className="text-sm font-medium">Public API Key</label>
               <div className="flex gap-2">
                 <div className="flex-1 p-2 bg-secondary rounded border font-mono text-sm truncate">
                   pk_live_51M0dXXXXXXXXXXXXXXXXXXXXXX
                 </div>
                 <Button variant="outline">Copy</Button>
               </div>
             </div>
             <div className="grid gap-2">
               <label className="text-sm font-medium">Secret Key</label>
               <div className="flex gap-2">
                 <div className="flex-1 p-2 bg-secondary rounded border font-mono text-sm truncate">
                   sk_live_28J9dXXXXXXXXXXXXXXXXXXXXXX
                 </div>
                 <Button variant="outline">Roll Key</Button>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
