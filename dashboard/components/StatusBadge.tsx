"use client";

import { TestStatus } from "@/lib/types";

const MAP: Record<TestStatus, { label: string; cls: string }> = {
  passed:  { label: "Passed",  cls: "bg-green-100 text-green-700" },
  failed:  { label: "Failed",  cls: "bg-red-100 text-red-700" },
  skipped: { label: "Skipped", cls: "bg-yellow-100 text-yellow-700" },
  pending: { label: "Pending", cls: "bg-gray-100 text-gray-500" },
};

export default function StatusBadge({ status }: { status?: TestStatus }) {
  const cfg = MAP[status ?? "pending"] ?? MAP["pending"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
