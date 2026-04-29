import React from "react";
import { AlertCircle, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type BlockerRecord = { id: string; label: string; href: string };

export type Blocker = {
  type: "job" | "estimate" | "consultation" | "invoice";
  count: number;
  reason: string;
  records: BlockerRecord[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerId: string;
  blockers: Blocker[];
}

const TYPE_TO_PATH: Record<Blocker["type"], string> = {
  job:          "jobs",
  estimate:     "estimates",
  consultation: "consultations",
  invoice:      "invoices",
};

function listHref(type: Blocker["type"], customerId: string): string {
  return `/${TYPE_TO_PATH[type]}?customer=${customerId}`;
}

export function CannotArchiveDialog({
  open,
  onOpenChange,
  customerName,
  customerId,
  blockers,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <DialogTitle className="leading-snug">
                Cannot archive {customerName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                The following must be resolved first:
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {blockers.map((b) => {
            const viewHref =
              b.count === 1 ? b.records[0].href : listHref(b.type, customerId);
            const overflow = b.count - b.records.length;

            return (
              <div
                key={b.type}
                className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {b.count} {b.reason}
                  </span>
                  <a
                    href={viewHref}
                    className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline shrink-0"
                    data-testid={`blocker-view-${b.type}`}
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <ul className="space-y-0.5">
                  {b.records.map((r) => (
                    <li
                      key={r.id}
                      className="text-xs text-muted-foreground truncate"
                    >
                      • {r.label}
                    </li>
                  ))}
                  {overflow > 0 && (
                    <li className="text-xs text-muted-foreground italic">
                      + {overflow} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cannot-archive-cancel"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
