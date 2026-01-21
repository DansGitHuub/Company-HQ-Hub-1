import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { 
  Plus, Phone, Mail, MapPin, FileText, Upload, Trash2, 
  Circle, CheckCircle2, ExternalLink
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import type { Candidate, CandidateDocument, CandidateRating, CandidateJobType, CandidateWorkType } from "@shared/schema";

const STAGES = ["Applied", "Phone Screen", "Interview", "Offer", "Hired", "Rejected"];
const JOB_TYPES: CandidateJobType[] = ["Crew Member", "Crew Lead", "Manager", "Office", "Sales"];
const WORK_TYPES: CandidateWorkType[] = ["Maintenance", "Project"];

const DOCUMENT_TYPES = [
  { value: "license", label: "Driver's License" },
  { value: "application", label: "New Hire Application" },
  { value: "code_of_conduct", label: "Code of Conduct" },
  { value: "core_values", label: "Core Values" },
  { value: "mission_statement", label: "Mission Statement" },
  { value: "ethos", label: "Ethos" },
  { value: "direct_deposit", label: "Direct Deposit Form" },
  { value: "w4", label: "W-4" },
  { value: "employee_handbook", label: "Employee Handbook" },
  { value: "mvr_form", label: "Motor Vehicle Authorization Report" },
  { value: "company_handbook", label: "Company Handbook" },
  { value: "other", label: "Other" },
];

function RatingDots({ rating, onChange }: { rating: CandidateRating; onChange: (r: CandidateRating) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(rating === "green" ? null : "green")}
        className={`w-6 h-6 rounded-full transition-all ${rating === "green" ? "bg-green-500 ring-2 ring-green-300" : "bg-green-500/30 hover:bg-green-500/50"}`}
        data-testid="rating-green"
      />
      <button
        type="button"
        onClick={() => onChange(rating === "yellow" ? null : "yellow")}
        className={`w-6 h-6 rounded-full transition-all ${rating === "yellow" ? "bg-yellow-500 ring-2 ring-yellow-300" : "bg-yellow-500/30 hover:bg-yellow-500/50"}`}
        data-testid="rating-yellow"
      />
      <button
        type="button"
        onClick={() => onChange(rating === "red" ? null : "red")}
        className={`w-6 h-6 rounded-full transition-all ${rating === "red" ? "bg-red-500 ring-2 ring-red-300" : "bg-red-500/30 hover:bg-red-500/50"}`}
        data-testid="rating-red"
      />
    </div>
  );
}

function RatingBadge({ rating }: { rating: CandidateRating }) {
  if (!rating) return null;
  const colors = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };
  return <div className={`w-3 h-3 rounded-full ${colors[rating]}`} />;
}

