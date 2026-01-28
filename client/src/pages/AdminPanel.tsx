import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  MoreHorizontal, 
  Shield, 
  UserCheck, 
  UserX,
  Key,
  Trash2,
  Loader2,
  Crown,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Image,
  Building2,
  GripVertical,
  LayoutDashboard,
  BookOpen,
  Hammer,
  Users,
  Megaphone,
  FileText,
  Settings,
  GraduationCap,
  User as UserIcon,
  Sparkles,
  HelpCircle,
  Inbox,
  Truck
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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
import { useToast } from "@/hooks/use-toast";
import type { User, AccessRequest, CompanySettings } from "@shared/schema";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type SafeUser = Omit<User, "password">;
type TodoActiveUser = { id: string; userId: string; activatedBy: string | null; activatedAt: Date | null };

function TodoActiveUsersManager() {
  const { toast } = useToast();
  
  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: activeUsers = [] } = useQuery<TodoActiveUser[]>({
    queryKey: ["/api/todo-active-users"],
  });

  const activateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/todo-active-users/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to activate user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todo-active-users"] });
      toast({ title: "User activated for To-Do system" });
    },
    onError: () => toast({ title: "Failed to activate user", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/todo-active-users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to deactivate user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todo-active-users"] });
      toast({ title: "User deactivated from To-Do system" });
    },
    onError: () => toast({ title: "Failed to deactivate user", variant: "destructive" }),
  });

  const isUserActive = (userId: string) => activeUsers.some(a => a.userId === userId);
  const internalUsers = users.filter(u => u.role !== "Customer");

  return (
    <Card>
      <CardHeader>
        <CardTitle>To-Do User Management</CardTitle>
        <CardDescription>
          Control which users can see and interact with the To-Do list system. 
          Active users will see a notification icon when they have unread tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {internalUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No internal users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">To-Do Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internalUsers.map((u) => {
                  const active = isUserActive(u.id);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={active}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              activateMutation.mutate(u.id);
                            } else {
                              deactivateMutation.mutate(u.id);
                            }
                          }}
                          disabled={activateMutation.isPending || deactivateMutation.isPending}
                          data-testid={`switch-todo-access-${u.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isMasterAdmin = user?.isMasterAdmin === true;

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "Admin",
  });

  const { data: accessRequests = [], isLoading: requestsLoading } = useQuery<AccessRequest[]>({
    queryKey: ["/api/access-requests"],
    enabled: user?.role === "Admin",
  });

  const pendingRequests = accessRequests.filter(r => r.status === "pending");

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
    enabled: user?.role === "Admin",
  });

  const [logoUrl, setLogoUrl] = useState("");
  const [logoShape, setLogoShape] = useState<string>("square");
  const [logoCornerRadius, setLogoCornerRadius] = useState(0);
  const [companyName, setCompanyName] = useState("Company HQ");
  const [isUploading, setIsUploading] = useState(false);

  // All sidebar items that can be reordered
  const allSidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "sops", label: "SOP Library", icon: BookOpen },
    { id: "materials", label: "Materials", icon: Hammer },
    { id: "equipment", label: "Equipment", icon: Truck },
    { id: "hiring", label: "Hiring", icon: Users },
    { id: "jobs", label: "Jobs", icon: LayoutDashboard },
    { id: "education", label: "Customer Hub", icon: GraduationCap },
    { id: "profile", label: "My Profile", icon: UserIcon },
    { id: "assistant", label: "Assistant", icon: Sparkles },
    { id: "help", label: "Help", icon: HelpCircle },
    { id: "hq", label: "Company HQ", icon: Building2 },
    { id: "marketing", label: "Marketing", icon: Megaphone },
    { id: "forms", label: "Forms", icon: FileText },
    { id: "inbox", label: "Messages", icon: Inbox },
    { id: "integrations", label: "Integrations", icon: Settings },
    { id: "admin", label: "Admin Panel", icon: Shield },
  ];

  const defaultOrder = allSidebarItems.map(item => item.id);
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(defaultOrder);

  React.useEffect(() => {
    if (companySettings) {
      setLogoUrl(companySettings.logoUrl || "");
      setLogoShape(companySettings.logoShape || "square");
      setLogoCornerRadius(companySettings.logoCornerRadius || 0);
      setCompanyName(companySettings.companyName || "Company HQ");
      if (companySettings.sidebarOrder && Array.isArray(companySettings.sidebarOrder)) {
        setSidebarOrder(companySettings.sidebarOrder as string[]);
      }
    }
  }, [companySettings]);

  const updateCompanySettingsMutation = useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      const res = await apiRequest("PATCH", "/api/company-settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      toast({ title: "Company settings updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Step 1: Request a presigned upload URL
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: Upload file directly to presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // Use the object path as the logo URL
      setLogoUrl(objectPath);
      await updateCompanySettingsMutation.mutateAsync({ logoUrl: objectPath });
    } catch (err) {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const saveLogoSettings = () => {
    updateCompanySettingsMutation.mutate({
      logoUrl,
      logoShape,
      logoCornerRadius,
      companyName,
    });
  };

  const handleSidebarDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(sidebarOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSidebarOrder(items);
  };

  const saveSidebarOrder = () => {
    updateCompanySettingsMutation.mutate({ sidebarOrder });
  };

  const resetSidebarOrder = () => {
    setSidebarOrder(defaultOrder);
  };

  const orderedSidebarItems = sidebarOrder
    .map(id => allSidebarItems.find(item => item.id === id))
    .filter(Boolean) as typeof allSidebarItems;

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
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
    },
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
      toast({ title: "Error", description: error.message || "Failed to process request", variant: "destructive" });
    },
  });

  const canModifyUser = (targetUser: SafeUser) => {
    if (targetUser.isMasterAdmin) return false;
    return true;
  };

  const canAssignRole = (role: string) => {
    if (role === "Admin" && !isMasterAdmin) return false;
    return true;
  };

  if (user?.role !== "Admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md text-center p-8">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need Admin privileges to view this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" /> Admin Panel
            {isMasterAdmin && <Badge className="bg-amber-100 text-amber-800"><Crown className="w-3 h-3 mr-1" /> Master</Badge>}
          </h1>
          <p className="text-muted-foreground">Manage users, roles, and access control</p>
        </div>
        <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} isMasterAdmin={isMasterAdmin} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{users.length}</div>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">
              {users.filter(u => u.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-600">
              {pendingRequests.length}
            </div>
            <p className="text-sm text-muted-foreground">Pending Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600">
              {users.filter(u => u.role === "Admin").length}
            </div>
            <p className="text-sm text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            Requests {pendingRequests.length > 0 && <Badge variant="destructive" className="ml-1">{pendingRequests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="todos" className="gap-2">
            To-Do Users
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" /> Company
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all users in the system</CardDescription>
            </CardHeader>
            <CardContent>
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
                      <TableRow key={u.id}>
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
                              <div className="text-xs text-muted-foreground">@{u.username}</div>
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
                              <SelectTrigger className="w-32 h-8">
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
                          {u.isActive ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Deactivated</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canModifyUser(u) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => updateUserMutation.mutate({ 
                                    id: u.id, 
                                    updates: { isActive: !u.isActive } 
                                  })}
                                >
                                  {u.isActive ? (
                                    <>
                                      <UserX className="w-4 h-4 mr-2" /> Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-4 h-4 mr-2" /> Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Key className="w-4 h-4 mr-2" /> Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this user?")) {
                                      deleteUserMutation.mutate(u.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Protected</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Requests</CardTitle>
              <CardDescription>Review and approve role upgrade requests from users</CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : accessRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No access requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accessRequests.map((req) => {
                    const requestUser = users.find(u => u.id === req.userId);
                    return (
                      <div key={req.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{requestUser?.name || "Unknown User"}</h4>
                            <p className="text-sm text-muted-foreground">
                              Requesting: <Badge variant="outline">{req.requestedRole}</Badge>
                            </p>
                            {req.reason && <p className="text-sm mt-2">{req.reason}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {req.status === "pending" ? (
                              <>
                                {(req.requestedRole !== "Admin" || isMasterAdmin) && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAccessRequest.mutate({ id: req.id, status: "approved" })}
                                    disabled={handleAccessRequest.isPending}
                                    className="gap-1"
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
                                >
                                  <XCircle className="w-4 h-4" /> Deny
                                </Button>
                              </>
                            ) : (
                              <Badge className={req.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {req.status === "approved" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                                {req.status}
                              </Badge>
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
        </TabsContent>

        <TabsContent value="todos" className="mt-6">
          <TodoActiveUsersManager />
        </TabsContent>

        <TabsContent value="company" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>Upload your logo and customize how it appears in the sidebar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company HQ"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      {logoUrl ? (
                        <div className="space-y-3">
                          <img 
                            src={logoUrl} 
                            alt="Company Logo" 
                            className="max-h-24 mx-auto object-contain"
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setLogoUrl("")}
                          >
                            Remove Logo
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">Upload your company logo</p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploading}
                            className="max-w-xs mx-auto"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Logo Shape</Label>
                    <Select value={logoShape} onValueChange={setLogoShape}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="rectangle">Rectangle (Wide)</SelectItem>
                        <SelectItem value="circle">Circle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {logoShape !== "circle" && (
                    <div className="space-y-2">
                      <Label>Corner Rounding: {logoCornerRadius}px</Label>
                      <Slider
                        value={[logoCornerRadius]}
                        onValueChange={(v) => setLogoCornerRadius(v[0])}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        0 = Sharp corners, 20 = Very rounded
                      </p>
                    </div>
                  )}

                  <Button onClick={saveLogoSettings} disabled={updateCompanySettingsMutation.isPending} className="w-full">
                    {updateCompanySettingsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Save Changes
                  </Button>
                </div>

                <div className="space-y-4">
                  <Label>Preview</Label>
                  <div className="bg-sidebar p-6 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img 
                          src={logoUrl} 
                          alt="Logo Preview"
                          className={`object-cover shrink-0 ${
                            logoShape === "rectangle" ? "h-10 w-16" : "h-10 w-10"
                          } ${
                            logoShape === "circle" ? "rounded-full" : 
                            logoCornerRadius === 0 ? "rounded-none" :
                            logoCornerRadius <= 4 ? "rounded" :
                            logoCornerRadius <= 8 ? "rounded-md" :
                            logoCornerRadius <= 12 ? "rounded-lg" : "rounded-xl"
                          }`}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
                          <span className="font-heading font-bold text-xl text-primary-foreground">HQ</span>
                        </div>
                      )}
                      <div>
                        <h1 className="font-heading font-semibold text-lg leading-none text-sidebar-foreground">
                          {companyName || "Company HQ"}
                        </h1>
                        <p className="text-xs text-sidebar-accent-foreground/70 mt-1">Landscape Management</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This is how your logo will appear in the sidebar navigation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Sidebar Menu Order</CardTitle>
              <CardDescription>Drag and drop to reorder the sidebar menu items for all users</CardDescription>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleSidebarDragEnd}>
                <Droppable droppableId="sidebar-items">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2"
                    >
                      {orderedSidebarItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-3 p-3 bg-card border rounded-lg ${
                                snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""
                              }`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <item.icon className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{item.label}</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveSidebarOrder} disabled={updateCompanySettingsMutation.isPending}>
                  {updateCompanySettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Order
                </Button>
                <Button variant="outline" onClick={resetSidebarOrder}>
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, isMasterAdmin }: { open: boolean; onOpenChange: (open: boolean) => void; isMasterAdmin: boolean }) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    name: "",
    role: "Crew",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false);
      setFormData({ username: "", password: "", email: "", name: "", role: "Crew" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label>Full Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Username</Label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
              <SelectTrigger>
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
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
