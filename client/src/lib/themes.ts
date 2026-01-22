export type ThemeId = 
  | "forest" 
  | "ocean" 
  | "sunset" 
  | "mountain" 
  | "meadow" 
  | "autumn" 
  | "winter" 
  | "desert";

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
  };
}

export const themes: Theme[] = [
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
      cardGlow: "rgba(34, 139, 34, 0.15)",
      gradientFrom: "142 40% 20%",
      gradientTo: "142 50% 15%",
      sidebar: "142 40% 12%",
      sidebarForeground: "142 20% 95%",
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
      cardGlow: "rgba(30, 144, 200, 0.15)",
      gradientFrom: "200 60% 18%",
      gradientTo: "210 65% 12%",
      sidebar: "205 50% 14%",
      sidebarForeground: "200 20% 95%",
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
      cardGlow: "rgba(255, 140, 50, 0.15)",
      gradientFrom: "25 50% 18%",
      gradientTo: "15 55% 12%",
      sidebar: "20 45% 14%",
      sidebarForeground: "30 20% 95%",
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
      cardGlow: "rgba(100, 116, 139, 0.15)",
      gradientFrom: "220 20% 18%",
      gradientTo: "225 25% 12%",
      sidebar: "220 20% 14%",
      sidebarForeground: "220 15% 95%",
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
      cardGlow: "rgba(132, 204, 22, 0.15)",
      gradientFrom: "85 40% 18%",
      gradientTo: "90 45% 12%",
      sidebar: "85 35% 14%",
      sidebarForeground: "85 20% 95%",
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
      cardGlow: "rgba(180, 83, 9, 0.15)",
      gradientFrom: "15 50% 18%",
      gradientTo: "10 55% 12%",
      sidebar: "15 45% 14%",
      sidebarForeground: "20 20% 95%",
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
      cardGlow: "rgba(147, 197, 253, 0.2)",
      gradientFrom: "215 35% 20%",
      gradientTo: "220 40% 15%",
      sidebar: "215 30% 16%",
      sidebarForeground: "210 25% 95%",
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
      cardGlow: "rgba(217, 119, 6, 0.15)",
      gradientFrom: "35 40% 18%",
      gradientTo: "30 45% 12%",
      sidebar: "35 35% 14%",
      sidebarForeground: "35 20% 95%",
    },
  },
];

export function getTheme(id: ThemeId | string | null | undefined): Theme {
  return themes.find(t => t.id === id) || themes[0];
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const { colors } = theme;
  
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-foreground", colors.primaryForeground);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-foreground", colors.accentForeground);
  root.style.setProperty("--card-glow", colors.cardGlow);
  root.style.setProperty("--sidebar", colors.sidebar);
  root.style.setProperty("--sidebar-foreground", colors.sidebarForeground);
  
  root.setAttribute("data-theme", theme.id);
}
