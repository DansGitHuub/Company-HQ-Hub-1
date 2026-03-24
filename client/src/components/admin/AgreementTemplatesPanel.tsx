import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2, FileSignature, Eye, EyeOff, Info } from "lucide-react";

type Template = {
  id: string;
  position_title: string;
  year: number;
  template_body?: string;
  updated_at: string;
};

const VARIABLE_HINTS = [
  { key: "{{employee_name}}", desc: "Employee's full name" },
  { key: "{{year}}", desc: "Agreement year" },
  { key: "{{pay_rate}}", desc: "Hourly pay rate (numbers only, $ added automatically)" },
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

  const [form, setForm] = useState({ id: "", positionTitle: "", year: new Date().getFullYear(), templateBody: "" });
  const isEditing = !!form.id;

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/agreement-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/agreement-templates")).json(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { positionTitle: form.positionTitle, year: form.year, templateBody: form.templateBody };
      if (isEditing) {
        return (await apiRequest("PUT", `/api/agreement-templates/${form.id}`, payload)).json();
      }
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

  async function openEdit(tmpl?: Template) {
    if (tmpl) {
      const full = await (await apiRequest("GET", `/api/agreement-templates/${tmpl.id}`)).json();
      setForm({ id: full.id, positionTitle: full.position_title, year: full.year, templateBody: full.template_body });
    } else {
      setForm({ id: "", positionTitle: "", year: new Date().getFullYear(), templateBody: "" });
    }
    setEditOpen(true);
  }

  function openPreview() {
    const sample = { employee_name: "Jane Smith", year: String(form.year), pay_rate: "22.50", start_date: new Date().toLocaleDateString(), position: form.positionTitle };
    let html = form.templateBody;
    for (const [k, v] of Object.entries(sample)) html = html.replaceAll(`{{${k}}}`, v);
    setPreviewHtml(html);
    setPreviewOpen(true);
  }

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
          <button
            className="flex items-center gap-2 text-sm font-medium text-blue-700 w-full text-left"
            onClick={() => setShowHints(h => !h)}
          >
            <Info className="h-4 w-4" />
            Template Variables – click to {showHints ? "hide" : "show"}
          </button>
          {showHints && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VARIABLE_HINTS.map(v => (
                <div key={v.key} className="flex items-center gap-2 text-sm">
                  <code className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-mono">{v.key}</code>
                  <span className="text-muted-foreground">{v.desc}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-8">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FileSignature className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-muted-foreground">No agreement templates yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first template to start sending agreements to employees.</p>
            <Button className="mt-4" onClick={() => openEdit()}>Create Template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map(tmpl => (
            <Card key={tmpl.id} data-testid={`template-row-${tmpl.id}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSignature className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold">{tmpl.position_title}</p>
                    <p className="text-xs text-muted-foreground">Year: {tmpl.year} · Last updated: {new Date(tmpl.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{tmpl.year}</Badge>
                  <Button size="sm" variant="outline" onClick={() => openEdit(tmpl)} data-testid={`edit-template-${tmpl.id}`}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(tmpl.id)} data-testid={`delete-template-${tmpl.id}`}>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Template" : "Create New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Position Title</Label>
                <Input
                  placeholder="e.g. Softscape Foreman"
                  value={form.positionTitle}
                  onChange={e => setForm(f => ({ ...f, positionTitle: e.target.value }))}
                  data-testid="input-position-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Agreement Year</Label>
                <Input
                  type="number"
                  min={2020}
                  max={2099}
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || f.year }))}
                  data-testid="input-agreement-year"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Agreement Body (HTML)</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={openPreview} disabled={!form.templateBody} data-testid="button-preview-template">
                    <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Use HTML tags for formatting. Use variable placeholders like <code>{"{{employee_name}}"}</code> where dynamic content should appear.</p>
              <Textarea
                value={form.templateBody}
                onChange={e => setForm(f => ({ ...f, templateBody: e.target.value }))}
                rows={20}
                className="font-mono text-xs"
                placeholder="Paste HTML content here..."
                data-testid="textarea-template-body"
              />
            </div>
          </div>
          <DialogFooter>
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
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          <div className="bg-white border rounded p-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the template. Any agreements already sent will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
