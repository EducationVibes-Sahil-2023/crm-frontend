"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { formatMoney, inventoryApi, STATUS_META, stockStatus, type InventoryItem } from "@/lib/inventory";

export default function LowStockPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "low" | "out">("all");

  useEffect(() => {
    let alive = true;
    inventoryApi.list()
      .then((d) => { if (alive) { setItems(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const flagged = useMemo(() => items.filter((i) => stockStatus(i) !== "in"), [items]);
  const lowCount = flagged.filter((i) => stockStatus(i) === "low").length;
  const outCount = flagged.filter((i) => stockStatus(i) === "out").length;
  const visible = flagged.filter((i) => (tab === "all" ? true : stockStatus(i) === tab));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="alert" className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-bold">Low Stock &amp; Reorder</h1><p className="mt-1 text-sm text-amber-50">Items at or below their reorder level.</p></div>
          </div>
          <Link href="/inventory" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm hover:bg-orange-50"><Icon name="asset" className="h-4 w-4" /> Manage Items</Link>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Chip label="Need attention" value={String(flagged.length)} />
          <Chip label="Low" value={String(lowCount)} />
          <Chip label="Out of stock" value={String(outCount)} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "low", "out"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${tab === t ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {t === "all" ? "All flagged" : t === "low" ? "Low stock" : "Out of stock"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{error}. Inventory needs the backend running on :8080.</div>
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="check" className="h-8 w-8" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-800">Everything&apos;s stocked</p>
          <p className="mt-1 text-sm text-slate-500">No items below their reorder level.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Item</th><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">In stock</th><th className="px-3 py-3 text-right">Reorder ≤</th><th className="px-3 py-3 text-right">Suggested order</th><th className="px-3 py-3">Status</th></tr></thead>
              <tbody>
                {visible.map((i) => {
                  const m = STATUS_META[stockStatus(i)];
                  const qty = Number(i.quantity || 0), reorder = Number(i.reorder_level || 0);
                  const suggest = Math.max(reorder * 2 - qty, reorder, 1);
                  return (
                    <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3"><p className="font-medium text-slate-800">{i.name}</p><p className="text-xs text-slate-400">{i.sku || "—"} · {i.supplier || "No supplier"}</p></td>
                      <td className="px-3 py-3 text-slate-600">{i.category || "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">{qty} {i.unit}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{reorder}</td>
                      <td className="px-3 py-3 text-right"><span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">+{suggest} {i.unit}</span></td>
                      <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span></td>
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

function Chip({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur"><p className="text-xl font-bold leading-none">{value}</p><p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-amber-50">{label}</p></div>;
}
