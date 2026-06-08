"use client";

import { AreaStats } from "@/lib/types";

const ICONS: Record<string, string> = {
  "Auth":           "🔐",
  "Create Event":   "✨",
  "RSVP Journeys":  "🎟️",
  "Date TBD":       "📅",
  "Manage Guests":  "👥",
  "Profile":        "👤",
  "Check-in":       "✅",
};

interface Props {
  areas: AreaStats[];
  selected: string | null;
  onSelect: (area: string | null) => void;
}

export default function Sidebar({ areas, selected, onSelect }: Props) {
  return (
    <aside className="w-60 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-800">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Features</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
            selected === null
              ? "bg-indigo-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <span>🧪</span>
          <span className="flex-1 text-left font-medium">All tests</span>
          <span className="text-xs opacity-60">
            {areas.reduce((a, b) => a + b.total, 0)}
          </span>
        </button>

        {areas.map((area) => {
          const isActive = selected === area.area;
          const hasFail  = area.failed > 0;
          const allPass  = area.failed === 0 && area.passed > 0;
          return (
            <button
              key={area.area}
              onClick={() => onSelect(area.area)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span>{ICONS[area.area] ?? "📁"}</span>
              <span className="flex-1 text-left">{area.area}</span>
              <span
                className={`text-xs font-medium ${
                  hasFail ? "text-red-400" : allPass ? "text-green-400" : "text-gray-500"
                }`}
              >
                {area.passed}/{area.total}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
