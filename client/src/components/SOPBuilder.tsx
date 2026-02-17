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
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";
import { showErrorToast } from "@/lib/errorToast";
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
  ZoomIn,
  Search,
  Download,
  BookOpen,
  Cog,
  ListChecks,
  BookOpenCheck,
  GraduationCap,
  Pencil,
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

interface CalculatorPreset {
  label: string;
  values: Record<string, number>;
}

interface MaterialCalculatorData {
  materialType: string;
  defaultDepthInches: number;
  coverageNote: string;
  calculatorType?: string;
  presets?: CalculatorPreset[];
  assumptions?: string[];
  outputUnits?: string;
  productOrManufacturer?: string;
  measurementGuide?: string;
  densityTonsPerCubicYard?: number;
}

type CalcType = "area_volume" | "linear_volume" | "chemical_rate" | "polymeric_sand" | "bag_count";

const MATERIAL_DENSITY_DEFAULTS: Record<string, { density: number; label: string }> = {
  "mulch": { density: 0.4, label: "Mulch (industry avg)" },
  "hardwood mulch": { density: 0.45, label: "Hardwood mulch" },
  "cedar mulch": { density: 0.35, label: "Cedar mulch" },
  "pine bark mulch": { density: 0.35, label: "Pine bark mulch" },
  "rubber mulch": { density: 0.65, label: "Rubber mulch" },
  "topsoil": { density: 1.1, label: "Topsoil (industry avg)" },
  "garden soil": { density: 1.0, label: "Garden soil" },
  "compost": { density: 0.6, label: "Compost (industry avg)" },
  "sand": { density: 1.35, label: "Sand (industry avg)" },
  "mason sand": { density: 1.3, label: "Mason sand" },
  "concrete sand": { density: 1.4, label: "Concrete sand" },
  "pea gravel": { density: 1.4, label: "Pea gravel" },
  "crushed stone": { density: 1.35, label: "Crushed stone" },
  "crushed limestone": { density: 1.35, label: "Crushed limestone" },
  "crushed granite": { density: 1.4, label: "Crushed granite" },
  "river rock": { density: 1.5, label: "River rock" },
  "base aggregate": { density: 1.35, label: "Base aggregate (ICPI spec)" },
  "gravel": { density: 1.4, label: "Gravel (industry avg)" },
  "decomposed granite": { density: 1.35, label: "Decomposed granite" },
  "lava rock": { density: 0.5, label: "Lava rock" },
  "marble chips": { density: 1.4, label: "Marble chips" },
  "playground mulch": { density: 0.3, label: "Playground mulch" },
  "soil amendment": { density: 0.8, label: "Soil amendment blend" },
  "fill dirt": { density: 1.15, label: "Fill dirt" },
  "clay": { density: 1.3, label: "Clay" },
};

function getMaterialDensity(materialType: string, aiDensity?: number): { density: number; source: string } {
  if (aiDensity && aiDensity > 0.1 && aiDensity < 3.0) {
    return { density: aiDensity, source: `${materialType} (OEM/product-specific)` };
  }
  const key = materialType.toLowerCase().trim();
  for (const [matKey, matData] of Object.entries(MATERIAL_DENSITY_DEFAULTS)) {
    if (key.includes(matKey) || matKey.includes(key)) {
      return { density: matData.density, source: matData.label };
    }
  }
  return { density: 1.35, source: "General aggregate (industry default)" };
}

interface CalculatorTemplate {
  type: CalcType;
  label: string;
  inputs: { key: string; label: string; unit: string; defaultValue: number; min?: number; max?: number; step?: number }[];
  calculate: (vals: Record<string, number>, density?: number) => { label: string; value: string }[];
}

const CALCULATOR_TEMPLATES: Record<CalcType, CalculatorTemplate> = {
  area_volume: {
    type: "area_volume",
    label: "Area-Based Volume Calculator",
    inputs: [
      { key: "length", label: "Length", unit: "ft", defaultValue: 20, min: 1, step: 1 },
      { key: "width", label: "Width", unit: "ft", defaultValue: 10, min: 1, step: 1 },
      { key: "depth", label: "Depth", unit: "in", defaultValue: 3, min: 0.5, max: 24, step: 0.5 },
    ],
    calculate: (v, density = 1.35) => {
      const sqFt = v.length * v.width;
      const cubicYards = (sqFt * v.depth) / 324;
      const tons = cubicYards * density;
      return [
        { label: "Area", value: `${sqFt.toLocaleString()} sq ft` },
        { label: "Volume", value: `${(Math.ceil(cubicYards * 10) / 10).toFixed(1)} cubic yards` },
        { label: "Weight (approx)", value: `${(Math.ceil(tons * 10) / 10).toFixed(1)} tons` },
      ];
    },
  },
  linear_volume: {
    type: "linear_volume",
    label: "Linear Volume Calculator",
    inputs: [
      { key: "wallLength", label: "Wall / Trench Length", unit: "ft", defaultValue: 25, min: 1, step: 1 },
      { key: "trenchWidth", label: "Trench Width", unit: "in", defaultValue: 24, min: 6, max: 72, step: 1 },
      { key: "baseDepth", label: "Base Depth", unit: "in", defaultValue: 6, min: 1, max: 24, step: 0.5 },
    ],
    calculate: (v, density = 1.35) => {
      const trenchWidthFt = v.trenchWidth / 12;
      const baseDepthFt = v.baseDepth / 12;
      const cubicFt = v.wallLength * trenchWidthFt * baseDepthFt;
      const cubicYards = cubicFt / 27;
      const tons = cubicYards * density;
      const excavationCuYd = (v.wallLength * trenchWidthFt * (baseDepthFt + 0.5)) / 27;
      return [
        { label: "Base Aggregate", value: `${(Math.ceil(cubicYards * 10) / 10).toFixed(1)} cubic yards` },
        { label: "Weight (approx)", value: `${(Math.ceil(tons * 10) / 10).toFixed(1)} tons` },
        { label: "Excavation Volume", value: `${(Math.ceil(excavationCuYd * 10) / 10).toFixed(1)} cubic yards` },
        { label: "Geotextile Area", value: `${Math.ceil(v.wallLength * (trenchWidthFt + 2))} sq ft` },
      ];
    },
  },
  chemical_rate: {
    type: "chemical_rate",
    label: "Chemical / Fertilizer Rate Calculator",
    inputs: [
      { key: "area", label: "Treatment Area", unit: "sq ft", defaultValue: 5000, min: 100, step: 100 },
      { key: "rate", label: "Application Rate", unit: "lbs/1000 sq ft", defaultValue: 4, min: 0.1, max: 50, step: 0.1 },
      { key: "bagSize", label: "Bag/Container Size", unit: "lbs", defaultValue: 50, min: 1, step: 1 },
    ],
    calculate: (v) => {
      const totalProduct = (v.area / 1000) * v.rate;
      const bags = Math.ceil(totalProduct / v.bagSize);
      return [
        { label: "Total Product Needed", value: `${(Math.ceil(totalProduct * 10) / 10).toFixed(1)} lbs` },
        { label: "Bags/Containers", value: `${bags} × ${v.bagSize} lb bags` },
        { label: "Coverage per Bag", value: `${Math.floor((v.bagSize / v.rate) * 1000).toLocaleString()} sq ft` },
      ];
    },
  },
  polymeric_sand: {
    type: "polymeric_sand",
    label: "Polymeric Sand Calculator",
    inputs: [
      { key: "area", label: "Paver Area", unit: "sq ft", defaultValue: 200, min: 10, step: 10 },
      { key: "jointWidth", label: "Joint Width", unit: "in", defaultValue: 0.25, min: 0.0625, max: 1, step: 0.0625 },
      { key: "paverThickness", label: "Paver Thickness", unit: "in", defaultValue: 2.375, min: 1, max: 4, step: 0.125 },
      { key: "bagSize", label: "Bag Size", unit: "lbs", defaultValue: 50, min: 25, max: 55, step: 5 },
    ],
    calculate: (v) => {
      const coveragePerBag = v.bagSize / (v.jointWidth * v.paverThickness * 0.08);
      const bags = Math.ceil(v.area / coveragePerBag);
      return [
        { label: "Bags Needed", value: `${bags} × ${v.bagSize} lb bags` },
        { label: "Total Weight", value: `${bags * v.bagSize} lbs` },
        { label: "Coverage per Bag", value: `~${Math.floor(coveragePerBag)} sq ft` },
      ];
    },
  },
  bag_count: {
    type: "bag_count",
    label: "Bagged Material Calculator",
    inputs: [
      { key: "area", label: "Coverage Area", unit: "sq ft", defaultValue: 100, min: 1, step: 10 },
      { key: "depth", label: "Depth", unit: "in", defaultValue: 2, min: 0.5, max: 12, step: 0.5 },
      { key: "bagCoverage", label: "Bag Coverage", unit: "sq ft per bag", defaultValue: 8, min: 1, max: 100, step: 1 },
    ],
    calculate: (v) => {
      const bags = Math.ceil(v.area / v.bagCoverage);
      const cubicYards = (v.area * v.depth) / 324;
      return [
        { label: "Bags Needed", value: `${bags} bags` },
        { label: "Volume", value: `${(Math.ceil(cubicYards * 10) / 10).toFixed(1)} cubic yards` },
      ];
    },
  },
};

interface ImageSuggestion {
  target: string;
  prompt: string;
  priority: number;
}

