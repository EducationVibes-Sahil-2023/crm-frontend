"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import {
  INVOICE_STATUS,
  invoiceDisplayStatus,
  invoicePaid,
  loadInvoices,
  loadPayments,
  loadQuotations,
  money,
  type Invoice,
  type Payment,
  type Quotation,
} from "@/lib/billing";
import { billStatus, invoiceTotal, loadBills, loadExpenses, type Bill, type Expense } from "@/lib/finance";

const MODULES: { href: string; icon: IconName; title: string; desc: string; grad: string }[] = [
  { href: "/invoices", icon: "fileText", title: "Invoices", desc: "Raise & track customer invoices", grad: "from-blue-500 to-indigo-600" },
  { href: "/payments", icon: "payment", title: "Payments", desc: "Record & reconcile receipts", grad: "from-emerald-500 to-teal-600" },
  { href: "/quotations", icon: "quotation", title: "Quotations", desc: "Quotes & conversions", grad: "from-violet-500 to-purple-600" },
  { href: "/expenses", icon: "payment", title: "Expenses", desc: "Capture business spend", grad: "from-amber-500 to-orange-600" },
  { href: "/bills", icon: "fileText", title: "Bills & Payables", desc: "Vendor bills & dues", grad: "from-rose-500 to-pink-600" },
  { href: "/ledger", icon: "list", title: "Ledger", desc: "All money in & out", grad: "from-cyan-500 to-sky-600" },
  { href: "/account-reports", icon: "trendUp", title: "Reports", desc: "P&L, AR aging & trends", grad: "from-slate-500 to-slate-700" },
  { href: "/accounts", icon: "revenue", title: "Receivables", desc: "Legacy invoice hub", grad: "from-fuchsia-500 to-purple-600" },
];

export default function AccountDashboardPage() {
  const [data, setData] = useState<{ invoices: Invoice[]; payments: Payment[]; quotations: Quotation[]; expenses: Expense[]; bills: Bill[] } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setData({
        invoices: loadInvoices(),
        payments: loadPayments(),
        quotations: loadQuotations(),
        expenses: loadExpenses(),
        bills: loadBills(),
      });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const k = useMemo(() => {
    if (!data) return null;
    const invoiced = data.invoices.reduce((s, i) => s + invoiceTotal(i), 0);
    const received = data.payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
    const outstanding = data.invoices.reduce((s, i) => s + Math.max(0, invoiceTotal(i) - invoicePaid(i.id, data.payments)), 0);
    const expenses = data.expenses.filter((e) => e.status !== "rejected").reduce((s, e) => s + e.amount, 0);
    const payables = data.bills.reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0);
    const overdueAR = data.invoices.filter((i) => invoiceDisplayStatus(i, invoicePaid(i.id, data.payments)) === "overdue").length;
    const overdueBills = data.bills.filter((b) => billStatus(b) === "overdue").length;
    return { invoiced, received, outstanding, expenses, payables, net: received - expenses, overdueAR, overdueBills };
  }, [data]);

  const recentInvoices = useMemo(
    () => (data ? [...data.invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6) : []),
    [data],
  );
  const recentPayments = useMemo(
    () => (data ? [...data.payments].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6) : []),
    [data],
  );

  const loading = !data || !k;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white shadow-sm">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%),radial-gradient(circle_at_88%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="revenue" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Accounts</h1>
              <p className="mt-1 max-w-lg text-sm text-blue-100">Receivables, payables, expenses and reporting — your finance command centre.</p>
            </div>
          </div>
          <Link href="/invoices" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"><Icon name="plus" className="h-4 w-4" /> New Invoice</Link>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat label="Invoiced" value={loading ? "…" : money(k.invoiced)} />
          <HeroStat label="Received" value={loading ? "…" : money(k.received)} />
          <HeroStat label="Outstanding" value={loading ? "…" : money(k.outstanding)} />
          <HeroStat label="Net cash" value={loading ? "…" : money(k.net)} />
        </div>
      </div>

      {/* Alert strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AlertCard icon="payment" tone="amber" title="Expenses (recorded)" value={loading ? "…" : money(k.expenses)} sub="all non-rejected" href="/expenses" />
        <AlertCard icon="fileText" tone="rose" title="Payables outstanding" value={loading ? "…" : money(k.payables)} sub={loading ? "" : `${k.overdueBills} overdue`} href="/bills" />
        <AlertCard icon="alert" tone="blue" title="Overdue invoices" value={loading ? "…" : k.overdueAR} sub="need follow-up" href="/invoices" />
      </div>

      {/* Modules */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Modules</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white ${m.grad}`}><Icon name={m.icon} className="h-5 w-5" /></span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-blue-700">{m.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Recent invoices" href="/invoices">
          {loading ? <Loading /> : recentInvoices.length === 0 ? <Empty /> : (
            <div className="divide-y divide-slate-100">
              {recentInvoices.map((inv) => {
                const paid = invoicePaid(inv.id, data!.payments);
                const st = invoiceDisplayStatus(inv, paid);
                const meta = INVOICE_STATUS[st];
                return (
                  <div key={inv.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon name="fileText" className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{inv.customer}</p><p className="text-xs text-slate-400">{inv.number}</p></div>
                    <span className="text-sm font-semibold text-slate-700">{money(invoiceTotal(inv))}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Recent payments" href="/payments">
          {loading ? <Loading /> : recentPayments.length === 0 ? <Empty /> : (
            <div className="divide-y divide-slate-100">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><Icon name="check" className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{p.customer}</p><p className="text-xs text-slate-400">{p.number} · {p.invoiceNumber || "—"}</p></div>
                  <span className="text-sm font-semibold text-emerald-700">+{money(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}
function AlertCard({ icon, tone, title, value, sub, href }: { icon: IconName; tone: "amber" | "rose" | "blue"; title: string; value: ReactNode; sub: string; href: string }) {
  const map = { amber: "bg-amber-100 text-amber-600", rose: "bg-rose-100 text-rose-600", blue: "bg-blue-100 text-blue-600" } as const;
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${map[tone]}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="text-xl font-bold leading-none text-slate-900">{value}</p><p className="text-xs font-medium text-slate-600">{title}</p><p className="text-[11px] text-slate-400">{sub}</p></div>
    </Link>
  );
}
function Panel({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{href && <Link href={href} className="text-xs font-medium text-blue-600 hover:underline">View all</Link>}</div>
      {children}
    </div>
  );
}
function Loading() { return <div className="space-y-2 py-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}</div>; }
function Empty() { return <p className="py-6 text-center text-sm text-slate-400">Nothing yet</p>; }
