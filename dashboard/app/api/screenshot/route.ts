import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";

// Written by fixtures/traced-test.ts after every page.load / domcontentloaded event
const SHOT_PATH = path.join(os.tmpdir(), "e2e-live-screenshot.png");

export async function GET() {
  if (!fs.existsSync(SHOT_PATH)) {
    return NextResponse.json({ error: "no screenshot yet" }, { status: 404 });
  }

  const stat = fs.statSync(SHOT_PATH);
  const buf  = fs.readFileSync(SHOT_PATH);
  const b64  = buf.toString("base64");

  return NextResponse.json({
    image:    `data:image/png;base64,${b64}`,
    updatedAt: stat.mtimeMs,
  });
}
