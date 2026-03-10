import { Check, X, ExternalLink, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionPreviewCardProps {
  title: string;
  description: string;
  details?: Record<string, string>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionPreviewCard({ title, description, details, onConfirm, onCancel }: ActionPreviewCardProps) {
  return (
    <div className="bg-muted/50 border rounded-lg p-3 space-y-2" data-testid="action-preview-card">
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {details && (
        <div className="space-y-1">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{key}:</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={onConfirm} data-testid="action-confirm-btn">
          <Check className="h-3 w-3 mr-1" /> Confirm
        </Button>
        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onCancel} data-testid="action-cancel-btn">
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

interface ActionResultCardProps {
  title: string;
  description: string;
  linkText?: string;
  linkHref?: string;
  onLinkClick?: () => void;
}

export function ActionResultCard({ title, description, linkText, linkHref, onLinkClick }: ActionResultCardProps) {
  return (
    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-1" data-testid="action-result-card">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-green-600" />
        <p className="font-medium text-sm text-green-800 dark:text-green-200">{title}</p>
      </div>
      <p className="text-xs text-green-700 dark:text-green-300">{description}</p>
      {(linkText || linkHref) && (
        <button
          onClick={onLinkClick}
          className="flex items-center gap-1 text-xs text-green-600 hover:underline mt-1"
          data-testid="action-result-link"
        >
          <ExternalLink className="h-3 w-3" />
          {linkText || "View record"}
        </button>
      )}
    </div>
  );
}

interface SearchResultItem {
  id: string | number;
  title: string;
  subtitle?: string;
}

interface SearchResultCardProps {
  results: SearchResultItem[];
  onResultClick: (item: SearchResultItem) => void;
}

export function SearchResultCard({ results, onResultClick }: SearchResultCardProps) {
  return (
    <div className="bg-muted/50 border rounded-lg overflow-hidden" data-testid="search-result-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""}</span>
      </div>
      {results.slice(0, 5).map((item) => (
        <button
          key={item.id}
          onClick={() => onResultClick(item)}
          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-0"
          data-testid={`search-result-${item.id}`}
        >
          <p className="text-sm font-medium truncate">{item.title}</p>
          {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
        </button>
      ))}
    </div>
  );
}

interface ErrorCardProps {
  message: string;
}

export function ErrorCard({ message }: ErrorCardProps) {
  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3" data-testid="error-card">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      </div>
    </div>
  );
}

interface SuggestionChipsProps {
  suggestions: string[];
  onChipClick: (suggestion: string) => void;
}

export function SuggestionChips({ suggestions, onChipClick }: SuggestionChipsProps) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="suggestion-chips">
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => onChipClick(suggestion)}
          className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
          data-testid={`suggestion-chip-${i}`}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
