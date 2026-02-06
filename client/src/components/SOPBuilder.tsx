import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { SopCategory } from "@shared/schema";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  GripVertical,
  HardHat,
  Loader2,
  Plus,
  Save,
  Target,
  Trash2,
  Users,
  Wrench,
  X,
  AlertTriangle,
  Info,
  FileText,
  Lightbulb
} from "lucide-react";

interface SOPStep {
  id: string;
  title: string;
  instruction: string;
  why?: string;
  successCriteria?: string;
  commonMistakes?: string;
  proofRequired: boolean;
  proofType?: string;
  isQCCheckpoint: boolean;
}

interface SOPBuilderData {
  title: string;
  category: string;
  categoryId: string;
  sopType: string;
  outcome: string;
  outcomeType: string;
  audience: string;
  skillLevel: string;
  steps: SOPStep[];
  tools: string;
  materials: string;
  ppe: string;
  safetyNotes: string;
  complianceNotes: string;
  timingTarget: string;
  timingMax: string;
}

const WIZARD_STEPS = [
  { id: "type", label: "SOP Type", icon: FileText },
  { id: "identity", label: "Identity", icon: ClipboardList },
  { id: "outcome", label: "Outcome", icon: Target },
  { id: "audience", label: "Audience", icon: Users },
  { id: "steps", label: "Steps", icon: ClipboardList },
  { id: "tools", label: "Tools & Materials", icon: Wrench },
  { id: "safety", label: "Safety", icon: HardHat },
  { id: "review", label: "Review & Create", icon: Eye },
];

const SOP_TYPES = [
  { value: "standard", label: "Standard Procedure", description: "Step-by-step work instructions", icon: "📋" },
  { value: "safety", label: "Safety Procedure", description: "Safety protocols and emergency procedures", icon: "⚠️" },
  { value: "maintenance", label: "Maintenance", description: "Equipment maintenance and inspection checklists", icon: "🔧" },
  { value: "training", label: "Training Guide", description: "New employee onboarding and skill training", icon: "📚" },
  { value: "quality", label: "Quality Control", description: "Quality checkpoints and inspection procedures", icon: "✅" },
  { value: "emergency", label: "Emergency Response", description: "Emergency action plans and response protocols", icon: "🚨" },
];

const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner", description: "New to landscaping, needs detailed guidance" },
  { value: "intermediate", label: "Intermediate", description: "Some experience, knows basics" },
  { value: "advanced", label: "Advanced", description: "Experienced, just needs key steps" },
  { value: "all", label: "All Levels", description: "Written for everyone to follow" },
];

