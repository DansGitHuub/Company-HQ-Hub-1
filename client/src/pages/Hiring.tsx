import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Plus, Phone, Mail, MapPin, FileText, Trash2, User, Clock,
  MessageSquare, Calendar, ChevronRight, X, GripVertical, Upload,
  Send, CheckCircle2, Circle, AlertCircle, ClipboardList, Users,
  UserPlus, Copy, Eye, EyeOff, ShieldCheck, Video, ExternalLink, Loader2,
  FileCheck, UserCheck, Briefcase, Lock, HelpCircle, BarChart2, TrendingUp,
} from "lucide-react";
import HiringEmailTemplates from "@/components/HiringEmailTemplates";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import type { Candidate, CandidateDocument, ApplicantNote, ApplicantCommunication } from "@shared/schema";
import OnboardingChecklist from "@/components/OnboardingChecklist";

const STAGES = [
  "Application Received",
  "Phone Screen",
  "Interview Scheduled",
  "1st Interview",
  "2nd Interview",
  "Offer Extended",
  "Negotiating",
  "Offer Accepted",
  "Hired",
  "Offer Declined",
  "Declined / Not a Fit",
] as const;

const STAGE_COLORS: Record<string, string> = {
  "Application Received": "bg-blue-500",
  "Phone Screen": "bg-purple-400",
  "Interview Scheduled": "bg-cyan-500",
  "1st Interview": "bg-amber-500",
  "2nd Interview": "bg-orange-500",
  "Offer Extended": "bg-emerald-500",
  "Negotiating": "bg-amber-500",
  "Offer Accepted": "bg-green-500",
  "Hired": "bg-green-600",
  "Offer Declined": "bg-red-500",
  "Declined / Not a Fit": "bg-gray-400",
};

