import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { 
  Plus, MapPin, Calendar, FileText, Upload, Trash2, 
  ExternalLink, Clock, AlertCircle, Layers, X, Edit2, Check
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import type { Job, JobDocument, JobPipelineTab, JobCategory } from "@shared/schema";

const PIPELINE_STAGES = ["Lead", "Quoted", "Scheduled", "In Progress", "Quality Check", "Completed"];
const JOB_TYPES = ["Full Install", "Maintenance", "Hardscape", "Planting", "Irrigation", "Lawn Care", "Design", "Other"];

const DOCUMENT_TYPES = [
  { value: "permit", label: "Permit" },
  { value: "oups", label: "OUPS (Utility Marking)" },
  { value: "contract", label: "Contract" },
  { value: "work_order", label: "Work Order" },
  { value: "design", label: "Design Layout" },
  { value: "sketch", label: "Sketch" },
  { value: "other", label: "Other" },
];

function getGoogleMapsLink(address?: string | null, city?: string | null, state?: string | null, zip?: string | null): string {
  const parts = [address, city, state, zip].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

export default function JobPipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewJob, setIsNewJob] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Job>>({});
  const [activeTab, setActiveTab] = useState("all");
  const [newDocType, setNewDocType] = useState("permit");
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState("");
  const [showAddTab, setShowAddTab] = useState(false);
  const [addTabName, setAddTabName] = useState("");
  
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: pipelineTabs = [] } = useQuery<JobPipelineTab[]>({
    queryKey: ["/api/job-pipeline-tabs"],
  });

  const { data: jobDocuments = [] } = useQuery<JobDocument[]>({
    queryKey: ["/api/jobs", selectedJob?.id, "documents"],
    queryFn: async () => {
      if (!selectedJob?.id) return [];
      const res = await apiRequest("GET", `/api/jobs/${selectedJob.id}/documents`);
      return res.json();
    },
    enabled: !!selectedJob?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Job>) => {
      const res = await apiRequest("POST", "/api/jobs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job created" });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated" });
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted" });
      setIsModalOpen(false);
    },
  });

  const createDocMutation = useMutation({
    mutationFn: async (data: { jobId: string; name: string; type: string; url: string }) => {
      const res = await apiRequest("POST", `/api/jobs/${data.jobId}/documents`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJob?.id, "documents"] });
      toast({ title: "Document uploaded" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/job-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJob?.id, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const createTabMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/job-pipeline-tabs", { name, sortOrder: pipelineTabs.length });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-pipeline-tabs"] });
      setShowAddTab(false);
      setAddTabName("");
      toast({ title: "Tab created" });
    },
  });

  const updateTabMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/job-pipeline-tabs/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-pipeline-tabs"] });
      setEditingTab(null);
    },
  });

  const deleteTabMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/job-pipeline-tabs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-pipeline-tabs"] });
      if (activeTab === editingTab) setActiveTab("all");
      toast({ title: "Tab deleted" });
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const jobId = result.draggableId;
    const newStage = result.destination.droppableId;
    updateMutation.mutate({ id: jobId, data: { stage: newStage } });
  };

  const openJobModal = (job: Job) => {
    setSelectedJob(job);
    setEditForm(job);
    setIsNewJob(false);
    setIsModalOpen(true);
  };

  const openNewJobModal = () => {
    setSelectedJob(null);
    setEditForm({ 
      client: "", 
      type: "Full Install", 
      stage: "Lead", 
      category: activeTab !== "all" ? (activeTab as JobCategory) : "Project" 
    });
    setIsNewJob(true);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (isNewJob) {
      createMutation.mutate(editForm);
    } else if (selectedJob) {
      const { id, createdAt, updatedAt, ...updateData } = editForm as any;
      updateMutation.mutate({ id: selectedJob.id, data: updateData });
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedJob) return;
    
    try {
      const response = await uploadFile(file);
      if (!response) {
        toast({ title: "Upload failed", variant: "destructive" });
        return;
      }
      createDocMutation.mutate({
        jobId: selectedJob.id,
        name: file.name,
        type: newDocType,
        url: response.objectPath,
      });
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    e.target.value = "";
  };

  const filteredJobs = activeTab === "all" 
    ? jobs 
    : jobs.filter(j => j.category === activeTab);

  const allTabs = [{ id: "all", name: "All Jobs" }, ...pipelineTabs.map(t => ({ id: t.name, name: t.name }))];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Job Pipeline</h1>
          <p className="text-muted-foreground">Track project velocity from lead to completion</p>
        </div>
        <Button className="gap-2" onClick={openNewJobModal} data-testid="button-add-job">
          <Plus className="w-4 h-4" /> New Job
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        {allTabs.map((tab) => (
          <div key={tab.id} className="relative">
            {editingTab === tab.id && tab.id !== "all" ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  className="w-32 h-8"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    const tabToUpdate = pipelineTabs.find(t => t.name === tab.id);
                    if (tabToUpdate && newTabName.trim()) {
                      updateTabMutation.mutate({ id: tabToUpdate.id, name: newTabName });
                    }
                  }}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setEditingTab(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    const tabToDelete = pipelineTabs.find(t => t.name === tab.id);
                    if (tabToDelete) deleteTabMutation.mutate(tabToDelete.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                onDoubleClick={() => {
                  if (tab.id !== "all") {
                    setEditingTab(tab.id);
                    setNewTabName(tab.name);
                  }
                }}
                data-testid={`tab-${tab.id}`}
              >
                {tab.name}
              </Button>
            )}
          </div>
        ))}
        
        {showAddTab ? (
          <div className="flex items-center gap-1">
            <Input
              value={addTabName}
              onChange={(e) => setAddTabName(e.target.value)}
              placeholder="Tab name"
              className="w-32 h-8"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                if (addTabName.trim()) createTabMutation.mutate(addTabName);
              }}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setShowAddTab(false);
                setAddTabName("");
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddTab(true)}
            data-testid="button-add-tab"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Tab
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageJobs = filteredJobs.filter(j => j.stage === stage);
            
            return (
              <Droppable key={stage} droppableId={stage}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="w-72 shrink-0 flex flex-col bg-stone-200/70 dark:bg-secondary/40 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">
                        {stage}
                      </h3>
                      <Badge variant="secondary" className="rounded-full px-2 py-0">{stageJobs.length}</Badge>
                    </div>

                    <div className="flex-1 space-y-3 min-h-[100px]">
                      {stageJobs.map((job, index) => (
                        <Draggable key={job.id} draggableId={job.id} index={index}>
                          {(provided) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openJobModal(job)}
                              className="hover-elevate cursor-pointer border-l-4 border-l-primary shadow-sm"
                              data-testid={`card-job-${job.id}`}
                            >
                              <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                  <Badge variant="outline" className="text-[10px]">{job.type}</Badge>
                                  {job.isMandatoryDate && job.completionDate && (
                                    <div className="flex items-center text-destructive">
                                      <AlertCircle className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                
                                <div>
                                  <h4 className="font-bold text-foreground leading-tight">{job.client}</h4>
                                  <p className="text-lg font-heading text-primary mt-1">
                                    ${(job.value || 0).toLocaleString()}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                  {job.scheduledDate && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(job.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                  )}
                                  {job.zone && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> {job.zone}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {stageJobs.length === 0 && (
                        <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground/50">
                          <Layers className="w-5 h-5" />
                        </div>
                      )}
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
            <DialogTitle>{isNewJob ? "Create New Job" : "Edit Job"}</DialogTitle>
            <DialogDescription>
              {isNewJob ? "Enter the job details" : "Update job information and documents"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="documents" disabled={isNewJob}>Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input
                    value={editForm.client || ""}
                    onChange={e => setEditForm({ ...editForm, client: e.target.value })}
                    data-testid="input-job-client"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job Type *</Label>
                  <Select
                    value={editForm.type || ""}
                    onValueChange={v => setEditForm({ ...editForm, type: v })}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={editForm.category || "Project"}
                    onValueChange={v => setEditForm({ ...editForm, category: v as JobCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Project">Project</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value ($)</Label>
                  <Input
                    type="number"
                    value={editForm.value || ""}
                    onChange={e => setEditForm({ ...editForm, value: parseInt(e.target.value) || 0 })}
                    data-testid="input-job-value"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={editForm.address || ""}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Street address"
                  data-testid="input-job-address"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={editForm.city || ""}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={editForm.state || ""}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input
                    value={editForm.zip || ""}
                    onChange={e => setEditForm({ ...editForm, zip: e.target.value })}
                  />
                </div>
              </div>

              {(editForm.address || editForm.city) && (
                <a
                  href={getGoogleMapsLink(editForm.address, editForm.city, editForm.state, editForm.zip)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  <MapPin className="w-4 h-4 mr-1" /> Open in Google Maps
                </a>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Input
                    type="date"
                    value={editForm.scheduledDate ? new Date(editForm.scheduledDate).toISOString().split('T')[0] : ""}
                    onChange={e => setEditForm({ ...editForm, scheduledDate: e.target.value ? new Date(e.target.value) : undefined })}
                    data-testid="input-job-scheduled-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Completion Date
                    {editForm.isMandatoryDate && <AlertCircle className="w-4 h-4 text-destructive" />}
                  </Label>
                  <Input
                    type="date"
                    value={editForm.completionDate ? new Date(editForm.completionDate).toISOString().split('T')[0] : ""}
                    onChange={e => setEditForm({ ...editForm, completionDate: e.target.value ? new Date(e.target.value) : undefined })}
                    data-testid="input-job-completion-date"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="mandatoryDate"
                  checked={editForm.isMandatoryDate || false}
                  onCheckedChange={(c) => setEditForm({ ...editForm, isMandatoryDate: c === true })}
                />
                <Label htmlFor="mandatoryDate" className="text-sm">Mandatory completion date (cannot be rescheduled)</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estimated Hours</Label>
                  <Input
                    type="number"
                    value={editForm.estimatedHours || ""}
                    onChange={e => setEditForm({ ...editForm, estimatedHours: parseInt(e.target.value) || undefined })}
                    placeholder="Hours to complete"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Days (for jobs &gt; 72 hours)</Label>
                  <Input
                    type="number"
                    value={editForm.estimatedDays || ""}
                    onChange={e => setEditForm({ ...editForm, estimatedDays: parseInt(e.target.value) || undefined })}
                    placeholder="Days to complete"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={editForm.contactName || ""}
                    onChange={e => setEditForm({ ...editForm, contactName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={editForm.contactPhone || ""}
                    onChange={e => setEditForm({ ...editForm, contactPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={editForm.contactEmail || ""}
                    onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Zone</Label>
                <Input
                  value={editForm.zone || ""}
                  onChange={e => setEditForm({ ...editForm, zone: e.target.value })}
                  placeholder="e.g., Zone A, North Side"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes || ""}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add notes about this job..."
                  rows={4}
                  data-testid="input-job-notes"
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
                  <div>
                    <Label htmlFor="jobDocUpload" className="cursor-pointer">
                      <Button asChild disabled={isUploading}>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {isUploading ? "Uploading..." : "Upload"}
                        </span>
                      </Button>
                    </Label>
                    <input
                      id="jobDocUpload"
                      type="file"
                      className="hidden"
                      onChange={handleDocumentUpload}
                      data-testid="input-job-document-upload"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {jobDocuments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No documents uploaded yet</p>
                  ) : (
                    jobDocuments.map(doc => (
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
            {!isNewJob && (
              <Button
                variant="destructive"
                onClick={() => selectedJob && deleteMutation.mutate(selectedJob.id)}
                data-testid="button-delete-job"
              >
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-job">
              {isNewJob ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
