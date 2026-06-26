"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { formatMoney, inventoryApi, itemValue, stockStatus, type InventoryItem } from "@/lib/inventory";

const TONES = ["from-blue-500 to-indigo-600", "from-emerald-500 to-teal-600", "from-violet-500 to-purple-600", "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-cyan-500 to-sky-600"];

export default function InventoryCategoriesPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    inventoryApi.list()
      .then((d) => { if (alive) { setItems(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const cats = useMemo(() => {
    const map = new Map<string, { count: number; units: number; value: number; low: number }>();
    for (const i of items) {
      const c = i.category || "Uncategorised";
      const cur = map.get(c) ?? { count: 0, units: 0, value: 0, low: 0 };
      cur.count += 1;
      cur.units += Number(i.quantity || 0);
      cur.value += itemValue(i);
      if (stockStatus(i) !== "in") cur.low += 1;
      map.set(c, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="grid" className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold">Categories</h1><p className="mt-1 text-sm text-blue-100">Stock spread across {cats.length} categor{cats.length === 1 ? "y" : "ies"}.</p></div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{error}. Inventory needs the backend running on :8080.</div>
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : cats.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="grid" className="h-8 w-8" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-800">No categories yet</p>
          <p className="mt-1 text-sm text-slate-500">Add items with categories to see the breakdown.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c, idx) => (
            <Link key={c.name} href="/inventory" className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white ${TONES[idx % TONES.length]}`}><Icon name="grid" className="h-5 w-5" /></span>
                {c.low > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{c.low} low</span>}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-blue-700">{c.name}</h3>
              <p className="text-xs text-slate-500">{c.count} item{c.count === 1 ? "" : "s"} · {c.units} units</p>
              <p className="mt-3 text-lg font-bold text-slate-900">{formatMoney(c.value)}</p>
              <p className="text-[11px] text-slate-400">stock value</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
