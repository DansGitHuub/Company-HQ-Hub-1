import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search as SearchIcon, FileText, Users, Hammer, BookOpen, Briefcase, User, Truck, Megaphone, GraduationCap } from "lucide-react";
import { Link } from "wouter";

type SearchResult = {
  type: "sop" | "material" | "candidate" | "job" | "user" | "form" | "equipment" | "campaign" | "resource";
  id: string;
  title: string;
  description?: string;
  category?: string;
};

export default function SearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  
  // Update query when URL changes - use polling to catch navigation
  useEffect(() => {
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get("q") || "";
      if (urlQuery !== query) {
        setQuery(urlQuery);
      }
    };
    
    // Check immediately and on popstate
    checkUrl();
    window.addEventListener("popstate", checkUrl);
    
    // Also poll for changes (catches programmatic navigation)
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
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!query,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "sop": return BookOpen;
      case "material": return Hammer;
      case "candidate": return Users;
      case "job": return Briefcase;
      case "user": return User;
      case "form": return FileText;
      case "equipment": return Truck;
      case "campaign": return Megaphone;
      case "resource": return GraduationCap;
      default: return FileText;
    }
  };

  const getLink = (result: SearchResult) => {
    switch (result.type) {
      case "sop": return `/sops`;
      case "material": return `/materials`;
      case "candidate": return `/hiring`;
      case "job": return `/jobs`;
      case "user": return `/admin`;
      case "form": return `/forms`;
      case "equipment": return `/equipment`;
      case "campaign": return `/marketing`;
      case "resource": return `/education`;
      default: return "/";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sop": return "SOP";
      case "material": return "Material";
      case "candidate": return "Candidate";
      case "job": return "Job";
      case "user": return "User";
      case "form": return "Form";
      case "equipment": return "Equipment";
      case "campaign": return "Campaign";
      case "resource": return "Resource";
      default: return type;
    }
  };

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
      ) : results && results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result) => {
            const Icon = getIcon(result.type);
            return (
              <Link key={`${result.type}-${result.id}`} href={getLink(result)}>
                <Card className="card-interactive cursor-pointer hover:border-primary/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{result.title}</h3>
                          <Badge variant="outline" className="shrink-0">{getTypeLabel(result.type)}</Badge>
                        </div>
                        {result.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{result.description}</p>
                        )}
                        {result.category && (
                          <p className="text-xs text-muted-foreground mt-1">{t("common.category")}: {result.category}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
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
