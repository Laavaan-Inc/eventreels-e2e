"use client";

import { useState } from "react";

interface ExistingCoverage {
  specFile: string;
  area: string;
  describeBlock: string;
  testTitle: string;
  overlap: string;
  gap: string;
}

interface GeneratedTest {
  area: string;
  specFile: string;
  isNewFile: boolean;
  describeBlock: string | null;
  testTitle: string;
  overview: string;
  imports: string;
  code: string;
  coverageVerdict: "exact" | "partial" | "none";
  existingCoverage: ExistingCoverage[];
}

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

type Step = "prompt" | "review" | "done";

const VERDICT_CONFIG = {
  exact: {
    icon: "🟡",
    label: "Already covered",
    desc: "An existing test covers this scenario fully. You probably don't need to add a new one.",
    banner: "bg-yellow-950/50 border-yellow-700 text-yellow-300",
  },
  partial: {
    icon: "🔵",
    label: "Partially covered",
    desc: "Existing tests touch this area but don't cover all the behaviour you described.",
    banner: "bg-blue-950/50 border-blue-700 text-blue-300",
  },
  none: {
    icon: "🟢",
    label: "Not yet covered",
    desc: "No existing test covers this scenario. The generated test fills a real gap.",
    banner: "bg-green-950/50 border-green-700 text-green-300",
  },
};

