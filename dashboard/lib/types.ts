export type TestStatus = "passed" | "failed" | "skipped" | "pending";

export interface TestResult {
  runId: string;
  date: string;
  spec: string;
  area: string;
  name: string;
  status: TestStatus;
  duration: number;
  error?: string;
}

export interface TestCase {
  spec: string;
  area: string;
  name: string;
  fullTitle: string;
  lastResult?: TestResult;
  isNew?: boolean;
}

export interface AreaStats {
  area: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  lastRun?: string;
}

export interface DashboardData {
  areas: AreaStats[];
  tests: TestCase[];
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalTests: number;
  lastRunDate?: string;
  lastRunId?: string;
}
