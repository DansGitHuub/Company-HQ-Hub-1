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
  "hardscape install": [
    "pavers", "patio install", "walkway install", "retaining wall install", "retaining wall",
    "patio", "walkway", "stone wall", "flagstone", "paver", "brick", "block wall", "stone",
    "concrete", "stamped concrete", "natural stone", "bluestone", "travertine", "cobblestone",
    "stepping stones", "fire pit", "firepit", "outdoor kitchen", "seat wall", "seatwall",
    "pillar", "column", "steps", "staircase", "landing", "curbing", "edging stone",
    "polymeric sand", "polymeric", "joint sand", "paver sand", "jointing sand",
    "paver sealer", "sealer", "sealing", "paver base", "paver edging", "edge restraint",
    "soldier course", "border", "herringbone", "running bond", "basket weave",
  ],
  "softscape install": [
    "planting", "mulch install", "bed install", "trees", "shrubs", "perennials", "annuals",
    "sod install", "seed", "plant", "mulch", "mulching", "garden", "flower", "flowers",
    "tree planting", "shrub planting", "hedge", "hedgerow", "ground cover", "groundcover",
    "ornamental grass", "native plants", "transplant", "transplanting", "seeding", "overseeding",
    "hydroseeding", "sod", "sodding", "topsoil", "soil prep", "soil preparation", "bed prep",
    "bed preparation", "landscape bed", "flower bed", "raised bed", "berm",
  ],
  "grading & drainage": [
    "grading", "drainage", "downspout", "swale", "catch basin", "french drain", "regrading",
    "drain", "drains", "grade", "slope", "erosion", "erosion control", "runoff", "stormwater",
    "storm water", "culvert", "basin", "dry well", "drywell", "channel drain", "trench drain",
    "sump pump", "water management", "diversion", "berm", "retention",
  ],
  "irrigation systems": [
    "irrigation install", "sprinkler install", "irrigreen", "drip irrigation", "sprinkler",
    "irrigation", "sprinklers", "watering", "water system", "drip line", "dripline",
    "rain sensor", "smart controller", "valve", "head", "nozzle", "rotor", "popup",
    "pop-up", "zone", "mainline", "lateral", "backflow", "backflow preventer",
  ],
  "landscape lighting installation": [
    "lighting install", "low voltage lighting install", "path lights", "uplighting",
    "landscape light", "landscape lights", "lighting", "outdoor lighting", "led",
    "spotlight", "floodlight", "well light", "step light", "bollard", "transformer",
    "low voltage", "12v",
  ],
  "decks & structures": [
    "deck", "pergola", "pavilion", "structure", "carpentry", "arbor", "fence",
    "fencing", "gate", "gazebo", "trellis", "screen", "privacy screen", "railing",
    "handrail", "post", "beam", "joist", "composite", "trex", "timber", "lumber",
    "wood", "cedar", "pressure treated",
  ],
  "water feature installation": [
    "fountain", "waterfall", "pond", "bubbler", "water feature",
    "pondless", "pondless waterfall", "stream", "cascade", "basin", "reservoir",
    "water garden", "koi pond", "bio falls", "skimmer",
  ],
  "foundations & base installation": [
    "base", "compaction", "foundation", "subbase", "aggregate base",
    "compact", "compacting", "tamper", "plate compactor", "vibratory",
    "crushed stone", "process gravel", "geotextile", "geogrid", "fabric",
    "excavation", "excavate", "dig", "digging",
  ],

  "lawn maintenance": [
    "mowing", "string trimming", "edging", "blowing", "lawn care", "turf",
    "mow", "cut grass", "grass cutting", "trim", "weed eating", "weed whacking",
    "weedwhacker", "weed whacker", "line trimmer", "leaf blower", "blow off",
    "stripe", "striping", "lawn mower", "mower", "zero turn", "push mower",
    "lawn", "grass", "yard", "turf care", "aeration", "aerating", "aerate",
    "dethatching", "dethatch", "overseeding", "topdressing",
  ],
  "landscape bed maintenance": [
    "weeding", "bed cleanup", "mulch touch up", "bed edging",
    "weed", "weeds", "bed", "beds", "mulch refresh", "touch up",
    "hand weeding", "cultivating", "cultivate", "hoe", "hoeing",
    "bed maintenance", "garden maintenance",
  ],
  "pruning & tree care": [
    "pruning", "trim", "tree care", "hedge trimming", "tree removal",
    "prune", "pruner", "shears", "loppers", "chainsaw", "chain saw",
    "tree", "branch", "limb", "canopy", "crown", "thinning",
    "deadwooding", "deadwood", "sucker removal", "suckers",
    "arborist", "climbing", "rigging", "felling", "stump", "stump grinding",
    "stump grind", "stump removal", "brush", "brush removal", "chipping",
    "chipper", "wood chipper", "bush", "bushes", "shrub trimming", "topping",
  ],
  "fertilization & treatments": [
    "fertilizer", "weed control", "treatments", "spray", "herbicide", "pesticide",
    "pre-emergent", "fertilize", "fertilizing", "feed", "feeding", "nutrient",
    "lime", "liming", "soil test", "soil testing", "ph", "application",
    "applicator", "sprayer", "granular", "liquid", "organic", "synthetic",
    "fungicide", "insecticide", "grub", "grub control", "broadleaf",
    "crabgrass", "dandelion", "clover", "moss", "treatment", "program",
    "round", "lawn program", "turf program",
  ],
  "irrigation system maintenance": [
    "irrigation service", "sprinkler service", "winterize", "startup", "blowout",
    "winterization", "spring startup", "spring start up", "blow out",
    "irrigation repair", "sprinkler repair", "head replacement", "valve repair",
    "leak", "broken head", "broken sprinkler", "adjust heads", "adjustment",
    "irrigation check", "system check", "pressure test",
  ],
  "landscape lighting maintenance": [
    "lighting service", "lighting repair", "bulb replacement",
    "light repair", "lamp replacement", "timer", "photocell",
    "transformer check", "voltage check", "wire repair",
  ],
  "seasonal cleanups": [
    "spring cleanup", "fall cleanup", "leaf cleanup", "leaf removal",
    "cleanup", "clean up", "spring clean", "fall clean", "leaves",
    "debris", "debris removal", "garden cleanup", "yard cleanup",
    "bed cleanup", "seasonal", "winterize beds", "cutback", "cut back",
    "perennial cutback",
  ],
  "snow & ice maintenance": [
    "plowing", "salting", "deicing", "shoveling", "snow removal", "ice management",
    "snow", "ice", "plow", "salt", "deicer", "de-icer", "sand", "sanding",
    "brine", "sidewalk", "walkway clearing", "snow blower", "snow blowing",
    "ice melt", "calcium chloride", "rock salt", "winter", "winter maintenance",
    "snow plow", "snow plowing", "snowplow",
  ],

  "daily inspections": [
    "pre-trip", "daily check", "walk-around", "pre-trip inspection",
    "pre trip", "pretrip", "walkaround", "daily inspection", "morning check",
    "pre-start", "pre start", "prestart", "startup check", "start up check",
    "vehicle inspection", "truck inspection", "trailer inspection",
  ],
  "preventative maintenance": [
    "pm", "service interval", "oil change", "maintenance schedule", "preventive maintenance",
    "preventive", "preventative", "service", "servicing", "maintenance",
    "tune up", "tuneup", "tune-up", "blade sharpen", "blade sharpening",
    "grease", "greasing", "lubricate", "lubrication", "filter", "air filter",
    "spark plug", "belt", "belts", "fluid check", "fluid change",
  ],
  "repairs & troubleshooting": [
    "repair", "fix", "troubleshoot", "diagnose",
    "broken", "malfunction", "won't start", "wont start", "not working",
    "not running", "stalling", "vibrating", "smoke", "smoking", "leaking",
    "overheating", "diagnostic",
  ],
  "trailers": [
    "trailer", "hitch", "hitching", "unhitching", "trailer loading",
    "trailer maintenance", "trailer inspection", "towing", "tow",
    "trailer brake", "trailer light", "ramp", "tie down", "tie-down",
    "strap", "strapping", "securing load",
  ],
  "hand tools": [
    "hand tool", "shovel", "rake", "hoe", "wheelbarrow", "trowel",
    "level", "tape measure", "hammer", "chisel", "pry bar",
    "hand saw", "snips", "pruners", "loppers", "mattock", "pick",
    "posthole digger", "tamper", "hand tamper", "broom",
  ],
  "power equipment": [
    "power equipment", "mower", "blower", "trimmer", "edger",
    "chainsaw", "chain saw", "hedge trimmer", "power washer", "pressure washer",
    "backpack blower", "walk behind", "stand on", "stander",
    "zero turn", "aerator", "dethatcher", "sod cutter", "tiller",
    "rototiller", "plate compactor", "cut off saw", "demo saw", "concrete saw",
    "chop saw", "generator",
  ],
  "heavy equipment": [
    "heavy equipment", "excavator", "skid steer", "bobcat", "mini excavator",
    "loader", "backhoe", "dozer", "bulldozer", "dump truck", "track loader",
    "compact track loader", "ctl", "wheel loader", "forklift", "telehandler",
    "crane", "bucket truck", "dingo", "vermeer",
  ],
  "vehicles": [
    "vehicle", "truck", "van", "car", "fleet", "pickup",
    "f150", "f250", "f350", "ram", "chevy", "gmc", "ford",
    "diesel", "fuel", "gas", "cdl", "dot", "registration",
    "fleet management",
  ],

  "receiving & storage": [
    "receiving", "delivery", "unload", "unloading", "storage",
    "stockpile", "yard storage", "material storage", "warehouse",
  ],
  "material handling": [
    "material handling", "loading", "hauling", "transport",
    "material delivery", "picking", "staging",
  ],
  "material quality checks": [
    "quality check", "material inspection", "material check",
    "color match", "grade check", "spec check",
  ],
  "inventory management": [
    "inventory", "stock", "count", "reorder", "supply",
    "stocktake", "stock take", "ordering", "purchase order",
  ],
  "waste & disposal": [
    "waste", "disposal", "dump", "dumpster", "debris disposal",
    "cleanup waste", "haul away", "hauling", "landfill", "recycling",
  ],

  "general safety": [
    "safety", "safe work", "safety meeting", "toolbox talk",
    "safety talk", "jsa", "job safety analysis", "hazard", "safe",
    "safety training", "safety orientation", "osha", "safety plan",
    "health and safety", "health & safety",
  ],
  "jobsite hazards": [
    "hazard", "hazardous", "danger", "dangerous", "risk assessment",
    "jobsite safety", "site safety", "worksite", "work site",
    "utility locate", "utility locates", "811", "call before you dig",
    "underground", "overhead", "power line", "gas line",
  ],
  "ppe requirements": [
    "ppe", "personal protective equipment", "safety gear", "hard hat",
    "safety glasses", "gloves", "boots", "steel toe", "steel-toe",
    "hearing protection", "ear plugs", "earplugs", "ear muffs",
    "hi vis", "hi-vis", "high visibility", "vest", "chaps",
    "face shield", "respirator", "mask", "dust mask", "n95",
    "safety equipment", "protective equipment",
  ],
  "equipment safety": [
    "equipment safety", "machine safety", "lockout", "tagout",
    "lockout tagout", "loto", "guard", "guarding", "safety switch",
    "kill switch", "dead man", "dead man switch", "rollover",
    "rops", "tip over", "overhead protection",
  ],
  "incident reporting": [
    "incident", "near miss", "injury report", "accident report",
    "accident", "injury", "report", "reporting", "workers comp",
    "workers compensation", "claim", "investigation",
  ],

  "scheduling": [
    "schedule", "scheduling", "dispatch", "dispatching", "route",
    "routing", "calendar", "appointment", "booking",
  ],
  "customer communication": [
    "customer communication", "client communication", "email", "phone",
    "call", "text", "message", "messaging", "customer service",
    "client service", "follow up", "follow-up", "followup",
    "customer interaction", "client interaction", "greeting",
    "communication", "communicate",
  ],
  "billing & invoicing": [
    "billing", "invoicing", "invoice", "bill", "payment",
    "collections", "accounts receivable", "ar", "charge",
    "credit card", "check", "ach",
  ],
  "payroll": [
    "payroll", "timesheet", "time sheet", "time tracking",
    "time card", "timecard", "hours", "overtime", "pay",
    "wages", "salary", "direct deposit",
  ],

  "lead intake": ["new lead", "inquiry", "contact form", "lead", "leads", "prospect", "incoming call"],
  "client qualification": ["qualify", "screening", "qualification", "qualified", "disqualify"],
  "estimating": [
    "estimate", "takeoff", "pricing", "bid",
    "measurement", "measuring", "quote", "quoting",
    "cost", "costing", "markup", "margin", "price",
  ],
  "proposals": ["proposal", "bid proposal", "present", "presentation", "scope of work", "scope"],
  "contracts": ["contract", "agreement", "sign", "signing", "terms", "conditions"],
  "site visits": [
    "site visit", "site assessment", "walkthrough", "walk through",
    "consultation", "consult", "property assessment", "site evaluation",
  ],

  "recruiting": [
    "recruit", "job ad", "job posting", "hiring", "hire",
    "staffing", "talent", "applicant", "application", "apply",
    "indeed", "job board", "career", "careers",
  ],
  "interviews": [
    "interview", "interviewing", "screen", "screening call",
    "phone screen", "in person", "panel", "behavioral",
  ],
  "onboarding": [
    "onboard", "new hire orientation", "new hire", "orientation",
    "onboarding", "first day", "day one", "welcome", "new employee",
    "new team member",
  ],
  "training": [
    "train", "training program", "training", "certify", "certification",
    "class", "course", "workshop", "seminar", "develop", "development",
    "skill", "education", "learning",
  ],
  "performance reviews": [
    "performance review", "review", "evaluation", "eval",
    "annual review", "90 day", "90-day", "feedback", "assessment",
    "appraisal", "goals", "goal setting",
  ],
  "discipline & termination": [
    "discipline", "termination", "terminate", "fire", "fired",
    "write up", "writeup", "write-up", "warning", "verbal warning",
    "written warning", "suspension", "suspend", "corrective action",
    "progressive discipline", "let go", "separation",
  ],

  "customer escalations": [
    "escalation", "angry customer", "complaint", "customer complaint",
    "escalate", "unhappy", "dissatisfied", "refund", "redo",
    "callback", "call back", "warranty", "warranty claim",
  ],
  "after-hours procedures": [
    "after hours", "on call", "emergency call",
    "after-hours", "afterhours", "on-call", "oncall",
    "weekend", "holiday", "night", "overnight",
  ],
  "emergency response": [
    "emergency", "urgent", "crisis", "storm damage", "flood",
    "fire", "medical", "first aid", "cpr", "aed",
    "evacuation", "lockdown", "active shooter",
    "tornado", "hurricane", "lightning",
  ],
  "equipment failure": [
    "breakdown", "won't start", "equipment down",
    "failure", "failed", "broke down", "out of service",
    "mechanical failure", "engine failure", "hydraulic",
  ],
  "weather events": [
    "weather", "storm", "rain", "wind", "heat",
    "cold", "freeze", "frost", "ice storm", "severe weather",
    "lightning", "thunder", "hail",
  ],

  "company software": [
    "software", "app", "platform", "system", "crm",
    "erp", "project management", "aspire", "lmn", "service autopilot",
    "jobber", "single ops", "singleops", "busybusy", "hubspot",
    "quickbooks", "xero",
  ],
  "mobile apps": [
    "mobile app", "mobile", "phone app", "tablet",
    "ipad", "android", "iphone", "ios",
  ],
  "data management": [
    "data", "database", "backup", "cloud", "file",
    "document", "folder", "drive", "google drive", "dropbox",
    "sharepoint", "onedrive",
  ],

  "production management": [
    "production", "productivity", "efficiency", "crew management",
    "crew leader", "foreman", "supervisor", "daily report",
    "job costing", "labor", "man hours", "man-hours",
  ],
  "quality control": [
    "quality", "qc", "quality assurance", "qa", "inspection",
    "punch list", "punchlist", "walkthrough", "final inspection",
    "quality check", "standards",
  ],
  "kpis & metrics": [
    "kpi", "metric", "metrics", "benchmark", "goal",
    "target", "performance", "dashboard", "report", "reporting",
    "tracking", "scorecard",
  ],
  "meetings": [
    "meeting", "huddle", "standup", "stand up", "stand-up",
    "morning meeting", "weekly meeting", "team meeting",
    "one on one", "1 on 1", "1:1",
  ],
  "strategic planning": [
    "strategic", "strategy", "planning", "business plan",
    "growth", "expansion", "vision", "mission",
    "annual plan", "quarterly plan",
  ],
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s/()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fuzzyWordMatch(word: string, target: string): number {
  if (word === target) return 1.0;
  if (word.length < 3 || target.length < 3) return word === target ? 1.0 : 0;
  if (word.startsWith(target) || target.startsWith(word)) return 0.9;

  const dist = levenshtein(word, target);
  const maxLen = Math.max(word.length, target.length);
  const similarity = 1 - (dist / maxLen);

  if (dist <= 1 && maxLen >= 4) return Math.max(similarity, 0.85);
  if (dist <= 2 && maxLen >= 6) return Math.max(similarity, 0.7);
  return similarity >= 0.6 ? similarity : 0;
}

