"use client";

// Mobile (phones-only) Payslips — pick a month, generate, then view / download /
// credit each slip from a tidy card list. Rendered only inside `lg:hidden` on the
// payslips page; reads/writes the same `hr_payslips_v1` store as desktop.

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  formatMoney, generatePayslips, loadPayrollSettings, loadPayslips, monthLabel,
  recentMonths, savePayslips, type Payslip,
} from "@/lib/hr";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  credited: "bg-emerald-100 text-emerald-700",
};
const initials = (s: string) => s.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function MobilePayslips() {
  const toast = useToast();
  const months = useMemo(() => recentMonths(6), []);
  const [month, setMonth] = useState(months[0]);
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [ready, setReady] = useState(false);
  const [detail, setDetail] = useState<Payslip | null>(null);

  useEffect(() => { setSlips(loadPayslips()); setReady(true); }, []);
  useEffect(() => { if (ready) savePayslips(slips); }, [slips, ready]);

  const monthSlips = slips.filter((s) => s.month === month);
  const totalNet = monthSlips.reduce((s, p) => s + p.net, 0);
  const credited = monthSlips.filter((s) => s.status === "credited").length;

  function generate() {
    const fresh = generatePayslips(month, loadPayrollSettings());
    setSlips((list) => [...list.filter((s) => s.month !== month), ...fresh]);
    toast.success("Payslips generated", `${fresh.length} slips for ${monthLabel(month)}.`);
  }
  function credit(id: string) {
    const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    setSlips((list) => list.map((s) => (s.id === id ? { ...s, status: "credited", creditedAt: stamp } : s)));
  }
  function creditAll() {
    const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    setSlips((list) => list.map((s) => (s.month === month ? { ...s, status: "credited", creditedAt: stamp } : s)));
    toast.success("Salaries credited", monthLabel(month));
  }
  function download(p: Payslip) {
    const lines = [
      `PAYSLIP — ${monthLabel(p.month)}`, "",
      `Employee : ${p.employeeName}`, `Designation : ${p.designation}`, `Bank A/C : ${p.bank}`, "",
      `Basic        ${formatMoney(p.basic)}`, `HRA          ${formatMoney(p.hra)}`, `Special Allw ${formatMoney(p.special)}`,
      `Gross        ${formatMoney(p.gross)}`, "",
      `PF           -${formatMoney(p.pf)}`, `Prof. Tax    -${formatMoney(p.profTax)}`, `TDS          -${formatMoney(p.tax)}`,
      `Deductions   -${formatMoney(p.deductions)}`, "",
      `NET PAY      ${formatMoney(p.net)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payslip-${p.employeeName.replace(/\s+/g, "-")}-${p.month}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3 pb-2">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold leading-tight">Payslips</h1>
            <p className="text-xs text-blue-100">{monthSlips.length} slips · {credited} credited</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/25"><Icon name="fileText" className="h-5 w-5" /></span>
        </div>
        <div className="mt-3 flex gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="flex-1 rounded-xl border-0 bg-white/15 px-3 py-2.5 text-sm font-semibold text-white outline-none ring-1 ring-white/20 focus:bg-white/25">
            {months.map((mk) => <option key={mk} value={mk} className="text-slate-900">{monthLabel(mk)}</option>)}
          </select>
          <button onClick={generate} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition active:scale-95">
            <Icon name="refresh" className="h-4 w-4" /> {monthSlips.length ? "Re-gen" : "Generate"}
          </button>
        </div>
        {monthSlips.length > 0 && (
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-100">Total net pay</p>
            <p className="text-lg font-bold">{formatMoney(totalNet)}</p>
          </div>
        )}
      </section>

      {monthSlips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Icon name="fileText" className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No payslips for {monthLabel(month)}</p>
          <p className="text-xs text-slate-400">Generate to credit salaries this month.</p>
          <button onClick={generate} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-95">Generate now</button>
        </div>
      ) : (
        <>
          {credited < monthSlips.length && (
            <button onClick={creditAll} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition active:scale-95">
              <Icon name="check" className="h-4 w-4" /> Credit all ({monthSlips.length - credited} pending)
            </button>
          )}
          <section className="space-y-2.5">
            {monthSlips.map((p) => (
              <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{initials(p.employeeName)}</span>
                  <div className="min-w-0 flex-1" onClick={() => setDetail(p)}>
                    <p className="truncate text-sm font-semibold text-slate-900">{p.employeeName}</p>
                    <p className="truncate text-xs text-slate-500">{p.designation}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatMoney(p.net)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  </div>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button onClick={() => setDetail(p)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-600 transition active:scale-95"><Icon name="eye" className="h-3.5 w-3.5" /> View</button>
                  <button onClick={() => download(p)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-600 transition active:scale-95"><Icon name="download" className="h-3.5 w-3.5" /> Slip</button>
                  {p.status !== "credited" && <button onClick={() => credit(p.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 transition active:scale-95"><Icon name="check" className="h-3.5 w-3.5" /> Credit</button>}
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {detail && <SlipSheet slip={detail} onClose={() => setDetail(null)} onDownload={() => download(detail)} />}
    </div>
  );
}

function SlipSheet({ slip, onClose, onDownload }: { slip: Payslip; onClose: () => void; onDownload: () => void }) {
  const rows: [string, number, boolean][] = [
    ["Basic", slip.basic, false], ["HRA", slip.hra, false], ["Special allowance", slip.special, false], ["Gross", slip.gross, false],
    ["Provident Fund", slip.pf, true], ["Professional tax", slip.profTax, true], ["TDS", slip.tax, true],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" />
        <div className="flex items-center justify-between px-5 pt-3">
          <div><h3 className="text-base font-bold text-slate-900">{slip.employeeName}</h3><p className="text-xs text-slate-500">{slip.designation} · {monthLabel(slip.month)}</p></div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-1.5 px-5 pt-4 text-sm">
          {rows.map(([label, val, neg]) => (
            <div key={label} className="flex items-center justify-between"><span className="text-slate-500">{label}</span><span className={neg ? "text-rose-600" : "text-slate-800"}>{neg ? "-" : ""}{formatMoney(val)}</span></div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Net Pay</span><span>{formatMoney(slip.net)}</span></div>
          <button onClick={onDownload} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition active:scale-95"><Icon name="download" className="h-4 w-4" /> Download slip</button>
        </div>
      </div>
    </div>
  );
}
