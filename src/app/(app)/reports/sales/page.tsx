"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeTotals,
  invoicePaid,
  loadInvoices,
  loadPayments,
  loadQuotations,
  money,
  type Invoice,
  type Payment,
  type Quotation,
} from "@/lib/billing";
import { exportCsv, inPeriod, type Period } from "@/lib/reportUtils";
import { BarChart, Card, Donut, MiniTable, RankBars, ReportHeader, StatCard } from "@/components/ReportKit";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function SalesReportPage() {
  const [data, setData] = useState<{ invoices: Invoice[]; payments: Payment[]; quotations: Quotation[] } | null>(null);
  const [period, setPeriod] = useState<Period>("90d");

  useEffect(() => {
    const t = setTimeout(
      () => setData({ invoices: loadInvoices(), payments: loadPayments(), quotations: loadQuotations() }),
      0,
    );
    return () => clearTimeout(t);
  }, []);

  const r = useMemo(() => {
    if (!data) return null;
    const payments = data.payments.filter((p) => inPeriod(p.date, period));
    const invoices = data.invoices.filter((i) => inPeriod(i.issueDate, period));
    const quotations = data.quotations.filter((q) => inPeriod(q.issueDate, period));

    const revenue = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
    const invoiced = invoices.reduce((s, i) => s + computeTotals(i.items, i.discountPct, i.taxPct).total, 0);
    const collected = invoices.reduce((s, i) => s + invoicePaid(i.id, data.payments), 0);
    const outstanding = Math.max(0, invoiced - collected);

    // Monthly revenue (last 6 months, from completed payments).
    const now = new Date();
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const value = data.payments
        .filter((p) => p.status === "completed" && (p.date || "").startsWith(key))
        .reduce((s, p) => s + p.amount, 0);
      months.push({ label: MONTHS[dt.getMonth()], value });
    }

    // Top customers by collected revenue.
    const byCustomer: Record<string, number> = {};
    payments.filter((p) => p.status === "completed").forEach((p) => {
      byCustomer[p.customer] = (byCustomer[p.customer] || 0) + p.amount;
    });
    const topCustomers = Object.entries(byCustomer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));

    // Payment method split.
    const byMethod: Record<string, number> = {};
    payments.filter((p) => p.status === "completed").forEach((p) => {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    });
    const methodColors: Record<string, string> = {
      card: "bg-blue-500", bank: "bg-emerald-500", cash: "bg-amber-500", upi: "bg-violet-500", cheque: "bg-rose-500",
    };
    const methods = Object.entries(byMethod).map(([k, v]) => ({
      label: k.toUpperCase(),
      value: v,
      color: methodColors[k] ?? "bg-slate-400",
    }));

    // Quotation conversion.
    const quoteCount = quotations.length;
    const accepted = quotations.filter((q) => q.status === "accepted" || q.convertedInvoiceId).length;
    const conversion = quoteCount > 0 ? (accepted / quoteCount) * 100 : 0;

    return { revenue, invoiced, collected, outstanding, months, topCustomers, methods, quoteCount, accepted, conversion, payments };
  }, [data, period]);

  function onExport() {
    if (!r) return;
    exportCsv(
      `sales-report-${period}`,
      r.payments.map((p) => ({
        Payment: p.number,
        Invoice: p.invoiceNumber,
        Customer: p.customer,
        Amount: p.amount,
        Method: p.method,
        Status: p.status,
        Date: p.date,
      })),
    );
  }

  if (!r) {
    return (
      <div className="space-y-6">
        <ReportHeader title="Sales Report" subtitle="Revenue, collections and conversion." />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Sales Report"
        subtitle="Revenue, collections and quotation conversion."
        period={period}
        onPeriodChange={setPeriod}
        onExport={onExport}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="revenue" label="Revenue collected" value={money(r.revenue)} wrap="bg-emerald-100 text-emerald-600" />
        <StatCard icon="fileText" label="Total invoiced" value={money(r.invoiced)} wrap="bg-blue-100 text-blue-600" />
        <StatCard icon="payment" label="Outstanding" value={money(r.outstanding)} wrap="bg-rose-100 text-rose-600" />
        <StatCard icon="deals" label="Quote conversion" value={`${r.conversion.toFixed(0)}%`} sub={`${r.accepted}/${r.quoteCount} accepted`} wrap="bg-violet-100 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Revenue — last 6 months" subtitle="Completed payments" className="lg:col-span-2">
          <BarChart data={r.months} color="bg-emerald-500" format={money} />
        </Card>
        <Card title="Payment methods" subtitle="Share of collections">
          <Donut segments={r.methods} format={money} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top customers" subtitle="By revenue collected">
          <RankBars rows={r.topCustomers} format={money} />
        </Card>
        <Card title="Recent payments">
          <MiniTable
            columns={[
              { key: "number", label: "Payment" },
              { key: "customer", label: "Customer" },
              { key: "amount", label: "Amount", align: "right" },
            ]}
            rows={r.payments.slice(0, 6).map((p) => ({
              number: p.number,
              customer: p.customer,
              amount: money(p.amount),
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
