import { NextRequest, NextResponse } from "next/server";
import path from "path";

const E2E_ROOT = path.resolve(process.cwd(), "..");

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { spec, test: testName } = body as { spec?: string; test?: string };

  // The actual test run is done via the SSE stream endpoint.
  // This route just returns a run ID for the client to connect to.
  const runId = Date.now().toString();
  const params = new URLSearchParams();
  if (spec)     params.set("spec", spec);
  if (testName) params.set("test", testName);

  return NextResponse.json({ runId, streamUrl: `/api/run/stream?${params.toString()}` });
}
