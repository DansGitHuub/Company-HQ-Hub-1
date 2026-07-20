import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, Zap, FolderOpen, ExternalLink, GraduationCap, Brain, Wrench, Building2 } from "lucide-react";

type CompanyCard = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  nameKey: string;
  descKey: string;
  href: string;
  adminOnly?: boolean;
};

const COMPANY_CARDS: CompanyCard[] = [
  {
    id: "sop-library",
    icon: BookOpen,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    nameKey: "companyHub.cards.sopLibrary.name",
    descKey: "companyHub.cards.sopLibrary.desc",
    href: "/sops",
  },
  {
    id: "sop-pipeline",
    icon: Zap,
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    nameKey: "companyHub.cards.sopPipeline.name",
    descKey: "companyHub.cards.sopPipeline.desc",
    href: "/admin/sop-pipeline",
    adminOnly: true,
  },
  {
    id: "document-library",
    icon: FolderOpen,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    nameKey: "companyHub.cards.documentLibrary.name",
    descKey: "companyHub.cards.documentLibrary.desc",
    href: "/admin/documents",
    adminOnly: true,
  },
  {
    id: "shared-links",
    icon: ExternalLink,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    nameKey: "companyHub.cards.sharedLinks.name",
    descKey: "companyHub.cards.sharedLinks.desc",
    href: "/admin/shared-links",
    adminOnly: true,
  },
  {
    id: "customer-resources",
    icon: GraduationCap,
    iconBg: "bg-teal-100 dark:bg-teal-900/30",
    iconColor: "text-teal-600 dark:text-teal-400",
    nameKey: "companyHub.cards.customerResources.name",
    descKey: "companyHub.cards.customerResources.desc",
    href: "/customer-resources",
  },
  {
    id: "training",
    icon: Brain,
    iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    nameKey: "companyHub.cards.training.name",
    descKey: "companyHub.cards.training.desc",
    href: "/training",
  },
  {
    id: "tools",
    icon: Wrench,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    nameKey: "companyHub.cards.tools.name",
    descKey: "companyHub.cards.tools.desc",
    href: "/tools",
  },
  {
    id: "vendors",
    icon: Building2,
    iconBg: "bg-slate-100 dark:bg-slate-900/30",
    iconColor: "text-slate-600 dark:text-slate-400",
    nameKey: "companyHub.cards.vendors.name",
    descKey: "companyHub.cards.vendors.desc",
    href: "/vendors",
    adminOnly: true,
  },
];

export default function CompanyHub() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  const isAdmin = user?.role === "Admin" || !!(user as any)?.isMasterAdmin;
  const visibleCards = COMPANY_CARDS.filter(card => isAdmin || !card.adminOnly);

  if (visibleCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <p className="text-sm text-muted-foreground">{t("companyHub.noAccess")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="company-hub-title">
          {t("companyHub.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("companyHub.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleCards.map(card => (
          <button
            key={card.id}
            data-testid={`company-card-${card.id}`}
            onClick={() => navigate(card.href)}
            className="group rounded-xl border bg-card p-5 flex flex-col gap-3 text-left cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground leading-snug group-hover:text-primary transition-colors">
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
}
