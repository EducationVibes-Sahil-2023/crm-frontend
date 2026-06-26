"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Field, HrFooter, HrHero, HrModal, inputCls } from "@/components/HrUi";
import { MEDICAL_COVER, MEDICAL_TYPES, formatMoney, listEmployees, loadMedical, saveMedical, type MedicalClaim, type MedicalStatus } from "@/lib/hr";

const STATUS_STYLE: Record<MedicalStatus, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};

export default function MedicalPage() {
  const toast = useToast();
  const employees = useMemo(() => listEmployees(), []);
  const [claims, setClaims] = useState<MedicalClaim[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | MedicalStatus>("all");

  useEffect(() => { setClaims(loadMedical()); setReady(true); }, []);
  useEffect(() => { if (ready) saveMedical(claims); }, [claims, ready]);

  const approvedSpend = claims.filter((c) => c.status === "Approved").reduce((s, c) => s + c.amount, 0);
  const pending = claims.filter((c) => c.status === "Pending").length;
  const coverUsedPct = Math.min(100, Math.round((approvedSpend / (MEDICAL_COVER * employees.length)) * 100));
  const visible = claims.filter((c) => (filter === "all" ? true : c.status === filter));

  function add(c: Omit<MedicalClaim, "id" | "status">) { setClaims((l) => [{ ...c, id: `md-${Date.now()}`, status: "Pending" }, ...l]); setOpen(false); toast.success("Claim submitted", `${formatMoney(c.amount)} · ${c.type}`); }
  function decide(id: string, status: MedicalStatus) { setClaims((l) => l.map((c) => (c.id === id ? { ...c, status } : c))); toast.success(`Claim ${status.toLowerCase()}`); }

  return (
    <div className="space-y-6">
      <HrHero icon="ticket" title="Medical & Insurance" sub="Group health cover and reimbursement claims." actionLabel="New Claim" onAction={() => setOpen(true)} stats={[["Cover / head", formatMoney(MEDICAL_COVER)], ["Approved spend", formatMoney(approvedSpend)], ["Pending", String(pending)]]} />

      {/* Cover usage */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-800">Group cover utilisation</span><span className="text-slate-500">{formatMoney(approvedSpend)} of {formatMoney(MEDICAL_COVER * employees.length)}</span></div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${coverUsedPct}%` }} /></div>
        <p className="mt-1 text-xs text-slate-400">{coverUsedPct}% utilised across {employees.length} employees</p>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "Pending", "Approved", "Rejected"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filter === f ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{f === "all" ? "All" : f}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Employee</th><th className="px-3 py-3">Type</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">No claims here.</td></tr>
              ) : visible.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3"><p className="font-medium text-slate-800">{c.employee}</p>{c.note && <p className="text-xs text-slate-400">{c.note}</p>}</td>
                  <td className="px-3 py-3 text-slate-600">{c.type}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatMoney(c.amount)}</td>
                  <td className="px-3 py-3 text-slate-500">{c.claimDate}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[c.status]}`}>{c.status}</span></td>
                  <td className="px-3 py-3"><div className="flex items-center justify-end gap-1">
                    {c.status === "Pending" ? (
                      <>
                        <button onClick={() => decide(c.id, "Approved")} title="Approve" className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Icon name="check" className="h-4 w-4" /></button>
                        <button onClick={() => decide(c.id, "Rejected")} title="Reject" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="close" className="h-4 w-4" /></button>
                      </>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ClaimModal employees={employees.map((e) => e.name)} onClose={() => setOpen(false)} onSave={add} />}
    </div>
  );
}

function ClaimModal({ employees, onClose, onSave }: { employees: string[]; onClose: () => void; onSave: (c: Omit<MedicalClaim, "id" | "status">) => void }) {
  const toast = useToast();
  const [employee, setEmployee] = useState(employees[0] ?? "");
  const [type, setType] = useState(MEDICAL_TYPES[0]);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) return toast.error("Enter an amount");
    onSave({ employee, type, amount, note: note.trim(), claimDate: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) });
  }
  return (
    <HrModal title="New Medical Claim" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-4 px-6 py-6">
          <Field label="Employee"><select value={employee} onChange={(e) => setEmployee(e.target.value)} className={inputCls}>{employees.map((n) => <option key={n}>{n}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>{MEDICAL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Amount (₹)"><input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} /></Field>
          </div>
          <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description / hospital" className={inputCls} /></Field>
        </div>
        <HrFooter onClose={onClose} submitLabel="Submit Claim" />
      </form>
    </HrModal>
  );
}
