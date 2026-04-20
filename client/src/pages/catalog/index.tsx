import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Upload, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

type Tag = { id: number; name: string };

type CatalogRow = {
  id: number;
  itemNumber: string;
  name: string;
  class: string | null;
  category: string | null;
  units: string | null;
  cost: string | null;
  taxable: boolean | null;
  description: string | null;
  sku: string | null;
  is_active: boolean | null;
  tags: Tag[];
};

const CLASS_TABS = ["All", "Labor", "Equipment", "Materials", "Subcontracting"];

export default function CatalogPage() {
  const { t } = useTranslation("catalog");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [classTab, setClassTab] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: items = [], isLoading } = useQuery<CatalogRow[]>({
    queryKey: ["/api/catalog", showInactive],
    queryFn: () => apiRequest("GET", showInactive ? "/api/catalog?active_only=false" : "/api/catalog").then(r => r.json()),
  });

  const toggleTaxableMut = useMutation({
    mutationFn: async ({ id, taxable }: { id: number; taxable: boolean }) => {
      const item = items.find(i => i.id === id);
      if (!item) throw new Error("Item not found");
      const res = await apiRequest("PUT", `/api/catalog/${id}`, {
        ...item,
        taxable,
        tags: item.tags.map(tg => tg.name),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/catalog"] }),
    onError: () => toast({ title: t("updateFailed"), variant: "destructive" }),
  });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach(m => { if (m.category) cats.add(m.category); });
    return Array.from(cats).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (!showInactive && !item.is_active) return false;
      if (classTab !== "All" && (item.class ?? "") !== classTab) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.name?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.itemNumber?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, classTab, categoryFilter, search, showInactive]);

  async function handleExport() {
    setExporting(true);
    try {
      const rows = [
        ["Item #", "Name", "Class", "Category", "Units", "Cost", "Taxable", "SKU", "Tags", "Active"].join(","),
        ...filtered.map(item => [
          item.itemNumber,
          `"${(item.name ?? "").replace(/"/g, '""')}"`,
          item.class ?? "",
          item.category ?? "",
          item.units ?? "",
          item.cost ?? "",
          item.taxable ? "TRUE" : "FALSE",
          item.sku ?? "",
          `"${item.tags.map(tg => tg.name).join("; ")}"`,
          item.is_active ? "TRUE" : "FALSE",
        ].join(","))
      ].join("\n");
      const blob = new Blob([rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "catalog-export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("exportFailed"), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  function fmtCost(item: CatalogRow) {
    const c = item.cost != null ? parseFloat(item.cost) : NaN;
    return !isNaN(c) ? `$${c.toFixed(2)}` : "\u2014";
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} {t("itemsTotal")} &middot; {t("showing")} {filtered.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting} data-testid="btn-export-csv">
            <Download className="w-4 h-4 mr-2" />
            {exporting ? `${t("exporting")}\u2026` : t("exportCsv")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/catalog/import")} data-testid="btn-import-csv">
            <Upload className="w-4 h-4 mr-2" /> {t("importCsv")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <Tabs value={classTab} onValueChange={setClassTab}>
          <TabsList data-testid="tabs-class">
            {CLASS_TABS.map(tab => (
              <TabsTrigger key={tab} value={tab} data-testid={`tab-class-${tab.toLowerCase()}`}>{tab}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`${t("searchPlaceholder")}\u2026`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder={t("allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} data-testid="switch-show-inactive" />
            {t("showInactive")}
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t("colItemNum")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("colName")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("colClass")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("colCategory")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("colUnits")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("colCost")}</th>
              <th className="text-center px-4 py-3 font-medium">{t("colTax")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("colTags")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">{t("loading")}\u2026</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  {items.length === 0 ? t("noItemsYet") : t("noItemsMatch")}
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr
                  key={item.id}
                  className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${!item.is_active ? "opacity-50" : ""}`}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest('[role="switch"]')) return;
                    navigate(`/catalog/${item.id}`);
                  }}
                  data-testid={`row-catalog-${item.id}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground" data-testid={`text-itemnum-${item.id}`}>
                    {item.itemNumber}
                  </td>
                  <td className="px-4 py-3 font-medium" data-testid={`text-name-${item.id}`}>
                    {item.name}
                    {!item.is_active && (
                      <Badge variant="outline" className="ml-2 text-xs">{t("inactive")}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.class && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-class-${item.id}`}>
                        {item.class}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" data-testid={`text-category-${item.id}`}>
                    {item.category ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" data-testid={`text-units-${item.id}`}>
                    {item.units || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono" data-testid={`text-cost-${item.id}`}>
                    {fmtCost(item)}
                  </td>
                  <td className="px-4 py-3 text-center" data-testid={`text-taxable-${item.id}`} onClick={e => e.stopPropagation()}>
                    <Switch
                      checked={item.taxable ?? false}
                      onCheckedChange={checked => toggleTaxableMut.mutate({ id: item.id, taxable: checked })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 4).map((tg, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tg.name}
                        </Badge>
                      ))}
                      {item.tags.length > 4 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          +{item.tags.length - 4}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {t("footerHint")}
      </p>
    </div>
  );
}
