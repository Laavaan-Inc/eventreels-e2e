import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const E2E_ROOT = path.resolve(__dirname, "../../../../../../");

export const dynamic = "force-dynamic";

const AREA_TO_SPEC: Record<string, string> = {
  "Auth":           "specs/auth.spec.ts",
  "Create Event":   "specs/event-types.spec.ts",
  "RSVP Journeys":  "specs/rsvp.spec.ts",
  "Date TBD":       "specs/date-undecided.spec.ts",
  "Manage Guests":  "specs/manage-guests.spec.ts",
  "Profile":        "specs/profile.spec.ts",
  "Check-in":       "specs/check-in.spec.ts",
};

function readSpec(specFile: string): string {
  try {
    return fs.readFileSync(path.join(E2E_ROOT, specFile), "utf-8");
  } catch {
    return "";
  }
}

function readPageObjects(): string {
  const poDir = path.join(E2E_ROOT, "page-objects");
  const files = fs.readdirSync(poDir).filter(f => f.endsWith(".ts"));
  return files.map(f => {
    const content = fs.readFileSync(path.join(poDir, f), "utf-8");
    // Only include method signatures, not full bodies, to save tokens
    const lines = content.split("\n");
    const sigs = lines.filter(l =>
      l.match(/^\s*(async\s+)?\w+\s*\(/) ||
      l.match(/^export class/) ||
      l.match(/^import /)
    );
    return `// ${f}\n${sigs.join("\n")}`;
  }).join("\n\n");
}

const SYSTEM_PROMPT = `You are an expert Playwright TypeScript test engineer for EventReels, a social events platform.

Your job: given a test scenario description from the QA engineer, produce a structured JSON response with a complete, runnable Playwright test.

## Available feature areas and spec files
${Object.entries(AREA_TO_SPEC).map(([k, v]) => `- ${k} → ${v}`).join("\n")}

## Project conventions
- Tests use page objects from ../page-objects/ (ManageEventPage, EventPage, AuthPage, ProfilePage, CheckInPage, CreateEventPage)
- API helpers from ../utils/api-helpers.ts: loginUser, registerForEvent, rsvpDateUndecided, getSeededEvents, getPendingRequests
- Seeded events are read with getSeededEvents() — returns { fixedEventId, approvalEventId, tbdEventId, organizerUsername, ... }
- Use test.skip() when seeded IDs are missing: if (!s.fixedEventId) test.skip();
- Backend bypass: phone +1XXXXXXXXXX with OTP 000000 logs in automatically
- Do NOT call real external APIs or make up event IDs — use getSeededEvents() or loginUser()
- Timeouts: use 8_000 for page interactions, 3_000–5_000 for negative assertions
- Use expect(...).toBeVisible() not waitForSelector
- Keep tests focused — one behaviour per test case

## Response format (valid JSON only, no markdown wrapper)
{
  "area": "<one of the feature areas above, or a new one if truly needed>",
  "specFile": "<path like specs/rsvp.spec.ts>",
  "isNewFile": false,
  "describeBlock": "<the describe() label to nest under, or null to add at top level>",
  "testTitle": "<the test('...') title>",
  "overview": "<2-4 sentences explaining what this test covers and why it matters>",
  "imports": "<any additional import lines needed beyond what the spec file already imports, or empty string>",
  "code": "<the full test('...', async ({ page }) => { ... }); block as a string>"
}`;

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  // Gather context: existing specs (truncated) + page object signatures
  const existingSpecSamples = Object.entries(AREA_TO_SPEC)
    .map(([area, file]) => {
      const content = readSpec(file);
      // Include first 60 lines as example pattern
      const sample = content.split("\n").slice(0, 60).join("\n");
      return `### ${area} (${file})\n\`\`\`typescript\n${sample}\n...\n\`\`\``;
    })
    .join("\n\n");

  const pageObjectSigs = readPageObjects();

  const userMessage = `Scenario to test:
${prompt}

---
## Existing spec file patterns (first 60 lines each)
${existingSpecSamples}

---
## Available page object methods
\`\`\`typescript
${pageObjectSigs}
\`\`\`

Respond with a single valid JSON object matching the required format. Do not wrap it in markdown.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = (message.content[0] as any).text as string;

    // Strip markdown code fences if Claude wrapped it anyway
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "AI generation failed" }, { status: 500 });
  }
}
