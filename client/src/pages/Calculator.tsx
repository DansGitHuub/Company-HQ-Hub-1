import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, CheckCircle2, Link as LinkIcon, FileText, Calculator as CalcIcon, RotateCcw } from "lucide-react";

type Intent =
  | "calculate_materials"
  | "convert_units"
  | "apply_chemical"
  | "size_system";

type WorkCategory =
  | "softscape"
  | "hardscape"
  | "lighting"
  | "irrigation"
  | "general"
  | "chemical";

type TaskKey =
  | "mulch_soil_gravel"
  | "retaining_wall_base"
  | "paver_base"
  | "polymeric_sand"
  | "fertilizer_granular"
  | "liquid_spray_mix"
  | "lighting_transformer"
  | "lighting_voltage_drop_simple"
  | "irrigation_runtime"
  | "unit_converter";

type Preset = {
  id: string;
  name: string;
  description?: string;
  defaults: Record<string, number | string>;
};

type Field =
  | { key: string; label: string; help?: string; type: "number"; unit?: string; min?: number; step?: number }
  | { key: string; label: string; help?: string; type: "select"; options: { value: string; label: string }[] };

type CalcResult = {
  title: string;
  lines: { label: string; value: string }[];
  assumptions: string[];
  safety: string[];
  sopLinks: { title: string; url: string }[];
  manufacturerDocs: { title: string; url: string }[];
};

function roundTo(n: number, decimals = 2) {
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}

