"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { formatDate, loadPayments, money } from "@/lib/billing";
import { loadBills, loadExpenses } from "@/lib/finance";

type Dir = "in" | "out";
type Entry = { id: string; date: string; description: string; party: string; kind: string; dir: Dir; amount: number };

const TABS: ("all" | Dir)[] = ["all", "in", "out"];

export default function LedgerPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [tab, setTab] = useState<"all" | Dir>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      const list: Entry[] = [];
      loadPayments().filter((p) => p.status === "completed").forEach((p) =>
        list.push({ id: `pay-${p.id}`, date: p.date, description: `Payment ${p.number}${p.invoiceNumber ? ` · ${p.invoiceNumber}` : ""}`, party: p.customer, kind: "Receipt", dir: "in", amount: p.amount }),
      );
      loadExpenses().filter((e) => e.status === "paid").forEach((e) =>
        list.push({ id: `exp-${e.id}`, date: e.date, description: e.description || e.category, party: e.vendor || e.category, kind: "Expense", dir: "out", amount: e.amount }),
      );
      loadBills().filter((b) => b.paidAmount > 0).forEach((b) =>
        list.push({ id: `bill-${b.id}`, date: b.issueDate, description: `Bill ${b.number}`, party: b.vendor, kind: "Bill payment", dir: "out", amount: b.paidAmount }),
      );
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setEntries(list);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const totals = useMemo(() => {
    const all = entries ?? [];
    const inc = all.filter((e) => e.dir === "in").reduce((s, e) => s + e.amount, 0);
    const out = all.filter((e) => e.dir === "out").reduce((s, e) => s + e.amount, 0);
    return { inc, out, net: inc - out };
  }, [entries]);

  const rows = useMemo(() => {
    const all = entries ?? [];
    const q = query.trim().toLowerCase();
    return all
      .filter((e) => tab === "all" || e.dir === tab)
      .filter((e) => !q || e.description.toLowerCase().includes(q) || e.party.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q));
  }, [entries, tab, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ledger</h1>
        <p className="mt-1 text-sm text-slate-500">Every receipt and payment in one cash-basis view.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon="trendUp" label="Money in" value={money(totals.inc)} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="payment" label="Money out" value={money(totals.out)} wrap="bg-rose-100 text-rose-600" />
        <Stat icon="revenue" label="Net" value={money(totals.net)} wrap={totals.net >= 0 ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{t === "in" ? "Money in" : t === "out" ? "Money out" : "All"}</button>
          ))}
        </div>
        <div className="relative"><Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
      </div>

      {!entries ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="list" className="h-7 w-7" /></div><p className="mt-3 text-sm font-semibold text-slate-700">No transactions yet</p><p className="mt-1 text-sm text-slate-400">Record payments, paid expenses or bill payments to populate the ledger.</p></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Date</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Party</th><th className="px-5 py-3">Type</th><th className="px-5 py-3 text-right">In</th><th className="px-5 py-3 text-right">Out</th></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{formatDate(e.date)}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{e.description}</td>
                    <td className="px-5 py-3 text-slate-600">{e.party}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.dir === "in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{e.kind}</span></td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-700">{e.dir === "in" ? money(e.amount) : "—"}</td>
                    <td className="px-5 py-3 text-right font-medium text-rose-600">{e.dir === "out" ? money(e.amount) : "—"}</td>
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
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>;
}
