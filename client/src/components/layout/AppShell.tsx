import React from "react";
import { Link, useLocation } from "wouter";
import { useApp } from "@/lib/store";
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
  X,
  Search,
  GraduationCap,
  Building2,
  User
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, logout, login, users } = useApp();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: "Home", href: "/" },
    { icon: BookOpen, label: "SOP Library", href: "/sops" },
    { icon: Hammer, label: "Materials", href: "/materials" },
    { icon: Users, label: "Hiring", href: "/hiring" },
    { icon: LayoutDashboard, label: "Jobs", href: "/jobs" },
    { icon: GraduationCap, label: "Customer Hub", href: "/education" },
    { icon: User, label: "My Profile", href: "/profile" },
    { icon: Building2, label: "Company HQ", href: "/hq" },
    { icon: Megaphone, label: "Marketing", href: "/marketing" },
    { icon: FileText, label: "Forms", href: "/forms" },
    { icon: Settings, label: "Integrations", href: "/integrations" },
  ];

  // Filter nav for Customer role
  const displayNav = currentUser?.role === "Customer" 
    ? navItems.filter(item => ["Home", "SOP Library", "Forms"].includes(item.label))
    : navItems;

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

      <div className="flex-1 py-6 px-3 space-y-1">
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
                  {currentUser?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-xs">
                <span className="font-medium">{currentUser?.name}</span>
                <span className="opacity-70">{currentUser?.role}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel>Switch User (Demo)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {users.map((u) => (
              <DropdownMenuItem key={u.id} onClick={() => login(u.id)}>
                {u.name} ({u.role})
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-20 w-20 bg-primary rounded-xl flex items-center justify-center">
             <span className="font-heading font-bold text-4xl text-primary-foreground">HQ</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Sign in to your account</h2>
          <div className="grid gap-4">
             {users.map(u => (
               <Button key={u.id} onClick={() => login(u.id)} variant="outline" className="w-full py-6 text-lg justify-start px-8">
                 <span className="font-bold w-24 text-left">{u.role}</span>
                 <span className="text-muted-foreground">{u.name}</span>
               </Button>
             ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 shrink-0 border-r border-border bg-sidebar">
        <NavContent />
      </div>

      {/* Mobile Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Search Bar */}
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
