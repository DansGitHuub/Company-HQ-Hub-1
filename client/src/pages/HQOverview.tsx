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
type Note = { date: string; title: string; attendees: string; content?: string };

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

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: companySettingsData } = useQuery<any>({
    queryKey: ["/api/company-settings"],
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

  const notes: Note[] = [
    { date: "Oct 24, 2025", title: "Quarterly Strategy Alignment", attendees: "All Management", content: "Reviewed Q4 goals and realigned priorities. Focus areas: customer retention, crew training, and equipment maintenance." },
    { date: "Oct 17, 2025", title: "Safety Protocol Update", attendees: "All Hands", content: "Updated heat safety protocols for summer months. New hydration stations at all job sites. PPE compliance reminders." },
    { date: "Oct 10, 2025", title: "New Material Supplier Review", attendees: "Ops & Purchasing", content: "Evaluated three new mulch suppliers. Selected GreenGrow Materials for better pricing and quality. Implementation starts Nov 1." },
  ];

  const archivedNotes: Note[] = [
    { date: "Oct 3, 2025", title: "Fleet Maintenance Schedule", attendees: "Operations" },
    { date: "Sep 26, 2025", title: "Fall Season Preparation", attendees: "All Crews" },
    { date: "Sep 19, 2025", title: "Customer Feedback Review", attendees: "Management" },
    { date: "Sep 12, 2025", title: "New Employee Orientation", attendees: "HR & Training" },
    { date: "Sep 5, 2025", title: "Monthly Budget Review", attendees: "Finance & Ops" },
    { date: "Aug 29, 2025", title: "Equipment Upgrade Discussion", attendees: "Operations" },
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      <section className="text-center space-y-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">{t("nav.companyHQ")}</h1>
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
          <Button variant="outline" onClick={() => setArchiveDialogOpen(true)} className="gap-2" data-testid="button-view-archives">
            <Archive className="w-4 h-4" />
            {t("hq.viewAllArchives")}
          </Button>
        </div>
        <div className="space-y-4">
          {notes.map((note, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              onClick={() => setSelectedNote(note)}
              data-testid={`card-note-${i}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary rounded-lg flex flex-col items-center justify-center text-[10px] font-bold">
                  <span>{note.date.split(" ")[0]}</span>
                  <span className="text-base leading-none">{note.date.split(" ")[1].replace(",", "")}</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg">{note.title}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-3 h-3" /> {note.attendees}
                  </div>
                </div>
              </div>
              <ArrowRight className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </section>

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Leadership Notes Archive
            </DialogTitle>
            <DialogDescription>Browse past meeting notes and company updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {archivedNotes.map((note, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                onClick={() => {
                  toast({
                    title: note.title,
                    description: `Meeting notes from ${note.date} with ${note.attendees}.`,
                  });
                }}
                data-testid={`card-archived-note-${i}`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{note.title}</p>
                    <p className="text-xs text-muted-foreground">{note.date} · {note.attendees}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNote} onOpenChange={() => setSelectedNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNote?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> {selectedNote?.date} · {selectedNote?.attendees}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">{selectedNote?.content}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
