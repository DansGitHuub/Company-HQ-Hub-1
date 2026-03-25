import { Shield, Wrench, Package, Clock, CheckCircle2, AlertTriangle, Info, Camera, ClipboardCheck, FileCheck, UserCheck, ThumbsUp, Target } from "lucide-react";
import { ImageReplacer } from "@/components/ImageReplacer";

export interface SOPStructuredData {
  outcome?: string;
  outcomeType?: "completion" | "quality" | "safety" | "kpi";
  audience?: string;
  skillLevel?: "beginner" | "intermediate" | "advanced" | "all";
  timingTarget?: string;
  timingMax?: string;
  ppe?: string;
  tools?: string;
  materials?: string;
  steps?: SOPTemplateStep[];
  safetyNotes?: string;
  complianceNotes?: string;
  headerImageUrl?: string;
}

export interface SOPTemplateStep {
  id?: string;
  title: string;
  instruction: string;
  why?: string;
  successCriteria?: string;
  commonMistakes?: string;
  proofRequired?: boolean;
  proofType?: string;
  isQCCheckpoint?: boolean;
  imageUrl?: string;
}

interface SOPTemplateRendererProps {
  title: string;
  category?: string;
  sopType?: string;
  lastUpdated?: string | Date | null;
  companyName?: string;
  companyLogoUrl?: string;
  data: SOPStructuredData;
  onReplaceHeaderImage?: (url: string) => Promise<void>;
  onReplaceStepImage?: (stepIndex: number, url: string) => Promise<void>;
}

const outcomeStyles: Record<string, { border: string; bg: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  quality: { border: "border-green-300", bg: "bg-green-50", badgeBg: "bg-green-100", badgeText: "text-green-800", badgeBorder: "border-green-300" },
  safety: { border: "border-orange-300", bg: "bg-orange-50", badgeBg: "bg-orange-100", badgeText: "text-orange-800", badgeBorder: "border-orange-300" },
  completion: { border: "border-blue-300", bg: "bg-blue-50", badgeBg: "bg-blue-100", badgeText: "text-blue-800", badgeBorder: "border-blue-300" },
  kpi: { border: "border-purple-300", bg: "bg-purple-50", badgeBg: "bg-purple-100", badgeText: "text-purple-800", badgeBorder: "border-purple-300" },
};

const skillStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  beginner: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "Beginner" },
  intermediate: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", label: "Intermediate" },
  advanced: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", label: "Advanced" },
  all: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", label: "All Levels" },
};

