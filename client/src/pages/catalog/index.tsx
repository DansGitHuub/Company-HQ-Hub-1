import React, { useState, useMemo, useEffect, useRef } from "react";
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
const SCROLL_KEY = "catalog:scroll";

const PLANT_FILTERS = [
  { label: "Trees",      cat: "TREE",       icon: "🌳" },
  { label: "Shrubs",     cat: "SHRUB",      icon: "🌿" },
  { label: "Perennials", cat: "Perennials", icon: "🌸" },
  { label: "Annuals",    cat: "Annuals",    icon: "🌼" },
] as const;

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    tab:      CLASS_TABS.includes(p.get("tab") ?? "") ? (p.get("tab") as string) : "All",
    cat:      p.get("cat") ?? "all",
    q:        p.get("q") ?? "",
    inactive: p.get("inactive") === "1",
  };
}

export default function CatalogPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initial = useMemo(readParams, []);

  const [classTab,        setClassTab]        = useState(initial.tab);
  const [categoryFilter,  setCategoryFilter]  = useState(initial.cat);
  const [search,          setSearch]          = useState(initial.q);
  const [showInactive,    setShowInactive]    = useState(initial.inactive);
  const [exporting,       setExporting]       = useState(false);

  const scrollRestored = useRef(false);

  // ── Sync filter state → URL (replaceState, not pushState) ──────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (classTab !== "All")  p.set("tab", classTab);
    if (categoryFilter !== "all") p.set("cat", categoryFilter);
    if (search)              p.set("q", search);
    if (showInactive)        p.set("inactive", "1");
    const qs = p.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [classTab, categoryFilter, search, showInactive]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: items = [], isLoading } = useQuery<CatalogRow[]>({
    queryKey: ["/api/catalog", showInactive],
    queryFn: () =>
      apiRequest("GET", showInactive ? "/api/catalog?active_only=false" : "/api/catalog")
        .then(r => r.json()),
  });

  const toggleTaxableMut = useMutation({
    mutationFn: async ({ id, taxable }: { id: number; taxable: boolean }) => {
      const item = items.find(i => i.id === id);
      if (!item) throw new Error("Item not found");
      const res = await apiRequest("PUT", `/api/catalog/${id}`, {
        ...item,
        taxable,
        tags: item.tags.map(t => t.name),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/catalog"] }),
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
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

  // ── Restore scroll after rows render ────────────────────────────────────────
  useEffect(() => {
    if (scrollRestored.current) return;
    if (filtered.length === 0) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      sessionStorage.removeItem(SCROLL_KEY);
      const y = parseInt(saved, 10);
      if (!isNaN(y)) {
        requestAnimationFrame(() => {
          const el = document.getElementById("main-scroll-container");
          if (el) el.scrollTop = y;
        });
      }
    }
    scrollRestored.current = true;
  }, [filtered.length]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
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
          `"${item.tags.map(t => t.name).join("; ")}"`,
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
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  function fmtCost(item: CatalogRow) {
    const c = item.cost != null ? parseFloat(item.cost) : NaN;
    return !isNaN(c) ? `$${c.toFixed(2)}` : "—";
  }

  function handleRowClick(e: React.MouseEvent, itemId: number) {
    if ((e.target as HTMLElement).closest('[role="switch"]')) return;
    const el = document.getElementById("main-scroll-container");
    sessionStorage.setItem(SCROLL_KEY, String(el ? el.scrollTop : 0));
    navigate(`/catalog/${itemId}`);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Item Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} items total · showing {filtered.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting} data-testid="btn-export-csv">
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/catalog/import")} data-testid="btn-import-csv">
            <Upload className="w-4 h-4 mr-2" /> Import CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Plant quick-filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide mr-1">Plants</span>
          {PLANT_FILTERS.map(pf => {
            const active = categoryFilter === pf.cat;
            return (
              <button
                key={pf.cat}
                data-testid={`btn-plant-${pf.label.toLowerCase()}`}
                onClick={() => {
                  if (active) {
                    setCategoryFilter("all");
                  } else {
                    setClassTab("All");
                    setCategoryFilter(pf.cat);
                  }
                }}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                  active
                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-green-500 hover:text-green-700",
                ].join(" ")}
              >
                <span>{pf.icon}</span>
                {pf.label}
              </button>
            );
          })}
        </div>

        <Tabs value={classTab} onValueChange={v => { setClassTab(v); setCategoryFilter("all"); }}>
          <TabsList data-testid="tabs-class">
            {CLASS_TABS.map(t => (
              <TabsTrigger key={t} value={t} data-testid={`tab-class-${t.toLowerCase()}`}>{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, SKU, item #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} data-testid="switch-show-inactive" />
            Show inactive
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Item #</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Class</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Units</th>
              <th className="text-right px-4 py-3 font-medium">Cost</th>
              <th className="text-center px-4 py-3 font-medium">Tax</th>
              <th className="text-left px-4 py-3 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  {items.length === 0
                    ? "No catalog items yet. Import a CSV to get started."
                    : "No items match your filters"}
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr
                  key={item.id}
                  className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${!item.is_active ? "opacity-50" : ""}`}
                  onClick={e => handleRowClick(e, item.id)}
                  data-testid={`row-catalog-${item.id}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground" data-testid={`text-itemnum-${item.id}`}>
                    {item.itemNumber}
                  </td>
                  <td className="px-4 py-3 font-medium" data-testid={`text-name-${item.id}`}>
                    {item.name}
                    {!item.is_active && (
                      <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>
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
                    {item.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" data-testid={`text-units-${item.id}`}>
                    {item.units || "—"}
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
                      {item.tags.slice(0, 4).map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {t.name}
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
        {filtered.length} of {items.length} items · Click a row to view or edit · Export CSV to edit in bulk, then Import CSV to update
      </p>
    </div>
  );
}
