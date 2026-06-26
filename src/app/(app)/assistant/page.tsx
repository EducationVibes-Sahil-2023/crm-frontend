"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { getUser } from "@/lib/auth";
import { ask, SUGGESTIONS, type ApiMessage } from "@/lib/ai";

type Turn = { role: "user" | "assistant"; text: string };

export default function AssistantPage() {
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const firstName = getUser()?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, status]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    setStatus("Thinking…");

    const next: ApiMessage[] = [...history, { role: "user", content: q }];
    try {
      const { messages, text: answer } = await ask(next, (e) => setStatus(e.label + "…"));
      setHistory(messages);
      setTurns((t) => [...t, { role: "assistant", text: answer }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* Hero header */}
      <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-5 text-white shadow-lg shadow-indigo-600/20">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_15%,white,transparent_45%)]" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
            <Icon name="ai" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Nexus AI Assistant</h1>
            <p className="text-sm text-indigo-100">Ask about leads, HRMS, inventory & tasks — it reads your live data.</p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto pb-2">
        {turns.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Icon name="ai" className="h-6 w-6" />
            </span>
            <p className="text-base font-semibold text-slate-800">Hi {firstName} 👋</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              I can summarise your pipeline, flag low stock, surface pending HR approvals and more. Try one of these:
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">
                <p className="whitespace-pre-wrap break-words">{t.text}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                <Icon name="ai" className="h-4 w-4" />
              </span>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
                <p className="whitespace-pre-wrap break-words">{t.text}</p>
              </div>
            </div>
          ),
        )}

        {status && (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Icon name="ai" className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500 shadow-sm">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
              </span>
              {status}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="mt-2 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask Nexus AI anything about your data…"
          className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          <Icon name="send" className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-center text-[11px] text-slate-400">
        Nexus AI can read your leads, HR, inventory and tasks. Verify important figures before acting.
      </p>
    </div>
  );
}
