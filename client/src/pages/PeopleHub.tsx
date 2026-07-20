import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { User, Users, Settings, Shield, FileSignature } from "lucide-react";

const CARDS = [
  {
    id: "employees",
    icon: User,
    nameKey: "peopleHub.cards.employees.name",
    descKey: "peopleHub.cards.employees.desc",
    href: "/employees",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "hiring",
    icon: Users,
    nameKey: "peopleHub.cards.hiring.name",
    descKey: "peopleHub.cards.hiring.desc",
    href: "/hiring",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "userManagement",
    icon: Settings,
    nameKey: "peopleHub.cards.userManagement.name",
    descKey: "peopleHub.cards.userManagement.desc",
    href: "/admin/users",
    iconBg: "bg-violet-100 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "accessRequests",
    icon: Shield,
    nameKey: "peopleHub.cards.accessRequests.name",
    descKey: "peopleHub.cards.accessRequests.desc",
    href: "/admin/access-requests",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "agreementTemplates",
    icon: FileSignature,
    nameKey: "peopleHub.cards.agreementTemplates.name",
    descKey: "peopleHub.cards.agreementTemplates.desc",
    href: "/admin/agreements",
    iconBg: "bg-rose-100 dark:bg-rose-900/30",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
];

export default function PeopleHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const role = (user as any)?.role;
  const canAccess = role === "Admin" || (user as any)?.isMasterAdmin;

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t("peopleHub.noAccess")}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("peopleHub.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("peopleHub.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => {
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
  );
}
