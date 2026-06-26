"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { inventoryApi, timeAgo, type InventoryItem, type InventoryMovement } from "@/lib/inventory";

type Row = InventoryMovement & { itemName: string; unit: string };

export default function StockMovementsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "in" | "out">("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await inventoryApi.list();
        // Pull each item's history (the list payload omits movements).
        const full = await Promise.all(
          items.map((i) => inventoryApi.get(i.id).catch(() => i as InventoryItem)),
        );
        const all: Row[] = [];
        for (const it of full) {
          for (const m of it.movements ?? []) all.push({ ...m, itemName: it.name, unit: it.unit });
        }
        all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        if (alive) { setRows(all); setError(null); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const inCount = rows.filter((r) => r.type === "in").length;
  const outCount = rows.filter((r) => r.type === "out").length;
  const visible = useMemo(() => rows.filter((r) => (tab === "all" ? true : r.type === tab)), [rows, tab]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="refresh" className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-bold">Stock Movements</h1><p className="mt-1 text-sm text-violet-100">Every stock-in and stock-out across the store.</p></div>
          </div>
          <Link href="/inventory" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-50"><Icon name="asset" className="h-4 w-4" /> Manage Items</Link>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Chip label="Movements" value={String(rows.length)} />
          <Chip label="Stock in" value={String(inCount)} />
          <Chip label="Stock out" value={String(outCount)} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "in", "out"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${tab === t ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {t === "all" ? "All" : t === "in" ? "Stock in" : "Stock out"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{error}. Inventory needs the backend running on :8080.</div>
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Icon name="refresh" className="h-8 w-8" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-800">No movements yet</p>
          <p className="mt-1 text-sm text-slate-500">Stock-in/out adjustments will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Item</th><th className="px-3 py-3">Type</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Balance</th><th className="px-3 py-3">Reason</th><th className="px-3 py-3">By</th><th className="px-3 py-3 text-right">When</th></tr></thead>
              <tbody>
                {visible.map((r) => {
                  const isIn = r.type === "in";
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.itemName}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          <Icon name={isIn ? "download" : "upload"} className="h-3 w-3" /> {isIn ? "In" : "Out"}
                        </span>
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold ${isIn ? "text-emerald-600" : "text-rose-600"}`}>{isIn ? "+" : "−"}{Number(r.qty)} {r.unit}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{Number(r.balance_after)} {r.unit}</td>
                      <td className="px-3 py-3 text-slate-500">{r.reason || "—"}</td>
                      <td className="px-3 py-3 text-slate-500">{r.actor || "—"}</td>
                      <td className="px-3 py-3 text-right text-slate-400">{timeAgo(r.created_at)}</td>
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
  return <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur"><p className="text-xl font-bold leading-none">{value}</p><p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-violet-100">{label}</p></div>;
}