interface QCChecklistItem {
  id: string;
  category: string;
  item: string;
  acceptanceCriteria: string;
  checkType: "pass_fail" | "yes_no" | "measurement" | "visual";
  required: boolean;
}

interface MaintenanceTask {
  id: string;
  taskName: string;
  frequency: string;
  procedure: string;
  notes: string;
}

interface EquipmentInfo {
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  year: string;
  engineType: string;
  fuelType: string;
}

interface OEMResearchResult {
  maintenanceSchedule: string[];
  recommendations: string[];
  warnings: string[];
  intervals: { task: string; interval: string; procedure?: string; notes?: string }[];
  source: string;
}

interface TrainingSection {
  id: string;
  chapterTitle: string;
  learningObjectives: string;
  content: string;
  keyTakeaways: string;
  practiceExercise: string;
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
  qcChecklist?: QCChecklistItem[];
  qcCategories?: string[];
  equipment?: EquipmentInfo;
  maintenanceTasks?: MaintenanceTask[];
  maintenanceType?: string;
  oemResearch?: OEMResearchResult | null;
  trainingSections?: TrainingSection[];
  trainingDuration?: string;
  trainingPrerequisites?: string;
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
  { value: "beginner", label: "Beginner & Above", description: "New to landscaping, needs detailed guidance" },
  { value: "intermediate", label: "Intermediate & Above", description: "Some experience, knows basics" },
  { value: "advanced", label: "Advanced", description: "Experienced, just needs key steps" },
  { value: "all", label: "All Levels", description: "Written for everyone to follow" },
];

const OUTCOME_TYPES = [
  { value: "completion", label: "Task Completion", example: "e.g., Tree planted correctly and staked" },
  { value: "quality", label: "Quality Standard", example: "e.g., Lawn mowed to 3 inches with clean edges" },
  { value: "safety", label: "Safety Compliance", example: "e.g., All safety checks passed before operation" },
  { value: "kpi", label: "Measurable KPI", example: "e.g., Complete 5 properties per route per day" },
];

function resolveImageSrc(url: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/objects/")) return url;
  if (url.startsWith("objects/")) return `/${url}`;
  if (url.startsWith("/api/objects/")) return url.replace("/api/objects/", "/objects/");
  return `/objects/${url}`;
}

function asMultilineText(value: any): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(v => String(v)).join("\n");
  if (typeof value === "object") {
    if (Array.isArray((value as any).items)) return (value as any).items.map((v: any) => String(v)).join("\n");
    if (Array.isArray((value as any).list)) return (value as any).list.map((v: any) => String(v)).join("\n");
  }
  return String(value);
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
      data-testid="image-lightbox"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 transition-colors"
        data-testid="lightbox-close"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="lightbox-image"
      />
      {alt && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full max-w-[80vw] truncate">
          {alt}
        </p>
      )}
    </div>
  );
}

