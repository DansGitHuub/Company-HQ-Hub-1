import { FORM_THEMES } from "./FormTemplate";
import FormTemplate from "./FormTemplate";
import { Check } from "lucide-react";

interface StepTemplateProps {
  selected: number;
  onSelect: (variant: number) => void;
  sampleTitle?: string;
  sampleFields?: Array<{ id: string; type: any; label: string; required?: boolean }>;
}

export default function StepTemplate({
  selected,
  onSelect,
  sampleTitle = "Sample Form",
  sampleFields,
}: StepTemplateProps) {
  const previewFields = sampleFields ?? [
    { id: "f1", type: "text" as const, label: "Full Name", required: true },
    { id: "f2", type: "email" as const, label: "Email Address", required: true },
    { id: "f3", type: "select" as const, label: "Job Type", required: false, options: ["Installation", "Maintenance", "Consultation"] },
    { id: "f4", type: "textarea" as const, label: "Additional Notes", required: false },
    { id: "f5", type: "signature" as const, label: "Signature", required: true },
  ];

  return (
    <div className="space-y-6" data-testid="step-template">
      <p className="text-sm text-muted-foreground">
        Choose how your form looks when it's filled out or printed. You can change this later from the form library.
      </p>

      {/* Theme picker grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="template-grid">
        {FORM_THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onSelect(theme.id)}
            data-testid={`template-option-${theme.id}`}
            className={`relative text-left rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              selected === theme.id
                ? "border-primary shadow-md"
                : "border-border hover:border-primary/40"
            }`}
          >
            {/* Mini header preview */}
            <div
              className="relative h-16 flex items-center px-4"
              style={theme.headerStyle}
            >
              {/* Accent bar */}
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: theme.accentColor }} />

              <div className="ml-2">
                <div
                  className="text-xs font-bold leading-tight"
                  style={{ color: theme.titleColor, fontFamily: theme.id === 3 ? "sans-serif" : "Georgia, serif" }}
                >
                  {sampleTitle}
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-widest" style={{ color: theme.companyTextColor }}>
                  Your Company
                </div>
              </div>
            </div>

            {/* Mini field preview */}
            <div className="px-3 py-3 space-y-2 bg-white">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-2 w-20 rounded bg-slate-200" />
                  <div className="h-6 w-full rounded border border-slate-200 bg-slate-50" />
                </div>
              ))}
            </div>

            {/* Label + description */}
            <div className="px-3 pb-3 bg-white border-t border-slate-100">
              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{theme.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{theme.description}</p>
                </div>
                {selected === theme.id && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Full live preview of selected template */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Live Preview — {FORM_THEMES[selected]?.name}
          </h3>
          <span className="text-xs text-muted-foreground">Scroll to see full template</span>
        </div>

        <div
          className="rounded-xl border overflow-hidden"
          style={{ maxHeight: "500px", overflowY: "auto" }}
          data-testid="template-live-preview"
        >
          <div className="transform-gpu origin-top" style={{ transform: "scale(0.85)", transformOrigin: "top center", width: "117.6%" }}>
            <FormTemplate
              formTitle={sampleTitle}
              formDescription="This is a preview of how your completed form will appear."
              companyName="Chapin Landscapes"
              fields={previewFields}
              mode="preview"
              variant={selected}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
