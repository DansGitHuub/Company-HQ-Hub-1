import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, Link2, FileText, Eye, Copy, XCircle, Key, Loader2, Shield } from "lucide-react";

export default function SharedLinksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedLink, setSelectedLink] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["/api/shared-links"],
    queryFn: async () => (await apiRequest("GET", "/api/shared-links")).json(),
    enabled: user?.role === "Admin",
  });

  const { data: accessLogs = [] } = useQuery({
    queryKey: [`/api/shared-links/${selectedLink}/access-logs`],
    queryFn: async () => (await apiRequest("GET", `/api/shared-links/${selectedLink}/access-logs`)).json(),
    enabled: !!selectedLink,
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shared-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-links"] });
      toast({ title: "Link revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke link", variant: "destructive" });
    },
  });

  const getStatus = (link: any) => {
    if (link.isRevoked) return { label: "Revoked", color: "bg-red-100 text-red-800" };
    if (new Date(link.expiresAt) < new Date()) return { label: "Expired", color: "bg-amber-100 text-amber-800" };
    return { label: "Active", color: "bg-green-100 text-green-800" };
  };

  if (user?.role !== "Admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md text-center p-8">
          <CardContent>
            <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You need Admin privileges to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" /> External Share Links
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {links.length} total · {links.filter((l: any) => !l.isRevoked && new Date(l.expiresAt) >= new Date()).length} active
          </p>
        </div>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No shared links yet</p>
            <p className="text-sm text-muted-foreground mt-1">Use the "Share Externally" button on any document to create a share link.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => {
            const status = getStatus(link);
            return (
              <Card key={link.id} className="overflow-hidden" data-testid={`shared-link-${link.id}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{link.documentName}</span>
                        <Badge className={`text-[10px] shrink-0 ${status.color}`} variant="outline" data-testid={`status-${link.id}`}>
                          {status.label}
                        </Badge>
                        {link.passwordHash && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            <Key className="h-2.5 w-2.5 mr-0.5" /> Protected
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Type: {link.documentType}</span>
                        <span>By: {link.createdByName}</span>
                        <span>Created: {new Date(link.createdAt).toLocaleDateString()}</span>
                        <span>Expires: {new Date(link.expiresAt).toLocaleDateString()}</span>
                        <span className="font-medium">{link.viewCount} view{link.viewCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const domain = window.location.origin;
                          navigator.clipboard.writeText(`${domain}/shared/${link.token}`);
                          toast({ title: "Link copied" });
                        }}
                        data-testid={`copy-link-${link.id}`}
                        disabled={status.label !== "Active"}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLink(selectedLink === link.id ? null : link.id)}
                        data-testid={`view-logs-${link.id}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Logs
                      </Button>
                      {status.label === "Active" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeMutation.mutate(link.id)}
                          disabled={revokeMutation.isPending}
                          data-testid={`revoke-link-${link.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Revoke
                        </Button>
                      )}
                    </div>
                  </div>

                  {selectedLink === link.id && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium mb-2">Access Log ({accessLogs.length} entries)</p>
                      {accessLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No accesses recorded yet.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Time</TableHead>
                                <TableHead className="text-xs">IP Address</TableHead>
                                <TableHead className="text-xs">User Agent</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {accessLogs.map((log: any) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-xs">{new Date(log.accessedAt).toLocaleString()}</TableCell>
                                  <TableCell className="text-xs font-mono">{log.ipAddress || "—"}</TableCell>
                                  <TableCell className="text-xs truncate max-w-[200px]">{log.userAgent || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