export default function Hiring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewCandidate, setIsNewCandidate] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Candidate>>({});
  const [newDocType, setNewDocType] = useState("license");
  const [newDocRequiresAck, setNewDocRequiresAck] = useState(false);
  
  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  const { data: candidateDocuments = [] } = useQuery<CandidateDocument[]>({
    queryKey: ["/api/candidates", selectedCandidate?.id, "documents"],
    queryFn: async () => {
      if (!selectedCandidate?.id) return [];
      const res = await apiRequest("GET", `/api/candidates/${selectedCandidate.id}/documents`);
      return res.json();
    },
    enabled: !!selectedCandidate?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Candidate>) => {
      const res = await apiRequest("POST", "/api/candidates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: "Candidate created" });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Candidate> }) => {
      const res = await apiRequest("PATCH", `/api/candidates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: "Candidate updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/candidates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: "Candidate deleted" });
      setIsModalOpen(false);
    },
  });

  const createDocMutation = useMutation({
    mutationFn: async (data: { candidateId: string; name: string; type: string; url: string; requiresAcknowledgment: boolean }) => {
      const res = await apiRequest("POST", `/api/candidates/${data.candidateId}/documents`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates", selectedCandidate?.id, "documents"] });
      toast({ title: "Document uploaded" });
    },
  });

  const updateDocMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CandidateDocument> }) => {
      const res = await apiRequest("PATCH", `/api/candidate-documents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates", selectedCandidate?.id, "documents"] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/candidate-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates", selectedCandidate?.id, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const candidateId = result.draggableId;
    const newStage = result.destination.droppableId;
    updateMutation.mutate({ id: candidateId, data: { stage: newStage } });
  };

  const openCandidateModal = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setEditForm(candidate);
    setIsNewCandidate(false);
    setIsModalOpen(true);
  };

  const openNewCandidateModal = () => {
    setSelectedCandidate(null);
    setEditForm({ name: "", role: "Crew Member", stage: "Applied" });
    setIsNewCandidate(true);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (isNewCandidate) {
      createMutation.mutate(editForm);
    } else if (selectedCandidate) {
      updateMutation.mutate({ id: selectedCandidate.id, data: editForm });
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCandidate) return;
    
    try {
      const response = await uploadFile(file);
      if (!response) {
        toast({ title: "Upload failed", variant: "destructive" });
        return;
      }
      createDocMutation.mutate({
        candidateId: selectedCandidate.id,
        name: file.name,
        type: newDocType,
        url: response.objectPath,
        requiresAcknowledgment: newDocRequiresAck,
      });
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    e.target.value = "";
  };

  const toggleDocAcknowledgment = (doc: CandidateDocument) => {
    updateDocMutation.mutate({
      id: doc.id,
      data: {
        acknowledged: !doc.acknowledged,
        acknowledgedAt: !doc.acknowledged ? new Date() : null,
      },
    });
  };

  const showWorkType = editForm.jobType === "Crew Member" || editForm.jobType === "Crew Lead";

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Hiring Pipeline</h1>
          <p className="text-muted-foreground">Track candidates from application to offer</p>
        </div>
        <Button className="gap-2" onClick={openNewCandidateModal} data-testid="button-add-candidate">
          <Plus className="w-4 h-4" /> Add Candidate
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageCandidates = candidates.filter(c => c.stage === stage);
            
            return (
              <Droppable key={stage} droppableId={stage}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="w-80 shrink-0 flex flex-col bg-stone-200/70 dark:bg-secondary/40 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                        {stage} <span className="ml-1 text-xs bg-secondary px-2 py-0.5 rounded-full text-foreground">{stageCandidates.length}</span>
                      </h3>
                    </div>

                    <div className="flex-1 space-y-3 min-h-[100px]">
                      {stageCandidates.map((candidate, index) => (
                        <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openCandidateModal(candidate)}
                              className="bg-card p-4 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer"
                              data-testid={`card-candidate-${candidate.id}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <Badge variant="outline" className="text-[10px]">{candidate.jobType || candidate.role}</Badge>
                                <RatingBadge rating={candidate.rating as CandidateRating} />
                              </div>
                              <h4 className="font-bold text-foreground">{candidate.name}</h4>
                              <p className="text-xs text-muted-foreground mb-3">
                                Applied {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : "N/A"}
                              </p>
                              
                              <div className="flex gap-1 border-t pt-3 mt-1">
                                {candidate.phone && (
                                  <a href={`tel:${candidate.phone}`} onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                      <Phone className="w-3 h-3" />
                                    </Button>
                                  </a>
                                )}
                                {candidate.email && (
                                  <a href={`mailto:${candidate.email}`} onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                      <Mail className="w-3 h-3" />
                                    </Button>
                                  </a>
                                )}
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
            );
          })}
        </div>
      </DragDropContext>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNewCandidate ? "Add New Candidate" : "Edit Candidate"}</DialogTitle>
            <DialogDescription>
              {isNewCandidate ? "Enter the candidate's information" : "Update candidate details and manage documents"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="documents" disabled={isNewCandidate}>Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={editForm.name || ""}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    data-testid="input-candidate-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <RatingDots
                    rating={editForm.rating as CandidateRating}
                    onChange={r => setEditForm({ ...editForm, rating: r })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Job Type *</Label>
                  <Select
                    value={editForm.jobType || ""}
                    onValueChange={v => setEditForm({ ...editForm, jobType: v as CandidateJobType })}
                  >
                    <SelectTrigger data-testid="select-job-type">
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showWorkType && (
                  <div className="space-y-2">
                    <Label>Work Type</Label>
                    <Select
                      value={editForm.workType || ""}
                      onValueChange={v => setEditForm({ ...editForm, workType: v as CandidateWorkType })}
                    >
                      <SelectTrigger data-testid="select-work-type">
                        <SelectValue placeholder="Select work type" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email || ""}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    data-testid="input-candidate-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone || ""}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    data-testid="input-candidate-phone"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={editForm.address || ""}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Street address"
                  data-testid="input-candidate-address"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={editForm.city || ""}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                    data-testid="input-candidate-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={editForm.state || ""}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                    data-testid="input-candidate-state"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input
                    value={editForm.zip || ""}
                    onChange={e => setEditForm({ ...editForm, zip: e.target.value })}
                    data-testid="input-candidate-zip"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes || ""}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add notes about this candidate..."
                  rows={4}
                  data-testid="input-candidate-notes"
                />
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Document Type</Label>
                    <Select value={newDocType} onValueChange={setNewDocType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="requiresAck"
                      checked={newDocRequiresAck}
                      onCheckedChange={(c) => setNewDocRequiresAck(c === true)}
                    />
                    <Label htmlFor="requiresAck" className="text-sm">Requires signature</Label>
                  </div>
                  <div>
                    <Label htmlFor="docUpload" className="cursor-pointer">
                      <Button asChild disabled={isUploading}>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {isUploading ? "Uploading..." : "Upload"}
                        </span>
                      </Button>
                    </Label>
                    <input
                      id="docUpload"
                      type="file"
                      className="hidden"
                      onChange={handleDocumentUpload}
                      data-testid="input-document-upload"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {candidateDocuments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No documents uploaded yet</p>
                  ) : (
                    candidateDocuments.map(doc => (
                      <Card key={doc.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.requiresAcknowledgment && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleDocAcknowledgment(doc)}
                                className={doc.acknowledged ? "text-green-600" : "text-muted-foreground"}
                              >
                                {doc.acknowledged ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Signed
                                  </>
                                ) : (
                                  <>
                                    <Circle className="w-4 h-4 mr-1" />
                                    Pending
                                  </>
                                )}
                              </Button>
                            )}
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDocMutation.mutate(doc.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 mt-6">
            {!isNewCandidate && (
              <Button
                variant="destructive"
                onClick={() => selectedCandidate && deleteMutation.mutate(selectedCandidate.id)}
                data-testid="button-delete-candidate"
              >
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-candidate">
              {isNewCandidate ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
