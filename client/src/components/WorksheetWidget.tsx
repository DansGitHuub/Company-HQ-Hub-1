import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";

interface ActiveTimeEntry {
  id: number;
  job_id: string | null;
  job_name: string | null;
  clock_in: string;
  entry_type: string;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function WorksheetWidget() {
  const [minimized, setMinimized] = useState<boolean>(() => {
    return localStorage.getItem("worksheetWidgetMinimized") === "true";
  });
  const [elapsed, setElapsed] = useState(0);
  const [, navigate] = useLocation();

  const { data: activeEntry } = useQuery<ActiveTimeEntry | null>({
    queryKey: ["/api/time/active"],
    queryFn: async () => {
      const res = await fetch("/api/time/active");
      if (res.status === 404 || res.status === 204) return null;
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30000,
    retry: false,
  });

  useEffect(() => {
    if (!activeEntry?.clock_in) { setElapsed(0); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(activeEntry.clock_in).getTime()) / 1000);
      setElapsed(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeEntry?.clock_in]);

  useEffect(() => {
    localStorage.setItem("worksheetWidgetMinimized", String(minimized));
  }, [minimized]);

  if (!activeEntry) return null;

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white rounded-full px-4 py-2 shadow-lg cursor-pointer hover:bg-green-700 transition-colors" onClick={() => setMinimized(false)}>
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-sm font-medium">Worksheet Active</span>
        <span className="text-sm font-mono">{formatElapsed(elapsed)}</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl shadow-2xl overflow-hidden border border-gray-200">
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} />
          <span className="font-semibold text-sm">Worksheet Active</span>
        </div>
        <button onClick={() => setMinimized(true)} className="hover:opacity-75 transition-opacity">
          <ChevronDown size={18} />
        </button>
      </div>
      <div className="bg-white px-4 py-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Job</span>
          <span className="font-medium text-gray-800 truncate max-w-[180px]">{activeEntry.job_name || "No job selected"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Time</span>
          <span className="font-mono font-medium text-gray-800">{formatElapsed(elapsed)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Status</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-700 font-medium">Clocked In</span>
          </span>
        </div>
      </div>
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
        <button onClick={() => navigate("/daily-worksheet")} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">Open Worksheet</button>
      </div>
    </div>
  );
}
