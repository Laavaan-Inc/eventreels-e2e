import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";

const SHOT_PATH = path.join(os.tmpdir(), "e2e-live-screenshot.png");

export async function GET(req: NextRequest) {
  try {
    // Capture the frontmost browser window on macOS
    execSync(
      `screencapture -x -o -l $(osascript -e 'tell app "System Events" to get id of first window of first process whose name contains "Chromium" or name contains "Chrome" or name contains "Google Chrome"' 2>/dev/null || echo 0) "${SHOT_PATH}" 2>/dev/null || screencapture -x "${SHOT_PATH}"`,
      { timeout: 3_000, stdio: "pipe" }
    );
  } catch {
    // Fallback: full screen capture
    try {
      execSync(`screencapture -x "${SHOT_PATH}"`, { timeout: 3_000, stdio: "pipe" });
    } catch {
      return NextResponse.json({ error: "screenshot failed" }, { status: 500 });
    }
  }

  if (!fs.existsSync(SHOT_PATH)) {
    return NextResponse.json({ error: "no screenshot" }, { status: 404 });
  }

  const buf = fs.readFileSync(SHOT_PATH);
  const b64 = buf.toString("base64");
  return NextResponse.json({ image: `data:image/png;base64,${b64}` });
}
