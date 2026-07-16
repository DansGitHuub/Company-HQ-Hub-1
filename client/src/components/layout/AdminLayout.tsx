import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import AIAssistantPanel from "@/components/AIAssistantPanel";
import {
  ArrowLeft,
  Shield,
  Clock,
  ClipboardList,
  ClipboardCheck,
  Upload,
  Archive,
  AlertTriangle,
  BarChart2,
  Users,
  Megaphone,
  FileSignature,
  Lightbulb,
  Building2,
  Layers,
  Tag,
  FileText,
  DollarSign,
  BookOpen,
  Leaf,
  Zap,
  ExternalLink,
  Wrench,
  CheckCircle,
  Sparkles,
  Bot,
  Puzzle,
  HelpCircle,
  Camera,
  Activity,
  GitMerge,
  Eye,
  AlertCircle,
  ChevronRight,
  SlidersHorizontal,
  FlagTriangleRight,
  MessageSquareWarning,
  Library,
  HeartPulse,
  Brain,
} from "lucide-react";

type AdminNavItem = {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  tab?: string;
};

type AdminNavGroup = {
  id: string;
  label: string;
  labelColor: string;
  items: AdminNavItem[];
};

const ADMIN_GROUPS: AdminNavGroup[] = [
  {
    id: "daily-operations",
    label: "Daily Operations",
    labelColor: "text-green-600 dark:text-green-400",
    items: [
      { value: "overdue", label: "Overdue Items", icon: AlertTriangle, href: "/overdue" },
      { value: "time-reports", label: "Time Reports", icon: ClipboardList, href: "/admin/time-reports" },
      { value: "time-admin", label: "Time Admin", icon: Clock, href: "/admin/time" },
      { value: "worksheet-review", label: "Worksheet Review", icon: ClipboardCheck, href: "/admin/time?tab=worksheet" },
      { value: "qbo-export", label: "QuickBooks Export", icon: Upload, href: "/admin/qbo-export" },
      { value: "archive", label: "Time Archive", icon: Archive, href: "/admin/archive" },
      { value: "maintenance-reports", label: "Maintenance Reports", icon: BarChart2, href: "/admin/maintenance-reports" },
    ],
  },
  {
    id: "people",
    label: "People",
    labelColor: "text-blue-600 dark:text-blue-400",
    items: [
      { value: "users", label: "User Management", icon: Users, tab: "users" },
      { value: "requests", label: "Access Requests", icon: Megaphone, tab: "requests" },
      { value: "agreements", label: "Agreement Templates", icon: FileSignature, tab: "agreements" },
      { value: "suggestions", label: "Customer Suggestions", icon: Lightbulb, tab: "suggestions" },
    ],
  },
  {
    id: "company-settings",
    label: "Company Settings",
    labelColor: "text-purple-600 dark:text-purple-400",
    items: [
      { value: "company", label: "Company Branding", icon: Building2, tab: "company" },
      { value: "divisions", label: "Division Colors", icon: Layers, tab: "divisions" },
      { value: "estimate-templates", label: "Estimate Templates", icon: FileText, tab: "estimate-templates" },
      { value: "terms", label: "Terms & Conditions", icon: FileSignature, tab: "terms" },
      { value: "business-rules", label: "Business Rules", icon: SlidersHorizontal, href: "/admin/business-rules" },
      { value: "feedback-reports", label: "Bug Reports & Feedback", icon: MessageSquareWarning, href: "/admin/feedback" },
      { value: "admin-tools", label: "Admin Tools", icon: Wrench, href: "/tools" },
    ],
  },
  {
    id: "catalogs-integrations",
    label: "Catalogs & Integrations",
    labelColor: "text-teal-600 dark:text-teal-400",
    items: [
      { value: "document-library", label: "Document Library", icon: Library, href: "/admin/documents" },
      { value: "work-areas", label: "Work Areas", icon: Layers, href: "/admin/work-areas" },
      { value: "service-types", label: "Service Types", icon: Tag, href: "/admin/service-types" },
      { value: "quickbooks", label: "QuickBooks Online", icon: DollarSign, tab: "quickbooks" },
      { value: "catalog-link", label: "Item Catalog", icon: BookOpen, href: "/catalog" },
      { value: "plant-cards-link", label: "Plant Library", icon: Leaf, href: "/plant-cards" },
      { value: "cc-reconciliation", label: "CompanyCam Reconciliation Queue", icon: Camera, href: "/admin/companycam-reconciliation" },
      { value: "cc-health", label: "CompanyCam Webhook Health", icon: Activity, href: "/admin/companycam-health" },
    ],
  },
  {
    id: "automation-flags",
    label: "Automation & Flags",
    labelColor: "text-indigo-600 dark:text-indigo-400",
    items: [
      { value: "automation-center", label: "Automation Center", icon: Zap, href: "/admin/automation-center" },
      { value: "feature-flags", label: "Feature Flags", icon: FlagTriangleRight, href: "/admin/feature-flags" },
    ],
  },
  {
    id: "content-sops",
    label: "Content & SOPs",
    labelColor: "text-amber-600 dark:text-amber-400",
    items: [
      { value: "sop-pipeline", label: "SOP Pipeline", icon: Zap, tab: "sop-pipeline" },
      { value: "documents", label: "Document Library", icon: FileText, tab: "documents" },
      { value: "shared-links", label: "External Share Links", icon: ExternalLink, tab: "shared-links" },
    ],
  },
  {
    id: "ai-automation-tools",
    label: "AI & Automation Tools",
    labelColor: "text-fuchsia-600 dark:text-fuchsia-400",
    items: [
      { value: "ai-knowledge", label: "AI Knowledge Base", icon: Brain, href: "/admin/ai-knowledge" },
      { value: "assistant-agents", label: "Assistant Agents", icon: Sparkles, tab: "assistant-agents" },
      { value: "ai-logs", label: "Usage Summary", icon: Bot, tab: "ai-logs" },
      { value: "ai-agents", label: "AI Agents", icon: Bot, tab: "ai-agents" },
      { value: "integration-wizard", label: "Integration Wizard", icon: Puzzle, tab: "integration-wizard" },
    ],
  },
  {
    id: "system-health-data-quality",
    label: "System Health & Data Quality",
    labelColor: "text-slate-600 dark:text-slate-400",
    items: [
      { value: "todos", label: "To-Do User Management", icon: CheckCircle, tab: "todos" },
      { value: "process-auditor", label: "Process Auditor", icon: ClipboardCheck, tab: "process-auditor" },
      { value: "help-reports", label: "Article Reports", icon: HelpCircle, tab: "help-reports" },
      { value: "customer-duplicates", label: "Customer Duplicates", icon: GitMerge, href: "/admin/customer-duplicates" },
      { value: "app-testing", label: "App Testing", icon: Eye, tab: "app-testing" },
      { value: "system-status", label: "System Status", icon: AlertCircle, tab: "system-status" },
      { value: "system-health", label: "System Health", icon: HeartPulse, href: "/admin/system-health" },
      { value: "security-audit-log", label: "Security Audit Log", icon: AlertTriangle, tab: "security-audit-log" },
      { value: "diagnostics", label: "Diagnostics", icon: Wrench, tab: "diagnostics" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "";
  });

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab") || "";
    setActiveTab(tab);
  }, [location]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) setActiveTab(detail.tab);
    };
    window.addEventListener("admin-set-tab", handler);
    return () => window.removeEventListener("admin-set-tab", handler);
  }, []);

  const handleItemClick = (item: AdminNavItem) => {
    if (item.href) {
      navigate(item.href);
      setActiveTab("");
    } else if (item.tab) {
      navigate("/admin?tab=" + item.tab);
      setActiveTab(item.tab);
      window.dispatchEvent(new CustomEvent("admin-set-tab", { detail: { tab: item.tab } }));
    }
  };

  const isItemActive = (item: AdminNavItem): boolean => {
    const cleanLocation = location.split("?")[0];
    if (item.href) {
      const cleanHref = item.href.split("?")[0];
      if (cleanHref === "/admin/time") {
        if (item.value === "time-reports")
          return cleanLocation === "/admin/time" && (window.location.search.includes("tab=reports") || window.location.hash.includes("reports"));
        if (item.value === "worksheet-review")
          return cleanLocation === "/admin/time" && window.location.search.includes("tab=worksheet");
        if (item.value === "time-admin")
          return cleanLocation === "/admin/time" && !window.location.search.includes("tab=reports") && !window.location.search.includes("tab=worksheet");
      }
      return cleanLocation === cleanHref || cleanLocation.startsWith(cleanHref + "/");
    }
    if (item.tab) {
      return cleanLocation === "/admin" && activeTab === item.tab;
    }
    return false;
  };

  let breadcrumbGroup: AdminNavGroup | null = null;
  let breadcrumbItem: AdminNavItem | null = null;
  for (const group of ADMIN_GROUPS) {
    for (const item of group.items) {
      if (isItemActive(item)) {
        breadcrumbGroup = group;
        breadcrumbItem = item;
        break;
      }
    }
    if (breadcrumbItem) break;
  }

  const isOnAdminOverview = location.split("?")[0] === "/admin" && (!activeTab || activeTab === "home");

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <aside
        className="w-56 shrink-0 flex flex-col border-r bg-sidebar overflow-y-auto"
        data-testid="admin-sidebar"
      >
        <div className="px-3 py-3 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center shrink-0">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-sidebar-foreground">Admin Panel</span>
          </div>
          <Link href="/">
            <button
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              data-testid="admin-exit-button"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              Exit Admin
            </button>
          </Link>
        </div>

        <div className="px-3 pt-2">
          <button
            onClick={() => { navigate("/admin"); setActiveTab(""); }}
            data-testid="admin-nav-overview"
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left mb-1",
              isOnAdminOverview
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Shield className="h-3.5 w-3.5 shrink-0 opacity-70" />
            Overview
          </button>
        </div>

        <nav className="flex-1 px-3 pb-4 space-y-0.5">
          {ADMIN_GROUPS.map((group) => (
            <div key={group.id} className="pt-3">
              <p className={cn("text-[10px] font-bold uppercase tracking-wider px-3 pb-1.5", group.labelColor)}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  return (
                    <button
                      key={item.value}
                      onClick={() => handleItemClick(item)}
                      data-testid={`admin-nav-${item.value}`}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="h-12 shrink-0 border-b bg-background/95 backdrop-blur flex items-center px-5 gap-1.5 z-20"
          data-testid="admin-breadcrumb"
        >
          <button
            onClick={() => { navigate("/admin"); setActiveTab(""); }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            data-testid="admin-breadcrumb-home"
          >
            Admin Panel
          </button>
          {breadcrumbGroup && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-sm text-muted-foreground/70">{breadcrumbGroup.label}</span>
            </>
          )}
          {breadcrumbItem && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-sm font-medium text-foreground">{breadcrumbItem.label}</span>
            </>
          )}
          {isOnAdminOverview && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-sm font-medium text-foreground">Overview</span>
            </>
          )}
        </header>

        <main
          id="main-scroll-container"
          className="flex-1 overflow-y-auto bg-muted/5 p-4 lg:p-6"
        >
          {children}
          <AIAssistantPanel />
        </main>
      </div>
    </div>
  );
}
