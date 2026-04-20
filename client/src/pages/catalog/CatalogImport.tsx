import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

const EXPECTED_COLUMNS = ["sku", "name", "category", "class", "unit", "cost", "markup", "taxable", "description"];

type PreviewRow = Record<string, string>;
type ImportResult = { imported: number; updated: number; skipped: number; errors: string[] };

export default function CatalogImport() {
  const { t } = useTranslation("catalogImport");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function parseCSVPreview(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return;
    const hdrs = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
    setHeaders(hdrs);
    const rows: PreviewRow[] = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const values = lines[i].split(",").map(v => v.replace(/^"|"$/g, "").trim());
      const row: PreviewRow = {};
      hdrs.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
      rows.push(row);
    }
    setPreview(rows);
  }

  function handleFileSelected(f: File) {
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = e => parseCSVPreview(e.target?.result as string);
    reader.readAsText(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) handleFileSelected(f);
    else toast({ title: t("dropCsvOnly"), variant: "destructive" });
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/materials/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Import failed");
      setResult(data);
      toast({ title: `Imported ${data.imported} new, updated ${data.updated}${data.skipped ? `, skipped ${data.skipped}` : ""}` });
    } catch (err: any) {
      toast({ title: t("importFailed"), description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/catalog")} data-testid="btn-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t("backToCatalog")}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>

      {/* Expected Format */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("expectedColumns")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EXPECTED_COLUMNS.map(col => (
              <Badge key={col} variant="outline" className="font-mono text-xs">{col}</Badge>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p>{t("hintCost")}</p>
            <p>{t("hintTaxable")}</p>
            <p>{t("hintTags")}</p>
            <p>{t("hintCategories")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
        }`}
        data-testid="dropzone-csv"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
          data-testid="input-file-csv"
        />
        {file ? (
          <div className="space-y-2">
            <FileText className="w-10 h-10 mx-auto text-primary" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB &middot; {t("clickToReplace")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">{t("dropHint")}</p>
            <p className="text-sm text-muted-foreground">{t("acceptsCsv")}</p>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {preview.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("preview")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {headers.map(h => (
                    <th key={h} className={`text-left px-3 py-2 font-medium ${EXPECTED_COLUMNS.includes(h) ? "" : "text-muted-foreground"}`}>
                      {h}
                      {!EXPECTED_COLUMNS.includes(h) && <span className="ml-1 text-yellow-500">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20" data-testid={`preview-row-${i}`}>
                    {headers.map(h => (
                      <td key={h} className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-2">{t("unknownColumns")}</p>
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      {file && !result && (
        <div className="flex justify-end">
          <Button onClick={handleImport} disabled={importing} className="min-w-[140px]" data-testid="btn-run-import">
            {importing ? `${t("importing")}...` : t("importItems")}
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> {t("importComplete")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-6">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold text-lg">{result.imported}</span>
                <span className="text-sm">{t("imported")}</span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold text-lg">{result.skipped}</span>
                  <span className="text-sm">{t("skipped")}</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {t("errors")}
                </p>
                <div className="bg-destructive/5 border border-destructive/20 rounded p-3 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive" data-testid={`import-error-${i}`}>{e}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={() => navigate("/catalog")} data-testid="btn-view-catalog">{t("viewCatalog")}</Button>
              <Button variant="outline" onClick={() => { setFile(null); setPreview([]); setResult(null); setHeaders([]); }}
                data-testid="btn-import-another">{t("importAnother")}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