function clamp(n: number, min?: number, max?: number) {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

function ftToIn(ft: number) { return ft * 12; }
function inToFt(inches: number) { return inches / 12; }
function sqFtToAcres(sqft: number) { return sqft / 43560; }
function acresToSqFt(acres: number) { return acres * 43560; }
function cuFtToCuYd(cuft: number) { return cuft / 27; }
function cuYdToCuFt(cuyd: number) { return cuyd * 27; }
function gallonsToLiters(gal: number) { return gal * 3.78541; }
function litersToGallons(l: number) { return l / 3.78541; }
function lbsToKg(lbs: number) { return lbs * 0.45359237; }
function kgToLbs(kg: number) { return kg / 0.45359237; }
function tonsToLbs(tons: number) { return tons * 2000; }
function lbsToTons(lbs: number) { return lbs / 2000; }
function cmToIn(cm: number) { return cm / 2.54; }
function inToCm(inches: number) { return inches * 2.54; }
function mToFt(m: number) { return m * 3.28084; }
function ftToM(ft: number) { return ft / 3.28084; }

const DEFAULT_DENSITIES_LB_PER_CUFT: Record<string, number> = {
  "mulch": 20,
  "topsoil": 75,
  "compost": 55,
  "gravel": 95,
  "base_aggregate": 100,
  "sand": 100,
  "drain_stone": 90,
};

function estimateTonsFromCuYd(cuyd: number, lbPerCuFt: number) {
  const cuft = cuYdToCuFt(cuyd);
  const lbs = cuft * lbPerCuFt;
  return lbsToTons(lbs);
}

type Product = {
  id: string;
  name: string;
  category: "herbicide" | "insecticide" | "fertilizer" | "adjuvant" | "preemergent" | "fungicide" | "other";
  manufacturer: string;
  labelRateHint: string;
  ppeHint: string[];
  reentryHint?: string;
  docs: { title: string; url: string }[];
  sopLinks: { title: string; url: string }[];
};

const PRODUCT_LIBRARY: Product[] = [
  {
    id: "roundup-quikpro",
    name: "Roundup QuikPRO",
    category: "herbicide",
    manufacturer: "Bayer / Roundup",
    labelRateHint: "Rate varies by target weed and application method. Always follow the label.",
    ppeHint: ["Gloves", "Eye protection", "Long sleeves/pants"],
    reentryHint: "Follow label REI.",
    docs: [
      { title: "Product Label (add real link)", url: "#" },
      { title: "SDS (add real link)", url: "#" },
    ],
    sopLinks: [
      { title: "SOP: Spot-spray weeds (add link)", url: "#" },
    ],
  },
  {
    id: "dimension",
    name: "Dimension (dithiopyr)",
    category: "preemergent",
    manufacturer: "Various",
    labelRateHint: "Rate depends on turf type and timing. Always follow the label.",
    ppeHint: ["Gloves", "Eye protection"],
    docs: [
      { title: "Product Label (add real link)", url: "#" },
      { title: "SDS (add real link)", url: "#" },
    ],
    sopLinks: [
      { title: "SOP: Pre-emergent application (add link)", url: "#" },
    ],
  },
  {
    id: "crosscheck",
    name: "CrossCheck (insecticide)",
    category: "insecticide",
    manufacturer: "Various",
    labelRateHint: "Mixing/application depends on pest and surface. Always follow the label.",
    ppeHint: ["Gloves", "Eye protection", "Long sleeves/pants"],
    docs: [
      { title: "Product Label (add real link)", url: "#" },
      { title: "SDS (add real link)", url: "#" },
    ],
    sopLinks: [
      { title: "SOP: Perimeter insect control (add link)", url: "#" },
    ],
  },
];

const INTENTS: { id: Intent; title: string; desc: string }[] = [
  { id: "calculate_materials", title: "Calculate Materials", desc: "Mulch, soil, gravel, base, sand, walls, pavers, etc." },
  { id: "convert_units", title: "Convert Units", desc: "Feet, inches, yards, sq ft, acres, gallons, liters, etc." },
  { id: "apply_chemical", title: "Apply Chemical Product", desc: "Mixing math + safety + label reference links" },
  { id: "size_system", title: "Size a System", desc: "Lighting and irrigation quick sizing tools" },
];

const CATEGORIES: { id: WorkCategory; title: string; desc: string }[] = [
  { id: "softscape", title: "Softscape", desc: "Mulch, soil, planting, turf inputs" },
  { id: "hardscape", title: "Hardscape", desc: "Pavers, base, polymeric sand, retaining walls" },
  { id: "lighting", title: "Landscape Lighting", desc: "Transformer sizing, voltage drop basics" },
  { id: "irrigation", title: "Irrigation", desc: "Runtime, precipitation rate helpers" },
  { id: "chemical", title: "Chemical Application", desc: "Label-based mixing and safety" },
  { id: "general", title: "General / Conversions", desc: "Convert units and field math" },
];

const TASKS: {
  key: TaskKey;
  category: WorkCategory;
  intent: Intent;
  title: string;
  desc: string;
}[] = [
  { key: "mulch_soil_gravel", category: "softscape", intent: "calculate_materials", title: "Mulch / Soil / Gravel (Area x Depth)", desc: "Cubic yards, optional tons, waste factor" },
  { key: "paver_base", category: "hardscape", intent: "calculate_materials", title: "Paver Base Aggregate (Area x Depth)", desc: "Base cu yd + compaction + tons estimate" },
  { key: "polymeric_sand", category: "hardscape", intent: "calculate_materials", title: "Polymeric Sand (Area + Joint Assumptions)", desc: "Bag estimate with assumptions" },
  { key: "retaining_wall_base", category: "hardscape", intent: "calculate_materials", title: "Retaining Wall Base Course (Length-based)", desc: "Trench volume → base aggregate; not 10x10" },
  { key: "unit_converter", category: "general", intent: "convert_units", title: "Unit Converter", desc: "Length, area, volume, weight, gallons/liters" },
  { key: "fertilizer_granular", category: "chemical", intent: "apply_chemical", title: "Granular Product (lbs / 1,000 sq ft)", desc: "Total product needed + quick checks" },
  { key: "liquid_spray_mix", category: "chemical", intent: "apply_chemical", title: "Liquid Spray Mix (oz/gal + spray volume)", desc: "Product oz + water gallons + safety reminders" },
  { key: "lighting_transformer", category: "lighting", intent: "size_system", title: "Transformer Sizing (Wattage + Headroom)", desc: "Total watts and recommended transformer size" },
  { key: "lighting_voltage_drop_simple", category: "lighting", intent: "size_system", title: "Voltage Drop (Simple Guide)", desc: "Basic run checks; flags risk" },
  { key: "irrigation_runtime", category: "irrigation", intent: "size_system", title: "Irrigation Runtime (Depth / Precip Rate)", desc: "Minutes to apply target inches" },
];

function getPresets(task: TaskKey): Preset[] {
  switch (task) {
    case "mulch_soil_gravel":
      return [
        { id: "small", name: "Small", description: "Typical small bed refresh", defaults: { areaSqFt: 200, depthIn: 2, wastePct: 8, material: "mulch" } },
        { id: "typical", name: "Typical", description: "Most common bed job", defaults: { areaSqFt: 800, depthIn: 2.5, wastePct: 10, material: "mulch" } },
        { id: "large", name: "Large", description: "Large property / multiple beds", defaults: { areaSqFt: 2500, depthIn: 3, wastePct: 12, material: "mulch" } },
      ];
    case "paver_base":
      return [
        { id: "patio_small", name: "Small Patio", defaults: { areaSqFt: 200, depthIn: 6, compactionPct: 10, wastePct: 8 } },
        { id: "patio_typical", name: "Typical Patio", defaults: { areaSqFt: 500, depthIn: 8, compactionPct: 12, wastePct: 10 } },
        { id: "driveway", name: "Driveway / Heavy", defaults: { areaSqFt: 800, depthIn: 10, compactionPct: 15, wastePct: 12 } },
      ];
    case "retaining_wall_base":
      return [
        { id: "wall_small", name: "Small Wall", defaults: { wallLengthFt: 15, trenchWidthIn: 24, baseDepthIn: 6, wastePct: 10 } },
        { id: "wall_typical", name: "Typical Wall", defaults: { wallLengthFt: 25, trenchWidthIn: 28, baseDepthIn: 6, wastePct: 12 } },
        { id: "wall_large", name: "Large Wall", defaults: { wallLengthFt: 50, trenchWidthIn: 32, baseDepthIn: 8, wastePct: 12 } },
      ];
    case "polymeric_sand":
      return [
        { id: "poly_small", name: "Small Patio", defaults: { areaSqFt: 200, jointWidthIn: 0.25, paverThicknessIn: 2.375, bagCoverageSqFt: 85 } },
        { id: "poly_typical", name: "Typical Patio", defaults: { areaSqFt: 500, jointWidthIn: 0.25, paverThicknessIn: 2.375, bagCoverageSqFt: 85 } },
        { id: "poly_large", name: "Large", defaults: { areaSqFt: 900, jointWidthIn: 0.375, paverThicknessIn: 2.375, bagCoverageSqFt: 75 } },
      ];
    case "fertilizer_granular":
      return [
        { id: "res", name: "Residential Lawn", defaults: { areaSqFt: 5000, rateLbsPer1000: 3.0 } },
        { id: "small", name: "Small Area", defaults: { areaSqFt: 2000, rateLbsPer1000: 3.0 } },
        { id: "large", name: "Large Property", defaults: { areaSqFt: 20000, rateLbsPer1000: 3.0 } },
      ];
    case "liquid_spray_mix":
      return [
        { id: "spot", name: "Spot Spray", defaults: { areaSqFt: 1000, sprayGalPer1000: 1.0, productOzPerGal: 1.5 } },
        { id: "broadcast", name: "Broadcast", defaults: { areaSqFt: 5000, sprayGalPer1000: 1.5, productOzPerGal: 1.5 } },
        { id: "heavy", name: "Heavy Coverage", defaults: { areaSqFt: 12000, sprayGalPer1000: 2.0, productOzPerGal: 1.5 } },
      ];
    case "lighting_transformer":
      return [
        { id: "small", name: "Small System", defaults: { fixtureCount: 8, wattsPerFixture: 4, headroomPct: 20 } },
        { id: "typical", name: "Typical", defaults: { fixtureCount: 18, wattsPerFixture: 5, headroomPct: 25 } },
        { id: "large", name: "Large", defaults: { fixtureCount: 40, wattsPerFixture: 6, headroomPct: 30 } },
      ];
    case "lighting_voltage_drop_simple":
      return [
        { id: "short", name: "Short Run", defaults: { runLengthFt: 50, totalWatts: 60, wireGauge: "12" } },
        { id: "medium", name: "Medium Run", defaults: { runLengthFt: 120, totalWatts: 120, wireGauge: "12" } },
        { id: "long", name: "Long Run", defaults: { runLengthFt: 200, totalWatts: 200, wireGauge: "10" } },
      ];
    case "irrigation_runtime":
      return [
        { id: "lawn", name: "Lawn", defaults: { targetInches: 0.5, precipInPerHr: 0.6 } },
        { id: "beds", name: "Beds", defaults: { targetInches: 0.25, precipInPerHr: 0.4 } },
        { id: "hot", name: "Hot Weather", defaults: { targetInches: 0.75, precipInPerHr: 0.6 } },
      ];
    case "unit_converter":
    default:
      return [
        { id: "basic", name: "Basic", defaults: { fromType: "length", fromUnit: "ft", toUnit: "in", value: 10 } },
      ];
  }
}

function getFields(task: TaskKey): Field[] {
  switch (task) {
    case "mulch_soil_gravel":
      return [
        { key: "material", label: "Material", type: "select", options: [
          { value: "mulch", label: "Mulch" },
          { value: "topsoil", label: "Topsoil" },
          { value: "compost", label: "Compost" },
          { value: "gravel", label: "Gravel" },
        ] },
        { key: "areaSqFt", label: "Area", help: "Total coverage area", type: "number", unit: "sq ft", min: 1, step: 1 },
        { key: "depthIn", label: "Depth", help: "Installed depth", type: "number", unit: "in", min: 0.25, step: 0.25 },
        { key: "wastePct", label: "Waste / Overage", help: "Optional extra material", type: "number", unit: "%", min: 0, step: 1 },
      ];
    case "paver_base":
      return [
        { key: "areaSqFt", label: "Area", type: "number", unit: "sq ft", min: 1, step: 1 },
        { key: "depthIn", label: "Base Depth", help: "Compacted depth", type: "number", unit: "in", min: 1, step: 0.5 },
        { key: "compactionPct", label: "Compaction Add-On", help: "Extra to account for compaction", type: "number", unit: "%", min: 0, step: 1 },
        { key: "wastePct", label: "Waste / Overage", type: "number", unit: "%", min: 0, step: 1 },
      ];
    case "retaining_wall_base":
      return [
        { key: "wallLengthFt", label: "Wall Length", type: "number", unit: "ft", min: 1, step: 1 },
        { key: "trenchWidthIn", label: "Trench Width", help: "Typically block depth + extra", type: "number", unit: "in", min: 6, step: 1 },
        { key: "baseDepthIn", label: "Base Depth", help: "Compacted base depth", type: "number", unit: "in", min: 3, step: 0.5 },
        { key: "wastePct", label: "Waste / Overage", type: "number", unit: "%", min: 0, step: 1 },
      ];
    case "polymeric_sand":
      return [
        { key: "areaSqFt", label: "Paver Area", type: "number", unit: "sq ft", min: 1, step: 1 },
        { key: "jointWidthIn", label: "Joint Width", type: "number", unit: "in", min: 0.125, step: 0.125 },
        { key: "paverThicknessIn", label: "Paver Thickness", type: "number", unit: "in", min: 1.5, step: 0.125 },
        { key: "bagCoverageSqFt", label: "Bag Coverage", help: "Use product bag spec if known", type: "number", unit: "sq ft/bag", min: 10, step: 1 },
      ];
    case "fertilizer_granular":
      return [
        { key: "areaSqFt", label: "Area", type: "number", unit: "sq ft", min: 1, step: 1 },
        { key: "rateLbsPer1000", label: "Rate", help: "Label rate", type: "number", unit: "lbs / 1,000 sq ft", min: 0.1, step: 0.1 },
      ];
    case "liquid_spray_mix":
      return [
        { key: "areaSqFt", label: "Area Treated", type: "number", unit: "sq ft", min: 1, step: 1 },
        { key: "sprayGalPer1000", label: "Spray Volume", help: "How many gallons per 1,000 sq ft", type: "number", unit: "gal / 1,000 sq ft", min: 0.1, step: 0.1 },
        { key: "productOzPerGal", label: "Product Rate", help: "Label rate", type: "number", unit: "oz / gal", min: 0.1, step: 0.1 },
      ];
    case "lighting_transformer":
      return [
        { key: "fixtureCount", label: "Fixture Count", type: "number", unit: "fixtures", min: 1, step: 1 },
        { key: "wattsPerFixture", label: "Watts per Fixture", type: "number", unit: "W", min: 1, step: 0.5 },
        { key: "headroomPct", label: "Headroom", help: "Extra capacity for reliability", type: "number", unit: "%", min: 0, step: 1 },
      ];
    case "lighting_voltage_drop_simple":
      return [
        { key: "runLengthFt", label: "Run Length", help: "From transformer to farthest fixture", type: "number", unit: "ft", min: 10, step: 1 },
        { key: "totalWatts", label: "Total Watts on Run", type: "number", unit: "W", min: 5, step: 1 },
        { key: "wireGauge", label: "Wire Gauge", type: "select", options: [
          { value: "14", label: "14 AWG" },
          { value: "12", label: "12 AWG" },
          { value: "10", label: "10 AWG" },
          { value: "8", label: "8 AWG" },
        ] },
      ];
    case "irrigation_runtime":
      return [
        { key: "targetInches", label: "Target Water Depth", type: "number", unit: "inches", min: 0.05, step: 0.05 },
        { key: "precipInPerHr", label: "Precipitation Rate", help: "From nozzle chart or measurement", type: "number", unit: "in/hr", min: 0.05, step: 0.05 },
      ];
    case "unit_converter":
    default:
      return [
        { key: "fromType", label: "What are you converting?", type: "select", options: [
          { value: "length", label: "Length" },
          { value: "area", label: "Area" },
          { value: "volume", label: "Volume" },
          { value: "weight", label: "Weight" },
          { value: "liquid", label: "Liquid" },
        ]},
        { key: "value", label: "Value", type: "number", unit: "", min: 0, step: 0.01 },
        { key: "fromUnit", label: "From Unit", type: "select", options: [
          { value: "in", label: "Inches" },
          { value: "ft", label: "Feet" },
          { value: "yd", label: "Yards" },
          { value: "cm", label: "Centimeters" },
          { value: "m", label: "Meters" },
          { value: "sqft", label: "Square Feet" },
          { value: "acre", label: "Acres" },
          { value: "cuft", label: "Cubic Feet" },
          { value: "cuyd", label: "Cubic Yards" },
          { value: "gal", label: "Gallons" },
          { value: "l", label: "Liters" },
          { value: "lb", label: "Pounds" },
          { value: "ton", label: "Tons (US)" },
          { value: "kg", label: "Kilograms" },
        ]},
        { key: "toUnit", label: "To Unit", type: "select", options: [
          { value: "in", label: "Inches" },
          { value: "ft", label: "Feet" },
          { value: "yd", label: "Yards" },
          { value: "cm", label: "Centimeters" },
          { value: "m", label: "Meters" },
          { value: "sqft", label: "Square Feet" },
          { value: "acre", label: "Acres" },
          { value: "cuft", label: "Cubic Feet" },
          { value: "cuyd", label: "Cubic Yards" },
          { value: "gal", label: "Gallons" },
          { value: "l", label: "Liters" },
          { value: "lb", label: "Pounds" },
          { value: "ton", label: "Tons (US)" },
          { value: "kg", label: "Kilograms" },
        ]},
      ];
  }
}

function compute(task: TaskKey, values: Record<string, any>, selectedProduct?: Product): CalcResult {
  const num = (k: string, fallback = 0) => {
    const v = Number(values[k]);
    return Number.isFinite(v) ? v : fallback;
  };

  const sopLinks: { title: string; url: string }[] = [];
  const manufacturerDocs: { title: string; url: string }[] = [];

  if (selectedProduct) {
    sopLinks.push(...selectedProduct.sopLinks);
    manufacturerDocs.push(...selectedProduct.docs);
  }

  switch (task) {
    case "mulch_soil_gravel": {
      const material = String(values.material || "mulch");
      const areaSqFt = clamp(num("areaSqFt", 0), 0);
      const depthIn = clamp(num("depthIn", 0), 0);
      const wastePct = clamp(num("wastePct", 0), 0);
      const depthFt = inToFt(depthIn);
      const cuft = areaSqFt * depthFt;
      const cuyd = cuFtToCuYd(cuft) * (1 + wastePct / 100);
      const density = DEFAULT_DENSITIES_LB_PER_CUFT[material] ?? 85;
      const estTons = estimateTonsFromCuYd(cuyd, density);
      return {
        title: "Material Quantity",
        lines: [
          { label: "Material", value: material },
          { label: "Cubic Yards (incl. waste)", value: `${roundTo(cuyd, 2)} yd\u00B3` },
          { label: "Estimated Tons (rough)", value: `${roundTo(estTons, 2)} tons` },
        ],
        assumptions: [
          "Tons estimate uses a rough density. Use supplier specs for exact conversion.",
          "Waste/overage is optional and depends on job conditions.",
        ],
        safety: [],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Material handling & delivery checks", url: "#" }],
        manufacturerDocs,
      };
    }

    case "paver_base": {
      const areaSqFt = clamp(num("areaSqFt", 0), 0);
      const depthIn = clamp(num("depthIn", 0), 0);
      const compactionPct = clamp(num("compactionPct", 0), 0);
      const wastePct = clamp(num("wastePct", 0), 0);
      const depthFt = inToFt(depthIn);
      const cuft = areaSqFt * depthFt;
      let cuyd = cuFtToCuYd(cuft);
      cuyd = cuyd * (1 + compactionPct / 100) * (1 + wastePct / 100);
      const density = DEFAULT_DENSITIES_LB_PER_CUFT["base_aggregate"] ?? 100;
      const estTons = estimateTonsFromCuYd(cuyd, density);
      return {
        title: "Base Aggregate Required",
        lines: [
          { label: "Cubic Yards (incl. compaction + waste)", value: `${roundTo(cuyd, 2)} yd\u00B3` },
          { label: "Estimated Tons (rough)", value: `${roundTo(estTons, 2)} tons` },
        ],
        assumptions: [
          "Compaction add-on accounts for compaction and minor grade adjustments.",
          "Tons estimate uses rough density. Confirm with supplier ticket.",
        ],
        safety: [],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Paver base installation checklist", url: "#" }],
        manufacturerDocs,
      };
    }

    case "retaining_wall_base": {
      const wallLengthFt = clamp(num("wallLengthFt", 0), 0);
      const trenchWidthIn = clamp(num("trenchWidthIn", 0), 0);
      const baseDepthIn = clamp(num("baseDepthIn", 0), 0);
      const wastePct = clamp(num("wastePct", 0), 0);
      const trenchWidthFt = inToFt(trenchWidthIn);
      const baseDepthFt = inToFt(baseDepthIn);
      const cuft = wallLengthFt * trenchWidthFt * baseDepthFt;
      const cuyd = cuFtToCuYd(cuft) * (1 + wastePct / 100);
      const density = DEFAULT_DENSITIES_LB_PER_CUFT["base_aggregate"] ?? 100;
      const estTons = estimateTonsFromCuYd(cuyd, density);
      return {
        title: "Retaining Wall Base Course",
        lines: [
          { label: "Base Aggregate (incl. waste)", value: `${roundTo(cuyd, 2)} yd\u00B3` },
          { label: "Estimated Tons (rough)", value: `${roundTo(estTons, 2)} tons` },
          { label: "Excavation Volume", value: `${roundTo(cuFtToCuYd(cuft), 2)} yd\u00B3 (before waste)` },
        ],
        assumptions: [
          "This calculator uses wall length x trench width x base depth (correct for walls).",
          "Trench width is often block depth + extra space\u2014verify per manufacturer.",
          "Tons estimate is rough\u2014confirm with supplier.",
        ],
        safety: [],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Retaining wall base course setup", url: "#" }],
        manufacturerDocs,
      };
    }

    case "polymeric_sand": {
      const areaSqFt = clamp(num("areaSqFt", 0), 0);
      const jointWidthIn = clamp(num("jointWidthIn", 0), 0);
      const bagCoverageSqFt = clamp(num("bagCoverageSqFt", 1), 1);
      const baseline = 0.25;
      const widthFactor = jointWidthIn / baseline;
      const adjustedCoverage = bagCoverageSqFt / Math.max(0.6, widthFactor);
      const bags = Math.ceil(areaSqFt / adjustedCoverage);
      return {
        title: "Polymeric Sand Estimate",
        lines: [
          { label: "Estimated Bags", value: `${bags} bags` },
          { label: "Coverage Assumption", value: `${roundTo(adjustedCoverage, 1)} sq ft/bag (adjusted)` },
        ],
        assumptions: [
          "This is an estimate. Best practice: use the exact coverage chart from the bag.",
          "Joint width has a strong effect. If joints are wider than expected, you need more bags.",
        ],
        safety: [],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Polymeric sand installation steps", url: "#" }],
        manufacturerDocs,
      };
    }

    case "fertilizer_granular": {
      const areaSqFt = clamp(num("areaSqFt", 0), 0);
      const rate = clamp(num("rateLbsPer1000", 0), 0);
      const totalLbs = (areaSqFt / 1000) * rate;
      return {
        title: "Granular Application",
        lines: [
          { label: "Total Product Needed", value: `${roundTo(totalLbs, 2)} lbs` },
          { label: "Area", value: `${roundTo(areaSqFt, 0)} sq ft` },
          { label: "Rate", value: `${roundTo(rate, 2)} lbs / 1,000 sq ft` },
        ],
        assumptions: [
          "Always verify the label rate for the exact product and turf type.",
        ],
        safety: selectedProduct?.ppeHint?.length ? selectedProduct.ppeHint : ["Follow label PPE requirements."],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Granular product application", url: "#" }],
        manufacturerDocs,
      };
    }

    case "liquid_spray_mix": {
      const areaSqFt = clamp(num("areaSqFt", 0), 0);
      const sprayGalPer1000 = clamp(num("sprayGalPer1000", 0), 0);
      const productOzPerGal = clamp(num("productOzPerGal", 0), 0);
      const totalWaterGal = (areaSqFt / 1000) * sprayGalPer1000;
      const totalProductOz = totalWaterGal * productOzPerGal;
      return {
        title: "Liquid Spray Mix",
        lines: [
          { label: "Total Water", value: `${roundTo(totalWaterGal, 2)} gal` },
          { label: "Total Product", value: `${roundTo(totalProductOz, 2)} oz` },
          { label: "Rate", value: `${roundTo(productOzPerGal, 2)} oz/gal` },
          { label: "Spray Volume", value: `${roundTo(sprayGalPer1000, 2)} gal / 1,000 sq ft` },
        ],
        assumptions: [
          "This does NOT replace label directions\u2014confirm exact mixing and target rates from the product label.",
          "If calibrations are off, actual coverage changes. Calibrate sprayer regularly.",
        ],
        safety: selectedProduct?.ppeHint?.length ? selectedProduct.ppeHint : ["Follow label PPE requirements."],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Sprayer mixing & calibration", url: "#" }],
        manufacturerDocs,
      };
    }

    case "lighting_transformer": {
      const fixtureCount = clamp(num("fixtureCount", 0), 0);
      const wattsPerFixture = clamp(num("wattsPerFixture", 0), 0);
      const headroomPct = clamp(num("headroomPct", 0), 0);
      const totalWatts = fixtureCount * wattsPerFixture;
      const recommendedWatts = totalWatts * (1 + headroomPct / 100);
      const commonSizes = [60, 100, 150, 200, 300, 600];
      const recommendedSize = commonSizes.find(s => s >= recommendedWatts) ?? commonSizes[commonSizes.length - 1];
      return {
        title: "Transformer Sizing",
        lines: [
          { label: "Total Load", value: `${roundTo(totalWatts, 0)} W` },
          { label: "Recommended Capacity", value: `${roundTo(recommendedWatts, 0)} W (with headroom)` },
          { label: "Suggested Transformer", value: `${recommendedSize} W` },
        ],
        assumptions: [
          "This is a sizing guideline. Voltage drop and run design still matter.",
          "Keep loads balanced across taps/outputs when available.",
        ],
        safety: [],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Lighting system commissioning", url: "#" }],
        manufacturerDocs,
      };
    }

    case "lighting_voltage_drop_simple": {
      const runLengthFt = clamp(num("runLengthFt", 0), 0);
      const totalWatts = clamp(num("totalWatts", 0), 0);
      const wireGauge = String(values.wireGauge || "12");
      let risk = "Low";
      if (runLengthFt > 150 && totalWatts > 100) risk = "High";
      else if (runLengthFt > 100 && totalWatts > 80) risk = "Medium";
      const guidance =
        risk === "High"
          ? "High risk of dimming. Consider heavier gauge, shorter runs, or multiple feeds."
          : risk === "Medium"
            ? "Moderate risk. Consider heavier gauge or splitting the run."
            : "Likely OK for many installs. Verify in field.";
      return {
        title: "Voltage Drop (Simple Guide)",
        lines: [
          { label: "Risk Level", value: risk },
          { label: "Guidance", value: guidance },
          { label: "Run Length", value: `${roundTo(runLengthFt, 0)} ft` },
          { label: "Total Watts", value: `${roundTo(totalWatts, 0)} W` },
          { label: "Wire Gauge", value: `${wireGauge} AWG` },
        ],
        assumptions: [
          "This is a simplified check, not an engineering-grade voltage-drop model.",
          "For guaranteed performance, use a proper voltage drop table/calculator per manufacturer.",
        ],
        safety: [],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Lighting voltage checks & troubleshooting", url: "#" }],
        manufacturerDocs,
      };
    }

    case "irrigation_runtime": {
      const targetInches = clamp(num("targetInches", 0), 0);
      const precipInPerHr = clamp(num("precipInPerHr", 0.01), 0.01);
      const hours = targetInches / precipInPerHr;
      const minutes = hours * 60;
      return {
        title: "Irrigation Runtime",
        lines: [
          { label: "Estimated Runtime", value: `${roundTo(minutes, 0)} minutes` },
          { label: "Target Depth", value: `${roundTo(targetInches, 2)} in` },
          { label: "Precip Rate", value: `${roundTo(precipInPerHr, 2)} in/hr` },
        ],
        assumptions: [
          "Cycle/soak may be needed to prevent runoff on slopes or clay soils.",
          "Nozzle charts and real catch-cup tests improve accuracy.",
        ],
        safety: [],
        sopLinks: sopLinks.length ? sopLinks : [{ title: "SOP: Irrigation audit & catch-cup test", url: "#" }],
        manufacturerDocs,
      };
    }

    case "unit_converter":
    default: {
      const value = num("value", 0);
      const fromUnit = String(values.fromUnit || "ft");
      const toUnit = String(values.toUnit || "in");
      const converted = convertAny(value, fromUnit, toUnit);
      return {
        title: "Conversion Result",
        lines: [
          { label: "From", value: `${value} ${fromUnit}` },
          { label: "To", value: `${roundTo(converted, 6)} ${toUnit}` },
        ],
        assumptions: [],
        safety: [],
        sopLinks: [{ title: "SOP: Measurement standards", url: "#" }],
        manufacturerDocs: [],
      };
    }
  }
}

function convertAny(value: number, from: string, to: string) {
  if (from === to) return value;

  const lengthUnits = new Set(["in", "ft", "yd", "cm", "m"]);
  if (lengthUnits.has(from) && lengthUnits.has(to)) {
    let inches = value;
    if (from === "ft") inches = ftToIn(value);
    if (from === "yd") inches = ftToIn(value * 3);
    if (from === "cm") inches = cmToIn(value);
    if (from === "m") inches = ftToIn(mToFt(value));
    if (to === "in") return inches;
    if (to === "ft") return inToFt(inches);
    if (to === "yd") return inToFt(inches) / 3;
    if (to === "cm") return inToCm(inches);
    if (to === "m") return ftToM(inToFt(inches));
  }

  const areaUnits = new Set(["sqft", "acre"]);
  if (areaUnits.has(from) && areaUnits.has(to)) {
    if (from === "sqft" && to === "acre") return sqFtToAcres(value);
    if (from === "acre" && to === "sqft") return acresToSqFt(value);
  }

  const volUnits = new Set(["cuft", "cuyd"]);
  if (volUnits.has(from) && volUnits.has(to)) {
    if (from === "cuft" && to === "cuyd") return cuFtToCuYd(value);
    if (from === "cuyd" && to === "cuft") return cuYdToCuFt(value);
  }

  const liquidUnits = new Set(["gal", "l"]);
  if (liquidUnits.has(from) && liquidUnits.has(to)) {
    if (from === "gal" && to === "l") return gallonsToLiters(value);
    if (from === "l" && to === "gal") return litersToGallons(value);
  }

  const weightUnits = new Set(["lb", "ton", "kg"]);
  if (weightUnits.has(from) && weightUnits.has(to)) {
    let lbs = value;
    if (from === "ton") lbs = tonsToLbs(value);
    if (from === "kg") lbs = kgToLbs(value);
    if (to === "lb") return lbs;
    if (to === "ton") return lbsToTons(lbs);
    if (to === "kg") return lbsToKg(lbs);
  }

  return NaN;
}

type WizardState = {
  intent?: Intent;
  category?: WorkCategory;
  task?: TaskKey;
  productId?: string;
  presetId?: string;
  values: Record<string, any>;
};

const WIZARD_PAGES = [
  "Intent",
  "Category",
  "Task",
  "Product",
  "Preset",
  "Inputs",
  "Results",
] as const;

export default function CalculatorPage() {
  const [state, setState] = useState<WizardState>({ values: {} });
  const [pageIndex, setPageIndex] = useState(0);

  const intent = state.intent;
  const category = state.category;
  const task = state.task;

  const availableTasks = useMemo(() => {
    if (!intent || !category) return [];
    return TASKS.filter(t => t.intent === intent && t.category === category);
  }, [intent, category]);

  const needsProduct = useMemo(() => {
    return intent === "apply_chemical";
  }, [intent]);

  const selectedProduct = useMemo(() => {
    if (!state.productId) return undefined;
    return PRODUCT_LIBRARY.find(p => p.id === state.productId);
  }, [state.productId]);

  const presets = useMemo(() => (task ? getPresets(task) : []), [task]);
  const fields = useMemo(() => (task ? getFields(task) : []), [task]);

  const progress = useMemo(() => {
    return ((pageIndex + 1) / WIZARD_PAGES.length) * 100;
  }, [pageIndex]);

  const canNext = useMemo(() => {
    const page = WIZARD_PAGES[pageIndex];
    if (page === "Intent") return !!state.intent;
    if (page === "Category") return !!state.category;
    if (page === "Task") return !!state.task;
    if (page === "Product") return true;
    if (page === "Preset") return !!state.presetId;
    if (page === "Inputs") {
      if (!task) return false;
      for (const f of fields) {
        if (f.type === "number") {
          const v = state.values[f.key];
          if (v === "" || v === undefined || v === null) return false;
          if (!Number.isFinite(Number(v))) return false;
        }
        if (f.type === "select") {
          if (!state.values[f.key]) return false;
        }
      }
      return true;
    }
    if (page === "Results") return false;
    return true;
  }, [pageIndex, state, fields, task]);

  const goNext = () => {
    if (WIZARD_PAGES[pageIndex] === "Task" && !needsProduct) {
      setPageIndex(i => Math.min(i + 2, WIZARD_PAGES.length - 1));
      return;
    }
    setPageIndex(i => Math.min(i + 1, WIZARD_PAGES.length - 1));
  };

  const goBack = () => {
    if (WIZARD_PAGES[pageIndex] === "Preset" && !needsProduct) {
      setPageIndex(i => Math.max(i - 2, 0));
      return;
    }
    setPageIndex(i => Math.max(i - 1, 0));
  };

  const resetFrom = (level: "intent" | "category" | "task") => {
    if (level === "intent") setState({ values: {} });
    if (level === "category") setState(s => ({ intent: s.intent, values: {} }));
    if (level === "task") setState(s => ({ intent: s.intent, category: s.category, values: {} }));
    setPageIndex(0);
  };

  const applyPreset = (presetId: string) => {
    const p = presets.find(x => x.id === presetId);
    if (!p) return;
    setState(s => ({
      ...s,
      presetId,
      values: { ...s.values, ...p.defaults },
    }));
  };

  const result = useMemo(() => {
    if (!task) return null;
    return compute(task, state.values, selectedProduct);
  }, [task, state.values, selectedProduct]);

  const copyResults = () => {
    if (!result) return;
    const text = result.lines.map(l => `${l.label}: ${l.value}`).join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4" data-testid="calculator-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalcIcon className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-calculator-title">Universal Calculator</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Pick one thing at a time, get the exact calculation + references.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => resetFrom("intent")} data-testid="button-reset-calculator">
          <RotateCcw className="h-4 w-4 mr-2" /> Reset
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {pageIndex + 1} of {WIZARD_PAGES.length}: {WIZARD_PAGES[pageIndex]}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            Intent: <span className="font-medium ml-1">{state.intent ?? "\u2014"}</span>
          </Badge>
          <Badge variant="outline">
            Category: <span className="font-medium ml-1">{state.category ?? "\u2014"}</span>
          </Badge>
          <Badge variant="outline">
            Tool: <span className="font-medium ml-1">{state.task ?? "\u2014"}</span>
          </Badge>
          {needsProduct && (
            <Badge variant="outline">
              Product: <span className="font-medium ml-1">{selectedProduct?.name ?? "None"}</span>
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => resetFrom("category")} data-testid="button-change-category">
              Change Category
            </Button>
            <Button size="sm" variant="outline" onClick={() => resetFrom("task")} data-testid="button-change-tool">
              Change Tool
            </Button>
          </div>
        </CardContent>
      </Card>

      {WIZARD_PAGES[pageIndex] === "Intent" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>What do you want to do?</CardTitle>
            <CardDescription>Choose the outcome you need. The tool will handle the rest.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {INTENTS.map(i => (
                <button
                  key={i.id}
                  data-testid={`button-intent-${i.id}`}
                  onClick={() => setState(s => ({ ...s, intent: i.id, category: undefined, task: undefined, presetId: undefined, productId: undefined, values: {} }))}
                  className={`text-left rounded-xl border p-4 transition-all
                    ${state.intent === i.id ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:border-primary hover:bg-accent hover:shadow-md hover:scale-[1.02]"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{i.title}</div>
                    {state.intent === i.id && <CheckCircle2 className="text-primary" size={18} />}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{i.desc}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {WIZARD_PAGES[pageIndex] === "Category" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>What type of work are you doing?</CardTitle>
            <CardDescription>This keeps the tool focused so you only see relevant options.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3">
              {CATEGORIES
                .filter(c => {
                  if (state.intent === "apply_chemical") return c.id === "chemical";
                  if (state.intent === "convert_units") return c.id === "general";
                  if (state.intent === "size_system") return c.id === "lighting" || c.id === "irrigation";
                  if (state.intent === "calculate_materials") return c.id === "softscape" || c.id === "hardscape";
                  return true;
                })
                .map(c => (
                <button
                  key={c.id}
                  data-testid={`button-category-${c.id}`}
                  onClick={() => setState(s => ({ ...s, category: c.id, task: undefined, presetId: undefined, productId: undefined, values: {} }))}
                  className={`text-left rounded-xl border p-4 transition-all
                    ${state.category === c.id ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:border-primary hover:bg-accent hover:shadow-md hover:scale-[1.02]"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{c.title}</div>
                    {state.category === c.id && <CheckCircle2 className="text-primary" size={18} />}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{c.desc}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {WIZARD_PAGES[pageIndex] === "Task" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Choose your tool</CardTitle>
            <CardDescription>Pick the tool that matches the job.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {availableTasks.map(t => (
                <button
                  key={t.key}
                  data-testid={`button-task-${t.key}`}
                  onClick={() => setState(s => ({ ...s, task: t.key, presetId: undefined, productId: undefined, values: {} }))}
                  className={`text-left rounded-xl border p-4 transition-all
                    ${state.task === t.key ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:border-primary hover:bg-accent hover:shadow-md hover:scale-[1.02]"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{t.title}</div>
                    {state.task === t.key && <CheckCircle2 className="text-primary" size={18} />}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {WIZARD_PAGES[pageIndex] === "Product" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Select a product (optional)</CardTitle>
            <CardDescription>Pick a product to attach safety reminders and manufacturer docs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              <button
                data-testid="button-product-none"
                onClick={() => setState(s => ({ ...s, productId: undefined }))}
                className={`text-left rounded-xl border p-4 transition-all
                  ${!state.productId ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:border-primary hover:bg-accent hover:shadow-md hover:scale-[1.02]"}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">No specific product</div>
                  {!state.productId && <CheckCircle2 className="text-primary" size={18} />}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Use generic mixing math + add docs later.</div>
              </button>

              {PRODUCT_LIBRARY.map(p => (
                <button
                  key={p.id}
                  data-testid={`button-product-${p.id}`}
                  onClick={() => setState(s => ({ ...s, productId: p.id }))}
                  className={`text-left rounded-xl border p-4 transition-all
                    ${state.productId === p.id ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:border-primary hover:bg-accent hover:shadow-md hover:scale-[1.02]"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{p.name}</div>
                    {state.productId === p.id && <CheckCircle2 className="text-primary" size={18} />}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{p.manufacturer} &bull; {p.category}</div>
                  <div className="text-xs text-muted-foreground/70 mt-2">{p.labelRateHint}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {WIZARD_PAGES[pageIndex] === "Preset" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pick a preset</CardTitle>
            <CardDescription>Choose a realistic starting point. You can edit every value next.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3">
              {presets.map(p => (
                <button
                  key={p.id}
                  data-testid={`button-preset-${p.id}`}
                  onClick={() => applyPreset(p.id)}
                  className={`text-left rounded-xl border p-4 transition-all
                    ${state.presetId === p.id ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:border-primary hover:bg-accent hover:shadow-md hover:scale-[1.02]"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{p.name}</div>
                    {state.presetId === p.id && <CheckCircle2 className="text-primary" size={18} />}
                  </div>
                  {p.description && <div className="text-sm text-muted-foreground mt-1">{p.description}</div>}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {WIZARD_PAGES[pageIndex] === "Inputs" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Enter your measurements</CardTitle>
            <CardDescription>Only the inputs that matter for this tool are shown.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">Inputs</h3>
                {fields.map(f => {
                  if (f.type === "select") {
                    const value = String(state.values[f.key] ?? "");
                    return (
                      <div key={f.key} className="space-y-1">
                        <div className="text-sm font-medium">{f.label}</div>
                        {f.help && <div className="text-xs text-muted-foreground">{f.help}</div>}
                        <Select
                          value={value}
                          onValueChange={(v) => setState(s => ({ ...s, values: { ...s.values, [f.key]: v } }))}
                        >
                          <SelectTrigger data-testid={`select-${f.key}`}>
                            <SelectValue placeholder={`Select ${f.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {f.options.map(o => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }

                  const raw = state.values[f.key];
                  const value = raw === undefined ? "" : String(raw);
                  return (
                    <div key={f.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{f.label}</div>
                        {f.unit && <Badge variant="outline" className="text-xs">{f.unit}</Badge>}
                      </div>
                      {f.help && <div className="text-xs text-muted-foreground">{f.help}</div>}
                      <Input
                        data-testid={`input-${f.key}`}
                        type="number"
                        value={value}
                        min={f.min}
                        step={f.step ?? 1}
                        onChange={(e) => setState(s => ({ ...s, values: { ...s.values, [f.key]: e.target.value } }))}
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-3">Quick Notes</h3>
                <Card>
                  <CardContent className="p-4 space-y-3 text-sm">
                    {task === "retaining_wall_base" && (
                      <>
                        <div className="font-semibold">Retaining Wall Rule</div>
                        <div className="text-muted-foreground">
                          Walls are <span className="text-primary font-medium">length-based</span>. This tool uses wall length x trench width x base depth.
                        </div>
                        <div className="text-xs text-muted-foreground/70">
                          For guaranteed accuracy, store manufacturer-specific trench width and base depth standards per block system.
                        </div>
                      </>
                    )}
                    {intent === "apply_chemical" && (
                      <>
                        <div className="font-semibold">Chemical Rule</div>
                        <div className="text-muted-foreground">
                          This tool does math. Your <span className="text-primary font-medium">label</span> controls legality + safety.
                        </div>
                        <div className="text-xs text-muted-foreground/70">
                          Later, connect manufacturer label + SDS links and lock rates to verified data.
                        </div>
                      </>
                    )}
                    {!["retaining_wall_base"].includes(task || "") && intent !== "apply_chemical" && (
                      <div className="text-muted-foreground">
                        All values can be adjusted. Results update automatically when you proceed to the results step.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {WIZARD_PAGES[pageIndex] === "Results" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Results</CardTitle>
            <CardDescription>Copy, verify, and attach to SOPs/jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-muted-foreground">No result yet.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-medium">{result.title}</h3>
                  {result.lines.map((l, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3" data-testid={`result-line-${idx}`}>
                      <div className="text-sm text-muted-foreground">{l.label}</div>
                      <div className="font-semibold">{l.value}</div>
                    </div>
                  ))}

                  <Button className="w-full" onClick={copyResults} data-testid="button-copy-results">
                    Copy Results
                  </Button>
                </div>

                <div>
                  <Tabs defaultValue="assumptions">
                    <TabsList>
                      <TabsTrigger value="assumptions" data-testid="tab-assumptions">Assumptions</TabsTrigger>
                      <TabsTrigger value="safety" data-testid="tab-safety">Safety</TabsTrigger>
                      <TabsTrigger value="sops" data-testid="tab-sops">SOPs</TabsTrigger>
                      <TabsTrigger value="docs" data-testid="tab-docs">Docs</TabsTrigger>
                    </TabsList>

                    <TabsContent value="assumptions" className="mt-3 space-y-2">
                      {result.assumptions.length ? result.assumptions.map((a, i) => (
                        <div key={i} className="text-sm rounded-lg border p-3">
                          {a}
                        </div>
                      )) : <div className="text-sm text-muted-foreground">No assumptions.</div>}
                    </TabsContent>

                    <TabsContent value="safety" className="mt-3 space-y-2">
                      {result.safety.length ? result.safety.map((s, i) => (
                        <div key={i} className="text-sm rounded-lg border p-3">
                          {s}
                        </div>
                      )) : <div className="text-sm text-muted-foreground">No safety notes for this tool.</div>}
                    </TabsContent>

                    <TabsContent value="sops" className="mt-3 space-y-2">
                      {result.sopLinks.map((x, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-primary" />
                            <span className="text-sm">{x.title}</span>
                          </div>
                          <Button variant="outline" size="sm">
                            <LinkIcon size={14} className="mr-1" /> Open
                          </Button>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="docs" className="mt-3 space-y-2">
                      {result.manufacturerDocs.length ? result.manufacturerDocs.map((x, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-primary" />
                            <span className="text-sm">{x.title}</span>
                          </div>
                          <Button variant="outline" size="sm">
                            <LinkIcon size={14} className="mr-1" /> Open
                          </Button>
                        </div>
                      )) : <div className="text-sm text-muted-foreground">No manufacturer docs attached.</div>}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-center gap-4 pt-2 max-w-lg mx-auto">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={pageIndex === 0}
          data-testid="button-calc-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        {WIZARD_PAGES[pageIndex] !== "Results" && (
          <Button
            onClick={goNext}
            disabled={!canNext}
            data-testid="button-calc-next"
          >
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
        {WIZARD_PAGES[pageIndex] === "Results" && (
          <Button
            variant="outline"
            onClick={() => resetFrom("intent")}
            data-testid="button-calc-new"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> New Calculation
          </Button>
        )}
      </div>
    </div>
  );
}
