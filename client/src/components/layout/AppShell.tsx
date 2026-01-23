import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { CompanySettings } from "@shared/schema";
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
  MessageSquare,
  Inbox,
  HelpCircle,
  Truck,
  Bell,
  Info,
  ClipboardCheck
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
  profile: {
    title: "My Profile",
    description: "Update your personal info and profile picture.",
    tips: ["Add contact details", "Upload a profile photo", "Keep info current"]
  },
  assistant: {
    title: "AI Assistant",
    description: "Chat with an AI assistant for help with landscaping questions.",
    tips: ["Ask business questions", "Get landscaping advice", "Conversation history is saved"]
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation, effectiveRole, previewRole } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Role-based search suggestions
  const getSuggestions = () => {
    const suggestions: { label: string; example: string }[] = [];
    const role = effectiveRole;
    
    if (role !== "Customer") {
      suggestions.push(
        { label: "SOPs", example: "safety procedures" },
        { label: "Materials", example: "mulch, pavers" },
        { label: "Jobs", example: "client name or address" },
        { label: "Candidates", example: "applicant name" }
      );
    }
    if (role === "Admin") {
      suggestions.push({ label: "Users", example: "team member name" });
    }
    if (role === "Customer") {
      suggestions.push(
        { label: "Resources", example: "lawn care guides" },
        { label: "Your Messages", example: "message subject" }
      );
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
    { id: "customer_portal", icon: LayoutDashboard, label: "My Portal", href: "/customer" },
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
    materials: { icon: Hammer, label: "Materials", href: "/materials" },
    equipment: { icon: Truck, label: "Equipment", href: "/equipment" },
    hiring: { icon: Users, label: "Hiring", href: "/hiring" },
    jobs: { icon: LayoutDashboard, label: "Jobs", href: "/jobs" },
    education: { icon: GraduationCap, label: "Customer Hub", href: "/education" },
    profile: { icon: User, label: "My Profile", href: "/profile" },
    assistant: { icon: Sparkles, label: "Assistant", href: "/assistant" },
    help: { icon: HelpCircle, label: "Help", href: "/help" },
    hq: { icon: Building2, label: "Company HQ", href: "/hq" },
    marketing: { icon: Megaphone, label: "Marketing", href: "/marketing" },
    forms: { icon: FileText, label: "Forms", href: "/forms" },
    inbox: { icon: Inbox, label: "Messages", href: "/inbox" },
    integrations: { icon: Settings, label: "Integrations", href: "/integrations" },
    admin: { icon: Shield, label: "Admin Panel", href: "/admin" },
  };

  // Default order for internal roles (help always at very bottom for all roles)
  const teamDefaultIds = ["dashboard", "sops", "materials", "equipment", "hiring", "jobs", "education", "profile", "assistant"];
  const adminExtraIds = ["hq", "marketing", "forms", "inbox", "integrations", "admin"];
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
      allowedIds = [...teamDefaultIds, "inbox"];
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
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground bg-gradient-to-b from-white/[0.03] to-transparent">
      <div className="p-6 pb-8 border-b border-sidebar-border">
        <a 
          href="/" 
          className="flex flex-col items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
          data-testid="link-logo-home"
        >
          {hasLogo ? (
            <img 
              src={companySettings.logoUrl!} 
              alt="Company Logo - Click to go home"
              className={cn("object-cover shrink-0", sizeClass, shapeClass)}
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="font-heading font-bold text-2xl text-primary-foreground">HQ</span>
            </div>
          )}
          <div className="text-center">
            <h1 className="font-heading font-bold text-lg leading-tight text-sidebar-foreground">
              {companySettings?.companyName || "Company HQ"}
            </h1>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Landscape Management</p>
          </div>
        </a>
      </div>

      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {displayNav.map((item) => {
          const isActive = location === item.href;
          const helpContent = menuHelpContent[item.id];
          return (
            <div key={item.href} className="flex items-center group">
              <Link href={item.href} className="flex-1">
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-base font-semibold transition-all cursor-pointer",
                    "border border-white/5 shadow-sm",
                    "bg-gradient-to-b from-white/[0.08] to-transparent",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)] border-sidebar-primary/50"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.2)] hover:border-white/10"
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
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

      <div className="p-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-xs">
                <span className="font-medium">{user?.name || "User"}</span>
                <span className="opacity-70">
                  {previewRole ? `Viewing: ${previewRole}` : (user?.role || "N/A")}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="mr-2 h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => logoutMutation.mutate()} 
              className="text-destructive focus:text-destructive"
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
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block w-64 shrink-0 border-r border-border bg-sidebar">
        <NavContent />
      </div>

      <div className="md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border bg-sidebar">
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
           <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                className="relative h-14 w-14 hover:bg-primary/10"
                onClick={() => navigate(effectiveRole === "Customer" ? "/customer" : "/inbox")}
                data-testid="button-messages-notification"
              >
                <Bell className="h-8 w-8 text-primary" />
                {unreadData && unreadData.count > 0 && (
                  <span className="absolute top-0 right-0 h-6 w-6 rounded-full bg-destructive text-destructive-foreground text-sm flex items-center justify-center font-bold animate-pulse shadow-lg">
                    {unreadData.count > 9 ? "9+" : unreadData.count}
                  </span>
                )}
              </Button>
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
