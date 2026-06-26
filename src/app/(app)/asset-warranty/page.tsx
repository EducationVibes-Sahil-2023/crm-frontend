"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { assetsApi, formatDate, type Asset } from "@/lib/assets";
import { daysUntil, warrantyState, WARRANTY_META, type WarrantyState } from "@/lib/assetSystem";

const TABS: ("all" | WarrantyState)[] = ["all", "expiring", "expired", "valid", "none"];

export default function AssetWarrantyPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | WarrantyState>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try { setAssets(await assetsApi.list()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load assets"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => load(), 0); return () => clearTimeout(t); }, [load]);

  const withState = useMemo(() => assets.map((a) => ({ a, ws: warrantyState(a), d: daysUntil(a.warranty_expiry) })), [assets]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length, valid: 0, expiring: 0, expired: 0, none: 0 };
    withState.forEach(({ ws }) => (c[ws] += 1));
    return c;
  }, [withState, assets.length]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withState
      .filter(({ ws }) => tab === "all" || ws === tab)
      .filter(({ a }) => !q || a.name.toLowerCase().includes(q) || (a.vendor || "").toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q))
      .sort((x, y) => (x.d ?? 1e9) - (y.d ?? 1e9));
  }, [withState, tab, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Warranty &amp; AMC</h1>
        <p className="mt-1 text-sm text-slate-500">Track warranty and annual maintenance contract expiries — act before they lapse.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="check" label="Under warranty" value={counts.valid} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="alert" label="Expiring (60d)" value={counts.expiring} wrap="bg-amber-100 text-amber-600" />
        <Stat icon="close" label="Expired" value={counts.expired} wrap="bg-rose-100 text-rose-600" />
        <Stat icon="shield" label="No warranty" value={counts.none} wrap="bg-slate-100 text-slate-500" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {t === "all" ? "All" : WARRANTY_META[t].label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset or vendor…" className="w-60 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyBox label="No assets in this category" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Asset</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Warranty until</th><th className="px-5 py-3">Time left</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-center">Doc</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, ws, d }) => {
                  const m = WARRANTY_META[ws];
                  return (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.tag || "—"} · {a.category || "Uncategorized"}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.vendor || "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{a.warranty_expiry ? formatDate(a.warranty_expiry) : "—"}</td>
                      <td className="px-5 py-3">{timeLeft(ws, d)}</td>
                      <td className="px-5 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span></td>
                      <td className="px-5 py-3 text-center">
                        {a.warranty_doc_url ? (
                          <a href={a.warranty_doc_url} target="_blank" rel="noopener" className="inline-flex rounded-md p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" aria-label="Warranty document"><Icon name="fileText" className="h-4 w-4" /></a>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function timeLeft(ws: WarrantyState, d: number | null): ReactNode {
  if (ws === "none" || d === null) return <span className="text-slate-400">—</span>;
  if (d < 0) return <span className="font-medium text-rose-600">{Math.abs(d)}d ago</span>;
  if (d === 0) return <span className="font-medium text-amber-600">Today</span>;
  return <span className={d <= 60 ? "font-medium text-amber-600" : "text-slate-600"}>{d <= 60 ? `${d} days` : `${Math.round(d / 30)} months`}</span>;
}

function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
    </div>
  );
}
function EmptyBox({ label }: { label: string }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="shield" className="h-7 w-7" /></div><p className="mt-3 text-sm font-semibold text-slate-700">{label}</p></div>;
}
function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 py-14 text-center"><p className="text-sm font-semibold text-rose-700">Couldn&apos;t load data</p><p className="mt-1 max-w-md text-xs text-rose-500">{message}</p><button onClick={onRetry} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Retry</button></div>;
}
