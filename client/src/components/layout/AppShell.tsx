import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { CompanySettings } from "@shared/schema";
import FloatingChatPopup from "@/components/FloatingChatPopup";
import UpdatesPopup from "@/components/UpdatesPopup";
import FloatingAssistantButton from "@/components/FloatingAssistantButton";
import InteractiveCalendar from "@/components/InteractiveCalendar";
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
  LayoutGrid,
  PanelLeft,
  Circle,
  Grip,
  Minus,
  CheckSquare,
  Snowflake,
  Bell,
  Brain
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
    title: "Dashboard",
    description: "Your home base with quick access tiles to all major features.",
    tips: ["Click any tile to navigate", "Dashboard adapts to your role", "Use sidebar for quick navigation"]
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
    title: "To-Do List",
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
  }
};

type TileLayout = "grid" | "radial" | "dock";

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
  const [isTileView, setIsTileView] = React.useState(false);
  const [tileLayout, setTileLayout] = React.useState<TileLayout>("grid");
  const [isUpdatesOpen, setIsUpdatesOpen] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = React.useState(false);

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

  // Internal navigation items (for Crew, Manager, Admin) - these can be reordered
  const internalNavItems: Record<string, { icon: any; label: string; href: string }> = {
    dashboard: { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    applicant_portal: { icon: ClipboardCheck, label: "My Application", href: "/applicant" },
    sops: { icon: BookOpen, label: "SOP Library", href: "/sops" },
    testing: { icon: Brain, label: "Quizzes", href: "/testing" },
    materials: { icon: Hammer, label: "Materials", href: "/materials" },
    equipment: { icon: Truck, label: "Equipment", href: "/equipment" },
    todos: { icon: CheckSquare, label: "To-Do List", href: "/todos" },
    hiring: { icon: Users, label: "Hiring", href: "/hiring" },
    jobs: { icon: LayoutDashboard, label: "Jobs", href: "/jobs" },
    education: { icon: GraduationCap, label: "Customer Hub", href: "/education" },
    care_guides: { icon: BookOpen, label: "Care Guides", href: "/care-guides" },
    help: { icon: HelpCircle, label: "Help", href: "/help" },
    hq: { icon: Building2, label: "Company HQ", href: "/hq" },
    marketing: { icon: Megaphone, label: "Marketing", href: "/marketing" },
    forms: { icon: FileText, label: "Forms", href: "/forms" },
    inbox: { icon: Mail, label: "Messages", href: "/inbox" },
    integrations: { icon: Settings, label: "Integrations", href: "/integrations" },
    admin: { icon: Shield, label: "Admin Panel", href: "/admin" },
    tools: { icon: Snowflake, label: "Tools", href: "/tools" },
  };

  // Default order for internal roles (help always at very bottom for all roles)
  const teamDefaultIds = ["dashboard", "sops", "testing", "materials", "equipment", "todos", "hiring", "jobs", "education", "inbox", "tools"];
  const adminExtraIds = ["hq", "marketing", "forms", "care_guides", "integrations", "admin"];
  const bottomIds = ["help"]; // Always shown at bottom for all roles

  const getNavItems = () => {
    // Customer role uses fixed navigation - not affected by sidebar order settings
    if (effectiveRole === "Customer") {
      return customerNav;
    }
    
    // Get the saved order from company settings (only applies to internal roles)
    const savedOrder = companySettings?.sidebarOrder as string[] | undefined;
    
    // Determine which items this role can access (excluding bottom items which are added last)
    let allowedIds: string[];
    if (effectiveRole === "Admin") {
      allowedIds = [...teamDefaultIds, ...adminExtraIds];
    } else if (effectiveRole === "Manager") {
      allowedIds = [...teamDefaultIds];
    } else {
      // Crew role
      allowedIds = teamDefaultIds;
    }
    
    // Add applicant portal if user is an applicant
    if (user?.isApplicant) {
      allowedIds = ["applicant_portal", ...allowedIds];
    }
    
    // If there's a saved order, use it but filter to only allowed items for this role
    if (savedOrder && savedOrder.length > 0) {
      const orderedItems = savedOrder
        .filter(id => allowedIds.includes(id) && internalNavItems[id] && !bottomIds.includes(id))
        .map(id => ({ id, ...internalNavItems[id] }));
      
      // Add any missing allowed items (except bottom items)
      const missingItems = allowedIds
        .filter(id => !savedOrder.includes(id) && internalNavItems[id] && !bottomIds.includes(id))
        .map(id => ({ id, ...internalNavItems[id] }));
      
      // Add bottom items (like Help) at the very end
      const bottomItems = bottomIds
        .filter(id => internalNavItems[id])
        .map(id => ({ id, ...internalNavItems[id] }));
      
      return [...orderedItems, ...missingItems, ...bottomItems];
    }
    
    // No saved order, use default order for this role + bottom items
    const mainItems = allowedIds.map(id => ({ id, ...internalNavItems[id] }));
    const bottomItems = bottomIds.map(id => ({ id, ...internalNavItems[id] }));
    return [...mainItems, ...bottomItems];
  };

  const displayNav = getNavItems();

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
        className="flex-1 py-6 px-3 space-y-1 overflow-y-auto"
      >
        {displayNav.map((item) => {
          const isActive = item.href === "/tools" ? location.startsWith("/tools") : location === item.href;
          const helpContent = menuHelpContent[item.id];
          const showTodoBadge = item.id === "todos" && todoActiveStatus?.isActive && todoActiveStatus.unreadCount > 0;
          return (
            <div key={item.href} className="flex items-center group w-full">
              <Link href={item.href} className="flex-1 min-w-0 block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-base font-semibold transition-all cursor-pointer",
                    "border border-white/5 shadow-sm",
                    "bg-gradient-to-b from-white/[0.08] to-transparent",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)] border-sidebar-primary/50"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.2)] hover:border-white/10"
                  )}
                  onClick={() => {
                    if (location === item.href) {
                      window.dispatchEvent(new CustomEvent("forms-nav-reset"));
                    }
                    setIsMobileOpen(false);
                  }}
                >
                  <div className="relative">
                    <item.icon className="h-5 w-5" />
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

  const TileNavigation = () => {
    const tiles = displayNav.filter(item => item.id !== "help");
    
    const handleTileClick = (href: string) => {
      if (location === href) {
        window.dispatchEvent(new CustomEvent("forms-nav-reset"));
      }
      navigate(href);
    };

    if (tileLayout === "grid") {
      return (
        <div className="flex items-center justify-center p-3">
          <div className="flex flex-wrap justify-center gap-2">
            {tiles.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/tools" ? location.startsWith("/tools") : location === item.href;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleTileClick(item.href)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-lg",
                    "shadow hover:shadow-md transition-all duration-200",
                    "hover:scale-105 cursor-pointer",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                    isActive 
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/50" 
                      : "bg-primary/80 hover:bg-primary text-primary-foreground"
                  )}
                  aria-label={`Navigate to ${item.label}`}
                  data-testid={`tile-${item.id}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (tileLayout === "radial") {
      return (
        <div className="flex items-center justify-center p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-sm">HQ</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {tiles.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/tools" ? location.startsWith("/tools") : location === item.href;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => handleTileClick(item.href)}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-full",
                      "shadow hover:shadow-md transition-all duration-200",
                      "hover:scale-110 cursor-pointer",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                      isActive 
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/50" 
                        : "bg-primary/80 hover:bg-primary text-primary-foreground"
                    )}
                    aria-label={`Navigate to ${item.label}`}
                    title={item.label}
                    data-testid={`tile-${item.id}`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (tileLayout === "dock") {
      return (
        <div className="flex items-center justify-center p-2">
          <div className="flex items-center gap-1 px-3 py-2 bg-card/80 backdrop-blur-sm rounded-full shadow-lg border border-border">
            {tiles.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/tools" ? location.startsWith("/tools") : location === item.href;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleTileClick(item.href)}
                  className={cn(
                    "group flex items-center gap-1.5 px-3 py-1.5 rounded-full relative",
                    "transition-all duration-200",
                    "hover:scale-105 cursor-pointer",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-primary/20 text-foreground"
                  )}
                  aria-label={`Navigate to ${item.label}`}
                  data-testid={`tile-${item.id}`}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "" : "text-primary")} />
                  <span className={cn(
                    "font-medium text-xs hidden sm:inline",
                    isActive ? "" : "text-muted-foreground group-hover:text-foreground"
                  )}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {!isTileView && (
        <div className="hidden md:block w-64 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
          <NavContent />
        </div>
      )}

      {!isTileView && (
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
      )}

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
              {/* To-Do List button - shown only for active users or admins */}
              {(todoActiveStatus?.isActive || user?.role === "Admin") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/todos">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="relative gap-2 h-10 hover:bg-accent hover:scale-105 transition-all"
                        data-testid="button-todo-header"
                      >
                        <div className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30">
                          <CheckSquare className="h-4 w-4 text-white drop-shadow-sm" />
                        </div>
                        <span className="hidden md:inline font-medium">To-Do</span>
                        {todoActiveStatus?.unreadCount && todoActiveStatus.unreadCount > 0 && (
                          <span className="absolute top-0 left-5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                            {todoActiveStatus.unreadCount > 9 ? "9+" : todoActiveStatus.unreadCount}
                          </span>
                        )}
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View your tasks and to-do items</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Communications/Inbox button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/communications">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative gap-2 h-10 hover:bg-accent hover:scale-105 transition-all"
                      data-testid="button-communications-header"
                    >
                      <div className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-md shadow-amber-500/30">
                        <Mail className="h-4 w-4 text-white drop-shadow-sm" />
                      </div>
                      <span className="hidden md:inline font-medium">Messages</span>
                      {unreadData && unreadData.count > 0 && (
                        <span className="absolute top-0 left-5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                          {unreadData.count > 9 ? "9+" : unreadData.count}
                        </span>
                      )}
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View messages and conversations</p>
                </TooltipContent>
              </Tooltip>
              {/* Updates/What's New button */}
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
                    {unseenUpdates.length > 0 && (
                      <span className="absolute top-0 left-5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                        {unseenUpdates.length > 9 ? "9+" : unseenUpdates.length}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>See what's new and recent updates</p>
                </TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-2 mr-2 border-r pr-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground hidden md:inline">View:</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isTileView ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setIsTileView(!isTileView)}
                        className={cn(
                          "gap-2 transition-all h-10 hover:scale-105",
                          isTileView ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                        data-testid="button-tile-view-toggle"
                      >
                        <div className={cn(
                          "relative w-7 h-7 flex items-center justify-center rounded-lg shadow-md transition-all",
                          isTileView 
                            ? "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 shadow-slate-500/30" 
                            : "bg-gradient-to-br from-violet-400 via-violet-500 to-violet-600 shadow-violet-500/30"
                        )}>
                          {isTileView ? <PanelLeft className="h-4 w-4 text-white drop-shadow-sm" /> : <LayoutGrid className="h-4 w-4 text-white drop-shadow-sm" />}
                        </div>
                        <span className="font-medium">{isTileView ? "Back to Menu" : "Tile View"}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isTileView ? "Switch to sidebar navigation" : "Switch to tile-based navigation"}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {isTileView && (
                  <div className="flex items-center gap-1 pl-2 border-l" role="group" aria-label="Tile layout options">
                    <span className="text-xs text-muted-foreground hidden md:inline mr-1">Layout:</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={tileLayout === "grid" ? "secondary" : "ghost"}
                          size="sm"
                          className="gap-1 h-8 px-2 hover:scale-105 transition-all"
                          onClick={() => setTileLayout("grid")}
                          aria-label="Switch to grid layout"
                          aria-pressed={tileLayout === "grid"}
                          data-testid="button-layout-grid"
                        >
                          <Grip className="h-4 w-4" />
                          <span className="hidden lg:inline text-xs">Grid</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Grid layout</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={tileLayout === "radial" ? "secondary" : "ghost"}
                          size="sm"
                          className="gap-1 h-8 px-2 hover:scale-105 transition-all"
                          onClick={() => setTileLayout("radial")}
                          aria-label="Switch to radial layout"
                          aria-pressed={tileLayout === "radial"}
                          data-testid="button-layout-radial"
                        >
                          <Circle className="h-4 w-4" />
                          <span className="hidden lg:inline text-xs">Radial</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Radial layout</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={tileLayout === "dock" ? "secondary" : "ghost"}
                          size="sm"
                          className="gap-1 h-8 px-2 hover:scale-105 transition-all"
                          onClick={() => setTileLayout("dock")}
                          aria-label="Switch to dock layout"
                          aria-pressed={tileLayout === "dock"}
                          data-testid="button-layout-dock"
                        >
                          <Minus className="h-4 w-4" />
                          <span className="hidden lg:inline text-xs">Dock</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Dock layout</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
              </TooltipProvider>
              <div className="hidden md:block ml-2">
                <InteractiveCalendar />
              </div>
           </div>
        </header>

        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {isTileView && (
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
              <TileNavigation />
            </div>
          )}
          <div className={cn("p-4 md:p-8 pb-24", isTileView && "pt-4")}>
            {children}
          </div>
        </div>
      </main>
      
      {user && effectiveRole && (
        <>
          <FloatingChatPopup 
            userRole={effectiveRole} 
            userName={user.name || user.username || undefined}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
          <FloatingAssistantButton
            onChatClick={() => setIsChatOpen(true)}
            isChatOpen={isChatOpen}
          />
        </>
      )}
      
      <UpdatesPopup isOpen={isUpdatesOpen} onClose={() => setIsUpdatesOpen(false)} />
    </div>
  );
}
