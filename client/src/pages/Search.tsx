import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search as SearchIcon, FileText, Users, Hammer,
  BookOpen, Briefcase, User, Truck, Megaphone, GraduationCap,
  Receipt, ClipboardList, Building2, UserCog,
} from "lucide-react";
import { Link } from "wouter";

type SearchResult = {
  type:
    | "sop" | "material" | "candidate" | "job" | "user"
    | "form" | "equipment" | "campaign" | "resource"
    | "customer" | "estimate" | "invoice" | "vendor" | "employee";
  id: string;
  title: string;
  description?: string;
  category?: string;
  href?: string;
};

type GroupDef = {
  type: SearchResult["type"];
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const GROUPS: GroupDef[] = [
  { type: "customer",  label: "Customers",  Icon: Users },
  { type: "job",       label: "Jobs",       Icon: Briefcase },
  { type: "estimate",  label: "Estimates",  Icon: ClipboardList },
  { type: "invoice",   label: "Invoices",   Icon: Receipt },
  { type: "vendor",    label: "Vendors",    Icon: Building2 },
  { type: "employee",  label: "Employees",  Icon: UserCog },
  { type: "material",  label: "Materials",  Icon: Hammer },
  { type: "sop",       label: "SOPs",       Icon: BookOpen },
  { type: "equipment", label: "Equipment",  Icon: Truck },
  { type: "candidate", label: "Candidates", Icon: Users },
  { type: "campaign",  label: "Campaigns",  Icon: Megaphone },
  { type: "resource",  label: "Resources",  Icon: GraduationCap },
  { type: "user",      label: "Users",      Icon: User },
  { type: "form",      label: "Forms",      Icon: FileText },
];

function getLink(result: SearchResult): string {
  if (result.href) return result.href;
  switch (result.type) {
    case "customer":  return `/customers/${result.id}`;
    case "job":       return `/jobs/${result.id}`;
    case "estimate":  return `/estimates/${result.id}`;
    case "invoice":   return `/invoices/${result.id}`;
    case "vendor":    return `/vendors?editVendorId=${result.id}`;
    case "employee":  return `/employees?employeeId=${result.id}`;
    case "sop":       return "/sops";
    case "material":  return "/materials";
    case "candidate": return "/hiring";
    case "user":      return "/admin";
    case "form":      return "/forms";
    case "equipment": return "/equipment";
    case "campaign":  return "/marketing";
    case "resource":  return "/customer-resources";
    default:          return "/";
  }
}

export default function SearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });

  useEffect(() => {
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get("q") || "";
      if (urlQuery !== query) setQuery(urlQuery);
    };
    checkUrl();
    window.addEventListener("popstate", checkUrl);
    const interval = setInterval(checkUrl, 200);
    return () => {
      window.removeEventListener("popstate", checkUrl);
      clearInterval(interval);
    };
  }, [query]);

  const { data: results, isLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query) return [];
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!query,
  });

  const groupedResults = GROUPS.map((g) => ({
    ...g,
    items: (results ?? []).filter((r) => r.type === g.type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3">
          <SearchIcon className="h-8 w-8" />
          {t("search.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {query ? t("search.resultsFor", { query }) : t("search.enterTerm")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !query ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <SearchIcon className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">{t("search.placeholder")}</p>
          </CardContent>
        </Card>
      ) : groupedResults.length > 0 ? (
        <div
          className="space-y-8"
          data-testid="search-results"
        >
          {groupedResults.map(({ type, label, Icon, items }) => (
            <section key={type} data-testid={`search-group-${type}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h2>
                <Badge variant="secondary" data-testid={`search-count-${type}`}>
                  {items.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {items.map((result) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={getLink(result)}
                  >
                    <Card
                      className="card-interactive cursor-pointer hover:border-primary/50 transition-colors"
                      data-testid={`search-result-${result.type}-${result.id}`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3
                              className="font-semibold truncate"
                              data-testid={`search-title-${result.id}`}
                            >
                              {result.title}
                            </h3>
                            {result.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {result.description}
                              </p>
                            )}
                            {result.category && !result.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {result.category}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <SearchIcon className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("search.noResults")}</h3>
            <p className="text-muted-foreground">{t("search.tryDifferent")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
