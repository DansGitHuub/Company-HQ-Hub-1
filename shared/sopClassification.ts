export type SuperCategory =
  | "Field Operations"
  | "Business Operations"
  | "Leadership & Performance"
  | "Exceptions & Emergencies";

export type SopClassificationType =
  | "Procedure"
  | "Checklist"
  | "Process"
  | "Policy"
  | "Standard"
  | "Reference"
  | "Emergency Protocol";

export type SopMainCategory =
  | "Installation & Construction"
  | "Maintenance & Service"
  | "Equipment, Vehicles & Tools"
  | "Materials & Inventory"
  | "Safety & Risk Management"
  | "Office & Administration"
  | "Sales & Estimating"
  | "Hiring & HR"
  | "Technology & Systems"
  | "Management & Leadership"
  | "Emergency & Exceptions";

export type Classification = {
  superCategory: SuperCategory;
  mainCategory: SopMainCategory;
  subCategory: string;
  sopType: SopClassificationType;
  confidence: number;
  matchedOn?: string;
};

type TaxonomyNode = {
  superCategory: SuperCategory;
  mainCategory: SopMainCategory;
  subCategories: string[];
};

const TAXONOMY: TaxonomyNode[] = [
  {
    superCategory: "Field Operations",
    mainCategory: "Installation & Construction",
    subCategories: [
      "hardscape install",
      "softscape install",
      "grading & drainage",
      "irrigation systems",
      "landscape lighting installation",
      "decks & structures",
      "water feature installation",
      "foundations & base installation",
    ],
  },
  {
    superCategory: "Field Operations",
    mainCategory: "Maintenance & Service",
    subCategories: [
      "lawn maintenance",
      "landscape bed maintenance",
      "pruning & tree care",
      "fertilization & treatments",
      "irrigation system maintenance",
      "landscape lighting maintenance",
      "seasonal cleanups",
      "snow & ice maintenance",
    ],
  },
  {
    superCategory: "Field Operations",
    mainCategory: "Equipment, Vehicles & Tools",
    subCategories: [
      "daily inspections",
      "preventative maintenance",
      "repairs & troubleshooting",
      "trailers",
      "hand tools",
      "power equipment",
      "heavy equipment",
      "vehicles",
    ],
  },
  {
    superCategory: "Field Operations",
    mainCategory: "Materials & Inventory",
    subCategories: [
      "receiving & storage",
      "material handling",
      "material quality checks",
      "inventory management",
      "waste & disposal",
      "returns & credits (in-store)",
    ],
  },
  {
    superCategory: "Field Operations",
    mainCategory: "Safety & Risk Management",
    subCategories: [
      "general safety",
      "jobsite hazards",
      "ppe requirements",
      "equipment safety",
      "weather & environmental risks",
      "emergency procedures",
      "incident reporting",
    ],
  },
  {
    superCategory: "Business Operations",
    mainCategory: "Office & Administration",
    subCategories: [
      "scheduling",
      "customer communication",
      "billing & invoicing",
      "payroll",
      "accounting",
      "insurance",
      "documentation & records",
    ],
  },
  {
    superCategory: "Business Operations",
    mainCategory: "Sales & Estimating",
    subCategories: [
      "lead intake",
      "client qualification",
      "site visits",
      "estimating",
      "proposals",
      "contracts",
      "project handoffs",
    ],
  },
  {
    superCategory: "Business Operations",
    mainCategory: "Hiring & HR",
    subCategories: [
      "recruiting",
      "interviews",
      "hiring decisions",
      "onboarding",
      "training",
      "performance reviews",
      "discipline & termination",
    ],
  },
  {
    superCategory: "Business Operations",
    mainCategory: "Technology & Systems",
    subCategories: [
      "company software",
      "mobile apps",
      "hardware",
      "data management",
      "security & access",
      "automation",
    ],
  },
  {
    superCategory: "Leadership & Performance",
    mainCategory: "Management & Leadership",
    subCategories: [
      "production management",
      "operations management",
      "quality control",
      "kpis & metrics",
      "meetings",
      "strategic planning",
      "training & sop usage",
      "sop training",
      "role-based training",
      "skill development",
      "certifications",
      "continuing education",
    ],
  },
  {
    superCategory: "Exceptions & Emergencies",
    mainCategory: "Emergency & Exceptions",
    subCategories: [
      "emergency response",
      "customer escalations",
      "equipment failure",
      "weather events",
      "after-hours procedures",
      "custom / one-off",
    ],
  },
];

