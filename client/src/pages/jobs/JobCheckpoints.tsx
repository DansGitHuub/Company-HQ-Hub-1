import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, CheckCircle2, Circle, Camera, ClipboardList,
  CheckSquare, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface Checkpoint {
  id: string;
  name: string;
  description: string | null;
  checkpoint_type: string;
  requires_photo: boolean;
  requires_note: boolean;
  requires_checkbox: boolean;
  assigned_role: string;
  customer_visible: boolean;
  status: string;
  note: string | null;
  photo_url: string | null;
  checked: boolean;
  completed_by_name: string | null;
  completed_at: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  checkpoint_type: string;
  requires_photo: boolean;
  requires_note: boolean;
  customer_visible: boolean;
  assigned_role: string;
}

const TYPE_ICON: Record<string, any> = {
  photo: Camera,
  checkbox: CheckSquare,
  note: ClipboardList,
};

export default function JobCheckpoints({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeNote, setCompleteNote] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("checkbox");

  const { data: checkpoints = [], isLoading } = useQuery<Checkpoint[]>({
    queryKey: ["/api/jobs", jobId, "checkpoints"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/checkpoints`);
      return res.json();
    },
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/checkpoint-templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/checkpoint-templates");
      return res.json();
    },
    enabled: showAdd,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/checkpoints`, {
        template_ids: selectedTemplates.length ? selectedTemplates : undefined,
        custom: showCustom && customName ? { name: customName, checkpoint_type: customType } : undefined,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "checkpoints"] });
      toast({ title: "Checkpoints added" });
      setShowAdd(false);
      setSelectedTemplates([]);
      setCustomName("");
      setShowCustom(false);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/checkpoints/${id}`, {
        status,
        note: note || undefined,
        checked: status === "completed",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "checkpoints"] });
      toast({ title: "Checkpoint updated" });
      setCompletingId(null);
      setCompleteNote("");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/checkpoints/${id}`);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "checkpoints"] });
      toast({ title: "Checkpoint removed" });
    },
  });

  const completed = checkpoints.filter(c => c.status === "completed").length;
  const total = checkpoints.length;

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Checkpoints</h3>
            <p className="text-xs text-muted-foreground">
              {total === 0 ? "No checkpoints" : `${completed} / ${total} complete`}
            </p>
          </div>
          {isAdminOrManager && (
            <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-checkpoints">
              <Plus className="h-4 w-4 mr-1.5" /> Add Checkpoints
            </Button>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${Math.round((completed / total) * 100)}%` }}
            />
          </div>
        )}

        {total === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No checkpoints added yet</p>
              {isAdminOrManager && (
                <p className="text-xs text-muted-foreground mt-1">
                  Add checkpoints from templates or create custom ones
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {checkpoints.map(cp => {
              const TypeIcon = TYPE_ICON[cp.checkpoint_type] ?? CheckSquare;
              const isDone = cp.status === "completed";
              return (
                <Card key={cp.id} className={`${isDone ? "opacity-75" : ""}`}
                  data-testid={`card-checkpoint-${cp.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <button
                      onClick={() => {
                        if (!isDone) {
                          if (cp.requires_note) {
                            setCompletingId(cp.id);
                          } else {
                            completeMutation.mutate({ id: cp.id, status: "completed" });
                          }
                        } else {
                          completeMutation.mutate({ id: cp.id, status: "pending" });
                        }
                      }}
                      className="mt-0.5 flex-shrink-0"
                      data-testid={`button-complete-${cp.id}`}
                    >
                      {isDone
                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                        : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                          {cp.name}
                        </p>
                        <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
                          {cp.assigned_role}
                        </span>
                        {cp.customer_visible && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30">
                            Customer visible
                          </span>
                        )}
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      {cp.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cp.description}</p>
                      )}
                      {cp.note && (
                        <p className="text-xs bg-muted/50 rounded px-2 py-1 mt-1 italic">{cp.note}</p>
                      )}
                      {isDone && cp.completed_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ✓ {format(parseISO(cp.completed_at), "MMM d, yyyy")}
                          {cp.completed_by_name && ` by ${cp.completed_by_name}`}
                        </p>
                      )}
                    </div>
                    {isAdminOrManager && !isDone && (
                      <button
                        onClick={() => deleteMutation.mutate(cp.id)}
                        className="text-muted-foreground hover:text-red-500 flex-shrink-0 mt-0.5"
                        data-testid={`button-delete-checkpoint-${cp.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add checkpoints dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Checkpoints</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">From Templates</p>
            {templates.map(t => (
              <label key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={selectedTemplates.includes(t.id)}
                  onCheckedChange={checked => {
                    setSelectedTemplates(prev =>
                      checked ? [...prev, t.id] : prev.filter(id => id !== t.id)
                    );
                  }}
                  data-testid={`checkbox-template-${t.id}`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{t.assigned_role} · {t.checkpoint_type}</p>
                </div>
              </label>
            ))}

            <button
              onClick={() => setShowCustom(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {showCustom ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Add custom checkpoint
            </button>
            {showCustom && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={customName} onChange={e => setCustomName(e.target.value)}
                    placeholder="e.g. Gate code provided" data-testid="input-custom-checkpoint" />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select value={customType} onChange={e => setCustomType(e.target.value)}
                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="checkbox">Checkbox</option>
                    <option value="photo">Photo required</option>
                    <option value="note">Note required</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              disabled={(!selectedTemplates.length && !customName) || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              data-testid="button-confirm-add-checkpoints">
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Add Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete with note dialog */}
      <Dialog open={!!completingId} onOpenChange={open => { if (!open) { setCompletingId(null); setCompleteNote(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Complete Checkpoint</DialogTitle></DialogHeader>
          <div>
            <Label>Note</Label>
            <Textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)}
              rows={3} placeholder="Add a note about completion…" className="resize-none mt-1"
              data-testid="textarea-complete-note" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCompletingId(null); setCompleteNote(""); }}>Cancel</Button>
            <Button
              disabled={completeMutation.isPending}
              onClick={() => completingId && completeMutation.mutate({
                id: completingId, status: "completed", note: completeNote || undefined,
              })}
              data-testid="button-confirm-complete">
              {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
