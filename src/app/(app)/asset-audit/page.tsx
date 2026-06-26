"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { assetsApi, EVENT_META, timeAgo, type AssetEvent } from "@/lib/assets";

type Entry = AssetEvent & { assetName: string; assetTag: string | null };

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
  { key: "submitted", label: "Submitted" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "comment", label: "Comments" },
];

const CAP = 60; // bound the number of assets we pull event detail for

export default function AssetAuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await assetsApi.list();
      setCapped(list.length > CAP);
      const slice = list.slice(0, CAP);
      const details = await Promise.all(
        slice.map((a) => assetsApi.get(a.id).catch(() => null)),
      );
      const all: Entry[] = [];
      details.forEach((d) => {
        if (!d?.events) return;
        d.events.forEach((ev) => all.push({ ...ev, assetName: d.name, assetTag: d.tag }));
      });
      all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setEntries(all);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { const t = setTimeout(() => load(), 0); return () => clearTimeout(t); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    entries.forEach((e) => (c[e.type] = (c[e.type] || 0) + 1));
    return c;
  }, [entries]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => filter === "all" || e.type === filter)
      .filter((e) => !q || e.assetName.toLowerCase().includes(q) || (e.actor || "").toLowerCase().includes(q) || (e.message || "").toLowerCase().includes(q));
  }, [entries, filter, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-500">Every change, transition and comment across your assets — newest first.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"><Icon name="refresh" className="h-4 w-4" /> Refresh</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === f.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {f.label}
              {f.key !== "all" && counts[f.key] ? <span className={`rounded-full px-1.5 text-[10px] font-bold ${filter === f.key ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{counts[f.key]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset, actor, text…" className="w-64 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>

      {capped && <p className="text-xs text-amber-600">Showing activity for the most recent {CAP} assets.</p>}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />)}</div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 py-14 text-center"><p className="text-sm font-semibold text-rose-700">Couldn&apos;t load audit log</p><p className="mt-1 max-w-md text-xs text-rose-500">{error}</p><button onClick={load} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Retry</button></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="activity" className="h-7 w-7" /></div><p className="mt-3 text-sm font-semibold text-slate-700">No activity yet</p></div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <ol className="space-y-1">
            {rows.map((e) => {
              const em = EVENT_META[e.type] ?? EVENT_META.updated;
              return (
                <li key={e.id} className="flex gap-3 rounded-lg p-2 transition hover:bg-slate-50">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${em.wrap}`}><Icon name={em.icon as IconName} className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{e.actor || "System"}</span>
                      {e.role && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{e.role}</span>}
                      {" "}{e.type === "comment" ? "commented on" : actionVerb(e.type)}{" "}
                      <span className="font-medium text-slate-900">{e.assetName}</span>
                      {e.assetTag && <span className="text-slate-400"> · {e.assetTag}</span>}
                    </p>
                    {e.message && <p className="truncate text-xs text-slate-500">{e.message}</p>}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{timeAgo(e.created_at)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function actionVerb(type: string): string {
  switch (type) {
    case "created": return "created";
    case "updated": return "updated";
    case "submitted": return "submitted";
    case "verified": return "verified";
    case "rejected": return "rejected";
    case "reopened": return "re-opened";
    default: return "changed";
  }
}