const SOURCES = ["BetterTeam", "Indeed", "Walk-in", "Phone call", "Email", "Other"];
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [activeTab, setActiveTab] = useState("pipeline");
  const [view, setView] = useState<"pipeline" | "employees">("pipeline");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [detailTab, setDetailTab] = useState("profile");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showDeclined, setShowDeclined] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{ candidateId: string; candidate: Candidate } | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ date: "", time: "", duration: 30, type: "zoom", location: "", notes: "", interviewerName: "" });
  const [scheduling, setScheduling] = useState(false);
  const [pendingOfferExtended, setPendingOfferExtended] = useState<{ candidateId: string; candidate: Candidate } | null>(null);
  const [offerUploading, setOfferUploading] = useState(false);
  const [offerForm, setOfferForm] = useState({
    pay: "",
    payType: "Hourly",
    startDate: "",
    employmentType: "Full-time",
    schedule: "",
    benefits: [] as string[],
    notes: "",
  });
  const [pendingHire, setPendingHire] = useState<{ candidateId: string; candidate: Candidate } | null>(null);
  const [hireStartDate, setHireStartDate] = useState("");
  const [hiring, setHiring] = useState(false);
  const [hireResult, setHireResult] = useState<any>(null);
  const [pendingConvert, setPendingConvert] = useState<{ candidateId: string; candidate: Candidate } | null>(null);
  const [convertForm, setConvertForm] = useState({ startDate: "", employmentType: "Full-time", status: "Active", department: "" });
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<any>(null);
  const [pendingStageChange, setPendingStageChange] = useState<{ candidateId: string; candidate: Candidate; newStage: string } | null>(null);
  const [stageConfirmSend, setStageConfirmSend] = useState(true);
  const [sendInterviewEmail, setSendInterviewEmail] = useState(true);
  const [sendOfferEmail, setSendOfferEmail] = useState(true);
  const [sendHireEmail, setSendHireEmail] = useState(true);

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage, sendNotification = true }: { id: string; stage: string; sendNotification?: boolean }) => {
      const res = await apiRequest("POST", `/api/candidates/${id}/stage`, { stage, sendNotification });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: t("hiring.stageUpdated") });
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
      toast({ title: t("hiring.applicantAdded") });
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
      toast({ title: t("hiring.applicantRemoved") });
    },
  });

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const candidateId = result.draggableId;
    const newStage = result.destination.droppableId;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.stage === newStage) return;

    if (newStage === "Interview Scheduled") {
      setPendingSchedule({ candidateId, candidate });
      setSendInterviewEmail(true);
      setScheduleForm({ date: "", time: "", duration: 30, type: "zoom", location: "", notes: "", interviewerName: "" });
      return;
    }

    if (newStage === "Offer Extended") {
      setPendingOfferExtended({ candidateId, candidate });
      setSendOfferEmail(true);
      setOfferForm({ pay: "", payType: "Hourly", startDate: "", employmentType: "Full-time", schedule: "", benefits: [], notes: "" });
      return;
    }

    if (newStage === "Hired") {
      setPendingHire({ candidateId, candidate });
      setSendHireEmail(true);
      setHireStartDate("");
      setHireResult(null);
      return;
    }

    // All other stages: show confirmation dialog before moving
    setPendingStageChange({ candidateId, candidate, newStage });
    setStageConfirmSend(true);
  }

  async function handleScheduleSubmit() {
    if (!pendingSchedule || !scheduleForm.date || !scheduleForm.time) return;
    setScheduling(true);
    try {
      const res = await apiRequest("POST", `/api/candidates/${pendingSchedule.candidateId}/schedule-interview`, {
        ...scheduleForm,
        sendNotification: sendInterviewEmail,
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Interview Scheduled",
        description: sendInterviewEmail
          ? (data.zoomMeeting
              ? `Zoom meeting created. ${data.emailSent ? "Confirmation email sent." : "No applicant email on file."}`
              : `Interview scheduled. ${data.emailSent ? "Confirmation email sent." : "No applicant email on file."}`)
          : "Interview scheduled. No notification sent to candidate.",
      });
      setPendingSchedule(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to schedule interview", variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  }

  async function handleOfferExtendedSubmit() {
    if (!pendingOfferExtended) return;
    setOfferUploading(true);
    try {
      // Save offer details to candidate record
      await apiRequest("PATCH", `/api/candidates/${pendingOfferExtended.candidateId}`, {
        offerPay: offerForm.pay || null,
        offerPayType: offerForm.payType || null,
        offerStartDate: offerForm.startDate || null,
        offerEmploymentType: offerForm.employmentType || null,
        offerSchedule: offerForm.schedule || null,
        offerBenefits: offerForm.benefits.length > 0 ? offerForm.benefits.join(",") : null,
        offerNotes: offerForm.notes || null,
      });
      // Move stage — triggers token generation + email (if sendOfferEmail is true)
      await apiRequest("POST", `/api/candidates/${pendingOfferExtended.candidateId}/stage`, { stage: "Offer Extended", sendNotification: sendOfferEmail });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Offer Extended",
        description: sendOfferEmail
          ? `Offer details saved and acceptance link sent to ${pendingOfferExtended.candidate.name}.`
          : `Offer details saved. No email sent to ${pendingOfferExtended.candidate.name}.`,
      });
      setPendingOfferExtended(null);
      setOfferForm({ pay: "", payType: "Hourly", startDate: "", employmentType: "Full-time", schedule: "", benefits: [], notes: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to process offer", variant: "destructive" });
    } finally {
      setOfferUploading(false);
    }
  }

  async function handleHireConfirm() {
    if (!pendingHire) return;
    setHiring(true);
    try {
      const res = await apiRequest("POST", `/api/candidates/${pendingHire.candidateId}/hire`, { startDate: hireStartDate, sendNotification: sendHireEmail });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setHireResult(data);
    } catch (err: any) {
      toast({ title: "Error hiring candidate", description: err.message || "Something went wrong", variant: "destructive" });
      setHiring(false);
    } finally {
      setHiring(false);
    }
  }

  async function handleConvertConfirm() {
    if (!pendingConvert) return;
    setConverting(true);
    try {
      const res = await apiRequest("POST", `/api/candidates/${pendingConvert.candidateId}/hire`, {
        startDate: convertForm.startDate || undefined,
        sendNotification: true,
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setConvertResult(data);
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err.message || "Something went wrong", variant: "destructive" });
      setConverting(false);
    } finally {
      setConverting(false);
    }
  }

  const filteredCandidates = sourceFilter === "all"
    ? candidates
    : candidates.filter(c => c.source === sourceFilter);

  const candidatesByStage = STAGES.reduce<Record<string, Candidate[]>>((acc, stage) => {
    acc[stage] = filteredCandidates.filter(c => c.stage === stage);
    return acc;
  }, {});

  const visibleStages = STAGES.filter(s => (s !== "Declined / Not a Fit" && s !== "Offer Declined") || showDeclined);

  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Admin Access Only</h2>
        <p className="text-muted-foreground max-w-sm">
          The Hiring module is restricted to Admins. Contact your administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="hiring-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold" data-testid="text-hiring-title">{t("hiring.title")}</h1>
            <p className="text-muted-foreground mt-1">Manage applicants, application links, and email templates</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHowToUse(true)}
            data-testid="button-how-to-use"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-0.5"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            How to Use
          </Button>
        </div>
      </div>

      <Dialog open={showHowToUse} onOpenChange={setShowHowToUse}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-green-700" />
              How to Use the Hiring Pipeline
            </DialogTitle>
            <DialogDescription>Step-by-step guide for processing applicants from application to hire.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm pt-1">
            {[
              { step: 1, stage: "Application Received", color: "bg-blue-500", desc: "The candidate is automatically created here the moment they submit the online form. You'll get an in-app notification and email. Their card is pre-populated with everything from their application." },
              { step: 2, stage: "Review & Rate", color: "bg-gray-400", desc: "Click the card to open it. Go to the Profile tab to review their info, or click \"View Application\" to see everything they submitted. Set a color rating (green/yellow/red) to flag their potential." },
              { step: 3, stage: "Phone Screen", color: "bg-purple-500", desc: "Drag here if you want to do a quick call before committing to a full interview. Optional — you can skip this stage." },
              { step: 4, stage: "Interview Scheduled", color: "bg-cyan-500", desc: "Dragging here opens the scheduling modal. Pick date, time, duration, and Zoom or In-Person. The system automatically creates the Zoom meeting, adds it to Google Calendar, emails the candidate, and texts them." },
              { step: 5, stage: "1st Interview", color: "bg-amber-500", desc: "Move them here once the first interview is done. Use the Interview tab on the card to record your rating and recommendation." },
              { step: 6, stage: "2nd Interview", color: "bg-orange-500", desc: "Same process if a second round is needed. Schedule via the same drag-to-schedule flow." },
              { step: 7, stage: "Offer Extended", color: "bg-emerald-500", desc: "Dragging here opens the Offer Builder. Fill in pay rate, start date, employment type, schedule, benefits, and any additional notes. Click 'Send Offer' and the candidate automatically receives a personalized acceptance link by email. They sign digitally — no paperwork needed." },
              { step: 8, stage: "Hired", color: "bg-green-600", desc: "The big one. Dragging here automatically: creates an employee record pre-filled from their application, generates their onboarding checklist (I-9, W-4, NDA, etc.), creates a Crew login with a temp password, and sends them a welcome email with credentials." },
              { step: 9, stage: "Declined / Not a Fit", color: "bg-gray-400", desc: "Moves them out of the active pipeline. A notification email is sent to the candidate if that email template is enabled in Admin Panel → Email Templates." },
            ].map(({ step, stage, color, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center`}>{step}</div>
                  {step < 9 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="pb-3">
                  <p className="font-semibold text-foreground">{stage}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="pipeline" data-testid="tab-pipeline">
              <ClipboardList className="h-4 w-4 mr-2" /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-hiring-analytics">
              <BarChart2 className="h-4 w-4 mr-2" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="application-links" data-testid="tab-application-links">
              <ExternalLink className="h-4 w-4 mr-2" /> Application Links
            </TabsTrigger>
            <TabsTrigger value="email-templates" data-testid="tab-email-templates">
              <Mail className="h-4 w-4 mr-2" /> Email Templates
            </TabsTrigger>
          </TabsList>
          {activeTab === "pipeline" && (
            <div className="flex gap-2">
              <Button
                variant={view === "pipeline" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("pipeline")}
                data-testid="button-view-pipeline"
              >
                <ClipboardList className="h-4 w-4 mr-2" /> {t("hiring.pipeline")}
              </Button>
              <Button
                variant={view === "employees" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("employees")}
                data-testid="button-view-employees"
              >
                <Users className="h-4 w-4 mr-2" /> {t("employees.title")}
              </Button>
              {view === "pipeline" && (
                <Button size="sm" onClick={() => setShowAddDialog(true)} data-testid="button-add-applicant">
                  <Plus className="h-4 w-4 mr-2" /> {t("hiring.addApplicant")}
                </Button>
              )}
            </div>
          )}
        </div>

        <TabsContent value="pipeline" className="mt-2">
        {view === "pipeline" ? (
        <>
          {/* Board filter bar */}
          <div className="flex items-center gap-3 flex-wrap" data-testid="board-filter-bar">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground font-medium">Source:</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-source-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={showDeclined ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowDeclined(v => !v)}
              data-testid="button-toggle-declined"
            >
              {showDeclined ? "Hide Declined" : "Show Declined"}
              {!showDeclined && ((candidatesByStage["Declined / Not a Fit"]?.length || 0) + (candidatesByStage["Offer Declined"]?.length || 0)) > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1">
                  {(candidatesByStage["Declined / Not a Fit"]?.length || 0) + (candidatesByStage["Offer Declined"]?.length || 0)}
                </Badge>
              )}
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "70vh" }}>
              {visibleStages.map((stage) => {
                const isOptional = stage === "2nd Interview";
                const isDeclined = stage === "Declined / Not a Fit";
                return (
                  <Droppable key={stage} droppableId={stage}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-shrink-0 w-64 rounded-lg border p-3 transition-colors ${
                          isDeclined ? "opacity-75 border-dashed" :
                          snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                        }`}
                        data-testid={`column-${stage.toLowerCase().replace(/[\s/]+/g, "-")}`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`h-3 w-3 rounded-full flex-shrink-0 ${STAGE_COLORS[stage]}`} />
                          <h3 className="font-semibold text-sm leading-tight">{stage}</h3>
                          {isOptional && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 shrink-0" data-testid="badge-optional">
                              Optional
                            </span>
                          )}
                          <Badge variant="secondary" className="ml-auto text-xs shrink-0">
                            {candidatesByStage[stage]?.length || 0}
                          </Badge>
                        </div>
                        {isOptional && (
                          <p className="text-[10px] text-muted-foreground mb-2 leading-tight">
                            Cards can skip directly to Offer Extended
                          </p>
                        )}
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
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : "N/A"}
                                    </div>
                                    {candidate.source && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" data-testid={`source-badge-${candidate.id}`}>
                                        {candidate.source}
                                      </span>
                                    )}
                                  </div>
                                  {/* Offer letter badge on card */}
                                  {(candidate as any).hasOfferLetter && (
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-1.5 font-medium">
                                      <FileCheck className="h-3 w-3" /> Offer Letter Attached
                                    </div>
                                  )}
                                  {/* Counter-proposal note on Negotiating cards */}
                                  {stage === "Negotiating" && (candidate as any).offerCounterNote && (
                                    <div className="mt-2 pt-2 border-t border-border">
                                      <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide mb-0.5">Counter Proposal</p>
                                      <p className="text-xs text-gray-600 line-clamp-2">{(candidate as any).offerCounterNote}</p>
                                    </div>
                                  )}
                                  {/* Offer Accepted badge + Convert button */}
                                  {stage === "Offer Accepted" && (
                                    <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                                        <CheckCircle2 className="h-3 w-3" /> Offer Accepted
                                      </div>
                                      <button
                                        className="w-full text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1 font-medium transition-colors flex items-center justify-center gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingConvert({ candidateId: candidate.id, candidate });
                                          setConvertForm({
                                            startDate: (candidate as any).offerStartDate || "",
                                            employmentType: (candidate as any).offerEmploymentType || "Full-time",
                                            status: "Active",
                                            department: "",
                                          });
                                          setConvertResult(null);
                                        }}
                                        data-testid={`button-convert-${candidate.id}`}
                                      >
                                        <UserCheck className="h-3 w-3" /> Convert to Employee
                                      </button>
                                    </div>
                                  )}
                                  {/* Interview details on card */}
                                  {candidate.interviewDate && (
                                    <div className="mt-2 pt-2 border-t border-border space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3 flex-shrink-0" />
                                        <span>{new Date(candidate.interviewDate).toLocaleDateString()} {candidate.interviewTime && `· ${candidate.interviewTime}`}</span>
                                      </div>
                                      {(candidate as any).zoomMeetingUrl ? (
                                        <a
                                          href={(candidate as any).zoomMeetingUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                          data-testid={`link-zoom-${candidate.id}`}
                                        >
                                          <Video className="h-3 w-3" /> Join Zoom
                                        </a>
                                      ) : candidate.interviewType ? (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <MapPin className="h-3 w-3" />
                                          <span className="capitalize">{candidate.interviewType}{candidate.interviewLocation ? ` · ${candidate.interviewLocation}` : ""}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
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
        </>
      ) : (
        <EmployeeRecords />
      )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <HiringAnalytics />
        </TabsContent>

        <TabsContent value="application-links" className="mt-4">
          <ApplicationLinksPanel />
        </TabsContent>

        <TabsContent value="email-templates" className="mt-4">
          <HiringEmailTemplates />
        </TabsContent>
      </Tabs>

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
          onDelete={() => deleteMutation.mutate(selectedCandidate.id)}
          tab={detailTab}
          onTabChange={setDetailTab}
        />
      )}

      {/* Offer Extended Modal — Step 4.1 */}
      <Dialog open={!!pendingOfferExtended} onOpenChange={(open) => { if (!open && !offerUploading) { setPendingOfferExtended(null); setOfferForm({ pay: "", payType: "Hourly", startDate: "", employmentType: "Full-time", schedule: "", benefits: [], notes: "" }); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-offer-extended">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              Build Offer — {pendingOfferExtended?.candidate.name}
            </DialogTitle>
            <DialogDescription>
              Fill in the offer details below. Once confirmed, the candidate will receive a personalized offer acceptance link by email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Compensation */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1.5 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-600" /> Compensation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="offer-pay">Pay Rate</Label>
                  <Input
                    id="offer-pay"
                    placeholder="e.g. 20.00"
                    value={offerForm.pay}
                    onChange={e => setOfferForm(f => ({ ...f, pay: e.target.value }))}
                    data-testid="input-offer-pay"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="offer-pay-type">Pay Type</Label>
                  <Select value={offerForm.payType} onValueChange={v => setOfferForm(f => ({ ...f, payType: v }))}>
                    <SelectTrigger id="offer-pay-type" data-testid="select-offer-pay-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hourly">Hourly</SelectItem>
                      <SelectItem value="Salary">Salary (Annual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Start Date & Employment */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1.5 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" /> Start Date &amp; Employment
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="offer-start-date">Start Date</Label>
                  <Input
                    id="offer-start-date"
                    type="date"
                    value={offerForm.startDate}
                    onChange={e => setOfferForm(f => ({ ...f, startDate: e.target.value }))}
                    data-testid="input-offer-start-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="offer-emp-type">Employment Type</Label>
                  <Select value={offerForm.employmentType} onValueChange={v => setOfferForm(f => ({ ...f, employmentType: v }))}>
                    <SelectTrigger id="offer-emp-type" data-testid="select-offer-employment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Seasonal">Seasonal</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="offer-schedule">Work Schedule</Label>
                <Input
                  id="offer-schedule"
                  placeholder="e.g. Monday–Friday, 7:00am – 4:00pm"
                  value={offerForm.schedule}
                  onChange={e => setOfferForm(f => ({ ...f, schedule: e.target.value }))}
                  data-testid="input-offer-schedule"
                />
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1.5 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Benefits Package
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Health Insurance",
                  "Dental Insurance",
                  "Vision Insurance",
                  "401(k) Plan",
                  "Paid Time Off (PTO)",
                  "Paid Holidays",
                  "Company Vehicle",
                  "Fuel Card",
                  "Uniform Provided",
                  "Tool Allowance",
                  "Cell Phone Allowance",
                  "Overtime Eligible",
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <Checkbox
                      id={`benefit-${benefit}`}
                      checked={offerForm.benefits.includes(benefit)}
                      onCheckedChange={(checked) =>
                        setOfferForm(f => ({
                          ...f,
                          benefits: checked
                            ? [...f.benefits, benefit]
                            : f.benefits.filter(b => b !== benefit),
                        }))
                      }
                      data-testid={`checkbox-benefit-${benefit.toLowerCase().replace(/\W+/g, "-")}`}
                    />
                    <Label htmlFor={`benefit-${benefit}`} className="text-sm cursor-pointer">{benefit}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1.5 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" /> Additional Notes
              </h3>
              <Textarea
                placeholder="Any other offer details, conditions, or expectations to share with the candidate…"
                value={offerForm.notes}
                onChange={e => setOfferForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                data-testid="textarea-offer-notes"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 mx-1 mb-1">
            <Checkbox
              id="send-offer-email"
              checked={sendOfferEmail}
              onCheckedChange={(v) => setSendOfferEmail(!!v)}
              data-testid="checkbox-send-offer-email"
            />
            <div>
              <label htmlFor="send-offer-email" className="text-sm font-medium cursor-pointer">Send offer email &amp; SMS to candidate</label>
              <p className="text-xs text-muted-foreground">Email the acceptance link and send an SMS to {pendingOfferExtended?.candidate.name}</p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={() => { setPendingOfferExtended(null); setOfferForm({ pay: "", payType: "Hourly", startDate: "", employmentType: "Full-time", schedule: "", benefits: [], notes: "" }); }} disabled={offerUploading}>
              Cancel
            </Button>
            <Button onClick={handleOfferExtendedSubmit} disabled={offerUploading} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-confirm-offer">
              {offerUploading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending Offer…</>
                : <><Send className="h-4 w-4 mr-2" />Send Offer to Candidate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hired Modal — Steps 4.2–4.5 */}
      <Dialog open={!!pendingHire} onOpenChange={(open) => { if (!open && !hiring && !hireResult) { setPendingHire(null); setHireResult(null); } }}>
        <DialogContent className="max-w-md" data-testid="dialog-hire-candidate">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Confirm Hire
            </DialogTitle>
            {pendingHire && !hireResult && (
              <DialogDescription>
                Hiring <strong>{pendingHire.candidate.name}</strong> will automatically create their employee record,
                onboarding checklist, and Crew account.
              </DialogDescription>
            )}
          </DialogHeader>

          {!hireResult ? (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4 text-primary" /> Employee record created from application data</div>
                <div className="flex items-center gap-2 text-muted-foreground"><ClipboardList className="h-4 w-4 text-primary" /> Onboarding checklist (I-9, W-4, NDA, OSHA + more)</div>
                <div className="flex items-center gap-2 text-muted-foreground"><UserCheck className="h-4 w-4 text-primary" /> Crew account with login credentials</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Send className="h-4 w-4 text-primary" /> Welcome email to employee + admin notification</div>
              </div>
              <div>
                <Label>Start Date (optional)</Label>
                <Input
                  type="date"
                  value={hireStartDate}
                  onChange={e => setHireStartDate(e.target.value)}
                  data-testid="input-hire-start-date"
                />
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <Checkbox
                  id="send-hire-email"
                  checked={sendHireEmail}
                  onCheckedChange={(v) => setSendHireEmail(!!v)}
                  data-testid="checkbox-send-hire-email"
                />
                <div>
                  <label htmlFor="send-hire-email" className="text-sm font-medium cursor-pointer">Send welcome email &amp; SMS to employee</label>
                  <p className="text-xs text-muted-foreground">Email login credentials and send an SMS to {pendingHire?.candidate.name}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Hired successfully!</p>
                {hireResult.accountCreated && (
                  <p className="text-sm text-emerald-700">Crew account created — username: <strong>{hireResult.username}</strong></p>
                )}
                {hireResult.emailSent && (
                  <p className="text-sm text-emerald-700">Welcome email sent to employee.</p>
                )}
                <p className="text-sm text-emerald-700">{hireResult.onboardingItems} onboarding checklist items created.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!hireResult ? (
              <>
                <Button variant="outline" onClick={() => setPendingHire(null)} disabled={hiring}>Cancel</Button>
                <Button onClick={handleHireConfirm} disabled={hiring} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-confirm-hire">
                  {hiring ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</> : <><UserCheck className="h-4 w-4 mr-2" />Hire & Create Account</>}
                </Button>
              </>
            ) : (
              <Button onClick={() => { setPendingHire(null); setHireResult(null); }} data-testid="button-hire-done">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Employee Modal */}
      <Dialog open={!!pendingConvert} onOpenChange={(open) => { if (!open && !converting && !convertResult) { setPendingConvert(null); setConvertResult(null); } }}>
        <DialogContent className="max-w-lg" data-testid="dialog-convert-candidate">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              Convert to Employee
            </DialogTitle>
            {pendingConvert && !convertResult && (
              <DialogDescription>
                Creating an employee record for <strong>{pendingConvert.candidate.name}</strong>. Review the details below before confirming.
              </DialogDescription>
            )}
          </DialogHeader>

          {!convertResult ? (
            <div className="space-y-4 py-2">
              {/* Preview of candidate info being carried over */}
              <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-sm border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Carrying over from application</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div><span className="text-muted-foreground">Name: </span><span className="font-medium">{pendingConvert?.candidate.name}</span></div>
                  <div><span className="text-muted-foreground">Role: </span><span className="font-medium">{pendingConvert?.candidate.role || "—"}</span></div>
                  {(pendingConvert?.candidate as any)?.email && (
                    <div className="col-span-2"><span className="text-muted-foreground">Email: </span><span className="font-medium">{(pendingConvert?.candidate as any).email}</span></div>
                  )}
                  {(pendingConvert?.candidate as any)?.offerPay && (
                    <div><span className="text-muted-foreground">Pay: </span><span className="font-medium">${(pendingConvert?.candidate as any).offerPay}/{(pendingConvert?.candidate as any).offerPayType === "Salary" ? "yr" : "hr"}</span></div>
                  )}
                </div>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={convertForm.startDate}
                    onChange={e => setConvertForm(f => ({ ...f, startDate: e.target.value }))}
                    data-testid="input-convert-start-date"
                  />
                  <p className="text-[10px] text-muted-foreground">Pre-filled from offer letter</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Employment Type</Label>
                  <Select value={convertForm.employmentType} onValueChange={v => setConvertForm(f => ({ ...f, employmentType: v }))}>
                    <SelectTrigger data-testid="select-convert-employment-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Seasonal">Seasonal</SelectItem>
                      <SelectItem value="Contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Initial Status</Label>
                  <Select value={convertForm.status} onValueChange={v => setConvertForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger data-testid="select-convert-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Seasonal Off">Seasonal Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Department (optional)</Label>
                  <Input
                    value={convertForm.department}
                    onChange={e => setConvertForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Field Crew, Office"
                    data-testid="input-convert-department"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                This will create an employee record, generate the onboarding checklist (I-9, W-4, NDA, etc.), and create a Crew login. A welcome email will be sent to the employee.
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Employee record created!</p>
                {convertResult.accountCreated && (
                  <p className="text-sm text-emerald-700">Crew account created — username: <strong>{convertResult.username}</strong></p>
                )}
                {convertResult.emailSent && (
                  <p className="text-sm text-emerald-700">Welcome email sent to employee.</p>
                )}
                <p className="text-sm text-emerald-700">{convertResult.onboardingItems} onboarding checklist items created.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!convertResult ? (
              <>
                <Button variant="outline" onClick={() => setPendingConvert(null)} disabled={converting}>Cancel</Button>
                <Button onClick={handleConvertConfirm} disabled={converting} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-convert">
                  {converting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating Employee…</> : <><UserCheck className="h-4 w-4 mr-2" />Create Employee Record</>}
                </Button>
              </>
            ) : (
              <Button onClick={() => { setPendingConvert(null); setConvertResult(null); }} data-testid="button-convert-done">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interview Schedule Modal */}
      <Dialog open={!!pendingSchedule} onOpenChange={(open) => { if (!open && !scheduling) setPendingSchedule(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-schedule-interview">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Schedule Interview
            </DialogTitle>
            {pendingSchedule && (
              <DialogDescription>
                Scheduling interview for <strong>{pendingSchedule.candidate.name}</strong> — {pendingSchedule.candidate.role}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={scheduleForm.date}
                  onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))}
                  data-testid="input-schedule-date"
                />
              </div>
              <div>
                <Label>Time <span className="text-red-500">*</span></Label>
                <Input
                  type="time"
                  value={scheduleForm.time}
                  onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))}
                  data-testid="input-schedule-time"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Duration</Label>
                <Select value={String(scheduleForm.duration)} onValueChange={v => setScheduleForm(f => ({ ...f, duration: Number(v) }))}>
                  <SelectTrigger data-testid="select-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Interview Type</Label>
                <Select value={scheduleForm.type} onValueChange={v => setScheduleForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-interview-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zoom">
                      <div className="flex items-center gap-2"><Video className="h-4 w-4 text-blue-500" /> Zoom</div>
                    </SelectItem>
                    <SelectItem value="in-person">
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> In-Person</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {scheduleForm.type === "zoom" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                <Video className="h-3.5 w-3.5 flex-shrink-0" />
                A Zoom meeting will be created and the applicant will receive a link via email.
              </div>
            )}

            {scheduleForm.type === "in-person" && (
              <div>
                <Label>Location</Label>
                <Input
                  value={scheduleForm.location}
                  onChange={e => setScheduleForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. 123 Main St, Chardon OH"
                  data-testid="input-schedule-location"
                />
              </div>
            )}

            <div>
              <Label>Interviewer Name</Label>
              <Input
                value={scheduleForm.interviewerName}
                onChange={e => setScheduleForm(f => ({ ...f, interviewerName: e.target.value }))}
                placeholder="e.g. Dan Chapin"
                data-testid="input-schedule-interviewer"
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={scheduleForm.notes}
                onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes to include in the email..."
                rows={2}
                data-testid="textarea-schedule-notes"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 mt-1">
            <Checkbox
              id="send-interview-email"
              checked={sendInterviewEmail}
              onCheckedChange={(v) => setSendInterviewEmail(!!v)}
              data-testid="checkbox-send-interview-email"
            />
            <div>
              <label htmlFor="send-interview-email" className="text-sm font-medium cursor-pointer">Send email &amp; SMS to candidate</label>
              <p className="text-xs text-muted-foreground">Notify the applicant with interview details</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSchedule(null)} disabled={scheduling}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleSubmit}
              disabled={!scheduleForm.date || !scheduleForm.time || scheduling}
              data-testid="button-confirm-schedule"
            >
              {scheduling ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Scheduling...</>
              ) : (
                <><Calendar className="h-4 w-4 mr-2" /> Schedule Interview</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Move Confirmation Dialog */}
      <Dialog open={!!pendingStageChange} onOpenChange={(open) => { if (!open) setPendingStageChange(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-stage-confirm">
          <DialogHeader>
            <DialogTitle>Move to {pendingStageChange?.newStage}?</DialogTitle>
            <DialogDescription>
              Moving <strong>{pendingStageChange?.candidate.name}</strong> to <strong>{pendingStageChange?.newStage}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <Checkbox
                id="stage-confirm-send"
                checked={stageConfirmSend}
                onCheckedChange={(v) => setStageConfirmSend(!!v)}
                data-testid="checkbox-stage-confirm-send"
              />
              <div>
                <label htmlFor="stage-confirm-send" className="text-sm font-medium cursor-pointer">Send email &amp; SMS to candidate</label>
                <p className="text-xs text-muted-foreground">Sends the email template for this stage (if enabled) and an SMS</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStageChange(null)} data-testid="button-cancel-stage-confirm">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingStageChange) return;
                stageMutation.mutate({ id: pendingStageChange.candidateId, stage: pendingStageChange.newStage, sendNotification: stageConfirmSend });
                setPendingStageChange(null);
              }}
              data-testid="button-confirm-stage-move"
            >
              Confirm Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationLinksPanel() {
  const [expiryDays, setExpiryDays] = useState<14 | 30>(30);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePosition, setCandidatePosition] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [emailOpenId, setEmailOpenId] = useState<string | null>(null);
  const [emailInputs, setEmailInputs] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: links = [], refetch } = useQuery<any[]>({
    queryKey: ["/api/apply"],
    queryFn: async () => {
      const r = await fetch("/api/apply", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const appUrl = window.location.origin;

  const generateLink = async () => {
    setGenerating(true);
    try {
      const r = await fetch("/api/apply/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expiryDays,
          applicantName: candidateName.trim() || undefined,
          applicantEmail: candidateEmail.trim() || undefined,
          position: candidatePosition.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error("Failed to generate");
      setCandidateName("");
      setCandidateEmail("");
      setCandidatePosition("");
      await refetch();
    } catch {
      alert("Failed to generate link. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${appUrl}/apply/${token}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm("Delete this application link? This cannot be undone.")) return;
    setDeletingId(linkId);
    try {
      const r = await fetch(`/api/apply/${linkId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        toast({ title: "Cannot delete", description: body.message || "Something went wrong.", variant: "destructive" });
        return;
      }
      toast({ title: "Link deleted", description: "The application link has been removed." });
      await refetch();
    } catch {
      toast({ title: "Error", description: "Failed to delete link.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendEmail = async (linkId: string) => {
    const email = (emailInputs[linkId] || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErrors(prev => ({ ...prev, [linkId]: "Please enter a valid email address." }));
      return;
    }
    setEmailErrors(prev => ({ ...prev, [linkId]: "" }));
    setSendingId(linkId);
    try {
      const r = await fetch(`/api/apply/${linkId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Failed to send");
      setSentIds(prev => new Set([...Array.from(prev), linkId]));
      setEmailOpenId(null);
      setEmailInputs(prev => ({ ...prev, [linkId]: "" }));
      toast({ title: "Email sent!", description: `Application link sent to ${email}` });
      setTimeout(() => setSentIds(prev => { const s = new Set(prev); s.delete(linkId); return s; }), 3000);
    } catch (err: any) {
      setEmailErrors(prev => ({ ...prev, [linkId]: err.message || "Failed to send email." }));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Generate Application Link</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create a unique shareable link for an applicant. All fields below are optional — fill them in so you know who this link was sent to.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Candidate Name <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                data-testid="input-candidate-name"
                value={candidateName}
                onChange={e => setCandidateName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Candidate Email <span className="text-gray-400">(optional)</span></label>
              <input
                type="email"
                data-testid="input-candidate-email-gen"
                value={candidateEmail}
                onChange={e => setCandidateEmail(e.target.value)}
                placeholder="jane@email.com"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Position <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                data-testid="input-candidate-position"
                value={candidatePosition}
                onChange={e => setCandidatePosition(e.target.value)}
                placeholder="Landscape Crew Member"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Expires in:</span>
              {([14, 30] as const).map(d => (
                <button
                  key={d}
                  data-testid={`button-expiry-${d}`}
                  onClick={() => setExpiryDays(d)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    expiryDays === d
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-600 border-gray-300 hover:border-green-600"
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
            <button
              data-testid="button-generate-link"
              onClick={generateLink}
              disabled={generating}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><ExternalLink className="h-4 w-4" /> Generate Link</>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Generated Links</h3>
          {links.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No application links yet. Generate one above to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link: any) => {
                const url = `${appUrl}/apply/${link.token}`;
                const expired = new Date() > new Date(link.expiresAt);
                const statusColor = link.status === "submitted" ? "text-green-700 bg-green-50 border-green-200"
                  : expired ? "text-red-600 bg-red-50 border-red-200"
                  : "text-blue-700 bg-blue-50 border-blue-200";
                const statusLabel = link.status === "submitted" ? "Submitted"
                  : expired ? "Expired" : "Open";
                return (
                  <div key={link.id} data-testid={`card-application-link-${link.id}`} className="border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>{statusLabel}</span>
                        {link.applicantName && <span className="text-sm font-medium text-gray-700">{link.applicantName}</span>}
                        {link.position && <span className="text-xs text-gray-500">— {link.position}</span>}
                        {link.applicantEmail && <span className="text-xs text-gray-400">({link.applicantEmail})</span>}
                      </div>
                      <span className="text-xs text-gray-400">
                        Expires {new Date(link.expiresAt).toLocaleDateString()} · Created {new Date(link.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-600 truncate">{url}</code>
                      <button
                        data-testid={`button-copy-link-${link.id}`}
                        onClick={() => copyLink(link.token, link.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                      >
                        {copiedId === link.id ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /><span className="text-green-600">Copied!</span></>
                        ) : (
                          <><Copy className="h-3.5 w-3.5" /> Copy Link</>
                        )}
                      </button>
                      <button
                        data-testid={`button-send-email-${link.id}`}
                        onClick={() => {
                          const opening = emailOpenId !== link.id;
                          setEmailOpenId(opening ? link.id : null);
                          if (opening && link.applicantEmail && !emailInputs[link.id]) {
                            setEmailInputs(prev => ({ ...prev, [link.id]: link.applicantEmail }));
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                          sentIds.has(link.id)
                            ? "border-green-300 text-green-700 bg-green-50"
                            : emailOpenId === link.id
                            ? "border-blue-300 text-blue-700 bg-blue-50"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {sentIds.has(link.id) ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Sent!</>
                        ) : (
                          <><Mail className="h-3.5 w-3.5" /> Send via Email</>
                        )}
                      </button>
                      <button
                        data-testid={`button-delete-link-${link.id}`}
                        onClick={() => handleDeleteLink(link.id)}
                        disabled={deletingId === link.id || link.status === "submitted"}
                        title={link.status === "submitted" ? "Cannot delete a submitted application" : "Delete this link"}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {deletingId === link.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    {/* Inline email form */}
                    {emailOpenId === link.id && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">
                          {link.applicantEmail ? `Sending to ${link.applicantEmail} — confirm or change the address below.` : "Enter the applicant's email to send them this link directly."}
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            data-testid={`input-applicant-email-${link.id}`}
                            value={emailInputs[link.id] || ""}
                            onChange={e => setEmailInputs(prev => ({ ...prev, [link.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleSendEmail(link.id); }}
                            placeholder="applicant@email.com"
                            className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                          />
                          <button
                            data-testid={`button-confirm-send-email-${link.id}`}
                            onClick={() => handleSendEmail(link.id)}
                            disabled={sendingId === link.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-700 hover:bg-green-800 text-white text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {sendingId === link.id ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                            ) : (
                              <><Send className="h-3.5 w-3.5" /> Send</>
                            )}
                          </button>
                          <button
                            onClick={() => { setEmailOpenId(null); setEmailErrors(prev => ({ ...prev, [link.id]: "" })); }}
                            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            data-testid={`button-cancel-email-${link.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {emailErrors[link.id] && (
                          <p className="text-xs text-red-500 mt-1">{emailErrors[link.id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddApplicantDialog({ open, onClose, onSave, isPending }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const defaultForm = {
    name: "", role: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
    source: "", rating: "green",
  };
  const [form, setForm] = useState(defaultForm);

  const handleSave = () => {
    onSave({ ...form, stage: "Application Received" });
    setForm(defaultForm);
  };

  const handleClose = () => {
    setForm(defaultForm);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("hiring.addApplicant")}</DialogTitle>
          <DialogDescription>Enter the new applicant's information</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("auth.fullName")} *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-applicant-name" />
            </div>
            <div className="space-y-1">
              <Label>{t("employees.position")} *</Label>
              <Select value={form.role || undefined} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="select-applicant-role"><SelectValue placeholder="Select position..." /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("common.email")}</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-applicant-email" />
            </div>
            <div className="space-y-1">
              <Label>{t("common.phone")}</Label>
              <Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-applicant-phone" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("hiring.stage")}</Label>
            <Select value={form.source || undefined} onValueChange={v => setForm({ ...form, source: v })}>
              <SelectTrigger data-testid="select-source"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
              <SelectContent>
                {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("common.address")}</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="input-applicant-address" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("common.city")}</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t("common.state")}</Label>
              <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t("common.zip")}</Label>
              <Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("common.status")}</Label>
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
                  {r === "green" ? t("status.active") : r === "yellow" ? t("status.needsAttention") : t("status.overdue")}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t("common.cancel")}</Button>
          <Button
            onClick={handleSave}
            disabled={!form.name || !form.role || isPending}
            data-testid="button-save-applicant"
          >
            {isPending ? t("hiring.adding") : t("hiring.addApplicant")}
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{ username: string; tempPassword: string; emailSent: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const showOnboarding = candidate.stage === "Hired";
  const availableTabs = ["profile", "documents", "communication", "interview"];
  if (showOnboarding) availableTabs.push("onboarding");

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/candidates/${candidate.id}/create-account`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create account");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setAccountInfo({ username: data.username, tempPassword: data.tempPassword, emailSent: data.emailSent });
      setShowPassword(false);
      setShowAccountDialog(true);
    },
    onError: (err: Error) => {
      toast({ title: "Account creation failed", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied to clipboard` });
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300" data-testid="applicant-detail-panel">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
            {getInitials(candidate.name)}
          </div>
          <div>
            <h2 className="font-semibold">{candidate.name}</h2>
            <p className="text-sm text-muted-foreground">{candidate.role}</p>
          </div>
          <Badge className={`${STAGE_COLORS[candidate.stage]} text-white ml-2`}>
            {candidate.stage}
          </Badge>
          {candidate.stage === "Hired" && candidate.userId && (
            <Badge className="bg-blue-600 text-white flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Account Active
            </Badge>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {candidate.stage === "Hired" && !candidate.userId && (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => createAccountMutation.mutate()}
              disabled={createAccountMutation.isPending}
              data-testid="button-create-account"
            >
              <UserPlus className="h-4 w-4" />
              {createAccountMutation.isPending ? "Creating…" : "Create Account"}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} data-testid="button-delete-candidate">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Account Created Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <ShieldCheck className="h-5 w-5" />
              Account Created
            </DialogTitle>
            <DialogDescription>
              A Company HQ account has been created for <strong>{candidate.name}</strong>.
              {accountInfo?.emailSent
                ? " Their login credentials have been sent to their email."
                : " No email on file — share these credentials directly."}
            </DialogDescription>
          </DialogHeader>
          {accountInfo && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Username</p>
                    <p className="font-mono font-semibold text-sm">{accountInfo.username}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(accountInfo.username, "Username")}
                    data-testid="button-copy-username"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Temporary Password</p>
                    <p className="font-mono font-semibold text-sm tracking-wider">
                      {showPassword ? accountInfo.tempPassword : "••••••••••"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(accountInfo.tempPassword, "Password")}
                      data-testid="button-copy-password"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The new hire should log in and change their password on first use. Their role is set to <strong>Crew</strong> and their onboarding checklist is ready.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowAccountDialog(false)} data-testid="button-close-account-dialog">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { setShowDeleteConfirm(open); if (!open) setDeleteConfirmText(""); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-candidate">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Applicant
            </DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{candidate.name}</strong> from the pipeline. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoComplete="off"
              data-testid="input-delete-confirm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteConfirmText === "DELETE") {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  onDelete();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE"}
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText("");
                onDelete();
              }}
              data-testid="button-confirm-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Applicant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={onTabChange} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 justify-start">
          <TabsTrigger value="profile" data-testid="tab-profile">{t("profile.title")}</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">{t("employees.documents")}</TabsTrigger>
          <TabsTrigger value="communication" data-testid="tab-communication">{t("hiring.communications")}</TabsTrigger>
          <TabsTrigger value="interview" data-testid="tab-interview">{t("hiring.interview")}</TabsTrigger>
          {showOnboarding && <TabsTrigger value="onboarding" data-testid="tab-onboarding">{t("hiring.onboarding")}</TabsTrigger>}
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

function ApplicationViewDialog({ candidateId, candidateName, open, onClose }: {
  candidateId: string;
  candidateName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";

  const { data: appRecord, isLoading } = useQuery<any>({
    queryKey: [`/api/candidates/${candidateId}/application`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/candidates/${candidateId}/application`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open,
  });

  const [ssnRevealed, setSsnRevealed] = useState(false);
  const [fullSsn, setFullSsn] = useState<string | null>(null);
  const [ssnLoading, setSsnLoading] = useState(false);

  const handleRevealSsn = async () => {
    if (fullSsn) { setSsnRevealed(true); return; }
    setSsnLoading(true);
    try {
      const res = await apiRequest("GET", `/api/candidates/${candidateId}/application/ssn`);
      if (res.ok) { const body = await res.json(); setFullSsn(body.ssn); setSsnRevealed(true); }
    } finally { setSsnLoading(false); }
  };

  const d: Record<string, string> = appRecord?.data || {};

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="bg-green-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm mb-3">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 px-1">{children}</div>
    </div>
  );

  const Field = ({ label, value, full }: { label: string; value?: string; full?: boolean }) =>
    value ? (
      <div className={full ? "col-span-2" : ""}>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-green-700" />
            Employment Application — {candidateName}
          </DialogTitle>
          {appRecord?.submittedAt && (
            <DialogDescription>
              Submitted {new Date(appRecord.submittedAt).toLocaleDateString()} · Position: {appRecord.position || "Not specified"}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading application...
          </div>
        ) : !appRecord ? (
          <div className="py-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No online application was submitted for this candidate.</p>
            <p className="text-xs text-muted-foreground mt-1">This candidate may have been added manually.</p>
          </div>
        ) : (
          <div className="pt-3 text-sm font-sans">

            <Section title="Personal Information">
              <Field label="First Name" value={d.firstName} />
              <Field label="Last Name" value={d.lastName} />
              {d.mi && <Field label="Middle Initial" value={d.mi} />}
              <Field label="Phone" value={d.phone} />
              <Field label="Email" value={d.email} />
              <Field label="Street Address" value={d.streetAddress} full />
              <Field label="City" value={d.city} />
              <Field label="State" value={d.state} />
              <Field label="ZIP" value={d.zip} />
              {d.ssnLast4 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">SSN</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground font-mono tracking-wider">
                      {ssnRevealed && fullSsn ? fullSsn : `***-**-${d.ssnLast4}`}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={ssnRevealed ? () => setSsnRevealed(false) : handleRevealSsn}
                        disabled={ssnLoading}
                        className="text-xs font-semibold text-green-700 hover:text-green-900 underline underline-offset-2 disabled:opacity-50"
                        data-testid="button-toggle-ssn"
                      >
                        {ssnLoading ? "Loading…" : ssnRevealed ? "Hide" : "Reveal"}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <Field label="Position Applied For" value={d.positionAppliedFor} />
              <Field label="Date Available" value={d.dateAvailable} />
              {d.desiredSalary && <Field label="Desired Salary" value={`$${d.desiredSalary}/hr`} />}
            </Section>

            <Section title="Eligibility">
              <Field label="US Citizen or Authorized to Work" value={d.usCitizen} />
              <Field label="Worked Here Before" value={d.workedHereBefore} />
              <Field label="Ever Convicted of a Felony" value={d.convictedFelony} />
              {d.felonyExplanation && <Field label="Felony Explanation" value={d.felonyExplanation} full />}
            </Section>

            {(d.highSchoolName || d.collegeName) && (
              <Section title="Education">
                {d.highSchoolName && <>
                  <Field label="High School" value={d.highSchoolName} />
                  <Field label="Location" value={d.highSchoolAddress} />
                  <Field label="Years Attended" value={[d.highSchoolFrom, d.highSchoolTo].filter(Boolean).join(" – ")} />
                  <Field label="Graduated" value={d.highSchoolGraduated} />
                  {d.highSchoolDegree && <Field label="Degree / Diploma" value={d.highSchoolDegree} />}
                </>}
                {d.collegeName && <>
                  <div className="col-span-2 border-t pt-2 mt-1" />
                  <Field label="College / Trade School" value={d.collegeName} />
                  <Field label="Location" value={d.collegeAddress} />
                  <Field label="Years Attended" value={[d.collegeFrom, d.collegeTo].filter(Boolean).join(" – ")} />
                  <Field label="Graduated" value={d.collegeGraduated} />
                  {d.collegeDegree && <Field label="Degree" value={d.collegeDegree} />}
                </>}
              </Section>
            )}

            {(d.emp1Company || d.emp2Company || d.emp3Company) && (
              <Section title="Employment History">
                {[1, 2, 3].map(n => {
                  const company = d[`emp${n}Company`];
                  if (!company) return null;
                  return (
                    <React.Fragment key={n}>
                      {n > 1 && <div className="col-span-2 border-t pt-2 mt-1" />}
                      <Field label="Company" value={company} />
                      <Field label="Position" value={d[`emp${n}Position`]} />
                      <Field label="Address" value={d[`emp${n}Address`]} />
                      <Field label="Phone" value={d[`emp${n}Phone`]} />
                      <Field label="Supervisor" value={d[`emp${n}Supervisor`]} />
                      <Field label="Dates" value={[d[`emp${n}From`], d[`emp${n}To`]].filter(Boolean).join(" – ")} />
                      <Field label="Reason for Leaving" value={d[`emp${n}Reason`]} full />
                    </React.Fragment>
                  );
                })}
              </Section>
            )}

            {(d.ref1FullName || d.ref2FullName || d.ref3FullName) && (
              <Section title="References">
                {[1, 2, 3].map(n => {
                  const name = d[`ref${n}FullName`];
                  if (!name) return null;
                  return (
                    <React.Fragment key={n}>
                      {n > 1 && <div className="col-span-2 border-t pt-2 mt-1" />}
                      <Field label="Name" value={name} />
                      <Field label="Phone" value={d[`ref${n}Phone`]} />
                      <Field label="Company / Relation" value={d[`ref${n}Company`]} />
                      <Field label="Address" value={d[`ref${n}Address`]} />
                    </React.Fragment>
                  );
                })}
              </Section>
            )}

            {d.signatureName && (
              <Section title="Signature">
                <Field label="Signed By" value={d.signatureName} />
                <Field label="Date Signed" value={d.signatureDate} />
              </Section>
            )}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileTab({ candidate, onUpdate }: { candidate: Candidate; onUpdate: (data: any) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "Admin" || user?.role === "Master Admin" || user?.role === "Manager";
  const [editing, setEditing] = useState(false);
  const [viewAppOpen, setViewAppOpen] = useState(false);

  const { data: applicationRecord } = useQuery<any | null>({
    queryKey: [`/api/candidates/${candidate.id}/application`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/candidates/${candidate.id}/application`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const hasApplication = !!applicationRecord;

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
    grade: (candidate as any).grade || "",
    candidateStatus: (candidate as any).candidateStatus || "Active",
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t("employees.contactInfo")}</h3>
        <div className="flex gap-2">
          {hasApplication && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewAppOpen(true)}
              data-testid="button-view-application"
              className="flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
            >
              <FileText className="h-3.5 w-3.5" />
              View Application
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            if (editing) {
              onUpdate(form);
              setEditing(false);
            } else {
              setEditing(true);
            }
          }} data-testid="button-edit-profile">
            {editing ? t("common.save") : t("common.edit")}
          </Button>
        </div>
      </div>

      <ApplicationViewDialog
        candidateId={candidate.id}
        candidateName={candidate.name}
        open={viewAppOpen}
        onClose={() => setViewAppOpen(false)}
      />

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("common.name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{t("employees.position")}</Label><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></div>
            <div><Label>{t("common.email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>{t("common.phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div>
            <Label>Rating</Label>
            <div className="flex gap-2 mt-1">
              {(["green", "yellow", "red"] as const).map(r => (
                <Button
                  key={r}
                  type="button"
                  variant={form.rating === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, rating: r })}
                  data-testid={`button-edit-rating-${r}`}
                >
                  <div className={`h-3 w-3 rounded-full mr-1 ${getRatingColor(r)}`} />
                  {r === "green" ? "Strong" : r === "yellow" ? "Maybe" : "Weak"}
                </Button>
              ))}
            </div>
          </div>
          <div><Label>{t("common.address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>{t("common.city")}</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>{t("common.state")}</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
            <div><Label>{t("common.zip")}</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
          </div>
          <div>
            <Label>{t("hiring.stage")}</Label>
            <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
              <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isAdminOrManager && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Grade</Label>
                <Select value={form.grade || "_none"} onValueChange={v => setForm({ ...form, grade: v === "_none" ? "" : v })}>
                  <SelectTrigger data-testid="select-grade"><SelectValue placeholder="— None —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Candidate Status</Label>
                <Select value={form.candidateStatus} onValueChange={v => setForm({ ...form, candidateStatus: v })}>
                  <SelectTrigger data-testid="select-candidate-status"><SelectValue placeholder="Active" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                    <SelectItem value="Blacklist">Blacklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {candidate.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{candidate.email}</div>}
          {candidate.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{candidate.phone}</div>}
          {candidate.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{[candidate.address, candidate.city, candidate.state, candidate.zip].filter(Boolean).join(", ")}</div>}
          {(candidate as any).source && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />Source: {(candidate as any).source}</div>}
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />Applied: {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : "N/A"}</div>
          {isAdminOrManager && (candidate as any).grade && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Grade:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                (candidate as any).grade === "A" ? "bg-green-100 text-green-800" :
                (candidate as any).grade === "B" ? "bg-yellow-100 text-yellow-800" :
                "bg-orange-100 text-orange-800"
              }`}>{(candidate as any).grade}</span>
            </div>
          )}
          {isAdminOrManager && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                (candidate as any).candidateStatus === "Blacklist" ? "bg-red-100 text-red-800" :
                (candidate as any).candidateStatus === "Terminated" ? "bg-gray-100 text-gray-700" :
                "bg-green-100 text-green-800"
              }`}>{(candidate as any).candidateStatus || "Active"}</span>
            </div>
          )}
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
  const buildForm = (c: Candidate) => ({
    interviewDate: c.interviewDate ? new Date(c.interviewDate).toISOString().split("T")[0] : "",
    interviewTime: c.interviewTime || "",
    interviewLocation: c.interviewLocation || "",
    interviewType: c.interviewType || "in-person",
    interviewerName: c.interviewerName || "",
    interviewNotes: c.interviewNotes || "",
    interviewRecommendation: c.interviewRecommendation || "",
  });
  const [form, setForm] = useState(() => buildForm(candidate));

  useEffect(() => {
    if (!editing) {
      setForm(buildForm(candidate));
    }
  }, [candidate.id, candidate.interviewDate, candidate.interviewTime, candidate.interviewLocation,
      candidate.interviewType, candidate.interviewerName, candidate.interviewNotes,
      candidate.interviewRecommendation, editing]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.interviewDate} onChange={e => setForm({ ...form, interviewDate: e.target.value })} data-testid="input-interview-date" /></div>
            <div><Label>Time</Label><Input value={form.interviewTime} onChange={e => setForm({ ...form, interviewTime: e.target.value })} placeholder="e.g. 2:00 PM" data-testid="input-interview-time" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
  const { data: employee } = useQuery({
    queryKey: [`/api/candidates/${candidateId}/employee`],
    queryFn: async () => {
      const employees = await (await apiRequest("GET", "/api/employees")).json();
      return employees.find((e: any) => e.candidateId === candidateId);
    },
  });

  if (!employee) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No employee record found. The candidate must be moved to Hired first.
      </div>
    );
  }

  return <OnboardingChecklist employeeId={employee.id} showCard={false} />;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>First Name *</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} data-testid="input-emp-first-name" /></div>
        <div><Label>Last Name *</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} data-testid="input-emp-last-name" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Email</Label><Input value={form.personalEmail} onChange={e => setForm({ ...form, personalEmail: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.personalPhone} onChange={e => setForm({ ...form, personalPhone: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Job Title</Label><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} /></div>
        <div><Label>Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              <div><Label>Preferred Name</Label><Input value={form.preferredName} onChange={e => setForm({ ...form, preferredName: e.target.value })} /></div>
              <div><Label>Pronouns</Label><Input value={form.pronouns} onChange={e => setForm({ ...form, pronouns: e.target.value })} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.personalEmail} onChange={e => setForm({ ...form, personalEmail: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.personalPhone} onChange={e => setForm({ ...form, personalPhone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div><Label>Zip</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
            </div>
            <h4 className="font-semibold text-sm mt-4">Emergency Contact</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Name</Label><Input value={form.emergencyContactName} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} /></div>
              <div><Label>Relationship</Label><Input value={form.emergencyContactRelationship} onChange={e => setForm({ ...form, emergencyContactRelationship: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.emergencyContactPhone} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} /></div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm">
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
  return <OnboardingChecklist employeeId={employeeId} showCard={true} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiring Analytics Tab
// ─────────────────────────────────────────────────────────────────────────────
const ANALYTICS_STAGE_COLORS: Record<string, string> = {
  "Application Received": "bg-blue-500",
  "Review & Rate":        "bg-gray-400",
  "Phone Screen":         "bg-purple-400",
  "Interview Scheduled":  "bg-cyan-500",
  "1st Interview":        "bg-amber-400",
  "2nd Interview":        "bg-orange-400",
  "Offer Extended":       "bg-emerald-400",
  "Hired":                "bg-green-600",
  "Declined / Not a Fit": "bg-gray-300",
};
const ANALYTICS_RATING_META: Record<string, { label: string; cls: string }> = {
  green:   { label: "Strong",  cls: "bg-green-500" },
  yellow:  { label: "Maybe",   cls: "bg-yellow-400" },
  red:     { label: "Weak",    cls: "bg-red-500" },
  unrated: { label: "Unrated", cls: "bg-gray-300" },
};

function HiringAnalytics() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hiring/analytics"],
    queryFn: () => fetch("/api/hiring/analytics", { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const { summary = {}, byStage = [], bySource = [], byRating = [], byRole = [], recentHires = [] } = data ?? {};
  const maxStageCount = Math.max(...byStage.map((r: any) => r.count), 1);

  return (
    <div className="space-y-5 py-1">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Candidates",  value: summary.total ?? 0, icon: Users,      cls: "text-blue-500" },
          { label: "Active in Pipeline", value: summary.active ?? 0, icon: TrendingUp, cls: "text-amber-500" },
          { label: "Hired",             value: summary.hired ?? 0, icon: UserCheck,   cls: "text-green-600" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${cls}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pipeline funnel */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4" /> Pipeline Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {byStage.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              : byStage.map((r: any) => (
                <div key={r.stage}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">{r.stage}</span>
                    <span className="text-xs font-semibold ml-2">{r.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ANALYTICS_STAGE_COLORS[r.stage] ?? "bg-primary"}`}
                      style={{ width: `${(r.count / maxStageCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Source + Rating side by side */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">By Source</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {bySource.length === 0
                ? <p className="text-sm text-muted-foreground">No source data</p>
                : <div className="flex flex-wrap gap-2">
                    {bySource.map((r: any) => (
                      <div key={r.source} className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1">
                        <span className="text-xs font-medium">{r.source}</span>
                        <span className="text-xs text-muted-foreground">({r.count})</span>
                      </div>
                    ))}
                  </div>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex gap-3 flex-wrap">
                {byRating.map((r: any) => {
                  const meta = ANALYTICS_RATING_META[r.rating] ?? { label: r.rating, cls: "bg-muted" };
                  return (
                    <div key={r.rating} className="flex items-center gap-1.5">
                      <div className={`h-3 w-3 rounded-full ${meta.cls}`} />
                      <span className="text-sm">{meta.label}</span>
                      <span className="text-sm font-semibold">{r.count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Roles */}
      {byRole.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold">Applicants by Role</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-2">
              {byRole.map((r: any) => (
                <div key={r.role} className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                  <span className="text-xs font-medium">{r.role}</span>
                  <span className="text-xs text-muted-foreground ml-1">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent hires */}
      {recentHires.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-green-600" /> Recent Hires
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentHires.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-7 w-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {c.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.role ?? "—"}{c.source ? ` · via ${c.source}` : ""}</p>
                  </div>
                  {c.applied_date && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.applied_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
