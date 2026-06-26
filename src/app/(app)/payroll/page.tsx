"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  formatMoney,
  generatePayslips,
  loadPayrollSettings,
  loadPayslips,
  monthKey,
  monthLabel,
  recentMonths,
  savePayslips,
  type PayStatus,
  type Payslip,
  type PayrollSettings,
} from "@/lib/hr";

const STATUS_STYLE: Record<PayStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-sky-100 text-sky-700",
  credited: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABEL: Record<PayStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  credited: "Credited",
};

export default function PayrollPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [view, setView] = useState<Payslip | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSettings(loadPayrollSettings());
      setSlips(loadPayslips());
      setLoading(false);
      setReady(true);
    }, 500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready) savePayslips(slips);
  }, [slips, ready]);

  const monthSlips = useMemo(() => slips.filter((s) => s.month === month), [slips, month]);
  const generated = monthSlips.length > 0;
  const totals = useMemo(() => ({
    net: monthSlips.reduce((a, s) => a + s.net, 0),
    pending: monthSlips.filter((s) => s.status === "pending").length,
    approved: monthSlips.filter((s) => s.status === "approved").length,
    credited: monthSlips.filter((s) => s.status === "credited").length,
  }), [monthSlips]);

  function generate() {
    if (!settings) return;
    if (generated) return toast.info("Already generated", `Payslips for ${monthLabel(month)} already exist.`);
    const fresh = generatePayslips(month, settings);
    setSlips((all) => [...all.filter((s) => s.month !== month), ...fresh]);
    toast.success("Payslips generated", `${fresh.length} payslips created for ${monthLabel(month)} — sent to Accounts for approval.`);
  }

  function update(id: string, patch: Partial<Payslip>) {
    setSlips((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  const stamp = () => new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

  function approve(s: Payslip) {
    update(s.id, { status: "approved", approvedAt: stamp(), approvedBy: "Accounts Team" });
    toast.success("Approved", `${s.employeeName}'s payslip approved by Accounts.`);
  }
  function credit(s: Payslip) {
    if (s.status !== "approved") return toast.error("Approval needed", "Accounts must approve before crediting.");
    update(s.id, { status: "credited", creditedAt: stamp() });
    toast.success("Salary credited", `${formatMoney(s.net)} credited to ${s.employeeName} (${s.bank}).`);
  }
  function bulk(action: "approve" | "credit") {
    const target = monthSlips.filter((s) => (action === "approve" ? s.status === "pending" : s.status === "approved"));
    if (target.length === 0) return toast.info("Nothing to do", action === "approve" ? "No payslips awaiting approval." : "No approved payslips to credit.");
    setSlips((all) => all.map((s) => {
      if (s.month !== month) return s;
      if (action === "approve" && s.status === "pending") return { ...s, status: "approved", approvedAt: stamp(), approvedBy: "Accounts Team" };
      if (action === "credit" && s.status === "approved") return { ...s, status: "credited", creditedAt: stamp() };
      return s;
    }));
    toast.success(action === "approve" ? "All approved" : "Salaries credited", `${target.length} payslips ${action === "approve" ? "approved by Accounts" : "credited successfully"}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">Generate payslips, get Accounts approval, then credit salaries.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
            {recentMonths(6).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <Link href="/admin-setup/payroll" className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Icon name="settings" className="h-4 w-4 text-slate-500" /> Settings
          </Link>
          <button onClick={generate} disabled={loading || generated} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            <Icon name="refresh" className="h-4 w-4" /> Generate Payslips
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Net payout" value={loading ? "" : formatMoney(totals.net)} loading={loading} tone="blue" />
        <StatCard label="Pending approval" value={String(totals.pending)} loading={loading} tone="amber" />
        <StatCard label="Approved" value={String(totals.approved)} loading={loading} tone="sky" />
        <StatCard label="Credited" value={String(totals.credited)} loading={loading} tone="emerald" />
      </div>

      {/* Bulk actions */}
      {generated && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <p className="text-sm text-slate-600">
            <strong>{monthSlips.length}</strong> payslips for <strong>{monthLabel(month)}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => bulk("approve")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Approve all (Accounts)
            </button>
            <button onClick={() => bulk("credit")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              Credit all salaries
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-scrollbar max-h-[60vh] overflow-auto rounded-t-2xl">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3 text-right">Gross</th>
                <th className="px-6 py-3 text-right">Deductions</th>
                <th className="px-6 py-3 text-right">Net pay</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r} className="border-b border-slate-100">{Array.from({ length: 6 }).map((_, c) => <td key={c} className="px-6 py-4"><Skeleton className="h-3.5 w-20" /></td>)}</tr>
                ))
              ) : !generated ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">No payslips for {monthLabel(month)}. Click <strong>Generate Payslips</strong> to create them.</td></tr>
              ) : (
                monthSlips.map((s) => (
                  <tr key={s.id} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{s.employeeName}</p>
                      <p className="text-xs text-slate-500">{s.designation} · {s.bank}</p>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-700">{formatMoney(s.gross)}</td>
                    <td className="px-6 py-4 text-right text-rose-600">−{formatMoney(s.deductions)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatMoney(s.net)}</td>
                    <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setView(s)} title="View payslip" className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Icon name="eye" className="h-[18px] w-[18px]" /></button>
                        {s.status === "pending" && (
                          <button onClick={() => approve(s)} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100">Approve</button>
                        )}
                        {s.status === "approved" && (
                          <button onClick={() => credit(s)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Credit</button>
                        )}
                        {s.status === "credited" && (
                          <span className="inline-flex items-center gap-1 px-1 text-xs font-medium text-emerald-600"><Icon name="check" className="h-3.5 w-3.5" /> Paid</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {view && <PayslipModal slip={view} onClose={() => setView(null)} />}
    </div>
  );
}

function StatCard({ label, value, loading, tone }: { label: string; value: string; loading: boolean; tone: "blue" | "amber" | "sky" | "emerald" }) {
  const tones = { blue: "text-blue-600", amber: "text-amber-600", sky: "text-sky-600", emerald: "text-emerald-600" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      {loading ? <Skeleton className="mt-2 h-6 w-20" /> : <p className={`mt-1 text-xl font-bold ${tones[tone]}`}>{value}</p>}
    </div>
  );
}

function PayslipModal({ slip, onClose }: { slip: Payslip; onClose: () => void }) {
  const rows: [string, number, boolean][] = [
    ["Basic", slip.basic, false],
    ["HRA", slip.hra, false],
    ["Special allowance", slip.special, false],
    ["Provident Fund", slip.pf, true],
    ["Professional Tax", slip.profTax, true],
    ["TDS / Income Tax", slip.tax, true],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Payslip · {monthLabel(slip.month)}</p>
            <p className="text-lg font-bold">{slip.employeeName}</p>
            <p className="text-xs text-white/80">{slip.designation}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/10"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </div>
        <div className="px-6 py-5">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, amt, isDeduction]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="py-2 text-slate-600">{label}</td>
                  <td className={`py-2 text-right font-medium ${isDeduction ? "text-rose-600" : "text-slate-800"}`}>{isDeduction ? "−" : ""}{formatMoney(amt)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200">
                <td className="py-3 text-sm font-bold text-slate-900">Net Pay</td>
                <td className="py-3 text-right text-lg font-bold text-emerald-600">{formatMoney(slip.net)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            <span>Status: <strong className="text-slate-700">{slip.status}</strong></span>
            <span>Bank: <strong className="text-slate-700">{slip.bank}</strong></span>
            <span>Generated: {slip.generatedAt}</span>
            {slip.approvedAt && <span>Approved: {slip.approvedAt} ({slip.approvedBy})</span>}
            {slip.creditedAt && <span className="col-span-2 text-emerald-600">Credited: {slip.creditedAt}</span>}
          </div>
          <button onClick={() => window.print()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Icon name="download" className="h-4 w-4" /> Print / Download
          </button>
        </div>
      </div>
    </div>
  );
}
