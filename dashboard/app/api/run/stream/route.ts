import { NextRequest } from "next/server";
import { spawn }       from "child_process";
import path            from "path";

const E2E_ROOT = path.resolve(process.cwd(), "..");

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spec     = searchParams.get("spec")  ?? undefined;
  const testName = searchParams.get("test")  ?? undefined;

  const headed = searchParams.get("headed") === "true";
  const args = ["playwright", "test", "--reporter=line"];
  if (headed)   args.push("--headed");
  if (spec)     args.push(spec);
  if (testName) args.push("--grep", testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn("npx", args, { cwd: E2E_ROOT, shell: false });

      const send = (line: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
      };

      child.stdout.on("data", (d) => d.toString().split("\n").forEach((l: string) => l && send(l)));
      child.stderr.on("data", (d) => d.toString().split("\n").forEach((l: string) => l && send(l)));

      child.on("exit", (code) => {
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
