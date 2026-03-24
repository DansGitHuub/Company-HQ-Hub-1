import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Pencil, Trash2, FileSignature, Send, Info, Users, Eye } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";

type Template = {
  id: string;
  position_title: string;
  year: number;
  template_body?: string;
  updated_at: string;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  email?: string;
};

const VARIABLE_HINTS = [
  { key: "{{employee_name}}", desc: "Employee's full name" },
  { key: "{{year}}", desc: "Agreement year" },
  { key: "{{pay_rate}}", desc: "Pay rate (e.g. 22.50)" },
  { key: "{{start_date}}", desc: "Employment start date" },
  { key: "{{position}}", desc: "Position title" },
];

export default function AgreementTemplatesPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // View / Edit dialog state
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ positionTitle: "", year: new Date().getFullYear(), templateBody: "" });

  // New template dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ positionTitle: "", year: new Date().getFullYear(), templateBody: "" });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);

  // Bulk send state
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState<Template | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, { payRate: string; startDate: string }>>({});
  const [bulkPayRate, setBulkPayRate] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [applyToAll, setApplyToAll] = useState(true);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/agreement-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/agreement-templates")).json(),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => (await apiRequest("GET", "/api/employees")).json(),
    enabled: bulkSendOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { positionTitle: editForm.positionTitle, year: editForm.year, templateBody: editForm.templateBody };
      return (await apiRequest("PUT", `/api/agreement-templates/${viewTemplate!.id}`, payload)).json();
    },
    onSuccess: (updated: any) => {
      toast({ title: "Template saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement-templates"] });
      setViewTemplate(prev => prev ? { ...prev, ...updated, position_title: updated.position_title || editForm.positionTitle, year: editForm.year, template_body: editForm.templateBody } : prev);
      setIsEditing(false);
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = { positionTitle: newForm.positionTitle, year: newForm.year, templateBody: newForm.templateBody };
      return (await apiRequest("POST", "/api/agreement-templates", payload)).json();
    },
    onSuccess: () => {
      toast({ title: "Template created" });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement-templates"] });
      setNewOpen(false);
      setNewForm({ positionTitle: "", year: new Date().getFullYear(), templateBody: "" });
    },
    onError: (e: any) => toast({ title: "Failed to create", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/agreement-templates/${id}`),
    onSuccess: () => {
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement-templates"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const bulkSendMutation = useMutation({
    mutationFn: async () => {
      const selected = Object.entries(selectedEmployees).filter(([, v]) => v !== undefined);
      if (!selected.length) throw new Error("Please select at least one employee.");
      const results = await Promise.allSettled(
        selected.map(([empId, overrides]) =>
          apiRequest("POST", `/api/employees/${empId}/send-agreement`, {
            templateId: bulkTemplate!.id,
            payRate: applyToAll ? bulkPayRate : overrides.payRate,
            startDate: applyToAll ? bulkStartDate : overrides.startDate,
          })
        )
      );
      const failed = results.filter(r => r.status === "rejected").length;
      const sent = results.filter(r => r.status === "fulfilled").length;
      if (failed) throw new Error(`${sent} sent, ${failed} failed.`);
      return { sent };
    },
    onSuccess: ({ sent }) => {
      toast({ title: `Agreement sent to ${sent} employee${sent !== 1 ? "s" : ""}` });
      setBulkSendOpen(false);
      setSelectedEmployees({});
      setBulkPayRate("");
      setBulkStartDate("");
    },
    onError: (e: any) => toast({ title: "Partial send", description: e.message, variant: "destructive" }),
  });

  async function openView(tmpl: Template) {
    const full = await (await apiRequest("GET", `/api/agreement-templates/${tmpl.id}`)).json();
    setViewTemplate(full);
    setEditForm({ positionTitle: full.position_title, year: full.year, templateBody: full.template_body });
    setIsEditing(false);
    setViewOpen(true);
  }

  function startEditing() {
    if (viewTemplate) {
      setEditForm({ positionTitle: viewTemplate.position_title, year: viewTemplate.year, templateBody: viewTemplate.template_body || "" });
    }
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function openBulkSend(tmpl: Template) {
    setBulkTemplate(tmpl);
    setSelectedEmployees({});
    setBulkPayRate("");
    setBulkStartDate("");
    setApplyToAll(true);
    setBulkSendOpen(true);
  }

  function toggleEmployee(empId: string) {
    setSelectedEmployees(prev => {
      const next = { ...prev };
      if (next[empId] !== undefined) delete next[empId];
      else next[empId] = { payRate: "", startDate: "" };
      return next;
    });
  }

  const selectedCount = Object.keys(selectedEmployees).length;
  const selectedNames = Object.keys(selectedEmployees)
    .map(id => {
      const emp = employees.find((e: Employee) => e.id === id);
      return emp ? `${emp.firstName} ${emp.lastName}` : "";
    })
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Agreement Templates</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage employment agreement templates for each position.</p>
        </div>
        <Button onClick={() => setNewOpen(true)} data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {/* Variable hints */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4">
          <button className="flex items-center gap-2 text-sm font-medium text-blue-700 w-full text-left" onClick={() => setShowHints(h => !h)}>
            <Info className="h-4 w-4" />
            Smart Placeholders — click to {showHints ? "hide" : "show"}
          </button>
          {showHints && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-muted-foreground mb-2">Type these exactly in your agreement body. When you send, they fill in automatically with each employee's information.</p>
              {VARIABLE_HINTS.map(v => (
                <div key={v.key} className="flex items-center gap-2 text-sm">
                  <code className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-mono">{v.key}</code>
                  <span className="text-muted-foreground">→ {v.desc}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading templates...</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <FileSignature className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-muted-foreground">No agreement templates yet.</p>
          <Button className="mt-4" onClick={() => setNewOpen(true)}>Create Template</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {templates.map(tmpl => (
            <Card key={tmpl.id} data-testid={`template-row-${tmpl.id}`}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileSignature className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold">{tmpl.position_title}</p>
                    <p className="text-xs text-muted-foreground">Year: {tmpl.year} · Last updated: {new Date(tmpl.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{tmpl.year}</Badge>
                  <Button size="sm" variant="outline" onClick={() => openBulkSend(tmpl)} data-testid={`bulk-send-template-${tmpl.id}`}>
                    <Users className="h-3.5 w-3.5 mr-1" /> Send to Employees
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openView(tmpl)} data-testid={`view-template-${tmpl.id}`}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(tmpl.id)} data-testid={`delete-template-${tmpl.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View / Edit dialog */}
      <Dialog open={viewOpen} onOpenChange={open => { if (!open) { setViewOpen(false); setIsEditing(false); } }}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>
                  {isEditing ? "Editing: " : ""}{viewTemplate?.year} {viewTemplate?.position_title}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isEditing ? "Make changes below and save when ready." : "Read-only view. Click Edit to make changes."}
                </p>
              </div>
              {!isEditing && (
                <Button size="sm" onClick={startEditing} data-testid="button-edit-template">
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Position Title</Label>
                    <Input
                      value={editForm.positionTitle}
                      onChange={e => setEditForm(f => ({ ...f, positionTitle: e.target.value }))}
                      data-testid="input-position-title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Agreement Year</Label>
                    <Input
                      type="number" min={2020} max={2099}
                      value={editForm.year}
                      onChange={e => setEditForm(f => ({ ...f, year: parseInt(e.target.value) || f.year }))}
                      data-testid="input-agreement-year"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Agreement Content</Label>
                  <RichTextEditor
                    value={editForm.templateBody}
                    onChange={html => setEditForm(f => ({ ...f, templateBody: html }))}
                    minHeight="450px"
                  />
                </div>
              </div>
            ) : (
              <div
                className="bg-white border rounded-lg p-8 agreement-prose"
                style={{ fontFamily: "Georgia, serif", lineHeight: "1.8", minHeight: "400px" }}
                dangerouslySetInnerHTML={{ __html: viewTemplate?.template_body || "" }}
              />
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={cancelEditing}>Cancel</Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !editForm.positionTitle || !editForm.templateBody}
                  data-testid="button-save-template"
                >
                  {saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Template dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Write your agreement using the editor. Type placeholders like <code>{"{{employee_name}}"}</code> — they fill in automatically when sent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 flex-1 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Position Title</Label>
                <Input
                  placeholder="e.g. Softscape Foreman"
                  value={newForm.positionTitle}
                  onChange={e => setNewForm(f => ({ ...f, positionTitle: e.target.value }))}
                  data-testid="input-new-position-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Agreement Year</Label>
                <Input
                  type="number" min={2020} max={2099}
                  value={newForm.year}
                  onChange={e => setNewForm(f => ({ ...f, year: parseInt(e.target.value) || f.year }))}
                  data-testid="input-new-agreement-year"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Agreement Content</Label>
              <RichTextEditor
                value={newForm.templateBody}
                onChange={html => setNewForm(f => ({ ...f, templateBody: html }))}
                minHeight="450px"
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newForm.positionTitle || !newForm.templateBody}
              data-testid="button-create-template"
            >
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send dialog */}
      <Dialog open={bulkSendOpen} onOpenChange={setBulkSendOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Agreement to Employees</DialogTitle>
            <DialogDescription>
              Select who should receive the <strong>{bulkTemplate?.year} {bulkTemplate?.position_title}</strong> agreement. Each person gets their own personalized copy with their name filled in automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Pay rate / start date */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="apply-all" checked={applyToAll} onCheckedChange={v => setApplyToAll(!!v)} data-testid="checkbox-apply-all" />
                <label htmlFor="apply-all" className="text-sm font-medium cursor-pointer">Same pay rate and start date for everyone</label>
              </div>
              {applyToAll && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Pay Rate ($/hr)</Label>
                    <Input placeholder="e.g. 22.50" value={bulkPayRate} onChange={e => setBulkPayRate(e.target.value)} data-testid="input-bulk-pay-rate" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} data-testid="input-bulk-start-date" />
                  </div>
                </div>
              )}
            </div>

            {/* Selected summary */}
            {selectedCount > 0 && (
              <div className="text-sm text-muted-foreground px-1">
                <span className="font-medium text-foreground">{selectedCount} selected:</span>{" "}
                {selectedNames.join(", ")}
              </div>
            )}

            {/* Employee list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Select Employees</Label>
                {selectedCount > 0 && (
                  <button className="text-xs text-muted-foreground underline" onClick={() => setSelectedEmployees({})}>Clear all</button>
                )}
              </div>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {employees.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading employees...
                  </div>
                ) : (employees as Employee[]).map((emp) => {
                  const isSelected = selectedEmployees[emp.id] !== undefined;
                  const fullName = `${emp.firstName} ${emp.lastName}`;
                  return (
                    <div
                      key={emp.id}
                      className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => toggleEmployee(emp.id)}
                    >
                      <Checkbox
                        id={`emp-${emp.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                        data-testid={`checkbox-emp-${emp.id}`}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{fullName}</p>
                        <p className="text-xs text-muted-foreground">{emp.position || "No position set"}</p>
                        {!applyToAll && isSelected && (
                          <div className="grid grid-cols-2 gap-2 mt-2" onClick={e => e.stopPropagation()}>
                            <Input
                              placeholder="Pay rate"
                              className="h-7 text-xs"
                              value={selectedEmployees[emp.id]?.payRate || ""}
                              onChange={e => setSelectedEmployees(prev => ({ ...prev, [emp.id]: { ...prev[emp.id], payRate: e.target.value } }))}
                            />
                            <Input
                              type="date"
                              className="h-7 text-xs"
                              value={selectedEmployees[emp.id]?.startDate || ""}
                              onChange={e => setSelectedEmployees(prev => ({ ...prev, [emp.id]: { ...prev[emp.id], startDate: e.target.value } }))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkSendOpen(false)}>Cancel</Button>
            <Button
              onClick={() => bulkSendMutation.mutate()}
              disabled={bulkSendMutation.isPending || selectedCount === 0}
              data-testid="button-confirm-bulk-send"
            >
              {bulkSendMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Send to {selectedCount || ""} {selectedCount === 1 ? "Employee" : "Employees"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the template. Agreements already sent will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
