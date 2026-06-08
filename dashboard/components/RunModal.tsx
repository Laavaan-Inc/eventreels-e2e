"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  spec?: string;
  test?: string;
  label: string;
  onClose: () => void;
}

export default function RunModal({ spec, test: testName, label, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [done,  setDone]  = useState(false);
  const [exit,  setExit]  = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (spec)     params.set("spec", spec);
    if (testName) params.set("test", testName);

    const es = new EventSource(`/api/run/stream?${params.toString()}`);
    es.onmessage = (e) => {
      const line = JSON.parse(e.data) as string;
      if (line.startsWith("__EXIT__:")) {
        setExit(parseInt(line.split(":")[1], 10));
        setDone(true);
        es.close();
      } else {
        setLines((prev) => [...prev, line]);
      }
    };
    es.onerror = () => { setDone(true); es.close(); };
    return () => es.close();
  }, [spec, testName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const passed = exit === 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-xl w-full max-w-3xl flex flex-col max-h-[85vh]">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            {done && (
              <p className={`text-xs mt-0.5 ${passed ? "text-green-400" : "text-red-400"}`}>
                {passed ? "All tests passed" : "Tests failed"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* terminal */}
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
