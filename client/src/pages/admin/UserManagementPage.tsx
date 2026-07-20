import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Shield, Crown, MoreHorizontal, Loader2, Plus } from "lucide-react";
import type { User } from "@shared/schema";

type SafeUser = Omit<User, "password">;

function CreateUserDialog({ open, onOpenChange, isMasterAdmin }: { open: boolean; onOpenChange: (open: boolean) => void; isMasterAdmin: boolean }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    name: "",
    role: "Crew",
    isTestAccount: false,
  });

  useEffect(() => {
    if (open) {
      setFormData({ username: "", password: "", email: "", name: "", role: "Crew", isTestAccount: false });
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false);
      toast({ title: "User created" });
    },
    onError: (error: any) => {
      showErrorToast(error, "Failed to create user");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4" autoComplete="off">
          <div className="grid gap-2">
            <Label>Full Name</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} autoComplete="off" required data-testid="input-new-user-name" />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} autoComplete="off" required data-testid="input-new-user-email" />
          </div>
          <div className="grid gap-2">
            <Label>Username</Label>
            <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} autoComplete="off" required data-testid="input-new-user-username" />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} autoComplete="new-password" required data-testid="input-new-user-password" />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
              <SelectTrigger data-testid="select-new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isMasterAdmin && <SelectItem value="Admin">Admin</SelectItem>}
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Crew">Crew</SelectItem>
                <SelectItem value="Customer">Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isTestAccount"
              checked={formData.isTestAccount}
              onCheckedChange={(checked) => setFormData({ ...formData, isTestAccount: checked === true })}
              data-testid="checkbox-new-user-test-account"
            />
            <Label htmlFor="isTestAccount" className="text-sm text-muted-foreground cursor-pointer">Mark as test account</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-user-submit">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UserManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMasterAdmin = (user as any)?.isMasterAdmin === true;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<SafeUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmRealAccountReset, setConfirmRealAccountReset] = useState(false);

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "Admin",
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (error: any) => {
      showErrorToast(error, "Failed to update user");
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

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password, confirmRealAccountPasswordReset }: { id: string; password: string; confirmRealAccountPasswordReset?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, { password, confirmRealAccountPasswordReset });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Password reset", description: "The user's password has been updated" });
      setResetPasswordUser(null);
      setNewPassword("");
      setConfirmRealAccountReset(false);
    },
    onError: (error) => {
      showErrorToast(error, "Failed to reset password");
    },
  });

  const toggleTestAccountMutation = useMutation({
    mutationFn: async ({ id, isTestAccount }: { id: string; isTestAccount: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, { isTestAccount });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: variables.isTestAccount ? "Marked as test account" : "Unmarked as test account" });
    },
    onError: (error) => {
      showErrorToast(error, "Failed to update test account status");
    },
  });

  const crewInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/employees/${userId}/portal-invite`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to generate invite link");
      }
      return res.json() as Promise<{ url: string; expires_at: string }>;
    },
    onSuccess: async (data) => {
      try {
        await navigator.clipboard.writeText(data?.url ?? "");
        toast({ title: "Crew portal invite copied to clipboard — expires in 24h" });
      } catch {
        toast({ title: `Crew invite link: ${data?.url}`, description: "Copy it manually." });
      }
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const canModifyUser = (targetUser: SafeUser) => !targetUser.isMasterAdmin;
  const canAssignRole = (role: string) => !(role === "Admin" && !isMasterAdmin);

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {users.length} total · {users.filter(u => u.isActive).length} active · {users.filter(u => u.role === "Admin").length} admin
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2" data-testid="button-add-user">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <Card>
        <CardContent className="pt-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {u.name}
                            {u.isMasterAdmin && <Crown className="w-4 h-4 text-amber-500" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{u.username}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.isMasterAdmin ? (
                        <Badge className="bg-amber-100 text-amber-800">Master Admin</Badge>
                      ) : (
                        <Select
                          defaultValue={u.role}
                          onValueChange={(value) => {
                            if (!canAssignRole(value)) {
                              toast({ title: "Permission denied", description: "Only the Master Admin can assign Admin role", variant: "destructive" });
                              return;
                            }
                            updateUserMutation.mutate({ id: u.id, updates: { role: value } });
                          }}
                          disabled={!canModifyUser(u)}
                        >
                          <SelectTrigger className="w-32 h-8" data-testid={`select-role-${u.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isMasterAdmin && <SelectItem value="Admin">Admin</SelectItem>}
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Crew">Crew</SelectItem>
                            <SelectItem value="Customer">Customer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {u.isActive ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Deactivated</Badge>
                        )}
                        {u.isTestAccount && (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50" data-testid={`badge-test-account-${u.id}`}>
                            Test
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      {canModifyUser(u) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`menu-user-${u.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => updateUserMutation.mutate({ id: u.id, updates: { isActive: !u.isActive } })}
                              data-testid={`toggle-active-${u.id}`}
                            >
                              {u.isActive ? "Deactivate" : "Activate"} Account
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { setResetPasswordUser(u); setNewPassword(""); setConfirmRealAccountReset(false); }}
                              data-testid={`reset-password-${u.id}`}
                            >
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleTestAccountMutation.mutate({ id: u.id, isTestAccount: !u.isTestAccount })}
                              data-testid={`toggle-test-${u.id}`}
                            >
                              {u.isTestAccount ? "Unmark" : "Mark"} as Test Account
                            </DropdownMenuItem>
                            {u.role === "Crew" && (
                              <DropdownMenuItem
                                onClick={() => crewInviteMutation.mutate(u.id)}
                                data-testid={`crew-invite-${u.id}`}
                              >
                                Copy Portal Invite Link
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(`Delete user "${u.name}"? This cannot be undone.`)) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                              data-testid={`delete-user-${u.id}`}
                            >
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} isMasterAdmin={isMasterAdmin} />

      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {resetPasswordUser?.name || resetPasswordUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                data-testid="input-reset-password"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will immediately change the user's password.
            </p>
            {resetPasswordUser && !resetPasswordUser.isTestAccount && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm text-amber-900">
                  This is a <strong>real user account</strong>. Resetting this password will email {resetPasswordUser.name || resetPasswordUser.username} to notify them.
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="confirm-real-reset"
                    checked={confirmRealAccountReset}
                    onCheckedChange={(checked) => setConfirmRealAccountReset(checked === true)}
                    data-testid="checkbox-confirm-real-account-reset"
                  />
                  <Label htmlFor="confirm-real-reset" className="text-sm text-amber-900 cursor-pointer leading-snug">
                    I understand this will notify the user
                  </Label>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetPasswordUser(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (resetPasswordUser) {
                    resetPasswordMutation.mutate({
                      id: resetPasswordUser.id,
                      password: newPassword,
                      confirmRealAccountPasswordReset: confirmRealAccountReset,
                    });
                  }
                }}
                disabled={
                  !newPassword ||
                  resetPasswordMutation.isPending ||
                  (!resetPasswordUser?.isTestAccount && !confirmRealAccountReset)
                }
                data-testid="button-confirm-reset-password"
              >
                {resetPasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
