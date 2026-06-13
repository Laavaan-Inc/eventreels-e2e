import { NextRequest } from "next/server";
import { spawn }       from "child_process";
import path            from "path";
import fs              from "fs";
import dotenv          from "dotenv";
import { walkPlaywrightJson } from "@/lib/results";

const E2E_ROOT      = path.resolve(process.cwd(), "..");
const DASH_RESULTS  = path.join(E2E_ROOT, "playwright-report", "dashboard-results.json");

function mergeDashboardResults(tempJsonPath: string) {
  try {
    if (!fs.existsSync(tempJsonPath)) return;
    const newResults = walkPlaywrightJson(JSON.parse(fs.readFileSync(tempJsonPath, "utf-8")));
    if (!newResults.length) return;

    const existing: any[] = fs.existsSync(DASH_RESULTS)
      ? JSON.parse(fs.readFileSync(DASH_RESULTS, "utf-8"))
      : [];

    // Replace the entry for each spec::name that appeared in this run
    const merged = [...existing];
    for (const r of newResults) {
      const idx = merged.findIndex((e) => e.spec === r.spec && e.name === r.name);
      if (idx >= 0) merged[idx] = r; else merged.push(r);
    }

    fs.mkdirSync(path.dirname(DASH_RESULTS), { recursive: true });
    fs.writeFileSync(DASH_RESULTS, JSON.stringify(merged, null, 2));
  } catch {
    // Non-critical — dashboard just won't refresh this run's status
  } finally {
    try { fs.unlinkSync(tempJsonPath); } catch {}
  }
}

function loadEnvFile(file: string): Record<string, string> {
  const p = path.join(E2E_ROOT, file);
  if (!fs.existsSync(p)) return {};
  return dotenv.parse(fs.readFileSync(p));
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spec     = searchParams.get("spec")  ?? undefined;
  const testName = searchParams.get("test")  ?? undefined;

  const headed  = searchParams.get("headed") === "true";
  const envFile = searchParams.get("env") ?? "local"; // "dev" or "local"

  // Temp path for the JSON reporter — merged into dashboard-results.json on exit
  const tempJsonPath = path.join(E2E_ROOT, "playwright-report", `.run-${Date.now()}.json`);

  const args = ["playwright", "test", "--reporter=line,json"];
  if (headed) args.push("--headed");

  // Spec goes BEFORE --project in Playwright 1.60 (multiple args after --project
  // are treated as additional project names, not file patterns).
  if (spec) args.push(spec);

  // Route to the correct project so storageState is applied correctly.
  // auth.spec.ts runs without stored auth (exercises real OTP UI).
  // Everything else uses the pre-authenticated e2e project.
  if (spec) {
    args.push("--project", spec.includes("auth.spec") ? "auth" : "e2e");
  }

  if (testName) {
    // Stored title is "describe > test" — use only the leaf test() name.
    // The spec file already scopes us to the right file; grep just picks the test.
    const leaf = testName.includes(" > ") ? testName.split(" > ").pop()! : testName;
    args.push("--grep", leaf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }

  // Merge env-file vars on top of current process.env
  const envVars = loadEnvFile(`.env.${envFile}`);
  const childEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...envVars,
    PLAYWRIGHT_JSON_OUTPUT_NAME: tempJsonPath,
  };

  // When running only auth tests, skip the slow event-seeding step in global-setup
  if (spec?.includes("auth.spec")) {
    childEnv.SKIP_SEEDING = "true";
  }

  fs.mkdirSync(path.join(E2E_ROOT, "playwright-report"), { recursive: true });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn("npx", args, { cwd: E2E_ROOT, env: childEnv, shell: false });

      const send = (line: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
      };

      child.stdout.on("data", (d) => d.toString().split("\n").forEach((l: string) => l && send(l)));
      child.stderr.on("data", (d) => d.toString().split("\n").forEach((l: string) => l && send(l)));

      child.on("exit", (code) => {
        mergeDashboardResults(tempJsonPath);
        send(`__EXIT__:${code ?? 0}`);
        controller.close();
      });

      child.on("error", (err) => {
        send(`__ERROR__: ${err.message}`);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
