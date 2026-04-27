import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date-only value (YYYY-MM-DD or ISO midnight-UTC string) without
 * timezone shift. Always interprets in UTC so a date stored as "2026-04-26"
 * never renders as "April 25" in UTC-behind locales.
 * Do NOT use this for instant fields (sent_at, viewed_at, paid_at, created_at).
 */
export function fmtDateOnly(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch { return String(d); }
}