export default function AddTestModal({ onClose, onAdded }: Props) {
  const [step,        setStep]       = useState<Step>("prompt");
  const [prompt,      setPrompt]     = useState("");
  const [loading,     setLoading]    = useState(false);
  const [generated,   setGenerated]  = useState<GeneratedTest | null>(null);
  const [error,       setError]      = useState<string | null>(null);
  const [approving,   setApproving]  = useState(false);
  const [editCode,    setEditCode]   = useState("");
  const [coverageOpen, setCoverageOpen] = useState(true);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Generation failed");
      setGenerated(data);
      setEditCode(data.code);
      setStep("review");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!generated) return;
    setApproving(true);
    try {
      const res = await fetch("/api/ai-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...generated, code: editCode }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to save");
      setStep("done");
      setTimeout(() => { onAdded(); onClose(); }, 1_500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  }

  const verdict = generated?.coverageVerdict ? VERDICT_CONFIG[generated.coverageVerdict] : null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">✨</span>
            <div>
              <p className="text-sm font-semibold text-white">Add Test Case with AI</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === "prompt" && "Describe the scenario — AI will check for existing coverage first"}
                {step === "review" && "Review coverage analysis and generated test, then approve"}
                {step === "done"   && "Test case added successfully"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* steps */}
        <div className="px-6 pt-4 shrink-0 flex items-center gap-2">
          {(["prompt", "review", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? "bg-indigo-600 text-white" :
                (step === "review" || step === "done") && s === "prompt" ? "bg-green-600 text-white" :
                step === "done" && s === "review" ? "bg-green-600 text-white" :
                "bg-gray-800 text-gray-500"
              }`}>
                {((step === "review" || step === "done") && s === "prompt") || (step === "done" && s === "review")
                  ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${step === s ? "text-white" : "text-gray-500"}`}>
                {s === "prompt" ? "Describe" : s === "review" ? "Review" : "Done"}
              </span>
              {i < 2 && <div className="w-6 h-px bg-gray-800 mx-1" />}
            </div>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── Step 1: Prompt ── */}
          {step === "prompt" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-2">
                  Describe the test scenario
                </label>
                <textarea
                  autoFocus
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                  placeholder={`Example:\n"Organizer creates a private event with approval required. A guest requests to join. The organizer sees the pending request and approves it. The guest then appears in the confirmed guests list."`}
                  className="w-full h-52 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-gray-600 mt-1.5">Tip: ⌘+Enter to generate · AI will check existing tests for overlap</p>
              </div>

              {error && (
                <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-start gap-3 flex-wrap">
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
                >
                  {loading ? (
                    <><Spinner /> Analysing &amp; generating…</>
                  ) : (
                    <><span>✨</span> Generate test case</>
                  )}
                </button>
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-gray-600">Try:</span>
                  {[
                    "Guest cancels their RSVP on a free event",
                    "Organizer sets an event password and a guest uses it to join",
                    "Profile Hosting tab shows the correct hosted event count",
                  ].map(ex => (
                    <button
                      key={ex}
                      onClick={() => setPrompt(ex)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Review ── */}
          {step === "review" && generated && (
            <>
              {/* ── Coverage verdict banner ── */}
              {verdict && (
                <div className={`rounded-xl border px-4 py-3 ${verdict.banner}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{verdict.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wide">{verdict.label}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{verdict.desc}</p>
                </div>
              )}

              {/* ── Existing coverage map ── */}
              {generated.existingCoverage?.length > 0 && (
                <div className="rounded-xl border border-gray-800 overflow-hidden">
                  <button
                    onClick={() => setCoverageOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🗺️</span>
                      <span className="text-xs font-semibold text-gray-300">
                        Existing coverage ({generated.existingCoverage.length} related test{generated.existingCoverage.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <span className="text-gray-600 text-xs">{coverageOpen ? "▲" : "▼"}</span>
                  </button>

                  {coverageOpen && (
                    <div className="divide-y divide-gray-800/50">
                      {generated.existingCoverage.map((c, i) => (
                        <div key={i} className="px-4 py-3 bg-gray-900/20">
                          {/* test path */}
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-gray-600 text-xs mt-0.5 shrink-0">
                              {generated.coverageVerdict === "exact" ? "✅" : "⚡"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-mono text-indigo-400 truncate">
                                {c.specFile}
                              </p>
                              <p className="text-xs text-gray-300 mt-0.5 leading-snug">
                                <span className="text-gray-500">{c.describeBlock} › </span>
                                {c.testTitle}
                              </p>
                            </div>
                          </div>
                          {/* overlap + gap */}
                          <div className="pl-5 space-y-1">
                            <p className="text-xs text-gray-400 leading-relaxed">
                              <span className="text-green-500 font-medium">Covers: </span>
                              {c.overlap}
                            </p>
                            {c.gap && (
                              <p className="text-xs text-gray-400 leading-relaxed">
                                <span className="text-yellow-500 font-medium">Gap: </span>
                                {c.gap}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {generated.existingCoverage?.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                  <span>🟢</span> No existing tests overlap with this scenario.
                </div>
              )}

              {/* ── Destination ── */}
              <div className="flex items-center gap-2 flex-wrap">
                <Chip icon="📁" label={generated.area} color="indigo" />
                <Chip icon="📄" label={generated.specFile} color="gray" />
                {generated.describeBlock && <Chip icon="🔤" label={generated.describeBlock} color="gray" />}
                {generated.isNewFile && <Chip icon="🆕" label="New file" color="yellow" />}
              </div>

              {/* ── Test title ── */}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">New test name</p>
                <p className="text-sm text-white font-medium">
                  {generated.describeBlock ? <span className="text-gray-500">{generated.describeBlock} › </span> : null}
                  {generated.testTitle}
                </p>
              </div>

              {/* ── Overview ── */}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-2">What this covers</p>
                <p className="text-sm text-gray-300 leading-relaxed">{generated.overview}</p>
              </div>

              {/* ── Editable code ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Test code</p>
                  <p className="text-xs text-gray-600">Edit before approving if needed</p>
                </div>
                <textarea
                  value={editCode}
                  onChange={e => setEditCode(e.target.value)}
                  className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 font-mono text-xs text-gray-300 resize-none focus:outline-none focus:border-indigo-500 leading-5"
                  spellCheck={false}
                />
              </div>

              {error && (
                <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full bg-green-600/20 flex items-center justify-center text-3xl">✅</div>
              <p className="text-white font-semibold">Test case added!</p>
              <p className="text-sm text-gray-500">
                Appended to <span className="text-gray-300 font-mono">{generated?.specFile}</span>
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-800 shrink-0 flex items-center justify-between">
          {step === "review" ? (
            <>
              <button
                onClick={() => { setStep("prompt"); setGenerated(null); setError(null); }}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
              >
                ← Re-describe
              </button>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  Discard
                </button>
                {generated?.coverageVerdict === "exact" ? (
                  <button
                    onClick={handleApprove}
                    disabled={approving || !editCode.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 text-sm text-white font-medium transition-colors"
                  >
                    {approving ? <><Spinner /> Saving…</> : <>⚠️ Add anyway</>}
                  </button>
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={approving || !editCode.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-sm text-white font-medium transition-colors"
                  >
                    {approving ? <><Spinner /> Saving…</> : <>✅ Approve &amp; add to spec</>}
                  </button>
                )}
              </div>
            </>
          ) : step === "prompt" ? (
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors">
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />;
}

function Chip({ icon, label, color }: { icon: string; label: string; color: "indigo" | "gray" | "yellow" }) {
  const cls = {
    indigo: "bg-indigo-900/50 text-indigo-300 border-indigo-700",
    gray:   "bg-gray-800 text-gray-400 border-gray-700",
    yellow: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}
