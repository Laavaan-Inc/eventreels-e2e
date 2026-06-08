import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const E2E_ROOT = path.resolve(__dirname, "../../../../../../");

export const dynamic = "force-dynamic";

interface ApprovePayload {
  specFile: string;
  isNewFile: boolean;
  describeBlock: string | null;
  testTitle: string;
  imports: string;
  code: string;
  area: string;
}

const NEW_FILE_TEMPLATE = (area: string, specFile: string, describeBlock: string | null, code: string, imports: string) => {
  const describe = describeBlock ?? area;
  return `/**
 * ${path.basename(specFile)} — ${area} flows (AI-generated)
 */

import { test, expect } from "@playwright/test";
import { getSeededEvents } from "../utils/api-helpers";
${imports ? imports + "\n" : ""}
test.describe("${describe}", () => {
${code.split("\n").map(l => "  " + l).join("\n")}
});
`;
};

export async function POST(req: NextRequest) {
  const body = await req.json() as ApprovePayload;
  const { specFile, isNewFile, describeBlock, code, imports, area } = body;

  if (!specFile || !code) {
    return NextResponse.json({ error: "specFile and code are required" }, { status: 400 });
  }

  const absPath = path.join(E2E_ROOT, specFile);

  // Safety check — only allow writing inside specs/
  if (!absPath.startsWith(path.join(E2E_ROOT, "specs"))) {
    return NextResponse.json({ error: "specFile must be inside specs/" }, { status: 400 });
  }

  if (isNewFile || !fs.existsSync(absPath)) {
    const content = NEW_FILE_TEMPLATE(area, specFile, describeBlock, code, imports);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf-8");
    return NextResponse.json({ ok: true, action: "created", specFile });
  }

  // Append to existing file
  let existing = fs.readFileSync(absPath, "utf-8");

  // Add any new imports that aren't already present
  if (imports?.trim()) {
    const importLines = imports.trim().split("\n").filter(l => l.startsWith("import"));
    for (const line of importLines) {
      const mod = line.match(/from\s+["'](.+?)["']/)?.[1];
      if (mod && !existing.includes(mod)) {
        // Insert after last existing import line
        const lastImportIdx = [...existing.matchAll(/^import .+$/gm)].at(-1);
        if (lastImportIdx) {
          const insertAt = lastImportIdx.index! + lastImportIdx[0].length;
          existing = existing.slice(0, insertAt) + "\n" + line + existing.slice(insertAt);
        }
      }
    }
  }

  if (describeBlock) {
    // Try to insert inside an existing matching describe block
    const describePattern = new RegExp(
      `(test\\.describe\\(['"](${escapeRegex(describeBlock)})['"],[^{]*\\{)`,
      "s"
    );
    const match = describePattern.exec(existing);
    if (match) {
      // Find the closing brace of this describe block (simple brace counting)
      let depth = 0;
      let start = match.index + match[0].length;
      let insertPos = -1;
      for (let i = start; i < existing.length; i++) {
        if (existing[i] === "{") depth++;
        if (existing[i] === "}") {
          if (depth === 0) { insertPos = i; break; }
          depth--;
        }
      }
      if (insertPos !== -1) {
        const indented = code.trim().split("\n").map(l => "  " + l).join("\n");
        existing =
          existing.slice(0, insertPos) +
          "\n\n  " + indented + "\n" +
          existing.slice(insertPos);
        fs.writeFileSync(absPath, existing, "utf-8");
        return NextResponse.json({ ok: true, action: "inserted", specFile });
      }
    }

    // describe block doesn't exist — append a new one at end of file
    const newBlock = `\ntest.describe("${describeBlock}", () => {\n${code.trim().split("\n").map(l => "  " + l).join("\n")}\n});\n`;
    fs.writeFileSync(absPath, existing.trimEnd() + "\n" + newBlock, "utf-8");
    return NextResponse.json({ ok: true, action: "appended-describe", specFile });
  }

  // No describe block — append bare test at end
  fs.writeFileSync(absPath, existing.trimEnd() + "\n\n" + code.trim() + "\n", "utf-8");
  return NextResponse.json({ ok: true, action: "appended", specFile });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
