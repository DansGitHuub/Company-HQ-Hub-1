import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Briefcase, HardHat, CalendarCheck, CalendarDays, Route, BarChart2, Timer, Clock, ClipboardList, Truck } from "lucide-react";

type RoleTier = "all" | "adminManager" | "adminOnly";

type WorkCard = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  nameKey: string;
  descKey: string;
  href: string;
  iconBg: string;
  iconColor: string;
  tier: RoleTier;
};

type WorkSection = {
  id: string;
  titleKey: string;
  borderColor: string;
  cards: WorkCard[];
};

const SECTIONS: WorkSection[] = [
  {
    id: "jobsScheduling",
    titleKey: "workHub.sections.jobsScheduling",
    borderColor: "border-blue-500",
    cards: [
      { id: "jobs", icon: Briefcase, nameKey: "workHub.cards.jobs.name", descKey: "workHub.cards.jobs.desc", href: "/jobs", iconBg: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400", tier: "all" },
      { id: "workOrders", icon: HardHat, nameKey: "workHub.cards.workOrders.name", descKey: "workHub.cards.workOrders.desc", href: "/work-orders", iconBg: "bg-slate-100 dark:bg-slate-800/50", iconColor: "text-slate-600 dark:text-slate-400", tier: "adminManager" },
      { id: "dispatchBoard", icon: CalendarCheck, nameKey: "workHub.cards.dispatchBoard.name", descKey: "workHub.cards.dispatchBoard.desc", href: "/scheduling", iconBg: "bg-indigo-100 dark:bg-indigo-900/30", iconColor: "text-indigo-600 dark:text-indigo-400", tier: "all" },
      { id: "dayBriefing", icon: CalendarDays, nameKey: "workHub.cards.dayBriefing.name", descKey: "workHub.cards.dayBriefing.desc", href: "/daily-plan", iconBg: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400", tier: "adminManager" },
      { id: "maintenanceRoutes", icon: Route, nameKey: "workHub.cards.maintenanceRoutes.name", descKey: "workHub.cards.maintenanceRoutes.desc", href: "/maintenance-routes", iconBg: "bg-teal-100 dark:bg-teal-900/30", iconColor: "text-teal-600 dark:text-teal-400", tier: "all" },
    ],
  },
  {
    id: "oversight",
    titleKey: "workHub.sections.oversight",
    borderColor: "border-emerald-500",
    cards: [
      { id: "managerDashboard", icon: BarChart2, nameKey: "workHub.cards.managerDashboard.name", descKey: "workHub.cards.managerDashboard.desc", href: "/manager-dashboard", iconBg: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400", tier: "adminManager" },
      { id: "teamTimeTracking", icon: Timer, nameKey: "workHub.cards.teamTimeTracking.name", descKey: "workHub.cards.teamTimeTracking.desc", href: "/time", iconBg: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400", tier: "all" },
    ],
  },
  {
    id: "timeRecords",
    titleKey: "workHub.sections.timeRecords",
    borderColor: "border-amber-500",
    cards: [
      { id: "timeAdmin", icon: Clock, nameKey: "workHub.cards.timeAdmin.name", descKey: "workHub.cards.timeAdmin.desc", href: "/admin/time", iconBg: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-600 dark:text-orange-400", tier: "adminOnly" },
      { id: "maintenanceReports", icon: ClipboardList, nameKey: "workHub.cards.maintenanceReports.name", descKey: "workHub.cards.maintenanceReports.desc", href: "/admin/maintenance-reports", iconBg: "bg-rose-100 dark:bg-rose-900/30", iconColor: "text-rose-600 dark:text-rose-400", tier: "adminManager" },
    ],
  },
  {
    id: "resources",
    titleKey: "workHub.sections.resources",
    borderColor: "border-slate-400",
    cards: [
      { id: "equipment", icon: Truck, nameKey: "workHub.cards.equipment.name", descKey: "workHub.cards.equipment.desc", href: "/equipment", iconBg: "bg-slate-100 dark:bg-slate-800/50", iconColor: "text-slate-600 dark:text-slate-400", tier: "all" },
    ],
  },
];

export default function WorkHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const role = (user as any)?.role;
  const isAdmin = role === "Admin" || (user as any)?.isMasterAdmin;
  const isManager = role === "Manager";
  const canAccess = isAdmin || isManager || role === "Crew";

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t("workHub.noAccess")}
      </div>
    );
  }

  const canSeeCard = (tier: RoleTier) => {
    if (tier === "all") return true;
    if (tier === "adminManager") return isAdmin || isManager;
    if (tier === "adminOnly") return isAdmin;
    return false;
  };

  const visibleSections = SECTIONS
    .map(s => ({ ...s, cards: s.cards.filter(c => canSeeCard(c.tier)) }))
    .filter(s => s.cards.length > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("workHub.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("workHub.subtitle")}</p>
      </div>

      <div className="space-y-8">
        {visibleSections.map((section) => (
          <div key={section.id}>
            <div className={`flex items-center gap-2 mb-4 pl-3 border-l-4 ${section.borderColor}`}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t(section.titleKey)}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    onClick={() => navigate(card.href)}
                    className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
                  >
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${card.iconBg}`}>
                      <Icon className={`w-5 h-5 ${card.iconColor}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground leading-tight">{t(card.nameKey)}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{t(card.descKey)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
