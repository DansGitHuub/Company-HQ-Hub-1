import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Clock, CheckCircle, XCircle, Trash2, Loader2 } from "lucide-react";
import type { AccessRequest } from "@shared/schema";

type SafeUser = {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: string;
  isActive: boolean;
  isMasterAdmin?: boolean;
};

export default function AccessRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMasterAdmin = (user as any)?.isMasterAdmin === true;

  const { data: accessRequests = [], isLoading: requestsLoading } = useQuery<AccessRequest[]>({
    queryKey: ["/api/access-requests"],
    enabled: user?.role === "Admin",
  });

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "Admin",
  });

  const handleAccessRequest = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/access-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Access request processed" });
    },
    onError: (error: any) => {
      showErrorToast(error, "Failed to process request");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/access-requests"] });
      toast({ title: "User deleted" });
    },
  });

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

  const pending = accessRequests.filter(r => r.status === "pending");
  const resolved = accessRequests.filter(r => r.status !== "pending");

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" /> Access Requests
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Review and approve role upgrade requests from users.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending Requests
            {pending.length > 0 && (
              <Badge variant="destructive" className="text-xs">{pending.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Role upgrade requests awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending access requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((req) => {
                const requestUser = users.find(u => u.id === req.userId);
                return (
                  <div key={req.id} className="border rounded-lg p-4" data-testid={`access-request-${req.id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{requestUser?.name || "Unknown User"}</h4>
                        <p className="text-sm text-muted-foreground">
                          {requestUser?.username && <span className="mr-2">{requestUser.username}</span>}
                          Requesting: <Badge variant="outline">{req.requestedRole}</Badge>
                        </p>
                        {req.reason && <p className="text-sm mt-2">{req.reason}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {(req.requestedRole !== "Admin" || isMasterAdmin) && (
                          <Button
                            size="sm"
                            onClick={() => handleAccessRequest.mutate({ id: req.id, status: "approved" })}
                            disabled={handleAccessRequest.isPending}
                            className="gap-1"
                            data-testid={`approve-request-${req.id}`}
                          >
                            <CheckCircle className="w-4 h-4" /> Approve
                          </Button>
                        )}
                        {req.requestedRole === "Admin" && !isMasterAdmin && (
                          <Badge variant="outline">Only Master Admin can approve</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAccessRequest.mutate({ id: req.id, status: "denied" })}
                          disabled={handleAccessRequest.isPending}
                          className="gap-1"
                          data-testid={`deny-request-${req.id}`}
                        >
                          <XCircle className="w-4 h-4" /> Deny
                        </Button>
                        {requestUser && !requestUser.isMasterAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Delete the user "${requestUser.name}"? This cannot be undone.`)) {
                                deleteUserMutation.mutate(requestUser.id);
                              }
                            }}
                            disabled={deleteUserMutation.isPending}
                            data-testid={`delete-user-${req.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {resolved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Resolved</CardTitle>
            <CardDescription>Approved or denied in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resolved.slice(0, 20).map((req) => {
                const requestUser = users.find(u => u.id === req.userId);
                return (
                  <div key={req.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <span className="font-medium text-sm">{requestUser?.name || "Unknown User"}</span>
                      <span className="text-muted-foreground text-sm ml-2">→ {req.requestedRole}</span>
                    </div>
                    <Badge className={req.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {req.status === "approved" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {req.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
