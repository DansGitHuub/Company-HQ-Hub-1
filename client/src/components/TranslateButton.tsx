/**
 * TranslateButton — inline AI-powered translate action for message bubbles.
 * TranslateDraftButton — translates compose-box draft text in place.
 *
 * Both call POST /api/translate (GPT-4o, no DB write).
 * All UI strings go through the "messages" i18n namespace.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Shared fetch helper ────────────────────────────────────────────────────────
async function callTranslate(text: string): Promise<{
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
}> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Translation failed");
  return res.json();
}

// ── Language display name ──────────────────────────────────────────────────────
function langName(code: string): string {
  return code === "es" ? "Spanish" : "English";
}

// ── TranslateButton ────────────────────────────────────────────────────────────
// Place after a message bubble to provide on-demand translation.

interface TranslateButtonProps {
  /** Plain text to translate. Strip HTML tags before passing. */
  text: string;
  /** Used for unique data-testid attributes. */
  messageId: string;
  className?: string;
}

export function TranslateButton({ text, messageId, className }: TranslateButtonProps) {
  const { t } = useTranslation("messages");

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [translated, setTranslated] = useState<string | null>(null);
  const [fromLang, setFromLang] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleTranslate = async () => {
    if (status === "done") {
      setShowOriginal((prev) => !prev);
      return;
    }
    if (!text.trim()) return;

    setStatus("loading");
    try {
      const data = await callTranslate(text.trim());
      setTranslated(data.translatedText);
      setFromLang(langName(data.detectedLanguage));
      setStatus("done");
      setShowOriginal(false);
    } catch {
      setStatus("error");
    }
  };

  const buttonLabel =
    status === "loading"
      ? t("translating")
      : status === "done" && !showOriginal
        ? t("showOriginal")
        : t("translate");

  return (
    <div className={cn("mt-1", className)}>
      <button
        type="button"
        onClick={handleTranslate}
        disabled={status === "loading"}
        data-testid={`button-translate-${messageId}`}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
      >
        {status === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Languages className="h-3 w-3" />
        )}
        <span>{buttonLabel}</span>
      </button>

      {status === "error" && (
        <p className="text-[11px] text-red-400 mt-0.5" data-testid={`text-translate-error-${messageId}`}>
          {t("translateError")}
        </p>
      )}

      {status === "done" && !showOriginal && translated && (
        <div
          className="mt-1.5 pt-1.5 border-t border-gray-200 text-sm"
          data-testid={`text-translated-${messageId}`}
        >
          <p className="whitespace-pre-wrap text-gray-700">{translated}</p>
          {fromLang && (
            <p className="text-[10px] text-gray-400 mt-0.5 italic">
              {t("translatedFrom", { language: fromLang })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── TranslateDraftButton ───────────────────────────────────────────────────────
// Place near a compose/reply textarea to translate the draft in-place.

interface TranslateDraftButtonProps {
  /** Current draft text value. */
  text: string;
  /** Called with the translated text so the parent can update state. */
  onTranslated: (newText: string) => void;
}

export function TranslateDraftButton({ text, onTranslated }: TranslateDraftButtonProps) {
  const { t } = useTranslation("messages");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await callTranslate(text.trim());
      onTranslated(data.translatedText);
      setNotice(t("translatedFrom", { language: langName(data.detectedLanguage) }));
    } catch {
      // fail silently in compose context — user's draft is never lost
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleTranslate}
        disabled={loading || !text.trim()}
        data-testid="button-translate-draft"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Languages className="h-3 w-3" />
        )}
        <span>{loading ? t("translating") : t("translateDraft")}</span>
      </button>
      {notice && (
        <span className="text-[10px] text-muted-foreground italic" data-testid="text-translate-draft-notice">
          {notice}
        </span>
      )}
    </div>
  );
}
