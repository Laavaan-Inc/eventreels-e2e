import fs from "fs";
import path from "path";
import { TestCase, TestResult, DashboardData, AreaStats } from "./types";

const RESULTS_FILE       = path.resolve(process.cwd(), "../playwright-report/results.json");
const DASH_RESULTS_FILE  = path.resolve(process.cwd(), "../playwright-report/dashboard-results.json");

const SPEC_TO_AREA: Record<string, string> = {
  "auth.spec.ts":           "Auth",
  "event-types.spec.ts":    "Create Event",
  "rsvp.spec.ts":           "RSVP Journeys",
  "date-undecided.spec.ts": "Date TBD",
  "manage-guests.spec.ts":  "Manage Guests",
  "profile.spec.ts":        "Profile",
  "check-in.spec.ts":       "Check-in",
};

function specToArea(spec: string): string {
  const base = path.basename(spec);
  return SPEC_TO_AREA[base] ?? base.replace(/\.spec\.ts$/, "");
}

const VALID_STATUSES = new Set(["passed", "failed", "skipped", "pending"]);
function normalizeStatus(s: string | undefined): "passed" | "failed" | "skipped" | "pending" {
  if (!s) return "pending";
  if (VALID_STATUSES.has(s)) return s as any;
  // Playwright also emits "timedOut" and "interrupted" — treat as failed
  return "failed";
}

export function walkPlaywrightJson(raw: any): TestResult[] {
  const results: TestResult[] = [];

  function walk(suites: any[], specFile: string) {
    for (const suite of suites) {
      const file = suite.file ?? specFile;
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const test of spec.tests ?? []) {
            const result = test.results?.[0];
            results.push({
              runId:    raw.stats?.startTime ?? new Date().toISOString(),
              date:     raw.stats?.startTime ?? new Date().toISOString(),
              spec:     path.basename(file),
              area:     specToArea(file),
              name:     `${suite.title} > ${spec.title}`.trim().replace(/^> /, ""),
              status:   normalizeStatus(result?.status),
              duration: Math.round((result?.duration ?? 0) / 1000),
              error:    result?.error?.message,
            });
          }
        }
      }
      if (suite.suites) walk(suite.suites, file);
    }
  }

  walk(raw.suites ?? [], "");
  return results;
}

export function readResults(): TestResult[] {
  const results: TestResult[] = [];

  // Full-suite results (written by `npx playwright test` on the CLI)
  if (fs.existsSync(RESULTS_FILE)) {
    try {
      results.push(...walkPlaywrightJson(JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"))));
    } catch {}
  }

  // Per-test results written by the dashboard after each individual run
  if (fs.existsSync(DASH_RESULTS_FILE)) {
    try {
      const dash = JSON.parse(fs.readFileSync(DASH_RESULTS_FILE, "utf-8"));
      if (Array.isArray(dash)) results.push(...dash);
    } catch {}
  }

  return results;
}

export function buildDashboard(allTests: string[][], results: TestResult[]): DashboardData {
  const latestByTitle = new Map<string, TestResult>();
  for (const r of results) {
    const key = `${r.spec}::${r.name}`;
    const existing = latestByTitle.get(key);
    if (!existing || r.date > existing.date) latestByTitle.set(key, r);
  }

  const tests: TestCase[] = allTests.map(([spec, name]) => {
    const area = specToArea(spec);
    const key  = `${path.basename(spec)}::${name}`;
    return { spec: path.basename(spec), area, name, fullTitle: name, lastResult: latestByTitle.get(key) };
  });

  const areaMap = new Map<string, AreaStats>();
  for (const t of tests) {
    if (!areaMap.has(t.area)) {
      areaMap.set(t.area, { area: t.area, total: 0, passed: 0, failed: 0, skipped: 0 });
    }
    const s = areaMap.get(t.area)!;
    s.total++;
    const st = t.lastResult?.status;
    if (st === "passed")  s.passed++;
    if (st === "failed")  s.failed++;
    if (st === "skipped") s.skipped++;
    if (t.lastResult?.date && (!s.lastRun || t.lastResult.date > s.lastRun)) {
      s.lastRun = t.lastResult.date;
    }
  }

  const lastResult = results.length ? results.reduce((a, b) => (a.date > b.date ? a : b)) : null;

  return {
    areas:        Array.from(areaMap.values()).sort((a, b) => a.area.localeCompare(b.area)),
    tests,
    totalPassed:  tests.filter(t => t.lastResult?.status === "passed").length,
    totalFailed:  tests.filter(t => t.lastResult?.status === "failed").length,
    totalSkipped: tests.filter(t => t.lastResult?.status === "skipped").length,
    totalTests:   tests.length,
    lastRunDate:  lastResult?.date,
    lastRunId:    lastResult?.runId,
  };
}