function ClickableImage({ src, alt, className, testId }: { src: string; alt: string; className: string; testId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative group cursor-zoom-in" onClick={() => setOpen(true)}>
        <img src={src} alt={alt} className={className} data-testid={testId} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-md flex items-center justify-center">
          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
        </div>
      </div>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

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

function StepIdentity({ data, onChange, categories, onAiSuggest, isAiSuggesting, aiApplied }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void; categories: SopCategory[]; onAiSuggest?: () => void; isAiSuggesting?: boolean; aiApplied?: boolean }) {
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
    onError: (error) => {
      showErrorToast(error, "Failed to create topic");
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
              variant={aiApplied ? "outline" : "default"}
              size="default"
              onClick={onAiSuggest}
              disabled={isAiSuggesting}
              className={`mt-3 gap-2 px-5 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                aiApplied
                  ? "text-green-600 border-green-400 bg-green-50 hover:bg-green-100 hover:border-green-500 dark:text-green-400 dark:border-green-600 dark:bg-green-950/30 dark:hover:bg-green-900/40"
                  : "bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md border-purple-600 dark:bg-purple-700 dark:hover:bg-purple-600"
              }`}
              data-testid="btn-ai-suggest"
            >
              {isAiSuggesting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> AI is filling in fields...</>
              ) : aiApplied ? (
                <><Check className="h-4 w-4" /> AI Applied — Run Again</>
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

  const handleStepDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newSteps = [...data.steps];
    const [moved] = newSteps.splice(result.source.index, 1);
    newSteps.splice(result.destination.index, 0, moved);
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
          <DragDropContext onDragEnd={handleStepDragEnd}>
            <Droppable droppableId="sop-steps">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="overflow-y-auto max-h-[calc(100vh-350px)] min-h-[200px] p-2 space-y-2">
                  {data.steps.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <Card
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`border ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30 bg-background" : ""}`}
                        >
                          <div
                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                          >
                            <div {...dragProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted transition-colors" onClick={(e) => e.stopPropagation()}>
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                            <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                            <span className="font-medium text-sm truncate flex-1">
                              {step.title || `Step ${index + 1} (untitled)`}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {step.proofRequired && <Badge variant="secondary" className="text-xs">Proof</Badge>}
                              {step.isQCCheckpoint && <Badge variant="secondary" className="text-xs">QC</Badge>}
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
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <Button variant="outline" onClick={addStep} className="w-full hover:shadow-md hover:border-primary/50 transition-all" data-testid="button-add-step">
                    <Plus className="h-4 w-4 mr-2" /> Add Step
                  </Button>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}

const QC_CHECK_TYPES = [
  { value: "pass_fail", label: "Pass / Fail" },
  { value: "yes_no", label: "Yes / No" },
  { value: "measurement", label: "Measurement" },
  { value: "visual", label: "Visual Inspection" },
];

function QualityChecklistBuilder({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  const checklist = data.qcChecklist || [];
  const categories = data.qcCategories || ["General"];
  const [newCategory, setNewCategory] = useState("");

  const addItem = () => {
    const item: QCChecklistItem = {
      id: generateId(),
      category: categories[0] || "General",
      item: "",
      acceptanceCriteria: "",
      checkType: "pass_fail",
      required: true,
    };
    onChange({ qcChecklist: [...checklist, item] });
  };

  const updateItem = (id: string, updates: Partial<QCChecklistItem>) => {
    onChange({ qcChecklist: checklist.map(c => c.id === id ? { ...c, ...updates } : c) });
  };

  const removeItem = (id: string) => {
    onChange({ qcChecklist: checklist.filter(c => c.id !== id) });
  };

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      onChange({ qcCategories: [...categories, newCategory.trim()] });
      setNewCategory("");
    }
  };

  const removeCategory = (cat: string) => {
    if (categories.length <= 1) return;
    onChange({
      qcCategories: categories.filter(c => c !== cat),
      qcChecklist: checklist.map(c => c.category === cat ? { ...c, category: categories[0] } : c),
    });
  };

  const groupedItems = categories.map(cat => ({
    category: cat,
    items: checklist.filter(c => c.category === cat),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5" /> Quality Control Checklist</h3>
        <p className="text-sm text-muted-foreground">Create inspection checkpoints that can be exported as a printable checklist.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Checklist Categories</CardTitle>
          <CardDescription className="text-xs">Group your checks into categories for better organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Badge key={cat} variant="secondary" className="flex items-center gap-1 px-3 py-1" data-testid={`badge-qc-category-${cat}`}>
                {cat}
                {categories.length > 1 && (
                  <button onClick={() => removeCategory(cat)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              data-testid="input-new-qc-category"
            />
            <Button size="sm" onClick={addCategory} disabled={!newCategory.trim()} data-testid="button-add-qc-category">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {groupedItems.map(group => (
          <Card key={group.category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Check className="h-4 w-4" /> {group.category}
                <Badge variant="outline" className="text-xs ml-auto">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.items.map((item, idx) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-2" data-testid={`qc-item-${item.id}`}>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-1">{idx + 1}</Badge>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={item.item}
                        onChange={(e) => updateItem(item.id, { item: e.target.value })}
                        placeholder="What to check (e.g., Edge cuts are clean and uniform)"
                        data-testid={`input-qc-item-${idx}`}
                      />
                      <Input
                        value={item.acceptanceCriteria}
                        onChange={(e) => updateItem(item.id, { acceptanceCriteria: e.target.value })}
                        placeholder="Acceptance criteria (e.g., No gaps wider than 1/4 inch)"
                        data-testid={`input-qc-criteria-${idx}`}
                      />
                      <div className="flex gap-2 items-center">
                        <Select value={item.checkType} onValueChange={(v: any) => updateItem(item.id, { checkType: v })}>
                          <SelectTrigger className="w-40" data-testid={`select-check-type-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QC_CHECK_TYPES.map(ct => (
                              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={item.required}
                            onCheckedChange={(v) => updateItem(item.id, { required: v })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10" onClick={() => removeItem(item.id)} data-testid={`button-remove-qc-item-${idx}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const item: QCChecklistItem = { id: generateId(), category: group.category, item: "", acceptanceCriteria: "", checkType: "pass_fail", required: true };
                  onChange({ qcChecklist: [...checklist, item] });
                }}
                data-testid={`button-add-qc-item-${group.category}`}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Check to {group.category}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {checklist.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ListChecks className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No checklist items yet</p>
            <p className="text-sm text-muted-foreground mb-4">Start building your quality control checklist</p>
            <Button onClick={addItem} data-testid="button-add-first-qc-item">
              <Plus className="h-4 w-4 mr-2" /> Add First Checklist Item
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const MAINTENANCE_FOCUS = [
  { value: "specific_task", label: "Specific Task Procedure", description: "Detailed procedure for the task described in your SOP title (e.g., 'Washing a Truck' → step-by-step washing procedure)", icon: "🎯" },
  { value: "full_schedule", label: "Full Equipment Schedule", description: "Comprehensive maintenance schedule with all OEM-recommended tasks, intervals, and specs for the equipment", icon: "📋" },
];

const FREQUENCY_PRESETS = [
  "Before each use", "Daily", "Weekly", "Bi-weekly", "Monthly", "Quarterly", "Semi-annually", "Annually", "As needed", "Per manufacturer spec",
];

function MaintenanceBuilder({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  const { toast } = useToast();
  const tasks = data.maintenanceTasks || [];
  const equipment = data.equipment || { name: "", manufacturer: "", model: "", serialNumber: "", year: "", engineType: "", fuelType: "" };
  const maintenanceFocus = data.maintenanceType || "";
  const [isResearching, setIsResearching] = useState(false);
  const [showFrequencyCustom, setShowFrequencyCustom] = useState<Record<string, boolean>>({});

  const addTask = () => {
    const task: MaintenanceTask = { id: generateId(), taskName: "", frequency: "", procedure: "", notes: "" };
    onChange({ maintenanceTasks: [...tasks, task] });
  };

  const updateTask = (id: string, updates: Partial<MaintenanceTask>) => {
    onChange({ maintenanceTasks: tasks.map(t => t.id === id ? { ...t, ...updates } : t) });
  };

  const removeTask = (id: string) => {
    onChange({ maintenanceTasks: tasks.filter(t => t.id !== id) });
  };

  const handleResearch = async () => {
    if (!equipment.name && !equipment.manufacturer && !equipment.model) {
      toast({ title: "Equipment info needed", description: "Please fill in at least the equipment name or manufacturer and model.", variant: "destructive" });
      return;
    }
    if (!maintenanceFocus) {
      toast({ title: "Select a focus", description: "Please choose 'Specific Task' or 'Full Equipment Schedule' above before running AI research.", variant: "destructive" });
      return;
    }
    setIsResearching(true);
    try {
      const res = await apiRequest("POST", "/api/ai/equipment-research", {
        equipmentName: equipment.name,
        manufacturer: equipment.manufacturer,
        model: equipment.model,
        year: equipment.year,
        engineType: equipment.engineType,
        fuelType: equipment.fuelType,
        sopTitle: data.title,
        maintenanceFocus,
      });
      const result = await res.json();
      if (result.intervals && result.intervals.length > 0) {
        const newTasks: MaintenanceTask[] = result.intervals.map((interval: any) => ({
          id: generateId(),
          taskName: interval.task || "",
          frequency: interval.interval || "",
          procedure: interval.procedure || "",
          notes: interval.notes || "Based on OEM recommendation",
        }));
        onChange({
          oemResearch: result,
          maintenanceTasks: [...tasks, ...newTasks],
        });
      } else {
        onChange({ oemResearch: result });
      }
      toast({ title: "Research complete", description: `Found ${result.intervals?.length || 0} maintenance tasks with detailed procedures.` });
    } catch (err: any) {
      showErrorToast(err, "Research failed");
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><Cog className="h-5 w-5" /> Maintenance Procedure</h3>
        <p className="text-sm text-muted-foreground">
          {data.title ? (
            <>SOP: <span className="font-medium">{data.title}</span> — Choose your focus and equipment details below.</>
          ) : (
            "Define equipment details, maintenance tasks, and use AI to find OEM recommendations."
          )}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">What are you building?</CardTitle>
          <CardDescription className="text-xs">This determines what the AI generates for you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MAINTENANCE_FOCUS.map(mf => (
              <div
                key={mf.value}
                className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary hover:bg-accent hover:shadow-md hover:scale-[1.02] ${maintenanceFocus === mf.value ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""}`}
                onClick={() => onChange({ maintenanceType: mf.value })}
                data-testid={`maintenance-focus-${mf.value}`}
              >
                <p className="font-medium text-sm">{mf.icon} {mf.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{mf.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Equipment Information
          </CardTitle>
          <CardDescription className="text-xs">The more details you provide, the more accurate the AI recommendations will be</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Equipment Name *</Label>
              <Input
                value={equipment.name}
                onChange={(e) => onChange({ equipment: { ...equipment, name: e.target.value } })}
                placeholder="e.g., Silverado 3500 HD"
                data-testid="input-equipment-name"
              />
            </div>
            <div>
              <Label className="text-xs">Manufacturer *</Label>
              <Input
                value={equipment.manufacturer}
                onChange={(e) => onChange({ equipment: { ...equipment, manufacturer: e.target.value } })}
                placeholder="e.g., Chevrolet"
                data-testid="input-equipment-manufacturer"
              />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input
                value={equipment.model}
                onChange={(e) => onChange({ equipment: { ...equipment, model: e.target.value } })}
                placeholder="e.g., 3500 HD LTZ"
                data-testid="input-equipment-model"
              />
            </div>
            <div>
              <Label className="text-xs">Year</Label>
              <Input
                value={equipment.year}
                onChange={(e) => onChange({ equipment: { ...equipment, year: e.target.value } })}
                placeholder="e.g., 2022"
                data-testid="input-equipment-year"
              />
            </div>
            <div>
              <Label className="text-xs">Engine / Power Type</Label>
              <Input
                value={equipment.engineType}
                onChange={(e) => onChange({ equipment: { ...equipment, engineType: e.target.value } })}
                placeholder="e.g., Duramax 6.6L V8 Turbo Diesel"
                data-testid="input-equipment-engine"
              />
            </div>
            <div>
              <Label className="text-xs">Fuel Type</Label>
              <Input
                value={equipment.fuelType}
                onChange={(e) => onChange({ equipment: { ...equipment, fuelType: e.target.value } })}
                placeholder="e.g., Diesel, Gasoline, Electric"
                data-testid="input-equipment-fuel"
              />
            </div>
            <div>
              <Label className="text-xs">Serial/VIN Number</Label>
              <Input
                value={equipment.serialNumber}
                onChange={(e) => onChange({ equipment: { ...equipment, serialNumber: e.target.value } })}
                placeholder="Optional — helps identify exact configuration"
                data-testid="input-equipment-serial"
              />
            </div>
          </div>
          <Button
            onClick={handleResearch}
            disabled={isResearching || (!equipment.name && !equipment.manufacturer) || !maintenanceFocus}
            className="w-full"
            variant="default"
            data-testid="button-ai-research"
          >
            {isResearching ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Researching OEM Documentation...</>
            ) : (
              <><Search className="h-4 w-4 mr-2" /> AI Research — {maintenanceFocus === "specific_task" ? `Find Procedure for "${data.title || "This Task"}"` : "Find OEM Maintenance Schedule"}</>
            )}
          </Button>
          {!maintenanceFocus && (
            <p className="text-xs text-amber-600 text-center">Select a focus above to enable AI Research</p>
          )}
        </CardContent>
      </Card>

      {data.oemResearch && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" /> OEM Research Results
              <Badge variant="outline" className="text-xs ml-auto text-blue-600">{data.oemResearch.source}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.oemResearch.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Recommendations</p>
                <ul className="text-xs space-y-1">
                  {data.oemResearch.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2"><Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" /> {r}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.oemResearch.warnings.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Warnings</p>
                <ul className="text-xs space-y-1">
                  {data.oemResearch.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2"><AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" /> {w}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.oemResearch.maintenanceSchedule.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Maintenance Schedule</p>
                <ul className="text-xs space-y-1">
                  {data.oemResearch.maintenanceSchedule.map((s, i) => (
                    <li key={i} className="flex gap-2"><Cog className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" /> {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Maintenance Tasks
            <Badge variant="outline" className="text-xs ml-auto">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-6">
              <Cog className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No maintenance tasks yet. Add them manually or use AI Research above.</p>
              <Button onClick={addTask} data-testid="button-add-first-maintenance-task">
                <Plus className="h-4 w-4 mr-2" /> Add First Task
              </Button>
            </div>
          ) : (
            <>
              {tasks.map((task, idx) => (
                <div key={task.id} className="border rounded-lg p-3 space-y-2" data-testid={`maintenance-task-${idx}`}>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-1">{idx + 1}</Badge>
                    <div className="flex-1 space-y-2">
                      <div>
                        <Label className="text-xs mb-1 block">Task Name</Label>
                        <Input
                          value={task.taskName}
                          onChange={(e) => updateTask(task.id, { taskName: e.target.value })}
                          placeholder="Task name (e.g., Change engine oil)"
                          data-testid={`input-task-name-${idx}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Recurring Interval</Label>
                        {showFrequencyCustom[task.id] || (task.frequency && !FREQUENCY_PRESETS.includes(task.frequency)) ? (
                          <div className="flex gap-2">
                            <Input
                              value={task.frequency}
                              onChange={(e) => updateTask(task.id, { frequency: e.target.value })}
                              placeholder="e.g., Every 7,500 miles or 250 hours"
                              data-testid={`input-frequency-custom-${idx}`}
                            />
                            <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => { setShowFrequencyCustom(prev => ({ ...prev, [task.id]: false })); updateTask(task.id, { frequency: "" }); }}>
                              Presets
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Select value={task.frequency} onValueChange={(v) => updateTask(task.id, { frequency: v })}>
                              <SelectTrigger data-testid={`select-frequency-${idx}`}>
                                <SelectValue placeholder="Select interval..." />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_PRESETS.map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setShowFrequencyCustom(prev => ({ ...prev, [task.id]: true }))}>
                              Custom
                            </Button>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Step-by-Step Procedure</Label>
                        <Textarea
                          value={task.procedure}
                          onChange={(e) => updateTask(task.id, { procedure: e.target.value })}
                          placeholder="Detailed step-by-step procedure for this task..."
                          rows={4}
                          data-testid={`input-task-procedure-${idx}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Notes & OEM References</Label>
                        <Input
                          value={task.notes}
                          onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                          placeholder="Tips, common mistakes to avoid, OEM references..."
                          data-testid={`input-task-notes-${idx}`}
                        />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10" onClick={() => removeTask(task.id)} data-testid={`button-remove-task-${idx}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={addTask} data-testid="button-add-maintenance-task">
                <Plus className="h-4 w-4 mr-2" /> Add Task
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrainingGuideBuilder({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  const sections = data.trainingSections || [];
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const addSection = () => {
    const section: TrainingSection = {
      id: generateId(),
      chapterTitle: "",
      learningObjectives: "",
      content: "",
      keyTakeaways: "",
      practiceExercise: "",
    };
    onChange({ trainingSections: [...sections, section] });
    setExpandedSection(section.id);
  };

  const updateSection = (id: string, updates: Partial<TrainingSection>) => {
    onChange({ trainingSections: sections.map(s => s.id === id ? { ...s, ...updates } : s) });
  };

  const removeSection = (id: string) => {
    onChange({ trainingSections: sections.filter(s => s.id !== id) });
    if (expandedSection === id) setExpandedSection(null);
  };

  const handleChapterDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(result.source.index, 1);
    newSections.splice(result.destination.index, 0, moved);
    onChange({ trainingSections: newSections });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Training Guide Chapters</h3>
        <p className="text-sm text-muted-foreground">Build your training guide as a series of chapters. Each chapter has learning objectives, content, key takeaways, and practice exercises.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Training Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Estimated Duration</Label>
              <Input
                value={data.trainingDuration || ""}
                onChange={(e) => onChange({ trainingDuration: e.target.value })}
                placeholder="e.g., 2 hours, 1 day, 1 week"
                data-testid="input-training-duration"
              />
            </div>
            <div>
              <Label className="text-xs">Prerequisites</Label>
              <Input
                value={data.trainingPrerequisites || ""}
                onChange={(e) => onChange({ trainingPrerequisites: e.target.value })}
                placeholder="e.g., Basic lawn care knowledge"
                data-testid="input-training-prerequisites"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {sections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No chapters yet</p>
            <p className="text-sm text-muted-foreground mb-4">Build your training guide by adding chapters</p>
            <Button onClick={addSection} data-testid="button-add-first-chapter">
              <Plus className="h-4 w-4 mr-2" /> Add First Chapter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg bg-muted/20">
          <DragDropContext onDragEnd={handleChapterDragEnd}>
            <Droppable droppableId="training-chapters">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="overflow-y-auto max-h-[calc(100vh-400px)] min-h-[200px] p-2 space-y-2">
                  {sections.map((section, index) => (
                    <Draggable key={section.id} draggableId={section.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <Card
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`border ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30 bg-background" : ""}`}
                          data-testid={`training-chapter-${index}`}
                        >
                          <div
                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                          >
                            <div {...dragProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted transition-colors" onClick={(e) => e.stopPropagation()}>
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                            <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20">Ch. {index + 1}</Badge>
                            <span className="font-medium text-sm truncate flex-1">
                              {section.chapterTitle || `Chapter ${index + 1} (untitled)`}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {expandedSection === section.id && (
                            <CardContent className="pt-0 pb-4 space-y-3 border-t">
                              <div className="grid grid-cols-1 gap-3 pt-3">
                                <div>
                                  <Label className="text-xs flex items-center gap-1"><BookOpen className="h-3 w-3" /> Chapter Title *</Label>
                                  <Input
                                    value={section.chapterTitle}
                                    onChange={(e) => updateSection(section.id, { chapterTitle: e.target.value })}
                                    placeholder="e.g., Introduction to Lawn Care Equipment"
                                    data-testid={`input-chapter-title-${index}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs flex items-center gap-1"><Target className="h-3 w-3" /> Learning Objectives</Label>
                                  <Textarea
                                    value={section.learningObjectives}
                                    onChange={(e) => updateSection(section.id, { learningObjectives: e.target.value })}
                                    placeholder="What will the trainee learn? (one per line)&#10;- Identify all mower components&#10;- Perform basic safety checks"
                                    rows={3}
                                    data-testid={`input-chapter-objectives-${index}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs flex items-center gap-1"><FileText className="h-3 w-3" /> Chapter Content</Label>
                                  <Textarea
                                    value={section.content}
                                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                                    placeholder="The main instructional content for this chapter..."
                                    rows={6}
                                    data-testid={`input-chapter-content-${index}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Key Takeaways</Label>
                                  <Textarea
                                    value={section.keyTakeaways}
                                    onChange={(e) => updateSection(section.id, { keyTakeaways: e.target.value })}
                                    placeholder="Main points to remember (one per line)&#10;- Always wear PPE&#10;- Check fuel before starting"
                                    rows={3}
                                    data-testid={`input-chapter-takeaways-${index}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs flex items-center gap-1"><BookOpenCheck className="h-3 w-3" /> Practice Exercise</Label>
                                  <Textarea
                                    value={section.practiceExercise}
                                    onChange={(e) => updateSection(section.id, { practiceExercise: e.target.value })}
                                    placeholder="A hands-on exercise for the trainee to apply what they learned..."
                                    rows={3}
                                    data-testid={`input-chapter-exercise-${index}`}
                                  />
                                </div>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <Button variant="outline" onClick={addSection} className="w-full" data-testid="button-add-chapter">
                    <Plus className="h-4 w-4 mr-2" /> Add Chapter
                  </Button>
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
  onImageGenerated,
  initialPrompt 
}: { 
  targetType: "sop_header" | "sop_step";
  stepIndex?: number;
  onImageGenerated: (media: SOPMediaItem) => void;
  initialPrompt?: string;
}) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [style, setStyle] = useState<string>("photoreal");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [preview, setPreview] = useState<SOPMediaItem | null>(null);
  const [internalUseOnly, setInternalUseOnly] = useState(true);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

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

  const [isGenerating, setIsGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState<"sending" | "creating" | "uploading" | "finishing">("sending");
  const [genProgress, setGenProgress] = useState(0);

  const PHASE_LABELS: Record<string, { label: string; percent: number }> = {
    sending: { label: "Sending prompt to AI...", percent: 10 },
    creating: { label: "AI is creating your image...", percent: 40 },
    uploading: { label: "Uploading to storage...", percent: 75 },
    finishing: { label: "Almost done...", percent: 90 },
  };

  const pollForResult = useCallback(async (jobId: string) => {
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));

      if (i === 1) { setGenPhase("creating"); setGenProgress(30); }
      else if (i === 3) setGenProgress(45);
      else if (i === 5) setGenProgress(55);
      else if (i === 8) setGenProgress(65);
      else if (i === 12) setGenProgress(70);

      try {
        const res = await fetch(`/api/sop-media/ai-generate/status/${jobId}`, { credentials: "include" });
        const data = await res.json();
        if (data.status === "completed") {
          setGenPhase("finishing");
          setGenProgress(95);
          await new Promise(r => setTimeout(r, 400));
          setPreview({
            id: data.result.id,
            url: data.result.url,
            alt: data.result.alt || prompt,
            source: "ai_generated",
            aiPrompt: prompt,
            aiStyle: style,
          });
          setGenProgress(100);
          toast({ title: "Image generated successfully" });
          setIsGenerating(false);
          setGenProgress(0);
          return;
        } else if (data.status === "failed") {
          const code = data.errorCode || "IMG-001";
          showErrorToast(new ApiError(500, data.error || "Image generation failed", code, data.error), "Generation failed");
          setIsGenerating(false);
          setGenProgress(0);
          return;
        } else if (data.status === "not_found") {
          showErrorToast(new ApiError(404, "Job expired or not found. Please try again.", "IMG-008"), "Generation failed");
          setIsGenerating(false);
          setGenProgress(0);
          return;
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }
    toast({ title: "Generation timed out", description: "The image took too long to generate. Please try again.", variant: "destructive", duration: 15000 });
    setIsGenerating(false);
    setGenProgress(0);
  }, [prompt, style, toast]);

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
      if (data.jobId) {
        setIsGenerating(true);
        setGenPhase("sending");
        setGenProgress(15);
        pollForResult(data.jobId);
      } else if (data.id) {
        setPreview({
          id: data.id,
          url: data.url,
          alt: data.alt || prompt,
          source: "ai_generated",
          aiPrompt: prompt,
          aiStyle: style,
        });
        toast({ title: "Image generated successfully" });
      }
    },
    onError: (err: any) => {
      showErrorToast(err, "Generation failed");
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

      {(generateMutation.isPending || isGenerating) ? (
        <div className="w-full space-y-2" data-testid="ai-gen-status">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>{generateMutation.isPending ? "Sending request..." : PHASE_LABELS[genPhase]?.label || "Processing..."}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${generateMutation.isPending ? 5 : genProgress}%` }}
              data-testid="ai-gen-progress-bar"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {genProgress < 40 ? "This usually takes 15–30 seconds" : genProgress < 70 ? "Hang tight, almost there..." : "Wrapping up..."}
          </p>
        </div>
      ) : (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={!prompt.trim()}
          className="w-full"
          data-testid="btn-generate-ai-image"
        >
          <Sparkles className="h-4 w-4 mr-2" /> Generate Image
        </Button>
      )}

      {preview && (
        <Card data-testid="ai-preview">
          <CardContent className="p-3 space-y-3">
            <div className="relative">
              <ClickableImage
                src={resolveImageSrc(preview.url)}
                alt={preview.alt}
                className="w-full rounded-md border max-h-64 object-contain bg-muted"
                testId="ai-preview-image"
              />
              <Badge className="absolute top-2 left-2 bg-purple-600 text-white text-xs pointer-events-none" data-testid="badge-ai">
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

function resolveCalcType(defaults: MaterialCalculatorData): CalcType {
  const ct = defaults.calculatorType?.toLowerCase() || "";
  if (ct in CALCULATOR_TEMPLATES) return ct as CalcType;
  const mt = defaults.materialType?.toLowerCase() || "";
  if (mt.includes("wall") || mt.includes("trench") || mt.includes("base course") || mt.includes("footing") || mt.includes("retaining")) return "linear_volume";
  if (mt.includes("fertilizer") || mt.includes("herbicide") || mt.includes("insecticide") || mt.includes("chemical") || mt.includes("pesticide")) return "chemical_rate";
  if (mt.includes("polymeric") || mt.includes("paver sand") || mt.includes("joint sand")) return "polymeric_sand";
  if (mt.includes("bag")) return "bag_count";
  return "area_volume";
}

function buildCalcHtml(title: string, values: Record<string, number>, results: { label: string; value: string }[], assumptions: string[], manufacturer: string | undefined, measureGuide: string | undefined, coverageNote: string, densityBasis?: string): string {
  let html = `<div class="sop-calculator" style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:16px;margin:16px 0;">`;
  html += `<h3 style="margin:0 0 8px;color:#16a34a;">📐 ${title}</h3>`;
  if (manufacturer) html += `<p style="font-size:12px;color:#888;margin:0 0 6px;"><em>Calculations based on ${manufacturer} specifications</em></p>`;
  if (coverageNote) html += `<p style="font-size:13px;color:#666;margin:0 0 8px;">${coverageNote}</p>`;
  html += `<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">`;
  html += `<tr style="background:#dcfce7;"><th style="padding:6px;text-align:left;border:1px solid #86efac;">Measurement</th><th style="padding:6px;text-align:center;border:1px solid #86efac;">Result</th></tr>`;
  results.forEach(r => {
    html += `<tr><td style="padding:6px;border:1px solid #e5e7eb;">${r.label}</td><td style="padding:6px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">${r.value}</td></tr>`;
  });
  html += `</table>`;
  if (densityBasis) {
    html += `<div style="margin-top:8px;padding:6px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:11px;color:#1d4ed8;">Weight based on: ${densityBasis}</div>`;
  }
  if (assumptions.length > 0) {
    html += `<div style="margin-top:10px;font-size:12px;color:#666;"><strong>Assumptions:</strong><ul style="margin:4px 0;padding-left:18px;">`;
    assumptions.forEach(a => html += `<li>${a}</li>`);
    html += `</ul></div>`;
  }
  if (measureGuide) html += `<div style="margin-top:8px;padding:8px;background:#ecfdf5;border-radius:6px;font-size:12px;"><strong>How to measure onsite:</strong> ${measureGuide}</div>`;
  html += `</div>`;
  return html;
}

function MaterialCalculatorPopup({ defaults, onConfirm, onCancel }: { defaults: MaterialCalculatorData; onConfirm: (depth: number, html: string) => void; onCancel: () => void }) {
  const calcType = resolveCalcType(defaults);
  const template = CALCULATOR_TEMPLATES[calcType];
  const presets = defaults.presets && defaults.presets.length > 0 ? defaults.presets : [
    { label: "Default", values: Object.fromEntries(template.inputs.map(i => [i.key, i.defaultValue])) },
  ];

  const initialValues: Record<string, number> = {};
  template.inputs.forEach(inp => {
    const presetVal = presets[0]?.values?.[inp.key];
    initialValues[inp.key] = presetVal != null ? presetVal : inp.defaultValue;
  });

  const [values, setValues] = useState<Record<string, number>>(initialValues);
  const [activePreset, setActivePreset] = useState(0);

  const densityInfo = (calcType === "area_volume" || calcType === "linear_volume")
    ? getMaterialDensity(defaults.materialType || "", defaults.densityTonsPerCubicYard)
    : null;

  const results = template.calculate(values, densityInfo?.density);
  const assumptions = defaults.assumptions || [];
  const matLabel = defaults.materialType ? defaults.materialType.charAt(0).toUpperCase() + defaults.materialType.slice(1) : template.label;
  const calcTitle = `${matLabel} Calculator`;

  const applyPreset = (idx: number) => {
    setActivePreset(idx);
    const p = presets[idx];
    if (!p) return;
    const next = { ...values };
    template.inputs.forEach(inp => {
      if (p.values[inp.key] != null) next[inp.key] = p.values[inp.key];
    });
    setValues(next);
  };

  const densityBasisStr = densityInfo ? `${densityInfo.source} — ${densityInfo.density} tons/yd³` : undefined;
  const calcHtml = buildCalcHtml(calcTitle, values, results, assumptions, defaults.productOrManufacturer, defaults.measurementGuide, defaults.coverageNote, densityBasisStr);

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <AlertDialogHeader className="shrink-0">
          <AlertDialogTitle className="flex items-center gap-2" data-testid="calc-title">
            📐 {calcTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Adjust the inputs below for your specific job. A calculator will be embedded in the SOP content.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {defaults.productOrManufacturer && (
            <p className="text-xs text-muted-foreground italic">Assumptions based on {defaults.productOrManufacturer}</p>
          )}
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm">
            <p className="text-muted-foreground">{defaults.coverageNote}</p>
          </div>

          {presets.length > 1 && (
            <div>
              <Label className="text-xs mb-1 block">Presets</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((p, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={activePreset === i ? "default" : "outline"}
                    onClick={() => applyPreset(i)}
                    data-testid={`preset-${i}`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {template.inputs.map(inp => (
              <div key={inp.key}>
                <Label className="text-xs">{inp.label} ({inp.unit})</Label>
                <Input
                  type="number"
                  value={values[inp.key] ?? inp.defaultValue}
                  onChange={(e) => setValues(prev => ({ ...prev, [inp.key]: parseFloat(e.target.value) || 0 }))}
                  min={inp.min}
                  max={inp.max}
                  step={inp.step}
                  data-testid={`input-calc-${inp.key}`}
                />
              </div>
            ))}
          </div>

          <Card className="bg-muted/50">
            <CardContent className="p-3 space-y-1">
              <p className="text-xs text-muted-foreground text-center mb-2">Results</p>
              {results.map((r, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="text-sm font-bold text-green-600" data-testid={`result-${i}`}>{r.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {densityInfo && (
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" data-testid="calc-basis">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Calculation Basis</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Weight based on: {densityInfo.source} — {densityInfo.density} tons per cubic yard
              </p>
            </div>
          )}

          {assumptions.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium">Assumptions:</p>
              <ul className="list-disc pl-4">
                {assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {defaults.measurementGuide && (
            <div className="p-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-xs">
              <strong>How to measure onsite:</strong> {defaults.measurementGuide}
            </div>
          )}
        </div>
        <AlertDialogFooter className="shrink-0">
          <AlertDialogCancel onClick={onCancel}>Skip Calculator</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(values[template.inputs[0].key] || 0, calcHtml)} data-testid="btn-add-calculator">
            Add Calculator to SOP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StepMedia({ data, onChange }: { data: SOPBuilderData; onChange: (d: Partial<SOPBuilderData>) => void }) {
  const [suggestionPrompts, setSuggestionPrompts] = useState<Record<string, string>>({});

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
                          const target = suggestion.target;
                          setSuggestionPrompts(prev => ({ ...prev, [target]: suggestion.prompt }));
                          requestAnimationFrame(() => {
                            setTimeout(() => {
                              const targetId = isHeader ? "header-generator" : `step-generator-${stepIdx}`;
                              const el = document.getElementById(targetId);
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "center" });
                              }
                            }, 200);
                          });
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
                <ClickableImage
                  src={resolveImageSrc(data.headerImage.url)}
                  alt={data.headerImage.alt}
                  className="w-full rounded-md border max-h-48 object-contain bg-muted"
                  testId="header-image-preview"
                />
                {data.headerImage.source === "ai_generated" && (
                  <Badge className="absolute top-2 left-2 bg-purple-600 text-white text-xs pointer-events-none">
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
            <div id="header-generator">
              <AIImageGenerator
                targetType="sop_header"
                onImageGenerated={(media) => onChange({ headerImage: media })}
                initialPrompt={suggestionPrompts["header"]}
              />
            </div>
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
                    <ClickableImage
                      src={resolveImageSrc(data.stepImages[step.id].url)}
                      alt={data.stepImages[step.id].alt}
                      className="w-full rounded border max-h-36 object-contain bg-muted"
                      testId={`step-image-preview-${idx}`}
                    />
                    {data.stepImages[step.id].source === "ai_generated" && (
                      <Badge className="absolute top-1 left-1 bg-purple-600 text-white text-[10px] pointer-events-none">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div id={`step-generator-${idx}`}>
                    <AIImageGenerator
                      targetType="sop_step"
                      stepIndex={idx}
                      onImageGenerated={(media) => {
                        onChange({ stepImages: { ...data.stepImages, [step.id]: media } });
                      }}
                      initialPrompt={suggestionPrompts[`step_${idx}`]}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviewTypeContent({ data }: { data: SOPBuilderData }) {
  if (data.sopType === "quality") {
    const checklist = data.qcChecklist || [];
    const filledItems = checklist.filter(c => c.item).length;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" /> Quality Checklist ({filledItems} items)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {filledItems > 0 ? (
            <ul className="space-y-1 text-sm">
              {checklist.filter(c => c.item).map((c, i) => (
                <li key={c.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{c.category}</Badge>
                  <span>{c.item}</span>
                  {c.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No checklist items added</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (data.sopType === "maintenance") {
    const tasks = data.maintenanceTasks || [];
    const equipment = data.equipment;
    return (
      <>
        {equipment && (equipment.name || equipment.manufacturer) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Cog className="h-4 w-4" /> Equipment</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm">
              <p>{[equipment.name, equipment.manufacturer, equipment.model].filter(Boolean).join(" — ")}</p>
              {data.oemResearch && <Badge variant="secondary" className="text-xs mt-1">OEM Research Applied</Badge>}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4" /> Maintenance Tasks ({tasks.filter(t => t.taskName).length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {tasks.filter(t => t.taskName).length > 0 ? (
              <ul className="space-y-1 text-sm">
                {tasks.filter(t => t.taskName).map(t => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span>{t.taskName}</span>
                    <Badge variant="outline" className="text-xs">{t.frequency}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks added</p>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  if (data.sopType === "training") {
    const sections = data.trainingSections || [];
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Training Guide ({sections.filter(s => s.chapterTitle).length} chapters)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.trainingDuration && <p className="text-xs text-muted-foreground mb-2">Duration: {data.trainingDuration}</p>}
          {sections.filter(s => s.chapterTitle).length > 0 ? (
            <ol className="space-y-1 list-decimal list-inside text-sm">
              {sections.filter(s => s.chapterTitle).map(s => (
                <li key={s.id}>{s.chapterTitle}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No chapters added</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const completedSteps = data.steps.filter(s => s.title && s.instruction).length;
  return (
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
  );
}

function EditableField({ label, value, onChange, multiline, placeholder, testId }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (editing) {
    const save = () => { onChange(draft); setEditing(false); };
    const cancel = () => { setDraft(value); setEditing(false); };
    return (
      <div className="space-y-1" data-testid={testId ? `${testId}-editing` : undefined}>
        <p className="text-xs text-muted-foreground">{label}</p>
        {multiline ? (
          <Textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") cancel(); }}
            placeholder={placeholder} rows={3} className="text-sm" />
        ) : (
          <Input ref={inputRef as React.RefObject<HTMLInputElement>} value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
            placeholder={placeholder} className="text-sm h-8" />
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="default" onClick={save} className="h-6 text-xs px-2" data-testid={testId ? `${testId}-save` : undefined}><Check className="h-3 w-3 mr-1" /> Save</Button>
          <Button size="sm" variant="ghost" onClick={cancel} className="h-6 text-xs px-2" data-testid={testId ? `${testId}-cancel` : undefined}><X className="h-3 w-3 mr-1" /> Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }} data-testid={testId}>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
      </p>
      <p className={`text-sm ${value ? "font-medium" : "text-muted-foreground italic"}`}>
        {value || placeholder || "Not set"}
      </p>
    </div>
  );
}

function StepReview({ data, setData, categories }: { data: SOPBuilderData; setData: React.Dispatch<React.SetStateAction<SOPBuilderData>>; categories: SopCategory[] }) {
  const updateField = useCallback((field: keyof SOPBuilderData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, [setData]);

  const updateStep = useCallback((stepId: string, field: keyof SOPStep, value: any) => {
    setData(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, [field]: value } : s),
    }));
  }, [setData]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Review & Edit Your SOP</h3>
        <p className="text-sm text-muted-foreground">Click any field to edit it directly. Changes are saved instantly.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="p-3">
            <EditableField label="Title" value={data.title} onChange={v => updateField("title", v)} placeholder="Enter SOP title" testId="review-edit-title" />
          </CardContent>
        </Card>
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Topic</p>
            <Select value={data.categoryId} onValueChange={v => {
              const cat = categories.find(c => String(c.id) === v);
              if (cat) setData(prev => ({ ...prev, categoryId: v, category: cat.name }));
            }}>
              <SelectTrigger className="h-8 text-sm" data-testid="review-edit-topic">
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Type</p>
            <Select value={data.sopType} onValueChange={v => updateField("sopType", v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="review-edit-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {SOP_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Skill Level</p>
            <Select value={data.skillLevel} onValueChange={v => updateField("skillLevel", v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="review-edit-skill">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {SKILL_LEVELS.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="p-3">
          <EditableField label="Desired Outcome" value={data.outcome} onChange={v => updateField("outcome", v)} multiline placeholder="Describe the desired outcome" testId="review-edit-outcome" />
        </CardContent>
      </Card>

      <ReviewTypeContent data={data} />

      {data.sopType !== "quality" && data.sopType !== "maintenance" && data.sopType !== "training" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Steps ({data.steps.filter(s => s.title).length})
              <span className="text-xs text-muted-foreground font-normal ml-auto">Click to edit</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {data.steps.map((step, idx) => (
              <div key={step.id} className="p-2 rounded border hover:border-primary/40 transition-colors space-y-1" data-testid={`review-step-${idx}`}>
                <EditableField label={`Step ${idx + 1} Title`} value={step.title} onChange={v => updateStep(step.id, "title", v)} placeholder="Step title" testId={`review-edit-step-title-${idx}`} />
                <EditableField label="Instructions" value={step.instruction} onChange={v => updateStep(step.id, "instruction", v)} multiline placeholder="Step instructions" testId={`review-edit-step-instr-${idx}`} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="hover:border-primary/40 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tools, Materials & PPE</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <EditableField label="Tools" value={data.tools} onChange={v => updateField("tools", v)} multiline placeholder="List tools (one per line)" testId="review-edit-tools" />
          <EditableField label="Materials" value={data.materials} onChange={v => updateField("materials", v)} multiline placeholder="List materials (one per line)" testId="review-edit-materials" />
          <EditableField label="PPE" value={data.ppe} onChange={v => updateField("ppe", v)} multiline placeholder="List PPE (one per line)" testId="review-edit-ppe" />
        </CardContent>
      </Card>

      <Card className="hover:border-primary/40 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Safety & Compliance</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <EditableField label="Safety Notes" value={data.safetyNotes} onChange={v => updateField("safetyNotes", v)} multiline placeholder="Safety notes" testId="review-edit-safety" />
          <EditableField label="Compliance Notes" value={data.complianceNotes} onChange={v => updateField("complianceNotes", v)} multiline placeholder="Compliance notes" testId="review-edit-compliance" />
        </CardContent>
      </Card>

      {(data.headerImage || Object.keys(data.stepImages).length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Media</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {data.headerImage && (
                <div className="relative w-20 h-20 rounded border overflow-hidden">
                  <ClickableImage src={resolveImageSrc(data.headerImage.url)} alt="Header" className="w-full h-full object-cover" testId="review-header-thumb" />
                  {data.headerImage.source === "ai_generated" && (
                    <Badge className="absolute top-0.5 left-0.5 bg-purple-600 text-white text-[8px] px-1 py-0 pointer-events-none"><Sparkles className="h-2 w-2" /></Badge>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center pointer-events-none">Header</span>
                </div>
              )}
              {data.steps.map((step, idx) => data.stepImages[step.id] ? (
                <div key={step.id} className="relative w-20 h-20 rounded border overflow-hidden">
                  <ClickableImage src={resolveImageSrc(data.stepImages[step.id].url)} alt={`Step ${idx+1}`} className="w-full h-full object-cover" testId={`review-step-thumb-${idx}`} />
                  {data.stepImages[step.id].source === "ai_generated" && (
                    <Badge className="absolute top-0.5 left-0.5 bg-purple-600 text-white text-[8px] px-1 py-0 pointer-events-none"><Sparkles className="h-2 w-2" /></Badge>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center pointer-events-none">Step {idx+1}</span>
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
  const sopTypeLabel = SOP_TYPES.find(t => t.value === data.sopType)?.label || "";
  const skillLabel = SKILL_LEVELS.find(l => l.value === data.skillLevel)?.label || "";

  let html = "";

  if (data.headerImage) {
    const imgSrc = resolveImageSrc(data.headerImage.url);
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
    const toolsText = asMultilineText(data.tools);
    const materialsText = asMultilineText(data.materials);
    const ppeText = asMultilineText(data.ppe);
    if (toolsText) { html += `<h3>Tools Required</h3><ul>`; toolsText.split("\n").filter(Boolean).forEach(t => html += `<li>${t.trim()}</li>`); html += `</ul>`; }
    if (materialsText) { html += `<h3>Materials Needed</h3><ul>`; materialsText.split("\n").filter(Boolean).forEach(m => html += `<li>${m.trim()}</li>`); html += `</ul>`; }
    if (ppeText) { html += `<h3>PPE Required</h3><ul>`; ppeText.split("\n").filter(Boolean).forEach(p => html += `<li>${p.trim()}</li>`); html += `</ul>`; }
  }

  if (data.calculatorHtml) html += data.calculatorHtml;

  if (data.safetyNotes) {
    html += `<h2>⚠️ Safety Notes</h2>`;
    html += `<p>${data.safetyNotes.replace(/\n/g, "<br>")}</p>`;
  }

  if (data.sopType === "quality") {
    html += generateQualityContent(data);
  } else if (data.sopType === "maintenance") {
    html += generateMaintenanceContent(data);
  } else if (data.sopType === "training") {
    html += generateTrainingContent(data);
  } else {
    html += generateStandardSteps(data);
  }

  if (data.complianceNotes) {
    html += `<h2>Compliance</h2>`;
    html += `<p>${data.complianceNotes.replace(/\n/g, "<br>")}</p>`;
  }

  return html;
}

function generateStandardSteps(data: SOPBuilderData): string {
  let html = "";
  if (data.steps.length > 0) {
    html += `<h2>Procedure Steps</h2><ol>`;
    data.steps.forEach((step, i) => {
      html += `<li><strong>${step.title || `Step ${i + 1}`}</strong>`;
      if (step.instruction) html += `<p>${step.instruction.replace(/\n/g, "<br>")}</p>`;
      if (data.stepImages[step.id]) {
        const stepImg = data.stepImages[step.id];
        const imgSrc = resolveImageSrc(stepImg.url);
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
  return html;
}

function generateQualityContent(data: SOPBuilderData): string {
  let html = "";
  const checklist = data.qcChecklist || [];
  const categories = data.qcCategories || ["General"];

  if (checklist.length > 0) {
    html += `<h2>✅ Quality Control Checklist</h2>`;
    html += `<div class="qc-checklist" style="margin:16px 0;">`;

    for (const cat of categories) {
      const items = checklist.filter(c => c.category === cat);
      if (items.length === 0) continue;

      html += `<h3>${cat}</h3>`;
      html += `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:14px;">`;
      html += `<thead><tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">`;
      html += `<th style="padding:8px;text-align:left;width:30px;">#</th>`;
      html += `<th style="padding:8px;text-align:left;">Inspection Item</th>`;
      html += `<th style="padding:8px;text-align:left;">Acceptance Criteria</th>`;
      html += `<th style="padding:8px;text-align:center;width:100px;">Check Type</th>`;
      html += `<th style="padding:8px;text-align:center;width:80px;">Result</th>`;
      html += `</tr></thead><tbody>`;

      items.forEach((item, idx) => {
        const checkLabel = QC_CHECK_TYPES.find(t => t.value === item.checkType)?.label || item.checkType;
        html += `<tr style="border-bottom:1px solid #eee;">`;
        html += `<td style="padding:8px;">${idx + 1}</td>`;
        html += `<td style="padding:8px;">${item.item}${item.required ? ' <span style="color:red;">*</span>' : ""}</td>`;
        html += `<td style="padding:8px;font-size:13px;color:#555;">${item.acceptanceCriteria}</td>`;
        html += `<td style="padding:8px;text-align:center;font-size:12px;">${checkLabel}</td>`;
        html += `<td style="padding:8px;text-align:center;">☐</td>`;
        html += `</tr>`;
      });

      html += `</tbody></table>`;
    }

    html += `<div style="margin-top:24px;padding:12px;border:1px solid #ddd;border-radius:6px;">`;
    html += `<p><strong>Inspector Name:</strong> ____________________</p>`;
    html += `<p><strong>Date:</strong> ____________________</p>`;
    html += `<p><strong>Signature:</strong> ____________________</p>`;
    html += `<p><strong>Notes:</strong></p><p style="border-bottom:1px solid #ccc;padding:8px 0;">&nbsp;</p>`;
    html += `<p style="border-bottom:1px solid #ccc;padding:8px 0;">&nbsp;</p>`;
    html += `</div>`;
    html += `</div>`;
  }

  html += generateStandardSteps(data);
  return html;
}

function generateMaintenanceContent(data: SOPBuilderData): string {
  let html = "";
  const equipment = data.equipment;
  const tasks = data.maintenanceTasks || [];
  const maintenanceTypeLabel = MAINTENANCE_FOCUS.find((t: { value: string; label: string }) => t.value === data.maintenanceType)?.label || "";

  if (equipment && (equipment.name || equipment.manufacturer)) {
    html += `<h2>🔧 Equipment Information</h2>`;
    html += `<table style="width:100%;border-collapse:collapse;margin:8px 0;">`;
    if (equipment.name) html += `<tr><td style="padding:6px;font-weight:bold;width:140px;">Equipment:</td><td style="padding:6px;">${equipment.name}</td></tr>`;
    if (equipment.manufacturer) html += `<tr><td style="padding:6px;font-weight:bold;">Manufacturer:</td><td style="padding:6px;">${equipment.manufacturer}</td></tr>`;
    if (equipment.model) html += `<tr><td style="padding:6px;font-weight:bold;">Model:</td><td style="padding:6px;">${equipment.model}</td></tr>`;
    if (equipment.year) html += `<tr><td style="padding:6px;font-weight:bold;">Year:</td><td style="padding:6px;">${equipment.year}</td></tr>`;
    if (equipment.engineType) html += `<tr><td style="padding:6px;font-weight:bold;">Engine:</td><td style="padding:6px;">${equipment.engineType}</td></tr>`;
    if (equipment.fuelType) html += `<tr><td style="padding:6px;font-weight:bold;">Fuel Type:</td><td style="padding:6px;">${equipment.fuelType}</td></tr>`;
    if (equipment.serialNumber) html += `<tr><td style="padding:6px;font-weight:bold;">Serial/VIN:</td><td style="padding:6px;">${equipment.serialNumber}</td></tr>`;
    if (maintenanceTypeLabel) html += `<tr><td style="padding:6px;font-weight:bold;">Focus:</td><td style="padding:6px;">${maintenanceTypeLabel}</td></tr>`;
    html += `</table>`;
  }

  if (data.oemResearch) {
    html += `<h2>📋 OEM Recommendations</h2>`;
    html += `<p style="font-size:12px;color:#666;"><em>${data.oemResearch.source}</em></p>`;
    if (data.oemResearch.warnings.length > 0) {
      html += `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin:8px 0;">`;
      html += `<strong>⚠️ Warnings:</strong><ul>`;
      data.oemResearch.warnings.forEach(w => html += `<li>${w}</li>`);
      html += `</ul></div>`;
    }
    if (data.oemResearch.recommendations.length > 0) {
      html += `<h3>Recommendations</h3><ul>`;
      data.oemResearch.recommendations.forEach(r => html += `<li>${r}</li>`);
      html += `</ul>`;
    }
  }

  if (tasks.length > 0) {
    html += `<h2>🔧 Maintenance Tasks</h2>`;
    html += `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:14px;">`;
    html += `<thead><tr style="background:#f0f7ff;border-bottom:2px solid #ccc;">`;
    html += `<th style="padding:8px;text-align:left;">#</th>`;
    html += `<th style="padding:8px;text-align:left;">Task</th>`;
    html += `<th style="padding:8px;text-align:left;">Frequency</th>`;
    html += `<th style="padding:8px;text-align:left;">Procedure</th>`;
    html += `<th style="padding:8px;text-align:center;width:60px;">Done</th>`;
    html += `</tr></thead><tbody>`;
    tasks.forEach((task, idx) => {
      html += `<tr style="border-bottom:1px solid #eee;">`;
      html += `<td style="padding:8px;">${idx + 1}</td>`;
      html += `<td style="padding:8px;font-weight:500;">${task.taskName}</td>`;
      html += `<td style="padding:8px;font-size:13px;">${task.frequency}</td>`;
      html += `<td style="padding:8px;font-size:13px;">${task.procedure.replace(/\n/g, "<br>")}</td>`;
      html += `<td style="padding:8px;text-align:center;">☐</td>`;
      html += `</tr>`;
    });
    html += `</tbody></table>`;

    html += `<div style="margin-top:24px;padding:12px;border:1px solid #ddd;border-radius:6px;">`;
    html += `<p><strong>Performed By:</strong> ____________________</p>`;
    html += `<p><strong>Date:</strong> ____________________</p>`;
    html += `<p><strong>Hours / Mileage:</strong> ____________________</p>`;
    html += `<p><strong>Next Service Due:</strong> ____________________</p>`;
    html += `<p><strong>Notes:</strong></p><p style="border-bottom:1px solid #ccc;padding:8px 0;">&nbsp;</p>`;
    html += `</div>`;
  }

  html += generateStandardSteps(data);
  return html;
}

function generateTrainingContent(data: SOPBuilderData): string {
  let html = "";
  const sections = data.trainingSections || [];

  html += `<div class="training-guide" style="margin:16px 0;">`;

  if (data.trainingDuration || data.trainingPrerequisites) {
    html += `<div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;margin-bottom:20px;">`;
    html += `<h3 style="margin-top:0;">📚 Training Guide Overview</h3>`;
    if (data.trainingDuration) html += `<p><strong>Estimated Duration:</strong> ${data.trainingDuration}</p>`;
    if (data.trainingPrerequisites) html += `<p><strong>Prerequisites:</strong> ${data.trainingPrerequisites}</p>`;
    if (sections.length > 0) {
      html += `<p><strong>Table of Contents:</strong></p><ol>`;
      sections.forEach(s => { if (s.chapterTitle) html += `<li>${s.chapterTitle}</li>`; });
      html += `</ol>`;
    }
    html += `</div>`;
  }

  sections.forEach((section, idx) => {
    html += `<div class="training-chapter" style="margin-bottom:32px;page-break-before:${idx > 0 ? "always" : "auto"};">`;
    html += `<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:16px 20px;border-radius:8px 8px 0 0;">`;
    html += `<h2 style="margin:0;color:white;">Chapter ${idx + 1}: ${section.chapterTitle || "Untitled"}</h2>`;
    html += `</div>`;

    if (section.learningObjectives) {
      html += `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;margin:12px 0;border-radius:0 6px 6px 0;">`;
      html += `<strong>🎯 Learning Objectives</strong><ul>`;
      section.learningObjectives.split("\n").filter(Boolean).forEach(obj => html += `<li>${obj.replace(/^[-•]\s*/, "")}</li>`);
      html += `</ul></div>`;
    }

    if (section.content) {
      html += `<div style="padding:16px 0;line-height:1.7;">`;
      html += `${section.content.replace(/\n/g, "<br>")}`;
      html += `</div>`;
    }

    if (section.keyTakeaways) {
      html += `<div style="background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;margin:12px 0;border-radius:0 6px 6px 0;">`;
      html += `<strong>💡 Key Takeaways</strong><ul>`;
      section.keyTakeaways.split("\n").filter(Boolean).forEach(kt => html += `<li>${kt.replace(/^[-•]\s*/, "")}</li>`);
      html += `</ul></div>`;
    }

    if (section.practiceExercise) {
      html += `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:12px 0;border-radius:0 6px 6px 0;">`;
      html += `<strong>✏️ Practice Exercise</strong>`;
      html += `<p>${section.practiceExercise.replace(/\n/g, "<br>")}</p>`;
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `</div>`;

  html += generateStandardSteps(data);
  return html;
}

interface SOPBuilderProps {
  categories: SopCategory[];
  onComplete: (sopData: { title: string; category: string; categoryId: string; content: string; structuredData?: any; superCategory?: string; subCategory?: string; sopType?: string }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  initialData?: SOPBuilderData & { draftId?: string };
  onSaveDraft?: (draftData: { title: string; categoryId: string; sopType: string; currentStep: number; data: SOPBuilderData; draftId?: string }) => void;
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
  qcChecklist: [],
  qcCategories: ["General"],
  equipment: { name: "", manufacturer: "", model: "", serialNumber: "", year: "", engineType: "", fuelType: "" },
  maintenanceTasks: [],
  maintenanceType: "",
  oemResearch: null,
  trainingSections: [],
  trainingDuration: "",
  trainingPrerequisites: "",
};

export default function SOPBuilder({ categories, onComplete, onCancel, isSubmitting, initialData, onSaveDraft, isSavingDraft }: SOPBuilderProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<SOPBuilderData>(initialData || { ...INITIAL_DATA, steps: [createEmptyStep()] });
  const [draftId, setDraftId] = useState<string | undefined>(initialData?.draftId);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNavDialog, setShowNavDialog] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [aiSuggestionsApplied, setAiSuggestionsApplied] = useState(false);

  const isDirty = useMemo(() => {
    if (aiSuggestionsApplied) return true;
    if (currentStep > 1) return true;
    if (initialData) {
      const base = initialData;
      return data.title !== base.title || 
        data.outcome !== base.outcome ||
        data.steps.some(s => s.title || s.instruction);
    }
    return false;
  }, [data, initialData, aiSuggestionsApplied, currentStep]);

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
    onCancel();
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
          tools: asMultilineText(prev.tools || suggestions.tools || ""),
          materials: asMultilineText(prev.materials || suggestions.materials || ""),
          ppe: asMultilineText(prev.ppe || suggestions.ppe || ""),
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
      setAiSuggestionsApplied(true);
      toast({ title: "AI suggestions applied", description: `Fields auto-filled.${topicMsg}${imgMsg}${calcMsg} Review and adjust as needed.` });
    } catch (err: any) {
      showErrorToast(err, "AI suggestion failed");
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
      case 4: {
        if (data.sopType === "quality") return (data.qcChecklist || []).length > 0 && (data.qcChecklist || []).some(c => c.item);
        if (data.sopType === "maintenance") return (data.maintenanceTasks || []).length > 0 && (data.maintenanceTasks || []).some(t => t.taskName);
        if (data.sopType === "training") return (data.trainingSections || []).length > 0 && (data.trainingSections || []).some(s => s.chapterTitle);
        return data.steps.length > 0 && data.steps.some(s => s.title && s.instruction);
      }
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
    const structuredData = {
      outcome: data.outcome || undefined,
      outcomeType: data.outcomeType || undefined,
      audience: data.audience || undefined,
      skillLevel: data.skillLevel || undefined,
      timingTarget: data.timingTarget || undefined,
      timingMax: data.timingMax || undefined,
      ppe: data.ppe || undefined,
      tools: data.tools || undefined,
      materials: data.materials || undefined,
      steps: data.steps.map(s => ({
        id: s.id,
        title: s.title,
        instruction: s.instruction,
        why: s.why || undefined,
        successCriteria: s.successCriteria || undefined,
        commonMistakes: s.commonMistakes || undefined,
        proofRequired: s.proofRequired || false,
        proofType: s.proofType || undefined,
        isQCCheckpoint: s.isQCCheckpoint || false,
        imageUrl: data.stepImages[s.id]?.url || undefined,
      })),
      safetyNotes: data.safetyNotes || undefined,
      complianceNotes: data.complianceNotes || undefined,
      headerImageUrl: data.headerImage?.url || undefined,
    };
    onComplete({
      title: data.title,
      category: data.category,
      categoryId: data.categoryId,
      content,
      structuredData,
      superCategory: data.superCategory || undefined,
      subCategory: data.subCategory || undefined,
      sopType: data.sopType || undefined,
    });
  };

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepTypeSelection data={data} onChange={updateData} />;
      case 1: return <StepIdentity data={data} onChange={updateData} categories={categories} onAiSuggest={handleAiSuggest} isAiSuggesting={isAiSuggesting} aiApplied={aiSuggestionsApplied} />;
      case 2: return <StepOutcome data={data} onChange={updateData} />;
      case 3: return <StepAudience data={data} onChange={updateData} />;
      case 4: {
        if (data.sopType === "quality") return <QualityChecklistBuilder data={data} onChange={updateData} />;
        if (data.sopType === "maintenance") return <MaintenanceBuilder data={data} onChange={updateData} />;
        if (data.sopType === "training") return <TrainingGuideBuilder data={data} onChange={updateData} />;
        return <StepBuilder data={data} onChange={updateData} />;
      }
      case 5: return <StepMedia data={data} onChange={updateData} />;
      case 6: return <StepToolsMaterials data={data} onChange={updateData} />;
      case 7: return <StepSafety data={data} onChange={updateData} />;
      case 8: return <StepReview data={data} setData={setData} categories={categories} />;
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
          onConfirm={(_val, html) => {
            setData(prev => ({ ...prev, calculatorHtml: html }));
            setShowCalculatorPopup(false);
            setPendingCalcDefaults(null);
            toast({ title: "Calculator added", description: `${pendingCalcDefaults.materialType} calculator will be included in your SOP.` });
          }}
          onCancel={() => {
            setShowCalculatorPopup(false);
            setPendingCalcDefaults(null);
          }}
        />
      )}

      <AlertDialog open={showNavDialog} onOpenChange={(open) => { setShowNavDialog(open); if (!open) setPendingNavPath(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved work in the SOP Builder. If you navigate away now, all your progress will be lost. You can also save to drafts to continue later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNavPath(null)} data-testid="btn-nav-stay">Keep Working</AlertDialogCancel>
            {onSaveDraft && (
              <Button
                variant="outline"
                onClick={() => { setShowNavDialog(false); handleSaveDraft(); setPendingNavPath(null); }}
                disabled={isSavingDraft}
                data-testid="btn-nav-save-draft"
              >
                <Clock className="h-4 w-4 mr-2" /> Save to Drafts
              </Button>
            )}
            <AlertDialogAction
              onClick={confirmNavigation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-nav-leave"
            >
              Discard & Leave
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
          <p className="text-muted-foreground text-sm flex items-center gap-2 flex-wrap">
            <span>Step {currentStep + 1} of {WIZARD_STEPS.length}: {currentStep === 4 ? (
              data.sopType === "quality" ? "Checklist" : data.sopType === "maintenance" ? "Maintenance Tasks" : data.sopType === "training" ? "Chapters" : "Steps"
            ) : WIZARD_STEPS[currentStep].label}</span>
            {data.sopType && currentStep > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-sop-type">
                {SOP_TYPES.find(t => t.value === data.sopType)?.icon} {SOP_TYPES.find(t => t.value === data.sopType)?.label}
              </Badge>
            )}
          </p>
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
              {index === 4 ? (data.sopType === "quality" ? "Checklist" : data.sopType === "maintenance" ? "Maintenance" : data.sopType === "training" ? "Chapters" : step.label) : step.label}
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
