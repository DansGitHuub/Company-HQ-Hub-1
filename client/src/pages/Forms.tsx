import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FilePlus2,
  Library,
  RefreshCw,
  FileEdit,
  Share2,
  Package,
  XCircle,
  ArrowLeft,
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
  RotateCcw,
  Layers,
} from "lucide-react";

type View =
  | "home"
  | "build-new"
  | "form-library"
  | "update-existing"
  | "form-drafts"
  | "share-forms"
  | "build-packet"
  | "discontinued";

export default function Forms() {
  const [view, setView] = useState<View>("home");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (view === "home") {
    return <FormsHome onNavigate={setView} hoveredId={hoveredId} setHoveredId={setHoveredId} />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="forms-page">
      <button
        onClick={() => setView("home")}
        className="mb-6 inline-flex items-center gap-2.5 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 hover:shadow-md transition-all"
        data-testid="button-back"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Forms
      </button>

      {view === "build-new" && <BuildNewForm />}
      {view === "form-library" && <FormLibrary />}
      {view === "update-existing" && <UpdateExisting />}
      {view === "form-drafts" && <FormDrafts />}
      {view === "share-forms" && <ShareForms />}
      {view === "build-packet" && <BuildPacket />}
      {view === "discontinued" && <DiscontinuedForms />}
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
    {
      id: "form-library",
      label: "Form Library",
      description: "Browse and manage all your published forms",
      icon: Library,
      color: "from-blue-500 to-blue-700",
      hoverColor: "from-blue-600 to-blue-800",
    },
    {
      id: "update-existing",
      label: "Update an Existing Form",
      description: "Edit and modify forms that are already in use",
      icon: RefreshCw,
      color: "from-violet-500 to-violet-700",
      hoverColor: "from-violet-600 to-violet-800",
    },
    {
      id: "form-drafts",
      label: "Form Drafts",
      description: "Continue working on forms you haven't finished yet",
      icon: FileEdit,
      color: "from-amber-500 to-amber-700",
      hoverColor: "from-amber-600 to-amber-800",
    },
    {
      id: "share-forms",
      label: "Share Forms",
      description: "Send forms to employees, customers, or external contacts",
      icon: Share2,
      color: "from-cyan-500 to-cyan-700",
      hoverColor: "from-cyan-600 to-cyan-800",
    },
    {
      id: "build-packet",
      label: "Build a Packet",
      description: "Bundle multiple forms together into a single packet",
      icon: Package,
      color: "from-rose-500 to-rose-700",
      hoverColor: "from-rose-600 to-rose-800",
    },
    {
      id: "discontinued",
      label: "Discontinued Forms",
      description: "View and restore forms that have been retired",
      icon: XCircle,
      color: "from-slate-500 to-slate-700",
      hoverColor: "from-slate-600 to-slate-800",
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="forms-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-forms-title">Forms</h1>

      <button
        onClick={() => onNavigate(topButton.id)}
        className={`w-full mb-6 rounded-2xl bg-gradient-to-br ${
          hoveredId === topButton.id ? topButton.hoverColor : topButton.color
        } p-8 text-white text-left transition-all duration-200 ${
          hoveredId === topButton.id ? "scale-[1.01] shadow-xl" : "shadow-lg"
        }`}
        onMouseEnter={() => setHoveredId(topButton.id)}
        onMouseLeave={() => setHoveredId(null)}
        data-testid={`button-${topButton.id}`}
      >
        <div className="flex items-center gap-4">
          <div className={`rounded-xl bg-white/20 p-4 transition-transform duration-200 ${
            hoveredId === topButton.id ? "scale-110" : ""
          }`}>
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
            className={`rounded-2xl bg-gradient-to-br ${
              hoveredId === btn.id ? btn.hoverColor : btn.color
            } p-6 text-white text-left transition-all duration-200 ${
              hoveredId === btn.id ? "scale-[1.02] shadow-xl" : "shadow-lg"
            }`}
            onMouseEnter={() => setHoveredId(btn.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`button-${btn.id}`}
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-xl bg-white/20 p-3 transition-transform duration-200 ${
                hoveredId === btn.id ? "scale-110" : ""
              }`}>
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

function BuildNewForm() {
  return (
    <div data-testid="view-build-new">
      <SectionHeader
        icon={FilePlus2}
        title="Build a New Form"
        description="Create a custom form step by step. Choose a form type to get started."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Sales & Marketing", desc: "Proposals, lead capture, campaign tracking, and client outreach forms", num: 1 },
          { label: "Estimating & Pre-Construction", desc: "Bid sheets, site assessments, material takeoffs, and project scoping", num: 2 },
          { label: "Production & Field Operations", desc: "Work orders, daily logs, crew assignments, and job site checklists", num: 3 },
          { label: "Maintenance Operations", desc: "Service schedules, inspection reports, and recurring maintenance tasks", num: 4 },
          { label: "HR & Employees", desc: "Applications, onboarding, time-off requests, and performance reviews", num: 5 },
          { label: "Finance & Accounting", desc: "Invoices, expense reports, purchase orders, and budget tracking", num: 6 },
          { label: "Equipment & Assets", desc: "Equipment logs, asset tracking, maintenance records, and checkout forms", num: 7 },
          { label: "Compliance & Legal", desc: "Safety audits, incident reports, permits, and regulatory checklists", num: 8 },
          { label: "Customer Experience & Retention", desc: "Surveys, feedback forms, warranty claims, and follow-up checklists", num: 9 },
          { label: "Management & Strategy", desc: "Meeting agendas, goal tracking, KPI reports, and planning worksheets", num: 10 },
          { label: "Checklists", desc: "Step-by-step task lists, daily routines, quality checks, and verification forms", num: 11 },
          { label: "Misc & Other", desc: "General-purpose forms that don't fit into a specific category", num: 12 },
        ].map((item) => (
          <Card
            key={item.label}
            className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.02]"
            data-testid={`card-category-${item.num}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700">
                  {item.num}
                </div>
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FormLibrary() {
  return (
    <div data-testid="view-form-library">
      <SectionHeader
        icon={Library}
        title="Form Library"
        description="Browse, search, and manage all your published forms in one place."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search forms by name or category…" className="pl-9" data-testid="input-search-library" />
        </div>
        <Button variant="outline" className="gap-2" data-testid="button-filter-library">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      <EmptyState
        icon={Library}
        message="Your form library is empty"
        submessage="Build your first form and it will appear here once published."
      />
    </div>
  );
}

function UpdateExisting() {
  return (
    <div data-testid="view-update-existing">
      <SectionHeader
        icon={RefreshCw}
        title="Update an Existing Form"
        description="Select a published form to edit its fields, settings, or layout."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search for a form to update…" className="pl-9" data-testid="input-search-update" />
        </div>
      </div>

      <EmptyState
        icon={RefreshCw}
        message="No forms available to update"
        submessage="Published forms will appear here so you can make changes."
      />
    </div>
  );
}

function FormDrafts() {
  return (
    <div data-testid="view-form-drafts">
      <SectionHeader
        icon={FileEdit}
        title="Form Drafts"
        description="Pick up where you left off. Your unfinished forms are saved here."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search drafts…" className="pl-9" data-testid="input-search-drafts" />
        </div>
      </div>

      <EmptyState
        icon={Clock}
        message="No drafts yet"
        submessage="When you start building a form and save it as a draft, it will show up here."
      />
    </div>
  );
}

function ShareForms() {
  return (
    <div data-testid="view-share-forms">
      <SectionHeader
        icon={Share2}
        title="Share Forms"
        description="Send forms to employees, customers, or anyone who needs to fill them out."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search forms to share…" className="pl-9" data-testid="input-search-share" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Copy Link", desc: "Get a shareable link to the form", icon: Link2 },
          { label: "Email Form", desc: "Send directly via email", icon: Mail },
          { label: "Duplicate & Share", desc: "Make a copy and share it separately", icon: Copy },
        ].map((item) => (
          <Card
            key={item.label}
            className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.02]"
            data-testid={`card-share-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-lg bg-cyan-100 p-2 mt-0.5">
                <item.icon className="h-5 w-5 text-cyan-700" />
              </div>
              <div>
                <div className="font-semibold">{item.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmptyState
        icon={Send}
        message="No forms to share yet"
        submessage="Build and publish a form first, then you can share it from here."
      />
    </div>
  );
}

function BuildPacket() {
  return (
    <div data-testid="view-build-packet">
      <SectionHeader
        icon={Package}
        title="Build a Packet"
        description="Bundle multiple forms together into a single packet for onboarding, safety training, or any multi-form workflow."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Button className="gap-2" data-testid="button-new-packet">
          <Plus className="h-4 w-4" />
          Create New Packet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[
          { label: "New Hire Packet", desc: "Combine all onboarding forms into one packet" },
          { label: "Safety Packet", desc: "Bundle safety checklists and compliance forms" },
          { label: "Customer Packet", desc: "Group customer intake and agreement forms" },
          { label: "Custom Packet", desc: "Pick and choose any forms to bundle together" },
        ].map((item) => (
          <Card
            key={item.label}
            className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.02]"
            data-testid={`card-packet-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-lg bg-rose-100 p-2 mt-0.5">
                <Layers className="h-5 w-5 text-rose-700" />
              </div>
              <div>
                <div className="font-semibold">{item.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmptyState
        icon={Package}
        message="No packets created yet"
        submessage="Create a packet to bundle multiple forms together."
      />
    </div>
  );
}

function DiscontinuedForms() {
  return (
    <div data-testid="view-discontinued">
      <SectionHeader
        icon={XCircle}
        title="Discontinued Forms"
        description="Forms that have been retired or archived. You can restore them if needed."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search discontinued forms…" className="pl-9" data-testid="input-search-discontinued" />
        </div>
      </div>

      <EmptyState
        icon={Archive}
        message="No discontinued forms"
        submessage="When you retire a form, it will be moved here for safekeeping."
      />
    </div>
  );
}
