import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Snowflake, Calculator, ClipboardCheck, Wrench, Target, FileText, X } from "lucide-react";

type Tool = {
  id: string;
  title: string;
  description: string;
  icon: any;
  href?: string;
  modal?: {
    src: string;
    title: string;
    allow?: string;
  };
};

const tools: Tool[] = [
  {
    id: "pdf-field-placer",
    title: "PDF Field Placer",
    description: "Visually place fillable form fields on any PDF. Draw boxes, assign field types, and export coordinates.",
    icon: FileText,
    modal: {
      src: "/pdf-field-placer.html",
      title: "PDF Field Placer",
      allow: "clipboard-write",
    },
  },
  {
    id: "calculator",
    title: "Universal Calculator",
    description: "Material calculators, unit converters, chemical mixing math, and system sizing tools for landscape work.",
    icon: Calculator,
    href: "/tools/calculator",
  },
  {
    id: "plow-mapper",
    title: "Plow Site Mapper",
    description: "Snow removal route planning with Google Maps, AI-powered property analysis, and site grouping.",
    icon: Snowflake,
    href: "/tools/plow-mapper",
  },
  {
    id: "process-auditor",
    title: "Process Auditor",
    description: "Audit and review business processes for efficiency and compliance.",
    icon: ClipboardCheck,
    href: "/tools/process-auditor",
  },
  {
    id: "integration-wizard",
    title: "Integration Wizard",
    description: "Connect third-party tools and services to streamline your workflow.",
    icon: Wrench,
    href: "/tools/integration-wizard",
  },
  {
    id: "lead-qualifier",
    title: "Lead Qualifier",
    description: "Score and qualify incoming prospects to focus on the best opportunities.",
    icon: Target,
    href: "/tools/lead-qualifier",
  },
];

export default function Tools() {
  const [, setLocation] = useLocation();
  const [activeModal, setActiveModal] = useState<Tool["modal"] | null>(null);

  return (
    <div className="space-y-6" data-testid="tools-hub-page">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-tools-title">Tools</h1>
        <p className="text-muted-foreground mt-1">
          Specialized tools to help you get the job done faster.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {tools.map((tool) => {
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
                    <CardTitle className="text-lg">{tool.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm mb-4">{tool.description}</CardDescription>
                {tool.modal ? (
                  <Button
                    onClick={() => setActiveModal(tool.modal!)}
                    data-testid={`button-open-${tool.id}`}
                  >
                    Open Tool
                  </Button>
                ) : (
                  <Button
                    onClick={() => setLocation(tool.href!)}
                    data-testid={`button-open-${tool.id}`}
                  >
                    Open Tool
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
            <h2 className="font-semibold text-sm" data-testid="text-modal-title">{activeModal.title}</h2>
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
    </div>
  );
}
