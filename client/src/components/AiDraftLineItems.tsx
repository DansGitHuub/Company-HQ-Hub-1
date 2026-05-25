import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Loader2,
  Trash2,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Camera,
  Mic,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemType = "labor" | "material" | "equipment" | "service" | "subcontractor";

interface DraftLineItem {
  _id: string; // client-side only key
  description: string;
  item_type: ItemType;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface DraftWorkArea {
  _id: string; // client-side only key
  name: string;
  line_items: DraftLineItem[];
}

interface AiDraftResponse {
  work_areas: Array<{
    name: string;
    line_items: Array<{
      description: string;
      item_type?: string;
      quantity?: number;
      unit?: string;
      unit_price?: number;
    }>;
  }>;
  photo_count: number;
  has_transcript: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _nextId = 0;
function uid() {
  return `draft-${++_nextId}`;
}

function toClient(raw: AiDraftResponse["work_areas"]): DraftWorkArea[] {
  return raw.map((wa) => ({
    _id: uid(),
    name: wa.name,
    line_items: wa.line_items.map((li) => ({
      _id: uid(),
      description: li.description ?? "",
      item_type: (li.item_type as ItemType) ?? "service",
      quantity: Number(li.quantity) || 1,
      unit: li.unit ?? "",
      unit_price: Number(li.unit_price) || 0,
    })),
  }));
}

const ITEM_TYPE_COLORS: Record<ItemType, string> = {
  labor: "bg-blue-100 text-blue-800",
  material: "bg-green-100 text-green-800",
  equipment: "bg-orange-100 text-orange-800",
  service: "bg-purple-100 text-purple-800",
  subcontractor: "bg-yellow-100 text-yellow-800",
};

const ITEM_TYPES: ItemType[] = [
  "labor",
  "material",
  "equipment",
  "service",
  "subcontractor",
];

const COMMON_UNITS = [
  "hr", "sf", "lf", "yard", "each", "ton", "lb", "bag",
  "visit", "ls", "day", "month", "application", "push",
];

// ── Sub-component: editable line item row ─────────────────────────────────────

function LineItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: DraftLineItem;
  onChange: (updated: DraftLineItem) => void;
  onRemove: () => void;
}) {
  const amount = (item.quantity * item.unit_price).toFixed(2);

  return (
    <div
      className="grid grid-cols-[1fr_80px_90px_90px_80px_32px] gap-2 items-center py-1.5 border-b last:border-b-0"
      data-testid={`row-draft-item-${item._id}`}
    >
      {/* Description */}
      <Input
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
        className="h-8 text-sm"
        placeholder="Description"
        data-testid={`input-draft-desc-${item._id}`}
      />

      {/* Item type */}
      <Select
        value={item.item_type}
        onValueChange={(v) => onChange({ ...item, item_type: v as ItemType })}
      >
        <SelectTrigger
          className="h-8 text-xs"
          data-testid={`select-draft-type-${item._id}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ITEM_TYPES.map((t) => (
            <SelectItem key={t} value={t} className="text-xs capitalize">
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quantity */}
      <Input
        type="number"
        min={0}
        step="any"
        value={item.quantity}
        onChange={(e) =>
          onChange({ ...item, quantity: parseFloat(e.target.value) || 0 })
        }
        className="h-8 text-sm text-right"
        data-testid={`input-draft-qty-${item._id}`}
      />

      {/* Unit */}
      <Select
        value={item.unit || "_none"}
        onValueChange={(v) => onChange({ ...item, unit: v === "_none" ? "" : v })}
      >
        <SelectTrigger
          className="h-8 text-xs"
          data-testid={`select-draft-unit-${item._id}`}
        >
          <SelectValue placeholder="unit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none" className="text-xs text-muted-foreground">
            — none —
          </SelectItem>
          {COMMON_UNITS.map((u) => (
            <SelectItem key={u} value={u} className="text-xs">
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Unit price */}
      <Input
        type="number"
        min={0}
        step="any"
        value={item.unit_price}
        onChange={(e) =>
          onChange({ ...item, unit_price: parseFloat(e.target.value) || 0 })
        }
        className="h-8 text-sm text-right"
        data-testid={`input-draft-price-${item._id}`}
      />

      {/* Amount (read-only display) shown on hover / in tooltip would be nice but keeping it simple */}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        data-testid={`btn-remove-draft-item-${item._id}`}
        title="Remove item"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Sub-component: work area section ─────────────────────────────────────────

function DraftWorkAreaSection({
  area,
  onChange,
  onRemove,
  onAddItem,
}: {
  area: DraftWorkArea;
  onChange: (updated: DraftWorkArea) => void;
  onRemove: () => void;
  onAddItem: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = area.line_items.reduce(
    (s, li) => s + li.quantity * li.unit_price,
    0
  );

  return (
    <div
      className="border rounded-lg mb-3"
      data-testid={`section-draft-area-${area._id}`}
    >
      {/* Area header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-t-lg border-b">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setCollapsed((c) => !c)}
          data-testid={`btn-collapse-area-${area._id}`}
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </Button>

        <Input
          value={area.name}
          onChange={(e) => onChange({ ...area, name: e.target.value })}
          className="h-7 text-sm font-medium border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid={`input-draft-area-name-${area._id}`}
        />

        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {area.line_items.length} item{area.line_items.length !== 1 ? "s" : ""}
          {total > 0 && ` · $${total.toFixed(2)}`}
        </span>

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          data-testid={`btn-remove-draft-area-${area._id}`}
          title="Remove work area"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!collapsed && (
        <div className="px-3 py-2">
          {/* Column headers */}
          {area.line_items.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_90px_90px_80px_32px] gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Description</span>
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-xs text-muted-foreground text-right">Qty</span>
              <span className="text-xs text-muted-foreground">Unit</span>
              <span className="text-xs text-muted-foreground text-right">Unit $</span>
              <span />
            </div>
          )}

          {area.line_items.map((item) => (
            <LineItemRow
              key={item._id}
              item={item}
              onChange={(updated) =>
                onChange({
                  ...area,
                  line_items: area.line_items.map((li) =>
                    li._id === updated._id ? updated : li
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...area,
                  line_items: area.line_items.filter(
                    (li) => li._id !== item._id
                  ),
                })
              }
            />
          ))}

          <Button
            size="sm"
            variant="ghost"
            className="mt-1.5 h-7 text-xs gap-1 text-muted-foreground"
            onClick={onAddItem}
            data-testid={`btn-add-draft-item-${area._id}`}
          >
            <Plus className="h-3 w-3" />
            Add item
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

interface AiDraftLineItemsProps {
  estimateId: string;
  onAccepted: () => void;
}

export function AiDraftLineItems({
  estimateId,
  onAccepted,
}: AiDraftLineItemsProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [draftAreas, setDraftAreas] = useState<DraftWorkArea[] | null>(null);
  const [sourceInfo, setSourceInfo] = useState<{
    photoCount: number;
    hasTranscript: boolean;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Generate draft ─────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/estimates/${estimateId}/ai-draft-line-items`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "Generation failed");
      }
      return r.json() as Promise<AiDraftResponse>;
    },
    onSuccess: (data) => {
      setDraftAreas(toClient(data.work_areas));
      setSourceInfo({
        photoCount: data.photo_count,
        hasTranscript: data.has_transcript,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "AI Draft Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Accept draft ───────────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: async (areas: DraftWorkArea[]) => {
      // Strip client-only _id fields before sending
      const payload = areas.map((wa) => ({
        name: wa.name,
        line_items: wa.line_items.map((li) => ({
          description: li.description,
          item_type: li.item_type,
          quantity: li.quantity,
          unit: li.unit,
          unit_price: li.unit_price,
        })),
      }));
      const r = await fetch(`/api/estimates/${estimateId}/work-areas/append`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_areas: payload }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "Accept failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({
        title: "Line items added",
        description: "The AI-drafted line items have been added to the estimate.",
      });
      qc.invalidateQueries({ queryKey: ["/api/estimates", estimateId] });
      qc.invalidateQueries({ queryKey: ["/api/estimates"] });
      setDraftAreas(null);
      setSourceInfo(null);
      onAccepted();
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to add line items",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const totalItems = draftAreas?.reduce(
    (s, wa) => s + wa.line_items.length,
    0
  ) ?? 0;

  const grandTotal = draftAreas?.reduce(
    (s, wa) =>
      s + wa.line_items.reduce((t, li) => t + li.quantity * li.unit_price, 0),
    0
  ) ?? 0;

  function updateArea(updated: DraftWorkArea) {
    setDraftAreas((prev) =>
      prev ? prev.map((wa) => (wa._id === updated._id ? updated : wa)) : prev
    );
  }

  function removeArea(areaId: string) {
    setDraftAreas((prev) =>
      prev ? prev.filter((wa) => wa._id !== areaId) : prev
    );
  }

  function addItemToArea(areaId: string) {
    setDraftAreas((prev) =>
      prev
        ? prev.map((wa) =>
            wa._id === areaId
              ? {
                  ...wa,
                  line_items: [
                    ...wa.line_items,
                    {
                      _id: uid(),
                      description: "",
                      item_type: "service" as ItemType,
                      quantity: 1,
                      unit: "",
                      unit_price: 0,
                    },
                  ],
                }
              : wa
          )
        : prev
    );
  }

  function addWorkArea() {
    setDraftAreas((prev) => [
      ...(prev ?? []),
      {
        _id: uid(),
        name: "New Work Area",
        line_items: [],
      },
    ]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-6" data-testid="section-ai-draft">
      <Card className="border-2 border-dashed border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Draft Line Items
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate a draft scope of work from CompanyCam photos and/or a
            Plaud voice transcript. Review and edit before adding to the
            estimate.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Empty state / Generate button ── */}
          {!draftAreas && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="btn-generate-ai-draft"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate AI Draft
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Requires at least one CompanyCam photo or an attached voice
                transcript.
              </p>
            </div>
          )}

          {/* ── Draft review panel ── */}
          {draftAreas && (
            <>
              {/* Source chips */}
              {sourceInfo && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    Sources used:
                  </span>
                  {sourceInfo.photoCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-xs"
                      data-testid="badge-source-photos"
                    >
                      <Camera className="h-3 w-3" />
                      {sourceInfo.photoCount} photo
                      {sourceInfo.photoCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {sourceInfo.hasTranscript && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-xs"
                      data-testid="badge-source-transcript"
                    >
                      <Mic className="h-3 w-3" />
                      Voice transcript
                    </Badge>
                  )}
                </div>
              )}

              {/* Caution banner */}
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  AI-generated draft — review all quantities, descriptions, and
                  prices before accepting. Nothing is saved until you click{" "}
                  <strong>Accept & Add to Estimate</strong>.
                </span>
              </div>

              {/* Work areas */}
              <div className="mt-3" data-testid="container-draft-areas">
                {draftAreas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No work areas — add one below.
                  </p>
                ) : (
                  draftAreas.map((area) => (
                    <DraftWorkAreaSection
                      key={area._id}
                      area={area}
                      onChange={updateArea}
                      onRemove={() => removeArea(area._id)}
                      onAddItem={() => addItemToArea(area._id)}
                    />
                  ))
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={addWorkArea}
                  data-testid="btn-add-draft-area"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add work area
                </Button>
              </div>

              {/* Summary + action bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {totalItems}
                  </span>{" "}
                  item{totalItems !== 1 ? "s" : ""} across{" "}
                  <span className="font-medium text-foreground">
                    {draftAreas.length}
                  </span>{" "}
                  work area{draftAreas.length !== 1 ? "s" : ""}
                  {grandTotal > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-foreground">
                        ${grandTotal.toFixed(2)}
                      </span>{" "}
                      estimated
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="gap-1 text-xs"
                    data-testid="btn-regenerate-ai-draft"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Regenerate
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraftAreas(null);
                      setSourceInfo(null);
                    }}
                    className="text-xs"
                    data-testid="btn-discard-ai-draft"
                  >
                    Discard
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => setShowConfirm(true)}
                    disabled={
                      totalItems === 0 || acceptMutation.isPending
                    }
                    className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                    data-testid="btn-accept-ai-draft"
                  >
                    {acceptMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Accept & Add to Estimate
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Confirmation dialog ── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent data-testid="dialog-confirm-accept-draft">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Add AI Draft to Estimate?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will add{" "}
              <strong>
                {totalItems} line item{totalItems !== 1 ? "s" : ""}
              </strong>{" "}
              across{" "}
              <strong>
                {draftAreas?.length ?? 0} work area
                {(draftAreas?.length ?? 0) !== 1 ? "s" : ""}
              </strong>{" "}
              to the estimate. Existing line items will not be affected. You
              can edit or delete them afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-accept-draft">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                if (draftAreas) acceptMutation.mutate(draftAreas);
              }}
              className="bg-green-600 hover:bg-green-700"
              data-testid="btn-confirm-accept-draft"
            >
              Yes, add to estimate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
