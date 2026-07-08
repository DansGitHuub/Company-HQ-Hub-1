import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock } from "lucide-react";
import TimeReports from "./TimeReports";
import TimeCardApproval from "./TimeCardApproval";
import WorksheetReview from "./WorksheetReview";
import PTOApprovalTab from "./PTOApprovalTab";

const VALID_TABS = ["reports", "approval", "worksheet", "pto"] as const;
type TabKey = (typeof VALID_TABS)[number];

function readTabFromSearch(search: string): TabKey {
  const params = new URLSearchParams(search);
  const candidate = params.get("tab");
  return (VALID_TABS as readonly string[]).includes(candidate || "")
    ? (candidate as TabKey)
    : "reports";
}

export default function TimeAdminPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const tab = readTabFromSearch(search);

  const handleTabChange = (next: string) => {
    if (!(VALID_TABS as readonly string[]).includes(next)) return;
    setLocation(`/admin/time?tab=${next}`);
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t("nav.timeAdmin")}</h1>
      </div>
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="reports" data-testid="time-admin-tab-reports">
            {t("nav.timeReports")}
          </TabsTrigger>
          <TabsTrigger value="approval" data-testid="time-admin-tab-approval">
            {t("nav.timeCardApproval")}
          </TabsTrigger>
          <TabsTrigger value="worksheet" data-testid="time-admin-tab-worksheet">
            {t("nav.worksheetReview")}
          </TabsTrigger>
          <TabsTrigger value="pto" data-testid="time-admin-tab-pto">
            PTO Requests
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-4">
          <TimeReports />
        </TabsContent>
        <TabsContent value="approval" className="mt-4">
          <TimeCardApproval />
        </TabsContent>
        <TabsContent value="worksheet" className="mt-4">
          <WorksheetReview />
        </TabsContent>
        <TabsContent value="pto" className="mt-4">
          <PTOApprovalTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
