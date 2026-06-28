import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Phone, Mail, MapPin, FileText, User, Clock,
  ChevronLeft, Upload, CheckCircle2, Circle, AlertCircle, Users, ExternalLink, ClipboardList,
  LogOut, ThumbsUp, ThumbsDown, ShieldAlert, Loader2, X, FileSignature, Send, AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import ShareExternallyDialog from "@/components/ShareExternallyDialog";
import DocumentDropZone from "@/components/DocumentDropZone";
import DocumentsPanel from "@/components/DocumentsPanel";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import CorrectiveActionForm from "@/components/forms/CorrectiveActionForm";
import ResignationLetterForm from "@/components/forms/ResignationLetterForm";
import OSHAIncidentForm from "@/components/forms/OSHAIncidentForm";

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function Employees() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      return res.json();
    },
  });

  const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowAddDialog(false);
      toast({ title: t("employees.employeeAdded") || "Employee added" });
    },
    onError: () => {
      toast({ title: t("common.error") || "Failed to add employee", variant: "destructive" });
    },
  });

  const filtered = employees.filter((emp: any) => {
    const matchesSearch = !search || `${emp.firstName} ${emp.lastName} ${emp.jobTitle || ""} ${emp.department || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedEmployee) {
    const emp = employees.find((e: any) => e.id === selectedEmployee);
    if (emp) return (
      <div className="p-6 max-w-5xl mx-auto">
        <EmployeeProfile employee={emp} onBack={() => setSelectedEmployee(null)} />
      </div>
    );
  }

  const activeCount = employees.filter((e: any) => e.status === "Active").length;
  const onLeaveCount = employees.filter((e: any) => e.status === "On Leave").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Gradient page header */}
      <div className="rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-5 text-white flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-employees-title">
            <Users className="h-6 w-6" /> {t("employees.title")}
          </h1>
          <p className="text-sm text-green-100 mt-0.5">
            {employees.length} {t("common.total")} &middot; {activeCount} {t("status.active")}{onLeaveCount > 0 ? ` · ${onLeaveCount} ${t("status.onHold")}` : ""}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowAddDialog(true)}
            data-testid="button-add-employee"
            className="bg-white/15 border border-white/30 text-white hover:bg-white/25 hover:text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> {t("employees.addEmployee")}
          </Button>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <Input
          placeholder={t("common.searchPlaceholder")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-employees"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue placeholder={t("common.filter")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")} {t("common.status")}</SelectItem>
            <SelectItem value="Active">{t("status.active")}</SelectItem>
            <SelectItem value="On Leave">{t("status.onHold")}</SelectItem>
            <SelectItem value="Terminated">{t("status.retired")}</SelectItem>
            <SelectItem value="Seasonal Off">{t("status.inactive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">{t("common.noResults")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {employees.length === 0 ? t("employees.noEmployees") : t("common.noResults")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full" data-testid="table-employees">
            <thead>
              <tr className="bg-gradient-to-r from-green-700 to-emerald-600 text-white">
                <th className="text-left px-4 py-3 text-sm font-semibold">{t("common.name")}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">{t("employees.position")}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">{t("employees.department")}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">{t("employees.startDate")}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp: any, idx: number) => (
                <tr
                  key={emp.id}
                  className={`border-t cursor-pointer hover:bg-emerald-50/50 transition-colors ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}
                  onClick={() => setSelectedEmployee(emp.id)}
                  data-testid={`row-employee-${emp.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
                        {getInitials(`${emp.firstName} ${emp.lastName}`)}
                      </div>
                      <span className="font-medium text-sm">{emp.firstName} {emp.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{emp.jobTitle || "—"}</td>
                  <td className="px-4 py-3 text-sm">{emp.department || "—"}</td>
                  <td className="px-4 py-3 text-sm">{emp.startDate || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={
                      emp.status === "Active"
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : emp.status === "Terminated"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : emp.status === "On Leave"
                        ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                        : emp.status === "Seasonal Off"
                        ? "bg-slate-100 text-slate-600 border border-slate-200"
                        : "bg-muted text-muted-foreground"
                    }>
                      {emp.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>Create a new employee record manually</DialogDescription>
          </DialogHeader>
          <AddEmployeeForm onSave={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddEmployeeForm({ onSave, isPending }: { onSave: (data: any) => void; isPending: boolean }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    firstName: "", lastName: "", personalEmail: "", personalPhone: "",
    jobTitle: "", department: "", employmentType: "Full-time", startDate: "",
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>{t("employees.firstName")} *</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} data-testid="input-emp-first-name" /></div>
        <div><Label>{t("employees.lastName")} *</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} data-testid="input-emp-last-name" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>{t("common.email")}</Label><Input value={form.personalEmail} onChange={e => setForm({ ...form, personalEmail: e.target.value })} /></div>
        <div><Label>{t("common.phone")}</Label><Input value={form.personalPhone} onChange={e => setForm({ ...form, personalPhone: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>{t("employees.position")}</Label><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} /></div>
        <div><Label>{t("employees.department")}</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>{t("employees.employment")}</Label>
          <Select value={form.employmentType} onValueChange={v => setForm({ ...form, employmentType: v })}>
            <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Full-time">Full-time</SelectItem>
              <SelectItem value="Part-time">Part-time</SelectItem>
              <SelectItem value="Seasonal">Seasonal</SelectItem>
              <SelectItem value="Contractor">Contractor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>{t("employees.startDate")}</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => form.firstName && form.lastName && onSave(form)} disabled={!form.firstName || !form.lastName || isPending} data-testid="button-save-employee">
          {isPending ? t("common.saving") : t("employees.createEmployee")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function EmployeeProfile({ employee, onBack }: { employee: any; onBack: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("personal");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/employees/${employee.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee updated" });
    },
    onError: () => {
      toast({ title: "Failed to update employee", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-list">
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("common.backToList")}
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
          {getInitials(`${employee.firstName} ${employee.lastName}`)}
        </div>
        <div>
          <h2 className="font-semibold text-xl" data-testid="text-employee-name">{employee.firstName} {employee.lastName}</h2>
          <p className="text-sm text-muted-foreground">{employee.jobTitle || t("common.none")} {employee.department ? `\u00b7 ${employee.department}` : ""}</p>
        </div>
        <Badge className={`ml-auto border ${
          employee.status === "Active" ? "bg-green-100 text-green-800 border-green-300" :
          employee.status === "On Leave" ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
          "bg-gray-100 text-gray-700 border-gray-300"
        }`}>{employee.status || "Active"}</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="personal" data-testid="tab-personal">{t("employees.personalDetails")}</TabsTrigger>
          <TabsTrigger value="employment" data-testid="tab-employment">{t("employees.employment")}</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">{t("employees.documents")}</TabsTrigger>
          <TabsTrigger value="onboarding" data-testid="tab-onboarding">{t("hiring.onboarding")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="pay" data-testid="tab-pay">{t("employees.payRate")}</TabsTrigger>}
          <TabsTrigger value="quizzes" data-testid="tab-quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          {isAdmin && <TabsTrigger value="notes" data-testid="tab-notes">{t("common.notes")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="personal">
          <PersonalInfoTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
        </TabsContent>
        <TabsContent value="employment">
          <EmploymentTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab employee={employee} onGoToTab={setTab} />
        </TabsContent>
        <TabsContent value="onboarding">
          <OnboardingTab employeeId={employee.id} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="pay">
            <PayTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
          </TabsContent>
        )}
        <TabsContent value="quizzes">
          <QuizHistoryTab employee={employee} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab employeeId={employee.id} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="notes">
            <NotesTab employeeId={employee.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PersonalInfoTab({ employee, onUpdate }: { employee: any; onUpdate: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: employee.firstName || "", lastName: employee.lastName || "",
    preferredName: employee.preferredName || "", pronouns: employee.pronouns || "",
    dateOfBirth: employee.dateOfBirth || "",
    personalEmail: employee.personalEmail || "", personalPhone: employee.personalPhone || "",
    address: employee.address || "", city: employee.city || "", state: employee.state || "", zip: employee.zip || "",
    emergencyContactName: employee.emergencyContactName || "",
    emergencyContactRelationship: employee.emergencyContactRelationship || "",
    emergencyContactPhone: employee.emergencyContactPhone || "",
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Personal Information</CardTitle>
        <Button variant="outline" size="sm" onClick={() => {
          if (editing) { onUpdate(form); setEditing(false); } else { setEditing(true); }
        }} data-testid="button-edit-personal">{editing ? "Save" : "Edit"}</Button>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              <div><Label>Preferred Name</Label><Input value={form.preferredName} onChange={e => setForm({ ...form, preferredName: e.target.value })} /></div>
              <div><Label>Pronouns</Label><Input value={form.pronouns} onChange={e => setForm({ ...form, pronouns: e.target.value })} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.personalEmail} onChange={e => setForm({ ...form, personalEmail: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.personalPhone} onChange={e => setForm({ ...form, personalPhone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div><Label>Zip</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
            </div>
            <h4 className="font-semibold text-sm mt-4">Emergency Contact</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Name</Label><Input value={form.emergencyContactName} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} /></div>
              <div><Label>Relationship</Label><Input value={form.emergencyContactRelationship} onChange={e => setForm({ ...form, emergencyContactRelationship: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.emergencyContactPhone} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} /></div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2">
              <div><span className="text-muted-foreground">Name:</span> {employee.firstName} {employee.lastName}</div>
              {employee.preferredName && <div><span className="text-muted-foreground">Preferred:</span> {employee.preferredName}</div>}
              {employee.pronouns && <div><span className="text-muted-foreground">Pronouns:</span> {employee.pronouns}</div>}
              {employee.dateOfBirth && <div><span className="text-muted-foreground">DOB:</span> {employee.dateOfBirth}</div>}
              {employee.personalEmail && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {employee.personalEmail}</div>}
              {employee.personalPhone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {employee.personalPhone}</div>}
            </div>
            {employee.address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[employee.address, employee.city, employee.state, employee.zip].filter(Boolean).join(", ")}</div>}
            {employee.emergencyContactName && (
              <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                <p className="font-semibold text-xs text-red-700 mb-1">Emergency Contact</p>
                <p>{employee.emergencyContactName} ({employee.emergencyContactRelationship}) — {employee.emergencyContactPhone}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmploymentTab({ employee, onUpdate }: { employee: any; onUpdate: (data: any) => void }) {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    jobTitle: employee.jobTitle || "", department: employee.department || "",
    employmentType: employee.employmentType || "Full-time", startDate: employee.startDate || "",
    endDate: employee.endDate || "", supervisor: employee.supervisor || "",
    workLocation: employee.workLocation || "", status: employee.status || "Active",
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Employment Details</CardTitle>
        <Button variant="outline" size="sm" onClick={() => {
          if (editing) { onUpdate(form); setEditing(false); } else { setEditing(true); }
        }} data-testid="button-edit-employment">{editing ? "Save" : "Edit"}</Button>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Job Title</Label><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} /></div>
              <div><Label>Division</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
              <div>
                <Label>Employment Type</Label>
                <Select value={form.employmentType} onValueChange={v => setForm({ ...form, employmentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Seasonal">Seasonal</SelectItem>
                    <SelectItem value="Contractor">Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAdminOrManager && (
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger data-testid="select-employee-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Terminated">Terminated</SelectItem>
                      <SelectItem value="Seasonal Off">Seasonal Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><Label>Supervisor</Label><Input value={form.supervisor} onChange={e => setForm({ ...form, supervisor: e.target.value })} /></div>
              <div><Label>Work Location</Label><Input value={form.workLocation} onChange={e => setForm({ ...form, workLocation: e.target.value })} /></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm">
            {employee.employeeNumber && <div><span className="text-muted-foreground">Employee ID:</span> {employee.employeeNumber}</div>}
            <div><span className="text-muted-foreground">Title:</span> {employee.jobTitle || "\u2014"}</div>
            <div><span className="text-muted-foreground">Division:</span> {employee.department || "\u2014"}</div>
            <div><span className="text-muted-foreground">Type:</span> {employee.employmentType}</div>
            <div><span className="text-muted-foreground">Start:</span> {employee.startDate || "\u2014"}</div>
            {employee.endDate && <div><span className="text-muted-foreground">End:</span> {employee.endDate}</div>}
            <div><span className="text-muted-foreground">Supervisor:</span> {employee.supervisor || "\u2014"}</div>
            <div><span className="text-muted-foreground">Location:</span> {employee.workLocation || "\u2014"}</div>
            {isAdminOrManager && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  employee.status === "Active" ? "bg-green-100 text-green-800" :
                  employee.status === "On Leave" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-700"
                }`}>{employee.status || "Active"}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TOR_STATUS_COLOR: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  Denied: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

const CA_BADGE_COLOR: Record<string, string> = {
  "Verbal Warning": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Written Warning": "bg-orange-50 text-orange-700 border-orange-200",
  "Final Warning": "bg-red-50 text-red-700 border-red-200",
  "Suspension": "bg-red-100 text-red-800 border-red-300",
  "Termination": "bg-red-200 text-red-900 border-red-400",
};

function SectionHeader({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      {action}
    </div>
  );
}

function DocumentsTab({ employee, onGoToTab }: { employee: any; onGoToTab?: (tab: string) => void }) {
  const employeeId = employee.id;
  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();
  const { toast } = useToast();
  const { user } = useAuth();
  const isHR = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
  const isAdmin = user?.role === "Admin" || user?.isMasterAdmin;

  const [shareDoc, setShareDoc] = useState<any>(null);
  const [assignFormOpen, setAssignFormOpen] = useState(false);
  const [correctiveActionOpen, setCorrectiveActionOpen] = useState(false);
  const [viewCAOpen, setViewCAOpen] = useState<any>(null);
  const [viewResignOpen, setViewResignOpen] = useState<any>(null);
  const [sendAgreementOpen, setSendAgreementOpen] = useState(false);
  const [sendAgreementTemplateId, setSendAgreementTemplateId] = useState("");
  const [sendAgreementPayRate, setSendAgreementPayRate] = useState("");
  const [sendAgreementStartDate, setSendAgreementStartDate] = useState("");
  const [oshaFormOpen, setOshaFormOpen] = useState(false);
  const [viewOSHAOpen, setViewOSHAOpen] = useState<any>(null);

  const { data: docs = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/documents`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/documents`)).json(),
  });

  const { data: timeOffRequests = [], isLoading: torLoading } = useQuery({
    queryKey: [`/api/employees/${employeeId}/time-off-requests`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/time-off-requests`)).json(),
    enabled: isHR,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: resignationLetters = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/resignation-letters`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/resignation-letters`)).json(),
    enabled: isHR,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: correctiveActions = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/corrective-actions`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/corrective-actions`)).json(),
    enabled: isHR,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: allOnboardingForms = [], refetch: refetchOnboarding } = useQuery<any[]>({
    queryKey: [`/api/onboarding-forms`, employeeId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/onboarding-forms?employeeId=${employeeId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isHR,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const oshaReports = (allOnboardingForms as any[]).filter((f) => f.form_type === "osha_incident" || f.formType === "osha_incident");

  const reviewTORMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/time-off-requests/${id}`, { status, reviewNotes });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: `Request ${vars.status}` });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/time-off-requests`] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const { data: agreementTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/agreement-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/agreement-templates")).json(),
    enabled: isAdmin,
  });

  const { data: employeeAgreements = [] } = useQuery<any[]>({
    queryKey: [`/api/employees/${employeeId}/agreements`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/agreements`)).json(),
    enabled: isAdmin,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const sendAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!sendAgreementTemplateId) throw new Error("Please select a template.");
      const res = await apiRequest("POST", `/api/employees/${employeeId}/send-agreement`, {
        templateId: sendAgreementTemplateId,
        payRate: sendAgreementPayRate,
        startDate: sendAgreementStartDate,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Agreement sent", description: "The employee will receive an email with a signing link." });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/agreements`] });
      setSendAgreementOpen(false);
      setSendAgreementTemplateId("");
      setSendAgreementPayRate("");
      setSendAgreementStartDate("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleDropZoneUpload = React.useCallback(async (files: File[]) => {
    for (const file of files) {
      const result = await uploadFile(file);
      if (!result) throw new Error("Upload failed");
      await apiRequest("POST", `/api/employees/${employeeId}/documents`, {
        name: file.name, type: "upload", url: result.objectPath, status: "Completed",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/documents`] });
      toast({ title: "Document uploaded" });
    }
  }, [uploadFile, employeeId, queryClient, toast]);

  return (
    <div className="space-y-5">

      {/* ── SECTION 1: Personal Information ────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Personal Information</span>
            </div>
            {onGoToTab && (
              <Button size="sm" variant="outline" onClick={() => onGoToTab("personal")} data-testid="button-go-personal-tab">
                View &amp; Edit
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {employee.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </div>
            )}
            {employee.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{employee.phone}</span>
              </div>
            )}
            {(employee.address || employee.city) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {[employee.address, employee.city, employee.state].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {employee.startDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Started {new Date(employee.startDate + "T12:00:00").toLocaleDateString()}</span>
              </div>
            )}
          </div>
          {!employee.email && !employee.phone && !employee.address && !employee.startDate && (
            <p className="text-sm text-muted-foreground">No personal details on file. Click "View &amp; Edit" to add them.</p>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 2: Onboarding Forms ────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <SectionHeader
            icon={ClipboardList}
            title="Onboarding Forms"
            action={
              isHR && (
                <Button size="sm" variant="outline" onClick={() => setAssignFormOpen(true)} data-testid="button-assign-form">
                  <Plus className="h-3 w-3 mr-1" /> Assign Form
                </Button>
              )
            }
          />
          <OnboardingChecklist employeeId={employeeId} showCard={false} />
        </CardContent>
      </Card>

      {/* ── SECTION 3: Employment Documents ────────────────────────── */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <SectionHeader icon={FileText} title="Employment Documents" />

          {/* Uploaded Documents */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Uploaded Files</p>
            <DocumentDropZone onFilesSelected={handleDropZoneUpload} className="mb-3" />
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`doc-${doc.id}`}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{doc.name}</span>
                      <Badge variant="outline" className="text-xs">{doc.status}</Badge>
                    </div>
                    <div className="flex gap-1">
                      {doc.url && isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => setShareDoc(doc)} data-testid={`share-doc-${doc.id}`} title="Share Externally">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      {doc.url ? (
                        <Button size="sm" variant="ghost" onClick={() => window.open(doc.url, "_blank")} data-testid={`view-doc-${doc.id}`}>View</Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Awaiting upload</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shared & Library Documents */}
          <div>
            <DocumentsPanel
              entityType="employee"
              entityId={employeeId}
              canUpload
              canShare
              canLink
              canDelete
              canAttachFromLibrary
              module="employee"
              title="Shared & Library Documents"
            />
          </div>

          {/* Employment Agreements */}
          {isAdmin && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employment Agreements</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSendAgreementOpen(true)} data-testid="button-send-agreement">
                    <Send className="h-3 w-3 mr-1" /> Send Agreement
                  </Button>
                </div>
                {employeeAgreements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agreements sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {employeeAgreements.map((ag: any) => (
                      <div key={ag.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`agreement-row-${ag.id}`}>
                        <div>
                          <p className="text-sm font-medium">{ag.year} {ag.position_title}</p>
                          <p className="text-xs text-muted-foreground">
                            Sent {new Date(ag.sent_at).toLocaleDateString()}
                            {ag.signed_at ? ` · Signed ${new Date(ag.signed_at).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                        <Badge className={
                          ag.status === "Signed"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }>{ag.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Corrective Actions */}
          {isHR && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Corrective Actions</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCorrectiveActionOpen(true)} data-testid="button-issue-corrective-action"
                    className="text-red-600 border-red-200 hover:bg-red-50">
                    <Plus className="h-3 w-3 mr-1" /> Issue Report
                  </Button>
                </div>
                {correctiveActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No corrective actions on file.</p>
                ) : (
                  <div className="space-y-2">
                    {correctiveActions.map((ca: any) => (
                      <div key={ca.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`ca-row-${ca.id}`}>
                        <div className="flex items-center gap-3">
                          <Badge className={`${CA_BADGE_COLOR[ca.action_taken] || ""} border text-xs`}>{ca.action_taken}</Badge>
                          <div>
                            <p className="text-sm font-medium">{ca.date_of_incident}</p>
                            <p className="text-xs text-muted-foreground">By: {ca.issued_by_name || ca.issued_by_username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={ca.status === "Signed" ? "text-green-700 border-green-300 bg-green-50 text-xs" : "text-amber-700 border-amber-300 bg-amber-50 text-xs"}>
                            {ca.status || "Pending Signature"}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => setViewCAOpen(ca)} data-testid={`view-ca-${ca.id}`}>View</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* OSHA 301 Incident Reports */}
          {isHR && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OSHA 301 Incident Reports</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOshaFormOpen(true)} data-testid="button-file-osha-report"
                    className="text-orange-600 border-orange-200 hover:bg-orange-50">
                    <Plus className="h-3 w-3 mr-1" /> File Report
                  </Button>
                </div>
                {oshaReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No OSHA 301 incident reports on file.</p>
                ) : (
                  <div className="space-y-2">
                    {oshaReports.map((report: any) => {
                      const data = report.submission_data || report.submissionData || {};
                      return (
                        <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`osha-row-${report.id}`}>
                          <div>
                            <p className="text-sm font-medium">Incident: {data.dateOfInjury || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {data.whatHappened ? data.whatHappened.slice(0, 60) + (data.whatHappened.length > 60 ? "…" : "") : ""}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setViewOSHAOpen(report)} data-testid={`view-osha-${report.id}`}>View</Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* OSHA 301 File Report Dialog */}
      <Dialog open={oshaFormOpen} onOpenChange={setOshaFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>File OSHA 301 Incident Report</DialogTitle>
            <DialogDescription>Document a workplace injury or illness for {employeeName}. Employee information has been pre-filled.</DialogDescription>
          </DialogHeader>
          <OSHAIncidentForm
            employeeId={employee.id}
            preFillEmployee={{
              firstName: employee.firstName,
              lastName: employee.lastName,
              startDate: employee.startDate,
            }}
            onComplete={() => {
              setOshaFormOpen(false);
              refetchOnboarding();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* OSHA View Dialog */}
      {viewOSHAOpen && (
        <Dialog open={!!viewOSHAOpen} onOpenChange={(o) => !o && setViewOSHAOpen(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>OSHA 301 Incident Report</DialogTitle>
              <DialogDescription>{employeeName} · Incident: {(viewOSHAOpen.submission_data || viewOSHAOpen.submissionData || {}).dateOfInjury || "—"}</DialogDescription>
            </DialogHeader>
            <OSHAIncidentForm
              employeeId={employee.id}
              submissionId={viewOSHAOpen.id}
              readOnly
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Send Agreement Dialog */}
      <Dialog open={sendAgreementOpen} onOpenChange={setSendAgreementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Employment Agreement</DialogTitle>
            <DialogDescription>Select a template and fill in the details. The employee will receive an email with a secure signing link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Agreement Template</Label>
              <Select value={sendAgreementTemplateId} onValueChange={setSendAgreementTemplateId}>
                <SelectTrigger data-testid="select-agreement-template">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {agreementTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.year} — {t.position_title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pay Rate ($/hr) <span className="text-muted-foreground text-xs">optional</span></Label>
              <Input
                type="text"
                placeholder="e.g. 22.50"
                value={sendAgreementPayRate}
                onChange={e => setSendAgreementPayRate(e.target.value)}
                data-testid="input-agreement-pay-rate"
              />
            </div>
            <div className="space-y-2">
              <Label>Start Date <span className="text-muted-foreground text-xs">optional</span></Label>
              <Input
                type="date"
                value={sendAgreementStartDate}
                onChange={e => setSendAgreementStartDate(e.target.value)}
                data-testid="input-agreement-start-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendAgreementOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendAgreementMutation.mutate()}
              disabled={sendAgreementMutation.isPending || !sendAgreementTemplateId}
              data-testid="button-confirm-send-agreement"
            >
              {sendAgreementMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : <><Send className="h-4 w-4 mr-2" /> Send Agreement</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SECTION 4: Employee-Initiated Forms ────────────────────── */}
      {isHR && (
        <Card>
          <CardContent className="p-4 space-y-5">
            <SectionHeader icon={LogOut} title="Employee-Initiated Forms" />

            {/* Time Off Requests */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Time Off Requests</p>
              {torLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
              ) : timeOffRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time off requests.</p>
              ) : (
                <div className="space-y-2">
                  {timeOffRequests.map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`tor-row-${req.id}`}>
                      <div>
                        <p className="text-sm font-medium">{req.request_type} · {req.start_date} → {req.end_date}</p>
                        <p className="text-xs text-muted-foreground">{req.total_days} day{req.total_days !== 1 ? "s" : ""}{req.notes ? ` · ${req.notes}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={TOR_STATUS_COLOR[req.status] || ""}>{req.status}</Badge>
                        {req.status === "Pending" && isHR && (
                          <>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                              disabled={reviewTORMutation.isPending}
                              onClick={() => reviewTORMutation.mutate({ id: req.id, status: "Approved" })}
                              data-testid={`approve-tor-${req.id}`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={reviewTORMutation.isPending}
                              onClick={() => reviewTORMutation.mutate({ id: req.id, status: "Denied" })}
                              data-testid={`deny-tor-${req.id}`}
                            >
                              <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Deny
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Resignation Letters */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resignation Letters</p>
              {resignationLetters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No resignation letters on file.</p>
              ) : (
                <div className="space-y-2">
                  {resignationLetters.map((rl: any) => (
                    <div key={rl.id} className="flex items-center justify-between p-3 border rounded-lg border-red-200/70 bg-red-50/20" data-testid={`rl-row-${rl.id}`}>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <LogOut className="h-3.5 w-3.5 text-red-500" /> Resignation Notice
                        </p>
                        <p className="text-xs text-muted-foreground">Last day: {rl.last_day_of_work} · Submitted: {new Date(rl.submitted_at).toLocaleDateString()}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setViewResignOpen(rl)} data-testid={`view-rl-${rl.id}`}>View</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── DIALOGS ──────────────────────────────────────────────── */}
      {shareDoc && (
        <ShareExternallyDialog
          open={!!shareDoc}
          onOpenChange={(open) => !open && setShareDoc(null)}
          documentType="employee_document"
          documentId={shareDoc.id}
          documentName={shareDoc.name}
          documentUrl={shareDoc.url}
        />
      )}

      {assignFormOpen && (
        <AssignFormDialog open={assignFormOpen} onOpenChange={setAssignFormOpen} employeeId={employeeId} />
      )}

      {/* Issue Corrective Action */}
      <Dialog open={correctiveActionOpen} onOpenChange={setCorrectiveActionOpen}>
        <DialogContent className="max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" /> Issue Corrective Action Report
            </DialogTitle>
            <DialogDescription>For: {employeeName}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
            <CorrectiveActionForm
              preSelectedEmployeeId={employeeId}
              onComplete={() => {
                setCorrectiveActionOpen(false);
                queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/corrective-actions`] });
              }}
            />
          </div>
          <div className="shrink-0 pt-2 border-t">
            <Button variant="outline" className="w-full" onClick={() => setCorrectiveActionOpen(false)} data-testid="button-cancel-corrective-action">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Corrective Action */}
      {viewCAOpen && (
        <Dialog open={!!viewCAOpen} onOpenChange={(o) => !o && setViewCAOpen(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Corrective Action Report</DialogTitle>
              <DialogDescription>{employeeName} · {viewCAOpen.date_of_incident}</DialogDescription>
            </DialogHeader>
            <CorrectiveActionForm readOnly existingData={viewCAOpen} />
          </DialogContent>
        </Dialog>
      )}

      {/* View Resignation Letter */}
      {viewResignOpen && (
        <Dialog open={!!viewResignOpen} onOpenChange={(o) => !o && setViewResignOpen(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <LogOut className="h-5 w-5" /> Resignation Letter
              </DialogTitle>
              <DialogDescription>{employeeName}</DialogDescription>
            </DialogHeader>
            <ResignationLetterForm
              readOnly
              existingData={viewResignOpen}
              employeeId={employeeId}
              employeeName={employeeName}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AssignFormDialog({ open, onOpenChange, employeeId }: { open: boolean; onOpenChange: (v: boolean) => void; employeeId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedForm, setSelectedForm] = useState("");

  const FORM_TYPES: Record<string, string> = {
    w4: "W-4 Tax Withholding",
    i9: "I-9 Employment Eligibility",
    ohio_it4: "Ohio IT-4 Withholding",
    direct_deposit: "Direct Deposit Authorization",
    handbook_acknowledgment: "Employee Handbook Acknowledgment",
    emergency_contact: "Emergency Contact Info",
    background_check_auth: "Background Check Authorization",
    nda: "Non-Disclosure Agreement",
    employment_application: "Employment Application",
    workers_comp_first_report: "Workers' Comp First Report",
    osha_incident: "OSHA 301 Incident Report",
  };

  const assignMutation = useMutation({
    mutationFn: async (formType: string) => {
      const res = await apiRequest("POST", "/api/onboarding-forms", {
        formType,
        employeeId,
        status: "draft",
        submissionData: {},
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Form assigned successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/onboarding`] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to assign form", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Form to Employee</DialogTitle>
          <DialogDescription>Select a form to assign. The employee will be able to fill it out from their dashboard.</DialogDescription>
        </DialogHeader>
        <Select value={selectedForm} onValueChange={setSelectedForm}>
          <SelectTrigger data-testid="select-form-type">
            <SelectValue placeholder="Select a form..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FORM_TYPES).map(([key, label]) => (
              <SelectItem key={key} value={key} data-testid={`form-option-${key}`}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!selectedForm || assignMutation.isPending}
            onClick={() => assignMutation.mutate(selectedForm)}
            data-testid="button-confirm-assign"
          >
            {assignMutation.isPending ? "Assigning..." : "Assign Form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingTab({ employeeId }: { employeeId: string }) {
  return <OnboardingChecklist employeeId={employeeId} showCard={true} />;
}

function PayTab({ employee, onUpdate }: { employee: any; onUpdate: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    payRate: employee.payRate || "", payType: employee.payType || "hourly",
    payPeriod: employee.payPeriod || "bi-weekly", paymentMethod: employee.paymentMethod || "direct deposit",
  });

  const { data: payHistory = [] } = useQuery({
    queryKey: [`/api/employees/${employee.id}/pay-history`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employee.id}/pay-history`)).json(),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Pay & Payroll</CardTitle>
        <Button variant="outline" size="sm" onClick={() => {
          if (editing) { onUpdate(form); setEditing(false); } else { setEditing(true); }
        }} data-testid="button-edit-pay">{editing ? "Save" : "Edit"}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Pay Rate</Label><Input value={form.payRate} onChange={e => setForm({ ...form, payRate: e.target.value })} placeholder="e.g. $18.00" /></div>
            <div>
              <Label>Pay Type</Label>
              <Select value={form.payType} onValueChange={v => setForm({ ...form, payType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pay Period</Label>
              <Select value={form.payPeriod} onValueChange={v => setForm({ ...form, payPeriod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct deposit">Direct Deposit</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm">
            <div><span className="text-muted-foreground">Rate:</span> {employee.payRate || "\u2014"} ({employee.payType || "hourly"})</div>
            <div><span className="text-muted-foreground">Period:</span> {employee.payPeriod || "\u2014"}</div>
            <div><span className="text-muted-foreground">Method:</span> {employee.paymentMethod || "\u2014"}</div>
            {employee.accountLast4 && <div><span className="text-muted-foreground">Account:</span> ****{employee.accountLast4}</div>}
          </div>
        )}

        {payHistory.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Pay History</h4>
            <div className="space-y-1">
              {payHistory.map((entry: any) => (
                <div key={entry.id} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                  <span>{entry.oldRate} \u2192 {entry.newRate} \u2014 {entry.reason || "No reason"}</span>
                  <span className="text-muted-foreground text-xs">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryTab({ employeeId }: { employeeId: string }) {
  const [newEntry, setNewEntry] = useState({ changeType: "", details: "" });
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/history`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/history`)).json(),
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/employees/${employeeId}/history`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/history`] });
      setNewEntry({ changeType: "", details: "" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Employment History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Change type..." value={newEntry.changeType} onChange={e => setNewEntry({ ...newEntry, changeType: e.target.value })} className="w-40" />
          <Input placeholder="Details..." value={newEntry.details} onChange={e => setNewEntry({ ...newEntry, details: e.target.value })} className="flex-1" />
          <Button size="sm" onClick={() => newEntry.changeType && newEntry.details && addMutation.mutate(newEntry)} disabled={!newEntry.changeType || !newEntry.details}>Add</Button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No history entries yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 p-2 border-l-2 border-primary/30 pl-4">
                <div className="flex-1">
                  <Badge variant="outline" className="text-xs mb-1">{entry.changeType}</Badge>
                  <p className="text-sm">{entry.details}</p>
                  <p className="text-xs text-muted-foreground">{entry.recordedBy} — {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotesTab({ employeeId }: { employeeId: string }) {
  const [newNote, setNewNote] = useState("");
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/notes`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/notes`)).json(),
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/employees/${employeeId}/notes`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/notes`] });
      setNewNote("");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Private Notes</CardTitle>
        <CardDescription>Visible to HR and managers only</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a private note..." rows={2} className="flex-1" data-testid="input-note" />
          <Button size="sm" onClick={() => newNote.trim() && addMutation.mutate(newNote.trim())} disabled={!newNote.trim()} className="self-end" data-testid="button-add-note">Add</Button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note: any) => (
              <div key={note.id} className="p-3 bg-muted/50 rounded">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{note.authorName}</span>
                  <span>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</span>
                </div>
                <p className="text-sm">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const LEVEL_LABELS: Record<number, string> = {
  0: "Not Reached",
  1: "Foundational",
  2: "Competent",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

function QuizHistoryTab({ employee }: { employee: any }) {
  const userId = employee.userId;

  const { data: attempts = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/quiz-attempts/user/${userId}`],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest("GET", `/api/quiz-attempts/user/${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const totalAttempts = attempts.length;
  const totalPassed = attempts.filter((a: any) => a.passed).length;
  const uniqueQuizzes = new Set(attempts.map((a: any) => a.quiz_id)).size;
  const passRate = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0;

  if (!userId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          This employee does not have a linked user account. Quiz history is only available for employees with a portal login.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground" data-testid="quiz-total-attempts">{totalAttempts}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600" data-testid="quiz-passed">{totalPassed}</p>
            <p className="text-xs text-muted-foreground mt-1">Passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground" data-testid="quiz-unique">{uniqueQuizzes}</p>
            <p className="text-xs text-muted-foreground mt-1">Unique Quizzes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary" data-testid="quiz-pass-rate">{passRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Quiz Attempt History
          </CardTitle>
          <CardDescription>All quiz attempts — every result is permanently recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : attempts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No quiz attempts recorded yet. This employee has not taken any quizzes.
            </div>
          ) : (
            <div className="space-y-2">
              {attempts.map((attempt: any, idx: number) => {
                const pct = attempt.total_questions > 0
                  ? Math.round((attempt.score / attempt.total_questions) * 100)
                  : 0;
                const levelLabel = LEVEL_LABELS[attempt.highest_level_passed] ?? "Unknown";
                const takenAt = attempt.completed_at
                  ? new Date(attempt.completed_at)
                  : null;

                return (
                  <div
                    key={attempt.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    data-testid={`quiz-attempt-row-${idx}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground truncate">{attempt.sop_title}</span>
                        {attempt.is_safety_critical && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0">Safety Critical</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {attempt.quiz_title}
                        {attempt.sop_category && <span className="ml-2 opacity-60">· {attempt.sop_category}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <div className="text-center min-w-[54px]">
                        <p className="text-sm font-semibold text-foreground" data-testid={`quiz-score-${idx}`}>
                          {attempt.score}/{attempt.total_questions}
                        </p>
                        <p className="text-xs text-muted-foreground">{pct}%</p>
                      </div>

                      <div className="text-center min-w-[80px]">
                        <p className="text-xs font-medium text-muted-foreground">{levelLabel}</p>
                        <p className="text-xs text-muted-foreground opacity-70">
                          {attempt.final_score_label || "—"}
                        </p>
                      </div>

                      <Badge
                        variant={attempt.passed ? "default" : "destructive"}
                        className={`text-xs px-2 min-w-[58px] justify-center ${attempt.passed ? "bg-green-600 hover:bg-green-700" : ""}`}
                        data-testid={`quiz-pass-badge-${idx}`}
                      >
                        {attempt.passed ? "PASSED" : "NOT PASSED"}
                      </Badge>

                      <div className="text-right min-w-[110px]">
                        {takenAt ? (
                          <>
                            <p className="text-xs text-foreground">{takenAt.toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground">{takenAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