const SYNONYMS: Record<string, string[]> = {
  "hardscape install": ["pavers", "patio install", "walkway install", "retaining wall install", "retaining wall", "patio", "walkway", "stone wall", "flagstone"],
  "softscape install": ["planting", "mulch install", "bed install", "trees", "shrubs", "perennials", "annuals", "sod install", "seed", "plant"],
  "grading & drainage": ["grading", "drainage", "downspout", "swale", "catch basin", "french drain", "regrading"],
  "irrigation systems": ["irrigation install", "sprinkler install", "irrigreen", "drip irrigation", "sprinkler"],
  "landscape lighting installation": ["lighting install", "low voltage lighting install", "path lights", "uplighting"],
  "decks & structures": ["deck", "pergola", "pavilion", "structure", "carpentry", "arbor", "fence"],
  "water feature installation": ["fountain", "waterfall", "pond", "bubbler", "water feature"],
  "foundations & base installation": ["base", "compaction", "foundation", "subbase", "aggregate base"],

  "lawn maintenance": ["mowing", "string trimming", "edging", "blowing", "lawn care", "turf"],
  "landscape bed maintenance": ["weeding", "bed cleanup", "mulch touch up", "bed edging"],
  "pruning & tree care": ["pruning", "trim", "tree care", "hedge trimming", "tree removal"],
  "fertilization & treatments": ["fertilizer", "weed control", "treatments", "spray", "herbicide", "pesticide", "pre-emergent"],
  "irrigation system maintenance": ["irrigation service", "sprinkler service", "winterize", "startup", "blowout"],
  "landscape lighting maintenance": ["lighting service", "lighting repair", "bulb replacement"],
  "seasonal cleanups": ["spring cleanup", "fall cleanup", "leaf cleanup", "leaf removal"],
  "snow & ice maintenance": ["plowing", "salting", "deicing", "shoveling", "snow removal", "ice management"],

  "daily inspections": ["pre-trip", "daily check", "walk-around", "pre-trip inspection"],
  "preventative maintenance": ["pm", "service interval", "oil change", "maintenance schedule", "preventive maintenance"],
  "repairs & troubleshooting": ["repair", "fix", "troubleshoot", "diagnose"],
  "equipment failure": ["breakdown", "won't start", "equipment down"],

  "general safety": ["safety", "safe work", "safety meeting", "toolbox talk"],
  "incident reporting": ["incident", "near miss", "injury report", "accident report"],
  "ppe requirements": ["ppe", "personal protective equipment", "safety gear", "hard hat", "safety glasses"],

  "lead intake": ["new lead", "inquiry", "contact form"],
  "client qualification": ["qualify", "screening"],
  "estimating": ["estimate", "takeoff", "pricing", "bid"],
  "proposals": ["proposal", "bid proposal"],
  "contracts": ["contract", "agreement"],

  "recruiting": ["recruit", "job ad", "job posting"],
  "interviews": ["interview"],
  "onboarding": ["onboard", "new hire orientation", "new hire", "orientation"],
  "training": ["train", "training program"],

  "customer escalations": ["escalation", "angry customer", "complaint", "customer complaint"],
  "after-hours procedures": ["after hours", "on call", "emergency call"],
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s/()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(titleNorm: string, needleNorm: string, synonyms: string[]): number {
  if (titleNorm.includes(needleNorm)) return 1.0;

  const t = new Set(titleNorm.split(" "));
  const nWords = needleNorm.split(" ").filter(Boolean);
  let overlap = 0;
  for (const w of nWords) if (t.has(w)) overlap++;
  const wordScore = nWords.length ? overlap / nWords.length : 0;

  const synScore = synonyms.reduce((best, syn) => {
    const synN = norm(syn);
    if (titleNorm.includes(synN)) return Math.max(best, 0.92);
    const synWords = synN.split(" ").filter(Boolean);
    let synOverlap = 0;
    for (const w of synWords) if (t.has(w)) synOverlap++;
    const sScore = synWords.length ? (synOverlap / synWords.length) * 0.85 : 0;
    return Math.max(best, sScore);
  }, 0);

  return Math.max(wordScore * 0.8, synScore);
}

function inferSopType(
  titleNorm: string,
  superCategory: SuperCategory,
  _mainCategory: SopMainCategory,
  subCategory: string,
  category: SopMainCategory
): SopClassificationType {
  const t = titleNorm;

  const emergencyHints = ["emergency", "urgent", "after hours", "after-hours", "call-out", "call out", "storm"];
  const checklistHints = ["checklist", "inspection", "inspect", "walk-around", "walk around", "pre-trip", "pre trip"];
  const policyHints = ["policy", "rule", "rules", "prohibited", "required", "must", "allowed", "not allowed"];
  const processHints = ["process", "workflow", "handoff", "handover", "escalation", "routing"];
  const standardHints = ["standard", "spec", "tolerance", "requirement"];
  const referenceHints = ["reference", "guide", "lookup", "faq"];

  if (superCategory === "Exceptions & Emergencies") return "Emergency Protocol";
  if (emergencyHints.some((h) => t.includes(norm(h)))) return "Emergency Protocol";
  if (subCategory.includes("emergency")) return "Emergency Protocol";

  if (checklistHints.some((h) => t.includes(norm(h)))) return "Checklist";
  if (category === "Equipment, Vehicles & Tools" && (t.includes("inspection") || t.includes("daily"))) return "Checklist";

  if (policyHints.some((h) => t.includes(norm(h)))) return "Policy";
  if (processHints.some((h) => t.includes(norm(h)))) return "Process";
  if (standardHints.some((h) => t.includes(norm(h)))) return "Standard";
  if (referenceHints.some((h) => t.includes(norm(h)))) return "Reference";

  return "Procedure";
}

export function autoClassifySOPTitle(title: string): Classification {
  const titleNorm = norm(title);

  let best: { node: TaxonomyNode; sub: string; score: number; matchedOn?: string } | null = null;

  for (const node of TAXONOMY) {
    for (const sub of node.subCategories) {
      const subNorm = norm(sub);
      const synonyms = SYNONYMS[sub] ?? [];
      const s = scoreMatch(titleNorm, subNorm, synonyms);

      if (!best || s > best.score) {
        best = { node, sub, score: s, matchedOn: sub };
      }
    }
  }

  const threshold = 0.62;

  if (!best || best.score < threshold) {
    const superCategory: SuperCategory = "Exceptions & Emergencies";
    const mainCategory: SopMainCategory = "Emergency & Exceptions";
    const subCategory = "custom / one-off";
    const sopType = inferSopType(titleNorm, superCategory, mainCategory, subCategory, mainCategory);
    return { superCategory, mainCategory, subCategory, sopType, confidence: 0.2, matchedOn: "fallback" };
  }

  const superCategory = best.node.superCategory;
  const mainCategory = best.node.mainCategory;
  const subCategory = best.sub;
  const sopType = inferSopType(titleNorm, superCategory, mainCategory, subCategory, mainCategory);

  const confidence = Math.min(1, Math.max(0.3, best.score));

  return { superCategory, mainCategory, subCategory, sopType, confidence, matchedOn: best.matchedOn };
}

export function getAllSuperCategories(): SuperCategory[] {
  return ["Field Operations", "Business Operations", "Leadership & Performance", "Exceptions & Emergencies"];
}

export function getMainCategoriesForSuper(superCat: SuperCategory): SopMainCategory[] {
  return TAXONOMY
    .filter((n) => n.superCategory === superCat)
    .map((n) => n.mainCategory);
}

export function getSubCategoriesForMain(mainCat: SopMainCategory): string[] {
  const node = TAXONOMY.find((n) => n.mainCategory === mainCat);
  return node ? node.subCategories : [];
}

export function getTaxonomy() {
  return TAXONOMY;
}
