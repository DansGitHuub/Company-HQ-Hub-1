import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Target,
  Eye,
  Users,
  Rocket,
  Calendar,
  MessageSquare,
  ArrowRight,
  Archive,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import FileLibrary from "@/components/FileLibrary";

type HQGoal = { text: string; target: string; status: string };
type HQContent = { vision?: string; mission?: string; goals?: HQGoal[] };
type MeetingNote = {
  id: number;
  meeting_date: string;
  title: string;
  attendees: string;
  content: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
};

const GOAL_STATUSES = ["On Track", "In Progress", "Met", "Not Started"];

const DEFAULT_GOALS: HQGoal[] = [
  { text: "95% Customer Satisfaction Rating", target: "Q4 2026", status: "On Track" },
  { text: "Zero Workplace Safety Incidents", target: "Ongoing", status: "Met" },
  { text: "Launch 2 New Maintenance Packages", target: "Q3 2026", status: "Not Started" },
];

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Met") return "default";
  if (status === "On Track") return "outline";
  return "secondary";
}

export default function HQOverview() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = !!(user as any)?.isMasterAdmin || user?.role === "Admin";
  const canManageNotes = !!(user as any)?.isMasterAdmin || user?.role === "Admin" || user?.role === "Manager";

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const emptyForm = { meeting_date: "", title: "", attendees: "", content: "" };
  const [noteForm, setNoteForm] = useState(emptyForm);

  const { data: companySettingsData } = useQuery<any>({
    queryKey: ["/api/company-settings"],
  });

  const { data: meetingNotes = [] } = useQuery<MeetingNote[]>({
    queryKey: ["/api/meeting-notes"],
  });

  const hqContent = companySettingsData?.hqContent as HQContent | undefined;
  const vision = hqContent?.vision ?? t("hq.visionContent");
  const mission = hqContent?.mission ?? t("hq.missionContent");
  const goals: HQGoal[] = hqContent?.goals ?? DEFAULT_GOALS;

  const saveMutation = useMutation({
    mutationFn: async (content: HQContent) => {
      const res = await apiRequest("PATCH", "/api/admin/hq-content", content);
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      toast({ title: "Changes saved" });
      setEditingField(null);
    },
    onError: () => {
      toast({ title: "Failed to save changes", variant: "destructive" });
    },
  });

  const createNote = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const res = await apiRequest("POST", "/api/meeting-notes", body);
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-notes"] });
      toast({ title: "Note added" });
      setNoteFormOpen(false);
      setNoteForm(emptyForm);
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: typeof emptyForm }) => {
      const res = await apiRequest("PATCH", `/api/meeting-notes/${id}`, body);
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-notes"] });
      toast({ title: "Note updated" });
      setNoteFormOpen(false);
      setEditingNote(null);
      setNoteForm(emptyForm);
    },
    onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/meeting-notes/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-notes"] });
      toast({ title: "Note deleted" });
      setDeleteConfirmId(null);
    },
    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
  });

  const openAddNote = () => {
    setEditingNote(null);
    setNoteForm(emptyForm);
    setNoteFormOpen(true);
  };

  const openEditNote = (note: MeetingNote) => {
    setEditingNote(note);
    setNoteForm({
      meeting_date: note.meeting_date.split("T")[0],
      title: note.title,
      attendees: note.attendees,
      content: note.content,
    });
    setNoteFormOpen(true);
  };

  const submitNoteForm = () => {
    if (!noteForm.meeting_date || !noteForm.title.trim()) {
      toast({ title: "Date and title are required", variant: "destructive" });
      return;
    }
    if (editingNote) {
      updateNote.mutate({ id: editingNote.id, body: noteForm });
    } else {
      createNote.mutate(noteForm);
    }
  };

  const formatNoteDate = (dateStr: string) => {
    const d = new Date(dateStr.split("T")[0] + "T12:00:00");
    return {
      mon: d.toLocaleString("en-US", { month: "short" }),
      day: String(d.getDate()),
    };
  };

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const cancelEdit = () => setEditingField(null);

  const saveField = (field: string, value: string = editValue) => {
    const updated: HQContent = { vision, mission, goals: [...goals] };
    if (field === "vision") {
      updated.vision = value;
    } else if (field === "mission") {
      updated.mission = value;
    } else if (field.startsWith("goal-")) {
      const parts = field.split("-");
      const idx = parseInt(parts[1]);
      const key = parts.slice(2).join("-") as keyof HQGoal;
      updated.goals = goals.map((g, i) => (i === idx ? { ...g, [key]: value } : g));
    }
    saveMutation.mutate(updated);
  };

  const recentNotes = meetingNotes.slice(0, 5);

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      <section className="text-center space-y-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">{t("nav.hqOverview")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{t("hq.subtitle")}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Vision card */}
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-6 h-6" /> {t("hq.ourVision")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg leading-relaxed">
            {isAdmin && editingField === "vision" ? (
              <div className="space-y-2">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50 min-h-[100px]"
                  data-testid="input-edit-vision"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => saveField("vision")} disabled={saveMutation.isPending} data-testid="button-save-vision">
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-primary-foreground hover:bg-primary-foreground/10">
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <span data-testid="text-vision">{vision}</span>
                {isAdmin && (
                  <button
                    onClick={() => startEdit("vision", vision)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded transition-opacity shrink-0 mt-0.5"
                    data-testid="button-edit-vision"
                    title="Edit vision"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mission card */}
        <Card className="bg-secondary text-secondary-foreground border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Rocket className="w-6 h-6" /> {t("hq.ourMission")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg leading-relaxed">
            {isAdmin && editingField === "mission" ? (
              <div className="space-y-2">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="input-edit-mission"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveField("mission")} disabled={saveMutation.isPending} data-testid="button-save-mission">
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <span data-testid="text-mission">{mission}</span>
                {isAdmin && (
                  <button
                    onClick={() => startEdit("mission", mission)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded transition-opacity shrink-0 mt-0.5"
                    data-testid="button-edit-mission"
                    title="Edit mission"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-6">
        <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
          <Target className="w-8 h-8 text-primary" /> {t("hq.strategicGoals")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {goals.map((goal, i) => (
            <Card key={i} className="hover-elevate">
              <CardContent className="pt-6 space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2 group">
                  <Badge variant={statusBadgeVariant(goal.status)} data-testid={`badge-goal-${i}-status`}>
                    {goal.status}
                  </Badge>
                  {isAdmin && editingField === `goal-${i}-status` ? (
                    <div className="flex items-center gap-1">
                      <Select
                        value={editValue}
                        onValueChange={(v) => { setEditValue(v); saveField(`goal-${i}-status`, v); }}
                      >
                        <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-goal-${i}-status`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GOAL_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button onClick={cancelEdit} className="p-1 rounded hover:bg-muted" data-testid={`button-cancel-goal-${i}-status`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : isAdmin ? (
                    <button
                      onClick={() => startEdit(`goal-${i}-status`, goal.status)}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded transition-opacity"
                      data-testid={`button-edit-goal-${i}-status`}
                      title="Edit status"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>

                {/* Goal text */}
                <div className="group">
                  {isAdmin && editingField === `goal-${i}-text` ? (
                    <div className="space-y-1.5">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="font-bold text-sm"
                        data-testid={`input-goal-${i}-text`}
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 text-xs" onClick={() => saveField(`goal-${i}-text`)} disabled={saveMutation.isPending} data-testid={`button-save-goal-${i}-text`}>
                          <Check className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelEdit}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1.5">
                      <p className="font-bold text-lg flex-1" data-testid={`text-goal-${i}`}>{goal.text}</p>
                      {isAdmin && (
                        <button
                          onClick={() => startEdit(`goal-${i}-text`, goal.text)}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded transition-opacity mt-1 shrink-0"
                          data-testid={`button-edit-goal-${i}-text`}
                          title="Edit goal"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Target */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground group">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  {isAdmin && editingField === `goal-${i}-target` ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 text-xs flex-1"
                        data-testid={`input-goal-${i}-target`}
                      />
                      <button
                        onClick={() => saveField(`goal-${i}-target`)}
                        disabled={saveMutation.isPending}
                        className="p-1 rounded hover:bg-muted text-foreground"
                        data-testid={`button-save-goal-${i}-target`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 rounded hover:bg-muted">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span data-testid={`text-goal-${i}-target`}>{goal.target}</span>
                      {isAdmin && (
                        <button
                          onClick={() => startEdit(`goal-${i}-target`, goal.target)}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded transition-opacity"
                          data-testid={`button-edit-goal-${i}-target`}
                          title="Edit target"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <FileLibrary />

      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" /> {t("hq.leadershipNotes")}
          </h2>
          <div className="flex items-center gap-2">
            {canManageNotes && (
              <Button size="sm" onClick={openAddNote} className="gap-2" data-testid="button-add-note">
                <Plus className="w-4 h-4" /> Add Note
              </Button>
            )}
            <Button variant="outline" onClick={() => setArchiveDialogOpen(true)} className="gap-2" data-testid="button-view-archives">
              <Archive className="w-4 h-4" />
              {t("hq.viewAllArchives")}
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {recentNotes.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg">
              No meeting notes yet.{canManageNotes ? ' Click "Add Note" to create the first one.' : ""}
            </div>
          )}
          {recentNotes.map((note) => {
            const { mon, day } = formatNoteDate(note.meeting_date);
            return (
              <div
                key={note.id}
                className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent transition-colors cursor-pointer group"
                onClick={() => setSelectedNote(note)}
                data-testid={`card-note-${note.id}`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-secondary rounded-lg flex flex-col items-center justify-center text-[10px] font-bold shrink-0">
                    <span>{mon}</span>
                    <span className="text-base leading-none">{day}</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-lg truncate">{note.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-3 h-3 shrink-0" /> {note.attendees}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  {canManageNotes && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditNote(note); }}
                        className="p-1.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-edit-note-${note.id}`}
                        title="Edit note"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(note.id); }}
                        className="p-1.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-delete-note-${note.id}`}
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </>
                  )}
                  <ArrowRight className="text-muted-foreground ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Archive / All Notes Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              All Meeting Notes ({meetingNotes.length})
            </DialogTitle>
            <DialogDescription>Browse all meeting notes and company updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {meetingNotes.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No notes yet.</p>
            )}
            {meetingNotes.map((note) => {
              const { mon, day } = formatNoteDate(note.meeting_date);
              return (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer group"
                  onClick={() => { setSelectedNote(note); setArchiveDialogOpen(false); }}
                  data-testid={`card-archived-note-${note.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{note.title}</p>
                      <p className="text-xs text-muted-foreground">{mon} {day} · {note.attendees}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {canManageNotes && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setArchiveDialogOpen(false); openEditNote(note); }}
                          className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(note.id); }}
                          className="p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Note Form Dialog */}
      <Dialog open={noteFormOpen} onOpenChange={(o) => { if (!o) { setNoteFormOpen(false); setEditingNote(null); setNoteForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Meeting Note" : "Add Meeting Note"}</DialogTitle>
            <DialogDescription>Fill in the details for this leadership note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={noteForm.meeting_date}
                  onChange={(e) => setNoteForm(f => ({ ...f, meeting_date: e.target.value }))}
                  data-testid="input-note-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Attendees</Label>
                <Input placeholder="e.g. All Management" value={noteForm.attendees}
                  onChange={(e) => setNoteForm(f => ({ ...f, attendees: e.target.value }))}
                  data-testid="input-note-attendees" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
              <Input placeholder="Meeting title" value={noteForm.title}
                onChange={(e) => setNoteForm(f => ({ ...f, title: e.target.value }))}
                data-testid="input-note-title" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes / Summary</Label>
              <Textarea placeholder="Key decisions, action items, discussion points…" value={noteForm.content}
                onChange={(e) => setNoteForm(f => ({ ...f, content: e.target.value }))}
                className="min-h-[120px]" data-testid="input-note-content" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setNoteFormOpen(false); setEditingNote(null); setNoteForm(emptyForm); }}>
              Cancel
            </Button>
            <Button onClick={submitNoteForm} disabled={createNote.isPending || updateNote.isPending} data-testid="button-save-note">
              {createNote.isPending || updateNote.isPending ? "Saving…" : editingNote ? "Save Changes" : "Add Note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>This meeting note will be permanently removed. Are you sure?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId !== null && deleteNote.mutate(deleteConfirmId)}
              disabled={deleteNote.isPending} data-testid="button-confirm-delete-note">
              {deleteNote.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note Detail Dialog */}
      <Dialog open={!!selectedNote} onOpenChange={() => setSelectedNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNote?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {selectedNote && (() => { const { mon, day } = formatNoteDate(selectedNote.meeting_date); return `${mon} ${day}`; })()}
              {selectedNote?.attendees ? ` · ${selectedNote.attendees}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedNote?.content
              ? <p className="text-muted-foreground whitespace-pre-wrap">{selectedNote.content}</p>
              : <p className="text-muted-foreground italic">No notes recorded.</p>
            }
          </div>
          {canManageNotes && selectedNote && (
            <div className="flex justify-end gap-2 pt-1 border-t">
              <Button size="sm" variant="outline" onClick={() => { setSelectedNote(null); openEditNote(selectedNote); }}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { setSelectedNote(null); setDeleteConfirmId(selectedNote.id); }}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
