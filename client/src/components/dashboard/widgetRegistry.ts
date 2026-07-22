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
  requiredPermission?: string;
  defaultSize: WidgetSize;
  sizes: WidgetSize[];
}

const ALL_STAFF = [
  "Admin",
  "Manager",
  "Crew Lead",
  "Crew",
  "HR",
  "Sales",
  "New Hire",
];

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "myday",
    labelKey: "dashboard.widgets.titles.myday",
    descriptionKey: "dashboard.widgets.descriptions.myday",
    icon: ClipboardList,
    roles: ALL_STAFF,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "messages",
    labelKey: "dashboard.widgets.titles.messages",
    descriptionKey: "dashboard.widgets.descriptions.messages",
    icon: Mail,
    roles: ALL_STAFF,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "todos",
    labelKey: "dashboard.widgets.titles.todos",
    descriptionKey: "dashboard.widgets.descriptions.todos",
    icon: CheckSquare,
    roles: ALL_STAFF,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "notes",
    labelKey: "dashboard.widgets.titles.notes",
    descriptionKey: "dashboard.widgets.descriptions.notes",
    icon: StickyNote,
    roles: ALL_STAFF,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "dailyagenda",
    labelKey: "dashboard.widgets.titles.dailyagenda",
    descriptionKey: "dashboard.widgets.descriptions.dailyagenda",
    icon: ClipboardList,
    roles: ALL_STAFF,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "calendar",
    labelKey: "dashboard.widgets.titles.calendar",
    descriptionKey: "dashboard.widgets.descriptions.calendar",
    icon: Calendar,
    roles: ["Admin", "Manager", "Crew Lead", "Crew", "HR", "Sales"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "sops",
    labelKey: "dashboard.widgets.titles.sops",
    descriptionKey: "dashboard.widgets.descriptions.sops",
    icon: BookOpen,
    roles: ALL_STAFF,
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "quizzes",
    labelKey: "dashboard.widgets.titles.quizzes",
    descriptionKey: "dashboard.widgets.descriptions.quizzes",
    icon: Brain,
    roles: ALL_STAFF,
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "tools",
    labelKey: "dashboard.widgets.titles.tools",
    descriptionKey: "dashboard.widgets.descriptions.tools",
    icon: Wrench,
    roles: ["Admin", "Manager", "Crew Lead", "Crew", "HR", "Sales"],
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "help",
    labelKey: "dashboard.widgets.titles.help",
    descriptionKey: "dashboard.widgets.descriptions.help",
    icon: HelpCircle,
    roles: ALL_STAFF,
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "pipeline",
    labelKey: "dashboard.widgets.titles.pipeline",
    descriptionKey: "dashboard.widgets.descriptions.pipeline",
    icon: LayoutDashboard,
    roles: ["Admin", "Manager", "Crew Lead", "Crew", "Sales"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "equipment",
    labelKey: "dashboard.widgets.titles.equipment",
    descriptionKey: "dashboard.widgets.descriptions.equipment",
    icon: Truck,
    roles: ["Admin", "Manager", "Crew Lead", "Crew"],
    defaultSize: "small",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "estimates",
    labelKey: "dashboard.widgets.titles.estimates",
    descriptionKey: "dashboard.widgets.descriptions.estimates",
    icon: FileText,
    roles: ["Admin", "Manager", "Sales"],
    requiredPermission: "see_finance",
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "employees",
    labelKey: "dashboard.widgets.titles.employees",
    descriptionKey: "dashboard.widgets.descriptions.employees",
    icon: Users,
    roles: ["Admin", "Manager", "HR"],
    requiredPermission: "see_people_hr",
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "hiring",
    labelKey: "dashboard.widgets.titles.hiring",
    descriptionKey: "dashboard.widgets.descriptions.hiring",
    icon: UserPlus,
    roles: ["Admin", "Manager", "HR", "Master Admin"],
    requiredPermission: "see_hiring",
    defaultSize: "small",
    sizes: ["small", "medium"],
  },
  {
    type: "marketing",
    labelKey: "dashboard.widgets.titles.marketing",
    descriptionKey: "dashboard.widgets.descriptions.marketing",
    icon: Megaphone,
    roles: ["Admin", "Manager", "Sales"],
    requiredPermission: "manage_marketing",
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  {
    type: "suggestions",
    labelKey: "dashboard.widgets.titles.suggestions",
    descriptionKey: "dashboard.widgets.descriptions.suggestions",
    icon: Lightbulb,
    roles: ["Admin", "Manager", "HR"],
    requiredPermission: "see_people_hr",
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
    type: "soppipeline",
    labelKey: "dashboard.widgets.titles.soppipeline",
    descriptionKey: "dashboard.widgets.descriptions.soppipeline",
    icon: Sparkles,
    roles: ["Admin"],
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
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
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  Admin: [
    "myday",
    "messages",
    "pipeline",
    "estimates",
    "employees",
    "hiring",
    "todos",
    "marketing",
    "notes",
    "soppipeline",
  ],
  "Master Admin": [
    "myday",
    "messages",
    "pipeline",
    "estimates",
    "employees",
    "hiring",
    "todos",
    "marketing",
    "notes",
    "soppipeline",
    "devtracker",
  ],
  Manager: [
    "myday",
    "messages",
    "pipeline",
    "estimates",
    "employees",
    "hiring",
    "todos",
    "calendar",
    "notes",
  ],
  "Crew Lead": [
    "myday",
    "messages",
    "pipeline",
    "todos",
    "calendar",
    "equipment",
    "sops",
    "quizzes",
  ],
  Crew: [
    "myday",
    "todos",
    "messages",
    "calendar",
    "sops",
    "quizzes",
    "equipment",
    "notes",
  ],
  HR: [
    "myday",
    "employees",
    "hiring",
    "messages",
    "todos",
    "suggestions",
    "notes",
    "dailyagenda",
  ],
  Sales: [
    "myday",
    "pipeline",
    "messages",
    "calendar",
    "marketing",
    "todos",
    "notes",
  ],
  "New Hire": ["myday", "todos", "sops", "quizzes", "notes", "dailyagenda"],
};

export function getDefaultWidgets(
  role: string,
  grantedPermissions?: string[]
): WidgetConfig[] {
  const types =
    ROLE_DEFAULTS[role] || ROLE_DEFAULTS["Crew"];

  const filtered = grantedPermissions
    ? types.filter((type) => {
        const def = WIDGET_DEFINITIONS.find((w) => w.type === type);
        if (!def) return false;
        if (def.masterAdminOnly) return false;
        if (
          def.requiredPermission &&
          !grantedPermissions.includes(def.requiredPermission)
        )
          return false;
        return true;
      })
    : types;

  return filtered.map((type, i) => ({
    id: `widget-${type}-${i}`,
    widgetType: type,
    size: WIDGET_DEFINITIONS.find((w) => w.type === type)?.defaultSize || "medium",
  }));
}

export function getAvailableWidgets(
  role: string,
  isMasterAdmin?: boolean,
  grantedPermissions?: string[]
): WidgetDefinition[] {
  return WIDGET_DEFINITIONS.filter((w) => {
    const roleMatch = w.roles.includes(role) || (isMasterAdmin && w.roles.includes("Admin"));
    if (!roleMatch) return false;
    if (w.masterAdminOnly && !isMasterAdmin) return false;
    if (w.requiredPermission && grantedPermissions !== undefined) {
      if (!grantedPermissions.includes(w.requiredPermission)) return false;
    }
    return true;
  });
}
