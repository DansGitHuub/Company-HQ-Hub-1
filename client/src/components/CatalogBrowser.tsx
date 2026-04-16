import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";

export interface CatalogItem {
  id: number;
  name: string;
  class: string;
  units: string;
  cost: string;
  description?: string;
  sku?: string;
  category?: string;
}

interface Props {
  open: boolean;
  areaKey: string | null;
  onClose: () => void;
  onSelect: (areaKey: string, item: CatalogItem) => void;
}

export function CatalogBrowser({ open, areaKey, onClose, onSelect }: Props) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog"],
    queryFn: () =>
      fetch("/api/catalog", { credentials: "include" }).then((r) => r.json()),
    enabled: open,
  });

  const items = (data ?? []) as CatalogItem[];
  const filtered = items.filter((it) => {
    const q = search.toLowerCase();
    return (
      !q ||
      it.name?.toLowerCase().includes(q) ||
      it.class?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q) ||
      it.description?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        setSearch("");
        onClose();
      }}
    >
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Browse Item Catalog</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name, class, SKU..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 border rounded-md">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  No items found
                </p>
              ) : (
                <div className="divide-y">
                  {filtered.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (areaKey) {
                          onSelect(areaKey, item);
                          setSearch("");
                          onClose();
                        }
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {item.class}
                            </span>
                            {item.units && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {item.units}
                              </span>
                            )}
                            {item.category && (
                              <span className="text-xs text-muted-foreground">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-semibold shrink-0">
                          {item.cost}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground text-center">
              {filtered.length} of {items.length} items
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
