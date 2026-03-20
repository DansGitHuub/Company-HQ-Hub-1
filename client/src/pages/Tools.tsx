import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Snowflake, Calculator, Target, FileText, X, ClipboardList } from "lucide-react";

const PropertyReportCard = lazy(() => import("@/tools/property-report-card/PropertyReportCard"));

type Tool = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: any;
  href?: string;
  modal?: {
    src: string;
    titleKey: string;
    allow?: string;
  };
  reactModal?: {
    titleKey: string;
    component: string;
  };
};

const toolDefs: Tool[] = [
  {
    id: "property-report-card",
    titleKey: "tools.propertyReportCard",
    descKey: "tools.propertyReportCardDesc",
    icon: ClipboardList,
    reactModal: {
      titleKey: "tools.propertyReportCard",
      component: "PropertyReportCard",
    },
  },
  {
    id: "pdf-field-placer",
    titleKey: "tools.pdfFieldPlacer",
    descKey: "tools.pdfFieldPlacerDesc",
    icon: FileText,
    modal: {
      src: "/pdf-field-placer.html",
      titleKey: "tools.pdfFieldPlacer",
      allow: "clipboard-write",
    },
  },
  {
    id: "calculator",
    titleKey: "tools.calculator",
    descKey: "tools.calculatorDesc",
    icon: Calculator,
    href: "/tools/calculator",
  },
  {
    id: "plow-mapper",
    titleKey: "tools.plowMapper",
    descKey: "tools.plowMapperDesc",
    icon: Snowflake,
    href: "/tools/plow-mapper",
  },
  {
    id: "lead-qualifier",
    titleKey: "tools.leadQualifier",
    descKey: "tools.leadQualifierDesc",
    icon: Target,
    href: "/tools/lead-qualifier",
  },
];

export default function Tools() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [activeModal, setActiveModal] = useState<{ src: string; titleKey: string; allow?: string } | null>(null);
  const [activeReactModal, setActiveReactModal] = useState<{ titleKey: string; component: string } | null>(null);

  return (
    <div className="space-y-6" data-testid="tools-hub-page">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-tools-title">{t("tools.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("tools.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {toolDefs.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.id}
              className="hover:border-primary/50 hover:shadow-md transition-all"
              data-testid={`card-tool-${tool.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t(tool.titleKey)}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm mb-4">{t(tool.descKey)}</CardDescription>
                {tool.modal ? (
                  <Button
                    onClick={() => setActiveModal(tool.modal!)}
                    data-testid={`button-open-${tool.id}`}
                  >
                    {t("common.openTool")}
                  </Button>
                ) : tool.reactModal ? (
                  <Button
                    onClick={() => setActiveReactModal(tool.reactModal!)}
                    data-testid={`button-open-${tool.id}`}
                  >
                    {t("common.openTool")}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setLocation(tool.href!)}
                    data-testid={`button-open-${tool.id}`}
                  >
                    {t("common.openTool")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="modal-tool-overlay">
          <div className="flex items-center justify-between px-4 h-12 border-b bg-card shrink-0">
            <h2 className="font-semibold text-sm" data-testid="text-modal-title">{t(activeModal.titleKey)}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveModal(null)}
              data-testid="button-close-modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <iframe
            src={activeModal.src}
            className="flex-1 w-full border-0"
            allow={activeModal.allow}
            data-testid="iframe-tool"
          />
        </div>
      )}

      {activeReactModal && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="modal-tool-overlay">
          <div className="flex items-center justify-between px-4 h-12 border-b bg-card shrink-0">
            <h2 className="font-semibold text-sm" data-testid="text-modal-title">{t(activeReactModal.titleKey)}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveReactModal(null)}
              data-testid="button-close-modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
              {activeReactModal.component === "PropertyReportCard" && <PropertyReportCard />}
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
