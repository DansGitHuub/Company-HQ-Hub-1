import React, { useState, useEffect } from "react";
import SignaturePad from "@/components/forms/SignaturePad";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
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
  Eye,
  EyeOff,
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
  Truck,
  Bot,
  Power,
  DollarSign,
  Calendar,
  Play,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  Copy,
  Globe,
  Wrench,
  Star,
  Lightbulb,
  Zap,
  ClipboardCheck,
  Puzzle,
  Mail,
  FileSignature,
  Layers,
  Archive
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import AssistantAgentManager from "@/components/AssistantAgentManager";
import ConversationLogViewer from "@/components/ConversationLogViewer";
import SystemStatusReport from "@/components/SystemStatusReport";
import SOPPipeline from "@/components/SOPPipeline";
import ProcessAuditor from "@/pages/ProcessAuditor";
import IntegrationWizard from "@/pages/IntegrationWizard";
import AgreementTemplatesPanel from "@/components/admin/AgreementTemplatesPanel";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import type { User, AccessRequest, CompanySettings } from "@shared/schema";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import ArticleReportsCenter from "@/components/ArticleReportsCenter";
import DiagnosticReport from "@/components/DiagnosticReport";
import AdminDocumentLibrary from "@/components/AdminDocumentLibrary";

function AdminSidebar({ activeTab, setActiveTab, pendingRequests, isMasterAdmin, t }: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingRequests: any[];
  isMasterAdmin: boolean;
  t: any;
}) {
  const [, navigate] = useLocation();
  const groups = [
    {
      label: "People & HR",
      items: [
        { value: "users", label: t("nav.employees"), icon: Users },
        { value: "requests", label: "HR Communications", icon: Megaphone, badge: pendingRequests.length > 0 ? pendingRequests.length : undefined },
        { value: "agreements", label: "Agreement Templates", icon: FileSignature },
        { value: "todos", label: "Task Access", icon: CheckCircle },
        { value: "suggestions", label: "Suggestions", icon: Lightbulb },
      ],
    },
    {
      label: "Content",
      items: [
        { value: "sop-pipeline", label: "SOP Pipeline", icon: Zap },
        { value: "documents", label: "Documents", icon: FileText },
        { value: "shared-links", label: "Shared Links", icon: ExternalLink },
        { value: "help-reports", label: "Help Reports", icon: HelpCircle },
      ],
    },
    {
      label: "Company",
      items: [
        { value: "company", label: "Company Info & Branding", icon: Building2 },
      ],
    },
    {
      label: "Company Settings",
      items: [
        { value: "divisions", label: "Divisions", icon: Layers, href: "/settings?tab=divisions" },
        { value: "estimate-templates", label: "Estimate Templates", icon: FileText, href: "/settings?tab=estimate-templates" },
        { value: "quickbooks", label: "QuickBooks", icon: DollarSign, href: "/settings?tab=quickbooks" },
        { value: "terms", label: "Terms & Conditions", icon: FileSignature, href: "/settings?tab=terms" },
        { value: "integration-wizard", label: "Integration Wizard", icon: Puzzle },
        { value: "qbo-export-cs", label: "QB Export", icon: Upload, href: "/admin/qbo-export" },
      ],
    },
    {
      label: "AI & Automation",
      items: [
        { value: "assistant-agents", label: "AI Assistant", icon: Sparkles },
        { value: "ai-logs", label: "AI Logs", icon: Bot },
        ...(isMasterAdmin ? [{ value: "ai-agents", label: "AI Agents", icon: Bot }] : []),
      ],
    },
    {
      label: "Operations",
      items: [
        { value: "process-auditor", label: "Process Auditor", icon: ClipboardCheck },
        { value: "worksheet-review", label: "Worksheet Review", icon: FileText, href: "/worksheet-review" },
        { value: "work-areas", label: "Work Areas", icon: Layers, href: "/admin/work-areas" },
        { value: "archive", label: "Archive", icon: Archive, href: "/admin/archive" },
      ],
    },
    {
      label: "System",
      items: [
        { value: "app-testing", label: "App Testing", icon: Eye },
        { value: "system-status", label: "System Status", icon: AlertCircle },
        ...(isMasterAdmin ? [{ value: "diagnostics", label: "Diagnostics", icon: Wrench }] : []),
      ],
    },
  ];

  return (
    <nav className="flex flex-col gap-1 py-1" data-testid="admin-sidebar">
      {groups.map((group) => (
        <div key={group.label} className="mb-3">
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = (item as any).href ? false : activeTab === item.value;
            const handleClick = () => {
              if ((item as any).href) {
                navigate((item as any).href);
              } else {
                setActiveTab(item.value);
              }
            };
            return (
              <button
                key={item.value}
                onClick={handleClick}
                data-testid={`admin-nav-${item.value}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {(item as any).badge && (
                  <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1 text-xs shrink-0">
                    {(item as any).badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

type SafeUser = Omit<User, "password">;
type TodoActiveUser = { id: string; userId: string; activatedBy: string | null; activatedAt: Date | null };

function TodoActiveUsersManager() {
  const { t } = useTranslation();
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
    onError: (error) => showErrorToast(error, "Failed to activate user"),
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
    onError: (error) => showErrorToast(error, "Failed to deactivate user"),
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<SafeUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [viewPasswordUser, setViewPasswordUser] = useState<SafeUser | null>(null);
  const [viewedPassword, setViewedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
  const [companySignature, setCompanySignature] = useState("");
  const [editingSignature, setEditingSignature] = useState(false);
  const [drawingSignature, setDrawingSignature] = useState("");

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
      setCompanySignature(companySettings.companySignature || "");
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
    onError: (error) => {
      showErrorToast(error, "Failed to update settings");
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
      showErrorToast(err, "Failed to upload logo");
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
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, { password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Password reset", description: "The user's password has been updated" });
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (error) => {
      showErrorToast(error, "Failed to reset password");
    },
  });

  const viewPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("GET", `/api/admin/users/${userId}/password`);
      return res.json();
    },
    onSuccess: (data) => {
      setViewedPassword(data.storedPassword);
      setShowPassword(false);
    },
    onError: (error: any) => {
      showErrorToast(error, "Cannot view password");
      setViewPasswordUser(null);
    },
  });

  const handleViewPassword = (targetUser: SafeUser) => {
    setViewPasswordUser(targetUser);
    setViewedPassword(null);
    viewPasswordMutation.mutate(targetUser.id);
  };

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
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" /> {t("nav.adminPanel")}
            {isMasterAdmin && <Badge className="bg-amber-100 text-amber-800"><Crown className="w-3 h-3 mr-1" /> Master</Badge>}
          </h1>
          <p className="text-muted-foreground">{t("settings.adminSettingsDesc")}</p>
        </div>
        <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} isMasterAdmin={isMasterAdmin} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{users.length}</div>
            <p className="text-sm text-muted-foreground">{t("common.total")} {t("nav.employees")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">
              {users.filter(u => u.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">{t("status.active")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-600">
              {pendingRequests.length}
            </div>
            <p className="text-sm text-muted-foreground">{t("status.pending")} {t("hiring.communications")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600">
              {users.filter(u => u.role === "Admin").length}
            </div>
            <p className="text-sm text-muted-foreground">{t("common.roles.admin")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile section picker — visible only on small screens */}
      <div className="block md:hidden">
        <Select value={activeTab} onValueChange={(v) => {
          if (v === "work-areas") { navigate("/admin/work-areas"); return; }
          if (v === "qbo-export") { navigate("/admin/qbo-export"); return; }
          if (v === "archive") { navigate("/admin/archive"); return; }
          if (v === "divisions") { navigate("/settings?tab=divisions"); return; }
          if (v === "estimate-templates") { navigate("/settings?tab=estimate-templates"); return; }
          if (v === "quickbooks") { navigate("/settings?tab=quickbooks"); return; }
          if (v === "terms") { navigate("/settings?tab=terms"); return; }
          if (v === "qbo-export-cs") { navigate("/admin/qbo-export"); return; }
          setActiveTab(v);
        }}>
          <SelectTrigger className="w-full" data-testid="admin-mobile-nav">
            <SelectValue placeholder="Select section…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>People &amp; HR</SelectLabel>
              <SelectItem value="users">{t("nav.employees")}</SelectItem>
              <SelectItem value="requests">HR Communications</SelectItem>
              <SelectItem value="agreements">Agreement Templates</SelectItem>
              <SelectItem value="todos">Task Access</SelectItem>
              <SelectItem value="suggestions">Suggestions</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Content</SelectLabel>
              <SelectItem value="sop-pipeline">SOP Pipeline</SelectItem>
              <SelectItem value="documents">Documents</SelectItem>
              <SelectItem value="shared-links">Shared Links</SelectItem>
              <SelectItem value="help-reports">Help Reports</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Company</SelectLabel>
              <SelectItem value="company">Company Info &amp; Branding</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Company Settings</SelectLabel>
              <SelectItem value="divisions">Divisions</SelectItem>
              <SelectItem value="estimate-templates">Estimate Templates</SelectItem>
              <SelectItem value="quickbooks">QuickBooks</SelectItem>
              <SelectItem value="terms">Terms &amp; Conditions</SelectItem>
              <SelectItem value="integration-wizard">Integration Wizard</SelectItem>
              <SelectItem value="qbo-export-cs">QB Export</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>AI &amp; Automation</SelectLabel>
              <SelectItem value="assistant-agents">AI Assistant</SelectItem>
              <SelectItem value="ai-logs">AI Logs</SelectItem>
              {isMasterAdmin && <SelectItem value="ai-agents">AI Agents</SelectItem>}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Operations</SelectLabel>
              <SelectItem value="process-auditor">Process Auditor</SelectItem>
              <SelectItem value="work-areas">Work Areas</SelectItem>
              <SelectItem value="archive">Archive</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>System</SelectLabel>
              <SelectItem value="app-testing">App Testing</SelectItem>
              <SelectItem value="system-status">System Status</SelectItem>
              {isMasterAdmin && <SelectItem value="diagnostics">Diagnostics</SelectItem>}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left sidebar nav — hidden on mobile, shown on md+ */}
        <div className="hidden md:block w-48 shrink-0 sticky top-4">
          <AdminSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingRequests={pendingRequests}
            isMasterAdmin={isMasterAdmin}
            t={t}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

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
                                {/* View Password - Master Admin only, staff users only */}
                                {isMasterAdmin && u.role !== "Customer" && (
                                  <DropdownMenuItem onClick={() => handleViewPassword(u)}>
                                    <Eye className="w-4 h-4 mr-2" /> View Password
                                  </DropdownMenuItem>
                                )}
                                {/* Reset Password - for staff users (admin can reset) */}
                                {u.role !== "Customer" && (
                                  <DropdownMenuItem onClick={() => setResetPasswordUser(u)}>
                                    <Key className="w-4 h-4 mr-2" /> Reset Password
                                  </DropdownMenuItem>
                                )}
                                {/* For customers - show message about password recovery */}
                                {u.role === "Customer" && (
                                  <DropdownMenuItem disabled className="text-muted-foreground">
                                    <Key className="w-4 h-4 mr-2" /> Customer uses recovery
                                  </DropdownMenuItem>
                                )}
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
                              {requestUser?.username && <span className="mr-2">@{requestUser.username}</span>}
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
                            {requestUser && !requestUser.isMasterAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid={`button-delete-user-${req.id}`}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete the user "${requestUser.name}"? This cannot be undone.`)) {
                                    deleteUserMutation.mutate(requestUser.id);
                                  }
                                }}
                                disabled={deleteUserMutation.isPending}
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
        </TabsContent>

        <TabsContent value="todos" className="mt-6">
          <TodoActiveUsersManager />
        </TabsContent>

        <TabsContent value="help-reports" className="mt-6">
          <ArticleReportsCenter />
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
              <CardTitle>Company Signature</CardTitle>
              <CardDescription>Draw and save your official company signature. Use it on offer letters, contracts, and other documents with one click.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {companySignature && !editingSignature ? (
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Saved Signature</Label>
                  <div className="border rounded-lg bg-white p-4 flex items-center justify-center" style={{ minHeight: 100 }}>
                    <img src={companySignature} alt="Company Signature" className="max-h-20 object-contain" data-testid="img-company-signature" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingSignature(true); setDrawingSignature(""); }}
                      data-testid="button-edit-signature"
                    >
                      Update Signature
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        await updateCompanySettingsMutation.mutateAsync({ companySignature: "" });
                        setCompanySignature("");
                        setDrawingSignature("");
                      }}
                      data-testid="button-clear-signature"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">
                    {editingSignature ? "Draw your new signature below" : "No signature saved yet — draw one below"}
                  </Label>
                  <div className="max-w-md">
                    <SignaturePad
                      value={drawingSignature}
                      onChange={setDrawingSignature}
                      height={120}
                      testId="company-signature-pad"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!drawingSignature) return;
                        await updateCompanySettingsMutation.mutateAsync({ companySignature: drawingSignature });
                        setCompanySignature(drawingSignature);
                        setDrawingSignature("");
                        setEditingSignature(false);
                      }}
                      disabled={!drawingSignature || updateCompanySettingsMutation.isPending}
                      data-testid="button-save-signature"
                    >
                      {updateCompanySettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Signature
                    </Button>
                    {editingSignature && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingSignature(false); setDrawingSignature(""); }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
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

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> AI Image Generation
              </CardTitle>
              <CardDescription>Control who can generate AI images in the SOP Builder</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable AI Image Generation</Label>
                  <p className="text-xs text-muted-foreground">Allow users to generate images with AI in the SOP Builder</p>
                </div>
                <Switch
                  checked={companySettings?.aiImagesEnabled ?? true}
                  onCheckedChange={(checked) => updateCompanySettingsMutation.mutate({ aiImagesEnabled: checked })}
                  data-testid="switch-ai-images-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>Allowed Roles</Label>
                <p className="text-xs text-muted-foreground">Which roles can use AI image generation</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["Admin", "Manager", "Crew"].map((role) => {
                    const currentRoles = (companySettings?.aiImagesAllowedRoles as string[]) || ["Admin", "Manager"];
                    const isSelected = currentRoles.includes(role);
                    return (
                      <Badge
                        key={role}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const updated = isSelected
                            ? currentRoles.filter((r: string) => r !== role)
                            : [...currentRoles, role];
                          updateCompanySettingsMutation.mutate({ aiImagesAllowedRoles: updated });
                        }}
                        data-testid={`badge-role-${role.toLowerCase()}`}
                      >
                        {role}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Limit (per user)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={companySettings?.aiImagesDailyLimit ?? 10}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) updateCompanySettingsMutation.mutate({ aiImagesDailyLimit: val });
                    }}
                    data-testid="input-daily-limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Limit (company)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    defaultValue={companySettings?.aiImagesMonthlyLimit ?? 200}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) updateCompanySettingsMutation.mutate({ aiImagesMonthlyLimit: val });
                    }}
                    data-testid="input-monthly-limit"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Watermark by Default</Label>
                  <p className="text-xs text-muted-foreground">Add "AI Generated" watermark to images</p>
                </div>
                <Switch
                  checked={companySettings?.aiImagesWatermarkDefault ?? true}
                  onCheckedChange={(checked) => updateCompanySettingsMutation.mutate({ aiImagesWatermarkDefault: checked })}
                  data-testid="switch-ai-watermark"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assistant-agents" className="mt-6">
          <AssistantAgentManager />
        </TabsContent>

        <TabsContent value="ai-logs" className="mt-6">
          <ConversationLogViewer />
        </TabsContent>

        <TabsContent value="sop-pipeline" className="mt-6">
          <SOPPipeline />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <AdminDocumentLibrary />
        </TabsContent>

        <TabsContent value="shared-links" className="mt-6">
          <SharedLinksManager />
        </TabsContent>

        <TabsContent value="suggestions" className="mt-6">
          <CustomerSuggestionsPanel />
        </TabsContent>


        <TabsContent value="app-testing" className="mt-6">
          <AppTestingPanel />
        </TabsContent>

        <TabsContent value="system-status" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">System Status Report</h3>
                  <p className="text-sm text-muted-foreground">View the current status of all platform modules, connections, and live system data.</p>
                </div>
              </div>
              <SystemStatusReport />
            </CardContent>
          </Card>
        </TabsContent>

        {user?.isMasterAdmin && (
          <TabsContent value="ai-agents" className="mt-6">
            <AiAgentsPanel />
          </TabsContent>
        )}

        {user?.isMasterAdmin && (
          <TabsContent value="diagnostics" className="mt-6">
            <DiagnosticReport />
          </TabsContent>
        )}

        <TabsContent value="process-auditor" className="mt-6">
          <ProcessAuditor />
        </TabsContent>

        <TabsContent value="integration-wizard" className="mt-6">
          <IntegrationWizard />
        </TabsContent>

        <TabsContent value="agreements" className="mt-6">
          <AgreementTemplatesPanel />
        </TabsContent>
      </Tabs>
        </div>
      </div>

      {/* Password Reset Dialog */}
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
              This will immediately change the user's password. Make sure to share the new password with them securely.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetPasswordUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => resetPasswordUser && resetPasswordMutation.mutate({ id: resetPasswordUser.id, password: newPassword })}
              disabled={!newPassword || resetPasswordMutation.isPending}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Password Dialog - Master Admin only */}
      <Dialog open={!!viewPasswordUser} onOpenChange={(open) => !open && setViewPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password for {viewPasswordUser?.name || viewPasswordUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {viewPasswordMutation.isPending ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : viewedPassword ? (
              <div className="space-y-2">
                <Label>Stored Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={viewedPassword}
                    readOnly
                    className="font-mono"
                    data-testid="input-view-password"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This is the current password for this staff member. If they change their own password, it will be updated here automatically.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Password not available.</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewPasswordUser(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// AI Agents Panel Component - Master Admin only
function AiAgentsPanel() {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Fetch AI agents
  const { data: agents = [], isLoading: agentsLoading, refetch: refetchAgents } = useQuery<any[]>({
    queryKey: ["/api/ai-agents"],
  });

  // Fetch cost summary
  const { data: costSummary } = useQuery<any>({
    queryKey: ["/api/ai-agents/costs/summary"],
  });

  // Mutation to toggle agent
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/ai-agents/${id}`, { isEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
    },
  });

  // Mutation to run agent
  const runAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/ai-agents/${agentId}/run`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents/costs/summary"] });
    },
  });

  // Mutation to delete agent
  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("DELETE", `/api/ai-agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents/costs/summary"] });
    },
  });

  // Fetch suggestions for an agent
  const fetchSuggestions = async (agentId: string) => {
    const res = await fetch(`/api/ai-agents/${agentId}/suggestions`, { credentials: "include" });
    return res.json();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(4)}`;
  };

  if (agentsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cost Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            AI Usage & Costs
          </CardTitle>
          <CardDescription>Track your AI agent usage and estimated costs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(costSummary?.totalCost || 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total Cost (This Period)</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {costSummary?.totalRuns || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total Runs</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(costSummary?.projectedMonthly || 0)}
              </div>
              <p className="text-sm text-muted-foreground">Projected Monthly</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {costSummary?.nextBillingDate ? new Date(costSummary.nextBillingDate).toLocaleDateString() : "N/A"}
              </div>
              <p className="text-sm text-muted-foreground">Next Billing Date</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Agents List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Agents
            </CardTitle>
            <CardDescription>
              Control your autonomous AI agents. They analyze your data and suggest improvements.
            </CardDescription>
          </div>
          <CreateAgentDialog onCreated={() => refetchAgents()} />
        </CardHeader>
        <CardContent className="space-y-4">
          {agents.map((agent: any) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isExpanded={expandedAgent === agent.id}
              onToggleExpand={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
              onToggleEnabled={(enabled) => toggleAgentMutation.mutate({ id: agent.id, isEnabled: enabled })}
              onRun={() => runAgentMutation.mutate(agent.id)}
              onDelete={() => deleteAgentMutation.mutate(agent.id)}
              isRunning={runAgentMutation.isPending && runAgentMutation.variables === agent.id}
              costData={costSummary?.agentCosts?.find((c: any) => c.agentId === agent.id)}
              fetchSuggestions={fetchSuggestions}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Individual Agent Card
function AgentCard({
  agent,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  onRun,
  onDelete,
  isRunning,
  costData,
  fetchSuggestions,
}: {
  agent: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onRun: () => void;
  onDelete: () => void;
  isRunning: boolean;
  costData?: any;
  fetchSuggestions: (agentId: string) => Promise<any[]>;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const data = await fetchSuggestions(agent.id);
      setSuggestions(data);
    } catch (e) {
      console.error("Failed to load suggestions:", e);
    }
    setLoadingSuggestions(false);
  };

  React.useEffect(() => {
    if (isExpanded) {
      loadSuggestions();
    }
  }, [isExpanded]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "forms":
      case "forms_builder":
        return <FileText className="h-5 w-5" />;
      case "sops":
      case "sop_builder":
        return <BookOpen className="h-5 w-5" />;
      case "communications":
        return <Inbox className="h-5 w-5" />;
      case "hiring":
        return <Users className="h-5 w-5" />;
      case "content_creator":
        return <GraduationCap className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case "daily":
        return "Runs Daily";
      case "weekly":
        return "Runs Weekly";
      case "monthly":
        return "Runs Monthly";
      default:
        return "Manual Only";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Agent Header */}
      <div
        className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-full ${agent.isEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
            {getCategoryIcon(agent.category)}
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              {agent.name}
              {agent.isEnabled ? (
                <Badge variant="default" className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="text-muted-foreground">{getFrequencyLabel(agent.runFrequency)}</div>
            <div className="text-xs">Last: {agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleDateString() : 'Never'}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={agent.isEnabled ? "outline" : "default"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled(!agent.isEnabled);
              }}
              className="gap-1"
            >
              <Power className="h-4 w-4" />
              {agent.isEnabled ? "Turn Off" : "Turn On"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              disabled={!agent.isEnabled || isRunning}
              className="gap-1"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this agent and all its suggestions?")) {
                  onDelete();
                }
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t bg-background">
          {/* Cost Info */}
          <div className="flex gap-4 mb-4 text-sm">
            <div className="bg-muted/50 rounded px-3 py-2">
              <span className="text-muted-foreground">Total Cost:</span>{" "}
              <span className="font-semibold">${(costData?.totalCost || 0).toFixed(4)}</span>
            </div>
            <div className="bg-muted/50 rounded px-3 py-2">
              <span className="text-muted-foreground">Runs:</span>{" "}
              <span className="font-semibold">{costData?.runCount || 0}</span>
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Suggestions
              </h4>
              <Button variant="ghost" size="sm" onClick={loadSuggestions} disabled={loadingSuggestions}>
                <RefreshCw className={`h-4 w-4 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loadingSuggestions ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No suggestions yet. Run the agent to generate improvement ideas.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion: any) => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Suggestion Card
function SuggestionCard({ suggestion }: { suggestion: any }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500 bg-red-50";
      case "low":
        return "text-green-500 bg-green-50";
      default:
        return "text-amber-500 bg-amber-50";
    }
  };

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/ai-suggestions/${id}`, { status, implementedAt: status === "implemented" ? new Date() : null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
    },
  });

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="font-medium">{suggestion.title}</h5>
            <Badge className={getPriorityColor(suggestion.priority)} variant="outline">
              {suggestion.priority}
            </Badge>
            {suggestion.status === "implemented" && (
              <Badge variant="default" className="bg-green-500">Implemented</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{suggestion.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <DollarSign className="h-3 w-3" />
              Est. Cost: {suggestion.estimatedCost}
            </span>
            <span className="text-muted-foreground">
              Created: {new Date(suggestion.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        {suggestion.status !== "implemented" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, status: "implemented" })}
            disabled={updateSuggestionMutation.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Mark Done
          </Button>
        )}
      </div>
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

  useEffect(() => {
    if (open) {
      setFormData({ username: "", password: "", email: "", name: "", role: "Crew" });
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
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Username</Label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="new-password"
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

function CreateAgentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "custom",
    runFrequency: "manual" as "manual" | "daily" | "weekly" | "monthly",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/ai-agents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      setOpen(false);
      setFormData({ name: "", description: "", category: "custom", runFrequency: "manual" });
      onCreated();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const categoryOptions = [
    { value: "custom", label: "Custom Agent" },
    { value: "sop_builder", label: "SOP Builder" },
    { value: "forms_builder", label: "Forms Builder" },
    { value: "content_creator", label: "Content Creator" },
    { value: "forms", label: "Forms Analyzer" },
    { value: "sops", label: "SOP Analyzer" },
    { value: "communications", label: "Communications" },
    { value: "hiring", label: "Hiring" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-agent">
          <Plus className="w-4 h-4" /> Create Agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Create AI Agent
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label>Agent Name</Label>
            <Input
              placeholder="e.g., Equipment Maintenance Analyzer"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-agent-name"
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input
              placeholder="What should this agent do?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-agent-description"
            />
          </div>
          <div className="grid gap-2">
            <Label>Category / Type</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
              <SelectTrigger data-testid="select-agent-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Run Frequency</Label>
            <Select value={formData.runFrequency} onValueChange={(val: any) => setFormData({ ...formData, runFrequency: val })}>
              <SelectTrigger data-testid="select-agent-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Only</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-agent">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Agent
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SUGGESTION_STATUS_OPTIONS = [
  { value: "received", label: "Received", color: "#6b7280", bg: "#f3f4f6" },
  { value: "reviewing", label: "Reviewing", color: "#2563eb", bg: "#dbeafe" },
  { value: "planned", label: "Planned", color: "#7c3aed", bg: "#ede9fe" },
  { value: "completed", label: "Completed", color: "#16a34a", bg: "#dcfce7" },
  { value: "not_planned", label: "Not Planned", color: "#dc2626", bg: "#fee2e2" },
];

function CustomerSuggestionsPanel() {
  const { toast } = useToast();
  const { data: suggestions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/suggestions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: string; status?: string; adminNote?: string }) => {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, adminNote }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({ title: "Suggestion updated" });
    },
    onError: () => {
      toast({ title: "Failed to update suggestion", variant: "destructive" });
    },
  });

  const [editingNote, setEditingNote] = useState<{ id: string; note: string } | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Customer Suggestions
        </CardTitle>
        <CardDescription>
          Review and respond to improvement suggestions from your customers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No suggestions yet</p>
            <p className="text-sm mt-1">Customer suggestions will appear here when submitted.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((s: any) => {
              const statusCfg = SUGGESTION_STATUS_OPTIONS.find(o => o.value === s.status) || SUGGESTION_STATUS_OPTIONS[0];
              return (
                <div key={s.id} className="border rounded-lg p-4 space-y-3" data-testid={`admin-suggestion-${s.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        by {s.customerName} &middot; {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Select
                      value={s.status}
                      onValueChange={(value) => updateMutation.mutate({ id: s.id, status: value })}
                    >
                      <SelectTrigger className="w-[140px]" data-testid={`status-select-${s.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUGGESTION_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span style={{ color: opt.color }}>{opt.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {s.description && (
                    <p className="text-sm text-gray-600">{s.description}</p>
                  )}
                  <div className="pt-2 border-t">
                    {editingNote?.id === s.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingNote.note}
                          onChange={e => setEditingNote({ ...editingNote, note: e.target.value })}
                          placeholder="Add a note for the customer..."
                          rows={2}
                          data-testid={`note-input-${s.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              updateMutation.mutate({ id: s.id, adminNote: editingNote.note });
                              setEditingNote(null);
                            }}
                            data-testid={`save-note-${s.id}`}
                          >
                            Save Note
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingNote(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div>
                          {s.adminNote ? (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium text-xs text-gray-400 uppercase tracking-wide block mb-0.5">Status Note</span>
                              {s.adminNote}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No note added</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingNote({ id: s.id, note: s.adminNote || "" })}
                          data-testid={`edit-note-${s.id}`}
                        >
                          {s.adminNote ? "Edit Note" : "Add Note"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function AppTestingPanel() {
  const { user, previewRole, setPreviewRole, effectiveRole } = useAuth();
  const roles = ["Admin", "Manager", "Crew", "Customer"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          App Testing
        </CardTitle>
        <CardDescription>
          Preview the app as different roles to see what each access level experiences. This only changes your view — not your actual permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {roles.map(role => (
            <Button
              key={role}
              variant={effectiveRole === role ? "default" : "outline"}
              className="h-20 flex-col gap-2"
              data-testid={`button-preview-${role.toLowerCase()}`}
              onClick={() => {
                setPreviewRole(role === user?.role ? null : role);
              }}
            >
              {role === "Admin" && <Shield className="h-5 w-5" />}
              {role === "Manager" && <Users className="h-5 w-5" />}
              {role === "Crew" && <Wrench className="h-5 w-5" />}
              {role === "Customer" && <Star className="h-5 w-5" />}
              <span className="font-medium">{role}</span>
              {role === user?.role && <Badge variant="secondary" className="text-xs">Your Role</Badge>}
            </Button>
          ))}
        </div>
        {previewRole && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-amber-800">
                <strong>Preview Mode Active:</strong> You're viewing the app as <strong>{previewRole}</strong>. 
                Navigate to any page to see what a {previewRole} user would see.
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewRole(null)} data-testid="button-exit-preview">
              <EyeOff className="h-4 w-4 mr-2" /> Exit Preview
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SharedLinksManager() {
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["/api/shared-links"],
    queryFn: async () => (await apiRequest("GET", "/api/shared-links")).json(),
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

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" /> External Share Links
          </h3>
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
