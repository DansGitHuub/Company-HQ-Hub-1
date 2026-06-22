import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, Clock, StickyNote, FileText, MessageSquare,
  Activity, BookOpen, Package, Users, Truck, GitBranch, CheckSquare,
  LogOut, Shield, Lock, ListTodo, Image, ChevronRight, MapPin, Calendar,
  DollarSign, Wrench, AlertCircle
} from "lucide-react";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Core" },
  { id: "work-order", label: "Work Order", icon: ClipboardList, group: "Core" },
  { id: "tasks", label: "Tasks", icon: ListTodo, group: "Core" },
  { id: "time", label: "Time Entries", icon: Clock, group: "Field Work" },
  { id: "materials", label: "Materials", icon: Package, group: "Field Work" },
  { id: "crew", label: "Crew", icon: Users, group: "Field Work" },
  { id: "equipment", label: "Equipment", icon: Truck, group: "Field Work" },
  { id: "files-photos", label: "Files & Photos", icon: Image, group: "Field Work" },
  { id: "notes", label: "Notes", icon: StickyNote, group: "Communication" },
  { id: "messages", label: "Messages", icon: MessageSquare, group: "Communication" },
  { id: "activity", label: "Activity", icon: Activity, group: "Communication" },
  { id: "daily-logs", label: "Journal", icon: BookOpen, group: "Communication" },
  { id: "invoices", label: "Invoices", icon: DollarSign, group: "Financial" },
  { id: "change-orders", label: "Change Orders", icon: GitBranch, group: "Financial" },
  { id: "checkpoints", label: "Checkpoints", icon: CheckSquare, group: "Lifecycle" },
  { id: "closeout", label: "Closeout", icon: LogOut, group: "Lifecycle" },
  { id: "warranty", label: "Warranty", icon: Shield, group: "Lifecycle" },
  { id: "packet-gate", label: "Job Gate", icon: Lock, group: "Lifecycle" },
];

const groups = ["Core", "Field Work", "Communication", "Financial", "Lifecycle"];

const groupColors: Record<string, { bg: string; text: string; border: string; active: string }> = {
  "Core":          { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",  active: "bg-blue-600 text-white border-blue-600 shadow-md" },
  "Field Work":    { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200", active: "bg-green-600 text-white border-green-600 shadow-md" },
  "Communication": { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200",active: "bg-violet-600 text-white border-violet-600 shadow-md" },
  "Financial":     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200", active: "bg-amber-600 text-white border-amber-600 shadow-md" },
  "Lifecycle":     { bg: "bg-slate-50",  text: "text-slate-700",  border: "border-slate-200", active: "bg-slate-600 text-white border-slate-600 shadow-md" },
};

const contentPreview: Record<string, { title: string; desc: string; color: string }> = {
  "overview":      { title: "Job Overview", desc: "Job status, assigned crew, customer info, progress bar, and key metrics at a glance.", color: "bg-blue-50 border-blue-200" },
  "work-order":    { title: "Work Order", desc: "Scope of work, line items, tasks, and field instructions for the crew.", color: "bg-blue-50 border-blue-200" },
  "tasks":         { title: "Tasks", desc: "Kanban board and task list tied to this job.", color: "bg-blue-50 border-blue-200" },
  "time":          { title: "Time Entries", desc: "Clock-in/out records, total hours, and labor breakdown by employee.", color: "bg-green-50 border-green-200" },
  "materials":     { title: "Materials", desc: "Materials used, quantities, costs, and supplier notes.", color: "bg-green-50 border-green-200" },
  "crew":          { title: "Crew", desc: "Crew members assigned to this job with roles and contact info.", color: "bg-green-50 border-green-200" },
  "equipment":     { title: "Equipment", desc: "Fleet and equipment assigned, usage hours, and condition notes.", color: "bg-green-50 border-green-200" },
  "files-photos":  { title: "Files & Photos", desc: "Before/after photos, documents, and CompanyCam sync.", color: "bg-green-50 border-green-200" },
  "notes":         { title: "Notes", desc: "Internal notes and updates from the field.", color: "bg-violet-50 border-violet-200" },
  "messages":      { title: "Messages", desc: "Direct messages linked to this job.", color: "bg-violet-50 border-violet-200" },
  "activity":      { title: "Activity Log", desc: "Full audit trail of all changes and actions on this job.", color: "bg-violet-50 border-violet-200" },
  "daily-logs":    { title: "Journal", desc: "Daily crew journal entries and field reports.", color: "bg-violet-50 border-violet-200" },
  "invoices":      { title: "Invoices", desc: "Invoice history, payment status, and billing details.", color: "bg-amber-50 border-amber-200" },
  "change-orders": { title: "Change Orders", desc: "Approved and pending scope changes with cost impact.", color: "bg-amber-50 border-amber-200" },
  "checkpoints":   { title: "Checkpoints", desc: "Project milestone checklist — items to confirm before advancing.", color: "bg-slate-50 border-slate-200" },
  "closeout":      { title: "Closeout", desc: "Final inspection, customer sign-off, and punch list.", color: "bg-slate-50 border-slate-200" },
  "warranty":      { title: "Warranty", desc: "Warranty terms, expiry dates, and any filed claims.", color: "bg-slate-50 border-slate-200" },
  "packet-gate":   { title: "Job Gate", desc: "Pre-start checklist that must be cleared before the crew begins.", color: "bg-slate-50 border-slate-200" },
};

export function TileNav() {
  const [active, setActive] = useState("overview");

  const activeTab = tabs.find(t => t.id === active)!;
  const activeGroup = activeTab.group;
  const preview = contentPreview[active];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Job Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">
            <ChevronRight className="w-4 h-4 rotate-180" /> Jobs
          </button>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Patio & Walkway Install</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" /> 142 Birchwood Dr, Glastonbury
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" /> Jun 18 – Jun 26
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">In Progress</span>
          <button className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Edit</button>
        </div>
      </div>

      {/* Tile Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0">
        <div className="space-y-3">
          {groups.map(group => {
            const groupTabs = tabs.filter(t => t.group === group);
            const c = groupColors[group];
            return (
              <div key={group} className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wider w-24 shrink-0 ${c.text} opacity-70`}>
                  {group}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {groupTabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = active === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActive(tab.id)}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                          ${isActive
                            ? c.active
                            : `${c.bg} ${c.text} ${c.border} hover:opacity-80`
                          }
                        `}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {/* Active group indicator bar */}
        <div className="mt-3 flex gap-1">
          {groups.map(g => (
            <div
              key={g}
              className={`h-0.5 flex-1 rounded-full transition-all ${g === activeGroup ? groupColors[g].active.split(" ")[0] : "bg-gray-100"}`}
            />
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6">
        <div className={`rounded-xl border-2 ${preview.color} p-6 h-full min-h-[320px] flex flex-col`}>
          <div className="flex items-center gap-2 mb-3">
            {(() => { const Icon = activeTab.icon; return <Icon className="w-5 h-5 text-gray-500" />; })()}
            <h2 className="text-base font-semibold text-gray-800">{preview.title}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">{preview.desc}</p>
          {/* Simulated content rows */}
          <div className="space-y-2 flex-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-10 bg-white/60 rounded-lg border border-white/80 animate-pulse" style={{ animationDelay: `${i * 0.1}s`, width: `${85 + (i % 3) * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