function scoreMatch(titleNorm: string, needleNorm: string, synonyms: string[]): number {
  if (titleNorm.includes(needleNorm)) return 1.0;

  const titleWords = titleNorm.split(" ").filter(Boolean);
  const nWords = needleNorm.split(" ").filter(Boolean);

  let exactOverlap = 0;
  let fuzzyOverlap = 0;
  for (const nw of nWords) {
    if (titleWords.some(tw => tw === nw)) {
      exactOverlap++;
    } else {
      const bestFuzzy = Math.max(...titleWords.map(tw => fuzzyWordMatch(tw, nw)), 0);
      if (bestFuzzy >= 0.7) fuzzyOverlap += bestFuzzy;
    }
  }
  const wordScore = nWords.length ? ((exactOverlap + fuzzyOverlap * 0.85) / nWords.length) : 0;

  const synScore = synonyms.reduce((best, syn) => {
    const synN = norm(syn);
    if (titleNorm.includes(synN)) return Math.max(best, 0.92);

    const synWords = synN.split(" ").filter(Boolean);
    let synExact = 0;
    let synFuzzy = 0;
    for (const sw of synWords) {
      if (titleWords.some(tw => tw === sw)) {
        synExact++;
      } else {
        const bestF = Math.max(...titleWords.map(tw => fuzzyWordMatch(tw, sw)), 0);
        if (bestF >= 0.7) synFuzzy += bestF;
      }
    }
    const sScore = synWords.length ? ((synExact + synFuzzy * 0.85) / synWords.length) * 0.88 : 0;

    for (const sw of synWords) {
      for (const tw of titleWords) {
        const fm = fuzzyWordMatch(tw, sw);
        if (fm >= 0.8) return Math.max(best, fm * 0.9);
      }
    }

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

  const threshold = 0.5;

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
