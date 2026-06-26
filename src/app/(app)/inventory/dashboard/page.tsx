"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import {
  formatMoney,
  inventoryApi,
  itemValue,
  STATUS_META,
  stockStatus,
  timeAgo,
  type InventoryItem,
} from "@/lib/inventory";

export default function InventoryDashboard() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    inventoryApi
      .list()
      .then((d) => { if (alive) { setItems(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load inventory"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const value = items.reduce((s, i) => s + itemValue(i), 0);
    const low = items.filter((i) => stockStatus(i) === "low").length;
    const out = items.filter((i) => stockStatus(i) === "out").length;
    const units = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    return { total, value, low, out, units };
  }, [items]);

  const categories = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const i of items) {
      const c = i.category || "Uncategorised";
      const cur = map.get(c) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += itemValue(i);
      map.set(c, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value);
  }, [items]);
  const catMax = Math.max(1, ...categories.map((c) => c.value));

  const lowItems = useMemo(() => items.filter((i) => stockStatus(i) !== "in").sort((a, b) => Number(a.quantity) - Number(b.quantity)).slice(0, 6), [items]);
  const recent = useMemo(() => [...items].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 6), [items]);

  const modules: { href: string; icon: IconName; title: string; desc: string; metric: string; grad: string }[] = [
    { href: "/inventory", icon: "asset", title: "All Items", desc: "Browse & manage the catalog", metric: `${stats.total}`, grad: "from-blue-500 to-indigo-600" },
    { href: "/inventory/low-stock", icon: "alert", title: "Low Stock", desc: "Items to reorder", metric: `${stats.low + stats.out}`, grad: "from-amber-500 to-orange-600" },
    { href: "/inventory/movements", icon: "refresh", title: "Stock Movements", desc: "Stock in / out history", metric: "Log", grad: "from-violet-500 to-purple-600" },
    { href: "/inventory/categories", icon: "grid", title: "Categories", desc: "Breakdown by category", metric: `${categories.length}`, grad: "from-emerald-500 to-teal-600" },
    { href: "/inventory/suppliers", icon: "briefcase", title: "Suppliers", desc: "Who you buy from", metric: "View", grad: "from-cyan-500 to-sky-600" },
    { href: "/admin-setup/vendor", icon: "settings", title: "Setup", desc: "Vendors & categories", metric: "Config", grad: "from-slate-600 to-slate-800" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="inventory" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Inventory</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">Track stock, value, reorders and movements across the store.</p>
            </div>
          </div>
          <Link href="/inventory" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
            <Icon name="asset" className="h-4 w-4" /> Manage Items
          </Link>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Items" value={loading ? "…" : String(stats.total)} sub={`${stats.units} units`} />
          <Stat label="Stock value" value={loading ? "…" : formatMoney(stats.value)} />
          <Stat label="Low stock" value={loading ? "…" : String(stats.low)} highlight={stats.low > 0} />
          <Stat label="Out of stock" value={loading ? "…" : String(stats.out)} highlight={stats.out > 0} />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          {error}. Inventory needs the backend running on :8080.
        </div>
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          {/* Module grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {modules.map((m) => (
              <Link key={m.href} href={m.href} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${m.grad}`}><Icon name={m.icon} className="h-5 w-5" /></span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{m.metric}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-blue-700">{m.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Category value breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Stock value by category</h2>
              {categories.length === 0 ? (
                <p className="mt-6 text-center text-sm text-slate-400">No items yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {categories.slice(0, 7).map((c) => (
                    <div key={c.name}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{c.name} <span className="text-slate-400">· {c.count}</span></span>
                        <span className="text-slate-500">{formatMoney(c.value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500" style={{ width: `${(c.value / catMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reorder alerts */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Reorder alerts</h2>
                <Link href="/inventory/low-stock" className="text-sm font-semibold text-blue-600 hover:underline">View all</Link>
              </div>
              {lowItems.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">All items are well stocked 🎉</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {lowItems.map((i) => {
                    const m = STATUS_META[stockStatus(i)];
                    return (
                      <li key={i.id} className="flex items-center gap-3 py-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.badge}`}><Icon name={m.icon} className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{i.name}</p>
                          <p className="truncate text-xs text-slate-400">{i.category || "Uncategorised"} · {i.sku || "—"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-slate-900">{Number(i.quantity)} {i.unit}</p>
                          <p className="text-[11px] text-slate-400">reorder ≤ {Number(i.reorder_level)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Recently added */}
          {recent.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Recently added</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon name="asset" className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{i.name}</p>
                      <p className="truncate text-xs text-slate-400">{Number(i.quantity)} {i.unit} · {formatMoney(itemValue(i))}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(i.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 backdrop-blur ${highlight ? "bg-rose-500/20 ring-rose-200/40" : "bg-white/10 ring-white/20"}`}>
      <p className="truncate text-lg font-bold leading-tight">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
      {sub && <p className="truncate text-[11px] text-blue-100/80">{sub}</p>}
    </div>
  );
}
