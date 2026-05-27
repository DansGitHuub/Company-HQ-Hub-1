import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Home, Briefcase, FileText, BookOpen, MessageSquare, Bell,
  ChevronRight, Download, Bookmark, BookmarkCheck, Search,
  Send, Clock, MapPin, Calendar, CheckCircle2, AlertCircle,
  Leaf, Sun, Snowflake, CloudRain, ArrowLeft, Eye, Star,
  Lightbulb
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const CARE_CATEGORIES = [
  "Hardscape & Patios", "Plants & Landscape Beds", "Lawn Care",
  "Irrigation Systems", "Outdoor Living Features", "Seasonal Guides",
  "Troubleshooting", "Snow & Winter"
];

const MESSAGE_TOPICS = [
  "Question about my job", "Document request", "Scheduling",
  "Billing question", "Maintenance request", "Other"
];

const DOCUMENT_FOLDERS = [
  "Proposals", "Contracts", "Invoices", "Warranties",
  "Care Guides", "Photos", "Other"
];

const brandColors = {
  darkGreen: "#1E3A2F",
  gold: "#C9A84C",
  cream: "#F7F3EC",
};

type Section = "dashboard" | "jobs" | "documents" | "care-library" | "messages";

export default function CustomerHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/customer-hub/:section?");
  const section = (params?.section || "dashboard") as Section;
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const setSection = (s: Section, preserveSelection?: boolean) => {
    navigate(`/customer-hub/${s === "dashboard" ? "" : s}`);
    if (!preserveSelection) {
      setSelectedJobId(null);
      setSelectedGuideId(null);
      setSelectedThreadId(null);
    }
  };

  const navItems: { id: Section; label: string; icon: typeof Home }[] = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "jobs", label: "My Jobs", icon: Briefcase },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "care-library", label: "Care Library", icon: BookOpen },
    { id: "messages", label: "Messages", icon: MessageSquare },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: brandColors.cream }} data-testid="customer-hub">
      <header
        className="px-4 py-3 flex items-center justify-between md:px-6"
        style={{ backgroundColor: brandColors.darkGreen }}
      >
        <div className="flex items-center gap-3">
          <Leaf className="h-6 w-6" style={{ color: brandColors.gold }} />
          <h1 className="text-lg font-bold" style={{ color: brandColors.gold }}>
            {t("nav.companyHQ")}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <SuggestButton />
          <NotificationBell />
          <span className="text-sm hidden md:block" style={{ color: brandColors.cream }}>
            {user?.name}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <nav className="hidden md:flex flex-col w-56 border-r bg-white p-4 gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                style={active ? { backgroundColor: brandColors.darkGreen + "10", color: brandColors.darkGreen } : {}}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {section === "dashboard" && <DashboardSection onNavigate={setSection} onSelectJob={id => { setSelectedJobId(id); setSection("jobs", true); }} />}
          {section === "jobs" && (
            selectedJobId
              ? <JobDetail jobId={selectedJobId} onBack={() => setSelectedJobId(null)} />
              : <MyJobsSection onSelectJob={setSelectedJobId} />
          )}
          {section === "documents" && <DocumentsSection />}
          {section === "care-library" && (
            selectedGuideId
              ? <GuideDetail guideId={selectedGuideId} onBack={() => setSelectedGuideId(null)} />
              : <CareLibrarySection onSelectGuide={setSelectedGuideId} />
          )}
          {section === "messages" && (
            selectedThreadId
              ? <ThreadDetail threadId={selectedThreadId} onBack={() => setSelectedThreadId(null)} />
              : <MessagesSection onSelectThread={setSelectedThreadId} />
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white flex justify-around py-2 px-1 z-50"
        style={{ boxShadow: "0 -2px 10px rgba(0,0,0,0.1)" }}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded text-xs transition-colors ${
                active ? "font-semibold" : "text-gray-400"
              }`}
              style={active ? { color: brandColors.darkGreen } : {}}
              data-testid={`mobile-nav-${item.id}`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["/api/customer-hub/notifications/unread-count"],
    queryFn: async () => (await apiRequest("GET", "/api/customer-hub/notifications/unread-count")).json(),
    refetchInterval: 30000,
  });
  const count = data?.count || 0;

  return (
    <div className="relative" data-testid="notification-bell">
      <Bell className="h-5 w-5" style={{ color: brandColors.cream }} />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-white text-xs flex items-center justify-center"
          style={{ backgroundColor: brandColors.gold }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function SuggestButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/suggestions", { title, description });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thanks! We'll review your idea and keep you posted." });
      setOpen(false);
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions/mine"] });
    },
    onError: () => {
      toast({ title: "Failed to submit suggestion", variant: "destructive" });
    },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:opacity-80"
        style={{ backgroundColor: brandColors.gold + "30" }}
        data-testid="button-suggest"
        title="Suggest an improvement"
      >
        <Lightbulb className="h-4 w-4" style={{ color: brandColors.gold }} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" style={{ color: brandColors.gold }} />
              {t("customerHub.suggestTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("customerHub.suggestSubtitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("customerHub.suggestIdeaLabel")} *</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 200))}
                placeholder={t("customerHub.suggestPlaceholder")}
                data-testid="input-suggestion-title"
              />
              <p className="text-xs text-muted-foreground mt-1">{title.length}/200</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("customerHub.suggestMoreLabel")}</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 1000))}
                placeholder={t("customerHub.suggestMorePlaceholder")}
                rows={4}
                data-testid="input-suggestion-description"
              />
              <p className="text-xs text-muted-foreground mt-1">{description.length}/1000</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-suggestion-cancel">{t("common.cancel")}</Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!title.trim() || submitMutation.isPending}
              style={{ backgroundColor: brandColors.darkGreen }}
              data-testid="button-suggestion-submit"
            >
              {submitMutation.isPending ? t("common.submitting") : t("common.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const SUGGESTION_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  received: { label: "Received", color: "#6b7280", bg: "#f3f4f6" },
  reviewing: { label: "Reviewing", color: "#2563eb", bg: "#dbeafe" },
  planned: { label: "Planned", color: "#7c3aed", bg: "#ede9fe" },
  completed: { label: "Completed", color: "#16a34a", bg: "#dcfce7" },
  not_planned: { label: "Not Planned", color: "#dc2626", bg: "#fee2e2" },
};

function MySuggestionsSection() {
  const { t } = useTranslation();
  const { data: suggestions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/suggestions/mine"],
    queryFn: async () => (await apiRequest("GET", "/api/suggestions/mine")).json(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = suggestions.find(s => s.id === selectedId);

  if (isLoading) return null;
  if (suggestions.length === 0) return null;

  return (
    <Card data-testid="my-suggestions-section">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColors.gold + "20" }}>
            <Lightbulb className="h-4 w-4" style={{ color: brandColors.gold }} />
          </div>
          <h3 className="font-semibold text-sm">{t("customerHub.mySuggestions")}</h3>
        </div>
        <div className="space-y-2">
          {suggestions.slice(0, 5).map((s: any) => {
            const cfg = SUGGESTION_STATUS_CONFIG[s.status] || SUGGESTION_STATUS_CONFIG.received;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="flex items-center justify-between w-full p-2.5 rounded-lg hover:bg-gray-50 text-sm transition-colors text-left"
                data-testid={`suggestion-item-${s.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: brandColors.darkGreen }}>{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="ml-2 text-xs shrink-0"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </Badge>
              </button>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" style={{ color: brandColors.gold }} />
              {t("customerHub.suggestionDetails")}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div>
                <p className="font-semibold" style={{ color: brandColors.darkGreen }}>{selected.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {t("customerHub.submittedOn")} {new Date(selected.createdAt).toLocaleDateString()}
                </p>
              </div>
              {selected.description && (
                <p className="text-sm text-gray-600">{selected.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t("common.status")}:</span>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: (SUGGESTION_STATUS_CONFIG[selected.status] || SUGGESTION_STATUS_CONFIG.received).bg,
                    color: (SUGGESTION_STATUS_CONFIG[selected.status] || SUGGESTION_STATUS_CONFIG.received).color
                  }}
                >
                  {(SUGGESTION_STATUS_CONFIG[selected.status] || SUGGESTION_STATUS_CONFIG.received).label}
                </Badge>
              </div>
              {selected.adminNote && (
                <div className="bg-gray-50 border rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("customerHub.teamNote")}</p>
                  <p className="text-sm text-gray-700">{selected.adminNote}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DashboardSection({ onNavigate, onSelectJob }: { onNavigate: (s: Section) => void; onSelectJob: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["/api/customer-hub/dashboard"],
    queryFn: async () => (await apiRequest("GET", "/api/customer-hub/dashboard")).json(),
  });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl mx-auto" data-testid="dashboard-section">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: brandColors.darkGreen }} data-testid="text-welcome">
          {t("customerHub.welcome")}, {dashboard?.user?.name?.split(" ")[0] || "there"}
        </h2>
        <p className="text-gray-500 mt-1">{t("customerHub.welcomeSubtitle")}</p>
      </div>

      {dashboard?.activeJob && (
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
          style={{ borderLeftColor: brandColors.gold }}
          onClick={() => onSelectJob(dashboard.activeJob.id)}
          data-testid="card-active-job"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: brandColors.gold }}>{t("customerHub.activeProject")}</p>
                <h3 className="font-semibold text-lg mt-1" style={{ color: brandColors.darkGreen }}>{dashboard.activeJob.type}</h3>
                <p className="text-sm text-gray-500">{dashboard.activeJob.client}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-xs">{dashboard.activeJob.stage}</Badge>
                {dashboard.activeJob.scheduledDate && (
                  <p className="text-xs text-gray-400 mt-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(dashboard.activeJob.scheduledDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStat label={t("customerHub.totalJobs")} value={dashboard?.totalJobs || 0} icon={Briefcase} onClick={() => onNavigate("jobs")} />
        <QuickStat label={t("customerHub.unreadMessages")} value={dashboard?.unreadMessages || 0} icon={MessageSquare} onClick={() => onNavigate("messages")} highlight={dashboard?.unreadMessages > 0} />
        <QuickStat label={t("customerHub.actionItems")} value={dashboard?.actionItems || 0} icon={AlertCircle} onClick={() => onNavigate("documents")} highlight={dashboard?.actionItems > 0} />
        <QuickStat label={t("customerHub.documents")} value={dashboard?.recentDocuments?.length || 0} icon={FileText} onClick={() => onNavigate("documents")} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColors.darkGreen + "15" }}>
                <Briefcase className="h-4 w-4" style={{ color: brandColors.darkGreen }} />
              </div>
              <h3 className="font-semibold text-sm">{t("customerHub.quickLinks")}</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: t("customerHub.myDocuments"), section: "documents" as Section },
                { label: t("customerHub.careLibrary"), section: "care-library" as Section },
                { label: t("customerHub.serviceHistory"), section: "jobs" as Section },
                { label: t("customerHub.sendMessage"), section: "messages" as Section },
              ].map(link => (
                <button
                  key={link.label}
                  onClick={() => onNavigate(link.section)}
                  className="flex items-center justify-between w-full p-2 rounded hover:bg-gray-50 text-sm transition-colors"
                >
                  {link.label}
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {dashboard?.seasonalTip && (
          <Card style={{ backgroundColor: brandColors.darkGreen + "08" }} data-testid="card-seasonal-tip">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColors.gold + "20" }}>
                  <SeasonIcon />
                </div>
                <h3 className="font-semibold text-sm" style={{ color: brandColors.darkGreen }}>{dashboard.seasonalTip.title}</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{dashboard.seasonalTip.tip}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <MySuggestionsSection />
    </div>
  );
}

function SeasonIcon() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return <Leaf className="h-4 w-4" style={{ color: brandColors.gold }} />;
  if (month >= 5 && month <= 7) return <Sun className="h-4 w-4" style={{ color: brandColors.gold }} />;
  if (month >= 8 && month <= 10) return <CloudRain className="h-4 w-4" style={{ color: brandColors.gold }} />;
  return <Snowflake className="h-4 w-4" style={{ color: brandColors.gold }} />;
}

function QuickStat({ label, value, icon: Icon, onClick, highlight }: { label: string; value: number; icon: typeof Home; onClick: () => void; highlight?: boolean }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-3 text-center">
        <Icon className={`h-5 w-5 mx-auto mb-1 ${highlight ? "text-amber-500" : "text-gray-400"}`} />
        <p className="text-2xl font-bold" style={{ color: brandColors.darkGreen }}>{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="h-24 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-200 rounded" />)}
      </div>
    </div>
  );
}

