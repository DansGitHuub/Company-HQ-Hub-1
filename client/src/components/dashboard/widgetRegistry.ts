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
  ClipboardList,
  Sparkles,
  StickyNote,
  UserPlus,
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
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  roles: string[];
  masterAdminOnly?: boolean;
  defaultSize: WidgetSize;
  sizes: WidgetSize[];
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "messages",
    labelKey: "dashboard.widgets.titles.messages",
    descriptionKey: "dashboard.widgets.descriptions.messages",
    icon: Mail,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "todos",
    labelKey: "dashboard.widgets.titles.todos",
    descriptionKey: "dashboard.widgets.descriptions.todos",
    icon: CheckSquare,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "pipeline",
    labelKey: "dashboard.widgets.titles.pipeline",
    descriptionKey: "dashboard.widgets.descriptions.pipeline",
    icon: LayoutDashboard,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "estimates",
    labelKey: "dashboard.widgets.titles.estimates",
    descriptionKey: "dashboard.widgets.descriptions.estimates",
    icon: FileText,
    roles: ["Admin", "Manager"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "calendar",
    labelKey: "dashboard.widgets.titles.calendar",
    descriptionKey: "dashboard.widgets.descriptions.calendar",
    icon: Calendar,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "equipment",
    labelKey: "dashboard.widgets.titles.equipment",
    descriptionKey: "dashboard.widgets.descriptions.equipment",
    icon: Truck,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "marketing",
    labelKey: "dashboard.widgets.titles.marketing",
    descriptionKey: "dashboard.widgets.descriptions.marketing",
    icon: Megaphone,
    roles: ["Admin"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "employees",
    labelKey: "dashboard.widgets.titles.employees",
    descriptionKey: "dashboard.widgets.descriptions.employees",
    icon: Users,
    roles: ["Admin", "Manager"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "sops",
    labelKey: "dashboard.widgets.titles.sops",
    descriptionKey: "dashboard.widgets.descriptions.sops",
    icon: BookOpen,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "quizzes",
    labelKey: "dashboard.widgets.titles.quizzes",
    descriptionKey: "dashboard.widgets.descriptions.quizzes",
    icon: Brain,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "suggestions",
    labelKey: "dashboard.widgets.titles.suggestions",
    descriptionKey: "dashboard.widgets.descriptions.suggestions",
    icon: Lightbulb,
    roles: ["Admin", "Manager"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "tools",
    labelKey: "dashboard.widgets.titles.tools",
    descriptionKey: "dashboard.widgets.descriptions.tools",
    icon: Wrench,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "companyhq",
    labelKey: "dashboard.widgets.titles.companyhq",
    descriptionKey: "dashboard.widgets.descriptions.companyhq",
    icon: Building2,
    roles: ["Admin"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "help",
    labelKey: "dashboard.widgets.titles.help",
    descriptionKey: "dashboard.widgets.descriptions.help",
    icon: HelpCircle,
    roles: ["Admin", "Manager", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "devtracker",
    labelKey: "dashboard.widgets.titles.devtracker",
    descriptionKey: "dashboard.widgets.descriptions.devtracker",
    icon: ClipboardList,
    roles: ["Admin"],
    masterAdminOnly: true,
    defaultSize: "large",
    sizes: ["medium", "large"],
  },
  {
    type: "soppipeline",
    labelKey: "dashboard.widgets.titles.soppipeline",
    descriptionKey: "dashboard.widgets.descriptions.soppipeline",
    icon: Sparkles,
    roles: ["Admin"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "notes",
    labelKey: "dashboard.widgets.titles.notes",
    descriptionKey: "dashboard.widgets.descriptions.notes",
    icon: StickyNote,
    roles: ["Admin", "Manager", "Crew", "HR", "Sales", "New Hire"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "dailyagenda",
    labelKey: "dashboard.widgets.titles.dailyagenda",
    descriptionKey: "dashboard.widgets.descriptions.dailyagenda",
    icon: ClipboardList,
    roles: ["Admin", "Manager", "Crew", "HR", "Sales", "New Hire"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "hiring",
    labelKey: "dashboard.widgets.titles.hiring",
    descriptionKey: "dashboard.widgets.descriptions.hiring",
    icon: UserPlus,
    roles: ["Admin", "Manager", "Master Admin"],
    defaultSize: "small",
    sizes: ["small", "medium"],
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
