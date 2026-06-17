import {
  Mail,
  CheckSquare,
  LayoutDashboard,
  FileText,
  Calendar,
  Truck,
  Megaphone,
  Users,
  BookOpen,
  Lightbulb,
  Wrench,
  Building2,
  HelpCircle,
  Brain,
  Hammer,
  ClipboardList,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetConfig {
  id: string;
  widgetType: string;
  size: WidgetSize;
}

export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: string[];
  masterAdminOnly?: boolean;
  defaultSize: WidgetSize;
  sizes: WidgetSize[];
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "messages",
    label: "Messages",
    description: "Recent inbox messages",
    icon: Mail,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "todos",
    label: "Tasks",
    description: "Live task board — click to open full Kanban view",
    icon: CheckSquare,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "pipeline",
    label: "Work Pipeline",
    description: "Sold jobs by stage",
    icon: LayoutDashboard,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "estimates",
    label: "Estimates",
    description: "Estimate pipeline summary",
    icon: FileText,
    roles: ["Admin", "Manager"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "calendar",
    label: "Calendar",
    description: "Upcoming events and schedule",
    icon: Calendar,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "equipment",
    label: "Equipment",
    description: "Fleet status and alerts",
    icon: Truck,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "marketing",
    label: "Marketing",
    description: "Campaign performance stats",
    icon: Megaphone,
    roles: ["Admin"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "employees",
    label: "Team",
    description: "Employee quick view",
    icon: Users,
    roles: ["Admin", "Manager"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "sops",
    label: "SOPs",
    description: "Standard operating procedures",
    icon: BookOpen,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "quizzes",
    label: "Quizzes",
    description: "Training and knowledge tests",
    icon: Brain,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "materials",
    label: "Materials",
    description: "Inventory quick view",
    icon: Hammer,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "suggestions",
    label: "Suggestions",
    description: "Customer improvement ideas",
    icon: Lightbulb,
    roles: ["Admin", "Manager"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "tools",
    label: "Quick Links",
    description: "Shortcuts to tools and pages",
    icon: Wrench,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "companyhq",
    label: "Company HQ",
    description: "Mission, vision and goals",
    icon: Building2,
    roles: ["Admin"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "help",
    label: "Help Center",
    description: "FAQs and support links",
    icon: HelpCircle,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "devtracker",
    label: "Dev Tracker",
    description: "Development status and feature tracker",
    icon: ClipboardList,
    roles: ["Admin"],
    masterAdminOnly: true,
    defaultSize: "large",
    sizes: ["medium", "large"],
  },
  {
    type: "soppipeline",
    label: "SOP Pipeline",
    description: "AI-generated SOP pipeline status and queue",
    icon: Sparkles,
    roles: ["Admin"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "notes",
    label: "Quick Notes",
    description: "Personal notepad with reminders — voice or type to add notes",
    icon: StickyNote,
    roles: ["Admin", "Manager", "Crew", "HR", "Sales", "New Hire"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "dailyagenda",
    label: "Daily Agenda",
    description: "Plan your day — to-dos, calls, leads, delegate, equipment, and more",
    icon: ClipboardList,
    roles: ["Admin", "Manager", "Crew", "HR", "Sales", "New Hire"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
];

export function getDefaultWidgets(role: string): WidgetConfig[] {
  const defaults: Record<string, string[]> = {
    Admin:   ["notes", "messages", "todos", "pipeline", "estimates", "calendar", "equipment", "marketing", "employees"],
    Manager: ["notes", "messages", "todos", "pipeline", "estimates", "calendar", "equipment", "employees"],
    Crew:    ["notes", "todos", "calendar", "messages", "equipment", "sops"],
  };

  const types = defaults[role] || defaults.Crew;
  return types.map((type, i) => ({
    id: `widget-${type}-${i}`,
    widgetType: type,
    size: WIDGET_DEFINITIONS.find(w => w.type === type)?.defaultSize || "medium",
  }));
}

export function getAvailableWidgets(role: string, isMasterAdmin?: boolean): WidgetDefinition[] {
  return WIDGET_DEFINITIONS.filter(w => {
    if (!w.roles.includes(role)) return false;
    if (w.masterAdminOnly && !isMasterAdmin) return false;
    return true;
  });
}
