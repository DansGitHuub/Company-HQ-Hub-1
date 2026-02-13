import React, { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FilePlus2,
  Library,
  RefreshCw,
  FileEdit,
  Share2,
  Package,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  Send,
  Link2,
  Mail,
  Copy,
  Archive,
  Layers,
  Loader2,
  Sparkles,
  Target,
  Users,
  LayoutList,
  Image,
  Globe,
  ClipboardCheck,
  Trash2,
  GripVertical,
  Camera,
  Upload,
  PenTool,
  MapPin,
  Check,
  HelpCircle,
  FileUp,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

type View =
  | "home"
  | "build-new"
  | "build-purpose"
  | "build-wizard"
  | "form-library"
  | "form-detail"
  | "form-fill"
  | "update-existing"
  | "form-drafts"
  | "share-forms"
  | "build-packet"
  | "discontinued";

type FormFieldDef = {
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  options?: string[];
  helpText?: string;
};

type FormSection = {
  title: string;
  description: string;
  fields: FormFieldDef[];
};

type ToolsAndMedia = {
  enablePhotos: boolean;
  enableFileUpload: boolean;
  enableSignature: boolean;
  enableGeolocation: boolean;
  suggestedIllustrations: string[];
};

type ExternalConnections = {
  sendsEmail: boolean;
  emailRecipients: string;
  sendsToCalendar: boolean;
  requiresApproval: boolean;
  approver: string;
  integratesWithCRM: boolean;
};

type WizardData = {
  title: string;
  category: string;
  purpose: string;
  smartAnswers: Record<string, string>;
  pdfText: string;
  outcome: string;
  outcomeType: string;
  audience: string;
  audienceRoles: string[];
  sections: FormSection[];
  toolsAndMedia: ToolsAndMedia;
  externalConnections: ExternalConnections;
};

type SmartQuestion = {
  id: string;
  question: string;
  type: "select" | "text";
  options?: string[];
  placeholder?: string;
};

type PurposeOption = {
  label: string;
  description: string;
  placeholder: string;
  questions: SmartQuestion[];
};

const EMPTY_WIZARD: WizardData = {
  title: "",
  category: "",
  purpose: "",
  smartAnswers: {},
  pdfText: "",
  outcome: "",
  outcomeType: "data_collection",
  audience: "",
  audienceRoles: [],
  sections: [],
  toolsAndMedia: {
    enablePhotos: false,
    enableFileUpload: false,
    enableSignature: false,
    enableGeolocation: false,
    suggestedIllustrations: [],
  },
  externalConnections: {
    sendsEmail: false,
    emailRecipients: "",
    sendsToCalendar: false,
    requiresApproval: false,
    approver: "",
    integratesWithCRM: false,
  },
};

const WIZARD_STEPS = [
  { num: 1, key: "identify", label: "Identify", desc: "Form Title & Topic", icon: FileText },
  { num: 2, key: "outcome", label: "Outcome", desc: "What We're Trying to Achieve", icon: Target },
  { num: 3, key: "audience", label: "Audience", desc: "Who This Form Is Meant For", icon: Users },
  { num: 4, key: "sections", label: "Steps / Sections", desc: "Breakdown of Different Sections", icon: LayoutList },
  { num: 5, key: "tools", label: "Tools & Media", desc: "Added Features & Illustrations", icon: Image },
  { num: 6, key: "connections", label: "External Connections", desc: "Is Any Info Sent Out", icon: Globe },
  { num: 7, key: "review", label: "Final Review", desc: "Confirm Form & Take Action", icon: ClipboardCheck },
] as const;

const OUTCOME_TYPES = [
  { value: "data_collection", label: "Data Collection" },
  { value: "approval", label: "Approval / Sign-off" },
  { value: "compliance", label: "Compliance / Audit" },
  { value: "communication", label: "Communication" },
  { value: "tracking", label: "Tracking / Logging" },
];

const FIELD_TYPES = [
  "text", "textarea", "number", "email", "phone", "date", "time",
  "select", "checkbox", "radio", "file", "signature", "address",
];

const CATEGORIES: {
  label: string;
  num: number;
  description: string;
  placeholder: string;
  gradient: string;
  hoverGradient: string;
  purposes: PurposeOption[];
}[] = [
  {
    label: "Sales & Marketing", num: 1,
    description: "Proposals, lead tracking, and customer outreach forms",
    placeholder: "e.g. New Lead Intake Form",
    gradient: "from-emerald-500 to-emerald-700", hoverGradient: "from-emerald-600 to-emerald-800",
    purposes: [
      { label: "Lead Capture / Inquiry Form", description: "Collect prospect info from website, events, or referrals", placeholder: "e.g. New Customer Inquiry Form",
        questions: [
          { id: "source", question: "Where do most of your leads come from?", type: "select", options: ["Website", "Referrals", "Door-to-door", "Social media", "Trade shows", "Multiple sources"] },
          { id: "services", question: "What services do you want to list?", type: "text", placeholder: "e.g. Lawn care, hardscaping, irrigation" },
        ]},
      { label: "Customer Proposal / Quote", description: "Present project scope, pricing, and terms to a customer", placeholder: "e.g. Landscape Design Proposal",
        questions: [
          { id: "pricing", question: "How do you structure pricing?", type: "select", options: ["Fixed bid", "Time & materials", "Per square foot", "Tiered packages", "Custom"] },
          { id: "terms", question: "Do you include payment terms or a contract?", type: "select", options: ["Yes, with deposit required", "Yes, net 30 terms", "No, just a quote", "Varies by job"] },
        ]},
      { label: "Referral Tracking", description: "Track referral sources and reward programs", placeholder: "e.g. Customer Referral Form",
        questions: [
          { id: "reward", question: "Do you offer a referral reward?", type: "select", options: ["Yes, discount on next service", "Yes, cash or gift card", "No, just tracking", "Planning to start one"] },
        ]},
      { label: "Custom Sales Form", description: "Build any sales or marketing form from scratch", placeholder: "e.g. Event Follow-Up Sheet",
        questions: [] },
    ],
  },
  {
    label: "Estimating & Pre-Construction", num: 2,
    description: "Site assessments, project bids, and measurement sheets",
    placeholder: "e.g. Job Site Assessment Worksheet",
    gradient: "from-blue-500 to-blue-700", hoverGradient: "from-blue-600 to-blue-800",
    purposes: [
      { label: "Site Assessment / Walk-Through", description: "Document property conditions, measurements, and scope", placeholder: "e.g. Property Walk-Through Checklist",
        questions: [
          { id: "jobType", question: "What type of work is this assessment for?", type: "select", options: ["Full landscape install", "Hardscape only", "Planting / softscape", "Irrigation", "Maintenance takeover", "General assessment"] },
          { id: "measurements", question: "Do you need detailed measurements?", type: "select", options: ["Yes, full property dimensions", "Yes, specific areas only", "No, photos are enough", "We use a separate measuring tool"] },
        ]},
      { label: "Material Takeoff / Cost Estimate", description: "Calculate materials, labor, and costs for a project", placeholder: "e.g. Hardscape Material Takeoff",
        questions: [
          { id: "detail", question: "How detailed should the estimate be?", type: "select", options: ["Line-item by material", "Lump sum by phase", "Both — detailed with summary", "Quick ballpark"] },
        ]},
      { label: "Custom Estimating Form", description: "Build any estimating or pre-construction form", placeholder: "e.g. Irrigation Zone Layout Sheet",
        questions: [] },
    ],
  },
  {
    label: "Production & Field Operations", num: 3,
    description: "Daily crew logs, installation checklists, and job reports",
    placeholder: "e.g. Daily Crew Production Log",
    gradient: "from-orange-500 to-orange-700", hoverGradient: "from-orange-600 to-orange-800",
    purposes: [
      { label: "Daily Crew Log / Production Report", description: "Track daily work, hours, and materials used on site", placeholder: "e.g. Daily Production Report",
        questions: [
          { id: "crewSize", question: "What's a typical crew size?", type: "select", options: ["1-2 people", "3-5 people", "6-10 people", "10+ people", "Varies by job"] },
          { id: "tracking", question: "What do you need to track?", type: "select", options: ["Hours and tasks only", "Hours, tasks, and materials", "Everything including equipment", "Full documentation with photos"] },
        ]},
      { label: "Quality Control / Punch List", description: "Inspect completed work and document remaining items", placeholder: "e.g. Installation Punch List",
        questions: [
          { id: "stage", question: "When is this checklist used?", type: "select", options: ["Mid-project walkthrough", "Final inspection before handoff", "Post-completion follow-up", "All stages"] },
        ]},
      { label: "Custom Production Form", description: "Build any field operations form", placeholder: "e.g. Concrete Pour Log",
        questions: [] },
    ],
  },
  {
    label: "Maintenance Operations", num: 4,
    description: "Service schedules, property visit logs, and maintenance records",
    placeholder: "e.g. Weekly Property Maintenance Report",
    gradient: "from-teal-500 to-teal-700", hoverGradient: "from-teal-600 to-teal-800",
    purposes: [
      { label: "Property Visit / Service Log", description: "Record work done at each property visit", placeholder: "e.g. Weekly Mowing & Maintenance Log",
        questions: [
          { id: "frequency", question: "How often do you visit properties?", type: "select", options: ["Weekly", "Bi-weekly", "Monthly", "Seasonal", "On-demand"] },
          { id: "services", question: "What services do you typically perform?", type: "text", placeholder: "e.g. Mowing, edging, blowing, trimming, weeding" },
        ]},
      { label: "Seasonal Transition Checklist", description: "Document spring startup, winterization, or seasonal changeovers", placeholder: "e.g. Spring Startup Checklist",
        questions: [
          { id: "season", question: "Which seasonal transition?", type: "select", options: ["Spring startup", "Summer prep", "Fall cleanup", "Winterization", "Year-round"] },
        ]},
      { label: "Custom Maintenance Form", description: "Build any maintenance operations form", placeholder: "e.g. Irrigation System Check",
        questions: [] },
    ],
  },
  {
    label: "HR & Employees", num: 5,
    description: "Onboarding, time-off requests, and employee evaluations",
    placeholder: "e.g. New Employee Onboarding Checklist",
    gradient: "from-violet-500 to-violet-700", hoverGradient: "from-violet-600 to-violet-800",
    purposes: [
      { label: "Crew Member Hiring Application", description: "Job application for field crew positions with work history and references", placeholder: "e.g. Landscape Crew Application",
        questions: [
          { id: "experience", question: "Do you require prior landscaping experience?", type: "select", options: ["Yes, minimum 1 year", "Yes, minimum 2+ years", "Preferred but not required", "No, we train from scratch"] },
          { id: "license", question: "Does this position require a driver's license?", type: "select", options: ["Yes, valid driver's license required", "Yes, CDL preferred", "No", "Depends on the role"] },
          { id: "bgCheck", question: "Do you run background checks?", type: "select", options: ["Yes, for all hires", "Yes, for crew leads and above", "No", "Only for certain positions"] },
        ]},
      { label: "Manager / Supervisor Application", description: "Detailed application for leadership roles with behavioral questions", placeholder: "e.g. Operations Manager Application",
        questions: [
          { id: "level", question: "What management level?", type: "select", options: ["Crew Leader / Foreman", "Branch Manager", "Operations Manager", "General Manager / Director"] },
          { id: "directReports", question: "How many people would this person manage?", type: "select", options: ["1-5 direct reports", "6-15 direct reports", "15+ direct reports", "Varies seasonally"] },
        ]},
      { label: "New Employee Onboarding", description: "First-day paperwork, training acknowledgments, and setup tasks", placeholder: "e.g. New Hire Onboarding Packet",
        questions: [
          { id: "role", question: "What type of employee?", type: "select", options: ["Field crew", "Office / admin", "Management", "Seasonal / temporary", "All types"] },
        ]},
      { label: "Employee Performance Review", description: "Evaluate job performance, goals, and development", placeholder: "e.g. Annual Performance Review",
        questions: [
          { id: "frequency", question: "How often do you review employees?", type: "select", options: ["90-day probation review", "Quarterly", "Semi-annually", "Annually"] },
          { id: "style", question: "What review style do you prefer?", type: "select", options: ["Rating scale (1-5)", "Written narrative", "Both ratings and narrative", "Self-assessment + manager review"] },
        ]},
      { label: "Time Off / Leave Request", description: "Standardized request form for PTO, sick days, and leave", placeholder: "e.g. PTO Request Form",
        questions: [] },
      { label: "Custom HR Form", description: "Build any HR or employee-related form", placeholder: "e.g. Employee Exit Interview",
        questions: [] },
    ],
  },
  {
    label: "Finance & Accounting", num: 6,
    description: "Expense reports, purchase orders, and invoice tracking",
    placeholder: "e.g. Expense Reimbursement Request",
    gradient: "from-amber-500 to-amber-700", hoverGradient: "from-amber-600 to-amber-800",
    purposes: [
      { label: "Expense Report / Reimbursement", description: "Submit and track business expenses with receipts", placeholder: "e.g. Field Expense Report",
        questions: [
          { id: "approval", question: "Who approves expenses?", type: "select", options: ["Direct supervisor", "Office manager", "Owner / GM", "Depends on amount"] },
        ]},
      { label: "Purchase Order", description: "Request approval for materials and supplies", placeholder: "e.g. Material Purchase Order",
        questions: [
          { id: "threshold", question: "Is there an approval threshold?", type: "select", options: ["All purchases need approval", "Over $100", "Over $500", "Over $1,000", "No approval needed"] },
        ]},
      { label: "Custom Finance Form", description: "Build any finance or accounting form", placeholder: "e.g. Petty Cash Log",
        questions: [] },
    ],
  },
  {
    label: "Equipment & Assets", num: 7,
    description: "Equipment logs, maintenance tracking, and asset inventories",
    placeholder: "e.g. Equipment Inspection Checklist",
    gradient: "from-cyan-500 to-cyan-700", hoverGradient: "from-cyan-600 to-cyan-800",
    purposes: [
      { label: "Daily Equipment Inspection", description: "Pre-operation safety and condition checklist", placeholder: "e.g. Morning Equipment Inspection",
        questions: [
          { id: "equipType", question: "What type of equipment?", type: "select", options: ["Trucks & trailers", "Mowers & trimmers", "Heavy equipment (skid steer, mini-ex)", "All types", "Specific — I'll name it"] },
        ]},
      { label: "Equipment Maintenance Log", description: "Track service history, repairs, and scheduled maintenance", placeholder: "e.g. Fleet Maintenance Log",
        questions: [] },
      { label: "Asset Inventory / Check-Out", description: "Track who has what equipment and when it was issued", placeholder: "e.g. Tool Checkout Sheet",
        questions: [] },
      { label: "Custom Equipment Form", description: "Build any equipment or asset form", placeholder: "e.g. Damage Report",
        questions: [] },
    ],
  },
  {
    label: "Compliance & Legal", num: 8,
    description: "Safety audits, incident reports, and regulatory filings",
    placeholder: "e.g. Workplace Safety Incident Report",
    gradient: "from-red-500 to-red-700", hoverGradient: "from-red-600 to-red-800",
    purposes: [
      { label: "Safety Incident Report", description: "Document workplace injuries, near-misses, and corrective actions", placeholder: "e.g. Workplace Injury Report",
        questions: [
          { id: "osha", question: "Do you need OSHA-compliant reporting?", type: "select", options: ["Yes, full OSHA 301 format", "Yes, simplified version", "No, internal use only"] },
        ]},
      { label: "Safety Audit / Inspection", description: "Periodic workplace safety walk-through checklist", placeholder: "e.g. Monthly Safety Audit",
        questions: [
          { id: "frequency", question: "How often do you perform safety audits?", type: "select", options: ["Weekly", "Monthly", "Quarterly", "Annually", "As needed"] },
        ]},
      { label: "Government / Regulatory Form (PDF Upload)", description: "Upload a government form (W-9, I-9, W-4, etc.) and recreate it as a fillable form", placeholder: "e.g. IRS W-9 Request",
        questions: [] },
      { label: "Custom Compliance Form", description: "Build any compliance or legal form", placeholder: "e.g. Chemical Application Record",
        questions: [] },
    ],
  },
  {
    label: "Customer Experience & Retention", num: 9,
    description: "Satisfaction surveys, feedback forms, and follow-up trackers",
    placeholder: "e.g. Customer Satisfaction Survey",
    gradient: "from-pink-500 to-pink-700", hoverGradient: "from-pink-600 to-pink-800",
    purposes: [
      { label: "Customer Satisfaction Survey", description: "Post-job feedback to measure quality and satisfaction", placeholder: "e.g. Post-Service Customer Survey",
        questions: [
          { id: "timing", question: "When do you send this survey?", type: "select", options: ["Immediately after job completion", "1-3 days after", "1 week after", "End of season"] },
          { id: "scale", question: "What rating scale do you prefer?", type: "select", options: ["1-5 stars", "1-10 numeric", "Satisfied / Neutral / Dissatisfied", "NPS (0-10 recommend)"] },
        ]},
      { label: "Customer Complaint / Issue", description: "Document and track customer complaints and resolutions", placeholder: "e.g. Customer Issue Report",
        questions: [] },
      { label: "Custom Customer Form", description: "Build any customer experience form", placeholder: "e.g. Seasonal Service Renewal",
        questions: [] },
    ],
  },
  {
    label: "Management & Strategy", num: 10,
    description: "Meeting agendas, goal tracking, and performance reviews",
    placeholder: "e.g. Quarterly Business Review Template",
    gradient: "from-indigo-500 to-indigo-700", hoverGradient: "from-indigo-600 to-indigo-800",
    purposes: [
      { label: "Meeting Agenda / Minutes", description: "Structured agenda and action item tracking", placeholder: "e.g. Weekly Team Meeting Agenda",
        questions: [
          { id: "meetingType", question: "What type of meeting?", type: "select", options: ["Daily huddle / standup", "Weekly team meeting", "Monthly management review", "Quarterly planning", "Ad-hoc / project-specific"] },
        ]},
      { label: "Goal Setting / OKR Tracker", description: "Set and track objectives and key results", placeholder: "e.g. Quarterly Goal Tracker",
        questions: [] },
      { label: "Custom Management Form", description: "Build any management or strategy form", placeholder: "e.g. Department Budget Request",
        questions: [] },
    ],
  },
  {
    label: "Checklists", num: 11,
    description: "Quick-reference checklists for daily tasks and inspections",
    placeholder: "e.g. Morning Truck & Trailer Checklist",
    gradient: "from-lime-500 to-lime-700", hoverGradient: "from-lime-600 to-lime-800",
    purposes: [
      { label: "Daily Startup / End-of-Day Checklist", description: "Morning prep and end-of-day closeout procedures", placeholder: "e.g. Morning Crew Checklist",
        questions: [
          { id: "when", question: "Is this for morning, end-of-day, or both?", type: "select", options: ["Morning startup only", "End-of-day closeout only", "Both combined"] },
        ]},
      { label: "Vehicle / Trailer Pre-Trip", description: "DOT-style pre-trip inspection checklist", placeholder: "e.g. Truck & Trailer Pre-Trip Inspection",
        questions: [] },
      { label: "Job Site Setup / Teardown", description: "Checklist for arriving at and leaving a job site", placeholder: "e.g. Job Site Arrival Checklist",
        questions: [] },
      { label: "Custom Checklist", description: "Build any checklist from scratch", placeholder: "e.g. Weekly Office Closing Checklist",
        questions: [] },
    ],
  },
  {
    label: "Misc & Other", num: 12,
    description: "General forms that don't fit neatly into other categories",
    placeholder: "e.g. Vendor Contact Information Sheet",
    gradient: "from-slate-500 to-slate-700", hoverGradient: "from-slate-600 to-slate-800",
    purposes: [
      { label: "Upload a PDF to Recreate", description: "Upload any PDF document and convert it to a fillable form", placeholder: "e.g. Government Tax Form",
        questions: [] },
      { label: "Custom Form (No Template)", description: "Start completely from scratch with no predefined structure", placeholder: "e.g. Special Project Form",
        questions: [] },
    ],
  },
];

export default function Forms() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("home");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState<PurposeOption | null>(null);
  const [titlePlaceholder, setTitlePlaceholder] = useState("");
  const [wizardData, setWizardData] = useState<WizardData>({ ...EMPTY_WIZARD });
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null);

  const isInWizard = view === "build-wizard";

  const isWizardDirty = useCallback((d: WizardData) => {
    return d.title.trim() !== "" ||
      d.outcome.trim() !== "" ||
      d.audience.trim() !== "" ||
      d.sections.length > 0 ||
      d.pdfText.trim() !== "" ||
      Object.keys(d.smartAnswers).length > 0 ||
      d.audienceRoles.length > 0 ||
      d.toolsAndMedia.enablePhotos || d.toolsAndMedia.enableFileUpload || d.toolsAndMedia.enableSignature || d.toolsAndMedia.enableGeolocation ||
      d.externalConnections.sendsEmail || d.externalConnections.sendsToCalendar || d.externalConnections.requiresApproval || d.externalConnections.integratesWithCRM;
  }, []);

  const setWizardDataTracked = useCallback((updater: WizardData | ((prev: WizardData) => WizardData)) => {
    setWizardData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setHasUnsavedWork(isWizardDirty(next));
      return next;
    });
  }, [isWizardDirty]);

  const doExit = useCallback(() => {
    setView("home");
    setSelectedFormId(null);
    setSelectedCategory("");
    setSelectedPurpose(null);
    setWizardStep(0);
    setWizardData({ ...EMPTY_WIZARD });
    setHasUnsavedWork(false);
  }, []);

  const tryExit = useCallback((exitFn: () => void) => {
    if (isInWizard && hasUnsavedWork) {
      setPendingExitAction(() => exitFn);
      setExitDialogOpen(true);
    } else {
      exitFn();
    }
  }, [isInWizard, hasUnsavedWork]);

  const handleDiscard = () => {
    setExitDialogOpen(false);
    setHasUnsavedWork(false);
    if (pendingExitAction) pendingExitAction();
    setPendingExitAction(null);
  };

  const handleSaveDraft = async () => {
    try {
      await apiRequest("POST", "/api/builder-forms", {
        name: wizardData.title || "Untitled Draft",
        category: wizardData.category,
        purpose: wizardData.purpose,
        outcome: wizardData.outcome,
        outcomeType: wizardData.outcomeType,
        audience: wizardData.audience,
        audienceRoles: wizardData.audienceRoles,
        sections: wizardData.sections,
        toolsAndMedia: wizardData.toolsAndMedia,
        externalConnections: wizardData.externalConnections,
        status: "draft",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/builder-forms"] });
      toast({ title: "Draft saved!" });
      setExitDialogOpen(false);
      setHasUnsavedWork(false);
      if (pendingExitAction) pendingExitAction();
      setPendingExitAction(null);
    } catch {
      toast({ title: "Failed to save draft. Your work is still here.", variant: "destructive" });
      setExitDialogOpen(false);
      setPendingExitAction(null);
    }
  };

  const handleContinueWorking = () => {
    setExitDialogOpen(false);
    setPendingExitAction(null);
  };

  useEffect(() => {
    const resetHandler = () => {
      tryExit(doExit);
    };
    window.addEventListener("forms-nav-reset", resetHandler);
    return () => window.removeEventListener("forms-nav-reset", resetHandler);
  }, [tryExit, doExit]);

  useEffect(() => {
    if (!isInWizard || !hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isInWizard, hasUnsavedWork]);

  function selectCategory(category: string) {
    setSelectedCategory(category);
    setView("build-purpose");
  }

  function selectPurpose(purpose: PurposeOption) {
    setSelectedPurpose(purpose);
    setTitlePlaceholder(purpose.placeholder);
    setWizardData({ ...EMPTY_WIZARD, category: selectedCategory, purpose: purpose.label });
    setWizardStep(0);
    setView("build-wizard");
  }

  if (view === "home") {
    return <FormsHome onNavigate={setView} hoveredId={hoveredId} setHoveredId={setHoveredId} />;
  }

  const handleBack = () => {
    if (view === "build-wizard") {
      if (wizardStep > 0) {
        setWizardStep(wizardStep - 1);
        return;
      }
      tryExit(() => {
        setView("build-purpose");
        setHasUnsavedWork(false);
        setWizardData({ ...EMPTY_WIZARD, category: selectedCategory, purpose: selectedPurpose?.label || "" });
        setWizardStep(0);
      });
      return;
    }
    if (view === "build-purpose") {
      setView("build-new");
      return;
    }
    if (view === "form-fill") {
      setView("form-detail");
      return;
    }
    if (view === "form-detail") {
      setView("form-library");
      setSelectedFormId(null);
      return;
    }
    setView("home");
  };

  const backLabel = view === "build-wizard"
    ? (wizardStep > 0 ? `Back to Step ${wizardStep}` : "Back to Form Type")
    : view === "build-purpose"
      ? "Back to Categories"
      : view === "form-fill"
        ? "Back to Form Details"
        : view === "form-detail"
          ? "Back to Form Library"
          : "Back to Forms";

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="forms-page">
      <button
        onClick={handleBack}
        className="mb-6 inline-flex items-center gap-2.5 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 hover:shadow-md transition-all"
        data-testid="button-back"
      >
        <ArrowLeft className="h-5 w-5" />
        {backLabel}
      </button>

      {view === "build-new" && <BuildNewForm hoveredId={hoveredId} setHoveredId={setHoveredId} onSelectCategory={selectCategory} />}
      {view === "build-purpose" && (
        <PurposeSelector
          category={selectedCategory}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          onSelectPurpose={selectPurpose}
        />
      )}
      {view === "build-wizard" && (
        <FormWizard
          data={wizardData}
          setData={setWizardDataTracked}
          step={wizardStep}
          setStep={setWizardStep}
          titlePlaceholder={titlePlaceholder}
          purpose={selectedPurpose}
          onFinish={async () => {
            try {
              await apiRequest("POST", "/api/builder-forms", {
                name: wizardData.title || "Untitled Form",
                category: wizardData.category,
                purpose: wizardData.purpose,
                outcome: wizardData.outcome,
                outcomeType: wizardData.outcomeType,
                audience: wizardData.audience,
                audienceRoles: wizardData.audienceRoles,
                sections: wizardData.sections,
                toolsAndMedia: wizardData.toolsAndMedia,
                externalConnections: wizardData.externalConnections,
              });
              queryClient.invalidateQueries({ queryKey: ["/api/builder-forms"] });
              setHasUnsavedWork(false);
              setView("form-library");
              setWizardData({ ...EMPTY_WIZARD });
              setWizardStep(0);
              setSelectedPurpose(null);
            } catch {
              // toast handled below
            }
          }}
        />
      )}
      {view === "form-library" && <FormLibrary onOpenForm={(id: string) => { setSelectedFormId(id); setView("form-detail"); }} />}
      {view === "form-detail" && selectedFormId && <FormDetail formId={selectedFormId} onFillForm={() => setView("form-fill")} />}
      {view === "form-fill" && selectedFormId && <FormFill formId={selectedFormId} onSubmitted={() => { setView("home"); setSelectedFormId(null); }} />}
      {view === "update-existing" && <UpdateExisting />}
      {view === "form-drafts" && <FormDrafts />}
      {view === "share-forms" && <ShareForms />}
      {view === "build-packet" && <BuildPacket />}
      {view === "discontinued" && <DiscontinuedForms />}

      <AlertDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <AlertDialogContent data-testid="dialog-unsaved-changes">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved work in the Form Builder. If you navigate away now, all your progress will be lost. You can also save to drafts to continue later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={handleContinueWorking} data-testid="button-continue-working">
              Keep Working
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              data-testid="button-save-draft"
            >
              <Clock className="h-4 w-4 mr-2" /> Save to Drafts
            </Button>
            <Button
              onClick={handleDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-discard"
            >
              Discard & Leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormsHome({
  onNavigate,
  hoveredId,
  setHoveredId,
}: {
  onNavigate: (view: View) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
}) {
  const topButton = {
    id: "build-new" as View,
    label: "Build a New Form",
    description: "Create a form from scratch with our step-by-step builder",
    icon: FilePlus2,
    color: "from-emerald-500 to-emerald-700",
    hoverColor: "from-emerald-600 to-emerald-800",
  };

  const gridButtons: {
    id: View;
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    hoverColor: string;
  }[] = [
    { id: "form-library", label: "Form Library", description: "Browse and manage all your published forms", icon: Library, color: "from-blue-500 to-blue-700", hoverColor: "from-blue-600 to-blue-800" },
    { id: "update-existing", label: "Update an Existing Form", description: "Edit and modify forms that are already in use", icon: RefreshCw, color: "from-violet-500 to-violet-700", hoverColor: "from-violet-600 to-violet-800" },
    { id: "form-drafts", label: "Form Drafts", description: "Continue working on forms you haven't finished yet", icon: FileEdit, color: "from-amber-500 to-amber-700", hoverColor: "from-amber-600 to-amber-800" },
    { id: "share-forms", label: "Share Forms", description: "Send forms to employees, customers, or external contacts", icon: Share2, color: "from-cyan-500 to-cyan-700", hoverColor: "from-cyan-600 to-cyan-800" },
    { id: "build-packet", label: "Build a Packet", description: "Bundle multiple forms together into a single packet", icon: Package, color: "from-rose-500 to-rose-700", hoverColor: "from-rose-600 to-rose-800" },
    { id: "discontinued", label: "Discontinued Forms", description: "View and restore forms that have been retired", icon: XCircle, color: "from-slate-500 to-slate-700", hoverColor: "from-slate-600 to-slate-800" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="forms-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-forms-title">Forms</h1>
      <button
        onClick={() => onNavigate(topButton.id)}
        className={`w-full mb-6 rounded-2xl bg-gradient-to-br ${hoveredId === topButton.id ? topButton.hoverColor : topButton.color} p-8 text-white text-left transition-all duration-200 ${hoveredId === topButton.id ? "scale-[1.01] shadow-xl" : "shadow-lg"}`}
        onMouseEnter={() => setHoveredId(topButton.id)}
        onMouseLeave={() => setHoveredId(null)}
        data-testid={`button-${topButton.id}`}
      >
        <div className="flex items-center gap-4">
          <div className={`rounded-xl bg-white/20 p-4 transition-transform duration-200 ${hoveredId === topButton.id ? "scale-110" : ""}`}>
            <topButton.icon className="h-8 w-8" />
          </div>
          <div>
            <div className="text-xl font-bold">{topButton.label}</div>
            <div className="mt-1 text-sm text-white/80">{topButton.description}</div>
          </div>
        </div>
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gridButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => onNavigate(btn.id)}
            className={`rounded-2xl bg-gradient-to-br ${hoveredId === btn.id ? btn.hoverColor : btn.color} p-6 text-white text-left transition-all duration-200 ${hoveredId === btn.id ? "scale-[1.02] shadow-xl" : "shadow-lg"}`}
            onMouseEnter={() => setHoveredId(btn.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`button-${btn.id}`}
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-xl bg-white/20 p-3 transition-transform duration-200 ${hoveredId === btn.id ? "scale-110" : ""}`}>
                <btn.icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-bold">{btn.label}</div>
                <div className="mt-1 text-sm text-white/80">{btn.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold" data-testid="text-section-title">{title}</h1>
      </div>
      <p className="text-muted-foreground ml-[52px]">{description}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message, submessage }: { icon: React.ElementType; message: string; submessage?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
      <div className="rounded-2xl bg-muted/50 p-5 mb-4">
        <Icon className="h-10 w-10 text-muted-foreground/60" />
      </div>
      <p className="text-lg font-medium text-muted-foreground">{message}</p>
      {submessage && <p className="mt-1 text-sm text-muted-foreground/70">{submessage}</p>}
    </div>
  );
}

function BuildNewForm({
  hoveredId,
  setHoveredId,
  onSelectCategory,
}: {
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onSelectCategory: (category: string) => void;
}) {
  return (
    <div data-testid="view-build-new">
      <SectionHeader
        icon={FilePlus2}
        title="Build a New Form"
        description="Create a custom form step by step. Choose a category to get started."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((item) => {
          const isHovered = hoveredId === `cat-${item.num}`;
          return (
            <button
              key={item.label}
              onClick={() => onSelectCategory(item.label)}
              className={`rounded-2xl bg-gradient-to-br ${isHovered ? item.hoverGradient : item.gradient} p-5 text-white text-left transition-all duration-200 ${isHovered ? "scale-[1.02] shadow-xl" : "shadow-lg"}`}
              onMouseEnter={() => setHoveredId(`cat-${item.num}`)}
              onMouseLeave={() => setHoveredId(null)}
              data-testid={`card-category-${item.num}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-sm font-bold transition-transform duration-200 ${isHovered ? "scale-110" : ""}`}>
                  {item.num}
                </div>
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-xs text-white/75 mt-0.5">{item.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PurposeSelector({
  category,
  hoveredId,
  setHoveredId,
  onSelectPurpose,
}: {
  category: string;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onSelectPurpose: (purpose: PurposeOption) => void;
}) {
  const cat = CATEGORIES.find((c) => c.label === category);
  const purposes = cat?.purposes || [];

  return (
    <div data-testid="view-purpose-selector">
      <SectionHeader
        icon={Briefcase}
        title="What Type of Form?"
        description={`Select the specific purpose for your ${category} form. This helps generate a more targeted, professional result.`}
      />
      <Badge variant="secondary" className="mb-4 text-sm">{category}</Badge>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {purposes.map((purpose, idx) => {
          const key = `purpose-${idx}`;
          const isHovered = hoveredId === key;
          const isPdfUpload = purpose.label.toLowerCase().includes("pdf") || purpose.label.toLowerCase().includes("government");
          return (
            <button
              key={key}
              onClick={() => onSelectPurpose(purpose)}
              className={`rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                isHovered
                  ? "border-primary bg-primary/5 shadow-md scale-[1.01]"
                  : "border-border bg-card hover:border-primary/40"
              }`}
              onMouseEnter={() => setHoveredId(key)}
              onMouseLeave={() => setHoveredId(null)}
              data-testid={`card-purpose-${idx}`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 mt-0.5 ${isHovered ? "bg-primary/10" : "bg-muted"}`}>
                  {isPdfUpload ? (
                    <FileUp className={`h-5 w-5 ${isHovered ? "text-primary" : "text-muted-foreground"}`} />
                  ) : (
                    <Briefcase className={`h-5 w-5 ${isHovered ? "text-primary" : "text-muted-foreground"}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{purpose.label}</div>
                    {purpose.questions.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {purpose.questions.length} smart Q{purpose.questions.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{purpose.description}</div>
                </div>
                <ChevronRight className={`h-5 w-5 shrink-0 mt-1 transition-transform ${isHovered ? "text-primary translate-x-0.5" : "text-muted-foreground/40"}`} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormWizard({
  data,
  setData,
  step,
  setStep,
  titlePlaceholder,
  purpose,
  onFinish,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  titlePlaceholder: string;
  purpose: PurposeOption | null;
  onFinish: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const currentStep = WIZARD_STEPS[step];

  const update = useCallback((patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, [setData]);

  const runAiFill = async () => {
    if (!data.title.trim()) {
      toast({ title: "Enter a form title first", variant: "destructive" });
      return;
    }
    setIsAiFilling(true);
    try {
      const res = await apiRequest("POST", "/api/form-builder/ai-fill", {
        title: data.title,
        category: data.category,
        purpose: data.purpose,
        smartAnswers: data.smartAnswers,
        pdfText: data.pdfText || undefined,
      });
      const ai: WizardData = await res.json();
      setData((prev) => ({
        ...prev,
        title: ai.title || prev.title,
        outcome: ai.outcome || prev.outcome,
        outcomeType: ai.outcomeType || prev.outcomeType,
        audience: ai.audience || prev.audience,
        audienceRoles: ai.audienceRoles?.length ? ai.audienceRoles : prev.audienceRoles,
        sections: ai.sections?.length ? ai.sections : prev.sections,
        toolsAndMedia: ai.toolsAndMedia || prev.toolsAndMedia,
        externalConnections: ai.externalConnections || prev.externalConnections,
      }));
      toast({ title: "AI filled all steps!", description: "Review each step and make any changes you'd like." });
    } catch (err) {
      toast({ title: "AI generation failed", description: "You can fill in the fields manually.", variant: "destructive" });
    } finally {
      setIsAiFilling(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return data.title.trim().length > 0;
      case 1: return data.outcome.trim().length > 0;
      case 2: return data.audience.trim().length > 0;
      case 3: return data.sections.length > 0;
      default: return true;
    }
  };

  const goNext = () => {
    if (step < WIZARD_STEPS.length - 1) setStep(step + 1);
  };

  return (
    <div data-testid="view-build-wizard">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="secondary">{data.category}</Badge>
        {data.purpose && <Badge variant="outline">{data.purpose}</Badge>}
      </div>

      <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((s, idx) => {
          const isActive = idx === step;
          const isDone = idx < step;
          return (
            <button
              key={s.key}
              onClick={() => { if (idx <= step) setStep(idx); }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : isDone
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                    : "bg-muted text-muted-foreground"
              }`}
              disabled={idx > step}
              data-testid={`wizard-step-${s.key}`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                isActive ? "bg-white text-primary" : isDone ? "bg-emerald-600 text-white" : "bg-muted-foreground/20"
              }`}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : s.num}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-2">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-muted-foreground text-right">
          Step {step + 1} of {WIZARD_STEPS.length}
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {currentStep && <currentStep.icon className="h-6 w-6 text-primary" />}
            <div>
              <h2 className="text-xl font-bold" data-testid="text-wizard-step-title">{currentStep?.label}</h2>
              <p className="text-sm text-muted-foreground">{currentStep?.desc}</p>
            </div>
          </div>

          {step === 0 && (
            <StepIdentify
              data={data}
              update={update}
              onAiFill={runAiFill}
              isAiFilling={isAiFilling}
              titlePlaceholder={titlePlaceholder}
              purpose={purpose}
            />
          )}
          {step === 1 && <StepOutcome data={data} update={update} />}
          {step === 2 && <StepAudience data={data} update={update} />}
          {step === 3 && <StepSections data={data} update={update} />}
          {step === 4 && <StepToolsMedia data={data} update={update} />}
          {step === 5 && <StepConnections data={data} update={update} />}
          {step === 6 && <StepReview data={data} onFinish={onFinish} />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-4 pb-8">
        <Button
          variant="outline"
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="gap-2"
          data-testid="button-wizard-prev"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>

        {step < WIZARD_STEPS.length - 1 ? (
          <Button
            onClick={goNext}
            disabled={!canProceed()}
            className="gap-2"
            data-testid="button-wizard-next"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={async () => {
              setIsSaving(true);
              try {
                await onFinish();
                toast({ title: "Form saved!", description: "Your form has been saved to the Form Library." });
              } catch {
                toast({ title: "Failed to save form", variant: "destructive" });
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="gap-2"
            data-testid="button-wizard-finish"
          >
            {isSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Save Form</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepIdentify({
  data,
  update,
  onAiFill,
  isAiFilling,
  titlePlaceholder,
  purpose,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  onAiFill: () => void;
  isAiFilling: boolean;
  titlePlaceholder: string;
  purpose: PurposeOption | null;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const questions = purpose?.questions || [];
  const isPdfPurpose = purpose?.label.toLowerCase().includes("pdf") || purpose?.label.toLowerCase().includes("government");

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Please upload a PDF file", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 10MB", variant: "destructive" });
      return;
    }

    setIsUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/form-builder/parse-pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const { text, suggestedTitle } = await res.json();
      update({
        pdfText: text,
        title: data.title || suggestedTitle || file.name.replace(".pdf", ""),
      });
      toast({ title: "PDF uploaded successfully!", description: "Click 'Auto-Fill with AI' to generate a fillable version." });
    } catch (err) {
      toast({ title: "Failed to process PDF", description: "Try a different file or enter fields manually.", variant: "destructive" });
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {isPdfPurpose && (
        <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-5" data-testid="pdf-upload-area">
          <div className="flex items-start gap-3">
            <FileUp className="h-6 w-6 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-blue-900">Upload a PDF to Recreate</div>
              <p className="text-sm text-blue-700 mt-1">
                Upload a government form, tax document, or any PDF. We'll extract the content and let AI recreate it as a fillable form you can use digitally.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
                data-testid="input-pdf-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPdf}
                variant="outline"
                className="mt-3 gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                data-testid="button-upload-pdf"
              >
                {isUploadingPdf ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing PDF...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Choose PDF File</>
                )}
              </Button>
              {data.pdfText && (
                <div className="mt-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700 font-medium">PDF content extracted ({data.pdfText.length.toLocaleString()} characters)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <Label>Form Title *</Label>
        <Input
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={titlePlaceholder}
          className="mt-1"
          data-testid="input-form-title"
        />
        <p className="text-xs text-muted-foreground mt-1">Give your form a clear, descriptive name</p>
      </div>

      <div>
        <Label>Category</Label>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">{data.category}</Badge>
          {data.purpose && <Badge variant="outline" className="text-sm">{data.purpose}</Badge>}
        </div>
      </div>

      {questions.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-5 space-y-4" data-testid="smart-questions">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="h-5 w-5 text-primary" />
            <div className="font-semibold">Quick Questions</div>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Answer these to get a more tailored, professional form. These are optional but highly recommended.
          </p>
          {questions.map((q) => (
            <div key={q.id}>
              <Label className="text-sm">{q.question}</Label>
              {q.type === "select" && q.options ? (
                <Select
                  value={data.smartAnswers[q.id] || ""}
                  onValueChange={(v) => update({ smartAnswers: { ...data.smartAnswers, [q.id]: v } })}
                >
                  <SelectTrigger className="mt-1" data-testid={`select-smart-${q.id}`}>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {q.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={data.smartAnswers[q.id] || ""}
                  onChange={(e) => update({ smartAnswers: { ...data.smartAnswers, [q.id]: e.target.value } })}
                  placeholder={q.placeholder || ""}
                  className="mt-1"
                  data-testid={`input-smart-${q.id}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-6 w-6 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">AI Auto-Fill</div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.pdfText
                ? "Your PDF content is ready. Click below to convert it into a fillable form with properly typed fields."
                : questions.length > 0
                  ? "Enter a title and answer the questions above, then click to generate a highly specific, professional-grade form based on best practices from top US companies."
                  : "Enter a form title above, then click the button to have AI automatically fill in all remaining steps."
              }
            </p>
            <Button
              onClick={onAiFill}
              disabled={isAiFilling || !data.title.trim()}
              className={`mt-3 gap-2 px-5 py-2.5 text-sm font-semibold shadow-sm transition-all bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md border-purple-600 dark:bg-purple-700 dark:hover:bg-purple-600`}
              data-testid="button-ai-fill"
            >
              {isAiFilling ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> AI is filling in fields...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Auto-Fill with AI</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepOutcome({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>What does this form achieve? *</Label>
        <Textarea
          value={data.outcome}
          onChange={(e) => update({ outcome: e.target.value })}
          placeholder="Describe the purpose and desired result of this form..."
          rows={4}
          className="mt-1"
          data-testid="input-outcome"
        />
      </div>
      <div>
        <Label>Outcome Type</Label>
        <Select value={data.outcomeType} onValueChange={(v) => update({ outcomeType: v })}>
          <SelectTrigger className="mt-1" data-testid="select-outcome-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepAudience({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  const toggleRole = (role: string) => {
    const roles = data.audienceRoles.includes(role)
      ? data.audienceRoles.filter((r) => r !== role)
      : [...data.audienceRoles, role];
    update({ audienceRoles: roles });
  };

  return (
    <div className="space-y-5">
      <div>
        <Label>Who fills out this form? *</Label>
        <Input
          value={data.audience}
          onChange={(e) => update({ audience: e.target.value })}
          placeholder="e.g. Crew Leaders, New Hires, Customers"
          className="mt-1"
          data-testid="input-audience"
        />
        <p className="text-xs text-muted-foreground mt-1">Describe the specific audience in your own words</p>
      </div>
      <div>
        <Label>Access Roles</Label>
        <p className="text-xs text-muted-foreground mb-2">Which system roles should be able to access this form?</p>
        <div className="flex flex-wrap gap-3">
          {["Admin", "Manager", "Crew", "Customer"].map((role) => (
            <label key={role} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={data.audienceRoles.includes(role)}
                onCheckedChange={() => toggleRole(role)}
                data-testid={`checkbox-role-${role.toLowerCase()}`}
              />
              <span className="text-sm">{role}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepSections({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  const addSection = () => {
    update({
      sections: [
        ...data.sections,
        { title: "", description: "", fields: [{ label: "", type: "text", required: false, placeholder: "", options: [], helpText: "" }] },
      ],
    });
  };

  const updateSection = (idx: number, patch: Partial<FormSection>) => {
    const next = data.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    update({ sections: next });
  };

  const removeSection = (idx: number) => {
    update({ sections: data.sections.filter((_, i) => i !== idx) });
  };

  const duplicateSection = (idx: number) => {
    const section = data.sections[idx];
    const clone = { ...section, title: section.title ? `${section.title} (copy)` : "", fields: section.fields.map(f => ({ ...f })) };
    const next = [...data.sections];
    next.splice(idx + 1, 0, clone);
    update({ sections: next });
  };

  const addField = (sIdx: number) => {
    const section = data.sections[sIdx];
    updateSection(sIdx, {
      fields: [...section.fields, { label: "", type: "text", required: false, placeholder: "", options: [], helpText: "" }],
    });
  };

  const updateField = (sIdx: number, fIdx: number, patch: Partial<FormFieldDef>) => {
    const section = data.sections[sIdx];
    const fields = section.fields.map((f, i) => (i === fIdx ? { ...f, ...patch } : f));
    updateSection(sIdx, { fields });
  };

  const removeField = (sIdx: number, fIdx: number) => {
    const section = data.sections[sIdx];
    updateSection(sIdx, { fields: section.fields.filter((_, i) => i !== fIdx) });
  };

  const duplicateField = (sIdx: number, fIdx: number) => {
    const section = data.sections[sIdx];
    const clone = { ...section.fields[fIdx] };
    const fields = [...section.fields];
    fields.splice(fIdx + 1, 0, clone);
    updateSection(sIdx, { fields });
  };

  const reorderField = (sIdx: number, fromIdx: number, toIdx: number) => {
    const section = data.sections[sIdx];
    const fields = [...section.fields];
    const [moved] = fields.splice(fromIdx, 1);
    fields.splice(toIdx, 0, moved);
    updateSection(sIdx, { fields });
  };

  const handleFieldDragEnd = (sIdx: number) => (result: DropResult) => {
    if (!result.destination) return;
    reorderField(sIdx, result.source.index, result.destination.index);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Break your form into logical sections. Each section can have multiple fields.
      </p>

      {data.sections.map((section, sIdx) => (
        <Card key={sIdx} className="border-l-4 border-l-primary">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={section.title}
                  onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                  placeholder={`Section ${sIdx + 1} title`}
                  className="font-semibold"
                  data-testid={`input-section-title-${sIdx}`}
                />
                <Input
                  value={section.description}
                  onChange={(e) => updateSection(sIdx, { description: e.target.value })}
                  placeholder="Brief description of this section..."
                  className="text-sm"
                  data-testid={`input-section-desc-${sIdx}`}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => duplicateSection(sIdx)} className="h-8 w-8 p-0" data-testid={`button-duplicate-section-${sIdx}`} title="Duplicate section">
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeSection(sIdx)} className="h-8 w-8 p-0" data-testid={`button-remove-section-${sIdx}`} title="Remove section">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <DragDropContext onDragEnd={handleFieldDragEnd(sIdx)}>
              <Droppable droppableId={`section-${sIdx}-fields`}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2 pl-3 border-l-2 border-muted"
                  >
                    {section.fields.map((field, fIdx) => (
                      <Draggable key={`field-${sIdx}-${fIdx}`} draggableId={`field-${sIdx}-${fIdx}`} index={fIdx}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`flex items-start gap-2 rounded-lg bg-muted/30 p-2 ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30 bg-background" : ""}`}
                            data-testid={`draggable-field-${sIdx}-${fIdx}`}
                          >
                            <div
                              {...dragProvided.dragHandleProps}
                              className="flex items-center shrink-0 mt-2 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                              data-testid={`drag-handle-field-${sIdx}-${fIdx}`}
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
                              <Input
                                value={field.label}
                                onChange={(e) => updateField(sIdx, fIdx, { label: e.target.value })}
                                placeholder="Field label"
                                className="text-sm"
                                data-testid={`input-field-label-${sIdx}-${fIdx}`}
                              />
                              <Select value={field.type} onValueChange={(v) => updateField(sIdx, fIdx, { type: v })}>
                                <SelectTrigger className="text-sm" data-testid={`select-field-type-${sIdx}-${fIdx}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <Checkbox
                                    checked={field.required}
                                    onCheckedChange={(c) => updateField(sIdx, fIdx, { required: !!c })}
                                    data-testid={`checkbox-required-${sIdx}-${fIdx}`}
                                  />
                                  <span className="text-xs">Req</span>
                                </label>
                                <Button variant="ghost" size="sm" onClick={() => duplicateField(sIdx, fIdx)} className="h-8 w-8 p-0" data-testid={`button-duplicate-field-${sIdx}-${fIdx}`} title="Duplicate field">
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => removeField(sIdx, fIdx)} className="h-8 w-8 p-0" data-testid={`button-remove-field-${sIdx}-${fIdx}`} title="Remove field">
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <Button variant="ghost" size="sm" onClick={() => addField(sIdx)} className="gap-1 text-xs" data-testid={`button-add-field-${sIdx}`}>
                      <Plus className="h-3.5 w-3.5" /> Add Field
                    </Button>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addSection} className="gap-2 w-full" data-testid="button-add-section">
        <Plus className="h-4 w-4" /> Add Section
      </Button>
    </div>
  );
}

function StepToolsMedia({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  const tm = data.toolsAndMedia;
  const setTm = (patch: Partial<ToolsAndMedia>) => update({ toolsAndMedia: { ...tm, ...patch } });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Enable additional features and media capabilities for this form.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { key: "enablePhotos" as const, label: "Photo Attachments", desc: "Allow photo uploads within the form", icon: Camera },
          { key: "enableFileUpload" as const, label: "File Uploads", desc: "Allow document and file attachments", icon: Upload },
          { key: "enableSignature" as const, label: "Signature Capture", desc: "Include a signature field", icon: PenTool },
          { key: "enableGeolocation" as const, label: "Geolocation", desc: "Capture the user's location automatically", icon: MapPin },
        ].map((item) => (
          <Card key={item.key} className={`transition-all ${tm[item.key] ? "border-primary bg-primary/5" : ""}`}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${tm[item.key] ? "bg-primary/10" : "bg-muted"}`}>
                  <item.icon className={`h-5 w-5 ${tm[item.key] ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
              <Switch
                checked={tm[item.key]}
                onCheckedChange={(v) => setTm({ [item.key]: v })}
                data-testid={`switch-${item.key}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {tm.suggestedIllustrations.length > 0 && (
        <div>
          <Label>AI-Suggested Illustrations</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {tm.suggestedIllustrations.map((ill, idx) => (
              <Badge key={idx} variant="secondary" className="text-sm">{ill}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepConnections({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  const ec = data.externalConnections;
  const setEc = (patch: Partial<ExternalConnections>) => update({ externalConnections: { ...ec, ...patch } });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Configure what happens when this form is submitted — notifications, approvals, and integrations.
      </p>

      <div className="space-y-4">
        <Card className={`transition-all ${ec.sendsEmail ? "border-primary bg-primary/5" : ""}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className={`h-5 w-5 ${ec.sendsEmail ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-medium text-sm">Email Notification</div>
                  <div className="text-xs text-muted-foreground">Send an email when this form is submitted</div>
                </div>
              </div>
              <Switch checked={ec.sendsEmail} onCheckedChange={(v) => setEc({ sendsEmail: v })} data-testid="switch-sends-email" />
            </div>
            {ec.sendsEmail && (
              <Input
                value={ec.emailRecipients}
                onChange={(e) => setEc({ emailRecipients: e.target.value })}
                placeholder="e.g. Office Manager, HR Department"
                className="text-sm"
                data-testid="input-email-recipients"
              />
            )}
          </CardContent>
        </Card>

        <Card className={`transition-all ${ec.sendsToCalendar ? "border-primary bg-primary/5" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className={`h-5 w-5 ${ec.sendsToCalendar ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-medium text-sm">Calendar Event</div>
                  <div className="text-xs text-muted-foreground">Create a calendar event from this submission</div>
                </div>
              </div>
              <Switch checked={ec.sendsToCalendar} onCheckedChange={(v) => setEc({ sendsToCalendar: v })} data-testid="switch-calendar" />
            </div>
          </CardContent>
        </Card>

        <Card className={`transition-all ${ec.requiresApproval ? "border-primary bg-primary/5" : ""}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-5 w-5 ${ec.requiresApproval ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-medium text-sm">Requires Approval</div>
                  <div className="text-xs text-muted-foreground">Someone must review and approve submissions</div>
                </div>
              </div>
              <Switch checked={ec.requiresApproval} onCheckedChange={(v) => setEc({ requiresApproval: v })} data-testid="switch-approval" />
            </div>
            {ec.requiresApproval && (
              <Input
                value={ec.approver}
                onChange={(e) => setEc({ approver: e.target.value })}
                placeholder="e.g. Manager, Supervisor, Admin"
                className="text-sm"
                data-testid="input-approver"
              />
            )}
          </CardContent>
        </Card>

        <Card className={`transition-all ${ec.integratesWithCRM ? "border-primary bg-primary/5" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className={`h-5 w-5 ${ec.integratesWithCRM ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-medium text-sm">CRM Integration</div>
                  <div className="text-xs text-muted-foreground">Link submissions to customer records</div>
                </div>
              </div>
              <Switch checked={ec.integratesWithCRM} onCheckedChange={(v) => setEc({ integratesWithCRM: v })} data-testid="switch-crm" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StepReview({ data, onFinish }: { data: WizardData; onFinish: () => void }) {
  const totalFields = data.sections.reduce((sum, s) => sum + s.fields.length, 0);

  return (
    <div className="space-y-5" data-testid="wizard-review">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Form Title</div>
            <div className="font-semibold" data-testid="review-title">{data.title || "\u2014"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Category & Purpose</div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{data.category}</Badge>
              {data.purpose && <Badge variant="outline">{data.purpose}</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Outcome</div>
          <div className="text-sm" data-testid="review-outcome">{data.outcome || "\u2014"}</div>
          <Badge variant="outline" className="mt-2">
            {OUTCOME_TYPES.find((t) => t.value === data.outcomeType)?.label || data.outcomeType}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Audience</div>
          <div className="text-sm font-medium">{data.audience || "\u2014"}</div>
          <div className="flex gap-1 mt-2">
            {data.audienceRoles.map((r) => (
              <Badge key={r} variant="secondary">{r}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Sections & Fields</div>
          <div className="text-sm font-medium">{data.sections.length} sections, {totalFields} fields</div>
          <div className="mt-2 space-y-1">
            {data.sections.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{s.title || `Section ${idx + 1}`}</span>
                <span className="text-muted-foreground">\u2014 {s.fields.length} fields</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">Tools & Media</div>
            <div className="flex flex-wrap gap-2">
              {data.toolsAndMedia.enablePhotos && <Badge>Photos</Badge>}
              {data.toolsAndMedia.enableFileUpload && <Badge>File Upload</Badge>}
              {data.toolsAndMedia.enableSignature && <Badge>Signature</Badge>}
              {data.toolsAndMedia.enableGeolocation && <Badge>Geolocation</Badge>}
              {!data.toolsAndMedia.enablePhotos && !data.toolsAndMedia.enableFileUpload && !data.toolsAndMedia.enableSignature && !data.toolsAndMedia.enableGeolocation && (
                <span className="text-sm text-muted-foreground">None enabled</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">External Connections</div>
            <div className="flex flex-wrap gap-2">
              {data.externalConnections.sendsEmail && <Badge>Email</Badge>}
              {data.externalConnections.sendsToCalendar && <Badge>Calendar</Badge>}
              {data.externalConnections.requiresApproval && <Badge>Approval</Badge>}
              {data.externalConnections.integratesWithCRM && <Badge>CRM</Badge>}
              {!data.externalConnections.sendsEmail && !data.externalConnections.sendsToCalendar && !data.externalConnections.requiresApproval && !data.externalConnections.integratesWithCRM && (
                <span className="text-sm text-muted-foreground">None configured</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FormLibrary({ onOpenForm }: { onOpenForm: (id: string) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: forms = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/builder-forms"],
    queryFn: async () => {
      const res = await fetch("/api/builder-forms?archived=false", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load forms");
      return res.json();
    },
  });

  const filtered = forms.filter((f: any) => {
    const matchSearch = !searchTerm || f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || f.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = !categoryFilter || f.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const categories = [...new Set(forms.map((f: any) => f.category).filter(Boolean))];

  return (
    <div data-testid="view-form-library">
      <SectionHeader icon={Library} title="Form Library" description="Browse, search, and manage all your published forms in one place." />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms by name or category..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-library"
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Library} message="Your form library is empty" submessage="Build your first form and it will appear here once published." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((form: any) => {
            const sectionCount = Array.isArray(form.sections) ? form.sections.length : 0;
            const fieldCount = Array.isArray(form.sections)
              ? form.sections.reduce((sum: number, s: any) => sum + (Array.isArray(s.fields) ? s.fields.length : 0), 0)
              : 0;
            return (
              <button
                key={form.id}
                onClick={() => onOpenForm(form.id)}
                className="text-left w-full rounded-xl border bg-card transition-all hover:shadow-md hover:border-primary/40 cursor-pointer"
                data-testid={`card-form-${form.id}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate" data-testid={`text-form-name-${form.id}`}>{form.name}</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.category && <Badge variant="secondary" className="text-xs">{form.category}</Badge>}
                        {form.purpose && <Badge variant="outline" className="text-xs">{form.purpose}</Badge>}
                      </div>
                      {form.outcome && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{form.outcome}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span>{sectionCount} section{sectionCount !== 1 ? "s" : ""}</span>
                        <span>{fieldCount} field{fieldCount !== 1 ? "s" : ""}</span>
                        {form.createdAt && (
                          <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                      <ChevronRight className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormDetail({ formId, onFillForm }: { formId: string; onFillForm: () => void }) {
  const { data: form, isLoading } = useQuery<any>({
    queryKey: ["/api/builder-forms", formId],
    queryFn: async () => {
      const res = await fetch(`/api/builder-forms/${formId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load form");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="view-form-detail">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div data-testid="view-form-detail">
        <EmptyState icon={FileText} message="Form not found" submessage="This form may have been deleted." />
      </div>
    );
  }

  const sections: any[] = Array.isArray(form.sections) ? form.sections : [];
  const totalFields = sections.reduce((sum: number, s: any) => sum + (Array.isArray(s.fields) ? s.fields.length : 0), 0);
  const tm = form.toolsAndMedia || {};
  const ec = form.externalConnections || {};
  const roles: string[] = Array.isArray(form.audienceRoles) ? form.audienceRoles : [];

  return (
    <div data-testid="view-form-detail">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-form-detail-name">{form.name}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {form.category && <Badge variant="secondary">{form.category}</Badge>}
          {form.purpose && <Badge variant="outline">{form.purpose}</Badge>}
          {form.status && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{form.status}</Badge>}
        </div>
        {form.createdAt && (
          <p className="text-sm text-muted-foreground mt-2">Created {new Date(form.createdAt).toLocaleDateString()}</p>
        )}
        <Button onClick={onFillForm} className="mt-4 gap-2" data-testid="button-fill-form">
          <FileEdit className="h-4 w-4" /> Test / Fill Out This Form
        </Button>
      </div>

      {form.outcome && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-1">Outcome</div>
            <p className="text-sm">{form.outcome}</p>
            {form.outcomeType && (
              <Badge variant="outline" className="mt-2">
                {OUTCOME_TYPES.find((t) => t.value === form.outcomeType)?.label || form.outcomeType}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {(form.audience || roles.length > 0) && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-1">Audience</div>
            {form.audience && <p className="text-sm font-medium">{form.audience}</p>}
            {roles.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {roles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {sections.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <LayoutList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Sections & Fields</h2>
            <span className="text-sm text-muted-foreground">({sections.length} sections, {totalFields} fields)</span>
          </div>
          <div className="space-y-3">
            {sections.map((section: any, sIdx: number) => (
              <Card key={sIdx} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="font-semibold">{section.title || `Section ${sIdx + 1}`}</div>
                  {section.description && <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>}
                  {Array.isArray(section.fields) && section.fields.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {section.fields.map((field: any, fIdx: number) => (
                        <div key={fIdx} className="flex items-center gap-2 text-sm rounded-lg bg-muted/40 px-3 py-2">
                          <span className="font-medium flex-1">{field.label || `Field ${fIdx + 1}`}</span>
                          <Badge variant="outline" className="text-[10px]">{field.type}</Badge>
                          {field.required && <Badge className="text-[10px] bg-red-100 text-red-700 hover:bg-red-100">Required</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">Tools & Media</div>
            <div className="flex flex-wrap gap-2">
              {tm.enablePhotos && <Badge>Photos</Badge>}
              {tm.enableFileUpload && <Badge>File Upload</Badge>}
              {tm.enableSignature && <Badge>Signature</Badge>}
              {tm.enableGeolocation && <Badge>Geolocation</Badge>}
              {!tm.enablePhotos && !tm.enableFileUpload && !tm.enableSignature && !tm.enableGeolocation && (
                <span className="text-sm text-muted-foreground">None enabled</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">External Connections</div>
            <div className="flex flex-wrap gap-2">
              {ec.sendsEmail && <Badge>Email</Badge>}
              {ec.sendsToCalendar && <Badge>Calendar</Badge>}
              {ec.requiresApproval && <Badge>Approval</Badge>}
              {ec.integratesWithCRM && <Badge>CRM</Badge>}
              {!ec.sendsEmail && !ec.sendsToCalendar && !ec.requiresApproval && !ec.integratesWithCRM && (
                <span className="text-sm text-muted-foreground">None configured</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignaturePad({ value, onChange, testId }: { value: string; onChange: (dataUrl: string) => void; testId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);

  useEffect(() => {
    const syncSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 120 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = "120px";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    };
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, []);

  useEffect(() => {
    if (value && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const img = new window.Image();
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
          ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
          ctx.restore();
          setHasDrawn(true);
        };
        img.src = value;
      }
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      if (canvas) {
        onChange(canvas.toDataURL("image/png"));
      }
    }
    setIsDrawing(false);
  }, [isDrawing, onChange]);

  useEffect(() => {
    window.addEventListener("mouseup", stopDrawing);
    window.addEventListener("touchend", stopDrawing);
    return () => {
      window.removeEventListener("mouseup", stopDrawing);
      window.removeEventListener("touchend", stopDrawing);
    };
  }, [stopDrawing]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasDrawn(false);
    onChange("");
  };

  return (
    <div data-testid={testId}>
      <div ref={containerRef} className="rounded-lg border-2 border-muted-foreground/20 bg-white relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          data-testid={`${testId}-canvas`}
        />
        <div className="absolute bottom-2 left-3 right-3 border-t border-muted-foreground/20" />
        <div className="absolute bottom-1 left-3 text-[10px] text-muted-foreground/40">Sign above the line</div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-muted-foreground">
          {hasDrawn ? "Signature captured" : "Draw your signature above"}
        </span>
        {hasDrawn && (
          <button
            type="button"
            onClick={clearSignature}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            data-testid={`${testId}-clear`}
          >
            <XCircle className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

function calcBusinessDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function FormFill({ formId, onSubmitted }: { formId: string; onSubmitted: () => void }) {
  const { toast } = useToast();
  const { data: form, isLoading } = useQuery<any>({
    queryKey: ["/api/builder-forms", formId],
    queryFn: async () => {
      const res = await fetch(`/api/builder-forms/${formId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load form");
      return res.json();
    },
  });

  const [formValues, setFormValues] = useState<Record<string, any>>({});

  const fieldKey = (sIdx: number, fIdx: number) => `s${sIdx}_f${fIdx}`;

  const updateField = (sIdx: number, fIdx: number, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldKey(sIdx, fIdx)]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="view-form-fill">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div data-testid="view-form-fill">
        <EmptyState icon={FileText} message="Form not found" />
      </div>
    );
  }

  const sections: any[] = Array.isArray(form.sections) ? form.sections : [];

  const renderField = (field: any, sIdx: number, fIdx: number) => {
    const key = fieldKey(sIdx, fIdx);
    const val = formValues[key] ?? "";

    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            value={val}
            onChange={(e) => updateField(sIdx, fIdx, e.target.value)}
            placeholder={field.placeholder || ""}
            rows={3}
            data-testid={`fill-field-${sIdx}-${fIdx}`}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={val}
            onChange={(e) => updateField(sIdx, fIdx, e.target.value)}
            placeholder={field.placeholder || ""}
            data-testid={`fill-field-${sIdx}-${fIdx}`}
          />
        );
      case "email":
        return (
          <Input
            type="email"
            value={val}
            onChange={(e) => updateField(sIdx, fIdx, e.target.value)}
            placeholder={field.placeholder || ""}
            data-testid={`fill-field-${sIdx}-${fIdx}`}
          />
        );
      case "phone":
        return (
          <Input
            type="tel"
            value={val}
            onChange={(e) => updateField(sIdx, fIdx, e.target.value)}
            placeholder={field.placeholder || ""}
            data-testid={`fill-field-${sIdx}-${fIdx}`}
          />
        );
      case "date": {
        const sectionFields = sections[sIdx]?.fields || [];
        const label = (field.label || "").toLowerCase();
        const startKw = ["start date", "begin date", "from date", "first day", "start of leave", "leave start", "absence start", "departure date", "pto start", "time off start", "days off start", "vacation start"];
        const endKw = ["end date", "return date", "to date", "last day", "end of leave", "leave end", "absence end", "pto end", "time off end", "days off end", "vacation end"];
        const isStart = startKw.some((k) => label.includes(k));
        const isEnd = endKw.some((k) => label.includes(k));

        let businessDaysBadge = null;
        if (isStart || isEnd) {
          const pairKw = isStart ? endKw : startKw;
          const pairIdx = sectionFields.findIndex((f: any) => {
            const l = (f.label || "").toLowerCase();
            return f.type === "date" && pairKw.some((k) => l.includes(k));
          });
          if (pairIdx >= 0) {
            const pairVal = formValues[fieldKey(sIdx, pairIdx)] || "";
            if (pairVal && val) {
              const startVal = isStart ? val : pairVal;
              const endVal = isStart ? pairVal : val;
              const days = calcBusinessDays(startVal, endVal);
              if (days > 0) {
                businessDaysBadge = (
                  <div className="mt-1.5 flex items-center gap-2" data-testid={`fill-business-days-${sIdx}-${fIdx}`}>
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs gap-1">
                      <Clock className="h-3 w-3" /> {days} business day{days !== 1 ? "s" : ""} (Mon-Fri)
                    </Badge>
                  </div>
                );
              }
            }
          }
        }

        return (
          <div>
            <Input
              type="date"
              value={val}
              onChange={(e) => updateField(sIdx, fIdx, e.target.value)}
              data-testid={`fill-field-${sIdx}-${fIdx}`}
            />
            {businessDaysBadge}
          </div>
        );
      }
      case "time":
        return (
          <Input
            type="time"
            value={val}
            onChange={(e) => updateField(sIdx, fIdx, e.target.value)}
            data-testid={`fill-field-${sIdx}-${fIdx}`}
          />
        );
      case "select":
        return (
          <Select value={val} onValueChange={(v) => updateField(sIdx, fIdx, v)}>
            <SelectTrigger data-testid={`fill-field-${sIdx}-${fIdx}`}>
              <SelectValue placeholder={field.placeholder || "Select an option..."} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        if (Array.isArray(field.options) && field.options.length > 0) {
          const checked: string[] = val || [];
          return (
            <div className="space-y-2">
              {field.options.map((opt: string) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={checked.includes(opt)}
                    onCheckedChange={(c) => {
                      const next = c ? [...checked, opt] : checked.filter((v: string) => v !== opt);
                      updateField(sIdx, fIdx, next);
                    }}
                    data-testid={`fill-checkbox-${sIdx}-${fIdx}-${opt}`}
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          );
        }
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={!!val}
              onCheckedChange={(c) => updateField(sIdx, fIdx, !!c)}
              data-testid={`fill-field-${sIdx}-${fIdx}`}
            />
            <span className="text-sm">{field.placeholder || "Check if applicable"}</span>
          </label>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt: string) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={key}
                  value={opt}
                  checked={val === opt}
                  onChange={() => updateField(sIdx, fIdx, opt)}
                  className="h-4 w-4 text-primary"
                  data-testid={`fill-radio-${sIdx}-${fIdx}-${opt}`}
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "signature":
        return (
          <SignaturePad
            value={val || ""}
            onChange={(dataUrl) => updateField(sIdx, fIdx, dataUrl)}
            testId={`fill-field-${sIdx}-${fIdx}`}
          />
        );
      case "file":
        return (
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground" data-testid={`fill-field-${sIdx}-${fIdx}`}>
            <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
            File upload area
          </div>
        );
      case "address":
        return (
          <div className="space-y-2">
            <Input value={val?.street || ""} onChange={(e) => updateField(sIdx, fIdx, { ...val, street: e.target.value })} placeholder="Street Address" data-testid={`fill-field-${sIdx}-${fIdx}-street`} />
            <div className="grid grid-cols-3 gap-2">
              <Input value={val?.city || ""} onChange={(e) => updateField(sIdx, fIdx, { ...val, city: e.target.value })} placeholder="City" data-testid={`fill-field-${sIdx}-${fIdx}-city`} />
              <Input value={val?.state || ""} onChange={(e) => updateField(sIdx, fIdx, { ...val, state: e.target.value })} placeholder="State" data-testid={`fill-field-${sIdx}-${fIdx}-state`} />
              <Input value={val?.zip || ""} onChange={(e) => updateField(sIdx, fIdx, { ...val, zip: e.target.value })} placeholder="ZIP" data-testid={`fill-field-${sIdx}-${fIdx}-zip`} />
            </div>
          </div>
        );
      default:
        return (
          <Input
            value={val}
            onChange={(e) => updateField(sIdx, fIdx, e.target.value)}
            placeholder={field.placeholder || ""}
            data-testid={`fill-field-${sIdx}-${fIdx}`}
          />
        );
    }
  };

  const handleSubmit = () => {
    toast({ title: "Form submitted!", description: "This is a test submission. In production, responses would be saved to the database." });
    setTimeout(() => onSubmitted(), 1500);
  };

  return (
    <div data-testid="view-form-fill">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Test Mode</Badge>
        </div>
        <h1 className="text-2xl font-bold" data-testid="text-form-fill-name">{form.name}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {form.category && <Badge variant="secondary">{form.category}</Badge>}
          {form.purpose && <Badge variant="outline">{form.purpose}</Badge>}
        </div>
        {form.outcome && (
          <p className="text-sm text-muted-foreground mt-2">{form.outcome}</p>
        )}
      </div>

      <div className="space-y-6">
        {sections.map((section: any, sIdx: number) => (
          <Card key={sIdx} className="border-l-4 border-l-primary" data-testid={`fill-section-${sIdx}`}>
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold mb-1">{section.title || `Section ${sIdx + 1}`}</h2>
              {section.description && (
                <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
              )}
              <div className="space-y-4">
                {Array.isArray(section.fields) && section.fields.map((field: any, fIdx: number) => (
                  <div key={fIdx}>
                    <Label className="text-sm font-medium">
                      {field.label || `Field ${fIdx + 1}`}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1">{field.helpText}</p>
                    )}
                    <div className="mt-1">
                      {renderField(field, sIdx, fIdx)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mt-6 pb-8">
        <Button variant="outline" onClick={() => setFormValues({})} className="gap-2" data-testid="button-clear-form">
          <RefreshCw className="h-4 w-4" /> Clear Form
        </Button>
        <Button onClick={handleSubmit} className="gap-2" data-testid="button-submit-form">
          <Send className="h-4 w-4" /> Submit (Test)
        </Button>
      </div>
    </div>
  );
}

function UpdateExisting() {
  return (
    <div data-testid="view-update-existing">
      <SectionHeader icon={RefreshCw} title="Update an Existing Form" description="Select a published form to edit its fields, settings, or layout." />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search for a form to update..." className="pl-9" data-testid="input-search-update" />
        </div>
      </div>
      <EmptyState icon={RefreshCw} message="No forms available to update" submessage="Published forms will appear here so you can make changes." />
    </div>
  );
}

function FormDrafts() {
  return (
    <div data-testid="view-form-drafts">
      <SectionHeader icon={FileEdit} title="Form Drafts" description="Pick up where you left off. Your unfinished forms are saved here." />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search drafts..." className="pl-9" data-testid="input-search-drafts" />
        </div>
      </div>
      <EmptyState icon={Clock} message="No drafts yet" submessage="When you start building a form and save it as a draft, it will show up here." />
    </div>
  );
}

function ShareForms() {
  return (
    <div data-testid="view-share-forms">
      <SectionHeader icon={Share2} title="Share Forms" description="Send forms to employees, customers, or anyone who needs to fill them out." />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search forms to share..." className="pl-9" data-testid="input-search-share" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Copy Link", desc: "Get a shareable link to the form", icon: Link2 },
          { label: "Email Form", desc: "Send directly via email", icon: Mail },
          { label: "Duplicate & Share", desc: "Make a copy and share it separately", icon: Copy },
        ].map((item) => (
          <Card key={item.label} className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.02]" data-testid={`card-share-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-lg bg-cyan-100 p-2 mt-0.5"><item.icon className="h-5 w-5 text-cyan-700" /></div>
              <div>
                <div className="font-semibold">{item.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <EmptyState icon={Send} message="No forms to share yet" submessage="Build and publish a form first, then you can share it from here." />
    </div>
  );
}

function BuildPacket() {
  return (
    <div data-testid="view-build-packet">
      <SectionHeader icon={Package} title="Build a Packet" description="Bundle multiple forms together into a single packet for onboarding, safety training, or any multi-form workflow." />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Button className="gap-2" data-testid="button-new-packet"><Plus className="h-4 w-4" /> Create New Packet</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[
          { label: "New Hire Packet", desc: "Combine all onboarding forms into one packet" },
          { label: "Safety Packet", desc: "Bundle safety checklists and compliance forms" },
          { label: "Customer Packet", desc: "Group customer intake and agreement forms" },
          { label: "Custom Packet", desc: "Pick and choose any forms to bundle together" },
        ].map((item) => (
          <Card key={item.label} className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.02]" data-testid={`card-packet-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-lg bg-rose-100 p-2 mt-0.5"><Layers className="h-5 w-5 text-rose-700" /></div>
              <div>
                <div className="font-semibold">{item.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <EmptyState icon={Package} message="No packets created yet" submessage="Create a packet to bundle multiple forms together." />
    </div>
  );
}

function DiscontinuedForms() {
  return (
    <div data-testid="view-discontinued">
      <SectionHeader icon={XCircle} title="Discontinued Forms" description="Forms that have been retired or archived. You can restore them if needed." />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search discontinued forms..." className="pl-9" data-testid="input-search-discontinued" />
        </div>
      </div>
      <EmptyState icon={Archive} message="No discontinued forms" submessage="When you retire a form, it will be moved here for safekeeping." />
    </div>
  );
}
