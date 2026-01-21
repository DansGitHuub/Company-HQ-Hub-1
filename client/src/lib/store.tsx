import React, { createContext, useContext, useState, ReactNode } from "react";
import { nanoid } from "nanoid";

// --- Types ---

export type Role = "Admin" | "Manager" | "Crew" | "Customer";

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar?: string;
}

export interface SOP {
  id: string;
  title: string;
  category: string;
  content: string; // HTML/Markdown
  lastUpdated: string;
}

export interface Material {
  id: string;
  name: string;
  category: "Hardscape" | "Plants" | "Lighting" | "Irrigation" | "Bulk";
  sku: string;
  stock: number;
  unit: string;
  price: number;
  image?: string;
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  stage: "Applied" | "Phone Screen" | "Interview" | "Offer" | "Hired" | "Rejected";
  appliedDate: string;
  rating: number; // 1-5
}

export interface Campaign {
  id: string;
  name: string;
  platform: "Google" | "Meta" | "Email" | "Print";
  status: "Active" | "Paused" | "Draft";
  spend: number;
  leads: number;
  cpl: number;
}

export interface Integration {
  id: string;
  name: string;
  connected: boolean;
  icon: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  sops: SOP[];
  materials: Material[];
  candidates: Candidate[];
  campaigns: Campaign[];
  integrations: Integration[];
}

export interface AppContextType extends AppState {
  login: (userId: string) => void;
  logout: () => void;
  addSOP: (sop: Omit<SOP, "id" | "lastUpdated">) => void;
  updateCandidateStage: (id: string, stage: Candidate["stage"]) => void;
  toggleIntegration: (id: string) => void;
}

// --- Seed Data ---

const SEED_USERS: User[] = [
  { id: "u1", name: "Sarah Owner", role: "Admin" },
  { id: "u2", name: "Mike Manager", role: "Manager" },
  { id: "u3", name: "Joe Crew", role: "Crew" },
  { id: "u4", name: "Alice Customer", role: "Customer" },
];

const SEED_SOPS: SOP[] = [
  { id: "s1", title: "Morning Crew Load-out", category: "Operations", content: "1. Check vehicle fluids.<br>2. Load tools based on job sheet.<br>3. Verify safety gear.", lastUpdated: "2025-01-15" },
  { id: "s2", title: "Client Onboarding Script", category: "Sales", content: "Step 1: Greet warmly.<br>Step 2: Ask about vision.<br>Step 3: Budget discussion.", lastUpdated: "2024-12-20" },
  { id: "s3", title: "Paver Installation Standard", category: "Installation", content: "Excavate 6 inches. Compact base. Screed sand. Lay pattern.", lastUpdated: "2024-11-10" },
  { id: "s4", title: "Mower Maintenance Log", category: "Equipment", content: "Daily: Check oil, clean deck. Weekly: Sharpen blades.", lastUpdated: "2025-01-05" },
];

const SEED_MATERIALS: Material[] = [
  { id: "m1", name: "River Rock 1-3\"", category: "Bulk", sku: "BLK-RR-01", stock: 15, unit: "Tons", price: 85 },
  { id: "m2", name: "Premium Mulch (Black)", category: "Bulk", sku: "BLK-MU-02", stock: 40, unit: "Yards", price: 45 },
  { id: "m3", name: "Green Giant Arborvitae", category: "Plants", sku: "PLT-GG-05", stock: 12, unit: "Each", price: 120 },
  { id: "m4", name: "Pathway Light LED", category: "Lighting", sku: "LGT-PW-10", stock: 50, unit: "Box", price: 25 },
];

const SEED_CANDIDATES: Candidate[] = [
  { id: "c1", name: "John Doe", role: "Crew Lead", stage: "Interview", appliedDate: "2025-01-18", rating: 4 },
  { id: "c2", name: "Jane Smith", role: "Laborer", stage: "Applied", appliedDate: "2025-01-20", rating: 0 },
  { id: "c3", name: "Bob Wilson", role: "Project Manager", stage: "Offer", appliedDate: "2025-01-10", rating: 5 },
];

const SEED_CAMPAIGNS: Campaign[] = [
  { id: "cmp1", name: "Spring Cleanup Promo", platform: "Google", status: "Active", spend: 1200, leads: 45, cpl: 26.66 },
  { id: "cmp2", name: "Retargeting - Pavers", platform: "Meta", status: "Active", spend: 500, leads: 12, cpl: 41.66 },
  { id: "cmp3", name: "Newsletter Jan", platform: "Email", status: "Active", spend: 50, leads: 5, cpl: 10 },
];

const SEED_INTEGRATIONS: Integration[] = [
  { id: "int1", name: "Google Ads", connected: false, icon: "SiGoogleads" },
  { id: "int2", name: "Meta Ads", connected: true, icon: "SiMeta" },
  { id: "int3", name: "CompanyCam", connected: true, icon: "SiCamera" },
  { id: "int4", name: "QuickBooks", connected: false, icon: "SiQuickbooks" },
];

// --- Context ---

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(SEED_USERS[0]); // Default to Admin
  const [sops, setSops] = useState(SEED_SOPS);
  const [candidates, setCandidates] = useState(SEED_CANDIDATES);
  const [integrations, setIntegrations] = useState(SEED_INTEGRATIONS);

  const login = (userId: string) => {
    const user = SEED_USERS.find((u) => u.id === userId);
    if (user) setCurrentUser(user);
  };

  const logout = () => setCurrentUser(null);

  const addSOP = (sop: Omit<SOP, "id" | "lastUpdated">) => {
    setSops([...sops, { ...sop, id: nanoid(), lastUpdated: new Date().toISOString().split("T")[0] }]);
  };

  const updateCandidateStage = (id: string, stage: Candidate["stage"]) => {
    setCandidates(candidates.map((c) => (c.id === id ? { ...c, stage } : c)));
  };

  const toggleIntegration = (id: string) => {
    setIntegrations(integrations.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)));
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users: SEED_USERS,
        sops,
        materials: SEED_MATERIALS,
        candidates,
        campaigns: SEED_CAMPAIGNS,
        integrations,
        login,
        logout,
        addSOP,
        updateCandidateStage,
        toggleIntegration,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
