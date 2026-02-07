import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Lightbulb,
  ImageIcon,
  Sparkles,
  Camera,
  Palette,
  Clock,
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

interface SOPMediaItem {
  id: string;
  url: string;
  alt: string;
  source: "upload" | "ai_generated";
  aiPrompt?: string;
  aiStyle?: string;
}

interface SOPClassification {
  superCategory: string;
  mainCategory: string;
  subCategory: string;
  sopType: string;
  confidence: number;
  matchedOn?: string;
}

interface MaterialCalculatorData {
  materialType: string;
  defaultDepthInches: number;
  coverageNote: string;
}

interface ImageSuggestion {
  target: string;
  prompt: string;
  priority: number;
}

export interface SOPBuilderData {
  title: string;
  category: string;
  categoryId: string;
  sopType: string;
  superCategory: string;
  subCategory: string;
  classification: SOPClassification | null;
  outcome: string;
  outcomeType: string;
  audience: string;
  skillLevel: string;
  steps: SOPStep[];
  headerImage: SOPMediaItem | null;
  stepImages: Record<string, SOPMediaItem>;
  tools: string;
  materials: string;
  ppe: string;
  safetyNotes: string;
  complianceNotes: string;
  timingTarget: string;
  timingMax: string;
  needsMaterialCalculator?: boolean;
  calculatorDefaults?: MaterialCalculatorData | null;
  calculatorHtml?: string;
  imageSuggestions?: ImageSuggestion[];
}

