import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DocumentsPanel from "@/components/DocumentsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Plus, Phone, Mail, MapPin, FileText, Trash2, User, Star, Clock,
  MessageSquare, Calendar, ChevronRight, X, GripVertical, Upload,
  Send, CheckCircle2, Circle, AlertCircle, ClipboardList, Users
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import type { Candidate, CandidateDocument, ApplicantNote, ApplicantCommunication } from "@shared/schema";

const STAGES = [
  "New Application",
  "Review",
  "Phone Screen",
  "Interview",
  "Offer Extended",
  "Hired",
  "Not a Fit",
];

const STAGE_COLORS: Record<string, string> = {
  "New Application": "bg-blue-500",
  "Review": "bg-purple-500",
  "Phone Screen": "bg-cyan-500",
  "Interview": "bg-amber-500",
  "Offer Extended": "bg-emerald-500",
  "Hired": "bg-green-600",
  "Not a Fit": "bg-gray-400",
};

const SOURCES = ["Indeed", "Referral", "Walk-in", "Website", "Other"];
const JOB_TYPES = ["Crew Member", "Crew Lead", "Manager", "Office", "Sales"];
const RECOMMENDATIONS = ["Strong Yes", "Yes", "Maybe", "No"];

function getRatingColor(rating: string | null) {
  if (rating === "green") return "bg-green-500";
  if (rating === "yellow") return "bg-yellow-500";
  if (rating === "red") return "bg-red-500";
  return "bg-gray-300";
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function Hiring() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"pipeline" | "employees">("pipeline");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [detailTab, setDetailTab] = useState("profile");

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await apiRequest("POST", `/api/candidates/${id}/stage`, { stage });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: "Stage updated" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/candidates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setShowAddDialog(false);
      toast({ title: "Applicant added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/candidates/${id}`, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setSelectedCandidate(data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/candidates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setSelectedCandidate(null);
      toast({ title: "Applicant removed" });
    },
  });

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const candidateId = result.draggableId;
    const newStage = result.destination.droppableId;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.stage === newStage) return;
    stageMutation.mutate({ id: candidateId, stage: newStage });
  }

  const candidatesByStage = STAGES.reduce<Record<string, Candidate[]>>((acc, stage) => {
    acc[stage] = candidates.filter(c => c.stage === stage);
    return acc;
  }, {});

  return (
    <div className="space-y-4" data-testid="hiring-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="text-hiring-title">Hiring & HR</h1>
          <p className="text-muted-foreground mt-1">Manage applicants and employee records</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "pipeline" ? "default" : "outline"}
            onClick={() => setView("pipeline")}
            data-testid="button-view-pipeline"
          >
            <ClipboardList className="h-4 w-4 mr-2" /> Pipeline
          </Button>
          <Button
            variant={view === "employees" ? "default" : "outline"}
            onClick={() => setView("employees")}
            data-testid="button-view-employees"
          >
            <Users className="h-4 w-4 mr-2" /> Employees
          </Button>
          {view === "pipeline" && (
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-applicant">
              <Plus className="h-4 w-4 mr-2" /> Add Applicant
            </Button>
          )}
        </div>
      </div>

      {view === "pipeline" ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "70vh" }}>
            {STAGES.map((stage) => (
              <Droppable key={stage} droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-shrink-0 w-64 rounded-lg border p-3 transition-colors ${
                      snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                    }`}
                    data-testid={`column-${stage.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-3 w-3 rounded-full ${STAGE_COLORS[stage]}`} />
                      <h3 className="font-semibold text-sm">{stage}</h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {candidatesByStage[stage]?.length || 0}
                      </Badge>
                    </div>
                    <div className="space-y-2 min-h-[100px]">
                      {candidatesByStage[stage]?.map((candidate, index) => (
                        <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-card border rounded-lg p-3 cursor-pointer transition-shadow hover:shadow-md ${
                                snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
                              }`}
                              onClick={() => {
                                setSelectedCandidate(candidate);
                                setDetailTab("profile");
                              }}
                              data-testid={`card-candidate-${candidate.id}`}
                            >
                              <div className="flex items-start gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                  {getInitials(candidate.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{candidate.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{candidate.role}</p>
                                </div>
                                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1 ${getRatingColor(candidate.rating)}`} />
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : "N/A"}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      ) : (
        <EmployeeRecords />
      )}

      {/* Add Applicant Dialog */}
      <AddApplicantDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {/* Applicant Detail Side Panel */}
      {selectedCandidate && (
        <ApplicantDetailPanel
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onUpdate={(data) => updateMutation.mutate({ id: selectedCandidate.id, ...data })}
          onDelete={() => {
            if (confirm("Remove this applicant?")) deleteMutation.mutate(selectedCandidate.id);
          }}
          tab={detailTab}
          onTabChange={setDetailTab}
        />
      )}
    </div>
  );
}

function AddApplicantDialog({ open, onClose, onSave, isPending }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: "", role: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
    source: "", jobType: "", rating: "green",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Applicant</DialogTitle>
          <DialogDescription>Enter the new applicant's information</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-applicant-name" />
            </div>
            <div className="space-y-1">
              <Label>Position *</Label>
              <Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Crew Member" data-testid="input-applicant-role" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-applicant-email" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-applicant-phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger data-testid="select-source"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Job Type</Label>
              <Select value={form.jobType} onValueChange={v => setForm({ ...form, jobType: v })}>
                <SelectTrigger data-testid="select-job-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="input-applicant-address" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Zip</Label>
              <Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <div className="flex gap-2">
              {(["green", "yellow", "red"] as const).map(r => (
                <Button
                  key={r}
                  type="button"
                  variant={form.rating === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, rating: r })}
                  data-testid={`button-rating-${r}`}
                >
                  <div className={`h-3 w-3 rounded-full mr-1 ${getRatingColor(r)}`} />
                  {r === "green" ? "Active" : r === "yellow" ? "Needs Attention" : "Overdue"}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({ ...form, stage: "New Application" })}
            disabled={!form.name || !form.role || isPending}
            data-testid="button-save-applicant"
          >
            {isPending ? "Adding..." : "Add Applicant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicantDetailPanel({ candidate, onClose, onUpdate, onDelete, tab, onTabChange }: {
  candidate: Candidate;
  onClose: () => void;
  onUpdate: (data: any) => void;
  onDelete: () => void;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const showOnboarding = candidate.stage === "Hired";
  const availableTabs = ["profile", "documents", "communication", "interview"];
  if (showOnboarding) availableTabs.push("onboarding");

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300" data-testid="applicant-detail-panel">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            {getInitials(candidate.name)}
          </div>
          <div>
            <h2 className="font-semibold">{candidate.name}</h2>
            <p className="text-sm text-muted-foreground">{candidate.role}</p>
          </div>
          <Badge className={`${STAGE_COLORS[candidate.stage]} text-white ml-2`}>
            {candidate.stage}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={onDelete} data-testid="button-delete-candidate">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 justify-start">
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="communication" data-testid="tab-communication">Comms</TabsTrigger>
          <TabsTrigger value="interview" data-testid="tab-interview">Interview</TabsTrigger>
          {showOnboarding && <TabsTrigger value="onboarding" data-testid="tab-onboarding">Onboarding</TabsTrigger>}
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="profile" className="mt-0">
            <ProfileTab candidate={candidate} onUpdate={onUpdate} />
          </TabsContent>
          <TabsContent value="documents" className="mt-0">
            <DocumentsTab candidateId={candidate.id} />
            <div className="mt-4">
              <DocumentsPanel
                entityType="hiring"
                entityId={candidate.id}
                canUpload
                canShare
                canLink
                canDelete
                canAttachFromLibrary
                module="hiring"
                title="Library Documents"
              />
            </div>
          </TabsContent>
          <TabsContent value="communication" className="mt-0">
            <CommunicationTab candidateId={candidate.id} />
          </TabsContent>
          <TabsContent value="interview" className="mt-0">
            <InterviewTab candidate={candidate} onUpdate={onUpdate} />
          </TabsContent>
          {showOnboarding && (
            <TabsContent value="onboarding" className="mt-0">
              <OnboardingTab candidateId={candidate.id} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function ProfileTab({ candidate, onUpdate }: { candidate: Candidate; onUpdate: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: candidate.name,
    email: candidate.email || "",
    phone: candidate.phone || "",
    address: candidate.address || "",
    city: candidate.city || "",
    state: candidate.state || "",
    zip: candidate.zip || "",
    role: candidate.role,
    source: (candidate as any).source || "",
    rating: candidate.rating || "green",
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Contact Information</h3>
        <Button variant="outline" size="sm" onClick={() => {
          if (editing) {
            onUpdate(form);
            setEditing(false);
          } else {
            setEditing(true);
          }
        }} data-testid="button-edit-profile">
          {editing ? "Save" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Position</Label><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
            <div><Label>Zip</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
          </div>
          <div>
            <Label>Source</Label>
            <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {candidate.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{candidate.email}</div>}
          {candidate.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{candidate.phone}</div>}
          {candidate.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{[candidate.address, candidate.city, candidate.state, candidate.zip].filter(Boolean).join(", ")}</div>}
          {(candidate as any).source && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />Source: {(candidate as any).source}</div>}
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />Applied: {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : "N/A"}</div>
        </div>
      )}

      <NotesSection candidateId={candidate.id} />
    </div>
  );
}

function NotesSection({ candidateId }: { candidateId: string }) {
  const [newNote, setNewNote] = useState("");
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery<ApplicantNote[]>({
    queryKey: [`/api/candidates/${candidateId}/notes`],
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/candidates/${candidateId}/notes`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/notes`] });
      setNewNote("");
    },
  });

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Notes</h3>
      <div className="flex gap-2">
        <Input
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Add a note..."
          onKeyDown={e => e.key === "Enter" && newNote.trim() && addNoteMutation.mutate(newNote.trim())}
          data-testid="input-add-note"
        />
        <Button
          size="sm"
          onClick={() => newNote.trim() && addNoteMutation.mutate(newNote.trim())}
          disabled={!newNote.trim()}
          data-testid="button-add-note"
        >
          Add
        </Button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {notes.map(note => (
          <div key={note.id} className="text-sm p-2 bg-muted/50 rounded">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{note.authorName || "System"}</span>
              <span>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</span>
            </div>
            <p>{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsTab({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();
  const { toast } = useToast();

  const { data: docs = [] } = useQuery<CandidateDocument[]>({
    queryKey: [`/api/candidates/${candidateId}/documents`],
  });

  const createDocMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/candidates/${candidateId}/documents`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/documents`] });
    },
  });

  const updateDocMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/candidate-documents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/documents`] });
    },
  });

  const statusColors: Record<string, string> = {
    "Not Sent": "bg-gray-100 text-gray-600",
    "Sent": "bg-blue-100 text-blue-700",
    "Completed": "bg-green-100 text-green-700",
    "Signed": "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Documents</h3>
        <Button size="sm" variant="outline" onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
              const result = await uploadFile(file);
              if (!result) throw new Error("Upload failed");
              createDocMutation.mutate({
                candidateId,
                name: file.name,
                type: "upload",
                url: result.objectPath,
                status: "Completed",
              });
              toast({ title: "Document uploaded" });
            } catch {
              toast({ title: "Upload failed", variant: "destructive" });
            }
          };
          input.click();
        }} data-testid="button-upload-doc">
          <Upload className="h-4 w-4 mr-1" /> Upload
        </Button>
      </div>
      <div className="space-y-2">
        {docs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-medium">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload documents using the button above. Documents will be auto-created when a candidate is hired.</p>
          </div>
        ) : docs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`doc-${doc.id}`}>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{doc.name}</p>
                <Badge variant="outline" className={`text-xs ${statusColors[doc.status] || ""}`}>
                  {doc.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              {doc.url ? (
                <Button size="sm" variant="ghost" onClick={() => window.open(doc.url!, "_blank")} data-testid={`view-doc-${doc.id}`}>
                  View
                </Button>
              ) : doc.status === "Not Sent" ? (
                <Button size="sm" variant="outline" onClick={() => updateDocMutation.mutate({ id: doc.id, status: "Sent" })} data-testid={`send-doc-${doc.id}`}>
                  <Send className="h-3 w-3 mr-1" /> Send
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground italic">Awaiting upload</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunicationTab({ candidateId }: { candidateId: string }) {
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState("Note");
  const queryClient = useQueryClient();

  const { data: comms = [] } = useQuery<ApplicantCommunication[]>({
    queryKey: [`/api/candidates/${candidateId}/communications`],
  });

  const addCommMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/candidates/${candidateId}/communications`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/communications`] });
      setNewMessage("");
    },
  });

  const typeIcons: Record<string, typeof Mail> = { Email: Mail, SMS: MessageSquare, Note: FileText };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Communication Log</h3>
      <div className="space-y-2">
        <div className="flex gap-2">
          {["Note", "Email", "SMS"].map(t => (
            <Button key={t} size="sm" variant={messageType === t ? "default" : "outline"} onClick={() => setMessageType(t)}>
              {t}
            </Button>
          ))}
        </div>
        <Textarea
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder={`Add ${messageType.toLowerCase()}...`}
          rows={2}
          data-testid="input-comm-message"
        />
        <Button
          size="sm"
          onClick={() => newMessage.trim() && addCommMutation.mutate({ type: messageType, content: newMessage.trim() })}
          disabled={!newMessage.trim()}
          data-testid="button-add-comm"
        >
          Add {messageType}
        </Button>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {comms.map(comm => {
          const Icon = typeIcons[comm.type] || FileText;
          return (
            <div key={comm.id} className="p-3 border rounded-lg text-sm" data-testid={`comm-${comm.id}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">{comm.type}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {comm.sentByName || "System"} — {comm.createdAt ? new Date(comm.createdAt).toLocaleString() : ""}
                </span>
              </div>
              {comm.subject && <p className="font-medium text-xs mb-1">{comm.subject}</p>}
              <p className="text-muted-foreground">{comm.content}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InterviewTab({ candidate, onUpdate }: { candidate: Candidate; onUpdate: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    interviewDate: candidate.interviewDate ? new Date(candidate.interviewDate).toISOString().split("T")[0] : "",
    interviewTime: candidate.interviewTime || "",
    interviewLocation: candidate.interviewLocation || "",
    interviewType: candidate.interviewType || "in-person",
    interviewerName: candidate.interviewerName || "",
    interviewNotes: candidate.interviewNotes || "",
    interviewRating: candidate.interviewRating || 0,
    interviewRecommendation: candidate.interviewRecommendation || "",
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Interview Details</h3>
        <Button variant="outline" size="sm" onClick={() => {
          if (editing) {
            onUpdate({
              ...form,
              interviewDate: form.interviewDate ? new Date(form.interviewDate) : null,
            });
            setEditing(false);
          } else {
            setEditing(true);
          }
        }} data-testid="button-edit-interview">
          {editing ? "Save" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.interviewDate} onChange={e => setForm({ ...form, interviewDate: e.target.value })} data-testid="input-interview-date" /></div>
            <div><Label>Time</Label><Input value={form.interviewTime} onChange={e => setForm({ ...form, interviewTime: e.target.value })} placeholder="e.g. 2:00 PM" data-testid="input-interview-time" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.interviewType} onValueChange={v => setForm({ ...form, interviewType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-person">In-Person</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Interviewer</Label><Input value={form.interviewerName} onChange={e => setForm({ ...form, interviewerName: e.target.value })} /></div>
          </div>
          <div><Label>Location</Label><Input value={form.interviewLocation} onChange={e => setForm({ ...form, interviewLocation: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea value={form.interviewNotes} onChange={e => setForm({ ...form, interviewNotes: e.target.value })} rows={3} /></div>
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Button
                  key={n}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, interviewRating: n })}
                  data-testid={`button-star-${n}`}
                >
                  <Star className={`h-5 w-5 ${n <= form.interviewRating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Recommendation</Label>
            <Select value={form.interviewRecommendation} onValueChange={v => setForm({ ...form, interviewRecommendation: v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {RECOMMENDATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {candidate.interviewDate ? (
            <>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(candidate.interviewDate).toLocaleDateString()} {candidate.interviewTime && `at ${candidate.interviewTime}`}</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{candidate.interviewType || "In-Person"} {candidate.interviewLocation && `— ${candidate.interviewLocation}`}</div>
              {candidate.interviewerName && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />Interviewer: {candidate.interviewerName}</div>}
              {candidate.interviewRating && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`h-4 w-4 ${n <= (candidate.interviewRating || 0) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                  ))}
                </div>
              )}
              {candidate.interviewRecommendation && <Badge variant="outline">{candidate.interviewRecommendation}</Badge>}
              {candidate.interviewNotes && <p className="text-muted-foreground mt-2">{candidate.interviewNotes}</p>}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-4">No interview scheduled yet. Click Edit to add details.</p>
          )}
        </div>
      )}
    </div>
  );
}

function OnboardingTab({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();

  const { data: employee } = useQuery({
    queryKey: [`/api/candidates/${candidateId}/employee`],
    queryFn: async () => {
      const employees = await (await apiRequest("GET", "/api/employees")).json();
      return employees.find((e: any) => e.candidateId === candidateId);
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/employees/${employee?.id}/onboarding`],
    enabled: !!employee?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employees/${employee.id}/onboarding`);
      return res.json();
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/onboarding-items/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employee?.id}/onboarding`] });
    },
  });

  const completed = items.filter((i: any) => i.status === "Complete").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Onboarding Checklist</h3>
        <Badge variant="outline">{pct}% Complete</Badge>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {["Employee", "Office/HR"].map(category => (
        <div key={category}>
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">{category}</h4>
          <div className="space-y-1">
            {items.filter((i: any) => i.category === category).map((item: any) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${item.status === "Complete" ? "opacity-60" : ""}`}
                onClick={() => updateItemMutation.mutate({
                  id: item.id,
                  status: item.status === "Complete" ? "Pending" : "Complete",
                })}
                data-testid={`onboarding-item-${item.id}`}
              >
                {item.status === "Complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className={`text-sm ${item.status === "Complete" ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmployeeRecords() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowAddDialog(false);
      toast({ title: "Employee added" });
    },
  });

  const filtered = employees.filter((emp: any) => {
    const matchesSearch = !search || `${emp.firstName} ${emp.lastName} ${emp.jobTitle || ""} ${emp.department || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedEmployee) {
    const emp = employees.find((e: any) => e.id === selectedEmployee);
    if (emp) return <EmployeeProfile employee={emp} onBack={() => setSelectedEmployee(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Input
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-employees"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="On Leave">On Leave</SelectItem>
            <SelectItem value="Terminated">Terminated</SelectItem>
            <SelectItem value="Seasonal Off">Seasonal Off</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAddDialog(true)} className="ml-auto" data-testid="button-add-employee">
          <Plus className="h-4 w-4 mr-2" /> Add Employee
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No employees found</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Name</th>
                <th className="text-left p-3 text-sm font-medium">Role</th>
                <th className="text-left p-3 text-sm font-medium">Department</th>
                <th className="text-left p-3 text-sm font-medium">Start Date</th>
                <th className="text-left p-3 text-sm font-medium">Status</th>
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
                  <td className="p-3 text-sm">{emp.jobTitle || "—"}</td>
                  <td className="p-3 text-sm">{emp.department || "—"}</td>
                  <td className="p-3 text-sm">{emp.startDate || "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={emp.status === "Active" ? "text-green-700 bg-green-50" : emp.status === "Terminated" ? "text-red-700 bg-red-50" : ""}>
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
  const [form, setForm] = useState({
    firstName: "", lastName: "", personalEmail: "", personalPhone: "",
    jobTitle: "", department: "", employmentType: "Full-time", startDate: "",
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>First Name *</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} data-testid="input-emp-first-name" /></div>
        <div><Label>Last Name *</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} data-testid="input-emp-last-name" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input value={form.personalEmail} onChange={e => setForm({ ...form, personalEmail: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.personalPhone} onChange={e => setForm({ ...form, personalPhone: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Job Title</Label><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} /></div>
        <div><Label>Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(form)} disabled={!form.firstName || !form.lastName || isPending} data-testid="button-save-employee">
          {isPending ? "Adding..." : "Add Employee"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function EmployeeProfile({ employee, onBack }: { employee: any; onBack: () => void }) {
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
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-list">
          <ChevronRight className="h-4 w-4 rotate-180 mr-1" /> Back
        </Button>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
          {getInitials(`${employee.firstName} ${employee.lastName}`)}
        </div>
        <div>
          <h2 className="font-semibold text-lg">{employee.firstName} {employee.lastName}</h2>
          <p className="text-sm text-muted-foreground">{employee.jobTitle || "No title"} — {employee.department || "No department"}</p>
        </div>
        <Badge className="ml-auto" variant="outline">{employee.status}</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          {isAdmin && <TabsTrigger value="pay">Pay</TabsTrigger>}
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          {isAdmin && <TabsTrigger value="notes">Notes</TabsTrigger>}
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <EmployeePersonalTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
        </TabsContent>
        <TabsContent value="employment">
          <EmployeeEmploymentTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="pay">
            <EmployeePayTab employee={employee} onUpdate={(data) => updateMutation.mutate(data)} />
          </TabsContent>
        )}
        <TabsContent value="documents">
          <EmployeeDocumentsTab employeeId={employee.id} />
        </TabsContent>
        <TabsContent value="history">
          <EmployeeHistoryTab employeeId={employee.id} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="notes">
            <EmployeeNotesTab employeeId={employee.id} />
          </TabsContent>
        )}
        <TabsContent value="onboarding">
          <EmployeeOnboardingTab employeeId={employee.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmployeePersonalTab({ employee, onUpdate }: { employee: any; onUpdate: (data: any) => void }) {
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
        }}>{editing ? "Save" : "Edit"}</Button>
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

function EmployeeEmploymentTab({ employee, onUpdate }: { employee: any; onUpdate: (data: any) => void }) {
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
        }}>{editing ? "Save" : "Edit"}</Button>
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
            <div><span className="text-muted-foreground">Title:</span> {employee.jobTitle || "—"}</div>
            <div><span className="text-muted-foreground">Department:</span> {employee.department || "—"}</div>
            <div><span className="text-muted-foreground">Type:</span> {employee.employmentType}</div>
            <div><span className="text-muted-foreground">Start:</span> {employee.startDate || "—"}</div>
            {employee.endDate && <div><span className="text-muted-foreground">End:</span> {employee.endDate}</div>}
            <div><span className="text-muted-foreground">Supervisor:</span> {employee.supervisor || "—"}</div>
            <div><span className="text-muted-foreground">Location:</span> {employee.workLocation || "—"}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeePayTab({ employee, onUpdate }: { employee: any; onUpdate: (data: any) => void }) {
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
        }}>{editing ? "Save" : "Edit"}</Button>
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
            <div><span className="text-muted-foreground">Rate:</span> {employee.payRate || "—"} ({employee.payType || "hourly"})</div>
            <div><span className="text-muted-foreground">Period:</span> {employee.payPeriod || "—"}</div>
            <div><span className="text-muted-foreground">Method:</span> {employee.paymentMethod || "—"}</div>
            {employee.accountLast4 && <div><span className="text-muted-foreground">Account:</span> ****{employee.accountLast4}</div>}
          </div>
        )}

        {payHistory.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Pay History</h4>
            <div className="space-y-1">
              {payHistory.map((entry: any) => (
                <div key={entry.id} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                  <span>{entry.oldRate} → {entry.newRate} — {entry.reason || "No reason"}</span>
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

function EmployeeDocumentsTab({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();
  const { toast } = useToast();

  const { data: docs = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/documents`],
    queryFn: async () => (await apiRequest("GET", `/api/employees/${employeeId}/documents`)).json(),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Documents</CardTitle>
        <Button size="sm" variant="outline" onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
              const result = await uploadFile(file);
              if (!result) throw new Error("Upload failed");
              await apiRequest("POST", `/api/employees/${employeeId}/documents`, {
                name: file.name, type: "upload", url: result.objectPath, status: "Completed",
              });
              queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/documents`] });
              toast({ title: "Document uploaded" });
            } catch {
              toast({ title: "Upload failed", variant: "destructive" });
            }
          };
          input.click();
        }}>
          <Upload className="h-4 w-4 mr-1" /> Upload
        </Button>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No documents</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{doc.name}</span>
                  <Badge variant="outline" className="text-xs">{doc.status}</Badge>
                </div>
                {doc.url && <Button size="sm" variant="ghost" onClick={() => window.open(doc.url, "_blank")}>View</Button>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeHistoryTab({ employeeId }: { employeeId: string }) {
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
      </CardContent>
    </Card>
  );
}

function EmployeeNotesTab({ employeeId }: { employeeId: string }) {
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
          <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a private note..." rows={2} className="flex-1" />
          <Button size="sm" onClick={() => newNote.trim() && addMutation.mutate(newNote.trim())} disabled={!newNote.trim()} className="self-end">Add</Button>
        </div>
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
      </CardContent>
    </Card>
  );
}

function EmployeeOnboardingTab({ employeeId }: { employeeId: string }) {
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
      </CardContent>
    </Card>
  );
}
