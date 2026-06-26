"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_PAYROLL,
  computeSalary,
  formatMoney,
  loadPayrollSettings,
  savePayrollSettings,
  type PayrollSettings,
} from "@/lib/hr";

export default function PayrollSettingsForm() {
  const toast = useToast();
  const [cfg, setCfg] = useState<PayrollSettings>(loadPayrollSettings);

  useEffect(() => {
    savePayrollSettings(cfg);
  }, [cfg]);

  const set = <K extends keyof PayrollSettings>(k: K, v: PayrollSettings[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const preview = computeSalary(60000, cfg); // sample on ₹60,000 CTC

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Pay schedule, salary structure logic, and the approval flow.</p>
        </div>
        <button onClick={() => { setCfg({ ...DEFAULT_PAYROLL }); toast.info("Reset", "Payroll settings restored to defaults."); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Schedule */}
          <Card title="Pay schedule" icon="calendar">
            <Grid>
              <Field label="Salary credit day (of month)">
                <Num value={cfg.payDay} onChange={(v) => set("payDay", clamp(v, 1, 28))} />
              </Field>
              <Field label="Attendance cut-off day">
                <Num value={cfg.cutoffDay} onChange={(v) => set("cutoffDay", clamp(v, 1, 31))} />
              </Field>
            </Grid>
            <p className="text-xs text-slate-500">
              Salaries are credited on day <strong>{cfg.payDay}</strong> each month for the cycle ending on day <strong>{cfg.cutoffDay}</strong>.
            </p>
          </Card>

          {/* Components */}
          <Card title="Salary structure" icon="revenue">
            <Grid>
              <Field label="Basic (% of CTC)"><Num value={cfg.basicPct} onChange={(v) => set("basicPct", clamp(v, 0, 100))} suffix="%" /></Field>
              <Field label="HRA (% of Basic)"><Num value={cfg.hraPct} onChange={(v) => set("hraPct", clamp(v, 0, 100))} suffix="%" /></Field>
              <Field label="Provident Fund (% of Basic)"><Num value={cfg.pfPct} onChange={(v) => set("pfPct", clamp(v, 0, 100))} suffix="%" /></Field>
              <Field label="TDS / Income Tax (% of Gross)"><Num value={cfg.taxPct} onChange={(v) => set("taxPct", clamp(v, 0, 100))} suffix="%" /></Field>
              <Field label="Professional Tax (flat)"><Num value={cfg.professionalTax} onChange={(v) => set("professionalTax", Math.max(0, v))} /></Field>
            </Grid>
            <p className="text-xs text-slate-500">Special allowance is the balancing figure: CTC − Basic − HRA.</p>
          </Card>

          {/* Approval */}
          <Card title="Approval flow" icon="check">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">Require Accounts approval</p>
                <p className="text-xs text-slate-500">Payslips must be approved by the Accounts team before salaries are credited.</p>
              </div>
              <Switch checked={cfg.requireApproval} onChange={(v) => set("requireApproval", v)} />
            </div>
            <ol className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {["Generate", "Pending approval", "Accounts approves", "Salary credited"].map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{i + 1}. {step}</span>
                  {i < 3 && <Icon name="chevronDown" className="h-3 w-3 -rotate-90 text-slate-300" />}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Preview on {formatMoney(60000)} CTC</p>
            <table className="mt-3 w-full text-sm">
              <tbody>
                <PreviewRow label="Basic" value={preview.basic} />
                <PreviewRow label="HRA" value={preview.hra} />
                <PreviewRow label="Special allowance" value={preview.special} />
                <tr className="border-t border-slate-200"><td className="py-2 font-semibold text-slate-700">Gross</td><td className="py-2 text-right font-semibold text-slate-800">{formatMoney(preview.gross)}</td></tr>
                <PreviewRow label="PF" value={-preview.pf} />
                <PreviewRow label="Professional Tax" value={-preview.profTax} />
                <PreviewRow label="TDS" value={-preview.tax} />
                <tr className="border-t-2 border-slate-200"><td className="py-2.5 font-bold text-slate-900">Net pay</td><td className="py-2.5 text-right text-lg font-bold text-emerald-600">{formatMoney(preview.net)}</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-400">Changes save automatically and apply to the next payslip generation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n || 0)); }

function Card({ title, icon, children }: { title: string; icon: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon name={icon} className="h-4 w-4 text-slate-400" /> {title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>;
}
function Num({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" />
      {suffix && <span className="px-3 text-sm text-slate-400">{suffix}</span>}
    </div>
  );
}
function PreviewRow({ label, value }: { label: string; value: number }) {
  const neg = value < 0;
  return <tr className="border-b border-slate-100"><td className="py-2 text-slate-600">{label}</td><td className={`py-2 text-right font-medium ${neg ? "text-rose-600" : "text-slate-800"}`}>{neg ? "−" : ""}{formatMoney(Math.abs(value))}</td></tr>;
}
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label="Require approval" onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}
