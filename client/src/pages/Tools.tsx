import { useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Snowflake, Calculator, Target, FileText, ClipboardList, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { TOOL_ROLES, canAccessTool } from "@/lib/toolAccess";

const PropertyReportCard = lazy(() => import("@/tools/property-report-card/PropertyReportCard"));
const CalculatorPage = lazy(() => import("@/pages/Calculator"));
const PlowSiteMapper = lazy(() => import("@/pages/PlowSiteMapper"));
const LeadQualifier = lazy(() => import("@/pages/LeadQualifier"));

type ToolDef = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: any;
  component: string;
  iframeModal?: { src: string; allow?: string };
  href?: string;
  roles: string[];
};

const toolDefs: ToolDef[] = [
  {
    id: "property-report-card",
    titleKey: "tools.propertyReportCard",
    descKey: "tools.propertyReportCardDesc",
    icon: ClipboardList,
    component: "PropertyReportCard",
    roles: TOOL_ROLES["property-report-card"],
  },
  {
    id: "pdf-field-placer",
    titleKey: "tools.pdfFieldPlacer",
    descKey: "tools.pdfFieldPlacerDesc",
    icon: FileText,
    component: "PdfFieldPlacer",
    iframeModal: { src: "/pdf-field-placer.html", allow: "clipboard-write" },
    roles: TOOL_ROLES["pdf-field-placer"],
  },
  {
    id: "calculator",
    titleKey: "tools.calculator",
    descKey: "tools.calculatorDesc",
    icon: Calculator,
    component: "Calculator",
    roles: TOOL_ROLES["calculator"],
  },
  {
    id: "plow-mapper",
    titleKey: "tools.plowMapper",
    descKey: "tools.plowMapperDesc",
    icon: Snowflake,
    component: "PlowSiteMapper",
    roles: TOOL_ROLES["plow-mapper"],
  },
  {
    id: "lead-qualifier",
    titleKey: "tools.leadQualifier",
    descKey: "tools.leadQualifierDesc",
    icon: Target,
    component: "LeadQualifier",
    roles: TOOL_ROLES["lead-qualifier"],
  },
  {
    id: "forms",
    titleKey: "tools.forms",
    descKey: "tools.formsDesc",
    icon: FileText,
    component: "Forms",
    href: "/forms",
    roles: TOOL_ROLES["forms"],
  },
];

export default function Tools() {
  const { t } = useTranslation();
  const { user, effectiveRole } = useAuth();
  const [, navigate] = useLocation();
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);

  const isMasterAdmin = !!(user as any)?.isMasterAdmin;
  const visibleTools = toolDefs.filter((tool) => canAccessTool(tool.id, effectiveRole, isMasterAdmin));

  const openTool = (tool: ToolDef) => {
    if (tool.href) {
      navigate(tool.href);
      return;
    }
    setActiveTool(tool);
  };
  const closeTool = () => setActiveTool(null);

  const renderToolContent = (tool: ToolDef) => {
    if (tool.iframeModal) {
      return (
        <iframe
          src={tool.iframeModal.src}
          className="flex-1 w-full border-0"
          allow={tool.iframeModal.allow}
          data-testid="iframe-tool"
        />
      );
    }
    return (
      <div className="flex-1 overflow-auto">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" /> Loading tool...
          </div>
        }>
          {tool.component === "PropertyReportCard" && <PropertyReportCard />}
          {tool.component === "Calculator" && <CalculatorPage onClose={closeTool} />}
          {tool.component === "PlowSiteMapper" && <PlowSiteMapper onClose={closeTool} />}
          {tool.component === "LeadQualifier" && <LeadQualifier onClose={closeTool} />}
        </Suspense>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="tools-hub-page">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-tools-title">
          {t("tools.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("tools.subtitle")}</p>
      </div>

      {visibleTools.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="text-no-tools">
          {t("tools.noneAvailable")}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.id}
              className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              data-testid={`card-tool-${tool.id}`}
              onClick={() => openTool(tool)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{t(tool.titleKey)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm mb-4">{t(tool.descKey)}</CardDescription>
                <Button data-testid={`button-open-${tool.id}`} onClick={(e) => { e.stopPropagation(); openTool(tool); }}>
                  {t("common.openTool")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeTool && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.55)" }}
          data-testid="modal-tool-overlay"
        >
          <div
            className="flex flex-col mx-auto my-4 rounded-2xl overflow-hidden shadow-2xl border border-border"
            style={{ width: "calc(100% - 2rem)", maxWidth: "1400px", height: "calc(100vh - 2rem)" }}
          >
            <div className="flex items-center justify-between px-5 py-3 bg-card border-b shrink-0">
              <div className="flex items-center gap-3">
                {(() => { const Icon = activeTool.icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                <h2 className="font-semibold text-base" data-testid="text-modal-title">
                  {t(activeTool.titleKey)}
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={closeTool}
                className="flex items-center gap-1.5 text-sm font-medium border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                data-testid="button-close-modal"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col bg-background">
              {renderToolContent(activeTool)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
