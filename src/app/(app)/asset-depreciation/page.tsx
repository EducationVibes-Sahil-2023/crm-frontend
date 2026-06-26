"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { assetsApi, formatMoney, type Asset } from "@/lib/assets";
import { depreciate, loadDepreciation, saveDepreciation, type DepreciationSettings } from "@/lib/assetSystem";

export default function AssetDepreciationPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<DepreciationSettings>({ lifeYears: 5, salvagePct: 0 });
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try { setAssets(await assetsApi.list()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load assets"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { setSettings(loadDepreciation()); setReady(true); load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => { if (ready) saveDepreciation(settings); }, [settings, ready]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => Number(a.purchase_cost || 0) > 0)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q))
      .map((a) => ({ a, d: depreciate(a, settings) }))
      .sort((x, y) => y.d.bookValue - x.d.bookValue);
  }, [assets, settings, query]);

  const totals = useMemo(() => {
    let cost = 0, book = 0, acc = 0;
    rows.forEach(({ d }) => { cost += d.cost; book += d.bookValue; acc += d.accumulated; });
    return { cost, book, acc };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Depreciation</h1>
        <p className="mt-1 text-sm text-slate-500">Straight-line depreciation and current book value across your asset base.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="revenue" label="Total cost" value={formatMoney(totals.cost)} wrap="bg-slate-100 text-slate-600" />
        <Stat icon="trendUp" label="Depreciated" value={formatMoney(totals.acc)} wrap="bg-rose-100 text-rose-600" />
        <Stat icon="check" label="Book value" value={formatMoney(totals.book)} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="asset" label="Depreciating" value={rows.length} wrap="bg-blue-100 text-blue-600" />
      </div>

      {/* Settings */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Useful life (years)</label>
          <input type="number" min="1" step="0.5" value={settings.lifeYears} onChange={(e) => setSettings((s) => ({ ...s, lifeYears: Number(e.target.value) || 1 }))} className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Salvage value (%)</label>
          <input type="number" min="0" max="100" step="1" value={settings.salvagePct} onChange={(e) => setSettings((s) => ({ ...s, salvagePct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <p className="text-xs text-slate-400">Straight-line: annual = (cost − salvage) ÷ life. Settings are saved automatically.</p>
        <div className="ml-auto">
          <div className="relative w-56"><Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset…" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="trendUp" className="h-7 w-7" /></div><p className="mt-3 text-sm font-semibold text-slate-700">No assets with a purchase cost</p><p className="mt-1 text-sm text-slate-400">Add a purchase cost &amp; date in the register to see depreciation.</p></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Asset</th><th className="px-5 py-3 text-right">Cost</th><th className="px-5 py-3 text-right">Age</th><th className="px-5 py-3 text-right">Annual</th><th className="px-5 py-3 text-right">Book value</th><th className="px-5 py-3">Depreciated</th></tr></thead>
              <tbody>
                {rows.map(({ a, d }) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3"><p className="font-medium text-slate-800">{a.name}</p><p className="text-xs text-slate-400">{a.category || "Uncategorized"}</p></td>
                    <td className="px-5 py-3 text-right text-slate-700">{formatMoney(d.cost)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{d.elapsedYears.toFixed(1)}y</td>
                    <td className="px-5 py-3 text-right text-slate-500">{formatMoney(d.annual)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-700">{formatMoney(d.bookValue)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.round(d.pct * 100)}%` }} /></div>
                        <span className="text-xs text-slate-500">{Math.round(d.pct * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
    </div>
  );
}
function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 py-14 text-center"><p className="text-sm font-semibold text-rose-700">Couldn&apos;t load data</p><p className="mt-1 max-w-md text-xs text-rose-500">{message}</p><button onClick={onRetry} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Retry</button></div>;
}
