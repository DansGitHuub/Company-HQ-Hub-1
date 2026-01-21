import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
  Inbox
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const customerNav = [
    { icon: LayoutDashboard, label: "My Portal", href: "/customer" },
    { icon: GraduationCap, label: "Resources", href: "/education" },
    { icon: User, label: "My Account", href: "/profile" },
  ];

  const teamNav = [
    { icon: LayoutDashboard, label: "Home", href: "/" },
    { icon: BookOpen, label: "SOP Library", href: "/sops" },
    { icon: Hammer, label: "Materials", href: "/materials" },
    { icon: Users, label: "Hiring", href: "/hiring" },
    { icon: LayoutDashboard, label: "Jobs", href: "/jobs" },
    { icon: GraduationCap, label: "Customer Hub", href: "/education" },
    { icon: User, label: "My Profile", href: "/profile" },
    { icon: Sparkles, label: "Assistant", href: "/assistant" },
  ];

  const adminNav = [
    { icon: Building2, label: "Company HQ", href: "/hq" },
    { icon: Megaphone, label: "Marketing", href: "/marketing" },
    { icon: FileText, label: "Forms", href: "/forms" },
    { icon: Inbox, label: "Messages", href: "/inbox" },
    { icon: Settings, label: "Integrations", href: "/integrations" },
    { icon: Shield, label: "Admin Panel", href: "/admin" },
  ];

  const getNavItems = () => {
    if (user?.role === "Customer") {
      return customerNav;
    }
    if (user?.role === "Admin") {
      return [...teamNav, ...adminNav];
    }
    if (user?.role === "Manager") {
      return [...teamNav, { icon: Inbox, label: "Messages", href: "/inbox" }];
    }
    return teamNav;
  };

  const displayNav = getNavItems();

  const NavContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="font-heading font-bold text-xl text-primary-foreground">HQ</span>
          </div>
          <div>
            <h1 className="font-heading font-semibold text-lg leading-none">Company HQ</h1>
            <p className="text-xs text-sidebar-accent-foreground/70 mt-1">Landscape Management</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {displayNav.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"
                )}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
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
                <span className="opacity-70">{user?.role || "N/A"}</span>
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
           <div className="relative w-full max-w-md">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <input 
                type="text" 
                placeholder="Search everything..." 
                className="w-full bg-secondary/50 h-9 rounded-md pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
             />
           </div>
           <div className="flex items-center gap-4">
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
