"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { DOCS, DOC_CATEGORIES, type DocArticle } from "@/lib/docs";

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(DOCS[0].id);
  const [mobileReading, setMobileReading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOCS;
    return DOCS.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.intro.toLowerCase().includes(q) ||
        d.steps.some((s) => s.toLowerCase().includes(q)),
    );
  }, [query]);

  const active = DOCS.find((d) => d.id === activeId) ?? filtered[0] ?? DOCS[0];

  const grouped = useMemo(() => {
    return DOC_CATEGORIES.map((cat) => ({
      cat,
      items: filtered.filter((d) => d.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  function open(d: DocArticle) {
    setActiveId(d.id);
    setMobileReading(true);
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="knowledge" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Knowledge Base</h1>
              <p className="mt-0.5 text-sm text-blue-100">
                User manual — how every module works and how to use this software.
              </p>
            </div>
          </div>
          <div className="relative mt-5 max-w-lg">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the manual…"
              className="w-full rounded-xl border-0 bg-white/15 py-2.5 pl-10 pr-3 text-sm text-white outline-none ring-1 ring-white/20 backdrop-blur placeholder:text-white/60 focus:bg-white/25 focus:ring-2 focus:ring-white/40"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Article list */}
        <aside className={`${mobileReading ? "hidden" : "block"} lg:block`}>
          <div className="no-scrollbar max-h-[70vh] space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {grouped.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-slate-400">No articles match “{query}”.</p>
            )}
            {grouped.map((g) => (
              <div key={g.cat}>
                <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.cat}</p>
                <ul className="space-y-1">
                  {g.items.map((d) => {
                    const isActive = d.id === active.id;
                    return (
                      <li key={d.id}>
                        <button
                          onClick={() => open(d)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                            isActive ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Icon name={d.icon} className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                          <span className="truncate">{d.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Reader */}
        <article className={`${mobileReading ? "block" : "hidden"} lg:block`}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <button
              onClick={() => setMobileReading(false)}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-blue-600 lg:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>
              All articles
            </button>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Icon name={active.icon} className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{active.category}</span>
                <h2 className="text-xl font-bold text-slate-900">{active.title}</h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-slate-600">{active.intro}</p>

            <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-slate-400">How to use it</h3>
            <ol className="mt-3 space-y-3">
              {active.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-slate-700">{s}</span>
                </li>
              ))}
            </ol>

            {active.tips && active.tips.length > 0 && (
              <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <Icon name="bell" className="h-4 w-4" /> Good to know
                </p>
                <ul className="space-y-1.5">
                  {active.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-amber-900/90">
                      <span className="text-amber-500">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
