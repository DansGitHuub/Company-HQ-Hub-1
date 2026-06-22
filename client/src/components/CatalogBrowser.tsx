import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Package } from "lucide-react";

export interface CatalogItem {
  id: number;
  itemNumber: string;
  name: string;
  class: string | null;
  category: string | null;
  units: string | null;
  cost: string | null;
  markupPct: string | null;
  taxable: boolean | null;
  description: string | null;
  sku: string | null;
  otherOptions: string | null;
  imageUrl: string | null;
  imageHidden: boolean | null;
  optionImages: Record<string, string> | null;
  optionImagesHidden: Record<string, boolean> | null;
  isActive: boolean | null;
  qbItemId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tags?: { id: number; name: string }[];
}

interface CatalogBrowserProps {
  open: boolean;
  areaKey: string | null;
  onClose: () => void;
  onSelect: (areaKey: string, item: CatalogItem, imageUrl?: string) => void;
}

export function CatalogBrowser({ open, areaKey, onClose, onSelect }: CatalogBrowserProps) {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("");

  const { data: items = [] } = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog", { active_only: "true" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/catalog?active_only=true");
      return res.json();
    },
    enabled: open,
  });

  const classes = Array.from(new Set(items.map((i) => i.class).filter(Boolean))) as string[];

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesClass = !selectedClass || item.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  function handleSelect(item: CatalogItem) {
    if (!areaKey) return;
    onSelect(areaKey, item, item.imageUrl ?? undefined);
    onClose();
  }

  const classColors: Record<string, string> = {
    Material: "bg-blue-100 text-blue-700",
    Labor: "bg-green-100 text-green-700",
    Service: "bg-purple-100 text-purple-700",
    Equipment: "bg-orange-100 text-orange-700",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-catalog-browser">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Browse Item Catalog
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-catalog-search"
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            data-testid="select-catalog-class"
          >
            <option value="">All Types</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="overflow-y-auto flex-1 space-y-1 pr-1">
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No items found
            </div>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-center justify-between gap-2 group"
              onClick={() => handleSelect(item)}
              data-testid={`catalog-item-${item.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.name}</span>
                  {item.class && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${classColors[item.class] ?? "bg-muted text-muted-foreground"}`}>
                      {item.class}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {item.units && (
                  <span className="text-xs text-muted-foreground">/{item.units}</span>
                )}
                <span className="text-sm font-semibold text-green-700">
                  ${parseFloat(item.cost ?? "0").toFixed(2)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handleSelect(item); }}
                  data-testid={`btn-add-catalog-${item.id}`}
                >
                  Add
                </Button>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
