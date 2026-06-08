import { NextResponse } from "next/server";
import { listTests }    from "@/lib/playwright";
import { readResults, buildDashboard } from "@/lib/results";

export const dynamic = "force-dynamic";

export async function GET() {
  const tests   = listTests();
  const results = readResults();
  const data    = buildDashboard(tests, results);
  return NextResponse.json(data);
}