const proofIcons: Record<string, { icon: typeof Camera; label: string; bg: string; text: string; border: string }> = {
  photo: { icon: Camera, label: "Photo", bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
  measurement_log: { icon: FileCheck, label: "Measurement", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  supervisor_signoff: { icon: UserCheck, label: "Signoff", bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  customer_approval: { icon: ThumbsUp, label: "Approval", bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300" },
  checklist: { icon: ClipboardCheck, label: "Checklist", bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-300" },
};

function parseList(text?: string): string[] {
  if (!text) return [];
  return text.split("\n").map(l => l.trim()).filter(Boolean);
}

function parseItemWithSpec(line: string): { name: string; spec: string } {
  const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), spec: `(${match[2]})` };
  const dashMatch = line.match(/^(.+?)\s*[-–—]\s+(.+)$/);
  if (dashMatch) return { name: dashMatch[1].trim(), spec: dashMatch[2].trim() };
  return { name: line, spec: "" };
}

export default function SOPTemplateRenderer({ title, category, sopType, lastUpdated, companyName, companyLogoUrl, data, onReplaceHeaderImage, onReplaceStepImage }: SOPTemplateRendererProps) {
  const ppeItems = parseList(data.ppe);
  const toolItems = parseList(data.tools);
  const materialItems = parseList(data.materials);
  const steps = data.steps || [];
  const hasRequirements = ppeItems.length > 0 || toolItems.length > 0 || materialItems.length > 0;
  const outcomeStyle = outcomeStyles[data.outcomeType || "completion"] || outcomeStyles.completion;
  const skillStyle = skillStyles[data.skillLevel || "all"] || skillStyles.all;
  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="sop-template-container" data-testid="sop-template-renderer">
      <div className="border-t-4 border-blue-600 bg-gradient-to-b from-gray-50 to-white p-6 sm:p-8">
        <div className="flex items-start gap-3 mb-4">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {(companyName || "C")[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">{companyName || "Company"}</p>
            <p className="font-semibold text-foreground">Standard Operating Procedure</p>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4" data-testid="sop-template-title">{title}</h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {category && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium text-foreground">{category}</span>
              </div>
              <span className="text-gray-300 hidden sm:inline">|</span>
            </>
          )}
          {sopType && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium text-foreground capitalize">{sopType}</span>
              </div>
              <span className="text-gray-300 hidden sm:inline">|</span>
            </>
          )}
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${skillStyle.bg} ${skillStyle.text} ${skillStyle.border}`}>
            {skillStyle.label}
          </span>
          {data.audience && (
            <>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Audience:</span>
                <span className="font-medium text-foreground">{data.audience}</span>
              </div>
            </>
          )}
          {formattedDate && (
            <>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="font-medium text-foreground">{formattedDate}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {(data.headerImageUrl || onReplaceHeaderImage) && (
          <div className="text-center">
            {onReplaceHeaderImage ? (
              <ImageReplacer
                currentImageUrl={data.headerImageUrl}
                onReplace={onReplaceHeaderImage}
                className="inline-block max-w-full rounded-lg overflow-hidden border"
                imgClassName="max-w-full max-h-72 object-contain"
                alt={title}
              >
                <div className="flex items-center justify-center w-full h-32 bg-muted rounded-lg border border-dashed">
                  <span className="text-sm text-muted-foreground">No header image — hover to add one</span>
                </div>
              </ImageReplacer>
            ) : (
              <img src={data.headerImageUrl} alt={title} className="max-w-full max-h-72 rounded-lg mx-auto border" />
            )}
          </div>
        )}

        {data.outcome && (
          <div className={`border-l-4 ${outcomeStyle.border} ${outcomeStyle.bg} rounded p-4 sm:p-5 sop-section`}>
            <div className="flex items-center gap-2 mb-2">
              <Target className={`w-5 h-5 ${outcomeStyle.badgeText}`} />
              <h2 className="font-semibold text-base flex items-center gap-2">
                Outcome / Purpose
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${outcomeStyle.badgeBg} ${outcomeStyle.badgeText} ${outcomeStyle.badgeBorder}`}>
                  {(data.outcomeType || "completion").charAt(0).toUpperCase() + (data.outcomeType || "completion").slice(1)}
                </span>
              </h2>
            </div>
            <p className="text-gray-700 leading-7">{data.outcome}</p>
          </div>
        )}

        {(data.timingTarget || data.timingMax) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 sop-section">
            <div className="flex items-center gap-2 font-semibold mb-3">
              <Clock className="w-5 h-5" />
              Timing
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.timingTarget && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Target Time</div>
                    <div className="font-semibold text-foreground">{data.timingTarget}</div>
                  </div>
                </div>
              )}
              {data.timingMax && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Max Time</div>
                    <div className="font-semibold text-foreground">{data.timingMax}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {hasRequirements && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sop-section">
            {ppeItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-5" data-testid="sop-ppe-section">
                <h2 className="flex items-center gap-2 font-semibold text-base mb-3">
                  <Shield className="w-5 h-5 text-amber-700" />
                  PPE Required
                </h2>
                <ul className="space-y-2">
                  {ppeItems.map((item, i) => {
                    const { name, spec } = parseItemWithSpec(item);
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-700 font-bold mt-0.5">&bull;</span>
                        <span>{name} {spec && <span className="text-muted-foreground font-medium">{spec}</span>}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {toolItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-5" data-testid="sop-tools-section">
                <h2 className="flex items-center gap-2 font-semibold text-base mb-3">
                  <Wrench className="w-5 h-5 text-blue-600" />
                  Tools Required
                </h2>
                <ul className="space-y-2">
                  {toolItems.map((item, i) => {
                    const { name, spec } = parseItemWithSpec(item);
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold mt-0.5">&bull;</span>
                        <span>{name} {spec && <span className="text-muted-foreground font-medium">{spec}</span>}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {materialItems.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-5" data-testid="sop-materials-section">
                <h2 className="flex items-center gap-2 font-semibold text-base mb-3">
                  <Package className="w-5 h-5 text-green-600" />
                  Materials Required
                </h2>
                <ul className="space-y-2">
                  {materialItems.map((item, i) => {
                    const { name, spec } = parseItemWithSpec(item);
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 font-bold mt-0.5">&bull;</span>
                        <span>{name} {spec && <span className="text-muted-foreground font-medium">{spec}</span>}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {steps.length > 0 && (
          <div className="sop-section">
            <h2 className="text-xl font-semibold mb-4">Procedure</h2>
            <div className="flex flex-col gap-4">
              {steps.map((step, i) => (
                <div key={step.id || i} className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 sop-step-card" data-testid={`sop-step-${i}`}>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 text-base">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start gap-2 mb-2">
                        <h3 className="font-semibold text-lg text-foreground">{step.title || `Step ${i + 1}`}</h3>
                        {step.isQCCheckpoint && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                            QC Checkpoint
                          </span>
                        )}
                        {step.proofRequired && step.proofType && (() => {
                          const proof = proofIcons[step.proofType] || proofIcons.checklist;
                          const ProofIcon = proof.icon;
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${proof.bg} ${proof.text} ${proof.border}`}>
                              <ProofIcon className="w-3 h-3" />
                              {proof.label}
                            </span>
                          );
                        })()}
                      </div>

                      <p className="text-gray-700 leading-7 mb-3">{step.instruction}</p>

                      {(step.imageUrl || onReplaceStepImage) && (
                        <div className="my-3">
                          {onReplaceStepImage ? (
                            <ImageReplacer
                              currentImageUrl={step.imageUrl}
                              onReplace={async (url) => { await onReplaceStepImage(i, url); }}
                              className="inline-block max-w-full rounded-md overflow-hidden border"
                              imgClassName="max-w-full max-h-48 object-contain"
                              alt={step.title}
                            >
                              <div className="flex items-center justify-center w-full h-20 bg-muted rounded-md border border-dashed">
                                <span className="text-xs text-muted-foreground">No image — hover to add</span>
                              </div>
                            </ImageReplacer>
                          ) : (
                            <img src={step.imageUrl} alt={step.title} className="max-w-full max-h-48 rounded-md border" />
                          )}
                        </div>
                      )}

                      {step.why && (
                        <div className="bg-blue-50 border-l-2 border-blue-400 py-2 px-3 mb-3">
                          <p className="text-sm italic text-blue-900">
                            <span className="not-italic font-medium">Why it matters: </span>
                            {step.why}
                          </p>
                        </div>
                      )}

                      {step.successCriteria && (
                        <div className="flex items-start gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Success: </span>
                            {step.successCriteria}
                          </p>
                        </div>
                      )}

                      {step.commonMistakes && (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-900">
                            <span className="font-medium">Common mistake: </span>
                            {step.commonMistakes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.safetyNotes && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 sm:p-5 sop-section" data-testid="sop-safety-section">
            <h2 className="flex items-center gap-2 font-semibold text-base mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Safety Notes
            </h2>
            <p className="text-gray-800 leading-7 whitespace-pre-line">{data.safetyNotes}</p>
          </div>
        )}

        {data.complianceNotes && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 sm:p-5 sop-section" data-testid="sop-compliance-section">
            <h2 className="flex items-center gap-2 font-semibold text-base mb-2">
              <Info className="w-5 h-5 text-blue-600" />
              Compliance Notes
            </h2>
            <p className="text-gray-700 leading-7 whitespace-pre-line">{data.complianceNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function generateSOPPrintHTML(title: string, category: string, sopType: string, lastUpdated: string | Date | null, data: SOPStructuredData, companyName?: string): string {
  const ppeItems = parseList(data.ppe);
  const toolItems = parseList(data.tools);
  const materialItems = parseList(data.materials);
  const steps = data.steps || [];
  const outcomeTypeLabel = (data.outcomeType || "completion").charAt(0).toUpperCase() + (data.outcomeType || "completion").slice(1);
  const skillLabel = skillStyles[data.skillLevel || "all"]?.label || "All Levels";
  const formattedDate = lastUpdated ? new Date(lastUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

  const outcomeColors: Record<string, { border: string; bg: string }> = {
    quality: { border: "#86efac", bg: "#f0fdf4" },
    safety: { border: "#fdba74", bg: "#fff7ed" },
    completion: { border: "#93c5fd", bg: "#eff6ff" },
    kpi: { border: "#d8b4fe", bg: "#faf5ff" },
  };
  const oc = outcomeColors[data.outcomeType || "completion"] || outcomeColors.completion;

  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 900px; margin: 0 auto; }
.sop-header { border-top: 4px solid #2563eb; background: linear-gradient(to bottom, #f9fafb, white); padding: 2rem; }
.company-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.company-logo { width: 40px; height: 40px; background: #2563eb; border-radius: 0.5rem; color: white; font-weight: bold; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; }
.sop-title { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
.metadata { font-size: 0.875rem; color: #6b7280; display: flex; flex-wrap: wrap; gap: 0.5rem; }
.metadata b { color: #111827; font-weight: 500; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; border: 1px solid; }
.content { padding: 2rem; }
.section { margin-bottom: 1.5rem; page-break-inside: avoid; }
.outcome-box { border-left: 4px solid ${oc.border}; background: ${oc.bg}; padding: 1rem 1.25rem; border-radius: 0.25rem; }
.outcome-box h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
.outcome-box p { color: #374151; line-height: 1.75; }
.timing-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem 1.25rem; }
.timing-box h2 { font-weight: 600; margin-bottom: 0.75rem; }
.timing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.timing-item label { font-size: 0.75rem; color: #6b7280; }
.timing-item .val { font-weight: 600; }
.req-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.req-box { border: 1px solid; border-radius: 0.5rem; padding: 1rem 1.25rem; }
.req-box.ppe { background: #fffbeb; border-color: #fde68a; }
.req-box.tools { background: #eff6ff; border-color: #bfdbfe; }
.req-box.materials { background: #f0fdf4; border-color: #bbf7d0; }
.req-box h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
.req-box ul { list-style: none; padding: 0; }
.req-box li { font-size: 0.875rem; margin-bottom: 0.25rem; }
.req-box li .spec { color: #6b7280; font-weight: 500; }
.step-card { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.25rem; margin-bottom: 0.75rem; page-break-inside: avoid; }
.step-row { display: flex; gap: 1rem; }
.step-num { width: 32px; height: 32px; border-radius: 50%; background: #2563eb; color: white; font-weight: bold; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.875rem; }
.step-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem; }
.step-badges { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.badge-qc { background: #fecaca; color: #7f1d1d; border-color: #f87171; }
.badge-proof { background: #f3e8ff; color: #6b21a8; border-color: #d8b4fe; }
.step-instruction { color: #374151; line-height: 1.75; margin-bottom: 0.5rem; }
.step-why { background: #eff6ff; border-left: 2px solid #60a5fa; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; }
.step-why p { font-size: 0.875rem; font-style: italic; color: #1e3a8a; }
.step-success { font-size: 0.875rem; color: #374151; margin-bottom: 0.5rem; }
.step-mistake { background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.375rem; padding: 0.5rem 0.75rem; }
.step-mistake p { font-size: 0.875rem; color: #78350f; }
.safety-box { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 0.5rem; padding: 1rem 1.25rem; }
.safety-box h2 { font-weight: 600; margin-bottom: 0.5rem; }
.compliance-box { background: #eff6ff; border: 1px solid #93c5fd; border-radius: 0.5rem; padding: 1rem 1.25rem; }
.compliance-box h2 { font-weight: 600; margin-bottom: 0.5rem; }
@media print { @page { size: letter; margin: 0.75in; } body { max-width: none; } .step-card { box-shadow: none !important; } }
</style></head><body>`;

  html += `<div class="sop-header"><div class="company-row"><div class="company-logo">${(companyName || "C")[0].toUpperCase()}</div><div><div style="font-size:0.875rem;color:#6b7280;">${companyName || "Company"}</div><div style="font-weight:600;">Standard Operating Procedure</div></div></div>`;
  html += `<div class="sop-title">${title}</div>`;
  html += `<div class="metadata">`;
  if (category) html += `<span>Category: <b>${category}</b></span><span>|</span>`;
  if (sopType) html += `<span>Type: <b>${sopType}</b></span><span>|</span>`;
  html += `<span class="badge" style="background:#dbeafe;color:#1e3a8a;border-color:#93c5fd;">${skillLabel}</span>`;
  if (data.audience) html += `<span>|</span><span>Audience: <b>${data.audience}</b></span>`;
  if (formattedDate) html += `<span>|</span><span>Last Updated: <b>${formattedDate}</b></span>`;
  html += `</div></div>`;

  html += `<div class="content">`;

  if (data.outcome) {
    html += `<div class="section"><div class="outcome-box"><h2>Outcome / Purpose <span class="badge" style="background:${oc.bg};border-color:${oc.border};">${outcomeTypeLabel}</span></h2><p>${data.outcome}</p></div></div>`;
  }

  if (data.timingTarget || data.timingMax) {
    html += `<div class="section"><div class="timing-box"><h2>Timing</h2><div class="timing-grid">`;
    if (data.timingTarget) html += `<div class="timing-item"><label>Target Time</label><div class="val">${data.timingTarget}</div></div>`;
    if (data.timingMax) html += `<div class="timing-item"><label>Max Time</label><div class="val">${data.timingMax}</div></div>`;
    html += `</div></div></div>`;
  }

  if (ppeItems.length > 0 || toolItems.length > 0 || materialItems.length > 0) {
    html += `<div class="section"><div class="req-grid">`;
    if (ppeItems.length > 0) {
      html += `<div class="req-box ppe"><h2>PPE Required</h2><ul>`;
      ppeItems.forEach(item => { const { name, spec } = parseItemWithSpec(item); html += `<li>${name} ${spec ? `<span class="spec">${spec}</span>` : ""}</li>`; });
      html += `</ul></div>`;
    }
    if (toolItems.length > 0) {
      html += `<div class="req-box tools"><h2>Tools Required</h2><ul>`;
      toolItems.forEach(item => { const { name, spec } = parseItemWithSpec(item); html += `<li>${name} ${spec ? `<span class="spec">${spec}</span>` : ""}</li>`; });
      html += `</ul></div>`;
    }
    if (materialItems.length > 0) {
      html += `<div class="req-box materials"><h2>Materials Required</h2><ul>`;
      materialItems.forEach(item => { const { name, spec } = parseItemWithSpec(item); html += `<li>${name} ${spec ? `<span class="spec">${spec}</span>` : ""}</li>`; });
      html += `</ul></div>`;
    }
    html += `</div></div>`;
  }

  if (steps.length > 0) {
    html += `<div class="section"><h2 style="font-size:1.25rem;font-weight:600;margin-bottom:0.75rem;">Procedure</h2>`;
    steps.forEach((step, i) => {
      html += `<div class="step-card"><div class="step-row"><div class="step-num">${i + 1}</div><div style="flex:1;min-width:0;">`;
      html += `<div class="step-title">${step.title || `Step ${i + 1}`}</div>`;
      const badges: string[] = [];
      if (step.isQCCheckpoint) badges.push(`<span class="badge badge-qc">QC Checkpoint</span>`);
      if (step.proofRequired && step.proofType) {
        const label = proofIcons[step.proofType]?.label || step.proofType;
        badges.push(`<span class="badge badge-proof">${label}</span>`);
      }
      if (badges.length) html += `<div class="step-badges">${badges.join("")}</div>`;
      html += `<div class="step-instruction">${step.instruction}</div>`;
      if (step.why) html += `<div class="step-why"><p><strong>Why it matters:</strong> ${step.why}</p></div>`;
      if (step.successCriteria) html += `<div class="step-success"><strong>Success:</strong> ${step.successCriteria}</div>`;
      if (step.commonMistakes) html += `<div class="step-mistake"><p><strong>Common mistake:</strong> ${step.commonMistakes}</p></div>`;
      html += `</div></div></div>`;
    });
    html += `</div>`;
  }

  if (data.safetyNotes) {
    html += `<div class="section"><div class="safety-box"><h2>Safety Notes</h2><p>${data.safetyNotes.replace(/\n/g, "<br>")}</p></div></div>`;
  }

  if (data.complianceNotes) {
    html += `<div class="section"><div class="compliance-box"><h2>Compliance Notes</h2><p>${data.complianceNotes.replace(/\n/g, "<br>")}</p></div></div>`;
  }

  html += `</div></body></html>`;
  return html;
}
