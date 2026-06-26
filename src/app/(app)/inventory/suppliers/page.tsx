"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { optionNames } from "@/lib/setup";
import { formatMoney, inventoryApi, itemValue, stockStatus, type InventoryItem } from "@/lib/inventory";

const initials = (s: string) => s.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function InventorySuppliersPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vendors = useMemo(() => { try { return optionNames("vendor"); } catch { return []; } }, []);

  useEffect(() => {
    let alive = true;
    inventoryApi.list()
      .then((d) => { if (alive) { setItems(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const suppliers = useMemo(() => {
    const map = new Map<string, { count: number; units: number; value: number; low: number }>();
    // Seed with configured vendors so they show even with no items.
    for (const v of vendors) map.set(v, { count: 0, units: 0, value: 0, low: 0 });
    for (const i of items) {
      const s = i.supplier || "Unassigned";
      const cur = map.get(s) ?? { count: 0, units: 0, value: 0, low: 0 };
      cur.count += 1;
      cur.units += Number(i.quantity || 0);
      cur.value += itemValue(i);
      if (stockStatus(i) !== "in") cur.low += 1;
      map.set(s, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value || b.count - a.count);
  }, [items, vendors]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="briefcase" className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-bold">Suppliers</h1><p className="mt-1 text-sm text-blue-100">Vendors supplying your inventory.</p></div>
          </div>
          <Link href="/admin-setup/vendor" className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20"><Icon name="settings" className="h-4 w-4" /> Manage vendors</Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{error}. Inventory needs the backend running on :8080.</div>
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="briefcase" className="h-8 w-8" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-800">No suppliers yet</p>
          <p className="mt-1 text-sm text-slate-500">Add vendors in Admin Setup or assign suppliers to items.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Supplier</th><th className="px-3 py-3 text-right">Items</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Stock value</th><th className="px-3 py-3 text-right">Low stock</th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{initials(s.name)}</span>
                        <span className="font-medium text-slate-800">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{s.count}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{s.units}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatMoney(s.value)}</td>
                    <td className="px-3 py-3 text-right">{s.low > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{s.low}</span> : <span className="text-slate-300">—</span>}</td>
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
