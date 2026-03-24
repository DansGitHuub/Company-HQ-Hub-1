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
import { Loader2, Plus, Pencil, Trash2, FileSignature, Send, Info, Users } from "lucide-react";
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
  first_name: string;
  last_name: string;
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

  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showHints, setShowHints] = useState(false);

  // Bulk send state
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState<Template | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, { payRate: string; startDate: string }>>({});
  const [bulkPayRate, setBulkPayRate] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [applyToAll, setApplyToAll] = useState(true);

  const [form, setForm] = useState({ id: "", positionTitle: "", year: new Date().getFullYear(), templateBody: "" });
  const isEditing = !!form.id;

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
      const payload = { positionTitle: form.positionTitle, year: form.year, templateBody: form.templateBody };
      if (isEditing) return (await apiRequest("PUT", `/api/agreement-templates/${form.id}`, payload)).json();
      return (await apiRequest("POST", "/api/agreement-templates", payload)).json();
    },
    onSuccess: () => {
      toast({ title: isEditing ? "Template updated" : "Template created" });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement-templates"] });
      setEditOpen(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/agreement-templates/${id}`),
    onSuccess: () => {
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement-templates"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
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

  async function openEdit(tmpl?: Template) {
    if (tmpl) {
      const full = await (await apiRequest("GET", `/api/agreement-templates/${tmpl.id}`)).json();
      setForm({ id: full.id, positionTitle: full.position_title, year: full.year, templateBody: full.template_body });
    } else {
      setForm({ id: "", positionTitle: "", year: new Date().getFullYear(), templateBody: "" });
    }
    setEditOpen(true);
  }

  function openBulkSend(tmpl: Template) {
    setBulkTemplate(tmpl);
    setSelectedEmployees({});
    setBulkPayRate("");
    setBulkStartDate("");
    setApplyToAll(true);
    setBulkSendOpen(true);
  }

  function openPreview() {
    const sample = { employee_name: "Jane Smith", year: String(form.year), pay_rate: "22.50", start_date: new Date().toLocaleDateString(), position: form.positionTitle };
    let html = form.templateBody;
    for (const [k, v] of Object.entries(sample)) html = html.replaceAll(`{{${k}}}`, v);
    setPreviewHtml(html);
    setPreviewOpen(true);
  }

  function toggleEmployee(empId: string) {
    setSelectedEmployees(prev => {
      const next = { ...prev };
      if (next[empId] !== undefined) delete next[empId];
      else next[empId] = { payRate: "", startDate: "" };
      return next;
    });
  }

  const activeEmployees = employees.filter((e: Employee) => e.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Agreement Templates</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage employment agreement templates for each position.</p>
        </div>
        <Button onClick={() => openEdit()} data-testid="button-new-template">
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
          <Button className="mt-4" onClick={() => openEdit()}>Create Template</Button>
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
                  <Button size="sm" variant="outline" onClick={() => openEdit(tmpl)} data-testid={`edit-template-${tmpl.id}`}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
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

      {/* Edit / Create dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{isEditing ? `Editing: ${form.positionTitle}` : "Create New Template"}</DialogTitle>
            <DialogDescription>
              Use the editor below to write your agreement. Format text with the toolbar, and type placeholders like <code>{"{{employee_name}}"}</code> anywhere — they'll fill in automatically when sent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 flex-1 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Position Title</Label>
                <Input
                  placeholder="e.g. Softscape Foreman"
                  value={form.positionTitle}
                  onChange={e => setForm(f => ({ ...f, positionTitle: e.target.value }))}
                  data-testid="input-position-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Agreement Year</Label>
                <Input
                  type="number" min={2020} max={2099}
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || f.year }))}
                  data-testid="input-agreement-year"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Agreement Content</Label>
                <Button size="sm" variant="ghost" onClick={openPreview} disabled={!form.templateBody} data-testid="button-preview-template" className="text-xs h-7">
                  Preview with sample data
                </Button>
              </div>
              <RichTextEditor
                value={form.templateBody}
                onChange={html => setForm(f => ({ ...f, templateBody: html }))}
                minHeight="450px"
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.positionTitle || !form.templateBody}
              data-testid="button-save-template"
            >
              {saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preview (with sample data)</DialogTitle></DialogHeader>
          <div className="bg-white border rounded p-8 agreement-prose" style={{ fontFamily: "Georgia, serif", lineHeight: "1.8" }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          <DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send dialog */}
      <Dialog open={bulkSendOpen} onOpenChange={setBulkSendOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Agreement to Employees</DialogTitle>
            <DialogDescription>
              Select the employees to receive the <strong>{bulkTemplate?.year} {bulkTemplate?.position_title}</strong> agreement. Each person gets their own personalized copy with their name filled in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Apply same pay/date to all */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="apply-all" checked={applyToAll} onCheckedChange={v => setApplyToAll(!!v)} data-testid="checkbox-apply-all" />
                <label htmlFor="apply-all" className="text-sm font-medium cursor-pointer">Use the same pay rate and start date for everyone selected</label>
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

            {/* Employee list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Select Employees</Label>
                <span className="text-xs text-muted-foreground">{Object.keys(selectedEmployees).length} selected</span>
              </div>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {activeEmployees.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading employees...</div>
                ) : activeEmployees.map((emp: Employee) => {
                  const isSelected = selectedEmployees[emp.id] !== undefined;
                  return (
                    <div key={emp.id} className="p-3 flex items-start gap-3">
                      <Checkbox
                        id={`emp-${emp.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                        data-testid={`checkbox-emp-${emp.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`emp-${emp.id}`} className="font-medium text-sm cursor-pointer block">
                          {emp.first_name} {emp.last_name}
                        </label>
                        <p className="text-xs text-muted-foreground">{emp.position || "No position"}</p>
                        {!applyToAll && isSelected && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <Input
                              placeholder="Pay rate"
                              size={8}
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
              disabled={bulkSendMutation.isPending || Object.keys(selectedEmployees).length === 0}
              data-testid="button-confirm-bulk-send"
            >
              {bulkSendMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Send to {Object.keys(selectedEmployees).length || ""} Employee{Object.keys(selectedEmployees).length !== 1 ? "s" : ""}</>
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
