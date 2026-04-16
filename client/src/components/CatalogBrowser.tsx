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
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowLeft, ImageIcon } from "lucide-react";

export interface CatalogItem {
  id: number;
  name: string;
  class: string;
  units: string;
  cost: string;
  description?: string;
  sku?: string;
  category?: string;
  image_url?: string | null;
  option_images?: Record<string, string> | null;
  other_options?: string | null;
}

interface Props {
  open: boolean;
  areaKey: string | null;
  onClose: () => void;
  onSelect: (areaKey: string, item: CatalogItem, imageUrl?: string) => void;
}

export function CatalogBrowser({ open, areaKey, onClose, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [pendingItem, setPendingItem] = useState<CatalogItem | null>(null);

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

  function handleClose() {
    setSearch("");
    setPendingItem(null);
    onClose();
  }

  function handleItemClick(item: CatalogItem) {
    if (!areaKey) return;
    const options = (item.other_options ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (item.class === "Materials" && options.length > 0) {
      setPendingItem(item);
    } else {
      onSelect(areaKey, item, item.image_url ?? undefined);
      setSearch("");
      onClose();
    }
  }

  function handleOptionSelect(opt: string) {
    if (!areaKey || !pendingItem) return;
    const resolvedUrl =
      (pendingItem.option_images ?? {})[opt] ?? pendingItem.image_url ?? undefined;
    onSelect(areaKey, pendingItem, resolvedUrl);
    setSearch("");
    setPendingItem(null);
    onClose();
  }

  const pendingOptions = pendingItem
    ? (pendingItem.other_options ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>
            {pendingItem ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -ml-1"
                  onClick={() => setPendingItem(null)}
                  data-testid="btn-back-to-catalog"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>Select Option — {pendingItem.name}</span>
              </div>
            ) : (
              "Browse Item Catalog"
            )}
          </DialogTitle>
        </DialogHeader>

        {pendingItem ? (
          /* Option selection sub-view */
          <div className="flex-1 overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-3">
              Choose a colour/option to add to the estimate:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {pendingOptions.map((opt) => {
                const optUrl = (pendingItem.option_images ?? {})[opt];
                return (
                  <button
                    key={opt}
                    onClick={() => handleOptionSelect(opt)}
                    className="flex items-center gap-3 rounded-md border p-3 text-left hover:bg-muted/50 transition-colors"
                    data-testid={`btn-option-${opt}`}
                  >
                    {optUrl ? (
                      <img
                        src={optUrl}
                        alt={opt}
                        className="w-10 h-10 object-cover rounded shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded border border-dashed flex items-center justify-center bg-muted/30 shrink-0">
                        <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{opt}</span>
                  </button>
                );
              })}
            </div>
            {/* Also allow selecting without a specific option */}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                if (areaKey) {
                  onSelect(areaKey, pendingItem, pendingItem.image_url ?? undefined);
                  setSearch("");
                  setPendingItem(null);
                  onClose();
                }
              }}
              data-testid="btn-add-without-option"
            >
              Add without selecting an option
            </Button>
          </div>
        ) : (
          /* Main catalog list */
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search by name, class, SKU..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-catalog-search"
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
                      {filtered.map((item) => {
                        const options = (item.other_options ?? "")
                          .split(",")
                          .map((o) => o.trim())
                          .filter(Boolean);
                        const hasMaterialOptions =
                          item.class === "Materials" && options.length > 0;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                            data-testid={`btn-catalog-item-${item.id}`}
                          >
                            <div className="flex justify-between items-start gap-4">
                              {/* Thumbnail */}
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded border shrink-0"
                                  data-testid={`img-thumb-${item.id}`}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-1.5 mt-1">
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
                                  {hasMaterialOptions &&
                                    options.slice(0, 5).map((opt) => (
                                      <span
                                        key={opt}
                                        className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded"
                                        data-testid={`pill-option-${item.id}-${opt}`}
                                      >
                                        {opt}
                                      </span>
                                    ))}
                                  {hasMaterialOptions && options.length > 5 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{options.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm font-semibold shrink-0">
                                {item.cost}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                <p className="text-xs text-muted-foreground text-center">
                  {filtered.length} of {items.length} items
                </p>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
