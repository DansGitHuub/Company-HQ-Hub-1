import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { CompanySettings } from "@shared/schema";
import AIAssistantPanel from "@/components/AIAssistantPanel";
import UpdatesPopup from "@/components/UpdatesPopup";
import GlobalMicButton from "@/components/GlobalMicButton";
import CalendarPage from "@/pages/Calendar";
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
  Sparkles,
  Shield,
  Mail,
  Inbox,
  HelpCircle,
  Truck,
  Info,
  ClipboardCheck,
  CheckSquare,
  Snowflake,
  Bell,
  Brain,
  CalendarDays,
  X
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

const menuHelpContent: Record<string, { title: string; description: string; tips: string[] }> = {
  dashboard: {
    title: "My Workspace",
    description: "Your home base with quick access tiles to all major features.",
    tips: ["Click any tile to navigate", "Workspace adapts to your role", "Use sidebar for quick navigation"]
  },
  sops: {
    title: "SOP Library",
    description: "Store and organize Standard Operating Procedures for any process.",
    tips: ["Organize by category", "Add detailed steps", "Team can reference anytime"]
  },
  testing: {
    title: "Quizzes",
    description: "Take quizzes generated from SOPs to test and build your knowledge.",
    tips: ["Quizzes are auto-generated from SOPs", "Track your scores over time", "Retake to improve"]
  },
  todos: {
    title: "Tasks",
    description: "Manage tasks with priorities, due dates, and assignments.",
    tips: ["Set priorities and due dates", "Assign tasks to team members", "Track completion status"]
  },
  materials: {
    title: "Materials Catalog",
    description: "Track inventory, stock levels, pricing, and supplier info.",
    tips: ["Set minimum stock levels", "Track costs for estimates", "Categorize for easy search"]
  },
  equipment: {
    title: "Equipment Tracker",
    description: "Manage vehicles, mowers, trailers and schedule maintenance.",
    tips: ["Track mileage and hours", "Set maintenance schedules", "Log completed maintenance"]
  },
  hiring: {
    title: "Hiring Pipeline",
    description: "Manage recruitment from application to hire with drag-and-drop stages.",
    tips: ["Drag candidates between stages", "Upload documents", "Rate candidates with colored dots"]
  },
  employees: {
    title: "Employee Directory",
    description: "View and manage employee profiles, documents, and onboarding.",
    tips: ["Track employee details", "Manage onboarding forms", "Upload and share documents"]
  },
  jobs: {
    title: "Job Pipeline",
    description: "Track all projects from lead to completion with customizable tabs.",
    tips: ["Use tabs for job types", "Upload permits and contracts", "Track with Google Maps"]
  },
  education: {
    title: "Customer Hub",
    description: "Resource library with care guides, instructions, and documents for customers.",
    tips: ["Create guides and instructions", "Upload manufacturer documents", "Customers can bookmark favorites"]
  },
  help: {
    title: "Help Center",
    description: "Access guides, walkthroughs, and FAQs for using Company HQ.",
    tips: ["Start interactive walkthrough", "Browse FAQs", "Role-specific guidance"]
  },
  hq: {
    title: "Company HQ",
    description: "Overview of your company's central hub and settings.",
    tips: ["View company stats", "Access key metrics", "Central information hub"]
  },
  marketing: {
    title: "Marketing",
    description: "Track marketing campaigns, spend, and lead generation.",
    tips: ["Log campaign details", "Track ROI", "Monitor lead sources"]
  },
  forms: {
    title: "Forms",
    description: "Build custom forms for applications, surveys, and data collection.",
    tips: ["Drag-and-drop builder", "Multiple field types", "Review submissions"]
  },
  inbox: {
    title: "Messages",
    description: "View and respond to customer messages and inquiries.",
    tips: ["Track message status", "Reply to customers", "Mark as read/replied"]
  },
  integrations: {
    title: "Integrations",
    description: "Connect third-party tools like QuickBooks, CompanyCam, and more.",
    tips: ["Coming soon", "Connect business tools", "Sync data automatically"]
  },
  admin: {
    title: "Admin Panel",
    description: "Manage users, approve access requests, and configure settings.",
    tips: ["Create user accounts", "Approve role requests", "Company branding"]
  },
  tools: {
    title: "Tools",
    description: "Access specialized tools for landscape work.",
    tips: ["Material calculators & converters", "Map plow routes", "AI-powered analysis"]
  },
  customer_portal: {
    title: "Customer Portal",
    description: "Your dedicated area to communicate and request services.",
    tips: ["Send messages", "Request work", "Track request status"]
  },
  customer_messages: {
    title: "Messages",
    description: "Communicate directly with our team.",
    tips: ["Start conversations", "Track message status", "Get notified of replies"]
  },
  customer_account: {
    title: "My Account",
    description: "View and update your account information.",
    tips: ["Update contact info", "Request role upgrades", "Manage preferences"]
  },
  customer_help: {
    title: "Help",
    description: "Get assistance with using the customer portal.",
    tips: ["View guides", "Contact support", "FAQ answers"]
  },
  applicant_portal: {
    title: "My Application",
    description: "Track your job application status and required documents.",
    tips: ["View hiring progress", "Upload required documents", "See next steps"]
  },
  calendar: {
    title: "Calendar",
    description: "Schedule and manage events, jobs, and meetings with Google Calendar sync.",
    tips: ["Create personal or company events", "Sync with Google Calendar", "Assign events to team members"]
  }
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation, effectiveRole, previewRole } = useAuth();
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
        { label: "SOPs", example: "safety procedures" },
        { label: "Materials", example: "mulch, pavers, SKU" },
        { label: "Equipment", example: "truck, mower, VIN" },
        { label: "Jobs", example: "client name or address" },
        { label: "Candidates", example: "applicant name" }
      );
    }
    if (role === "Admin" || role === "Manager") {
      suggestions.push({ label: "Campaigns", example: "marketing campaign" });
    }
    if (role === "Admin") {
      suggestions.push(
        { label: "Users", example: "team member name" },
        { label: "Forms", example: "form title" }
      );
    }
    // Resources searchable by all users including customers
    suggestions.push({ label: "Resources", example: "lawn care guides" });
    
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

  const totalBellCount = (unseenUpdates.length || 0) + (staffNotifCount?.count || 0);

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

  // Customer navigation is completely separate and not reorderable
  const customerNav = [
    { id: "customer_hub", icon: LayoutDashboard, label: "My Portal", href: "/customer-hub" },
    ...(user?.isApplicant ? [{ id: "applicant_portal", icon: ClipboardCheck, label: "My Application", href: "/applicant" }] : []),
    { id: "customer_resources", icon: GraduationCap, label: "Resources", href: "/education" },
    { id: "customer_account", icon: User, label: "My Account", href: "/profile" },
    { id: "customer_help", icon: HelpCircle, label: "Help", href: "/help" },
  ];

  const internalNavItems: Record<string, { icon: any; label: string; href: string }> = {
    dashboard: { icon: LayoutDashboard, label: "My Workspace", href: "/" },
    applicant_portal: { icon: ClipboardCheck, label: "My Application", href: "/applicant" },
    sops: { icon: BookOpen, label: "SOP Library", href: "/sops" },
    testing: { icon: Brain, label: "Quizzes", href: "/testing" },
    materials: { icon: Hammer, label: "Materials", href: "/materials" },
    equipment: { icon: Truck, label: "Equipment", href: "/equipment" },
    todos: { icon: CheckSquare, label: "Tasks", href: "/todos" },
    hiring: { icon: Users, label: "Hiring", href: "/hiring" },
    employees: { icon: User, label: "Employees", href: "/employees" },
    jobs: { icon: LayoutDashboard, label: "Jobs", href: "/jobs" },
    education: { icon: GraduationCap, label: "Customer Hub", href: "/education" },
    help: { icon: HelpCircle, label: "Help", href: "/help" },
    hq: { icon: Building2, label: "CompanyHQ", href: "/hq" },
    marketing: { icon: Megaphone, label: "Marketing", href: "/marketing" },
    forms: { icon: FileText, label: "Forms", href: "/forms" },
    inbox: { icon: Mail, label: "Messages", href: "/inbox" },
    integrations: { icon: Settings, label: "Integrations", href: "/integrations" },
    admin: { icon: Shield, label: "Admin Panel", href: "/admin" },
    tools: { icon: Snowflake, label: "Tools", href: "/tools" },
    plow_mapper: { icon: Snowflake, label: "Plow Mapper", href: "/tools/plow-mapper" },
  };

  type NavSection = { label: string; items: string[] };

  const sidebarSections: NavSection[] = [
    { label: "", items: ["dashboard"] },
    { label: "WORK", items: ["jobs", "todos", "equipment"] },
    { label: "PEOPLE", items: ["employees", "education", "hiring"] },
    { label: "COMPANY", items: ["inbox", "forms", "sops", "testing"] },
    { label: "ADMIN", items: ["admin", "tools", "hq"] },
  ];

  const getSectionsForRole = (role: string): NavSection[] => {
    if (role === "Crew" || role === "New Hire") {
      return sidebarSections.filter(s => s.label !== "ADMIN");
    }
    if (role === "Crew Lead") {
      return sidebarSections.filter(s => s.label !== "ADMIN");
    }
    if (role === "Manager" || role === "HR" || role === "Sales") {
      return sidebarSections.filter(s => s.label !== "ADMIN");
    }
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

  const NavContent = () => {
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
                  {section.label}
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
                    <Link href={item.href} className="flex-1 min-w-0 block">
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg font-semibold transition-all cursor-pointer",
                          "border border-white/5 shadow-sm",
                          "bg-gradient-to-b from-white/[0.08] to-transparent",
                          "h-9 px-4 text-[13px] leading-[16px]",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] border-sidebar-primary/50"
                            : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-white/10"
                        )}
                        onClick={() => {
                          if (location === item.href) {
                            window.dispatchEvent(new CustomEvent("forms-nav-reset"));
                          }
                          setIsMobileOpen(false);
                        }}
                      >
                        <div className="relative">
                          <item.icon className="h-4 w-4" />
                          {showTodoBadge && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              {todoActiveStatus.unreadCount > 9 ? "9+" : todoActiveStatus.unreadCount}
                            </span>
                          )}
                        </div>
                        {item.label}
                      </div>
                    </Link>
                    {helpContent && (
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
                    "h-9 px-4 text-[13px] leading-[16px]",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)] border-sidebar-primary/50"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.2)] hover:border-white/10"
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-auto p-4 border-t-2 border-primary/20 bg-gradient-to-t from-primary/5 to-transparent">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-start px-3 py-6 hover:bg-primary/10 rounded-xl border border-sidebar-border/50 bg-sidebar-accent/30 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
              data-testid="button-user-profile-menu"
            >
              <Avatar className="h-10 w-10 mr-3 ring-2 ring-primary/20 ring-offset-2 ring-offset-sidebar">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-lg font-bold">
                  {user?.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">{user?.name || "User"}</span>
                <span className="text-xs text-muted-foreground">
                  {previewRole ? `Viewing: ${previewRole}` : (user?.isMasterAdmin ? "Master Admin" : (user?.role || "N/A"))}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email || user?.username}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/profile">
                <User className="mr-2 h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => logoutMutation.mutate()} 
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="hidden md:block w-64 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
        <NavContent />
      </div>

      <div className="md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border sidebar-themed">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b bg-card px-8 flex items-center justify-between sticky top-0 z-10">
           <div ref={searchRef} className="relative w-full max-w-md">
             <form onSubmit={handleSearch} className="relative">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
               <input 
                  type="text" 
                  placeholder="Search everything..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-secondary/50 h-9 rounded-md pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="input-global-search"
               />
             </form>
             {showSuggestions && !searchQuery && (
               <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-50 p-3">
                 <p className="text-xs text-muted-foreground mb-2 font-medium">You can search for:</p>
                 <div className="space-y-1.5">
                   {getSuggestions().map((s, i) => (
                     <div key={i} className="flex items-center gap-2 text-sm">
                       <span className="font-medium text-primary">{s.label}</span>
                       <span className="text-muted-foreground text-xs">e.g. "{s.example}"</span>
                     </div>
                   ))}
                 </div>
                 <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                   Type to search, press Enter to see results
                 </p>
               </div>
             )}
           </div>
           <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative gap-2 h-10 hover:bg-accent hover:scale-105 transition-all"
                    onClick={() => setIsCalendarOpen(true)}
                    data-testid="button-calendar-header"
                  >
                    <div className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/30">
                      <CalendarDays className="h-4 w-4 text-white drop-shadow-sm" />
                    </div>
                    <span className="hidden md:inline font-medium">Calendar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open calendar</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative gap-2 h-10 hover:bg-accent hover:scale-105 transition-all"
                    onClick={() => setIsUpdatesOpen(true)}
                    data-testid="button-updates-header"
                  >
                    <div className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 shadow-md shadow-blue-500/30">
                      <Bell className="h-4 w-4 text-white drop-shadow-sm" />
                    </div>
                    <span className="hidden md:inline font-medium">Updates</span>
                    {totalBellCount > 0 && (
                      <span className="absolute top-0 left-5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                        {totalBellCount > 9 ? "9+" : totalBellCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>See what's new and recent updates</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/help">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative gap-2 h-10 hover:bg-accent hover:scale-105 transition-all"
                      data-testid="button-help-header"
                    >
                      <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Help Center</p>
                </TooltipContent>
              </Tooltip>
              </TooltipProvider>
           </div>
        </header>

        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 pb-24">
            {children}
          </div>
        </div>
      </main>

      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
            <h2 className="text-lg font-semibold">Calendar</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCalendarOpen(false)}
              data-testid="button-close-calendar-overlay"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <CalendarPage />
          </div>
        </div>
      )}
      
      {user && effectiveRole && (
        <>
          <GlobalMicButton />
          <AIAssistantPanel />
        </>
      )}
      
      <UpdatesPopup isOpen={isUpdatesOpen} onClose={() => setIsUpdatesOpen(false)} />
    </div>
  );
}
