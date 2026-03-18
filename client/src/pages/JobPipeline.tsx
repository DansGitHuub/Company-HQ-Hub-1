import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
  ExternalLink, Clock, AlertCircle, Layers, X, Edit2, Check,
  DollarSign, ArrowRight, Mail
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import DocumentsPanel from "@/components/DocumentsPanel";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/hooks/use-auth";
import type { Job, JobDocument, JobPipelineTab, JobCategory, Estimate, EstimateStage } from "@shared/schema";

const PIPELINE_STAGES = ["Lead", "Quoted", "Scheduled", "In Progress", "Quality Check", "Completed"];
const JOB_TYPES = ["Full Install", "Maintenance", "Hardscape", "Planting", "Irrigation", "Lawn Care", "Design", "Other"];
const ESTIMATE_STAGES: EstimateStage[] = ["New Lead", "Contact Made", "Site Visit", "Proposal Sent", "Follow Up", "Won", "Lost"];

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

function SoldJobsBoard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewJob, setIsNewJob] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Job>>({});
  const [activeTab, setActiveTab] = useState("Install");
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
      toast({ title: t("jobs.jobCreated") });
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
      toast({ title: t("jobs.jobUpdated") });
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: t("jobs.jobDeleted") });
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
      toast({ title: t("jobs.documentUploaded") });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/job-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJob?.id, "documents"] });
      toast({ title: t("jobs.documentDeleted") });
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
      toast({ title: t("jobs.tabCreated") });
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
      if (activeTab === editingTab) setActiveTab("Install");
      toast({ title: t("jobs.tabDeleted") });
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
      category: activeTab as JobCategory 
    });
    setIsNewJob(true);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (isNewJob) {
      createMutation.mutate(editForm);
    } else if (selectedJob) {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...updateData } = editForm as Partial<Job> & { id?: string; createdAt?: unknown; updatedAt?: unknown };
      updateMutation.mutate({ id: selectedJob.id, data: updateData });
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedJob) return;
    
    try {
      const response = await uploadFile(file);
      if (!response) {
        showErrorToast(new Error("Upload returned empty response"), "Upload failed");
        return;
      }
      createDocMutation.mutate({
        jobId: selectedJob.id,
        name: file.name,
        type: newDocType,
        url: response.objectPath,
      });
    } catch (error) {
      showErrorToast(error, "Upload failed");
    }
    e.target.value = "";
  };

  const filteredJobs = jobs.filter(j => j.category === activeTab);

  const builtInTabs = [
    { id: "Install", name: "Install", isBuiltIn: true },
    { id: "Maintenance", name: "Maintenance", isBuiltIn: true },
  ];
  const builtInNames = builtInTabs.map(t => t.name);
  const customTabs = pipelineTabs
    .filter(t => !builtInNames.includes(t.name))
    .map(t => ({ id: t.name, name: t.name, isBuiltIn: false }));
  const allTabs = [...builtInTabs, ...customTabs];

  return (
    <>
      <div className="flex justify-between items-center">
        <div />
        <Button className="gap-2" onClick={openNewJobModal} data-testid="button-add-job">
          <Plus className="w-4 h-4" /> {t("jobs.addJob")}
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        {allTabs.map((tab) => (
          <div key={tab.id} className="relative">
            {editingTab === tab.id && !tab.isBuiltIn ? (
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
                  if (!tab.isBuiltIn) {
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
              placeholder={t("jobs.tabName")}
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
            <Plus className="w-4 h-4 mr-1" /> {t("jobs.addTab")}
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
            <DialogTitle>{isNewJob ? t("jobs.createNewJob") : t("jobs.editJob")}</DialogTitle>
            <DialogDescription>
              {isNewJob ? t("jobs.enterJobDetails") : t("jobs.updateJobInfo")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">{t("common.details")}</TabsTrigger>
              <TabsTrigger value="documents" disabled={isNewJob}>{t("employees.documents")}</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("jobs.clientName")} *</Label>
                  <Input
                    value={editForm.client || ""}
                    onChange={e => setEditForm({ ...editForm, client: e.target.value })}
                    data-testid="input-job-client"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("jobs.serviceType")} *</Label>
                  <Select
                    value={editForm.type || ""}
                    onValueChange={v => setEditForm({ ...editForm, type: v })}
                  >
                    <SelectTrigger data-testid="select-job-type">
                      <SelectValue placeholder={t("jobs.selectJobType")} />
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
                  <Label>{t("common.category")}</Label>
                  <Select
                    value={editForm.category || "Install"}
                    onValueChange={v => setEditForm({ ...editForm, category: v as JobCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Install">{t("jobs.install")}</SelectItem>
                      <SelectItem value="Maintenance">{t("jobs.maintenance")}</SelectItem>
                      {pipelineTabs
                        .filter(tab => !["Install", "Maintenance"].includes(tab.name))
                        .map(tab => (
                          <SelectItem key={tab.name} value={tab.name}>{tab.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("common.value")} ($)</Label>
                  <Input
                    type="number"
                    value={editForm.value || ""}
                    onChange={e => setEditForm({ ...editForm, value: parseInt(e.target.value) || 0 })}
                    data-testid="input-job-value"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("common.address")}</Label>
                <Input
                  value={editForm.address || ""}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder={t("jobs.streetAddress")}
                  data-testid="input-job-address"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("common.city")}</Label>
                  <Input
                    value={editForm.city || ""}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.state")}</Label>
                  <Input
                    value={editForm.state || ""}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.zip")}</Label>
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
                  <MapPin className="w-4 h-4 mr-1" /> {t("common.openInGoogleMaps")}
                </a>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("jobs.scheduledDate")}</Label>
                  <Input
                    type="date"
                    value={editForm.scheduledDate ? new Date(editForm.scheduledDate).toISOString().split('T')[0] : ""}
                    onChange={e => setEditForm({ ...editForm, scheduledDate: e.target.value ? new Date(e.target.value) : undefined })}
                    data-testid="input-job-scheduled-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {t("jobs.completionDate")}
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
                <Label htmlFor="mandatoryDate" className="text-sm">{t("jobs.mandatoryCompletion")}</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("jobs.hoursToComplete")}</Label>
                  <Input
                    type="number"
                    value={editForm.estimatedHours || ""}
                    onChange={e => setEditForm({ ...editForm, estimatedHours: parseInt(e.target.value) || undefined })}
                    placeholder={t("jobs.hoursToComplete")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("jobs.daysToComplete")}</Label>
                  <Input
                    type="number"
                    value={editForm.estimatedDays || ""}
                    onChange={e => setEditForm({ ...editForm, estimatedDays: parseInt(e.target.value) || undefined })}
                    placeholder={t("jobs.daysToComplete")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("jobs.contactName")}</Label>
                  <Input
                    value={editForm.contactName || ""}
                    onChange={e => setEditForm({ ...editForm, contactName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("jobs.contactPhone")}</Label>
                  <Input
                    value={editForm.contactPhone || ""}
                    onChange={e => setEditForm({ ...editForm, contactPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("jobs.additionalPhone")}</Label>
                  <Input
                    value={editForm.contactPhone2 || ""}
                    onChange={e => setEditForm({ ...editForm, contactPhone2: e.target.value })}
                    placeholder={t("jobs.additionalPhone")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("jobs.contactEmail")}</Label>
                  <Input
                    type="email"
                    value={editForm.contactEmail || ""}
                    onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("jobs.zone")}</Label>
                <Input
                  value={editForm.zone || ""}
                  onChange={e => setEditForm({ ...editForm, zone: e.target.value })}
                  placeholder={t("jobs.zonePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("common.notes")}</Label>
                <Textarea
                  value={editForm.notes || ""}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder={t("jobs.notesPlaceholder")}
                  rows={4}
                  data-testid="input-job-notes"
                />
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>{t("common.type")}</Label>
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
                          {isUploading ? t("jobs.uploading") : t("common.upload")}
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
                    <p className="text-muted-foreground text-center py-8">{t("jobs.noDocuments")}</p>
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
                {selectedJob && !isNewJob && (
                  <div className="mt-4">
                    <DocumentsPanel
                      entityType="job"
                      entityId={selectedJob.id}
                      canUpload
                      canShare
                      canLink
                      canDelete
                      canAttachFromLibrary
                      module="job"
                      title={t("jobs.linkedDocuments")}
                      compact
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 flex justify-between items-center">
            {!isNewJob && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(t("common.deleteConfirm"))) {
                    deleteMutation.mutate(selectedJob!.id);
                  }
                }}
                data-testid="button-delete-job"
              >
                {t("common.delete")}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EstimatesBoard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";
  
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewEstimate, setIsNewEstimate] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Estimate>>({});
  const [notifyOnMove, setNotifyOnMove] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertCategory, setConvertCategory] = useState("Install");

  const { data: allEstimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Estimate>) => {
      const res = await apiRequest("POST", "/api/estimates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: t("jobs.estimateCreated") });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/estimates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: t("jobs.estimateUpdated") });
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/estimates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: t("jobs.estimateDeleted") });
      setIsModalOpen(false);
    },
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const res = await apiRequest("POST", `/api/estimates/${id}/convert-to-job`, { category });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: t("jobs.convertedToJob") });
      setShowConvertDialog(false);
      setIsModalOpen(false);
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !isAdmin) return;
    const estimateId = result.draggableId;
    const newStage = result.destination.droppableId as EstimateStage;
    updateMutation.mutate({ id: estimateId, data: { stage: newStage, notifyCustomer: notifyOnMove } });
  };

  const openEstimateModal = (estimate: Estimate) => {
    setSelectedEstimate(estimate);
    setEditForm(estimate);
    setIsNewEstimate(false);
    setIsModalOpen(true);
  };

  const openNewEstimateModal = () => {
    setSelectedEstimate(null);
    setEditForm({ 
      clientName: "",
      serviceType: "Full Install",
      stage: "New Lead",
    });
    setIsNewEstimate(true);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (isNewEstimate) {
      createMutation.mutate(editForm);
    } else if (selectedEstimate) {
      const { id, createdAt, updatedAt, ...updateData } = editForm as any;
      updateMutation.mutate({ id: selectedEstimate.id, data: updateData });
    }
  };

  const getSourceBadge = (source: string | null) => {
    if (source === "work_request") return <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">Work Request</Badge>;
    return <Badge variant="outline" className="text-[10px]">Manual</Badge>;
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="notifyOnMove"
              checked={notifyOnMove}
              onCheckedChange={(c) => setNotifyOnMove(c === true)}
              data-testid="checkbox-notify-on-move"
            />
            <Label htmlFor="notifyOnMove" className="text-sm flex items-center gap-1">
              <Mail className="w-3 h-3" /> {t("jobs.emailCustomer")}
            </Label>
          </div>
        </div>
        <Button className="gap-2" onClick={openNewEstimateModal} data-testid="button-add-estimate">
          <Plus className="w-4 h-4" /> {t("jobs.addEstimate")}
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {ESTIMATE_STAGES.map((stage) => {
            const stageEstimates = allEstimates.filter(e => e.stage === stage);
            
            return (
              <Droppable key={stage} droppableId={stage} isDropDisabled={!isAdmin}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`w-64 shrink-0 flex flex-col rounded-xl p-3 ${
                      stage === "Won" ? "bg-green-100/70 dark:bg-green-950/30" :
                      stage === "Lost" ? "bg-red-100/70 dark:bg-red-950/30" :
                      "bg-stone-200/70 dark:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">
                        {stage}
                      </h3>
                      <Badge variant="secondary" className="rounded-full px-2 py-0">{stageEstimates.length}</Badge>
                    </div>

                    <div className="flex-1 space-y-3 min-h-[100px]">
                      {stageEstimates.map((estimate, index) => (
                        <Draggable key={estimate.id} draggableId={estimate.id} index={index} isDragDisabled={!isAdmin}>
                          {(provided) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openEstimateModal(estimate)}
                              className={`hover-elevate cursor-pointer border-l-4 shadow-sm ${
                                stage === "Won" ? "border-l-green-500" :
                                stage === "Lost" ? "border-l-red-500" :
                                "border-l-amber-500"
                              }`}
                              data-testid={`card-estimate-${estimate.id}`}
                            >
                              <CardContent className="p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                  {getSourceBadge(estimate.source)}
                                </div>
                                <div>
                                  <h4 className="font-bold text-foreground leading-tight text-sm">{estimate.clientName}</h4>
                                  <p className="text-xs text-muted-foreground">{estimate.serviceType}</p>
                                  {estimate.estimatedValue ? (
                                    <p className="text-base font-heading text-primary mt-1">
                                      ${(estimate.estimatedValue || 0).toLocaleString()}
                                    </p>
                                  ) : null}
                                </div>

                                {estimate.propertyAddress && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{estimate.propertyAddress}</span>
                                  </div>
                                )}

                                {estimate.stage === "Won" && isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full mt-1 text-xs gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEstimate(estimate);
                                      setConvertCategory(estimate.serviceType === "Maintenance" ? "Maintenance" : "Install");
                                      setShowConvertDialog(true);
                                    }}
                                    data-testid={`button-convert-${estimate.id}`}
                                  >
                                    <ArrowRight className="w-3 h-3" /> {t("jobs.convertToJob")}
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {stageEstimates.length === 0 && (
                        <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground/50">
                          <DollarSign className="w-5 h-5" />
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNewEstimate ? t("jobs.createNewEstimate") : t("jobs.editEstimate")}</DialogTitle>
            <DialogDescription>
              {isNewEstimate ? t("jobs.enterEstimateDetails") : t("jobs.updateEstimateInfo")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("jobs.clientName")} *</Label>
                <Input
                  value={editForm.clientName || ""}
                  onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                  data-testid="input-estimate-client"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("jobs.serviceType")} *</Label>
                <Select
                  value={editForm.serviceType || undefined}
                  onValueChange={v => setEditForm({ ...editForm, serviceType: v })}
                >
                  <SelectTrigger data-testid="select-estimate-service">
                    <SelectValue placeholder={t("jobs.selectService")} />
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
                <Label>{t("jobs.estimatedValue")} ($)</Label>
                <Input
                  type="number"
                  value={editForm.estimatedValue || ""}
                  onChange={e => setEditForm({ ...editForm, estimatedValue: parseInt(e.target.value) || 0 })}
                  data-testid="input-estimate-value"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("jobs.stage")}</Label>
                <Select
                  value={editForm.stage || undefined}
                  onValueChange={v => setEditForm({ ...editForm, stage: v as EstimateStage })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTIMATE_STAGES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Textarea
                value={editForm.description || ""}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder={t("jobs.estimateDescriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("jobs.propertyAddress")}</Label>
              <Input
                value={editForm.propertyAddress || ""}
                onChange={e => setEditForm({ ...editForm, propertyAddress: e.target.value })}
                placeholder={t("jobs.streetAddress")}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("common.city")}</Label>
                <Input
                  value={editForm.city || ""}
                  onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.state")}</Label>
                <Input
                  value={editForm.state || ""}
                  onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.zip")}</Label>
                <Input
                  value={editForm.zip || ""}
                  onChange={e => setEditForm({ ...editForm, zip: e.target.value })}
                />
              </div>
            </div>

            {(editForm.propertyAddress || editForm.city) && (
              <a
                href={getGoogleMapsLink(editForm.propertyAddress, editForm.city, editForm.state, editForm.zip)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-primary hover:underline"
              >
                <MapPin className="w-4 h-4 mr-1" /> {t("common.openInGoogleMaps")}
              </a>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("jobs.contactName")}</Label>
                <Input
                  value={editForm.contactName || ""}
                  onChange={e => setEditForm({ ...editForm, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("jobs.contactPhone")}</Label>
                <Input
                  value={editForm.contactPhone || ""}
                  onChange={e => setEditForm({ ...editForm, contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("jobs.contactEmail")}</Label>
                <Input
                  type="email"
                  value={editForm.contactEmail || ""}
                  onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("jobs.followUpDate")}</Label>
              <Input
                type="date"
                value={editForm.followUpDate ? new Date(editForm.followUpDate).toISOString().split('T')[0] : ""}
                onChange={e => setEditForm({ ...editForm, followUpDate: e.target.value ? new Date(e.target.value) : undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("common.notes")}</Label>
              <Textarea
                value={editForm.notes || ""}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder={t("jobs.internalNotesPlaceholder")}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-6">
            {!isNewEstimate && isAdmin && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(t("common.deleteConfirm"))) {
                    selectedEstimate && deleteMutation.mutate(selectedEstimate.id);
                  }
                }}
                data-testid="button-delete-estimate"
              >
                {t("common.delete")}
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} data-testid="button-save-estimate">
              {isNewEstimate ? t("jobs.createEstimate") : t("common.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("jobs.convertToJob")}</DialogTitle>
            <DialogDescription>
              {t("jobs.convertEstimateDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t("jobs.selectCategory")}</Label>
              <Select value={convertCategory} onValueChange={setConvertCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Install">Install</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => {
                if (selectedEstimate) {
                  convertMutation.mutate({ id: selectedEstimate.id, category: convertCategory });
                }
              }}
              data-testid="button-confirm-convert"
            >
              <ArrowRight className="w-4 h-4 mr-1" /> {t("common.convert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function JobPipeline() {
  const { t } = useTranslation();
  const [topTab, setTopTab] = useState<"sold" | "estimates">("sold");

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{t("jobs.title")}</h1>
          <p className="text-muted-foreground">{t("jobs.pipelineSubtitle")}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b pb-0">
        <button
          onClick={() => setTopTab("sold")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            topTab === "sold"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="top-tab-sold"
        >
          {t("jobs.soldJobs")}
        </button>
        <button
          onClick={() => setTopTab("estimates")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            topTab === "estimates"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="top-tab-estimates"
        >
          {t("jobs.estimates")}
        </button>
      </div>

      {topTab === "sold" ? <SoldJobsBoard /> : <EstimatesBoard />}
    </div>
  );
}