const OUTCOME_TYPES = [
  { value: "completion", label: "Task Completion", example: "e.g., Tree planted correctly and staked" },
  { value: "quality", label: "Quality Standard", example: "e.g., Lawn mowed to 3 inches with clean edges" },
  { value: "safety", label: "Safety Compliance", example: "e.g., All safety checks passed before operation" },
  { value: "kpi", label: "Measurable KPI", example: "e.g., Complete 5 properties per route per day" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function createEmptyStep(): SOPStep {
  return {
    id: generateId(),
    title: "",
    instruction: "",
    why: "",
    successCriteria: "",
    commonMistakes: "",
    proofRequired: false,
    proofType: "",
    isQCCheckpoint: false,
  };
}

function StepTypeSelection({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">What type of SOP are you creating?</h3>
        <p className="text-sm text-muted-foreground">This helps us tailor the builder to include the right fields.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SOP_TYPES.map((type) => (
          <Card
            key={type.value}
            className={`cursor-pointer transition-all hover:border-primary ${data.sopType === type.value ? "border-primary ring-2 ring-primary/20" : ""}`}
            onClick={() => onChange({ sopType: type.value })}
            data-testid={`sop-type-${type.value}`}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <p className="font-medium">{type.label}</p>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </div>
              {data.sopType === type.value && (
                <Check className="h-5 w-5 text-primary ml-auto shrink-0" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StepIdentity({ data, onChange, categories }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void; categories: SopCategory[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">SOP Identity</h3>
        <p className="text-sm text-muted-foreground">Give your SOP a clear name and assign it to a topic.</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="sop-title">SOP Title *</Label>
          <Input
            id="sop-title"
            value={data.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g., Plant a Tree (Balled & Burlapped)"
            data-testid="input-sop-title"
          />
          <p className="text-xs text-muted-foreground mt-1">Choose a clear, action-oriented title</p>
        </div>
        <div>
          <Label htmlFor="sop-category">Topic *</Label>
          <Select value={data.categoryId} onValueChange={(v) => {
            const cat = categories.find(c => c.id === v);
            onChange({ categoryId: v, category: cat?.name || "" });
          }}>
            <SelectTrigger data-testid="select-sop-category">
              <SelectValue placeholder="Select a topic" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Group this SOP under a topic for easy navigation</p>
        </div>
      </div>
    </div>
  );
}

function StepOutcome({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Define the Outcome</h3>
        <p className="text-sm text-muted-foreground">What should be accomplished when this SOP is followed correctly?</p>
      </div>
      <div>
        <Label>Outcome Type *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {OUTCOME_TYPES.map((type) => (
            <Card
              key={type.value}
              className={`cursor-pointer transition-all hover:border-primary p-3 ${data.outcomeType === type.value ? "border-primary ring-2 ring-primary/20" : ""}`}
              onClick={() => onChange({ outcomeType: type.value })}
              data-testid={`outcome-type-${type.value}`}
            >
              <p className="font-medium text-sm">{type.label}</p>
              <p className="text-xs text-muted-foreground">{type.example}</p>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="sop-outcome">Desired Outcome *</Label>
        <Textarea
          id="sop-outcome"
          value={data.outcome}
          onChange={(e) => onChange({ outcome: e.target.value })}
          placeholder="Describe what a successful completion looks like..."
          rows={3}
          data-testid="input-sop-outcome"
        />
        <p className="text-xs text-muted-foreground mt-1">Be specific about what "done right" looks like</p>
      </div>
    </div>
  );
}

function StepAudience({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Audience & Skill Level</h3>
        <p className="text-sm text-muted-foreground">Who is this SOP written for?</p>
      </div>
      <div>
        <Label htmlFor="sop-audience">Target Audience</Label>
        <Input
          id="sop-audience"
          value={data.audience}
          onChange={(e) => onChange({ audience: e.target.value })}
          placeholder="e.g., Landscape Crew Members, New Hires, Foremen"
          data-testid="input-sop-audience"
        />
      </div>
      <div>
        <Label>Skill Level *</Label>
        <div className="space-y-2 mt-2">
          {SKILL_LEVELS.map((level) => (
            <Card
              key={level.value}
              className={`cursor-pointer transition-all hover:border-primary p-3 ${data.skillLevel === level.value ? "border-primary ring-2 ring-primary/20" : ""}`}
              onClick={() => onChange({ skillLevel: level.value })}
              data-testid={`skill-level-${level.value}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{level.label}</p>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </div>
                {data.skillLevel === level.value && <Check className="h-4 w-4 text-primary" />}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepBuilder({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const addStep = () => {
    const newStep = createEmptyStep();
    onChange({ steps: [...data.steps, newStep] });
    setExpandedStep(newStep.id);
  };

  const updateStep = (id: string, updates: Partial<SOPStep>) => {
    onChange({
      steps: data.steps.map(s => s.id === id ? { ...s, ...updates } : s),
    });
  };

  const removeStep = (id: string) => {
    onChange({ steps: data.steps.filter(s => s.id !== id) });
    if (expandedStep === id) setExpandedStep(null);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= data.steps.length) return;
    const newSteps = [...data.steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    onChange({ steps: newSteps });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Build Your Steps</h3>
          <p className="text-sm text-muted-foreground">Add the steps someone needs to follow. You can reorder them.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="advanced-toggle" className="text-xs">Advanced</Label>
          <Switch id="advanced-toggle" checked={showAdvanced} onCheckedChange={setShowAdvanced} />
        </div>
      </div>

      {data.steps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No steps yet</p>
            <p className="text-sm text-muted-foreground mb-4">Start building your SOP by adding the first step</p>
            <Button onClick={addStep} data-testid="button-add-first-step">
              <Plus className="h-4 w-4 mr-2" /> Add First Step
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-2">
            {data.steps.map((step, index) => (
              <Card key={step.id} className="border">
                <div
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                  <span className="font-medium text-sm truncate flex-1">
                    {step.title || `Step ${index + 1} (untitled)`}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {step.proofRequired && <Badge variant="secondary" className="text-xs">Proof</Badge>}
                    {step.isQCCheckpoint && <Badge variant="secondary" className="text-xs">QC</Badge>}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); moveStep(index, "up"); }} disabled={index === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); moveStep(index, "down"); }} disabled={index === data.steps.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {expandedStep === step.id && (
                  <CardContent className="pt-0 pb-4 space-y-3 border-t">
                    <div className="grid grid-cols-1 gap-3 pt-3">
                      <div>
                        <Label className="text-xs">Step Title *</Label>
                        <Input
                          value={step.title}
                          onChange={(e) => updateStep(step.id, { title: e.target.value })}
                          placeholder="e.g., Dig the planting hole"
                          data-testid={`input-step-title-${index}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Instructions *</Label>
                        <Textarea
                          value={step.instruction}
                          onChange={(e) => updateStep(step.id, { instruction: e.target.value })}
                          placeholder="Describe exactly what to do in this step..."
                          rows={3}
                          data-testid={`input-step-instruction-${index}`}
                        />
                      </div>

                      {showAdvanced && (
                        <>
                          <div>
                            <Label className="text-xs flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Why This Matters</Label>
                            <Textarea
                              value={step.why || ""}
                              onChange={(e) => updateStep(step.id, { why: e.target.value })}
                              placeholder="Explain why this step is important..."
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1"><Check className="h-3 w-3" /> Success Criteria</Label>
                            <Input
                              value={step.successCriteria || ""}
                              onChange={(e) => updateStep(step.id, { successCriteria: e.target.value })}
                              placeholder="How do you know this step was done right?"
                            />
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Common Mistakes</Label>
                            <Input
                              value={step.commonMistakes || ""}
                              onChange={(e) => updateStep(step.id, { commonMistakes: e.target.value })}
                              placeholder="What mistakes should be avoided?"
                            />
                          </div>
                          <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={step.proofRequired}
                                onCheckedChange={(v) => updateStep(step.id, { proofRequired: v })}
                              />
                              <Label className="text-xs">Proof Required</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={step.isQCCheckpoint}
                                onCheckedChange={(v) => updateStep(step.id, { isQCCheckpoint: v })}
                              />
                              <Label className="text-xs">QC Checkpoint</Label>
                            </div>
                          </div>
                          {step.proofRequired && (
                            <div>
                              <Label className="text-xs">Proof Type</Label>
                              <Select value={step.proofType || ""} onValueChange={(v) => updateStep(step.id, { proofType: v })}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select proof type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="photo">Photo</SelectItem>
                                  <SelectItem value="video">Video</SelectItem>
                                  <SelectItem value="signature">Signature</SelectItem>
                                  <SelectItem value="checklist">Checklist Completion</SelectItem>
                                  <SelectItem value="measurement">Measurement Reading</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {data.steps.length > 0 && (
        <Button variant="outline" onClick={addStep} className="w-full" data-testid="button-add-step">
          <Plus className="h-4 w-4 mr-2" /> Add Step
        </Button>
      )}
    </div>
  );
}

function StepToolsMaterials({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Tools, Materials & Equipment</h3>
        <p className="text-sm text-muted-foreground">List everything needed before starting this procedure.</p>
      </div>
      <div>
        <Label htmlFor="sop-tools" className="flex items-center gap-1"><Wrench className="h-3 w-3" /> Tools Required</Label>
        <Textarea
          id="sop-tools"
          value={data.tools}
          onChange={(e) => onChange({ tools: e.target.value })}
          placeholder="List each tool on a new line, e.g.:
Shovel
Tree spade
Level
Garden hose"
          rows={4}
          data-testid="input-sop-tools"
        />
      </div>
      <div>
        <Label htmlFor="sop-materials">Materials Needed</Label>
        <Textarea
          id="sop-materials"
          value={data.materials}
          onChange={(e) => onChange({ materials: e.target.value })}
          placeholder="List materials, e.g.:
Mulch (3 cubic yards)
Root stimulator
Topsoil mix"
          rows={4}
          data-testid="input-sop-materials"
        />
      </div>
      <div>
        <Label htmlFor="sop-ppe" className="flex items-center gap-1"><HardHat className="h-3 w-3" /> PPE (Personal Protective Equipment)</Label>
        <Textarea
          id="sop-ppe"
          value={data.ppe}
          onChange={(e) => onChange({ ppe: e.target.value })}
          placeholder="List required PPE, e.g.:
Safety glasses
Work gloves
Steel-toe boots"
          rows={3}
          data-testid="input-sop-ppe"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="timing-target">Target Time</Label>
          <Input
            id="timing-target"
            value={data.timingTarget}
            onChange={(e) => onChange({ timingTarget: e.target.value })}
            placeholder="e.g., 45 minutes"
            data-testid="input-timing-target"
          />
        </div>
        <div>
          <Label htmlFor="timing-max">Maximum Time</Label>
          <Input
            id="timing-max"
            value={data.timingMax}
            onChange={(e) => onChange({ timingMax: e.target.value })}
            placeholder="e.g., 90 minutes"
            data-testid="input-timing-max"
          />
        </div>
      </div>
    </div>
  );
}

function StepSafety({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  const isSafetyType = data.sopType === "safety" || data.sopType === "emergency";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Safety & Compliance</h3>
        <p className="text-sm text-muted-foreground">Document safety requirements and compliance notes.</p>
      </div>
      {isSafetyType && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200">Safety/Emergency SOP</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">This SOP type requires safety or compliance notes to be complete.</p>
            </div>
          </CardContent>
        </Card>
      )}
      <div>
        <Label htmlFor="sop-safety">Safety Notes {isSafetyType && "*"}</Label>
        <Textarea
          id="sop-safety"
          value={data.safetyNotes}
          onChange={(e) => onChange({ safetyNotes: e.target.value })}
          placeholder="Document safety precautions, hazards to watch for, and emergency procedures..."
          rows={4}
          data-testid="input-sop-safety"
        />
      </div>
      <div>
        <Label htmlFor="sop-compliance">Compliance Notes</Label>
        <Textarea
          id="sop-compliance"
          value={data.complianceNotes}
          onChange={(e) => onChange({ complianceNotes: e.target.value })}
          placeholder="Regulatory requirements, certifications needed, inspection standards..."
          rows={3}
          data-testid="input-sop-compliance"
        />
      </div>
    </div>
  );
}

function StepReview({ data }: { data: SOPBuilderData }) {
  const completedSteps = data.steps.filter(s => s.title && s.instruction).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Review Your SOP</h3>
        <p className="text-sm text-muted-foreground">Review everything before creating your SOP.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Title</p>
            <p className="font-medium text-sm">{data.title || "Not set"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Topic</p>
            <p className="font-medium text-sm">{data.category || "Not set"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium text-sm">{SOP_TYPES.find(t => t.value === data.sopType)?.label || "Not set"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Skill Level</p>
            <p className="font-medium text-sm">{SKILL_LEVELS.find(l => l.value === data.skillLevel)?.label || "Not set"}</p>
          </CardContent>
        </Card>
      </div>

      {data.outcome && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Desired Outcome</p>
            <p className="text-sm">{data.outcome}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Steps ({completedSteps} of {data.steps.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.steps.length > 0 ? (
            <ol className="space-y-1 list-decimal list-inside">
              {data.steps.map((step) => (
                <li key={step.id} className="text-sm">
                  <span className={step.title ? "" : "text-muted-foreground italic"}>
                    {step.title || "Untitled step"}
                  </span>
                  {step.proofRequired && <Badge variant="secondary" className="ml-2 text-xs">Proof</Badge>}
                  {step.isQCCheckpoint && <Badge variant="secondary" className="ml-1 text-xs">QC</Badge>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No steps added</p>
          )}
        </CardContent>
      </Card>

      {(data.tools || data.materials || data.ppe) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tools, Materials & PPE</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm space-y-1">
            {data.tools && <p><span className="font-medium">Tools:</span> {data.tools.split("\n").filter(Boolean).join(", ")}</p>}
            {data.materials && <p><span className="font-medium">Materials:</span> {data.materials.split("\n").filter(Boolean).join(", ")}</p>}
            {data.ppe && <p><span className="font-medium">PPE:</span> {data.ppe.split("\n").filter(Boolean).join(", ")}</p>}
          </CardContent>
        </Card>
      )}

      {(data.safetyNotes || data.complianceNotes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Safety & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm space-y-1">
            {data.safetyNotes && <p>{data.safetyNotes}</p>}
            {data.complianceNotes && <p className="text-muted-foreground">{data.complianceNotes}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function generateSOPContent(data: SOPBuilderData): string {
  let html = "";

  const sopTypeLabel = SOP_TYPES.find(t => t.value === data.sopType)?.label || "";
  const skillLabel = SKILL_LEVELS.find(l => l.value === data.skillLevel)?.label || "";

  html += `<div class="sop-header">`;
  html += `<p><strong>Type:</strong> ${sopTypeLabel}</p>`;
  if (data.audience) html += `<p><strong>Audience:</strong> ${data.audience}</p>`;
  if (skillLabel) html += `<p><strong>Skill Level:</strong> ${skillLabel}</p>`;
  if (data.timingTarget) html += `<p><strong>Target Time:</strong> ${data.timingTarget}${data.timingMax ? ` (Max: ${data.timingMax})` : ""}</p>`;
  html += `</div>`;

  if (data.outcome) {
    const outcomeLabel = OUTCOME_TYPES.find(t => t.value === data.outcomeType)?.label || "";
    html += `<h2>Desired Outcome</h2>`;
    if (outcomeLabel) html += `<p><em>${outcomeLabel}</em></p>`;
    html += `<p>${data.outcome}</p>`;
  }

  if (data.tools || data.materials || data.ppe) {
    html += `<h2>Before You Start</h2>`;
    if (data.tools) {
      html += `<h3>Tools Required</h3><ul>`;
      data.tools.split("\n").filter(Boolean).forEach(t => html += `<li>${t.trim()}</li>`);
      html += `</ul>`;
    }
    if (data.materials) {
      html += `<h3>Materials Needed</h3><ul>`;
      data.materials.split("\n").filter(Boolean).forEach(m => html += `<li>${m.trim()}</li>`);
      html += `</ul>`;
    }
    if (data.ppe) {
      html += `<h3>PPE Required</h3><ul>`;
      data.ppe.split("\n").filter(Boolean).forEach(p => html += `<li>${p.trim()}</li>`);
      html += `</ul>`;
    }
  }

  if (data.safetyNotes) {
    html += `<h2>⚠️ Safety Notes</h2>`;
    html += `<p>${data.safetyNotes.replace(/\n/g, "<br>")}</p>`;
  }

  if (data.steps.length > 0) {
    html += `<h2>Procedure Steps</h2>`;
    html += `<ol>`;
    data.steps.forEach((step, i) => {
      html += `<li>`;
      html += `<strong>${step.title || `Step ${i + 1}`}</strong>`;
      if (step.instruction) html += `<p>${step.instruction.replace(/\n/g, "<br>")}</p>`;
      if (step.why) html += `<p><em>Why: ${step.why}</em></p>`;
      if (step.successCriteria) html += `<p>✅ <strong>Success:</strong> ${step.successCriteria}</p>`;
      if (step.commonMistakes) html += `<p>⚠️ <strong>Avoid:</strong> ${step.commonMistakes}</p>`;
      if (step.proofRequired) html += `<p>📋 <strong>Proof Required:</strong> ${step.proofType || "Required"}</p>`;
      if (step.isQCCheckpoint) html += `<p>🔍 <strong>QC Checkpoint</strong> — Verify before continuing</p>`;
      html += `</li>`;
    });
    html += `</ol>`;
  }

  if (data.complianceNotes) {
    html += `<h2>Compliance</h2>`;
    html += `<p>${data.complianceNotes.replace(/\n/g, "<br>")}</p>`;
  }

  return html;
}

interface SOPBuilderProps {
  categories: SopCategory[];
  onComplete: (sopData: { title: string; category: string; categoryId: string; content: string }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function SOPBuilder({ categories, onComplete, onCancel, isSubmitting }: SOPBuilderProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<SOPBuilderData>({
    title: "",
    category: "",
    categoryId: "",
    sopType: "",
    outcome: "",
    outcomeType: "",
    audience: "",
    skillLevel: "",
    steps: [createEmptyStep()],
    tools: "",
    materials: "",
    ppe: "",
    safetyNotes: "",
    complianceNotes: "",
    timingTarget: "",
    timingMax: "",
  });

  const updateData = useCallback((updates: Partial<SOPBuilderData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!data.sopType;
      case 1: return !!data.title && !!data.categoryId;
      case 2: return !!data.outcomeType && !!data.outcome;
      case 3: return !!data.skillLevel;
      case 4: return data.steps.length > 0 && data.steps.some(s => s.title && s.instruction);
      case 5: return true;
      case 6: {
        const isSafetyType = data.sopType === "safety" || data.sopType === "emergency";
        return !isSafetyType || (!!data.safetyNotes || !!data.complianceNotes);
      }
      case 7: return true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = () => {
    if (!data.title || !data.categoryId) {
      toast({ title: "Missing required fields", description: "Please fill in the title and topic.", variant: "destructive" });
      return;
    }
    const content = generateSOPContent(data);
    onComplete({
      title: data.title,
      category: data.category,
      categoryId: data.categoryId,
      content,
    });
  };

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepTypeSelection data={data} onChange={updateData} />;
      case 1: return <StepIdentity data={data} onChange={updateData} categories={categories} />;
      case 2: return <StepOutcome data={data} onChange={updateData} />;
      case 3: return <StepAudience data={data} onChange={updateData} />;
      case 4: return <StepBuilder data={data} onChange={updateData} />;
      case 5: return <StepToolsMaterials data={data} onChange={updateData} />;
      case 6: return <StepSafety data={data} onChange={updateData} />;
      case 7: return <StepReview data={data} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="sop-builder">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            SOP Builder
          </h2>
          <p className="text-muted-foreground text-sm">Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].label}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} data-testid="button-exit-builder">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="hidden md:flex gap-1 justify-center flex-wrap">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          return (
            <Button
              key={step.id}
              variant={isActive ? "default" : isComplete ? "secondary" : "ghost"}
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                if (index <= currentStep || canProceed()) setCurrentStep(index);
              }}
              data-testid={`wizard-step-${step.id}`}
            >
              {isComplete ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              {step.label}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-wizard-exit">
            Exit
          </Button>
          {currentStep === WIZARD_STEPS.length - 1 ? (
            <Button onClick={handleCreate} disabled={isSubmitting || !canProceed()} data-testid="button-wizard-create">
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Create SOP
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()} data-testid="button-wizard-next">
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
