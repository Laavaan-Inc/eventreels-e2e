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

function readAllSpecs(): string {
  return Object.entries(AREA_TO_SPEC)
    .map(([area, file]) => {
      const content = readSpec(file);
      return `### ${area} (${file})\n\`\`\`typescript\n${content}\n\`\`\``;
    })
    .join("\n\n");
}

function readPageObjects(): string {
  const poDir = path.join(E2E_ROOT, "page-objects");
  const files = fs.readdirSync(poDir).filter(f => f.endsWith(".ts"));
  return files.map(f => {
    const content = fs.readFileSync(path.join(poDir, f), "utf-8");
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

Your job: given a test scenario description from the QA engineer, analyse the full existing test suite and produce a structured JSON response.

## Available feature areas and spec files
${Object.entries(AREA_TO_SPEC).map(([k, v]) => `- ${k} → ${v}`).join("\n")}

## Project conventions
- Tests use page objects from ../page-objects/ (ManageEventPage, EventPage, AuthPage, ProfilePage, CheckInPage, CreateEventPage)
- API helpers from ../utils/api-helpers.ts: loginUser, registerForEvent, rsvpDateUndecided, getSeededEvents, getPendingRequests
- Seeded events: getSeededEvents() → { fixedEventId, approvalEventId, tbdEventId, organizerUsername, ... }
- Guard missing IDs: if (!s.fixedEventId) test.skip();
- Backend bypass OTP: phone +1XXXXXXXXXX with code 000000
- Do NOT use real external APIs or hard-coded event IDs
- Timeouts: 8_000 for interactions, 3_000–5_000 for negative assertions
- Use expect(...).toBeVisible(), not waitForSelector
- Keep tests focused — one behaviour per test case

## Coverage overlap classification
- "exact"   — an existing test already covers this scenario fully; no new test needed
- "partial" — an existing test touches this area but doesn't cover all the described behaviour
- "none"    — no existing test covers this scenario

## Response format (valid JSON only — no markdown wrapper)
{
  "area": "<feature area>",
  "specFile": "<specs/xxx.spec.ts>",
  "isNewFile": false,
  "describeBlock": "<describe label or null>",
  "testTitle": "<test title>",
  "overview": "<2-4 sentences: what this tests and why it matters>",
  "imports": "<any new import lines needed, or empty string>",
  "code": "<the full test('...', async ({ page }) => { ... }); block>",
  "coverageVerdict": "exact|partial|none",
  "existingCoverage": [
    {
      "specFile": "<specs/xxx.spec.ts>",
      "area": "<area>",
      "describeBlock": "<describe label>",
      "testTitle": "<existing test title>",
      "overlap": "<one sentence: what aspect of the requested scenario this test already covers>",
      "gap": "<one sentence: what it does NOT cover that the new scenario requires, or empty string if exact match>"
    }
  ]
}

Rules for existingCoverage:
- Always populate this array — include ALL tests that have any behavioural overlap with the scenario, even partial
- If there is truly no overlap at all, return an empty array []
- Be precise about gaps — 'gap' should state the specific missing behaviour, not just say "doesn't cover everything"
- If coverageVerdict is "exact", still list the matching test(s) so the user can navigate to them`;

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const allSpecs      = readAllSpecs();
  const pageObjectSigs = readPageObjects();

  const userMessage = `Scenario to test:
${prompt}

---
## Full existing test suite
${allSpecs}

---
## Available page object methods
\`\`\`typescript
${pageObjectSigs}
\`\`\`

Analyse the existing suite for overlap with the described scenario, then respond with a single valid JSON object. Do not wrap it in markdown.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = (message.content[0] as any).text as string;
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
