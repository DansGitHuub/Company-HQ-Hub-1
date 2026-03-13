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
import {
  Plus, Phone, Mail, MapPin, FileText, User, Clock,
  ChevronLeft, Upload, CheckCircle2, Circle, AlertCircle, Users, ExternalLink, ClipboardList
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import ShareExternallyDialog from "@/components/ShareExternallyDialog";
import DocumentDropZone from "@/components/DocumentDropZone";
import DocumentsPanel from "@/components/DocumentsPanel";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-employees-title">
            <Users className="h-6 w-6" /> {t("employees.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {employees.length} {t("common.total")} &middot; {activeCount} {t("status.active")}{onLeaveCount > 0 ? ` \u00b7 ${onLeaveCount} ${t("status.onHold")}` : ""}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-employee">
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
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full" data-testid="table-employees">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">{t("common.name")}</th>
                <th className="text-left p-3 text-sm font-medium">{t("employees.position")}</th>
                <th className="text-left p-3 text-sm font-medium">{t("employees.department")}</th>
                <th className="text-left p-3 text-sm font-medium">{t("employees.startDate")}</th>
                <th className="text-left p-3 text-sm font-medium">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp: any) => (
                <tr
                  key={emp.id}
                  className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedEmployee(emp.id)}
                  data-testid={`row-employee-${emp.id}`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {getInitials(`${emp.firstName} ${emp.lastName}`)}
                      </div>
                      <span className="font-medium text-sm">{emp.firstName} {emp.lastName}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm">{emp.jobTitle || "\u2014"}</td>
                  <td className="p-3 text-sm">{emp.department || "\u2014"}</td>
                  <td className="p-3 text-sm">{emp.startDate || "\u2014"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={
                      emp.status === "Active" ? "text-green-700 bg-green-50" :
                      emp.status === "Terminated" ? "text-red-700 bg-red-50" :
                      emp.status === "On Leave" ? "text-yellow-700 bg-yellow-50" : ""
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
      <div className="grid grid-cols-2 gap-3">
        <div><Label>{t("employees.firstName")} *</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} data-testid="input-emp-first-name" /></div>
        <div><Label>{t("employees.lastName")} *</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} data-testid="input-emp-last-name" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>{t("common.email")}</Label><Input value={form.personalEmail} onChange={e => setForm({ ...form, personalEmail: e.target.value })} /></div>
        <div><Label>{t("common.phone")}</Label><Input value={form.personalPhone} onChange={e => setForm({ ...form, personalPhone: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>{t("employees.position")}</Label><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} /></div>
        <div><Label>{t("employees.department")}</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        <Badge className="ml-auto" variant="outline">{employee.status}</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="personal" data-testid="tab-personal">{t("employees.personalDetails")}</TabsTrigger>
          <TabsTrigger value="employment" data-testid="tab-employment">{t("employees.employment")}</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">{t("employees.documents")}</TabsTrigger>
          <TabsTrigger value="onboarding" data-testid="tab-onboarding">{t("hiring.onboarding")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="pay" data-testid="tab-pay">{t("employees.payRate")}</TabsTrigger>}
          <TabsTrigger value="history" data-testid="tab-history">{t("common.history")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="notes" data-testid="tab-notes">{t("common.notes")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="personal">
          <PersonalInfoTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
        </TabsContent>
        <TabsContent value="employment">
          <EmploymentTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab employeeId={employee.id} />
          <div className="mt-4">
            <DocumentsPanel
              entityType="employee"
              entityId={employee.id}
              canUpload
              canShare
              canLink
              canDelete
              canAttachFromLibrary
              module="employee"
              title="Additional Documents"
            />
          </div>
        </TabsContent>
        <TabsContent value="onboarding">
          <OnboardingTab employeeId={employee.id} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="pay">
            <PayTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
          </TabsContent>
        )}
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              <div><Label>Preferred Name</Label><Input value={form.preferredName} onChange={e => setForm({ ...form, preferredName: e.target.value })} /></div>
              <div><Label>Pronouns</Label><Input value={form.pronouns} onChange={e => setForm({ ...form, pronouns: e.target.value })} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.personalEmail} onChange={e => setForm({ ...form, personalEmail: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.personalPhone} onChange={e => setForm({ ...form, personalPhone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div><Label>Zip</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
            </div>
            <h4 className="font-semibold text-sm mt-4">Emergency Contact</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Name</Label><Input value={form.emergencyContactName} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} /></div>
              <div><Label>Relationship</Label><Input value={form.emergencyContactRelationship} onChange={e => setForm({ ...form, emergencyContactRelationship: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.emergencyContactPhone} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} /></div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Job Title</Label><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
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
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                    <SelectItem value="Seasonal Off">Seasonal Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><Label>Supervisor</Label><Input value={form.supervisor} onChange={e => setForm({ ...form, supervisor: e.target.value })} /></div>
              <div><Label>Work Location</Label><Input value={form.workLocation} onChange={e => setForm({ ...form, workLocation: e.target.value })} /></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            {employee.employeeNumber && <div><span className="text-muted-foreground">Employee ID:</span> {employee.employeeNumber}</div>}
            <div><span className="text-muted-foreground">Title:</span> {employee.jobTitle || "\u2014"}</div>
            <div><span className="text-muted-foreground">Department:</span> {employee.department || "\u2014"}</div>
            <div><span className="text-muted-foreground">Type:</span> {employee.employmentType}</div>
            <div><span className="text-muted-foreground">Start:</span> {employee.startDate || "\u2014"}</div>
            {employee.endDate && <div><span className="text-muted-foreground">End:</span> {employee.endDate}</div>}
            <div><span className="text-muted-foreground">Supervisor:</span> {employee.supervisor || "\u2014"}</div>
            <div><span className="text-muted-foreground">Location:</span> {employee.workLocation || "\u2014"}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.isMasterAdmin;
  const [shareDoc, setShareDoc] = useState<any>(null);
  const [assignFormOpen, setAssignFormOpen] = useState(false);

  const { data: docs = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/documents`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/documents`)).json(),
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Documents</CardTitle>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAssignFormOpen(true)} data-testid="button-assign-form">
            <ClipboardList className="h-4 w-4 mr-1" /> Assign Form
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <DocumentDropZone
          onFilesSelected={handleDropZoneUpload}
          className="mb-3"
        />
        {docs.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-medium">No documents yet</p>
          </div>
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
      </CardContent>

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
        <AssignFormDialog
          open={assignFormOpen}
          onOpenChange={setAssignFormOpen}
          employeeId={employeeId}
        />
      )}
    </Card>
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
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/onboarding`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/onboarding`)).json(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/onboarding-items/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/onboarding`] });
    },
  });

  const completed = items.filter((i: any) => i.status === "Complete").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdue = items.filter((i: any) => i.status !== "Complete" && i.dueDate && new Date(i.dueDate) < new Date());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Onboarding ({pct}%)</CardTitle>
        <Badge variant={pct === 100 ? "default" : "outline"}>{completed}/{total}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No onboarding items assigned yet.</p>
          </div>
        ) : (
          <>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>

            {overdue.length > 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {overdue.length} overdue item(s)
              </div>
            )}

            {["Employee", "Office/HR"].map(category => {
              const catItems = items.filter((i: any) => i.category === category);
              if (catItems.length === 0) return null;
              return (
                <div key={category}>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">{category} Tasks</h4>
                  <div className="space-y-1">
                    {catItems.map((item: any) => {
                      const isOverdue = item.status !== "Complete" && item.dueDate && new Date(item.dueDate) < new Date();
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${isOverdue ? "bg-red-50" : ""}`}
                          onClick={() => updateMutation.mutate({ id: item.id, status: item.status === "Complete" ? "Pending" : "Complete" })}
                          data-testid={`onboarding-item-${item.id}`}
                        >
                          {item.status === "Complete" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <Circle className={`h-4 w-4 flex-shrink-0 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`} />
                          )}
                          <span className={`text-sm flex-1 ${item.status === "Complete" ? "line-through text-muted-foreground" : ""}`}>
                            {item.title}
                          </span>
                          {item.status === "Complete" && item.completedAt && (
                            <span className="text-xs text-muted-foreground">{new Date(item.completedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-y-3 text-sm">
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
