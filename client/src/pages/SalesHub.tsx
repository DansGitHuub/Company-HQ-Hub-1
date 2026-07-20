import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Contact, CalendarClock, Calculator, MessageSquare, Megaphone } from "lucide-react";

type Card = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  nameKey: string;
  descKey: string;
  href: string;
  iconBg: string;
  iconColor: string;
  adminOnly?: boolean;
};

const CARDS: Card[] = [
  {
    id: "customers",
    icon: Contact,
    nameKey: "salesHub.cards.customers.name",
    descKey: "salesHub.cards.customers.desc",
    href: "/customers",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "consultations",
    icon: CalendarClock,
    nameKey: "salesHub.cards.consultations.name",
    descKey: "salesHub.cards.consultations.desc",
    href: "/consultations",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "estimates",
    icon: Calculator,
    nameKey: "salesHub.cards.estimates.name",
    descKey: "salesHub.cards.estimates.desc",
    href: "/estimates",
    iconBg: "bg-violet-100 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "customerMessages",
    icon: MessageSquare,
    nameKey: "salesHub.cards.customerMessages.name",
    descKey: "salesHub.cards.customerMessages.desc",
    href: "/customer-messages",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    adminOnly: true,
  },
  {
    id: "customerBlasts",
    icon: Megaphone,
    nameKey: "salesHub.cards.customerBlasts.name",
    descKey: "salesHub.cards.customerBlasts.desc",
    href: "/customer-blasts",
    iconBg: "bg-rose-100 dark:bg-rose-900/30",
    iconColor: "text-rose-600 dark:text-rose-400",
    adminOnly: true,
  },
];

export default function SalesHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const role = (user as any)?.role;
  const isAdmin = role === "Admin" || (user as any)?.isMasterAdmin;
  const canAccess = isAdmin || role === "Manager";

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t("salesHub.noAccess")}
      </div>
    );
  }

  const visibleCards = CARDS.filter(c => !c.adminOnly || isAdmin);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("salesHub.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("salesHub.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCards.map((card) => {
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
