"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TestTable from "@/components/TestTable";
import RunModal from "@/components/RunModal";
import AddTestModal from "@/components/AddTestModal";
import { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const [data,        setData]        = useState<DashboardData | null>(null);
  const [area,        setArea]        = useState<string | null>(null);
  const [search,      setSearch]      = useState("");
  const [areaRun,     setAreaRun]     = useState<string | null>(null);
  const [allRun,      setAllRun]      = useState(false);
  const [addTestOpen, setAddTestOpen] = useState(false);
  const [lastFetch,   setLastFetch]   = useState<Date | null>(null);
  const [env,         setEnv]         = useState<"local" | "dev">("dev");

  const fetchData = useCallback(() => {
    fetch("/api/tests")
      .then((r) => r.json())
      .then((d) => { setData(d); setLastFetch(new Date()); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        Loading tests…
      </div>
    );
  }

  const passRate = data.totalTests > 0
    ? Math.round((data.totalPassed / data.totalTests) * 100)
    : null;

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar areas={data.areas} selected={area} onSelect={setArea} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* top bar */}
        <header className="shrink-0 border-b border-gray-800 bg-gray-950 px-6 py-4 flex items-center gap-6">
          <div>
            <h1 className="text-base font-bold text-white leading-tight">EventReels E2E</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">UI Automation Dashboard</p>
          </div>

          {/* stats */}
          <div className="flex items-center gap-5 ml-4">
            <Stat label="Total" value={data.totalTests} color="text-gray-300" />
            <Stat label="Passed" value={data.totalPassed} color="text-green-400" />
            <Stat label="Failed" value={data.totalFailed} color="text-red-400" />
            <Stat label="Skipped" value={data.totalSkipped} color="text-yellow-400" />
            {passRate !== null && (
              <Stat label="Pass rate" value={`${passRate}%`} color={passRate >= 80 ? "text-green-400" : "text-red-400"} />
            )}
          </div>

          {/* search + actions */}
          <div className="ml-auto flex items-center gap-3">
            <input
              type="search"
              placeholder="Search tests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />

            {/* Environment toggle */}
            <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg p-0.5">
              {(["local", "dev"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    env === e
                      ? e === "dev"
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {e === "dev" ? "dev.eventreels.com" : "localhost"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAddTestOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-xs text-white font-medium transition-colors"
            >
              ✨ Add with AI
            </button>
            <button
              onClick={() => setAllRun(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium transition-colors"
            >
              ▶ Run all
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors"
              title="Refresh"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* last run info */}
        {data.lastRunDate && (
          <div className="shrink-0 px-6 py-2 bg-gray-900/40 border-b border-gray-800/50 flex items-center gap-2 text-xs text-gray-500">
            <span>Last run:</span>
            <span className="text-gray-400">
              {new Date(data.lastRunDate).toLocaleString("en-US", {
                weekday: "short", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            {lastFetch && (
              <>
                <span className="mx-1">·</span>
                <span>Refreshed {lastFetch.toLocaleTimeString()}</span>
              </>
            )}
          </div>
        )}

        {/* main content */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <TestTable
            tests={data.tests}
            area={area}
            search={search}
            env={env}
            onRunArea={() => setAreaRun(area)}
            onRefresh={fetchData}
          />
        </main>
      </div>

      {areaRun && (
        <RunModal
          spec={data.tests.find((t) => t.area === areaRun)?.spec}
          label={`Run all — ${areaRun}`}
          env={env}
          onClose={() => { setAreaRun(null); fetchData(); }}
        />
      )}

      {allRun && (
        <RunModal
          label="Run all tests"
          env={env}
          onClose={() => { setAllRun(false); fetchData(); }}
        />
      )}

      {addTestOpen && (
        <AddTestModal
          onClose={() => setAddTestOpen(false)}
          onAdded={fetchData}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-bold leading-tight ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  );
}
