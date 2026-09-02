"use client";

// Documentation console — the platform owner's manual, demo station and media
// manager for every module in the product.
//
//   Guide      what a client reads (also rendered in their Knowledge Base)
//   Functional fields, API routes, storage, automations and permissions
//   Demo       a timed presenter script with prep, beats and a closing line
//   Media      screenshots and videos the owner attaches, published to clients
//
// The manual text is code (lib/docsManual.ts). Only the media and the private
// notes are data, saved to the platform through lib/docsMedia.ts.

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  MANUAL, manualByCategory, manualHaystack, manualMarkdown, moduleMarkdown, fullDemoMinutes,
  type ManualModule,
} from "@/lib/docsManual";
import {
  assetSrc, embedUrl, fetchDocsMedia, saveDocsMedia, uploadDocsFile,
  type DocAsset, type DocsNotes,
} from "@/lib/docsMedia";

type Tab = "guide" | "functional" | "demo" | "media";

const TABS: { key: Tab; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { key: "guide", label: "Guide", icon: "knowledge" },
  { key: "functional", label: "Functional", icon: "settings" },
  { key: "demo", label: "Demo station", icon: "screenShare" },
  { key: "media", label: "Media", icon: "image" },
];

function newId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Download a string as a file — used by the Markdown export. */
function download(name: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocsConsolePage() {
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string>(MANUAL[0].key);
  const [tab, setTab] = useState<Tab>("guide");

  // Editable copy of the published media set.
  const [assets, setAssets] = useState<DocAsset[]>([]);
  const [notes, setNotes] = useState<DocsNotes>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchDocsMedia().then((m) => {
      if (!alive) return;
      setAssets(m.assets);
      setNotes(m.notes);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // Warn before losing unpublished media edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MANUAL;
    return MANUAL.filter((m) => manualHaystack(m).includes(q));
  }, [query]);

  const groups = useMemo(() => manualByCategory(filtered), [filtered]);
  const active = MANUAL.find((m) => m.key === activeKey) ?? filtered[0] ?? MANUAL[0];
  const mine = useMemo(
    () => assets.filter((a) => a.module === active.key).sort((a, b) => a.order - b.order),
    [assets, active.key],
  );
  const countFor = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) map.set(a.module, (map.get(a.module) ?? 0) + 1);
    return map;
  }, [assets]);
  const documented = useMemo(() => MANUAL.filter((m) => (countFor.get(m.key) ?? 0) > 0).length, [countFor]);

  function mutate(next: DocAsset[]) {
    setAssets(next);
    setDirty(true);
  }

  function addAsset(partial: Partial<DocAsset>) {
    const order = mine.length ? Math.max(...mine.map((a) => a.order)) + 1 : 0;
    mutate([
      ...assets,
      {
        id: newId(),
        module: active.key,
        kind: "screenshot",
        title: "",
        caption: "",
        step: 0,
        url: "",
        file: "",
        mime: "",
        order,
        updatedAt: new Date().toISOString(),
        ...partial,
      },
    ]);
  }

  function patch(id: string, fields: Partial<DocAsset>) {
    mutate(assets.map((a) => (a.id === id ? { ...a, ...fields, updatedAt: new Date().toISOString() } : a)));
  }

  function remove(id: string) {
    mutate(assets.filter((a) => a.id !== id));
  }

  /** Swap an asset with its neighbour inside this module's ordering. */
  function move(id: string, dir: -1 | 1) {
    const list = [...mine];
    const i = list.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const reordered = list.map((a, idx) => ({ ...a, order: idx }));
    const byId = new Map(reordered.map((a) => [a.id, a]));
    mutate(assets.map((a) => byId.get(a.id) ?? a));
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const up = await uploadDocsFile(file);
        addAsset({
          file: up.file,
          mime: up.mime,
          kind: up.mime.startsWith("video/") ? "video" : "screenshot",
          title: up.name.replace(/\.[^.]+$/, ""),
        });
        toast.success("Uploaded", `${up.name} added to ${active.title}. Publish to make it live.`);
      } catch (e) {
        toast.error("Upload failed", (e as Error).message);
      }
    }
  }

  async function publish() {
    setSaving(true);
    try {
      await saveDocsMedia({ assets, notes });
      setDirty(false);
      toast.success("Published", "Every client Knowledge Base now shows this media.");
    } catch (e) {
      toast.error("Couldn't publish", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentation</h1>
          <p className="mt-1 text-sm text-slate-500">
            {MANUAL.length} modules · {documented} with media · {fullDemoMinutes()} minutes of demo script.
            Screenshots and videos you publish here appear in every client&apos;s Knowledge Base.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => download("product-manual.md", manualMarkdown())}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Icon name="export" className="h-4 w-4 text-slate-500" /> Export manual
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Icon name="fileText" className="h-4 w-4 text-slate-500" /> Print / PDF
          </button>
          <button
            onClick={publish}
            disabled={!dirty || saving}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
              dirty && !saving ? "bg-indigo-600 hover:bg-indigo-700" : "cursor-not-allowed bg-slate-300"
            }`}
          >
            <Icon name="check" className="h-4 w-4" />
            {saving ? "Publishing…" : dirty ? "Publish media" : "All published"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Module rail */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search every module…"
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="no-scrollbar mt-4 max-h-[65vh] space-y-4 overflow-y-auto">
              {groups.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-slate-400">Nothing matches “{query}”.</p>
              )}
              {groups.map((g) => (
                <div key={g.category}>
                  <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{g.category}</p>
                  <ul className="space-y-0.5">
                    {g.modules.map((m) => {
                      const n = countFor.get(m.key) ?? 0;
                      const on = m.key === active.key;
                      return (
                        <li key={m.key}>
                          <button
                            onClick={() => { setActiveKey(m.key); setTab("guide"); }}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                              on ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <Icon name={m.icon} className={`h-4 w-4 shrink-0 ${on ? "text-indigo-600" : "text-slate-400"}`} />
                            <span className="min-w-0 flex-1 truncate">{m.title}</span>
                            <span
                              title={n ? `${n} media item(s)` : "No screenshots or video yet"}
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                n ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {n || "—"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Module detail */}
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Icon name={active.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold text-slate-900">{active.title}</h2>
                    <p className="text-sm text-slate-500">{active.summary}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Chip icon="link">{active.route}</Chip>
                  <Chip icon="users">{active.audience}</Chip>
                  {active.feature && <Chip icon="star">plan: {active.feature}</Chip>}
                  {active.permission && <Chip icon="shield">permission: {active.permission}</Chip>}
                  <Chip icon="clock">demo {active.demo.minutes} min</Chip>
                </div>
              </div>
              <button
                onClick={() => download(`${active.key}.md`, moduleMarkdown(active))}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Icon name="export" className="h-3.5 w-3.5 text-slate-500" /> Export module
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-200">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                    tab === t.key
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon name={t.icon} className="h-4 w-4" />
                  {t.label}
                  {t.key === "media" && mine.length > 0 && (
                    <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{mine.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="pt-5">
              {tab === "guide" && <GuideTab m={active} assets={mine} />}
              {tab === "functional" && <FunctionalTab m={active} />}
              {tab === "demo" && <DemoTab m={active} onPresent={() => setPresenting(true)} />}
              {tab === "media" && (
                <MediaTab
                  m={active}
                  assets={mine}
                  loading={loading}
                  note={notes[active.key] ?? ""}
                  onNote={(v) => { setNotes({ ...notes, [active.key]: v }); setDirty(true); }}
                  onUpload={onUpload}
                  onAddLink={(url, kind) => addAsset({ url, kind })}
                  onPatch={patch}
                  onRemove={remove}
                  onMove={move}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {presenting && <Presenter m={active} assets={mine} onClose={() => setPresenting(false)} />}
    </div>
  );
}

// ---- small pieces -------------------------------------------------------

function Chip({ icon, children }: { icon: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
      <Icon name={icon} className="h-3 w-3 text-slate-400" />
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

/** One asset rendered for reading — image, embedded player or native video. */
function AssetView({ a }: { a: DocAsset }) {
  const src = assetSrc(a);
  const embed = a.kind === "video" ? embedUrl(a.url || src) : null;
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {a.kind === "screenshot" ? (
        // eslint-disable-next-line @next/next/no-img-element -- owner-supplied documentation media, arbitrary host
        <img src={src} alt={a.title || "Screenshot"} className="w-full object-contain" />
      ) : embed ? (
        <div className="aspect-video w-full">
          <iframe src={embed} title={a.title || "Walkthrough"} allowFullScreen className="h-full w-full border-0" />
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

// ---- tabs ---------------------------------------------------------------

function GuideTab({ m, assets }: { m: ManualModule; assets: DocAsset[] }) {
  const hero = assets.filter((a) => a.step === 0);
  const forStep = (n: number) => assets.filter((a) => a.step === n);

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-slate-700">{m.what}</p>
      <Section title="Why it exists">{m.why}</Section>

      {hero.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {hero.map((a) => <AssetView key={a.id} a={a} />)}
        </div>
      )}

      <Section title="What you get">
        <ul className="space-y-1.5">
          {m.features.map((f) => (
            <li key={f} className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="How to use it">
        <ol className="space-y-3">
          {m.steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{s.title}</p>
                  <p className="mt-0.5 text-slate-600">{s.detail}</p>
                  {forStep(i + 1).length > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {forStep(i + 1).map((a) => <AssetView key={a.id} a={a} />)}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {m.tips && m.tips.length > 0 && (
        <Section title="Tips">
          <ul className="space-y-1.5">
            {m.tips.map((t) => (
              <li key={t} className="flex gap-2">
                <Icon name="star" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {m.faqs && m.faqs.length > 0 && (
        <Section title="FAQ">
          <div className="space-y-3">
            {m.faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-slate-200 p-3">
                <p className="font-semibold text-slate-800">{f.q}</p>
                <p className="mt-1 text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function FunctionalTab({ m }: { m: ManualModule }) {
  const f = m.functional;
  const blocks: { title: string; items?: string[]; text?: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
    { title: "Data captured", items: f.fields, icon: "list" },
    { title: "API endpoints", items: f.api, icon: "plug" },
    { title: "Stored in", items: f.storage, icon: "grid" },
    { title: "Automatic behaviour", items: f.automations, icon: "refresh" },
    { title: "Permissions & gating", text: f.permissions, icon: "shield" },
    { title: "Notes & limits", items: f.notes, icon: "alert" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {blocks
        .filter((b) => (b.items && b.items.length) || b.text)
        .map((b) => (
          <div key={b.title} className="rounded-xl border border-slate-200 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              <Icon name={b.icon} className="h-3.5 w-3.5" /> {b.title}
            </p>
            {b.text && <p className="mt-2 text-sm leading-relaxed text-slate-700">{b.text}</p>}
            {b.items && (
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
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
  );
}

function DemoTab({ m, onPresent }: { m: ManualModule; onPresent: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-500">Demo goal · {m.demo.minutes} min</p>
          <p className="mt-1 text-sm font-medium text-indigo-900">{m.demo.goal}</p>
        </div>
        <button
          onClick={onPresent}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Icon name="expand" className="h-4 w-4" /> Present
        </button>
      </div>

      {m.demo.prep.length > 0 && (
        <Section title="Before the call">
          <ul className="space-y-1.5">
            {m.demo.prep.map((p) => (
              <li key={p} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Run sheet">
        <ol className="space-y-3">
          {m.demo.beats.map((b, i) => (
            <li key={b.screen + i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">{i + 1}</span>
                <p className="font-semibold text-slate-800">{b.screen}</p>
              </div>
              <p className="mt-2 text-slate-700"><span className="font-semibold text-slate-500">Do:</span> {b.do}</p>
              <p className="mt-1 text-slate-700"><span className="font-semibold text-slate-500">Say:</span> “{b.say}”</p>
              {b.watch && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  <span className="font-semibold">Watch for:</span> {b.watch}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Closing line</p>
        <p className="mt-1 text-sm font-medium text-emerald-900">{m.demo.wow}</p>
      </div>
    </div>
  );
}

function MediaTab({
  m, assets, loading, note, onNote, onUpload, onAddLink, onPatch, onRemove, onMove,
}: {
  m: ManualModule;
  assets: DocAsset[];
  loading: boolean;
  note: string;
  onNote: (v: string) => void;
  onUpload: (files: FileList | null) => void;
  onAddLink: (url: string, kind: DocAsset["kind"]) => void;
  onPatch: (id: string, fields: Partial<DocAsset>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">Add a screenshot or walkthrough video</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Upload a PNG/JPG/WebP/GIF, an MP4/WebM or a PDF — or paste a YouTube, Vimeo, Loom or Drive link.
          Pin an item to a step number and it appears beside that step, here and in every client&apos;s Knowledge Base.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white/70"
          >
            <Icon name="upload" className="h-4 w-4 text-slate-500" /> Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }}
          />
          <div className="flex min-w-[240px] flex-1 items-center gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={() => {
                const v = link.trim();
                if (!v) return;
                onAddLink(v, /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(v) ? "screenshot" : "video");
                setLink("");
              }}
              className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Add link
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading published media…</p>
      ) : assets.length === 0 ? (
        <p className="rounded-xl border border-slate-200 py-8 text-center text-sm text-slate-400">
          No screenshots or videos for {m.title} yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {assets.map((a, i) => (
            <li key={a.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[220px_1fr]">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <AssetView a={a} />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={a.kind}
                    onChange={(e) => onPatch(a.id, { kind: e.target.value as DocAsset["kind"] })}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="screenshot">Screenshot</option>
                    <option value="video">Video</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    Step
                    <select
                      value={a.step}
                      onChange={(e) => onPatch(a.id, { step: Number(e.target.value) })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      <option value={0}>General</option>
                      {m.steps.map((s, idx) => (
                        <option key={s.title} value={idx + 1}>{idx + 1}. {s.title}</option>
                      ))}
                    </select>
                  </label>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => onMove(a.id, -1)} disabled={i === 0} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up">
                      <Icon name="chevronDown" className="h-4 w-4 rotate-180" />
                    </button>
                    <button onClick={() => onMove(a.id, 1)} disabled={i === assets.length - 1} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down">
                      <Icon name="chevronDown" className="h-4 w-4" />
                    </button>
                    <button onClick={() => onRemove(a.id)} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50" title="Remove">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <input
                  value={a.title}
                  onChange={(e) => onPatch(a.id, { title: e.target.value })}
                  placeholder="Title — e.g. Lead detail panel"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <textarea
                  value={a.caption}
                  onChange={(e) => onPatch(a.id, { caption: e.target.value })}
                  placeholder="Caption shown under the image in the client's Knowledge Base."
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                {a.file ? (
                  <p className="truncate text-xs text-slate-400">Uploaded file · {a.file}</p>
                ) : (
                  <input
                    value={a.url}
                    onChange={(e) => onPatch(a.id, { url: e.target.value })}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 outline-none focus:border-indigo-400"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Private note (never shown to clients)</label>
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={3}
          placeholder="Internal reminders for this module — known issues, demo data to reset, what to avoid showing."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}

// ---- presenter ----------------------------------------------------------

/** Full-screen demo runner: one beat at a time, with a running clock. */
function Presenter({ m, assets, onClose }: { m: ManualModule; assets: DocAsset[]; onClose: () => void }) {
  const [i, setI] = useState(-1); // -1 = the prep checklist
  const [seconds, setSeconds] = useState(0);
  const last = m.demo.beats.length - 1;

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") setI((n) => Math.min(n + 1, last));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose]);

  const beat = i >= 0 ? m.demo.beats[i] : null;
  // Media is pinned to guide steps, not to demo beats, so the presenter just
  // walks the module's assets in order alongside the beats, falling back to the
  // first one when there are fewer assets than beats.
  const shot = i >= 0 ? (assets[i] ?? assets[0]) : assets[0];
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const over = seconds > m.demo.minutes * 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-3">
          <Icon name={m.icon} className="h-5 w-5 text-indigo-300" />
          <p className="font-semibold">{m.title}</p>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">{m.route}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 font-mono text-sm ${over ? "bg-rose-500/20 text-rose-200" : "bg-white/10 text-white/80"}`}>
            {clock} / {m.demo.minutes}:00
          </span>
          <button onClick={onClose} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" title="Close (Esc)">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_420px]">
          <div>
            {beat === null ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Before you start</p>
                <h2 className="mt-2 text-3xl font-bold">{m.demo.goal}</h2>
                <ul className="mt-6 space-y-3">
                  {m.demo.prep.map((p) => (
                    <li key={p} className="flex gap-3 text-lg text-white/80">
                      <Icon name="check" className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">
                  Beat {i + 1} of {m.demo.beats.length} · {beat.screen}
                </p>
                <h2 className="mt-3 text-3xl font-bold leading-snug">“{beat.say}”</h2>
                <p className="mt-6 rounded-xl bg-white/5 p-4 text-lg text-white/80">
                  <span className="font-semibold text-white/50">Do: </span>{beat.do}
                </p>
                {beat.watch && (
                  <p className="mt-3 rounded-xl bg-amber-400/10 p-4 text-base text-amber-200">
                    <span className="font-semibold">Watch for: </span>{beat.watch}
                  </p>
                )}
                {i === last && (
                  <p className="mt-6 rounded-xl bg-emerald-400/10 p-4 text-lg text-emerald-200">
                    <span className="font-semibold">Close with: </span>{m.demo.wow}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="space-y-4">
            {shot && <AssetView a={shot} />}
            <div className="rounded-xl bg-white/5 p-4 text-sm text-white/60">
              <p className="font-semibold text-white/80">Run sheet</p>
              <ol className="mt-2 space-y-1">
                {m.demo.beats.map((b, idx) => (
                  <li key={b.screen + idx}>
                    <button
                      onClick={() => setI(idx)}
                      className={`w-full truncate rounded-md px-2 py-1 text-left ${idx === i ? "bg-indigo-500/30 text-white" : "hover:bg-white/10"}`}
                    >
                      {idx + 1}. {b.screen}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
        <button
          onClick={() => setI((n) => Math.max(n - 1, -1))}
          disabled={i === -1}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 disabled:opacity-30"
        >
          ← Back
        </button>
        <p className="text-xs text-white/40">← → or space to move · Esc to close</p>
        <button
          onClick={() => (i === last ? onClose() : setI((n) => Math.min(n + 1, last)))}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500"
        >
          {i === last ? "Finish" : "Next →"}
        </button>
      </div>
    </div>
  );
}
