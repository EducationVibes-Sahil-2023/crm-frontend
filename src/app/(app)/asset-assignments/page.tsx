"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { assetsApi, formatMoney, STATUS_META, type Asset } from "@/lib/assets";

const AVATARS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const avatarColor = (s: string) => AVATARS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length];
const initials = (s: string) => s.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function AssetAssignmentsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"assigned" | "unassigned">("assigned");

  const load = useCallback(async () => {
    try {
      setAssets(await assetsApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { const t = setTimeout(() => load(), 0); return () => clearTimeout(t); }, [load]);

  const assigned = useMemo(() => assets.filter((a) => (a.owner_name || "").trim()), [assets]);
  const unassigned = useMemo(() => assets.filter((a) => !(a.owner_name || "").trim()), [assets]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { name: string; email: string; items: Asset[] }>();
    for (const a of assigned) {
      const name = a.owner_name!.trim();
      if (q && !name.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) continue;
      const g = map.get(name) ?? { name, email: a.owner_email || "", items: [] };
      g.items.push(a);
      if (!g.email && a.owner_email) g.email = a.owner_email;
      map.set(name, g);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [assigned, query]);

  const filteredUnassigned = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unassigned.filter((a) => !q || a.name.toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q));
  }, [unassigned, query]);

  const totalValue = useMemo(() => assigned.reduce((s, a) => s + Number(a.purchase_cost || 0), 0), [assigned]);

  return (
    <div className="space-y-6">
      <Header title="Assignments" subtitle="Custody of assets — who is holding what." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="check" label="Assigned" value={assigned.length} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="asset" label="Unassigned" value={unassigned.length} wrap="bg-slate-100 text-slate-600" />
        <Stat icon="users" label="Holders" value={groups.length || new Set(assigned.map((a) => a.owner_name)).size} wrap="bg-violet-100 text-violet-600" />
        <Stat icon="revenue" label="Value assigned" value={formatMoney(totalValue)} wrap="bg-blue-100 text-blue-600" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(["assigned", "unassigned"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {t} <span className="ml-1 text-xs opacity-70">{t === "assigned" ? assigned.length : unassigned.length}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search holder or asset…" className="w-60 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : tab === "assigned" ? (
        groups.length === 0 ? <EmptyBox label="No matching assignments" /> : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {groups.map((g) => (
              <div key={g.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${avatarColor(g.name)}`}>{initials(g.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{g.name}</p>
                    <p className="truncate text-xs text-slate-500">{g.email || "—"}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{g.items.length} asset{g.items.length === 1 ? "" : "s"}</span>
                </div>
                <ul className="mt-2 divide-y divide-slate-50">
                  {g.items.map((a) => {
                    const m = STATUS_META[a.status];
                    return (
                      <li key={a.id} className="flex items-center gap-3 py-2">
                        {a.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image_url} alt={a.name} className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Icon name="asset" className="h-4 w-4" /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{a.name}</p>
                          <p className="text-xs text-slate-400">{a.tag || "—"} · {a.category || "Uncategorized"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.badge}`}>{m.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )
      ) : filteredUnassigned.length === 0 ? (
        <EmptyBox label="Everything is assigned" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Asset</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Cost</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody>
              {filteredUnassigned.map((a) => {
                const m = STATUS_META[a.status];
                return (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{a.name}<span className="ml-1 text-xs font-normal text-slate-400">{a.tag || ""}</span></td>
                    <td className="px-5 py-3 text-slate-600">{a.category || "—"}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.badge}`}>{m.label}</span></td>
                    <td className="px-5 py-3 text-right text-slate-700">{formatMoney(a.purchase_cost)}</td>
                    <td className="px-5 py-3 text-right"><Link href="/asset-management" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">Assign</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* shared bits */
export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}
export function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
    </div>
  );
}
export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />)}
    </div>
  );
}
export function EmptyBox({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="asset" className="h-7 w-7" /></div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{label}</p>
    </div>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 py-14 text-center">
      <p className="text-sm font-semibold text-rose-700">Couldn&apos;t load data</p>
      <p className="mt-1 max-w-md text-xs text-rose-500">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Retry</button>
    </div>
  );
}
