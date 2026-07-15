import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export function useAccessibility() {
  const { user } = useAuth();

  useEffect(() => {
    const html = document.documentElement;
    const largerText = (user as any)?.largerText ?? false;
    const highContrast = (user as any)?.highContrast ?? false;

    if (largerText) html.classList.add("larger-text");
    else html.classList.remove("larger-text");

    if (highContrast) html.classList.add("high-contrast");
    else html.classList.remove("high-contrast");
  }, [(user as any)?.largerText, (user as any)?.highContrast]);

  return {
    largerText: (user as any)?.largerText ?? false,
    highContrast: (user as any)?.highContrast ?? false,
  };
}
