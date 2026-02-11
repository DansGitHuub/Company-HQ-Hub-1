import React, { useState } from "react";
import {
  FilePlus2,
  Library,
  RefreshCw,
  FileEdit,
  Share2,
  Package,
  XCircle,
} from "lucide-react";

export default function Forms() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const topButton = {
    id: "build-new",
    label: "Build a New Form",
    description: "Create a form from scratch with our step-by-step builder",
    icon: FilePlus2,
    color: "from-emerald-500 to-emerald-700",
    hoverColor: "from-emerald-600 to-emerald-800",
  };

  const gridButtons = [
    {
      id: "form-library",
      label: "Form Library",
      description: "Browse and manage all your published forms",
      icon: Library,
      color: "from-blue-500 to-blue-700",
      hoverColor: "from-blue-600 to-blue-800",
    },
    {
      id: "update-existing",
      label: "Update an Existing Form",
      description: "Edit and modify forms that are already in use",
      icon: RefreshCw,
      color: "from-violet-500 to-violet-700",
      hoverColor: "from-violet-600 to-violet-800",
    },
    {
      id: "form-drafts",
      label: "Form Drafts",
      description: "Continue working on forms you haven't finished yet",
      icon: FileEdit,
      color: "from-amber-500 to-amber-700",
      hoverColor: "from-amber-600 to-amber-800",
    },
    {
      id: "share-forms",
      label: "Share Forms",
      description: "Send forms to employees, customers, or external contacts",
      icon: Share2,
      color: "from-cyan-500 to-cyan-700",
      hoverColor: "from-cyan-600 to-cyan-800",
    },
    {
      id: "build-packet",
      label: "Build a Packet",
      description: "Bundle multiple forms together into a single packet",
      icon: Package,
      color: "from-rose-500 to-rose-700",
      hoverColor: "from-rose-600 to-rose-800",
    },
    {
      id: "discontinued",
      label: "Discontinued Forms",
      description: "View and restore forms that have been retired",
      icon: XCircle,
      color: "from-slate-500 to-slate-700",
      hoverColor: "from-slate-600 to-slate-800",
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="forms-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-forms-title">Forms</h1>

      <button
        className={`w-full mb-6 rounded-2xl bg-gradient-to-br ${
          hoveredId === topButton.id ? topButton.hoverColor : topButton.color
        } p-8 text-white text-left transition-all duration-200 ${
          hoveredId === topButton.id ? "scale-[1.01] shadow-xl" : "shadow-lg"
        }`}
        onMouseEnter={() => setHoveredId(topButton.id)}
        onMouseLeave={() => setHoveredId(null)}
        data-testid={`button-${topButton.id}`}
      >
        <div className="flex items-center gap-4">
          <div className={`rounded-xl bg-white/20 p-4 transition-transform duration-200 ${
            hoveredId === topButton.id ? "scale-110" : ""
          }`}>
            <topButton.icon className="h-8 w-8" />
          </div>
          <div>
            <div className="text-xl font-bold">{topButton.label}</div>
            <div className="mt-1 text-sm text-white/80">{topButton.description}</div>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gridButtons.map((btn, index) => (
          <button
            key={btn.id}
            className={`rounded-2xl bg-gradient-to-br ${
              hoveredId === btn.id ? btn.hoverColor : btn.color
            } p-6 text-white text-left transition-all duration-200 ${
              hoveredId === btn.id ? "scale-[1.02] shadow-xl" : "shadow-lg"
            }`}
            onMouseEnter={() => setHoveredId(btn.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`button-${btn.id}`}
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-xl bg-white/20 p-3 transition-transform duration-200 ${
                hoveredId === btn.id ? "scale-110" : ""
              }`}>
                <btn.icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-bold">{btn.label}</div>
                <div className="mt-1 text-sm text-white/80">{btn.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
