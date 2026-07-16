#!/usr/bin/env tsx
/**
 * i18n Coverage Audit
 * Run: npm run i18n:report
 *
 * Outputs:
 *   - Console summary
 *   - i18n-coverage-report.md (human-readable report)
 *   - scripts/i18n-baseline.json (snapshot for the regression gate)
 *
 * No new deps required — uses fast-glob (already installed) + Node built-ins.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import fg from "fast-glob";

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT = resolve(".");
const CLIENT_SRC = resolve("client/src");
const EN_JSON_PATH = resolve("client/src/locales/en.json");
const ES_JSON_PATH = resolve("client/src/locales/es.json");
const REPORT_PATH = resolve("i18n-coverage-report.md");
const BASELINE_PATH = resolve("scripts/i18n-baseline.json");

// ── Hardcoded-string detection ─────────────────────────────────────────────
// Each pattern targets a high-confidence "user-facing English string" that
// has NOT been wrapped in t().  All patterns are applied to individual lines.

const HARDCODED_PATTERNS: RegExp[] = [
  // JSX text child between tags:   >Some English Text<
  />\s*[A-Z][a-zA-Z][a-zA-Z ,'!?:.()/-]{3,}\s*</,
  // Text-only line (JSX child on its own line, 2+ words suggested by length)
  /^\s{2,}[A-Z][a-zA-Z][a-zA-Z ,'!?:.()/-]{4,}\s*$/,
  // User-facing prop attributes
  /(?:placeholder|aria-label|aria-description)\s*=\s*["'][A-Z][a-zA-Z ,'!?:.()/-]{3,}["']/,
  // Toast / dialog title|description literals
  /(?:^|[,{]\s*)(?:title|description)\s*:\s*["'][A-Z][a-zA-Z ,'!?:.()/-]{3,}["']/,
];

// Lines that disqualify a match (order matters — checked first)
const EXCLUDE_LINE_PATTERNS: RegExp[] = [
  /\bt\s*\(/,             // already inside a t() call
  /className\s*[=:]/,     // CSS class attribute or property
  /data-testid\s*=/,      // test-id attribute
  /^\s*\/\//,             // single-line comment
  /^\s*\*/,               // block-comment line
  /^\s*\/\*/,             // block-comment open
  /^\s*import\s/,         // import statement
  /^\s*export\s/,         // export statement
  /console\./,            // debug logging
  /href\s*=/,             // hyperlink href
  /src\s*=\s*["']/,       // image / script src
  /\btype\s*=\s*["']/,    // HTML type attribute (e.g. type="button")
  /\bkey\s*=\s*["']/,     // React list key
  /\bname\s*=\s*["']/,    // input name
  /\bvalue\s*=\s*["'][a-z]/, // lowercase value strings (enum-like)
  /\bstyle\s*=\s*\{/,     // inline style object
  /`[^`]*\$\{/,           // template literal with interpolation (dynamic)
];

/** Count lines in a file that match a hardcoded-string pattern. */
export function countHardcodedLines(content: string): number {
  const lines = content.split("\n");
  let count = 0;
  for (const line of lines) {
    if (EXCLUDE_LINE_PATTERNS.some((p) => p.test(line))) continue;
    if (HARDCODED_PATTERNS.some((p) => p.test(line))) {
      count++;
    }
  }
  return count;
}

// ── JSON key utilities ─────────────────────────────────────────────────────

/** Flatten a nested JSON object to dotted paths: { "nav.myWorkspace": "My Workspace", ... } */
function flattenJson(
  obj: unknown,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof obj !== "object" || obj === null) return result;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      result[path] = v;
    } else if (typeof v === "object" && v !== null) {
      Object.assign(result, flattenJson(v, path));
    }
  }
  return result;
}

// ── t() key extraction ─────────────────────────────────────────────────────
// Capture simple string literals inside t("...") — skips dynamic keys.
const T_CALL_RE = /\bt\s*\(\s*["'`]([^"'`${}]+)["'`]/g;

function extractTKeys(content: string): string[] {
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  T_CALL_RE.lastIndex = 0;
  while ((m = T_CALL_RE.exec(content)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

// ── Directory grouping ─────────────────────────────────────────────────────
function groupDir(filePath: string): string {
  const rel = relative(CLIENT_SRC, filePath);
  const parts = rel.split("/");
  // Use up to 2 path segments as the group key, e.g. "pages/admin" or "components"
  return parts.slice(0, Math.min(2, parts.length - 1)).join("/") || "(root)";
}

// ── Main analysis ──────────────────────────────────────────────────────────

interface FileResult {
  path: string;
  relPath: string;
  group: string;
  hasTranslation: boolean; // imports useTranslation
  tCallCount: number;
  hardcodedCount: number;
}

interface AnalysisResult {
  files: FileResult[];
  enKeys: Record<string, string>;
  esKeys: Record<string, string>;
  orphanTKeys: string[];   // t('key') in code but missing from en.json
  missingEsKeys: string[]; // key in en.json but missing/blank in es.json
}

export async function analyse(): Promise<AnalysisResult> {
  const tsxFiles = await fg("client/src/**/*.tsx", {
    cwd: ROOT,
    absolute: true,
    ignore: ["client/src/locales/**"],
  });

  const enRaw = JSON.parse(readFileSync(EN_JSON_PATH, "utf8"));
  const esRaw = JSON.parse(readFileSync(ES_JSON_PATH, "utf8"));
  const enKeys = flattenJson(enRaw);
  const esKeys = flattenJson(esRaw);

  // Keys in en.json that are absent or blank in es.json
  const missingEsKeys = Object.keys(enKeys).filter(
    (k) => !esKeys[k] || esKeys[k].trim() === "",
  );

  const allTKeys = new Set<string>();
  const files: FileResult[] = [];

  for (const filePath of tsxFiles) {
    const content = readFileSync(filePath, "utf8");
    const hasTranslation = /useTranslation/.test(content);
    const tCallCount = (content.match(/\bt\s*\(/g) || []).length;
    const hardcodedCount = countHardcodedLines(content);

    // Collect all t() key references from this file
    for (const key of extractTKeys(content)) {
      allTKeys.add(key);
    }

    files.push({
      path: filePath,
      relPath: relative(ROOT, filePath),
      group: groupDir(filePath),
      hasTranslation,
      tCallCount,
      hardcodedCount,
    });
  }

  // t('key') calls with no matching entry in en.json
  // Only check fully-qualified dot-path keys (namespace.subkey format)
  const orphanTKeys = Array.from(allTKeys).filter((key) => {
    if (!key.includes(".")) return false; // skip bare/namespace-relative keys
    return !enKeys[key];
  });

  return { files, enKeys, esKeys, orphanTKeys, missingEsKeys };
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  if (d === 0) return "n/a";
  return `${Math.round((n / d) * 100)}%`;
}

function bar(ratio: number, width = 20): string {
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ── Report generation ──────────────────────────────────────────────────────

function buildReport(r: AnalysisResult): string {
  const { files, enKeys, missingEsKeys, orphanTKeys } = r;

  const totalFiles = files.length;
  const translatedFiles = files.filter((f) => f.hasTranslation).length;
  const untranslatedFiles = totalFiles - translatedFiles;
  const totalTCalls = files.reduce((s, f) => s + f.tCallCount, 0);
  const totalHardcoded = files.reduce((s, f) => s + f.hardcodedCount, 0);
  const totalStrings = totalTCalls + totalHardcoded;
  const fileCovPct = pct(translatedFiles, totalFiles);
  const strCovPct = pct(totalTCalls, totalStrings);

  const enKeyCount = Object.keys(enKeys).length;
  const missingEsCount = missingEsKeys.length;
  const esKeyCount = enKeyCount - missingEsCount;

  // Per-group breakdown
  const groups: Record<string, { translated: number; total: number; hardcoded: number }> = {};
  for (const f of files) {
    if (!groups[f.group]) groups[f.group] = { translated: 0, total: 0, hardcoded: 0 };
    groups[f.group].total++;
    groups[f.group].hardcoded += f.hardcodedCount;
    if (f.hasTranslation) groups[f.group].translated++;
  }

  // Sort groups: worst coverage first (most untranslated files first, then by hardcoded count)
  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => {
    const aCov = a.translated / a.total;
    const bCov = b.translated / b.total;
    if (aCov !== bCov) return aCov - bCov;
    return b.hardcoded - a.hardcoded;
  });

  // Worst individual files
  const worstFiles = [...files]
    .filter((f) => f.hardcodedCount > 0)
    .sort((a, b) => b.hardcodedCount - a.hardcodedCount)
    .slice(0, 20);

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines: string[] = [];

  lines.push(`# i18n Coverage Report`);
  lines.push(`_Generated: ${now}_\n`);

  lines.push(`## Overall Summary\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| TSX files scanned | ${totalFiles} |`);
  lines.push(`| Files with \`useTranslation\` | ${translatedFiles} / ${totalFiles} (${fileCovPct}) |`);
  lines.push(`| Files with NO translation | ${untranslatedFiles} |`);
  lines.push(`| Detected t() calls (translated) | ${totalTCalls} |`);
  lines.push(`| Detected hardcoded lines (untranslated) | ${totalHardcoded} |`);
  lines.push(`| Approx string-level coverage | **${strCovPct}** |`);
  lines.push(`| en.json flat keys | ${enKeyCount} |`);
  lines.push(`| es.json keys with value | ${esKeyCount} |`);
  lines.push(`| en keys missing/blank in es | ${missingEsCount} |`);
  lines.push(`| t("key") in code missing from en.json | ${orphanTKeys.length} |`);
  lines.push(``);

  lines.push(`## Directory Breakdown (worst first)\n`);
  lines.push(`| Directory | Translated | Total Files | ${bar(0)} Coverage | Hardcoded Lines |`);
  lines.push(`|---|---|---|---|---|`);
  for (const [group, stats] of sortedGroups) {
    const ratio = stats.translated / stats.total;
    lines.push(
      `| \`${group}\` | ${stats.translated} | ${stats.total} | ${bar(ratio)} ${pct(stats.translated, stats.total)} | ${stats.hardcoded} |`,
    );
  }
  lines.push(``);

  lines.push(`## Top 20 Most Untranslated Files (by hardcoded line count)\n`);
  lines.push(`| File | Hardcoded Lines | Has t()? |`);
  lines.push(`|---|---|---|`);
  for (const f of worstFiles) {
    lines.push(`| \`${f.relPath}\` | ${f.hardcodedCount} | ${f.hasTranslation ? "✓" : "✗"} |`);
  }
  lines.push(``);

  if (missingEsKeys.length > 0) {
    lines.push(`## en.json Keys Missing or Blank in es.json (${missingEsCount})\n`);
    if (missingEsCount <= 50) {
      for (const k of missingEsKeys) {
        lines.push(`- \`${k}\`  →  "${enKeys[k]}"`);
      }
    } else {
      lines.push(`_Too many to list inline — first 50:_\n`);
      for (const k of missingEsKeys.slice(0, 50)) {
        lines.push(`- \`${k}\`  →  "${enKeys[k]}"`);
      }
      lines.push(`_... and ${missingEsCount - 50} more._`);
    }
    lines.push(``);
  } else {
    lines.push(`## en.json Keys Missing in es.json\n`);
    lines.push(`✅ None — Spanish file is structurally complete.\n`);
  }

  if (orphanTKeys.length > 0) {
    lines.push(`## t("key") in Code With No Matching en.json Entry (${orphanTKeys.length})\n`);
    for (const k of orphanTKeys.slice(0, 50)) {
      lines.push(`- \`${k}\``);
    }
    if (orphanTKeys.length > 50) {
      lines.push(`_... and ${orphanTKeys.length - 50} more._`);
    }
    lines.push(``);
  } else {
    lines.push(`## Orphaned t("key") References\n`);
    lines.push(`✅ All detected t() keys resolve to a known en.json entry.\n`);
  }

  lines.push(`---`);
  lines.push(`_Methodology: "hardcoded lines" = lines in .tsx files matching high-confidence_`);
  lines.push(`_JSX-text / user-facing-attribute patterns, minus lines already using t(), CSS_`);
  lines.push(`_classes, comments, imports, and other non-user-facing patterns._`);
  lines.push(`_"File coverage" = share of .tsx files that import useTranslation from react-i18next._`);

  return lines.join("\n");
}

// ── Baseline snapshot ──────────────────────────────────────────────────────

interface Baseline {
  generatedAt: string;
  totalHardcodedLines: number;
  totalTsxFiles: number;
  translatedFiles: number;
  missingEsKeys: number;
  byFile: Record<string, number>;
}

function buildBaseline(r: AnalysisResult): Baseline {
  const byFile: Record<string, number> = {};
  for (const f of r.files) {
    if (f.hardcodedCount > 0) {
      byFile[f.relPath] = f.hardcodedCount;
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    totalHardcodedLines: r.files.reduce((s, f) => s + f.hardcodedCount, 0),
    totalTsxFiles: r.files.length,
    translatedFiles: r.files.filter((f) => f.hasTranslation).length,
    missingEsKeys: r.missingEsKeys.length,
    byFile,
  };
}

// ── Console output ─────────────────────────────────────────────────────────

function printSummary(r: AnalysisResult, baseline: Baseline): void {
  const { files } = r;
  const translated = files.filter((f) => f.hasTranslation).length;
  const totalTCalls = files.reduce((s, f) => s + f.tCallCount, 0);
  const totalHardcoded = baseline.totalHardcodedLines;
  const totalStrings = totalTCalls + totalHardcoded;

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║           i18n Coverage Report — Summary             ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log(`  File coverage   : ${translated}/${files.length} TSX files use useTranslation (${pct(translated, files.length)})`);
  console.log(`  String coverage : ~${pct(totalTCalls, totalStrings)} of detected strings go through t()`);
  console.log(`  t() calls found : ${totalTCalls}`);
  console.log(`  Hardcoded lines : ${totalHardcoded}`);
  console.log(`  en.json keys    : ${Object.keys(r.enKeys).length}`);
  console.log(`  Missing in es   : ${r.missingEsKeys.length}`);
  console.log(`  Orphan t() keys : ${r.orphanTKeys.length}\n`);

  console.log("  Top 10 worst files (hardcoded lines):");
  const worst = [...files]
    .filter((f) => f.hardcodedCount > 0)
    .sort((a, b) => b.hardcodedCount - a.hardcodedCount)
    .slice(0, 10);
  for (const f of worst) {
    const mark = f.hasTranslation ? "~" : "✗";
    console.log(`    ${mark}  ${f.hardcodedCount.toString().padStart(4)}  ${f.relPath}`);
  }

  console.log(`\n  ✅ Report written to: i18n-coverage-report.md`);
  console.log(`  ✅ Baseline snapshot: scripts/i18n-baseline.json\n`);
}

// ── Entry point ────────────────────────────────────────────────────────────

async function main() {
  console.log("Scanning client/src for i18n coverage...");
  const result = await analyse();
  const baseline = buildBaseline(result);
  const report = buildReport(result);

  writeFileSync(REPORT_PATH, report, "utf8");
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n", "utf8");

  printSummary(result, baseline);
}

// Only run when executed directly (not when imported by i18n-check.ts)
const isMain = process.argv[1]?.endsWith("i18n-audit.ts") ||
  process.argv[1]?.endsWith("i18n-audit.js");

if (isMain) {
  main().catch((err) => {
    console.error("i18n audit failed:", err);
    process.exit(1);
  });
}
