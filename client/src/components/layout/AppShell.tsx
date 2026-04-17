import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import type { CompanySettings } from "@shared/schema";
import AIAssistantPanel from "@/components/AIAssistantPanel";
import UpdatesPopup from "@/components/UpdatesPopup";
import GlobalMicButton from "@/components/GlobalMicButton";
import TimeClock from "@/components/TimeClock";
import CalendarPage from "@/pages/Calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  LayoutDashboard, 
  BookOpen, 
  Hammer, 
  Users, 
  Megaphone, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  Search,
  GraduationCap,
  Building2,
  User,
  Shield,
  Mail,
  Inbox,
  Truck,
  Info,
  ClipboardCheck,
  ClipboardList,
  CheckSquare,
  Snowflake,
  BellRing,
  Brain,
  CalendarCheck,
  X,
  LifeBuoy,
  Languages,
  Contact,
  Timer,
  Briefcase,
  Calculator,
  Sun,
  Cog,
  CalendarClock,
  BarChart2,
  TrendingUp,
  BookMarked,
  Clock,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import WorksheetWidget from "@/components/WorksheetWidget";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation, effectiveRole, previewRole } = useAuth();
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const sidebarNavRef = React.useRef<HTMLDivElement>(null);
  const sidebarScrollPosition = React.useRef<number>(0);
  const [isUpdatesOpen, setIsUpdatesOpen] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  const menuHelpContent: Record<string, { title: string; description: string; tips: string[] }> = {
    dashboard: {
      title: t("nav.myWorkspace"),
      description: "Your home base with quick access tiles to all major features.",
      tips: ["Click any tile to navigate", "Workspace adapts to your role", "Use sidebar for quick navigation"]
    },
    sops: {
      title: t("nav.sopLibrary"),
      description: "Store and organize Standard Operating Procedures for any process.",
      tips: ["Organize by category", "Add detailed steps", "Team can reference anytime"]
    },
    testing: {
      title: t("nav.quizzes"),
      description: "Take quizzes generated from SOPs to test and build your knowledge.",
      tips: ["Quizzes are auto-generated from SOPs", "Track your scores over time", "Retake to improve"]
    },
    todos: {
      title: t("nav.tasks"),
      description: "Manage tasks with priorities, due dates, and assignments.",
      tips: ["Set priorities and due dates", "Assign tasks to team members", "Track completion status"]
    },
    materials: {
      title: t("nav.materials"),
      description: "Track inventory, stock levels, pricing, and supplier info.",
      tips: ["Set minimum stock levels", "Track costs for estimates", "Categorize for easy search"]
    },
    equipment: {
      title: t("nav.equipment"),
      description: "Manage vehicles, mowers, trailers and schedule maintenance.",
      tips: ["Track mileage and hours", "Set maintenance schedules", "Log completed maintenance"]
    },
    hiring: {
      title: t("nav.hiring"),
      description: "Manage recruitment from application to hire with drag-and-drop stages.",
      tips: ["Drag candidates between stages", "Upload documents", "Rate candidates with colored dots"]
    },
    employees: {
      title: t("nav.employees"),
      description: "View and manage employee profiles, documents, and onboarding.",
      tips: ["Track employee details", "Manage onboarding forms", "Upload and share documents"]
    },
    jobs: {
      title: t("nav.work"),
      description: "Track all projects from lead to completion with customizable tabs.",
      tips: ["Use tabs for job types", "Upload permits and contracts", "Track with Google Maps"]
    },
    daily_worksheet: {
      title: "Daily Worksheet",
      description: "Field reporting tool for daily crew activity, materials, chemicals, and equipment used on the job.",
      tips: ["Save drafts and submit when complete", "Email report sent to all admins/managers on submit", "Tracks chemicals, equipment, and crew hours"]
    },
    education: {
      title: t("nav.resourceLibrary"),
      description: "Resource library with care guides, instructions, and documents for customers.",
      tips: ["Create guides and instructions", "Upload manufacturer documents", "Customers can bookmark favorites"]
    },
    help: {
      title: t("nav.help"),
      description: "Access guides, walkthroughs, and FAQs for using Company HQ.",
      tips: ["Start interactive walkthrough", "Browse FAQs", "Role-specific guidance"]
    },
    hq: {
      title: t("nav.companyHQ"),
      description: "Overview of your company's central hub and settings.",
      tips: ["View company stats", "Access key metrics", "Central information hub"]
    },
    marketing: {
      title: t("nav.marketing"),
      description: "Track marketing campaigns, spend, and lead generation.",
      tips: ["Log campaign details", "Track ROI", "Monitor lead sources"]
    },
    forms: {
      title: t("nav.forms"),
      description: "Build custom forms for applications, surveys, and data collection.",
      tips: ["Drag-and-drop builder", "Multiple field types", "Review submissions"]
    },
    inbox: {
      title: t("nav.messages"),
      description: "View and respond to customer messages and inquiries.",
      tips: ["Track message status", "Reply to customers", "Mark as read/replied"]
    },
    integrations: {
      title: t("nav.integrations"),
      description: "Connect third-party tools like QuickBooks, CompanyCam, and more.",
      tips: ["Coming soon", "Connect business tools", "Sync data automatically"]
    },
    admin: {
      title: t("nav.adminPanel"),
      description: "Manage users, approve access requests, and configure settings.",
      tips: ["Create user accounts", "Approve role requests", "Company branding"]
    },
    tools: {
      title: t("nav.tools"),
      description: "Access specialized tools for landscape work.",
      tips: ["Material calculators & converters", "Map plow routes", "AI-powered analysis"]
    },
    customer_portal: {
      title: "Customer Portal",
      description: "Your dedicated area to communicate and request services.",
      tips: ["Send messages", "Request work", "Track request status"]
    },
    customer_messages: {
      title: t("nav.messages"),
      description: "Communicate directly with our team.",
      tips: ["Start conversations", "Track message status", "Get notified of replies"]
    },
    customer_account: {
      title: t("nav.myAccount"),
      description: "View and update your account information.",
      tips: ["Update contact info", "Request role upgrades", "Manage preferences"]
    },
    customer_help: {
      title: t("nav.help"),
      description: "Get assistance with using the customer portal.",
      tips: ["View guides", "Contact support", "FAQ answers"]
    },
    applicant_portal: {
      title: t("nav.myApplication"),
      description: "Track your job application status and required documents.",
      tips: ["View hiring progress", "Upload required documents", "See next steps"]
    },
    calendar: {
      title: t("nav.calendar"),
      description: "Schedule and manage events, jobs, and meetings with Google Calendar sync.",
      tips: ["Create personal or company events", "Sync with Google Calendar", "Assign events to team members"]
    }
  };

  // Reset main content scroll to top when navigating between pages
  // But preserve sidebar scroll position
  React.useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    // Restore sidebar scroll position after navigation
    if (sidebarNavRef.current) {
      sidebarNavRef.current.scrollTop = sidebarScrollPosition.current;
    }
  }, [location]);

  // Save sidebar scroll position when it changes
  const handleSidebarScroll = React.useCallback(() => {
    if (sidebarNavRef.current) {
      sidebarScrollPosition.current = sidebarNavRef.current.scrollTop;
    }
  }, []);

  // Role-based search suggestions - comprehensive list
  const getSuggestions = () => {
    const suggestions: { label: string; example: string }[] = [];
    const role = effectiveRole;
    
    if (role !== "Customer") {
      suggestions.push(
        { label: t("nav.sopLibrary"), example: "safety procedures" },
        { label: t("nav.materials"), example: "mulch, pavers, SKU" },
        { label: t("nav.equipment"), example: "truck, mower, VIN" },
        { label: t("nav.work"), example: "client name or address" },
        { label: "Candidates", example: "applicant name" }
      );
    }
    if (role === "Admin" || role === "Manager") {
      suggestions.push({ label: t("nav.marketing"), example: "marketing campaign" });
    }
    if (role === "Admin") {
      suggestions.push(
        { label: "Users", example: "team member name" },
        { label: t("nav.forms"), example: "form title" }
      );
    }
    // Resources searchable by all users including customers
    suggestions.push({ label: t("nav.resources"), example: "lawn care guides" });
    
    if (role === "Customer") {
      suggestions.push({ label: "Your Messages", example: "message subject" });
    }
    return suggestions;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      // Use window.location for reliable navigation with query params
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
  });

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
    staleTime: 60000,
  });

  const { data: todoActiveStatus } = useQuery<{ isActive: boolean; unreadCount: number }>({
    queryKey: ["/api/todo-active-status"],
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: unseenUpdates = [] } = useQuery<{ id: string }[]>({
    queryKey: ["/api/updates/unseen"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: staffNotifCount } = useQuery<{ count: number }>({
    queryKey: ["/api/staff-notifications/unread-count"],
    staleTime: 30000,
    refetchInterval: 30000,
    enabled: !!user && user.role !== "Customer",
  });

  const { data: activityUnseenCount } = useQuery<{ count: number }>({
    queryKey: ["/api/activity-log/unseen-count"],
    staleTime: 30000,
    refetchInterval: 30000,
    enabled: !!user && user.role !== "Customer",
  });

  const totalBellCount = (unseenUpdates.length || 0) + (staffNotifCount?.count || 0) + (activityUnseenCount?.count || 0);

  const getLogoClasses = () => {
    const shape = companySettings?.logoShape || "square";
    const cornerRadius = companySettings?.logoCornerRadius || 0;
    
    let shapeClass = "";
    if (shape === "circle") {
      shapeClass = "rounded-full";
    } else if (cornerRadius > 0) {
      if (cornerRadius <= 4) shapeClass = "rounded";
      else if (cornerRadius <= 8) shapeClass = "rounded-md";
      else if (cornerRadius <= 12) shapeClass = "rounded-lg";
      else shapeClass = "rounded-xl";
    }
    
    const sizeClass = shape === "rectangle" ? "h-16 w-28" : "h-16 w-16";
    
    return { shapeClass, sizeClass };
  };

  const customerNav = [
    { id: "customer_hub", icon: LayoutDashboard, label: t("nav.myPortal"), href: "/customer-hub" },
    ...(user?.isApplicant ? [{ id: "applicant_portal", icon: ClipboardCheck, label: t("nav.myApplication"), href: "/applicant" }] : []),
    { id: "customer_resources", icon: GraduationCap, label: t("nav.resources"), href: "/education" },
    { id: "customer_account", icon: User, label: t("nav.myAccount"), href: "/profile" },
    { id: "customer_help", icon: LifeBuoy, label: t("nav.help"), href: "/help" },
  ];

  const internalNavItems: Record<string, { icon: any; label: string; href: string }> = {
    dashboard: { icon: LayoutDashboard, label: t("nav.myWorkspace"), href: "/" },
    applicant_portal: { icon: ClipboardCheck, label: t("nav.myApplication"), href: "/applicant" },
    sops: { icon: BookOpen, label: t("nav.sopLibrary"), href: "/sops" },
    testing: { icon: Brain, label: t("nav.quizzes"), href: "/testing" },
    materials: { icon: Hammer, label: t("nav.materials"), href: "/materials" },
    equipment: { icon: Truck, label: t("nav.equipment"), href: "/equipment" },
    todos: { icon: CheckSquare, label: t("nav.tasks"), href: "/todos" },
    hiring: { icon: Users, label: t("nav.hiring"), href: "/hiring" },
    employees: { icon: User, label: t("nav.employees"), href: "/employees" },
    my_profile: { icon: User, label: "My Profile", href: "/employees/me" },
    jobs: { icon: Briefcase, label: "Jobs", href: "/jobs" },
    scheduling: { icon: CalendarCheck, label: "Scheduling", href: "/scheduling" },
    my_day: { icon: Sun, label: "My Day", href: "/my-day" },
    my_hours: { icon: Clock, label: "My Hours", href: "/my-hours" },
    estimates: { icon: Calculator, label: "Estimates", href: "/estimates" },
    invoices: { icon: FileText, label: "Invoices", href: "/invoices" },
    customers: { icon: Contact, label: t("nav.customers"), href: "/customers" },
    daily_worksheet: { icon: ClipboardList, label: "Daily Worksheet", href: "/daily-worksheet" },
    time_tracking: { icon: Timer, label: "Time Tracking", href: "/time" },
    consultations: { icon: CalendarClock, label: "Consultations", href: "/consultations" },
    reports: { icon: BarChart2, label: "Reports", href: "/reports" },
    mors_budget: { icon: TrendingUp, label: "MORS Budget", href: "/mors-budget" },
    education: { icon: GraduationCap, label: t("nav.resourceLibrary"), href: "/education" },
    help: { icon: LifeBuoy, label: t("nav.help"), href: "/help" },
    hq: { icon: Building2, label: t("nav.companyHQ"), href: "/hq" },
    marketing: { icon: Megaphone, label: t("nav.marketing"), href: "/marketing" },
    forms: { icon: FileText, label: t("nav.forms"), href: "/forms" },
    inbox: { icon: Mail, label: t("nav.messages"), href: "/inbox" },
    admin: { icon: Shield, label: t("nav.adminPanel"), href: "/admin" },
    catalog: { icon: BookMarked, label: "Item Catalog", href: "/catalog" },
    budget_settings: { icon: DollarSign, label: "Budget & Pricing", href: "/budget-settings" },
    tools: { icon: Snowflake, label: t("nav.tools"), href: "/tools" },
  plow_mapper: { icon: Snowflake, label: t("nav.plowMapper"), href: "/tools/plow-mapper" },
  };

  type NavSection = { label: string; items: string[] };

  const sectionLabels: Record<string, string> = {
    "WORK": t("nav.sections.work"),
    "PEOPLE": t("nav.sections.people"),
    "COMPANY": t("nav.sections.company"),
    "ADMIN": t("nav.sections.admin"),
  };

  const sidebarSections: NavSection[] = [
    { label: "", items: ["dashboard"] },
    { label: "WORK", items: ["customers", "consultations", "estimates", "jobs", "todos", "daily_worksheet", "my_day", "my_hours", "time_tracking", "invoices", "reports", "mors_budget", "scheduling", "equipment"] },
    { label: "PEOPLE", items: ["employees", "education", "hiring"] },
    { label: "COMPANY", items: ["sops", "testing", "hq"] },
    { label: "ADMIN", items: ["admin", "catalog", "budget_settings", "tools", "forms"] },
  ];

  const getSectionsForRole = (role: string): NavSection[] => {
    const isAdmin = role === "Admin" || (user as any)?.isMasterAdmin;
    if (role === "Crew" || role === "New Hire") {
      return sidebarSections
        .filter(s => s.label !== "ADMIN")
        .map(s => ({
          ...s,
          items: s.items
            .filter(i => i !== "hiring" && i !== "mors_budget")
            .map(i => i === "employees" ? "my_profile" : i),
        }));
    }
    if (role === "Crew Lead") {
      return sidebarSections
        .filter(s => s.label !== "ADMIN")
        .map(s => ({
          ...s,
          items: s.items
            .filter(i => i !== "hiring" && i !== "mors_budget")
            .map(i => i === "employees" ? "my_profile" : i),
        }));
    }
    if (role === "Manager" || role === "HR" || role === "Sales") {
      return sidebarSections
        .filter(s => s.label !== "ADMIN")
        .map(s => ({
          ...s,
          items: s.items
            .filter(i => i !== "hiring" && (!isAdmin && i === "mors_budget" ? false : true))
            .map(i => i === "employees" ? "my_profile" : i),
        }));
    }
    // Admin / Master Admin: full access
    return sidebarSections;
  };

  const getNavSections = (): { sections: NavSection[]; applicantItem?: { id: string; icon: any; label: string; href: string } } => {
    if (effectiveRole === "Customer") {
      return { sections: [] };
    }
    const sections = getSectionsForRole(effectiveRole || "Crew");
    const applicantItem = user?.isApplicant ? { id: "applicant_portal", ...internalNavItems["applicant_portal"] } : undefined;
    return { sections, applicantItem };
  };

  const { sections: displaySections, applicantItem } = getNavSections();
  const displayNav = effectiveRole === "Customer" 
    ? customerNav 
    : displaySections.flatMap(s => s.items.filter(id => internalNavItems[id]).map(id => ({ id, ...internalNavItems[id] })));

  const getIsActive = (item: { id: string; href: string }) => {
    if (item.href === "/tools" && item.id === "tools") {
      return location.startsWith("/tools");
    }
    if (item.href === "/employees") {
      return location === "/employees";
    }
    return location === item.href;
  };

  const NavContent = ({ isMobileSheet = false }: { isMobileSheet?: boolean } = {}) => {
    const { shapeClass, sizeClass } = getLogoClasses();
    const hasLogo = !!companySettings?.logoUrl;
    
    return (
    <div className="sidebar-themed flex flex-col h-full text-sidebar-foreground">
      <div className="p-6 pb-8 border-b border-sidebar-border">
        <a 
          href="/" 
          className="flex flex-col items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
          data-testid="link-logo-home"
        >
          <img 
            src={hasLogo ? companySettings.logoUrl! : "/images/companyhq-logo.png"} 
            alt="Company Logo - Click to go home"
            className={cn("object-cover shrink-0", hasLogo ? sizeClass : "h-16 w-16", hasLogo ? shapeClass : "rounded-lg")}
          />
          <div className="text-center">
            <h1 className="font-heading font-bold text-lg leading-tight text-sidebar-foreground">
              {companySettings?.companyName || "Company HQ"}
            </h1>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Landscape Management</p>
          </div>
        </a>
      </div>

      <div 
        ref={sidebarNavRef}
        onScroll={handleSidebarScroll}
        className="flex-1 py-4 px-3 overflow-y-auto"
      >
        {applicantItem && (
          <div className="mb-2">
            <Link href={applicantItem.href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg font-semibold transition-all cursor-pointer",
                  "border border-white/5 shadow-sm",
                  "bg-gradient-to-b from-white/[0.08] to-transparent",
                  "h-9 px-4 text-[13px] leading-[16px]",
                  location === applicantItem.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)] border-sidebar-primary/50"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.2)] hover:border-white/10"
                )}
                onClick={() => setIsMobileOpen(false)}
              >
                <applicantItem.icon className="h-4 w-4" />
                {applicantItem.label}
              </div>
            </Link>
          </div>
        )}
        {effectiveRole !== "Customer" ? displaySections.map((section, sectionIdx) => (
          <div key={section.label || "workspace"} className={cn(sectionIdx > 0 ? "mt-4" : "")}>
            {section.label && (
              <div className="px-4 py-1.5 mb-1">
                <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-sidebar-foreground/40" data-testid={`section-header-${section.label.toLowerCase().replace(' ', '-')}`}>
                  {sectionLabels[section.label] || section.label}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.filter(id => internalNavItems[id]).map((itemId) => {
                const item = { id: itemId, ...internalNavItems[itemId] };
                const isActive = getIsActive(item);
                const helpContent = menuHelpContent[item.id];
                const showTodoBadge = item.id === "todos" && todoActiveStatus?.isActive && todoActiveStatus.unreadCount > 0;
                return (
                  <div key={item.id} className="flex items-center group w-full">
                    <Link href={item.href} className="flex-1 min-w-0 block" style={{ height: 36, overflow: 'hidden' }}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg font-semibold transition-all cursor-pointer",
                          "border border-white/5 shadow-sm",
                          "bg-gradient-to-b from-white/[0.08] to-transparent",
                          "px-4 text-[13px]",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] border-sidebar-primary/50"
                            : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-white/10"
                        )}
                        style={{ height: 36, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12 }}
                        onClick={() => {
                          if (location === item.href) {
                            window.dispatchEvent(new CustomEvent("forms-nav-reset"));
                          }
                          setIsMobileOpen(false);
                        }}
                      >
                        <div className="relative" style={{ flexShrink: 0 }}>
                          <item.icon className="h-4 w-4" />
                          {showTodoBadge && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              {todoActiveStatus.unreadCount > 9 ? "9+" : todoActiveStatus.unreadCount}
                            </span>
                          )}
                        </div>
                        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 }}>{item.label}</span>
                      </div>
                    </Link>
                    {helpContent ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button 
                            className="p-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="w-72 p-4">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">{helpContent.title}</h4>
                            <p className="text-sm text-muted-foreground">{helpContent.description}</p>
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">Tips:</p>
                              <ul className="space-y-1">
                                {helpContent.tips.map((tip, i) => (
                                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                    <span className="text-primary mt-0.5">•</span>
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div style={{ width: 22, height: 22, flexShrink: 0 }} aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )) : customerNav.map((item) => {
          const isActive = location === item.href;
          return (
            <div key={item.href} className="flex items-center group w-full mb-0.5">
              <Link href={item.href} className="flex-1 min-w-0 block">
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg font-semibold transition-all cursor-pointer",
                    "border border-white/5 shadow-sm",
                    "bg-gradient-to-b from-white/[0.08] to-transparent",
                    "px-4 text-[13px]",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)] border-sidebar-primary/50"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.2)] hover:border-white/10"
                  )}
                  style={{ height: 36, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12 }}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <item.icon className="h-4 w-4" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 }}>{item.label}</span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>


      <div className="mt-auto p-4 border-t-2 border-primary/20 bg-gradient-to-t from-primary/5 to-transparent">
        {isMobileSheet ? (
          /* Mobile sheet: direct links — avoids Radix portal z-index issues on Android */
          <div className="space-y-0.5">
            <div className="flex items-center gap-3 px-2 py-2 mb-1">
              <Avatar className="h-8 w-8 border border-white/20 shrink-0">
                <AvatarFallback className="bg-primary/20 text-xs font-bold">
                  {user?.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <p className="text-sm font-bold truncate leading-none mb-1 text-sidebar-foreground">
                  {user?.name || user?.username}
                </p>
                <p className="text-[10px] font-medium opacity-60 uppercase tracking-wider truncate text-sidebar-foreground">
                  {previewRole || effectiveRole || user?.role}
                </p>
              </div>
            </div>
            <Link href="/profile">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 text-sidebar-foreground transition-colors"
                onClick={() => setIsMobileOpen(false)}
                data-testid="link-profile-mobile"
              >
                <User className="h-4 w-4 opacity-70 shrink-0" />
                {t("nav.myProfile")}
              </button>
            </Link>
            <Link href="/settings">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 text-sidebar-foreground transition-colors"
                onClick={() => setIsMobileOpen(false)}
                data-testid="link-settings-mobile"
              >
                <Settings className="h-4 w-4 opacity-70 shrink-0" />
                {t("nav.settings")}
              </button>
            </Link>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 text-red-400 transition-colors"
              onClick={() => { setIsMobileOpen(false); logoutMutation.mutate(); }}
              disabled={logoutMutation.isPending}
              data-testid="button-logout-mobile"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("nav.logOut")}
            </button>
          </div>
        ) : (
          /* Desktop: direct navigation — no dropdown */
          <div className="w-full flex items-center gap-2">
            <Link href="/profile" className="flex-1 min-w-0">
              <div
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-sidebar-foreground transition-colors cursor-pointer"
                data-testid="button-user-profile"
              >
                <Avatar className="h-8 w-8 border border-white/20 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-xs font-bold">
                    {user?.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0">
                  <p className="text-sm font-bold truncate leading-none mb-1">
                    {user?.name || user?.username}
                  </p>
                  <p className="text-[10px] font-medium opacity-60 uppercase tracking-wider truncate">
                    {previewRole || effectiveRole || user?.role}
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/settings">
              <button
                className="p-1 rounded-lg hover:bg-white/10 text-sidebar-foreground transition-colors shrink-0"
                data-testid="link-settings"
              >
                <Settings className="h-8 w-8 opacity-40 shrink-0" />
              </button>
            </Link>
            <button
              className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-8 w-8 shrink-0" />
            </button>
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-[260px] border-r border-sidebar-border bg-sidebar overflow-hidden">
        <NavContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header - Desktop & Mobile */}
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 lg:px-6 z-30 shrink-0">
          <div className="flex items-center gap-4 lg:hidden">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px] border-r-0">
                <NavContent isMobileSheet={true} />
              </SheetContent>
            </Sheet>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg tracking-tight">HQ</span>
            </Link>
          </div>

          <div className="hidden lg:flex items-center flex-1 max-w-xl mx-4 relative" ref={searchRef}>
            <form onSubmit={handleSearch} className="w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder={t("common.searchPlaceholder")}
                className="w-full h-10 pl-10 pr-4 bg-muted/50 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                data-testid="input-global-search"
              />
            </form>
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-popover border rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  Try searching for:
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {getSuggestions().map((suggestion, i) => (
                    <button
                      key={i}
                      className="flex flex-col items-start p-2 rounded-lg hover:bg-muted transition-colors text-left"
                      onClick={() => {
                        setSearchQuery(suggestion.label);
                        setShowSuggestions(false);
                        window.location.href = `/search?q=${encodeURIComponent(suggestion.label)}`;
                      }}
                    >
                      <span className="text-xs font-semibold">{suggestion.label}</span>
                      <span className="text-[10px] text-muted-foreground truncate w-full">e.g. {suggestion.example}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2">
            <GlobalMicButton />
            <TimeClock />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="relative h-11 w-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all duration-200"
                    onClick={() => setIsUpdatesOpen(true)}
                    data-testid="button-updates"
                  >
                    <BellRing className="h-[22px] w-[22px] drop-shadow-sm" strokeWidth={2.25} />
                    {totalBellCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-background px-1 shadow-sm">
                        {totalBellCount > 9 ? '9+' : totalBellCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("nav.updates")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="h-11 w-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all duration-200"
                    onClick={() => setIsCalendarOpen(true)}
                    data-testid="button-calendar"
                  >
                    <CalendarCheck className="h-[22px] w-[22px] drop-shadow-sm" strokeWidth={2.25} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("nav.calendar")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-11 w-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-105 active:scale-95 transition-all duration-200">
                  <Languages className="h-[22px] w-[22px] drop-shadow-sm" strokeWidth={2.25} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuLabel>{t("profile.language")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className={cn("cursor-pointer justify-between", i18n.language === "en" && "bg-muted font-bold")}
                  onClick={() => i18n.changeLanguage("en")}
                >
                  English {i18n.language === "en" && <CheckSquare className="h-3 w-3" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className={cn("cursor-pointer justify-between", i18n.language === "es" && "bg-muted font-bold")}
                  onClick={() => i18n.changeLanguage("es")}
                >
                  Español {i18n.language === "es" && <CheckSquare className="h-3 w-3" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </header>

        {/* Dynamic Content Container */}
        <main 
          ref={contentRef}
          className="flex-1 overflow-y-auto bg-muted/5 p-4 lg:p-8 relative"
        >
          {children}
          <AIAssistantPanel />
        </main>

        {/* Global Popups */}
        <UpdatesPopup 
          isOpen={isUpdatesOpen} 
          onClose={() => setIsUpdatesOpen(false)} 
        />

        <Sheet open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <SheetContent side="right" className="p-0 sm:max-w-[1000px] w-full border-l shadow-2xl">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <CalendarCheck className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-bold">{t("calendar.title")}</h2>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <CalendarPage />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <WorksheetWidget />
    </div>
  );
}
