"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { invoicePaid, loadInvoices, loadPayments, money, type Invoice, type Payment } from "@/lib/billing";
import { invoiceTotal, loadBills, loadExpenses, type Bill, type Expense } from "@/lib/finance";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const todayIso = new Date().toISOString().slice(0, 10);
function diffDays(from: string, to: string): number {
  const a = new Date(from), b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function AccountReportsPage() {
  const [d, setD] = useState<{ invoices: Invoice[]; payments: Payment[]; expenses: Expense[]; bills: Bill[] } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setD({ invoices: loadInvoices(), payments: loadPayments(), expenses: loadExpenses(), bills: loadBills() }), 0);
    return () => clearTimeout(t);
  }, []);

  const pl = useMemo(() => {
    if (!d) return null;
    const income = d.payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
    const expPaid = d.expenses.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
    const billPaid = d.bills.reduce((s, b) => s + b.paidAmount, 0);
    const expense = expPaid + billPaid;
    return { income, expense, profit: income - expense, margin: income > 0 ? ((income - expense) / income) * 100 : 0 };
  }, [d]);

  const aging = useMemo(() => {
    const buckets = { current: 0, b30: 0, b60: 0, b90: 0 };
    if (!d) return buckets;
    d.invoices.forEach((inv) => {
      const out = invoiceTotal(inv) - invoicePaid(inv.id, d.payments);
      if (out <= 0) return;
      const overdue = diffDays(inv.dueDate, todayIso);
      if (overdue <= 0) buckets.current += out;
      else if (overdue <= 30) buckets.b30 += out;
      else if (overdue <= 60) buckets.b60 += out;
      else buckets.b90 += out;
    });
    return buckets;
  }, [d]);
  const agingTotal = aging.current + aging.b30 + aging.b60 + aging.b90;

  const months = useMemo(() => {
    if (!d) return [];
    const now = new Date();
    const keys: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push({ key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[dt.getMonth()]}` });
    }
    return keys.map(({ key, label }) => {
      const income = d.payments.filter((p) => p.status === "completed" && (p.date || "").startsWith(key)).reduce((s, p) => s + p.amount, 0);
      const expense = d.expenses.filter((e) => e.status === "paid" && (e.date || "").startsWith(key)).reduce((s, e) => s + e.amount, 0)
        + d.bills.filter((b) => (b.issueDate || "").startsWith(key)).reduce((s, b) => s + b.paidAmount, 0);
      return { label, income, expense };
    });
  }, [d]);
  const monthMax = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));

  const topCats = useMemo(() => {
    if (!d) return [];
    const map: Record<string, number> = {};
    d.expenses.filter((e) => e.status !== "rejected").forEach((e) => (map[e.category] = (map[e.category] || 0) + e.amount));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [d]);
  const catMax = Math.max(1, ...topCats.map(([, v]) => v));

  if (!d || !pl) return <div className="space-y-6"><Header /><div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" /></div>;

  return (
    <div className="space-y-6">
      <Header />

      {/* P&L */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat icon="trendUp" label="Income (received)" value={money(pl.income)} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="payment" label="Expenses (paid)" value={money(pl.expense)} wrap="bg-rose-100 text-rose-600" />
        <Stat icon="revenue" label="Net profit" value={money(pl.profit)} wrap={pl.profit >= 0 ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"} />
        <Stat icon="deals" label="Margin" value={`${pl.margin.toFixed(1)}%`} wrap="bg-violet-100 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Monthly trend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Income vs expenses — last 6 months</h3>
          <div className="flex items-end justify-between gap-3" style={{ height: 180 }}>
            {months.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-[150px] w-full items-end justify-center gap-1">
                  <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${(m.income / monthMax) * 100}%` }} title={`In ${money(m.income)}`} />
                  <div className="w-1/2 rounded-t bg-rose-400" style={{ height: `${(m.expense / monthMax) * 100}%` }} title={`Out ${money(m.expense)}`} />
                </div>
                <span className="text-[11px] text-slate-400">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Income</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Expenses</span>
          </div>
        </div>

        {/* AR aging */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Receivables aging</h3>
          <p className="mb-3 text-xs text-slate-400">Outstanding {money(agingTotal)}</p>
          <div className="space-y-2.5">
            <AgeBar label="Current" value={aging.current} total={agingTotal} color="bg-emerald-500" />
            <AgeBar label="1–30 days" value={aging.b30} total={agingTotal} color="bg-amber-500" />
            <AgeBar label="31–60 days" value={aging.b60} total={agingTotal} color="bg-orange-500" />
            <AgeBar label="60+ days" value={aging.b90} total={agingTotal} color="bg-rose-500" />
          </div>
        </div>
      </div>

      {/* Top expense categories */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Top expense categories</h3>
        {topCats.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No expenses recorded</p> : (
          <div className="space-y-2.5">
            {topCats.map(([c, v]) => (
              <div key={c}>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-600">{c}</span><span className="font-semibold text-slate-700">{money(v)}</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(v / catMax) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return <div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Financial Reports</h1><p className="mt-1 text-sm text-slate-500">Profit &amp; loss, receivables aging and spending trends.</p></div>;
}
function AgeBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-semibold text-slate-700">{money(value)}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>;
}
