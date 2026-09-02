"use client";

// The client-facing manual. Two sources, one screen:
//
//   Modules — the per-module manual (lib/docsManual.ts), including the
//             screenshots and walkthrough videos the platform owner publishes
//             from Super Admin → Documentation. Media is pinned per step, so it
//             appears exactly where it is relevant.
//   Guides  — the older narrative articles (lib/docs.ts), kept for the
//             conceptual pieces that aren't tied to a single screen.
//
// The demo scripts and private notes attached to each module are deliberately
// NOT rendered here — they're the platform owner's, not the client's.

import { useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { DOCS, DOC_CATEGORIES, type DocArticle } from "@/lib/docs";
import { MANUAL, manualByCategory, manualHaystack, type ManualModule } from "@/lib/docsManual";
import { assetSrc, embedUrl, useDocsMedia, type DocAsset } from "@/lib/docsMedia";

type Mode = "modules" | "guides";

/** The owner's own console isn't part of a client's manual. */
const CLIENT_MODULES = MANUAL.filter((m) => m.category !== "Platform (Super Admin)");

export default function KnowledgeBasePage() {
  const [mode, setMode] = useState<Mode>("modules");
  const [query, setQuery] = useState("");
  const [moduleKey, setModuleKey] = useState(CLIENT_MODULES[0].key);
  const [articleId, setArticleId] = useState(DOCS[0].id);
  const [mobileReading, setMobileReading] = useState(false);
  const { media } = useDocsMedia();

  const q = query.trim().toLowerCase();

  const modules = useMemo(
    () => (q ? CLIENT_MODULES.filter((m) => manualHaystack(m).includes(q)) : CLIENT_MODULES),
    [q],
  );

  const articles = useMemo(() => {
    if (!q) return DOCS;
    return DOCS.filter((d) =>
      [
        d.title, d.summary, d.intro, d.audience ?? "", d.whatItDoes ?? "",
        ...d.steps, ...(d.features ?? []), ...(d.tips ?? []),
        ...(d.faqs?.flatMap((f) => [f.q, f.a]) ?? []),
      ].join(" ").toLowerCase().includes(q),
    );
  }, [q]);

  const moduleGroups = useMemo(() => manualByCategory(modules), [modules]);
  const articleGroups = useMemo(
    () => DOC_CATEGORIES.map((cat) => ({ cat, items: articles.filter((d) => d.category === cat) })).filter((g) => g.items.length > 0),
    [articles],
  );

  const activeModule = CLIENT_MODULES.find((m) => m.key === moduleKey) ?? modules[0] ?? CLIENT_MODULES[0];
  const activeArticle = DOCS.find((d) => d.id === articleId) ?? articles[0] ?? DOCS[0];

  const assetsFor = (step: number) =>
    media.assets
      .filter((a) => a.module === activeModule.key && a.step === step)
      .sort((a, b) => a.order - b.order);

  const mediaCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of media.assets) map.set(a.module, (map.get(a.module) ?? 0) + 1);
    return map;
  }, [media.assets]);

  const empty = mode === "modules" ? moduleGroups.length === 0 : articleGroups.length === 0;

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
                The full manual — every module explained, with screenshots and walkthrough videos.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 sm:max-w-lg">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the manual…"
                className="w-full rounded-xl border-0 bg-white/15 py-2.5 pl-10 pr-3 text-sm text-white outline-none ring-1 ring-white/20 backdrop-blur placeholder:text-white/60 focus:bg-white/25 focus:ring-2 focus:ring-white/40"
              />
            </div>
            <div className="flex rounded-xl bg-white/15 p-1 ring-1 ring-white/20 backdrop-blur">
              {(["modules", "guides"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setMobileReading(false); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    mode === m ? "bg-white text-blue-700" : "text-white/80 hover:text-white"
                  }`}
                >
                  {m === "modules" ? `Modules (${CLIENT_MODULES.length})` : "Guides"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Index */}
        <aside className={`${mobileReading ? "hidden" : "block"} lg:block`}>
          <div className="no-scrollbar max-h-[70vh] space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {empty && <p className="px-1 py-6 text-center text-sm text-slate-400">Nothing matches “{query}”.</p>}

            {mode === "modules"
              ? moduleGroups.map((g) => (
                  <div key={g.category}>
                    <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.category}</p>
                    <ul className="space-y-1">
                      {g.modules.map((m) => {
                        const on = m.key === activeModule.key;
                        const n = mediaCount.get(m.key) ?? 0;
                        return (
                          <li key={m.key}>
                            <button
                              onClick={() => { setModuleKey(m.key); setMobileReading(true); }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                                on ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Icon name={m.icon} className={`h-4 w-4 shrink-0 ${on ? "text-blue-600" : "text-slate-400"}`} />
                              <span className="min-w-0 flex-1 truncate">{m.title}</span>
                              {n > 0 && (
                                <Icon name="image" className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              : articleGroups.map((g) => (
                  <div key={g.cat}>
                    <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.cat}</p>
                    <ul className="space-y-1">
                      {g.items.map((d) => {
                        const on = d.id === activeArticle.id;
                        return (
                          <li key={d.id}>
                            <button
                              onClick={() => { setArticleId(d.id); setMobileReading(true); }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                                on ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Icon name={d.icon} className={`h-4 w-4 shrink-0 ${on ? "text-blue-600" : "text-slate-400"}`} />
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
              Back to the index
            </button>

            {mode === "modules" ? (
              <ModuleReader m={activeModule} assetsFor={assetsFor} />
            ) : (
              <ArticleReader d={activeArticle} />
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

// ---- media --------------------------------------------------------------

function AssetView({ a }: { a: DocAsset }) {
  const src = assetSrc(a);
  const embed = a.kind === "video" ? embedUrl(a.url || src) : null;
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {a.kind === "screenshot" ? (
        // eslint-disable-next-line @next/next/no-img-element -- documentation media published by the platform owner, arbitrary host
        <img src={src} alt={a.title || "Screenshot"} className="w-full object-contain" />
      ) : embed ? (
        <div className="aspect-video w-full">
          <iframe src={embed} title={a.title || "Walkthrough video"} allowFullScreen className="h-full w-full border-0" />
        </div>
      ) : (
        <video src={src} controls className="w-full" />
      )}
      {(a.title || a.caption) && (
        <figcaption className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          {a.title && <span className="font-semibold text-slate-700">{a.title}. </span>}
          {a.caption}
        </figcaption>
      )}
    </figure>
  );
}

// ---- readers ------------------------------------------------------------

function ModuleReader({ m, assetsFor }: { m: ManualModule; assetsFor: (step: number) => DocAsset[] }) {
  const [showTech, setShowTech] = useState(false);
  const hero = assetsFor(0);
  const fn = m.functional;
  const tech: { label: string; items?: string[]; text?: string }[] = [
    { label: "Data captured", items: fn.fields },
    { label: "API endpoints", items: fn.api },
    { label: "Stored in", items: fn.storage },
    { label: "Happens automatically", items: fn.automations },
    { label: "Permissions", text: fn.permissions },
    { label: "Notes & limits", items: fn.notes },
  ].filter((b) => (b.items && b.items.length) || b.text);

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon name={m.icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{m.category}</span>
          <h2 className="text-xl font-bold text-slate-900">{m.title}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              <Icon name="users" className="h-3 w-3" /> {m.audience}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              <Icon name="link" className="h-3 w-3" /> {m.route}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-slate-600">{m.what}</p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Why it exists</p>
        <p className="text-sm leading-relaxed text-slate-600">{m.why}</p>
      </div>

      {hero.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {hero.map((a) => <AssetView key={a.id} a={a} />)}
        </div>
      )}

      <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-slate-400">What you get</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {m.features.map((f) => (
          <li key={f} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white p-2.5 text-sm text-slate-700">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-slate-400">How to use it</h3>
      <ol className="mt-3 space-y-4">
        {m.steps.map((s, i) => {
          const shots = assetsFor(i + 1);
          return (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.detail}</p>
                {shots.length > 0 && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {shots.map((a) => <AssetView key={a.id} a={a} />)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {m.tips && m.tips.length > 0 && (
        <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Icon name="bell" className="h-4 w-4" /> Good to know
          </p>
          <ul className="space-y-1.5">
            {m.tips.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-amber-900/90"><span className="text-amber-500">•</span>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {m.faqs && m.faqs.length > 0 && (
        <div className="mt-7">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">FAQ</h3>
          <div className="mt-3 space-y-3">
            {m.faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">{f.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tech.length > 0 && (
        <div className="mt-7 rounded-xl border border-slate-200">
          <button
            onClick={() => setShowTech((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <span className="flex items-center gap-2">
              <Icon name="settings" className="h-4 w-4 text-slate-400" /> Technical details (for administrators)
            </span>
            <Icon name="chevronDown" className={`h-4 w-4 text-slate-400 transition ${showTech ? "rotate-180" : ""}`} />
          </button>
          {showTech && (
            <div className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-2">
              {tech.map((b) => (
                <div key={b.label}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{b.label}</p>
                  {b.text && <p className="mt-1 text-sm leading-relaxed text-slate-600">{b.text}</p>}
                  {b.items && (
                    <ul className="mt-1 space-y-1 text-sm text-slate-600">
                      {b.items.map((i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                          <span className="break-words">{i}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ArticleReader({ d }: { d: DocArticle }) {
  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon name={d.icon} className="h-6 w-6" />
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{d.category}</span>
          <h2 className="text-xl font-bold text-slate-900">{d.title}</h2>
          {d.audience && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              <Icon name="users" className="h-3 w-3" /> {d.audience}
            </span>
          )}
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-slate-600">{d.intro}</p>

      {d.whatItDoes && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">What it does</p>
          <p className="text-sm leading-relaxed text-slate-600">{d.whatItDoes}</p>
        </div>
      )}

      {d.features && d.features.length > 0 && (
        <>
          <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-slate-400">Key features</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {d.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white p-2.5 text-sm text-slate-700">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-slate-400">How to use it</h3>
      <ol className="mt-3 space-y-3">
        {d.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
            <span className="pt-0.5 text-sm leading-relaxed text-slate-700">{s}</span>
          </li>
        ))}
      </ol>

      {d.tips && d.tips.length > 0 && (
        <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Icon name="bell" className="h-4 w-4" /> Good to know
          </p>
          <ul className="space-y-1.5">
            {d.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-900/90"><span className="text-amber-500">•</span>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {d.faqs && d.faqs.length > 0 && (
        <div className="mt-7">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">FAQ</h3>
          <div className="mt-3 space-y-3">
            {d.faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">{f.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
