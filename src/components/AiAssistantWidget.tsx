"use client";

// Floating "Ask Nexus AI" copilot — available on every in-app page for every
// role. It embeds the same agent as the /assistant page (lib/ai.ts → Groq relay)
// but adapts its greeting, suggestions and a role note to *who* is asking:
//   - Super Admin  → platform guidance (clients, subscriptions, settings)
//   - Admin/Owner  → workspace guidance (pipeline, HR, inventory, team)
//   - Staff user   → their day-to-day work (leads, follow-ups, tasks)
//
// The messaging ChatWidget owns the very corner; this launcher stacks above it.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { getUser } from "@/lib/auth";
import { ask, type ApiMessage } from "@/lib/ai";

type Turn = { role: "user" | "assistant"; text: string };
type Audience = "super" | "admin" | "user";

function audienceOf(role?: string): Audience {
  const r = (role ?? "").toLowerCase();
  if (r.includes("super")) return "super";
  if (r === "administrator" || r.includes("admin") || r.includes("owner")) return "admin";
  return "user";
}

const PROFILES: Record<
  Audience,
  { tag: string; systemExtra: string; suggestions: string[] }
> = {
  super: {
    tag: "Platform admin",
    systemExtra:
      "The current user is the Super Administrator (platform owner). Frame guidance around running the platform: managing client workspaces, subscriptions, plans and platform-wide settings, as well as the underlying CRM/HRMS data.",
    suggestions: [
      "Give me a platform overview",
      "Which clients need attention?",
      "Summarise overall pipeline health",
    ],
  },
  admin: {
    tag: "Workspace admin",
    systemExtra:
      "The current user is a workspace administrator/owner. Frame guidance around running their business: pipeline health, HR approvals, inventory, payroll and team performance. Offer to summarise and flag anything needing action.",
    suggestions: [
      "How is my business doing today?",
      "Any pending HR approvals?",
      "What inventory needs reordering?",
    ],
  },
  user: {
    tag: "My assistant",
    systemExtra:
      "The current user is a staff member. Frame guidance around their day-to-day work: their leads, follow-ups due, and open tasks. Keep answers practical and action-oriented.",
    suggestions: [
      "What should I follow up on?",
      "Show my open tasks",
      "How many leads are in Follow Up?",
    ],
  },
};

export default function AiAssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>("user");
  const [firstName, setFirstName] = useState("there");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getUser();
    setAudience(audienceOf(u?.role));
    setFirstName(u?.name?.split(" ")[0] ?? "there");
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, status, open]);

  // The full-page assistant is its own surface; don't double up there.
  if (pathname?.startsWith("/assistant")) return null;

  const profile = PROFILES[audience];

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
      const { messages, text: answer } = await ask(
        next,
        (e) => setStatus(e.label + "…"),
        profile.systemExtra,
      );
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
    <div className="fixed bottom-36 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-24 lg:right-6">
      {/* Panel */}
      {open && (
        <div className="flex h-[540px] max-h-[72vh] w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="relative flex items-center justify-between bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-3.5 text-white">
            <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%)]" />
            <div className="relative flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
                <Icon name="ai" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight">Nexus AI</p>
                <p className="text-[11px] text-indigo-100">{profile.tag} · reads your live data</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="relative rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white">
              <Icon name="chevronDown" className="h-5 w-5" />
            </button>
          </div>

          {/* Conversation */}
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {turns.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Icon name="ai" className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-slate-800">Hi {firstName} 👋</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                  Ask me anything about your data — I&apos;ll look it up and explain. Try:
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {profile.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
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
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-sm text-white shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{t.text}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                    <Icon name="ai" className="h-3.5 w-3.5" />
                  </span>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{t.text}</p>
                  </div>
                </div>
              ),
            )}

            {status && (
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Icon name="ai" className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-500 shadow-sm">
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
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">{error}</div>
            )}

            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-2.5">
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
              placeholder="Ask Nexus AI…"
              className="max-h-24 flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              <Icon name="send" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Nexus AI"
          className="group flex items-center gap-2 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 py-3 pl-3 pr-4 text-white shadow-lg shadow-indigo-600/30 transition hover:scale-105 active:scale-95"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
            <Icon name="ai" className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      )}
    </div>
  );
}
