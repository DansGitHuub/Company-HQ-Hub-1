import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, Clock, StickyNote, DollarSign, MessageSquare,
  Activity, BookOpen, Package, Users, Truck, GitBranch, CheckSquare,
  LogOut, Shield, Lock, ListTodo, Image, ChevronRight, MapPin, Calendar,
  ChevronDown, ChevronLeft, Menu
} from "lucide-react";

type Tab = { id: string; label: string; icon: React.ElementType; badge?: number };
type Group = { id: string; label: string; color: string; dot: string; tabs: Tab[] };

const groups: Group[] = [
  {
    id: "core", label: "Core", color: "text-blue-600", dot: "bg-blue-500",
    tabs: [
      { id: "overview",   label: "Overview",    icon: LayoutDashboard },
      { id: "work-order", label: "Work Order",   icon: ClipboardList },
      { id: "tasks",      label: "Tasks",        icon: ListTodo, badge: 3 },
    ],
  },
  {
    id: "field", label: "Field Work", color: "text-green-600", dot: "bg-green-500",
    tabs: [
      { id: "time",        label: "Time Entries",  icon: Clock, badge: 12 },
      { id: "materials",   label: "Materials",     icon: Package },
      { id: "crew",        label: "Crew",          icon: Users },
      { id: "equipment",   label: "Equipment",     icon: Truck },
      { id: "files-photos",label: "Files & Photos",icon: Image, badge: 8 },
    ],
  },
  {
    id: "comms", label: "Communication", color: "text-violet-600", dot: "bg-violet-500",
    tabs: [
      { id: "notes",      label: "Notes",      icon: StickyNote, badge: 2 },
      { id: "messages",   label: "Messages",   icon: MessageSquare },
      { id: "activity",   label: "Activity",   icon: Activity },
      { id: "daily-logs", label: "Journal",    icon: BookOpen },
    ],
  },
  {
    id: "financial", label: "Financial", color: "text-amber-600", dot: "bg-amber-500",
    tabs: [
      { id: "invoices",      label: "Invoices",       icon: DollarSign },
      { id: "change-orders", label: "Change Orders",  icon: GitBranch, badge: 1 },
    ],
  },
  {
    id: "lifecycle", label: "Lifecycle", color: "text-slate-600", dot: "bg-slate-500",
    tabs: [
      { id: "checkpoints",  label: "Checkpoints", icon: CheckSquare },
      { id: "closeout",     label: "Closeout",    icon: LogOut },
      { id: "warranty",     label: "Warranty",    icon: Shield },
      { id: "packet-gate",  label: "Job Gate",    icon: Lock },
    ],
  },
];

const contentPreview: Record<string, { title: string; desc: string }> = {
  "overview":      { title: "Job Overview", desc: "Status, crew assignment, customer info, progress, and key job metrics at a glance." },
  "work-order":    { title: "Work Order", desc: "Scope of work, line items, and field instructions for the crew." },
  "tasks":         { title: "Tasks", desc: "Kanban and list view of all tasks tied to this job." },
  "time":          { title: "Time Entries", desc: "Clock-in/out records, total hours, and labor breakdown by employee." },
  "materials":     { title: "Materials", desc: "Materials used, quantities, costs, and supplier notes." },
  "crew":          { title: "Crew", desc: "Crew members assigned with roles and contact info." },
  "equipment":     { title: "Equipment", desc: "Fleet and equipment assigned, usage hours, and condition notes." },
  "files-photos":  { title: "Files & Photos", desc: "Before/after photos, documents, and CompanyCam sync." },
  "notes":         { title: "Notes", desc: "Internal notes and updates from the field." },
  "messages":      { title: "Messages", desc: "Direct messages linked to this job." },
  "activity":      { title: "Activity Log", desc: "Full audit trail of all changes and actions on this job." },
  "daily-logs":    { title: "Journal", desc: "Daily crew journal entries and field reports." },
  "invoices":      { title: "Invoices", desc: "Invoice history, payment status, and billing details." },
  "change-orders": { title: "Change Orders", desc: "Approved and pending scope changes with cost impact." },
  "checkpoints":   { title: "Checkpoints", desc: "Project milestone checklist — items to confirm before advancing." },
  "closeout":      { title: "Closeout", desc: "Final inspection, customer sign-off, and punch list." },
  "warranty":      { title: "Warranty", desc: "Warranty terms, expiry dates, and any filed claims." },
  "packet-gate":   { title: "Job Gate", desc: "Pre-start checklist that must be cleared before the crew begins." },
};

export function SidebarNav() {
  const [active, setActive] = useState("overview");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeGroup = groups.find(g => g.tabs.some(t => t.id === active))!;
  const activeTab = activeGroup.tabs.find(t => t.id === active)!;
  const preview = contentPreview[active];

  const toggleGroup = (id: string) => {
    setCollapsed(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Job Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Jobs
          </button>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <div>
            <h1 className="text-base font-semibold text-gray-900">Patio & Walkway Install</h1>
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

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto transition-all duration-200 ${sidebarOpen ? "w-52" : "w-0 opacity-0 pointer-events-none"}`}
        >
          <div className="py-3 px-2 space-y-1">
            {groups.map(group => {
              const isCollapsed = collapsed.includes(group.id);
              return (
                <div key={group.id}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${group.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${group.color}`}>
                        {group.label}
                      </span>
                    </div>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  </button>

                  {/* Group tabs */}
                  {!isCollapsed && (
                    <div className="mt-0.5 space-y-0.5 ml-2">
                      {group.tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = active === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActive(tab.id)}
                            className={`
                              w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all text-xs
                              ${isActive
                                ? "bg-gray-900 text-white font-medium"
                                : "text-gray-600 hover:bg-gray-100"
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span>{tab.label}</span>
                            </div>
                            {tab.badge && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
                                {tab.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="my-1 border-t border-gray-100" />
                </div>
              );
            })}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${activeGroup.dot}`} />
            <span className={`text-xs font-semibold uppercase tracking-wider ${activeGroup.color}`}>
              {activeGroup.label}
            </span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-xs text-gray-500">{activeTab.label}</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[400px]">
            <div className="flex items-center gap-2 mb-2">
              {(() => { const Icon = activeTab.icon; return <Icon className="w-5 h-5 text-gray-400" />; })()}
              <h2 className="text-base font-semibold text-gray-800">{preview.title}</h2>
            </div>
            <p className="text-sm text-gray-400 mb-6">{preview.desc}</p>
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-10 bg-gray-50 rounded-lg border border-gray-100" style={{ width: `${80 + (i % 3) * 7}%` }} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
