"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import SearchableSelect from "@/components/SearchableSelect";
import MobilePayslips from "@/components/mobile/MobilePayslips";
import {
  formatMoney,
  generatePayslips,
  loadPayrollSettings,
  loadPayslips,
  monthLabel,
  recentMonths,
  savePayslips,
  type Payslip,
} from "@/lib/hr";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  credited: "bg-emerald-100 text-emerald-700",
};

export default function PayslipsPage() {
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
      `Basic        ${formatMoney(p.basic)}`,
      `HRA          ${formatMoney(p.hra)}`,
      `Special Allw ${formatMoney(p.special)}`,
      `Gross        ${formatMoney(p.gross)}`, "",
      `PF           -${formatMoney(p.pf)}`,
      `Prof. Tax    -${formatMoney(p.profTax)}`,
      `TDS          -${formatMoney(p.tax)}`,
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
    <>
    {/* Phones: card-based payslip app. Desktop keeps the full table. */}
    <div className="lg:hidden">
      <MobilePayslips />
    </div>
    <div className="hidden space-y-6 lg:block">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="fileText" className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-bold">Payslips</h1><p className="mt-1 text-sm text-blue-100">Generate, credit and download monthly payslips.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <SearchableSelect value={month} onChange={setMonth} options={months.map((mk) => ({ value: mk, label: monthLabel(mk) }))} className="w-40" />

            <button onClick={generate} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"><Icon name="refresh" className="h-4 w-4" /> Generate</button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Payslips" value={String(monthSlips.length)} />
          <Stat label="Total net pay" value={formatMoney(totalNet)} />
          <Stat label="Credited" value={String(monthSlips.filter((s) => s.status === "credited").length)} />
        </div>
      </div>

      {monthSlips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="fileText" className="h-8 w-8" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-800">No payslips for {monthLabel(month)}</p>
          <p className="mt-1 text-sm text-slate-500">Generate payslips to credit salaries for this month.</p>
          <button onClick={generate} className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Generate now</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-800">{monthLabel(month)} · {monthSlips.length} payslips</p>
            <button onClick={creditAll} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Credit all</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Employee</th><th className="px-3 py-3 text-right">Gross</th><th className="px-3 py-3 text-right">Deductions</th><th className="px-3 py-3 text-right">Net Pay</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {monthSlips.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{p.employeeName}</p><p className="text-xs text-slate-400">{p.designation}</p></td>
                    <td className="px-3 py-3 text-right text-slate-600">{formatMoney(p.gross)}</td>
                    <td className="px-3 py-3 text-right text-rose-600">-{formatMoney(p.deductions)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatMoney(p.net)}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[p.status]}`}>{p.status}</span></td>
                    <td className="px-3 py-3"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(p)} title="View" className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Icon name="eye" className="h-4 w-4" /></button>
                      <button onClick={() => download(p)} title="Download" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="download" className="h-4 w-4" /></button>
                      {p.status !== "credited" && <button onClick={() => credit(p.id)} title="Credit" className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Icon name="check" className="h-4 w-4" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && <SlipModal slip={detail} onClose={() => setDetail(null)} onDownload={() => download(detail)} />}
    </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur"><p className="text-lg font-bold leading-none">{value}</p><p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p></div>;
}

function SlipModal({ slip, onClose, onDownload }: { slip: Payslip; onClose: () => void; onDownload: () => void }) {
  const rows: [string, number, boolean][] = [
    ["Basic", slip.basic, false], ["HRA", slip.hra, false], ["Special allowance", slip.special, false], ["Gross", slip.gross, false],
    ["Provident Fund", slip.pf, true], ["Professional tax", slip.profTax, true], ["TDS", slip.tax, true],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-6 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_80%)]" />
          <div className="relative flex items-start justify-between">
            <div><h2 className="text-lg font-bold">{slip.employeeName}</h2><p className="text-xs text-blue-100">{slip.designation} · {monthLabel(slip.month)}</p></div>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="space-y-1.5 px-6 py-5 text-sm">
          {rows.map(([label, val, neg]) => (
            <div key={label} className="flex items-center justify-between"><span className="text-slate-500">{label}</span><span className={neg ? "text-rose-600" : "text-slate-800"}>{neg ? "-" : ""}{formatMoney(val)}</span></div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Net Pay</span><span>{formatMoney(slip.net)}</span></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
          <button onClick={onDownload} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="download" className="h-4 w-4" /> Download</button>
        </div>
      </div>
    </div>
  );
}
