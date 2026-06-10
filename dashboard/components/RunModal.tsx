"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  spec?: string;
  test?: string;
  label: string;
  env?: "local" | "dev";
  onClose: () => void;
  onDone?: () => void;
}

export default function RunModal({ spec, test: testName, label, env = "dev", onClose, onDone }: Props) {
  const [lines,      setLines]      = useState<string[]>([]);
  const [done,       setDone]       = useState(false);
  const [exit,       setExit]       = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [headed,     setHeaded]     = useState(false);
  const [started,    setStarted]    = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const esRef      = useRef<EventSource | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startRun = useCallback(() => {
    setStarted(true);
    setLines([]);
    setDone(false);
    setExit(null);
    setScreenshot(null);

    const params = new URLSearchParams();
    if (spec)     params.set("spec", spec);
    if (testName) params.set("test", testName);
    if (headed)   params.set("headed", "true");
    params.set("env", env);

    const es = new EventSource(`/api/run/stream?${params.toString()}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const line = JSON.parse(e.data) as string;
      if (line.startsWith("__EXIT__:")) {
        setExit(parseInt(line.split(":")[1], 10));
        setDone(true);
        es.close();
        stopPolling();
        onDone?.();
      } else {
        setLines((prev) => [...prev, line]);
      }
    };
    es.onerror = () => { setDone(true); es.close(); stopPolling(); };

    // Clear any stale screenshot from a previous run
    fetch("/api/screenshot/clear", { method: "POST" }).catch(() => {});

    // Poll for live screenshot at 300ms — fixture writes every 400ms
    let lastUpdatedAt = 0;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/screenshot?t=${Date.now()}`);
        if (res.ok) {
          const { image, updatedAt } = await res.json();
          if (image && updatedAt !== lastUpdatedAt) {
            lastUpdatedAt = updatedAt;
            setScreenshot(image);
          }
        }
      } catch {}
    }, 300);
  }, [spec, testName, headed, env, stopPolling]);

  useEffect(() => () => { esRef.current?.close(); stopPolling(); }, [stopPolling]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const passed = exit === 0;

  // ── Pre-run options ──────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-sm flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">Run options</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white font-medium">Show browser window</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Watch Playwright drive the app step by step
                </p>
              </div>
              <button
                role="switch"
                aria-checked={headed}
                onClick={() => setHeaded(h => !h)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${headed ? "bg-indigo-600" : "bg-gray-700"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${headed ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>
          </div>

          <div className="px-5 pb-5 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors">
              Cancel
            </button>
            <button
              onClick={startRun}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors"
            >
              ▶ Start run
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Live run view ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-7xl flex flex-col" style={{ height: "90vh" }}>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            {!done ? (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            ) : (
              <span className={`text-sm ${passed ? "text-green-400" : "text-red-400"}`}>
                {passed ? "✓" : "✗"}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className={`text-xs mt-0.5 ${done ? (passed ? "text-green-400" : "text-red-400") : "text-gray-500"}`}>
                {done ? (passed ? "All tests passed" : "Tests failed") : "Running…"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* split pane: browser left (big), terminal right (narrow) */}
        <div className="flex-1 overflow-hidden flex flex-row min-h-0">

          {/* ── Live browser panel (main, left) ── */}
          <div className="flex-1 flex flex-col border-r border-gray-800 overflow-hidden bg-gray-950">
            {/* browser chrome bar */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 mx-3 bg-gray-800 rounded px-3 py-1 text-xs text-gray-400 font-mono truncate">
                {env === "dev" ? "dev.eventreels.com" : "localhost:3000"}
              </div>
              {!done && (
                <span className="flex items-center gap-1 text-[10px] text-green-400 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Live
                </span>
              )}
            </div>

            {/* screenshot viewport */}
            <div className="flex-1 overflow-hidden flex items-start justify-center bg-white">
              {screenshot ? (
                <img
                  src={screenshot}
                  alt="Live app view"
                  className="w-full h-full object-contain object-top"
                  style={{ imageRendering: "auto" }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">
                    🖥️
                  </div>
                  <p className="text-sm text-gray-500">
                    {done ? "No screenshot captured" : "Waiting for test to start…"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Terminal panel (right, narrow) ── */}
          <div className="w-80 shrink-0 flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-800 shrink-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Test output</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5 text-gray-400 bg-gray-950">
              {lines.length === 0 && !done && (
                <p className="text-gray-600 animate-pulse">Starting…</p>
              )}
              {lines.map((line, i) => (
                <div key={i} className={`whitespace-pre-wrap break-all ${
                  /\bfailed\b/i.test(line)  ? "text-red-400"    :
                  /\bpassed\b/i.test(line)  ? "text-green-400"  :
                  /\bskipped\b/i.test(line) ? "text-yellow-400" :
                  /^\s*✓|√/.test(line)      ? "text-green-400"  : ""
                }`}>
                  {line}
                </div>
              ))}
              {done && (
                <div className={`mt-2 font-bold ${passed ? "text-green-400" : "text-red-400"}`}>
                  ── exit {exit} ──
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-gray-800 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
