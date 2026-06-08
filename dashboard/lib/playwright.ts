import fs from "fs";
import path from "path";

const E2E_ROOT = path.resolve(process.cwd(), "..");
const SPECS_DIR = path.join(E2E_ROOT, "specs");

const SPEC_FILES = [
  "auth.spec.ts",
  "event-types.spec.ts",
  "rsvp.spec.ts",
  "date-undecided.spec.ts",
  "manage-guests.spec.ts",
  "profile.spec.ts",
  "check-in.spec.ts",
];

/**
 * Parse a spec file and extract all test titles with their describe context.
 * Returns [specFile, fullTitle] pairs.
 */
function parseSpec(specFile: string): [string, string][] {
  const absPath = path.join(SPECS_DIR, specFile);
  if (!fs.existsSync(absPath)) return [];

  const src = fs.readFileSync(absPath, "utf-8");
  const results: [string, string][] = [];

  // Stack of describe labels we're currently inside
  const describeStack: string[] = [];
  // Brace depth tracking per describe frame
  const braceDepth: number[] = [];
  let currentDepth = 0;

  // Tokenise line by line so we can track brace depth accurately
  const lines = src.split("\n");

  for (const line of lines) {
    // Count brace delta for this line (rough but reliable enough for test files)
    for (const ch of line) {
      if (ch === "{") {
        currentDepth++;
      } else if (ch === "}") {
        currentDepth--;
        // Pop any describe frames that ended at this depth
        while (
          braceDepth.length > 0 &&
          currentDepth < braceDepth[braceDepth.length - 1]
        ) {
          braceDepth.pop();
          describeStack.pop();
        }
      }
    }

    // Detect test.describe("label", ...) or test.describe.only/skip
    const describeMatch = line.match(
      /test\.describe(?:\.only|\.skip)?\s*\(\s*["'`](.+?)["'`]/
    );
    if (describeMatch) {
      describeStack.push(describeMatch[1]);
      braceDepth.push(currentDepth);
      continue;
    }

    // Detect test("title", ...) or test.only/test.skip
    const testMatch = line.match(
      /^\s*test(?:\.only|\.skip)?\s*\(\s*["'`](.+?)["'`]/
    );
    if (testMatch) {
      const title =
        describeStack.length > 0
          ? `${describeStack.join(" > ")} > ${testMatch[1]}`
          : testMatch[1];
      results.push([`specs/${specFile}`, title]);
    }
  }

  return results;
}

export function listTests(): [string, string][] {
  const all: [string, string][] = [];

  // Always check for new spec files beyond the known list
  let files = SPEC_FILES;
  try {
    const found = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith(".spec.ts"));
    // Merge: known order first, then any extras
    const extras = found.filter(f => !SPEC_FILES.includes(f));
    files = [...SPEC_FILES.filter(f => found.includes(f)), ...extras];
  } catch {
    // SPECS_DIR unreadable — use known list
  }

  for (const specFile of files) {
    all.push(...parseSpec(specFile));
  }

  return all;
}