function MyJobsSection({ onSelectJob }: { onSelectJob: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/customer-hub/jobs"],
    queryFn: async () => (await apiRequest("GET", "/api/customer-hub/jobs")).json(),
  });

  const activeJobs = jobs.filter((j: any) => j.stage !== "Completed" && j.stage !== "Cancelled");
  const completedJobs = jobs.filter((j: any) => j.stage === "Completed");

  if (isLoading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded" />)}</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto" data-testid="jobs-section">
      <h2 className="text-xl font-bold" style={{ color: brandColors.darkGreen }}>My Jobs</h2>

      {jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title="No jobs yet" description="Your project details will appear here once your job is created." />
      ) : (
        <>
          {activeJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Active Projects</h3>
              {activeJobs.map((job: any) => <JobCard key={job.id} job={job} onClick={() => onSelectJob(job.id)} />)}
            </div>
          )}

          {completedJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Service History</h3>
              {completedJobs.map((job: any) => <JobCard key={job.id} job={job} onClick={() => onSelectJob(job.id)} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JobCard({ job, onClick }: { job: any; onClick: () => void }) {
  const stageColors: Record<string, string> = {
    Lead: "bg-blue-100 text-blue-700",
    Estimate: "bg-purple-100 text-purple-700",
    Scheduled: "bg-amber-100 text-amber-700",
    "In Progress": "bg-emerald-100 text-emerald-700",
    Completed: "bg-green-100 text-green-700",
    Cancelled: "bg-red-100 text-red-700",
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick} data-testid={`card-job-${job.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold" style={{ color: brandColors.darkGreen }}>{job.type}</h3>
            <p className="text-sm text-gray-500">{job.client}</p>
            {job.crewLeadName && (
              <p className="text-xs text-gray-400 mt-1">Crew Lead: {job.crewLeadName}</p>
            )}
          </div>
          <div className="text-right">
            <Badge className={stageColors[job.stage] || "bg-gray-100 text-gray-700"}>
              {job.stage}
            </Badge>
            {job.scheduledDate && (
              <p className="text-xs text-gray-400 mt-1">
                {new Date(job.scheduledDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const { data: job, isLoading } = useQuery({
    queryKey: [`/api/customer-hub/jobs/${jobId}`],
    queryFn: async () => (await apiRequest("GET", `/api/customer-hub/jobs/${jobId}`)).json(),
  });

  if (isLoading) return <div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48 mb-4" /><div className="h-64 bg-gray-200 rounded" /></div>;
  if (!job) return <p>Job not found</p>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto" data-testid="job-detail">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to My Jobs
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: brandColors.darkGreen }}>{job.type}</h2>
          <p className="text-gray-500">{job.client}</p>
        </div>
        <Badge variant="outline">{job.stage}</Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        {job.scheduledDate && (
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" /> Scheduled: {new Date(job.scheduledDate).toLocaleDateString()}
          </div>
        )}
        {job.address && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4" /> {[job.address, job.city, job.state].filter(Boolean).join(", ")}
          </div>
        )}
        {job.crewLeadName && (
          <div className="flex items-center gap-2 text-gray-600">
            <Star className="h-4 w-4" /> Crew Lead: {job.crewLeadName}
          </div>
        )}
      </div>

      {job.scopeOfWork && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Scope of Work</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600 whitespace-pre-wrap">{job.scopeOfWork}</p></CardContent>
        </Card>
      )}

      {job.materialsUsed && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Materials Used</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600 whitespace-pre-wrap">{job.materialsUsed}</p></CardContent>
        </Card>
      )}


      {(job.documents?.length > 0 || job.customerDocuments?.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...(job.documents || []), ...(job.customerDocuments || [])].map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{doc.name}</span>
                </div>
                {doc.url && (
                  <Button size="sm" variant="ghost" onClick={() => window.open(doc.url, "_blank")}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocumentsSection() {
  const { t } = useTranslation();
  const [activeFolder, setActiveFolder] = useState("All");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["/api/customer-hub/documents"],
    queryFn: async () => (await apiRequest("GET", "/api/customer-hub/documents")).json(),
  });

  const requestMutation = useMutation({
    mutationFn: async (data: { documentType: string; message: string }) => {
      const res = await apiRequest("POST", "/api/customer-hub/documents/request", data);
      return res.json();
    },
    onSuccess: () => {
      setShowRequestDialog(false);
      toast({ title: "Request sent", description: "We'll get back to you shortly." });
    },
  });

  const filtered = activeFolder === "All" ? docs : docs.filter((d: any) => d.folder === activeFolder);
  const folderCounts = DOCUMENT_FOLDERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = docs.filter((d: any) => d.folder === f).length;
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-3xl mx-auto" data-testid="documents-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: brandColors.darkGreen }}>Documents</h2>
        <Button variant="outline" size="sm" onClick={() => setShowRequestDialog(true)} data-testid="button-request-doc">
          <FileText className="h-4 w-4 mr-1" /> Request a Document
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          size="sm"
          variant={activeFolder === "All" ? "default" : "outline"}
          onClick={() => setActiveFolder("All")}
          style={activeFolder === "All" ? { backgroundColor: brandColors.darkGreen } : {}}
        >
          All ({docs.length})
        </Button>
        {DOCUMENT_FOLDERS.map(f => (
          <Button
            key={f}
            size="sm"
            variant={activeFolder === f ? "default" : "outline"}
            onClick={() => setActiveFolder(f)}
            style={activeFolder === f ? { backgroundColor: brandColors.darkGreen } : {}}
          >
            {f} ({folderCounts[f] || 0})
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Documents will appear here when your team uploads them." />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc: any) => (
            <Card key={doc.id} data-testid={`doc-${doc.id}`}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColors.darkGreen + "10" }}>
                    <FileText className="h-5 w-5" style={{ color: brandColors.darkGreen }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline" className="text-xs">{doc.folder}</Badge>
                      <span className="text-xs text-gray-400">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {doc.url && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => window.open(doc.url, "_blank")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => window.open(doc.url, "_blank")}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RequestDocumentDialog
        open={showRequestDialog}
        onClose={() => setShowRequestDialog(false)}
        onSubmit={(data) => requestMutation.mutate(data)}
        isPending={requestMutation.isPending}
      />
    </div>
  );
}

function RequestDocumentDialog({ open, onClose, onSubmit, isPending }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: { documentType: string; message: string }) => void; isPending: boolean;
}) {
  const [docType, setDocType] = useState("");
  const [message, setMessage] = useState("");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a Document</DialogTitle>
          <DialogDescription>Let us know what document you need and we'll get it to you.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger data-testid="select-doc-type"><SelectValue placeholder="Document type..." /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_FOLDERS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe what you need..." rows={3} data-testid="input-doc-request-message" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSubmit({ documentType: docType, message })}
            disabled={!message.trim() || isPending}
            style={{ backgroundColor: brandColors.darkGreen }}
            data-testid="button-submit-doc-request"
          >
            {isPending ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlantCardMini({ card, onClick }: { card: any; onClick: () => void }) {
  const photo = card.photos?.[0] ?? null;
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      data-testid={`card-plant-${card.id}`}
    >
      <CardContent className="p-0 overflow-hidden">
        {photo && (
          <img src={photo} alt={card.common_name} className="w-full h-32 object-cover" />
        )}
        <div className="p-3">
          <div className="flex flex-wrap gap-1 mb-1.5">
            {card.plant_type && (
              <Badge className="text-xs bg-green-100 text-green-700 border-green-200">{card.plant_type}</Badge>
            )}
            {card.light_requirement && (
              <Badge variant="outline" className="text-xs">{card.light_requirement}</Badge>
            )}
          </div>
          <h3 className="font-semibold text-sm" style={{ color: brandColors.darkGreen }}>{card.common_name}</h3>
          {card.botanical_name && (
            <p className="text-xs text-muted-foreground italic mt-0.5">{card.botanical_name}</p>
          )}
          {card.mature_size && (
            <p className="text-xs text-gray-500 mt-1">🌳 {card.mature_size}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlantCardDetail_Hub({ card, onBack }: { card: any; onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto space-y-4" data-testid="plant-card-hub-detail">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Care Library
      </button>

      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-xl px-6 py-5">
        <h2 className="text-2xl font-bold">{card.common_name}</h2>
        {card.botanical_name && <p className="italic text-green-200 mt-0.5">{card.botanical_name}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          {card.plant_type && <Badge className="bg-white/20 text-white border-white/30">{card.plant_type}</Badge>}
          {card.deciduous_evergreen && <Badge className="bg-white/20 text-white border-white/30">{card.deciduous_evergreen}</Badge>}
          {card.flowering && <Badge className="bg-white/20 text-white border-white/30">🌸 Flowering</Badge>}
          {card.deer_resistant && <Badge className="bg-white/20 text-white border-white/30">🦌 Deer Resistant</Badge>}
        </div>
      </div>

      {/* Quick facts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Mature Size", val: card.mature_size },
          { label: "Hardiness Zone", val: card.hardiness_zone },
          { label: "Light", val: card.light_requirement },
          { label: "Water Needs", val: card.water_needs },
          { label: "Soil", val: card.soil_moisture },
          { label: "Growth Rate", val: card.growth_rate },
          { label: "Pruning", val: card.pruning_time },
          { label: "Flower Season", val: card.flowering && card.flower_season ? `${card.flower_season}${card.flower_color ? ` · ${card.flower_color}` : ""}` : null },
        ].filter(f => f.val).map(({ label, val }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</div>
            <div className="text-sm font-medium">{val}</div>
          </div>
        ))}
      </div>

      {card.special_notes && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-800 mb-1 flex items-center gap-1.5"><Leaf className="w-4 h-4" /> About This Plant</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{card.special_notes}</p>
        </div>
      )}

      {card.maintenance_notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-800 mb-1">✂️ Maintenance Tips</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{card.maintenance_notes}</p>
        </div>
      )}

      {card.known_pests_issues && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-800 mb-1">🐛 Known Pests & Issues</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{card.known_pests_issues}</p>
        </div>
      )}

      {/* Photos */}
      {card.photos?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Photos</h4>
          <div className="grid grid-cols-3 gap-2">
            {card.photos.map((url: string, i: number) => (
              <img key={i} src={url} alt={`${card.common_name} ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CareLibrarySection({ onSelectGuide }: { onSelectGuide: (id: string) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState<"all" | "saved" | "plants">("all");
  const [plantTypeFilter, setPlantTypeFilter] = useState("all");
  const [selectedPlant, setSelectedPlant] = useState<any | null>(null);

  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["/api/customer-hub/care-guides"],
    queryFn: async () => (await apiRequest("GET", "/api/customer-hub/care-guides")).json(),
  });

  const { data: plantCards = [], isLoading: plantsLoading } = useQuery({
    queryKey: ["/api/plant-cards"],
    queryFn: async () => (await apiRequest("GET", "/api/plant-cards")).json(),
  });

  const PLANT_TYPES_HUB = ["Tree", "Shrub", "Perennial", "Annual", "Groundcover", "Vine", "Grass", "Other"];

  const filtered = guides.filter((g: any) => {
    if (tab === "saved" && !g.isSaved) return false;
    if (category !== "all" && g.category !== category) return false;
    if (search && !g.title.toLowerCase().includes(search.toLowerCase()) && !g.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredPlants = (plantCards as any[]).filter((c: any) => {
    if (plantTypeFilter !== "all" && c.plant_type !== plantTypeFilter) return false;
    if (search && !c.common_name.toLowerCase().includes(search.toLowerCase()) && !(c.botanical_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Plant detail view
  if (selectedPlant) {
    return <PlantCardDetail_Hub card={selectedPlant} onBack={() => setSelectedPlant(null)} />;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto" data-testid="care-library-section">
      <h2 className="text-xl font-bold" style={{ color: brandColors.darkGreen }}>Care Library</h2>

      <Tabs value={tab} onValueChange={v => { setTab(v as any); setSearch(""); }}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-guides">All Guides</TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved-guides">My Guides</TabsTrigger>
          <TabsTrigger value="plants" data-testid="tab-plant-cards">
            <Leaf className="w-3.5 h-3.5 mr-1" />
            Plant Library
            {(plantCards as any[]).length > 0 && (
              <span className="ml-1.5 bg-green-100 text-green-700 text-xs rounded-full px-1.5 py-0.5 font-medium">
                {(plantCards as any[]).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + filter row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === "plants" ? "Search plants…" : "Search care guides..."}
            className="pl-9"
            data-testid="input-search-guides"
          />
        </div>
        {tab !== "plants" ? (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48" data-testid="select-guide-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CARE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Select value={plantTypeFilter} onValueChange={setPlantTypeFilter}>
            <SelectTrigger className="w-44" data-testid="select-plant-type-hub"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {PLANT_TYPES_HUB.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Guides tab */}
      {tab !== "plants" && (
        isLoading ? (
          <div className="grid md:grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={tab === "saved" ? "No saved guides" : "No guides found"}
            description={tab === "saved" ? "Bookmark guides to save them here for quick access." : "Try adjusting your search or category filter."}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {filtered.map((guide: any) => (
              <GuideCard key={guide.id} guide={guide} onClick={() => onSelectGuide(guide.id)} />
            ))}
          </div>
        )
      )}

      {/* Plant Cards tab */}
      {tab === "plants" && (
        plantsLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-gray-200 rounded-lg animate-pulse" />)}</div>
        ) : filteredPlants.length === 0 ? (
          <EmptyState
            icon={Leaf}
            title={(plantCards as any[]).length === 0 ? "No plant cards yet" : "No matches"}
            description={(plantCards as any[]).length === 0 ? "Plant care cards will appear here once they're added." : "Try adjusting your search or type filter."}
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredPlants.map((card: any) => (
              <PlantCardMini key={card.id} card={card} onClick={() => setSelectedPlant(card)} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function GuideCard({ guide, onClick }: { guide: any; onClick: () => void }) {
  const queryClient = useQueryClient();

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (guide.isSaved) {
        await apiRequest("DELETE", `/api/customer-hub/care-guides/${guide.id}/save`);
      } else {
        await apiRequest("POST", `/api/customer-hub/care-guides/${guide.id}/save`);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/customer-hub/care-guides"] }),
  });

  const categoryColors: Record<string, string> = {
    "Hardscape & Patios": "bg-orange-100 text-orange-700",
    "Plants & Landscape Beds": "bg-green-100 text-green-700",
    "Lawn Care": "bg-emerald-100 text-emerald-700",
    "Irrigation Systems": "bg-blue-100 text-blue-700",
    "Outdoor Living Features": "bg-purple-100 text-purple-700",
    "Seasonal Guides": "bg-amber-100 text-amber-700",
    "Troubleshooting": "bg-red-100 text-red-700",
    "Snow & Winter": "bg-cyan-100 text-cyan-700",
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`card-guide-${guide.id}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1" onClick={onClick}>
            <Badge className={`text-xs ${categoryColors[guide.category] || "bg-gray-100 text-gray-700"}`}>
              {guide.category}
            </Badge>
            <h3 className="font-semibold mt-2 text-sm" style={{ color: brandColors.darkGreen }}>{guide.title}</h3>
            {guide.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{guide.summary}</p>}
          </div>
          <button
            onClick={e => { e.stopPropagation(); toggleSave.mutate(); }}
            className="p-1 hover:bg-gray-100 rounded"
            data-testid={`button-save-guide-${guide.id}`}
          >
            {guide.isSaved ? (
              <BookmarkCheck className="h-5 w-5" style={{ color: brandColors.gold }} />
            ) : (
              <Bookmark className="h-5 w-5 text-gray-300" />
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function GuideDetail({ guideId, onBack }: { guideId: string; onBack: () => void }) {
  const { data: guide, isLoading } = useQuery({
    queryKey: [`/api/customer-hub/care-guides/${guideId}`],
    queryFn: async () => (await apiRequest("GET", `/api/customer-hub/care-guides/${guideId}`)).json(),
  });

  if (isLoading) return <div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-64 mb-4" /><div className="h-96 bg-gray-200 rounded" /></div>;
  if (!guide) return <p>Guide not found</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-4" data-testid="guide-detail">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Care Library
      </button>
      <Badge variant="outline">{guide.category}</Badge>
      <h2 className="text-xl font-bold" style={{ color: brandColors.darkGreen }}>{guide.title}</h2>
      {guide.pdfUrl && (
        <Button variant="outline" size="sm" onClick={() => window.open(guide.pdfUrl, "_blank")}>
          <Download className="h-4 w-4 mr-1" /> Download PDF
        </Button>
      )}
      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
        {guide.content}
      </div>
    </div>
  );
}

function MessagesSection({ onSelectThread }: { onSelectThread: (id: string) => void }) {
  const { t } = useTranslation();
  const [showNewMessage, setShowNewMessage] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["/api/customer-hub/messages"],
    queryFn: async () => (await apiRequest("GET", "/api/customer-hub/messages")).json(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: { topic: string; message: string }) => {
      const res = await apiRequest("POST", "/api/customer-hub/messages", data);
      return res.json();
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-hub/messages"] });
      setShowNewMessage(false);
      onSelectThread(thread.id);
      toast({ title: "Message sent" });
    },
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto" data-testid="messages-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: brandColors.darkGreen }}>Messages</h2>
        <Button onClick={() => setShowNewMessage(true)} style={{ backgroundColor: brandColors.darkGreen }} data-testid="button-new-message">
          <Send className="h-4 w-4 mr-2" /> New Message
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />)}</div>
      ) : threads.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No messages yet" description="Send your first message to the Chapin team." />
      ) : (
        <div className="space-y-2">
          {threads.map((thread: any) => (
            <Card
              key={thread.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${thread.unreadByCustomer ? "border-l-4" : ""}`}
              style={thread.unreadByCustomer ? { borderLeftColor: brandColors.gold } : {}}
              onClick={() => onSelectThread(thread.id)}
              data-testid={`thread-${thread.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${thread.unreadByCustomer ? "font-bold" : "font-medium"}`}>{thread.subject}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <Clock className="h-3 w-3" />
                      {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString() : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{thread.status}</Badge>
                    {thread.unreadByCustomer && (
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColors.gold }} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewMessageDialog
        open={showNewMessage}
        onClose={() => setShowNewMessage(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
    </div>
  );
}

function NewMessageDialog({ open, onClose, onSubmit, isPending }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: { topic: string; message: string }) => void; isPending: boolean;
}) {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Send a message to the Chapin Landscapes team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger data-testid="select-message-topic"><SelectValue placeholder="What is this about?" /></SelectTrigger>
            <SelectContent>
              {MESSAGE_TOPICS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message..." rows={4} data-testid="input-message-content" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSubmit({ topic, message })}
            disabled={!topic || !message.trim() || isPending}
            style={{ backgroundColor: brandColors.darkGreen }}
            data-testid="button-send-message"
          >
            {isPending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThreadDetail({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const [reply, setReply] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [`/api/customer-hub/messages/${threadId}`],
    queryFn: async () => (await apiRequest("GET", `/api/customer-hub/messages/${threadId}`)).json(),
    refetchInterval: 10000,
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/customer-hub/messages/${threadId}/reply`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customer-hub/messages/${threadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer-hub/messages"] });
      setReply("");
    },
  });

  if (isLoading) return <div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-64" /></div>;

  const thread = data?.thread;
  const messages = data?.messages || [];

  return (
    <div className="max-w-3xl mx-auto space-y-4" data-testid="thread-detail">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Messages
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: brandColors.darkGreen }}>{thread?.subject}</h2>
        <Badge variant="outline">{thread?.status}</Badge>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {messages.map((msg: any) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg max-w-[85%] ${
              msg.senderRole === "customer"
                ? "ml-auto bg-gray-100"
                : "mr-auto"
            }`}
            style={msg.senderRole !== "customer" ? { backgroundColor: brandColors.darkGreen + "08" } : {}}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: msg.senderRole === "customer" ? "#6b7280" : brandColors.darkGreen }}>
                {msg.senderRole === "customer" ? "You" : "Chapin Team"}
              </span>
              <span className="text-xs text-gray-400">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
      </div>

      {thread?.status !== "closed" && (
        <div className="flex gap-2">
          <Textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type your reply..."
            rows={2}
            className="flex-1"
            data-testid="input-reply"
          />
          <Button
            onClick={() => reply.trim() && replyMutation.mutate(reply.trim())}
            disabled={!reply.trim() || replyMutation.isPending}
            style={{ backgroundColor: brandColors.darkGreen }}
            className="self-end"
            data-testid="button-send-reply"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Home; title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="h-12 w-12 rounded-full mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: brandColors.darkGreen + "10" }}>
        <Icon className="h-6 w-6" style={{ color: brandColors.darkGreen }} />
      </div>
      <h3 className="font-semibold" style={{ color: brandColors.darkGreen }}>{title}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  );
}
