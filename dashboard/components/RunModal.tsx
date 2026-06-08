"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  spec?: string;
  test?: string;
  label: string;
  onClose: () => void;
}

export default function RunModal({ spec, test: testName, label, onClose }: Props) {
  const [lines,      setLines]      = useState<string[]>([]);
  const [done,       setDone]       = useState(false);
  const [exit,       setExit]       = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [headed,     setHeaded]     = useState(true);
  const [started,    setStarted]    = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const esRef       = useRef<EventSource | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const es = new EventSource(`/api/run/stream?${params.toString()}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const line = JSON.parse(e.data) as string;
      if (line.startsWith("__EXIT__:")) {
        setExit(parseInt(line.split(":")[1], 10));
        setDone(true);
        es.close();
        stopPolling();
      } else {
        setLines((prev) => [...prev, line]);
      }
    };
    es.onerror = () => { setDone(true); es.close(); stopPolling(); };

    // Poll for live screenshot every 800ms while running
    // (works headed OR headless — Playwright writes the file directly)
    let lastUpdatedAt = 0;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/screenshot");
        if (res.ok) {
          const { image, updatedAt } = await res.json();
          if (image && updatedAt !== lastUpdatedAt) {
            lastUpdatedAt = updatedAt;
            setScreenshot(image);
          }
        }
      } catch {}
    }, 800);
  }, [spec, testName, headed, stopPolling]);

  useEffect(() => {
    return () => {
      esRef.current?.close();
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const passed = exit === 0;

  // ── Pre-start config screen ──────────────────────────────────────────────
  if (!started) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl w-full max-w-md flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">Configure run options</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-5 flex flex-col gap-4">
            {/* Headed toggle */}
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <p className="text-sm text-white font-medium">Show browser (headed mode)</p>
                <p className="text-xs text-gray-500 mt-0.5">Opens a visible browser — enables live emulator view in the panel</p>
              </div>
              <button
                role="switch"
                aria-checked={headed}
                onClick={() => setHeaded(h => !h)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${headed ? "bg-indigo-600" : "bg-gray-700"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${headed ? "translate-x-5" : "translate-x-0"}`} />
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

  // ── Running / done screen ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-950 border border-gray-800 rounded-xl flex flex-col ${headed ? "w-full max-w-6xl" : "w-full max-w-3xl"} max-h-[90vh]`}>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            {done && (
              <p className={`text-xs mt-0.5 ${passed ? "text-green-400" : "text-red-400"}`}>
                {passed ? "All tests passed" : "Tests failed"}
              </p>
            )}
            {!done && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Running{headed ? " — live view active" : ""}…
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* body — split pane when headed */}
        <div className={`flex-1 overflow-hidden flex ${headed ? "flex-row" : "flex-col"} min-h-0`}>

          {/* terminal */}
          <div className={`${headed ? "w-[42%] border-r border-gray-800" : "flex-1"} flex flex-col overflow-hidden`}>
            <div className="px-3 py-2 bg-gray-900/60 border-b border-gray-800 shrink-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Terminal output</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-300 bg-gray-950">
              {lines.length === 0 && !done && (
                <p className="text-gray-500 animate-pulse">Starting test run…</p>
              )}
              {lines.map((line, i) => (
                <div key={i} className={`leading-5 whitespace-pre-wrap ${
                  /\bfailed\b/i.test(line) ? "text-red-400" :
                  /\bpassed\b/i.test(line) ? "text-green-400" :
                  /\bskipped\b/i.test(line) ? "text-yellow-400" : ""
                }`}>
                  {line}
                </div>
              ))}
              {done && (
                <div className={`mt-2 font-bold ${passed ? "text-green-400" : "text-red-400"}`}>
                  ─── Exited with code {exit} ───
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* live browser view */}
          {headed && (
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
              <div className="px-3 py-2 bg-gray-900/60 border-b border-gray-800 shrink-0 flex items-center justify-between">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Live browser view</p>
                {!done && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    Live
                  </span>
                )}
                {done && (
                  <span className="text-[10px] text-gray-500">Final state</span>
                )}
              </div>

              <div className="flex-1 overflow-hidden flex items-center justify-center bg-gray-950 p-3">
                {screenshot ? (
                  <img
                    src={screenshot}
                    alt="Live browser"
                    className="max-w-full max-h-full object-contain rounded-lg border border-gray-800 shadow-2xl"
                    style={{ imageRendering: "auto" }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-600">
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center text-2xl">
                      🖥️
                    </div>
                    <p className="text-xs text-center">
                      {done ? "No screenshot captured" : "Waiting for browser to open…"}
                    </p>
                    <p className="text-[10px] text-gray-700 text-center max-w-40">
                      Make sure Screen Recording permission is granted to Terminal in System Settings
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-gray-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
