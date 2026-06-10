import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";

const SHOT_PATH = path.join(os.tmpdir(), "e2e-live-screenshot.png");

export async function POST() {
  try {
    if (fs.existsSync(SHOT_PATH)) fs.unlinkSync(SHOT_PATH);
  } catch {}
  return NextResponse.json({ ok: true });
}
