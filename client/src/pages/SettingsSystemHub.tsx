import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, TrendingUp, ClipboardList, Clock, ClipboardCheck, Upload, Archive, AlertTriangle, Building2, Layers, FileText, FileSignature, SlidersHorizontal, MessageSquareWarning, Wrench, Tag, DollarSign, BookOpen, Leaf, Camera, Activity, Zap, FlagTriangleRight, Brain, Sparkles, Bot, Puzzle, CheckCircle, HelpCircle, GitMerge, Eye, AlertCircle, HeartPulse, Shield } from "lucide-react";

type SettingsCard = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  nameKey: string;
  descKey: string;
  href: string;
  masterAdminOnly?: boolean;
};

type SettingsSection = {
  id: string;
  labelKey: string;
  dotColor: string;
  borderColor: string;
  bgColor: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
  cards: SettingsCard[];
};

const SECTIONS: SettingsSection[] = [
  {
    id: "quickAccess",
    labelKey: "settingsHub.sections.quickAccess",
    dotColor: "bg-sky-500",
    borderColor: "border-sky-500/20",
    bgColor: "bg-sky-500/5",
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-600 dark:text-sky-400",
    cards: [
      {
        id: "overview",
        icon: LayoutDashboard,
        nameKey: "settingsHub.cards.overview.name",
        descKey: "settingsHub.cards.overview.desc",
        href: "/admin",
      },
      {
        id: "budgetPricing",
        icon: TrendingUp,
        nameKey: "settingsHub.cards.budgetPricing.name",
        descKey: "settingsHub.cards.budgetPricing.desc",
        href: "/mors-budget",
      },
    ],
  },
  {
    id: "dailyOps",
    labelKey: "settingsHub.sections.dailyOps",
    dotColor: "bg-green-500",
    borderColor: "border-green-500/20",
    bgColor: "bg-green-500/5",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
    badge: "⭐ Quick access",
    cards: [
      { id: "timeReports", icon: ClipboardList, nameKey: "settingsHub.cards.timeReports.name", descKey: "settingsHub.cards.timeReports.desc", href: "/admin/time-reports" },
      { id: "timeAdmin", icon: Clock, nameKey: "settingsHub.cards.timeAdmin.name", descKey: "settingsHub.cards.timeAdmin.desc", href: "/admin/time" },
      { id: "worksheetReview", icon: ClipboardCheck, nameKey: "settingsHub.cards.worksheetReview.name", descKey: "settingsHub.cards.worksheetReview.desc", href: "/worksheet-review" },
      { id: "qboExport", icon: Upload, nameKey: "settingsHub.cards.qboExport.name", descKey: "settingsHub.cards.qboExport.desc", href: "/admin/qbo-export" },
      { id: "timeArchive", icon: Archive, nameKey: "settingsHub.cards.timeArchive.name", descKey: "settingsHub.cards.timeArchive.desc", href: "/admin/archive" },
      { id: "overdueItems", icon: AlertTriangle, nameKey: "settingsHub.cards.overdueItems.name", descKey: "settingsHub.cards.overdueItems.desc", href: "/overdue" },
    ],
  },
  {
    id: "companySettings",
    labelKey: "settingsHub.sections.companySettings",
    dotColor: "bg-purple-500",
    borderColor: "border-purple-500/20",
    bgColor: "bg-purple-500/5",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    cards: [
      { id: "companyBranding", icon: Building2, nameKey: "settingsHub.cards.companyBranding.name", descKey: "settingsHub.cards.companyBranding.desc", href: "/admin?tab=company" },
      { id: "divisionColors", icon: Layers, nameKey: "settingsHub.cards.divisionColors.name", descKey: "settingsHub.cards.divisionColors.desc", href: "/admin?tab=divisions" },
      { id: "estimateTemplates", icon: FileText, nameKey: "settingsHub.cards.estimateTemplates.name", descKey: "settingsHub.cards.estimateTemplates.desc", href: "/admin?tab=estimate-templates" },
      { id: "termsConditions", icon: FileSignature, nameKey: "settingsHub.cards.termsConditions.name", descKey: "settingsHub.cards.termsConditions.desc", href: "/admin?tab=terms" },
      { id: "businessRules", icon: SlidersHorizontal, nameKey: "settingsHub.cards.businessRules.name", descKey: "settingsHub.cards.businessRules.desc", href: "/admin/business-rules" },
      { id: "feedbackReports", icon: MessageSquareWarning, nameKey: "settingsHub.cards.feedbackReports.name", descKey: "settingsHub.cards.feedbackReports.desc", href: "/admin/feedback" },
      { id: "adminTools", icon: Wrench, nameKey: "settingsHub.cards.adminTools.name", descKey: "settingsHub.cards.adminTools.desc", href: "/tools" },
    ],
  },
  {
    id: "catalogsIntegrations",
    labelKey: "settingsHub.sections.catalogsIntegrations",
    dotColor: "bg-teal-500",
    borderColor: "border-teal-500/20",
    bgColor: "bg-teal-500/5",
    iconBg: "bg-teal-100 dark:bg-teal-900/30",
    iconColor: "text-teal-600 dark:text-teal-400",
    cards: [
      { id: "workAreas", icon: Layers, nameKey: "settingsHub.cards.workAreas.name", descKey: "settingsHub.cards.workAreas.desc", href: "/admin/work-areas" },
      { id: "serviceTypes", icon: Tag, nameKey: "settingsHub.cards.serviceTypes.name", descKey: "settingsHub.cards.serviceTypes.desc", href: "/admin/service-types" },
      { id: "quickbooksOnline", icon: DollarSign, nameKey: "settingsHub.cards.quickbooksOnline.name", descKey: "settingsHub.cards.quickbooksOnline.desc", href: "/admin?tab=quickbooks" },
      { id: "itemCatalog", icon: BookOpen, nameKey: "settingsHub.cards.itemCatalog.name", descKey: "settingsHub.cards.itemCatalog.desc", href: "/catalog" },
      { id: "plantLibrary", icon: Leaf, nameKey: "settingsHub.cards.plantLibrary.name", descKey: "settingsHub.cards.plantLibrary.desc", href: "/plant-cards" },
      { id: "companyCamSync", icon: Camera, nameKey: "settingsHub.cards.companyCamSync.name", descKey: "settingsHub.cards.companyCamSync.desc", href: "/admin/companycam-reconciliation" },
      { id: "companyCamHealth", icon: Activity, nameKey: "settingsHub.cards.companyCamHealth.name", descKey: "settingsHub.cards.companyCamHealth.desc", href: "/admin/companycam-health" },
    ],
  },
  {
    id: "automationFlags",
    labelKey: "settingsHub.sections.automationFlags",
    dotColor: "bg-indigo-500",
    borderColor: "border-indigo-500/20",
    bgColor: "bg-indigo-500/5",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    cards: [
      { id: "automationCenter", icon: Zap, nameKey: "settingsHub.cards.automationCenter.name", descKey: "settingsHub.cards.automationCenter.desc", href: "/admin/automation-center" },
      { id: "featureFlags", icon: FlagTriangleRight, nameKey: "settingsHub.cards.featureFlags.name", descKey: "settingsHub.cards.featureFlags.desc", href: "/admin/feature-flags" },
    ],
  },
  {
    id: "aiTools",
    labelKey: "settingsHub.sections.aiTools",
    dotColor: "bg-fuchsia-500",
    borderColor: "border-fuchsia-500/20",
    bgColor: "bg-fuchsia-500/5",
    iconBg: "bg-fuchsia-100 dark:bg-fuchsia-900/30",
    iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
    badge: "🔒 Advanced",
    cards: [
      { id: "aiKnowledge", icon: Brain, nameKey: "settingsHub.cards.aiKnowledge.name", descKey: "settingsHub.cards.aiKnowledge.desc", href: "/admin/ai-knowledge" },
      { id: "assistantAgents", icon: Sparkles, nameKey: "settingsHub.cards.assistantAgents.name", descKey: "settingsHub.cards.assistantAgents.desc", href: "/admin?tab=assistant-agents" },
      { id: "usageSummary", icon: Bot, nameKey: "settingsHub.cards.usageSummary.name", descKey: "settingsHub.cards.usageSummary.desc", href: "/admin?tab=ai-logs" },
      { id: "aiAgents", icon: Bot, nameKey: "settingsHub.cards.aiAgents.name", descKey: "settingsHub.cards.aiAgents.desc", href: "/admin?tab=ai-agents", masterAdminOnly: true },
      { id: "integrationWizard", icon: Puzzle, nameKey: "settingsHub.cards.integrationWizard.name", descKey: "settingsHub.cards.integrationWizard.desc", href: "/admin?tab=integration-wizard" },
    ],
  },
  {
    id: "systemHealth",
    labelKey: "settingsHub.sections.systemHealth",
    dotColor: "bg-slate-500",
    borderColor: "border-slate-500/20",
    bgColor: "bg-slate-500/5",
    iconBg: "bg-slate-100 dark:bg-slate-900/30",
    iconColor: "text-slate-600 dark:text-slate-400",
    badge: "🔒 Advanced",
    cards: [
      { id: "todoUserMgmt", icon: CheckCircle, nameKey: "settingsHub.cards.todoUserMgmt.name", descKey: "settingsHub.cards.todoUserMgmt.desc", href: "/admin?tab=todos" },
      { id: "processAuditor", icon: ClipboardCheck, nameKey: "settingsHub.cards.processAuditor.name", descKey: "settingsHub.cards.processAuditor.desc", href: "/admin?tab=process-auditor" },
      { id: "articleReports", icon: HelpCircle, nameKey: "settingsHub.cards.articleReports.name", descKey: "settingsHub.cards.articleReports.desc", href: "/admin?tab=help-reports" },
      { id: "customerDuplicates", icon: GitMerge, nameKey: "settingsHub.cards.customerDuplicates.name", descKey: "settingsHub.cards.customerDuplicates.desc", href: "/admin/customer-duplicates" },
      { id: "appTesting", icon: Eye, nameKey: "settingsHub.cards.appTesting.name", descKey: "settingsHub.cards.appTesting.desc", href: "/admin?tab=app-testing" },
      { id: "systemStatus", icon: AlertCircle, nameKey: "settingsHub.cards.systemStatus.name", descKey: "settingsHub.cards.systemStatus.desc", href: "/admin?tab=system-status" },
      { id: "systemHealthPage", icon: HeartPulse, nameKey: "settingsHub.cards.systemHealthPage.name", descKey: "settingsHub.cards.systemHealthPage.desc", href: "/admin/system-health" },
      { id: "securityAuditLog", icon: Shield, nameKey: "settingsHub.cards.securityAuditLog.name", descKey: "settingsHub.cards.securityAuditLog.desc", href: "/admin?tab=security-audit-log" },
      { id: "diagnostics", icon: Wrench, nameKey: "settingsHub.cards.diagnostics.name", descKey: "settingsHub.cards.diagnostics.desc", href: "/admin?tab=diagnostics", masterAdminOnly: true },
    ],
  },
];

export default function SettingsSystemHub() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMasterAdmin = (user as any)?.isMasterAdmin;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("settingsHub.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsHub.subtitle")}
        </p>
      </div>

      <div className="space-y-10">
        {SECTIONS.map((section) => {
          const visibleCards = section.cards.filter(
            (c) => !c.masterAdminOnly || isMasterAdmin
          );
          if (visibleCards.length === 0) return null;

          return (
            <div key={section.id}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border mb-4 ${section.borderColor} ${section.bgColor}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${section.dotColor}`} />
                <span className="text-sm font-semibold text-foreground">
                  {t(section.labelKey)}
                </span>
                {section.badge && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border ml-1">
                    {section.badge}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleCards.map((card) => (
                  <button
                    key={card.id}
                    data-testid={`settings-hub-card-${card.id}`}
                    onClick={() => navigate(card.href)}
                    className="group rounded-xl border bg-card p-4 flex flex-col gap-3 text-left cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${section.iconBg}`}
                    >
                      <card.icon className={`h-5 w-5 ${section.iconColor}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground leading-snug">
                        {t(card.nameKey)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {t(card.descKey)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