const WIZARD_STEPS = [
  { id: "type", label: "SOP Type", icon: FileText },
  { id: "identity", label: "Identity", icon: ClipboardList },
  { id: "outcome", label: "Outcome", icon: Target },
  { id: "audience", label: "Audience", icon: Users },
  { id: "steps", label: "Steps", icon: ClipboardList },
  { id: "media", label: "Media", icon: ImageIcon },
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
            className={`cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.02] ${data.sopType === type.value ? "border-primary ring-2 ring-primary/20 shadow-sm" : ""}`}
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

function StepIdentity({ data, onChange, categories, onAiSuggest, isAiSuggesting }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void; categories: SopCategory[]; onAiSuggest?: () => void; isAiSuggesting?: boolean }) {
  const { toast } = useToast();
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const classifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classifyTitle = useCallback(async (title: string) => {
    if (title.trim().length < 3) {
      onChange({ classification: null, superCategory: "", subCategory: "", categoryId: "", category: "" });
      return;
    }
    setIsClassifying(true);
    try {
      const res = await apiRequest("POST", "/api/sop-classify", { title });
      const classification = await res.json();
      const updates: Partial<SOPBuilderData> = {
        classification,
        superCategory: classification.superCategory || "",
        subCategory: classification.subCategory || "",
      };
      if (classification.mainCategory && classification.confidence >= 0.5 && categories.length > 0) {
        const classToTopicMap: Record<string, string> = {
          "maintenance & service": "property maintenance & services",
          "emergency & exceptions": "emergency & exception",
        };
        const mappedName = classToTopicMap[classification.mainCategory.toLowerCase()] || classification.mainCategory.toLowerCase();
        let matchedCat = categories.find(c => c.name.toLowerCase() === mappedName);
        if (!matchedCat) {
          matchedCat = categories.find(c => c.name.toLowerCase() === classification.mainCategory.toLowerCase());
        }
        if (!matchedCat) {
          matchedCat = categories.find(c =>
            c.name.toLowerCase().includes(classification.mainCategory.toLowerCase()) ||
            classification.mainCategory.toLowerCase().includes(c.name.toLowerCase())
          );
        }
        if (matchedCat) {
          updates.categoryId = matchedCat.id;
          updates.category = matchedCat.name;
        }
      }
      onChange(updates);
    } catch {
      onChange({ classification: null });
    } finally {
      setIsClassifying(false);
    }
  }, [onChange, categories]);

  const handleTitleChange = useCallback((title: string) => {
    onChange({ title });
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    classifyTimerRef.current = setTimeout(() => classifyTitle(title), 500);
  }, [onChange, classifyTitle]);

  useEffect(() => {
    return () => {
      if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    };
  }, []);

  const createTopicMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/sop-categories", { name });
      return await res.json();
    },
    onSuccess: (newCat: SopCategory) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop-categories"] });
      onChange({ categoryId: newCat.id, category: newCat.name });
      setNewTopicName("");
      setShowNewTopic(false);
      toast({ title: "Topic created", description: `"${newCat.name}" has been added.` });
    },
    onError: () => {
      toast({ title: "Failed to create topic", variant: "destructive" });
    },
  });

  const confidenceColor = data.classification
    ? data.classification.confidence >= 0.8
      ? "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800"
      : data.classification.confidence >= 0.5
        ? "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800"
        : "text-gray-500 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900/30 dark:border-gray-700"
    : "";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">SOP Identity</h3>
        <p className="text-sm text-muted-foreground">Give your SOP a clear name and assign it to a topic. We'll auto-detect the category for you.</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="sop-title">SOP Title *</Label>
          <Input
            id="sop-title"
            value={data.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g., Plant a Tree (Balled & Burlapped)"
            data-testid="input-sop-title"
          />
          <p className="text-xs text-muted-foreground mt-1">Choose a clear, action-oriented title</p>

          {isClassifying && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Classifying...</span>
            </div>
          )}

          {data.classification && !isClassifying && data.classification.confidence >= 0.3 && (
            <div className={`mt-3 p-3 rounded-lg border ${confidenceColor} transition-all`} data-testid="classification-result">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4" />
                <span className="font-medium text-sm">Auto-Classification</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {Math.round(data.classification.confidence * 100)}% match
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium opacity-70">Super Category:</span>
                  <p className="font-semibold">{data.classification.superCategory}</p>
                </div>
                <div>
                  <span className="font-medium opacity-70">Main Category:</span>
                  <p className="font-semibold">{data.classification.mainCategory}</p>
                </div>
                <div>
                  <span className="font-medium opacity-70">Sub Category:</span>
                  <p className="font-semibold capitalize">{data.classification.subCategory}</p>
                </div>
                <div>
                  <span className="font-medium opacity-70">SOP Type:</span>
                  <p className="font-semibold">{data.classification.sopType}</p>
                </div>
              </div>
            </div>
          )}

          {onAiSuggest && data.title.trim().length >= 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAiSuggest}
              disabled={isAiSuggesting}
              className="mt-2 gap-2 text-purple-600 border-purple-300 hover:bg-purple-50 hover:border-purple-400 dark:text-purple-400 dark:border-purple-600 dark:hover:bg-purple-900/20"
              data-testid="btn-ai-suggest"
            >
              {isAiSuggesting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> AI is filling in fields...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Auto-fill with AI</>
              )}
            </Button>
          )}
        </div>
        <div>
          <Label htmlFor="sop-category">Topic *</Label>
          <Select value={data.categoryId} onValueChange={(v) => {
            if (v === "__new__") {
              setShowNewTopic(true);
              return;
            }
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
              <SelectItem value="__new__" className="text-primary font-medium">
                <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Add new topic</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {showNewTopic && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Enter new topic name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTopicName.trim()) {
                    createTopicMutation.mutate(newTopicName.trim());
                  }
                  if (e.key === "Escape") setShowNewTopic(false);
                }}
                data-testid="input-new-topic"
              />
              <Button
                size="sm"
                onClick={() => newTopicName.trim() && createTopicMutation.mutate(newTopicName.trim())}
                disabled={!newTopicName.trim() || createTopicMutation.isPending}
                data-testid="button-create-topic"
              >
                {createTopicMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowNewTopic(false); setNewTopicName(""); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
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
              className={`cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.01] p-3 ${data.outcomeType === type.value ? "border-primary ring-2 ring-primary/20 shadow-sm" : ""}`}
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
              className={`cursor-pointer transition-all hover:border-primary hover:shadow-md hover:scale-[1.01] p-3 ${data.skillLevel === level.value ? "border-primary ring-2 ring-primary/20 shadow-sm" : ""}`}
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
            <Button onClick={addStep} className="hover:shadow-md hover:brightness-110 transition-all" data-testid="button-add-first-step">
              <Plus className="h-4 w-4 mr-2" /> Add First Step
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg bg-muted/20">
          <div className="overflow-y-auto max-h-[calc(100vh-350px)] min-h-[200px] p-2 space-y-2">
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted transition-colors" onClick={(e) => { e.stopPropagation(); moveStep(index, "up"); }} disabled={index === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted transition-colors" onClick={(e) => { e.stopPropagation(); moveStep(index, "down"); }} disabled={index === data.steps.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 transition-colors" onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}>
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
                          rows={4}
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
            <Button variant="outline" onClick={addStep} className="w-full hover:shadow-md hover:border-primary/50 transition-all" data-testid="button-add-step">
              <Plus className="h-4 w-4 mr-2" /> Add Step
            </Button>
          </div>
        </div>
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

const AI_STYLES = [
  { value: "photoreal", label: "Photo-Realistic", description: "Realistic photography style", icon: Camera },
  { value: "diagram", label: "Diagram", description: "Technical diagram with labels", icon: ClipboardList },
  { value: "illustration", label: "Illustration", description: "Simple, clean illustration", icon: Palette },
  { value: "icon", label: "Icon / Flat", description: "Minimal flat icon style", icon: Sparkles },
];

function AIImageGenerator({ 
  targetType, 
  stepIndex,
  onImageGenerated 
}: { 
  targetType: "sop_header" | "sop_step";
  stepIndex?: number;
  onImageGenerated: (media: SOPMediaItem) => void;
}) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("photoreal");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [preview, setPreview] = useState<SOPMediaItem | null>(null);
  const [internalUseOnly, setInternalUseOnly] = useState(true);

  const { data: aiSettings } = useQuery<{
    enabled: boolean;
    canGenerate: boolean;
    allowedRoles: string[];
    dailyLimit: number;
    monthlyLimit: number;
    watermarkDefault: boolean;
    dailyUsed: number;
    monthlyUsed: number;
  }>({
    queryKey: ["/api/ai-image-settings"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sop-media/ai-generate", {
        targetType,
        stepIndex,
        prompt,
        negativePrompt: negativePrompt || undefined,
        style,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setPreview({
        id: data.id,
        url: data.url,
        alt: data.alt || prompt,
        source: "ai_generated",
        aiPrompt: prompt,
        aiStyle: style,
      });
      toast({ title: "Image generated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  if (!aiSettings?.enabled) {
    return (
      <div className="text-center py-6 text-muted-foreground" data-testid="ai-disabled-message">
        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">AI image generation is currently disabled.</p>
        <p className="text-xs mt-1">An Admin can enable it in Company Settings.</p>
      </div>
    );
  }

  if (!aiSettings?.canGenerate) {
    return (
      <div className="text-center py-6 text-muted-foreground" data-testid="ai-disabled-message">
        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">AI image generation is not available for your role.</p>
        <p className="text-xs mt-1">Ask an Admin to enable this feature.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="ai-image-generator">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Daily: {aiSettings?.dailyUsed || 0}/{aiSettings?.dailyLimit || 10}</span>
        <span>Monthly: {aiSettings?.monthlyUsed || 0}/{aiSettings?.monthlyLimit || 200}</span>
      </div>

      <div>
        <Label>Style</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {AI_STYLES.map((s) => {
            const Icon = s.icon;
            return (
              <Card
                key={s.value}
                className={`cursor-pointer p-2 transition-all hover:border-primary ${style === s.value ? "border-primary ring-1 ring-primary/30" : ""}`}
                onClick={() => setStyle(s.value)}
                data-testid={`style-${s.value}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">{s.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="ai-prompt">Describe the image *</Label>
        <Textarea
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A crew member properly staking a newly planted tree with rubber ties"
          rows={3}
          data-testid="input-ai-prompt"
        />
        <p className="text-xs text-muted-foreground mt-1">Be specific about what you want to see</p>
      </div>

      <div>
        <Label htmlFor="ai-negative">Avoid (optional)</Label>
        <Input
          id="ai-negative"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="e.g., text, watermark, low quality"
          data-testid="input-ai-negative"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="internal-use"
          checked={internalUseOnly}
          onCheckedChange={setInternalUseOnly}
          data-testid="switch-internal-use"
        />
        <Label htmlFor="internal-use" className="text-xs cursor-pointer">Internal training use only</Label>
      </div>

      <Button
        onClick={() => generateMutation.mutate()}
        disabled={!prompt.trim() || generateMutation.isPending}
        className="w-full"
        data-testid="btn-generate-ai-image"
      >
        {generateMutation.isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
        ) : (
          <><Sparkles className="h-4 w-4 mr-2" /> Generate Image</>
        )}
      </Button>

      {preview && (
        <Card data-testid="ai-preview">
          <CardContent className="p-3 space-y-3">
            <div className="relative">
              <img
                src={`/api/objects${preview.url.replace("/objects", "")}`}
                alt={preview.alt}
                className="w-full rounded-md border max-h-64 object-contain bg-muted"
                data-testid="ai-preview-image"
              />
              <Badge className="absolute top-2 left-2 bg-purple-600 text-white text-xs" data-testid="badge-ai">
                <Sparkles className="h-3 w-3 mr-1" /> AI
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onImageGenerated(preview);
                  setPreview(null);
                  setPrompt("");
                }}
                className="flex-1"
                data-testid="btn-save-ai-image"
              >
                <Check className="h-4 w-4 mr-1" /> Save to SOP
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreview(null)}
                data-testid="btn-discard-ai-image"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MaterialCalculatorPopup({ defaults, onConfirm, onCancel }: { defaults: MaterialCalculatorData; onConfirm: (depth: number, html: string) => void; onCancel: () => void }) {
  const [depth, setDepth] = useState(defaults.defaultDepthInches);
  const [length, setLength] = useState(10);
  const [width, setWidth] = useState(10);

  const sqFt = length * width;
  const cubicYards = (sqFt * depth) / 324;
  const roundedYards = Math.ceil(cubicYards * 10) / 10;

  const calcHtml = `<div class="sop-calculator" style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:16px;margin:16px 0;">
<h3 style="margin:0 0 8px;color:#16a34a;">📐 ${defaults.materialType.charAt(0).toUpperCase() + defaults.materialType.slice(1)} Calculator</h3>
<p style="font-size:13px;color:#666;margin:0 0 8px;">${defaults.coverageNote}</p>
<p style="font-size:13px;margin:0;"><strong>Recommended depth:</strong> ${depth} inches</p>
<p style="font-size:13px;margin:4px 0;"><strong>Formula:</strong> (Length × Width × Depth) ÷ 324 = Cubic Yards</p>
<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
<tr style="background:#dcfce7;"><th style="padding:6px;text-align:left;border:1px solid #86efac;">Area (sq ft)</th><th style="padding:6px;text-align:center;border:1px solid #86efac;">@ ${depth}" depth</th></tr>
<tr><td style="padding:6px;border:1px solid #e5e7eb;">100 sq ft</td><td style="padding:6px;text-align:center;border:1px solid #e5e7eb;">${(100 * depth / 324).toFixed(1)} cu yd</td></tr>
<tr><td style="padding:6px;border:1px solid #e5e7eb;">250 sq ft</td><td style="padding:6px;text-align:center;border:1px solid #e5e7eb;">${(250 * depth / 324).toFixed(1)} cu yd</td></tr>
<tr><td style="padding:6px;border:1px solid #e5e7eb;">500 sq ft</td><td style="padding:6px;text-align:center;border:1px solid #e5e7eb;">${(500 * depth / 324).toFixed(1)} cu yd</td></tr>
<tr><td style="padding:6px;border:1px solid #e5e7eb;">1000 sq ft</td><td style="padding:6px;text-align:center;border:1px solid #e5e7eb;">${(1000 * depth / 324).toFixed(1)} cu yd</td></tr>
</table>
</div>`;

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            📐 {defaults.materialType.charAt(0).toUpperCase() + defaults.materialType.slice(1)} Depth Calculator
          </AlertDialogTitle>
          <AlertDialogDescription>
            Set the depth you want to use for this SOP. A coverage calculator will be added to the SOP content.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm">
            <p className="text-muted-foreground">{defaults.coverageNote}</p>
          </div>
          <div>
            <Label>Depth (inches)</Label>
            <div className="flex items-center gap-3 mt-1">
              <Input
                type="number"
                value={depth}
                onChange={(e) => setDepth(parseFloat(e.target.value) || 0)}
                min={0.5}
                max={12}
                step={0.5}
                className="w-24"
                data-testid="input-calc-depth"
              />
              <span className="text-sm text-muted-foreground">inches (recommended: {defaults.defaultDepthInches}")</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Length (ft)</Label>
              <Input type="number" value={length} onChange={(e) => setLength(parseFloat(e.target.value) || 0)} min={1} data-testid="input-calc-length" />
            </div>
            <div>
              <Label className="text-xs">Width (ft)</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0)} min={1} data-testid="input-calc-width" />
            </div>
          </div>
          <Card className="bg-muted/50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Quick Preview</p>
              <p className="text-2xl font-bold text-green-600">{roundedYards} cubic yards</p>
              <p className="text-xs text-muted-foreground">for {sqFt} sq ft at {depth}" depth</p>
            </CardContent>
          </Card>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Skip Calculator</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(depth, calcHtml)} data-testid="btn-add-calculator">
            Add Calculator to SOP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StepMedia({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  return (
    <div className="space-y-6" data-testid="step-media">
      <div>
        <h3 className="text-lg font-semibold">Media & Images</h3>
        <p className="text-sm text-muted-foreground">Add images to your SOP header and individual steps using AI generation.</p>
      </div>

      {data.imageSuggestions && data.imageSuggestions.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" /> AI Image Suggestions
              <Badge variant="outline" className="text-xs ml-auto">{data.imageSuggestions.length} suggestion{data.imageSuggestions.length > 1 ? "s" : ""}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Ready-to-use prompts for image generation. Click to use a prompt below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {data.imageSuggestions.sort((a, b) => a.priority - b.priority).map((suggestion, idx) => {
              const isHeader = suggestion.target === "header";
              const stepIdx = isHeader ? -1 : parseInt(suggestion.target.replace("step_", ""));
              const stepTitle = !isHeader && data.steps[stepIdx] ? data.steps[stepIdx].title : "";
              const alreadyHasImage = isHeader ? !!data.headerImage : (data.steps[stepIdx] && !!data.stepImages[data.steps[stepIdx]?.id]);

              return (
                <div key={idx} className={`p-3 rounded-lg border ${alreadyHasImage ? "border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20" : "border-purple-200 dark:border-purple-700"} transition-all`}>
                  <div className="flex items-start gap-2">
                    <Badge variant={suggestion.priority === 1 ? "default" : "secondary"} className="shrink-0 text-xs mt-0.5">
                      {isHeader ? "Header" : `Step ${stepIdx + 1}`}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      {!isHeader && stepTitle && <p className="text-xs font-medium text-muted-foreground mb-1">{stepTitle}</p>}
                      <p className="text-xs leading-relaxed">{suggestion.prompt}</p>
                    </div>
                    {alreadyHasImage ? (
                      <Badge variant="outline" className="shrink-0 text-xs text-green-600 border-green-300">
                        <Check className="h-3 w-3 mr-1" /> Done
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                        onClick={() => {
                          const promptInput = document.querySelector(`[data-testid="input-ai-prompt"]`) as HTMLTextAreaElement;
                          if (promptInput) {
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                            nativeInputValueSetter?.call(promptInput, suggestion.prompt);
                            promptInput.dispatchEvent(new Event('input', { bubbles: true }));
                            promptInput.focus();
                            promptInput.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                        data-testid={`btn-use-suggestion-${idx}`}
                      >
                        <Camera className="h-3 w-3 mr-1" /> Use Prompt
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Header Image
          </CardTitle>
          <CardDescription className="text-xs">A cover image for your SOP</CardDescription>
        </CardHeader>
        <CardContent>
          {data.headerImage ? (
            <div className="space-y-2">
              <div className="relative">
                <img
                  src={`/api/objects${data.headerImage.url.replace("/objects", "")}`}
                  alt={data.headerImage.alt}
                  className="w-full rounded-md border max-h-48 object-contain bg-muted"
                  data-testid="header-image-preview"
                />
                {data.headerImage.source === "ai_generated" && (
                  <Badge className="absolute top-2 left-2 bg-purple-600 text-white text-xs">
                    <Sparkles className="h-3 w-3 mr-1" /> AI
                  </Badge>
                )}
              </div>
              {data.headerImage.aiPrompt && (
                <p className="text-xs text-muted-foreground">Prompt: {data.headerImage.aiPrompt}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChange({ headerImage: null })}
                data-testid="btn-remove-header-image"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          ) : (
            <AIImageGenerator
              targetType="sop_header"
              onImageGenerated={(media) => onChange({ headerImage: media })}
            />
          )}
        </CardContent>
      </Card>

      {data.steps.filter(s => s.title).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Step Images
            </CardTitle>
            <CardDescription className="text-xs">Add images to individual steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.steps.filter(s => s.title).map((step, idx) => (
              <div key={step.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Step {idx + 1}: {step.title}</p>
                  {data.stepImages[step.id] && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const newImages = { ...data.stepImages };
                        delete newImages[step.id];
                        onChange({ stepImages: newImages });
                      }}
                      data-testid={`btn-remove-step-image-${idx}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {data.stepImages[step.id] ? (
                  <div className="relative">
                    <img
                      src={`/api/objects${data.stepImages[step.id].url.replace("/objects", "")}`}
                      alt={data.stepImages[step.id].alt}
                      className="w-full rounded border max-h-36 object-contain bg-muted"
                      data-testid={`step-image-preview-${idx}`}
                    />
                    {data.stepImages[step.id].source === "ai_generated" && (
                      <Badge className="absolute top-1 left-1 bg-purple-600 text-white text-[10px]">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                      </Badge>
                    )}
                  </div>
                ) : (
                  <AIImageGenerator
                    targetType="sop_step"
                    stepIndex={idx}
                    onImageGenerated={(media) => {
                      onChange({ stepImages: { ...data.stepImages, [step.id]: media } });
                    }}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
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

      {data.classification && data.classification.confidence >= 0.3 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Auto-Classification
              <Badge variant="outline" className="text-xs ml-auto">
                {Math.round(data.classification.confidence * 100)}% match
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Super Category:</span>
                <p className="font-medium">{data.classification.superCategory}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Main Category:</span>
                <p className="font-medium">{data.classification.mainCategory}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sub Category:</span>
                <p className="font-medium capitalize">{data.classification.subCategory}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Classified Type:</span>
                <p className="font-medium">{data.classification.sopType}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {(data.headerImage || Object.keys(data.stepImages).length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Media</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {data.headerImage && (
                <div className="relative w-20 h-20 rounded border overflow-hidden">
                  <img src={`/api/objects${data.headerImage.url.replace("/objects", "")}`} alt="Header" className="w-full h-full object-cover" />
                  {data.headerImage.source === "ai_generated" && (
                    <Badge className="absolute top-0.5 left-0.5 bg-purple-600 text-white text-[8px] px-1 py-0"><Sparkles className="h-2 w-2" /></Badge>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center">Header</span>
                </div>
              )}
              {data.steps.map((step, idx) => data.stepImages[step.id] ? (
                <div key={step.id} className="relative w-20 h-20 rounded border overflow-hidden">
                  <img src={`/api/objects${data.stepImages[step.id].url.replace("/objects", "")}`} alt={`Step ${idx+1}`} className="w-full h-full object-cover" />
                  {data.stepImages[step.id].source === "ai_generated" && (
                    <Badge className="absolute top-0.5 left-0.5 bg-purple-600 text-white text-[8px] px-1 py-0"><Sparkles className="h-2 w-2" /></Badge>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center">Step {idx+1}</span>
                </div>
              ) : null)}
            </div>
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

  if (data.headerImage) {
    const imgSrc = `/api/objects${data.headerImage.url.replace("/objects", "")}`;
    html += `<div class="sop-header-image" style="margin-bottom:16px;text-align:center;">`;
    html += `<img src="${imgSrc}" alt="${data.headerImage.alt || ""}" style="max-width:100%;max-height:300px;border-radius:8px;" />`;
    if (data.headerImage.source === "ai_generated") {
      html += `<p style="font-size:11px;color:#888;margin-top:4px;">AI Generated</p>`;
    }
    html += `</div>`;
  }

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

  if (data.calculatorHtml) {
    html += data.calculatorHtml;
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
      if (data.stepImages[step.id]) {
        const stepImg = data.stepImages[step.id];
        const imgSrc = `/api/objects${stepImg.url.replace("/objects", "")}`;
        html += `<div style="margin:8px 0;"><img src="${imgSrc}" alt="${stepImg.alt || ""}" style="max-width:100%;max-height:200px;border-radius:6px;border:1px solid #eee;" />`;
        if (stepImg.source === "ai_generated") html += `<span style="font-size:10px;color:#888;"> AI Generated</span>`;
        html += `</div>`;
      }
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
  onComplete: (sopData: { title: string; category: string; categoryId: string; content: string; superCategory?: string; subCategory?: string; sopType?: string }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  initialData?: SOPBuilderData & { draftId?: number };
  onSaveDraft?: (draftData: { title: string; categoryId: string; sopType: string; currentStep: number; data: SOPBuilderData; draftId?: number }) => void;
  isSavingDraft?: boolean;
}

const INITIAL_DATA: SOPBuilderData = {
  title: "",
  category: "",
  categoryId: "",
  sopType: "",
  superCategory: "",
  subCategory: "",
  classification: null,
  outcome: "",
  outcomeType: "",
  audience: "",
  skillLevel: "",
  steps: [createEmptyStep()],
  headerImage: null,
  stepImages: {},
  tools: "",
  materials: "",
  ppe: "",
  safetyNotes: "",
  complianceNotes: "",
  timingTarget: "",
  timingMax: "",
};

export default function SOPBuilder({ categories, onComplete, onCancel, isSubmitting, initialData, onSaveDraft, isSavingDraft }: SOPBuilderProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<SOPBuilderData>(initialData || { ...INITIAL_DATA, steps: [createEmptyStep()] });
  const [draftId, setDraftId] = useState<number | undefined>(initialData?.draftId);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNavDialog, setShowNavDialog] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  const isDirty = useMemo(() => {
    const base = initialData || INITIAL_DATA;
    return data.title !== base.title || 
      data.sopType !== base.sopType || 
      data.categoryId !== base.categoryId ||
      data.outcome !== base.outcome ||
      data.outcomeType !== base.outcomeType ||
      data.audience !== base.audience ||
      data.skillLevel !== base.skillLevel ||
      data.tools !== base.tools ||
      data.materials !== base.materials ||
      data.ppe !== base.ppe ||
      data.safetyNotes !== base.safetyNotes ||
      data.complianceNotes !== base.complianceNotes ||
      data.timingTarget !== base.timingTarget ||
      data.timingMax !== base.timingMax ||
      data.headerImage !== base.headerImage ||
      Object.keys(data.stepImages).length > 0 ||
      data.steps.some(s => s.title || s.instruction);
  }, [data, initialData]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNavPath(href);
      setShowNavDialog(true);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty]);

  const confirmNavigation = () => {
    setShowNavDialog(false);
    if (pendingNavPath) {
      navigate(pendingNavPath);
    }
    setPendingNavPath(null);
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      onCancel();
    }
  };

  const handleSaveDraft = () => {
    if (!onSaveDraft) return;
    onSaveDraft({
      title: data.title || "Untitled Draft",
      categoryId: data.categoryId,
      sopType: data.sopType,
      currentStep,
      data,
      draftId,
    });
  };

  const [showCalculatorPopup, setShowCalculatorPopup] = useState(false);
  const [pendingCalcDefaults, setPendingCalcDefaults] = useState<MaterialCalculatorData | null>(null);

  const handleAiSuggest = async () => {
    if (!data.title.trim()) {
      toast({ title: "Enter a title first", description: "We need a title to generate suggestions.", variant: "destructive" });
      return;
    }
    setIsAiSuggesting(true);
    try {
      const res = await apiRequest("POST", "/api/sop-suggest", {
        title: data.title,
        sopType: data.sopType,
        category: data.category,
      });
      const suggestions = await res.json();
      const classification = suggestions.classification || null;

      const validOutcomeTypes = ["completion", "quality", "safety", "kpi"];
      let resolvedOutcomeType = suggestions.outcomeType || "";
      if (resolvedOutcomeType && !validOutcomeTypes.includes(resolvedOutcomeType)) {
        const lower = resolvedOutcomeType.toLowerCase();
        if (lower.includes("quality")) resolvedOutcomeType = "quality";
        else if (lower.includes("safety")) resolvedOutcomeType = "safety";
        else if (lower.includes("kpi") || lower.includes("measur")) resolvedOutcomeType = "kpi";
        else resolvedOutcomeType = "completion";
      }
      if (!resolvedOutcomeType) {
        const title = data.title.toLowerCase();
        if (title.includes("safety") || title.includes("emergency") || title.includes("hazard")) resolvedOutcomeType = "safety";
        else if (title.includes("quality") || title.includes("inspection") || title.includes("check")) resolvedOutcomeType = "quality";
        else resolvedOutcomeType = "completion";
      }

      setData(prev => {
        const updates: Partial<SOPBuilderData> = {
          outcome: suggestions.outcome || prev.outcome || "",
          outcomeType: resolvedOutcomeType || prev.outcomeType || "completion",
          audience: prev.audience || suggestions.audience || "",
          skillLevel: prev.skillLevel || suggestions.skillLevel || "",
          steps: (prev.steps.length <= 1 && !prev.steps[0]?.title) ? (suggestions.steps || prev.steps) : prev.steps,
          tools: prev.tools || suggestions.tools || "",
          materials: prev.materials || suggestions.materials || "",
          ppe: prev.ppe || suggestions.ppe || "",
          safetyNotes: prev.safetyNotes || suggestions.safetyNotes || "",
          complianceNotes: prev.complianceNotes || suggestions.complianceNotes || "",
          timingTarget: prev.timingTarget || suggestions.timingTarget || "",
          timingMax: prev.timingMax || suggestions.timingMax || "",
          classification: classification || prev.classification,
          superCategory: classification?.superCategory || prev.superCategory || "",
          subCategory: classification?.subCategory || prev.subCategory || "",
          imageSuggestions: suggestions.imageSuggestions || [],
          needsMaterialCalculator: suggestions.needsMaterialCalculator || false,
          calculatorDefaults: suggestions.calculatorDefaults || null,
        };

        if (suggestions.suggestedTopicId) {
          updates.categoryId = suggestions.suggestedTopicId;
          updates.category = suggestions.suggestedTopicName || "";
        }

        return { ...prev, ...updates };
      });

      if (suggestions.needsMaterialCalculator && suggestions.calculatorDefaults) {
        setPendingCalcDefaults(suggestions.calculatorDefaults);
        setShowCalculatorPopup(true);
      }

      const imgCount = suggestions.imageSuggestions?.length || 0;
      const topicMsg = suggestions.suggestedTopicId ? ` Topic "${suggestions.suggestedTopicName}" selected.` : (suggestions.suggestedTopicName ? ` Suggested new topic: "${suggestions.suggestedTopicName}".` : "");
      const imgMsg = imgCount > 0 ? ` ${imgCount} image suggestion${imgCount > 1 ? "s" : ""} ready on the Media tab.` : "";
      const calcMsg = suggestions.needsMaterialCalculator ? " Material calculator available." : "";
      toast({ title: "AI suggestions applied", description: `Fields auto-filled.${topicMsg}${imgMsg}${calcMsg} Review and adjust as needed.` });
    } catch (err: any) {
      toast({ title: "AI suggestion failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsAiSuggesting(false);
    }
  };

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
      case 6: return true;
      case 7: {
        const isSafetyType = data.sopType === "safety" || data.sopType === "emergency";
        return !isSafetyType || (!!data.safetyNotes || !!data.complianceNotes);
      }
      case 8: return true;
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
      superCategory: data.superCategory || undefined,
      subCategory: data.subCategory || undefined,
      sopType: data.sopType || undefined,
    });
  };

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepTypeSelection data={data} onChange={updateData} />;
      case 1: return <StepIdentity data={data} onChange={updateData} categories={categories} onAiSuggest={handleAiSuggest} isAiSuggesting={isAiSuggesting} />;
      case 2: return <StepOutcome data={data} onChange={updateData} />;
      case 3: return <StepAudience data={data} onChange={updateData} />;
      case 4: return <StepBuilder data={data} onChange={updateData} />;
      case 5: return <StepMedia data={data} onChange={updateData} />;
      case 6: return <StepToolsMaterials data={data} onChange={updateData} />;
      case 7: return <StepSafety data={data} onChange={updateData} />;
      case 8: return <StepReview data={data} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 pb-20" data-testid="sop-builder">
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved work in the SOP Builder. If you cancel now, all your progress will be lost. You can also save to drafts to continue later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-stay">Keep Working</AlertDialogCancel>
            {onSaveDraft && (
              <Button
                variant="outline"
                onClick={() => { setShowCancelDialog(false); handleSaveDraft(); }}
                disabled={isSavingDraft}
                data-testid="btn-cancel-save-draft"
              >
                <Clock className="h-4 w-4 mr-2" /> Save to Drafts
              </Button>
            )}
            <AlertDialogAction
              onClick={() => { setShowCancelDialog(false); onCancel(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-cancel-confirm"
            >
              Discard & Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showCalculatorPopup && pendingCalcDefaults && (
        <MaterialCalculatorPopup
          defaults={pendingCalcDefaults}
          onConfirm={(depth, html) => {
            setData(prev => ({ ...prev, calculatorHtml: html }));
            setShowCalculatorPopup(false);
            setPendingCalcDefaults(null);
            toast({ title: "Calculator added", description: `${pendingCalcDefaults.materialType} calculator at ${depth}" depth will be included in your SOP.` });
          }}
          onCancel={() => {
            setShowCalculatorPopup(false);
            setPendingCalcDefaults(null);
          }}
        />
      )}

      <AlertDialog open={showNavDialog} onOpenChange={setShowNavDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the SOP Builder. If you navigate away now, your progress will be lost. Would you like to save to drafts first?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNavPath(null)} data-testid="btn-nav-stay">Stay Here</AlertDialogCancel>
            {onSaveDraft && (
              <Button
                variant="outline"
                onClick={() => { setShowNavDialog(false); handleSaveDraft(); }}
                disabled={isSavingDraft}
                data-testid="btn-nav-save-draft"
              >
                <Clock className="h-4 w-4 mr-2" /> Save & Leave
              </Button>
            )}
            <AlertDialogAction
              onClick={confirmNavigation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-nav-leave"
            >
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            SOP Builder
          </h2>
          <p className="text-muted-foreground text-sm">Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].label}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancelClick}
          className="hover:bg-destructive/10 hover:text-destructive transition-colors"
          data-testid="button-exit-builder"
        >
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
            <div
              key={step.id}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors select-none ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground"
              }`}
              data-testid={`wizard-step-${step.id}`}
            >
              {isComplete ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              {step.label}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="hover:bg-muted/80 transition-colors"
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <Button
          variant="outline"
          onClick={handleCancelClick}
          className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          data-testid="button-wizard-exit"
        >
          Cancel
        </Button>

        {onSaveDraft && (
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSavingDraft || !data.title.trim()}
            className="hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-900/20 transition-colors"
            data-testid="button-save-draft"
          >
            {isSavingDraft ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
            Save to Drafts
          </Button>
        )}

        {currentStep === WIZARD_STEPS.length - 1 ? (
          <Button
            onClick={handleCreate}
            disabled={isSubmitting || !canProceed()}
            className="hover:brightness-110 hover:shadow-md transition-all"
            data-testid="button-wizard-create"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Create SOP
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="hover:brightness-110 hover:shadow-md transition-all"
            data-testid="button-wizard-next"
          >
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
