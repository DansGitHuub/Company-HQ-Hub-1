export type ThemeId = 
  | "chapin"
  | "forest" 
  | "ocean" 
  | "sunset" 
  | "mountain" 
  | "meadow" 
  | "autumn" 
  | "winter" 
  | "desert";

export interface ThemeStyle {
  borderRadius: string;
  cardShadow: string;
  buttonStyle: "solid" | "outline" | "soft";
  sidebarStyle: "solid" | "glass" | "gradient";
  cardBorder: string;
  inputStyle: "minimal" | "bordered" | "filled";
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  icon: string;
  colors: {
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    cardGlow: string;
    gradientFrom: string;
    gradientTo: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarAccent: string;
  };
  style: ThemeStyle;
}

export const themes: Theme[] = [
  {
    id: "chapin",
    name: "Chapin Landscapes",
    description: "Warm earth tones with vibrant lime-green accents",
    icon: "🌿",
    colors: {
      primary: "86 54% 51%",
      primaryForeground: "0 0% 100%",
      accent: "27 30% 67%",
      accentForeground: "28 9% 9%",
      cardGlow: "rgba(126, 176, 79, 0.15)",
      gradientFrom: "28 9% 12%",
      gradientTo: "28 9% 8%",
      sidebar: "28 9% 8%",
      sidebarForeground: "36 20% 90%",
      sidebarAccent: "86 54% 51%",
    },
    style: {
      borderRadius: "0.5rem",
      cardShadow: "0 2px 8px -2px rgba(0,0,0,0.08), 0 4px 16px -4px rgba(126,176,79,0.08)",
      buttonStyle: "solid",
      sidebarStyle: "solid",
      cardBorder: "1px solid hsl(34 24% 83%)",
      inputStyle: "bordered",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Deep greens inspired by evergreen forests",
    icon: "🌲",
    colors: {
      primary: "142 71% 35%",
      primaryForeground: "0 0% 100%",
      accent: "142 50% 45%",
      accentForeground: "0 0% 100%",
      cardGlow: "rgba(34, 139, 34, 0.12)",
      gradientFrom: "142 40% 20%",
      gradientTo: "142 50% 15%",
      sidebar: "142 40% 12%",
      sidebarForeground: "142 20% 95%",
      sidebarAccent: "142 60% 45%",
    },
    style: {
      borderRadius: "0.5rem",
      cardShadow: "0 2px 8px -2px rgba(0,0,0,0.1), 0 4px 16px -4px rgba(34,139,34,0.08)",
      buttonStyle: "solid",
      sidebarStyle: "solid",
      cardBorder: "1px solid hsl(142 20% 88%)",
      inputStyle: "bordered",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blues from coastal waters",
    icon: "🌊",
    colors: {
      primary: "200 80% 45%",
      primaryForeground: "0 0% 100%",
      accent: "190 70% 50%",
      accentForeground: "0 0% 100%",
      cardGlow: "rgba(30, 144, 200, 0.12)",
      gradientFrom: "200 60% 18%",
      gradientTo: "210 65% 12%",
      sidebar: "205 50% 14%",
      sidebarForeground: "200 20% 95%",
      sidebarAccent: "195 80% 55%",
    },
    style: {
      borderRadius: "0.75rem",
      cardShadow: "0 4px 20px -4px rgba(30,144,200,0.15), 0 2px 8px -2px rgba(0,0,0,0.08)",
      buttonStyle: "soft",
      sidebarStyle: "glass",
      cardBorder: "1px solid hsl(200 30% 90%)",
      inputStyle: "minimal",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm oranges and golden hour hues",
    icon: "🌅",
    colors: {
      primary: "25 90% 50%",
      primaryForeground: "0 0% 100%",
      accent: "35 95% 55%",
      accentForeground: "0 0% 15%",
      cardGlow: "rgba(255, 140, 50, 0.12)",
      gradientFrom: "25 50% 18%",
      gradientTo: "15 55% 12%",
      sidebar: "20 45% 14%",
      sidebarForeground: "30 20% 95%",
      sidebarAccent: "30 90% 55%",
    },
    style: {
      borderRadius: "1rem",
      cardShadow: "0 6px 24px -6px rgba(255,140,50,0.2), 0 2px 6px -2px rgba(0,0,0,0.06)",
      buttonStyle: "solid",
      sidebarStyle: "gradient",
      cardBorder: "none",
      inputStyle: "filled",
    },
  },
  {
    id: "mountain",
    name: "Mountain",
    description: "Slate grays and alpine stone",
    icon: "⛰️",
    colors: {
      primary: "220 15% 45%",
      primaryForeground: "0 0% 100%",
      accent: "210 20% 55%",
      accentForeground: "0 0% 100%",
      cardGlow: "rgba(100, 116, 139, 0.1)",
      gradientFrom: "220 20% 18%",
      gradientTo: "225 25% 12%",
      sidebar: "220 20% 14%",
      sidebarForeground: "220 15% 95%",
      sidebarAccent: "220 25% 60%",
    },
    style: {
      borderRadius: "0.25rem",
      cardShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
      buttonStyle: "outline",
      sidebarStyle: "solid",
      cardBorder: "1px solid hsl(220 15% 85%)",
      inputStyle: "bordered",
    },
  },
  {
    id: "meadow",
    name: "Meadow",
    description: "Fresh spring greens and wildflowers",
    icon: "🌻",
    colors: {
      primary: "85 60% 45%",
      primaryForeground: "0 0% 15%",
      accent: "60 70% 50%",
      accentForeground: "0 0% 15%",
      cardGlow: "rgba(132, 204, 22, 0.12)",
      gradientFrom: "85 40% 18%",
      gradientTo: "90 45% 12%",
      sidebar: "85 35% 14%",
      sidebarForeground: "85 20% 95%",
      sidebarAccent: "75 70% 50%",
    },
    style: {
      borderRadius: "1.25rem",
      cardShadow: "0 4px 12px -2px rgba(132,204,22,0.15), 0 2px 4px -1px rgba(0,0,0,0.05)",
      buttonStyle: "soft",
      sidebarStyle: "gradient",
      cardBorder: "none",
      inputStyle: "minimal",
    },
  },
  {
    id: "autumn",
    name: "Autumn",
    description: "Rich reds and falling leaves",
    icon: "🍂",
    colors: {
      primary: "15 75% 45%",
      primaryForeground: "0 0% 100%",
      accent: "30 80% 50%",
      accentForeground: "0 0% 100%",
      cardGlow: "rgba(180, 83, 9, 0.12)",
      gradientFrom: "15 50% 18%",
      gradientTo: "10 55% 12%",
      sidebar: "15 45% 14%",
      sidebarForeground: "20 20% 95%",
      sidebarAccent: "25 80% 50%",
    },
    style: {
      borderRadius: "0.375rem",
      cardShadow: "0 3px 10px -3px rgba(180,83,9,0.18), 0 2px 4px -1px rgba(0,0,0,0.08)",
      buttonStyle: "solid",
      sidebarStyle: "solid",
      cardBorder: "1px solid hsl(20 30% 88%)",
      inputStyle: "bordered",
    },
  },
  {
    id: "winter",
    name: "Winter",
    description: "Cool whites and icy blues",
    icon: "❄️",
    colors: {
      primary: "210 40% 55%",
      primaryForeground: "0 0% 100%",
      accent: "200 50% 65%",
      accentForeground: "0 0% 15%",
      cardGlow: "rgba(147, 197, 253, 0.15)",
      gradientFrom: "215 35% 20%",
      gradientTo: "220 40% 15%",
      sidebar: "215 30% 16%",
      sidebarForeground: "210 25% 95%",
      sidebarAccent: "200 60% 70%",
    },
    style: {
      borderRadius: "0.625rem",
      cardShadow: "0 4px 16px -4px rgba(147,197,253,0.25), 0 2px 6px -2px rgba(0,0,0,0.05)",
      buttonStyle: "outline",
      sidebarStyle: "glass",
      cardBorder: "1px solid hsl(210 30% 92%)",
      inputStyle: "minimal",
    },
  },
  {
    id: "desert",
    name: "Desert",
    description: "Sandy tones and terracotta warmth",
    icon: "🏜️",
    colors: {
      primary: "35 65% 50%",
      primaryForeground: "0 0% 100%",
      accent: "25 55% 55%",
      accentForeground: "0 0% 100%",
      cardGlow: "rgba(217, 119, 6, 0.12)",
      gradientFrom: "35 40% 18%",
      gradientTo: "30 45% 12%",
      sidebar: "35 35% 14%",
      sidebarForeground: "35 20% 95%",
      sidebarAccent: "40 70% 55%",
    },
    style: {
      borderRadius: "0.125rem",
      cardShadow: "0 2px 8px -2px rgba(217,119,6,0.15), 0 1px 3px -1px rgba(0,0,0,0.1)",
      buttonStyle: "solid",
      sidebarStyle: "solid",
      cardBorder: "2px solid hsl(35 25% 85%)",
      inputStyle: "filled",
    },
  },
];

export function getTheme(id: ThemeId | string | null | undefined): Theme {
  return themes.find(t => t.id === id) || themes[0];
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const { colors, style } = theme;
  
  // Apply colors
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-foreground", colors.primaryForeground);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-foreground", colors.accentForeground);
  root.style.setProperty("--card-glow", colors.cardGlow);
  root.style.setProperty("--sidebar", colors.sidebar);
  root.style.setProperty("--sidebar-foreground", colors.sidebarForeground);
  root.style.setProperty("--sidebar-accent", colors.sidebarAccent);
  
  // Apply style characteristics
  root.style.setProperty("--radius", style.borderRadius);
  root.style.setProperty("--card-shadow", style.cardShadow);
  root.style.setProperty("--card-border", style.cardBorder);
  
  // Set data attributes for CSS targeting
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-button-style", style.buttonStyle);
  root.setAttribute("data-sidebar-style", style.sidebarStyle);
  root.setAttribute("data-input-style", style.inputStyle);
}
