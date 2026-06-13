"use client";

import { useState } from "react";
import { TestCase } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import RunModal from "./RunModal";

interface Props {
  tests: TestCase[];
  area: string | null;
  search: string;
  env: "local" | "dev";
  onRunArea?: () => void;
  onRefresh?: () => void;
}

export default function TestTable({ tests, area, search, env, onRunArea, onRefresh }: Props) {
  const [modal, setModal] = useState<{ spec: string; name: string; label: string } | null>(null);

  const filtered = tests.filter((t) => {
    const matchArea   = !area || t.area === area;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    return matchArea && matchSearch;
  });

  const title = area ?? "All Tests";

  return (
    <div className="flex flex-col gap-4 flex-1 min-w-0">
      {/* section header */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-xs text-gray-500">{filtered.length} test{filtered.length !== 1 ? "s" : ""}</span>
        {area && (
          <button
            onClick={onRunArea}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium transition-colors"
          >
            ▶ Run all in {area}
          </button>
        )}
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/60">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Test case</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide w-28">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide w-28">Duration</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide w-40">Last run</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600 text-sm">
                  No tests match your search
                </td>
              </tr>
            )}
            {filtered.map((t, i) => (
              <tr
                key={i}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3 text-gray-200 max-w-xl">
                  <p className="leading-snug">{t.name}</p>
                  {!area && (
                    <p className="text-xs text-gray-500 mt-0.5">{t.area}</p>
                  )}
                  {t.lastResult?.error && (
                    <p className="text-xs text-red-400 mt-1 truncate max-w-sm" title={t.lastResult.error}>
                      {t.lastResult.error}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.lastResult?.status} />
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {t.lastResult ? `${t.lastResult.duration}s` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {t.lastResult
                    ? new Date(t.lastResult.date).toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setModal({ spec: t.spec, name: t.name, label: t.name })}
                    className="px-2.5 py-1 rounded-md bg-gray-800 hover:bg-indigo-600 text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    ▶ Run
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <RunModal
          spec={modal.spec}
          test={modal.name}
          label={modal.label}
          env={env}
          onClose={() => setModal(null)}
          onDone={onRefresh}
        />
      )}
    </div>
  );
}
