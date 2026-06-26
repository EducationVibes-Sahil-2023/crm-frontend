"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { daysBetween, formatDate, money } from "@/lib/billing";
import {
  BILL_STATUS,
  billStatus,
  EXPENSE_CATEGORIES,
  loadBills,
  nextBillNumber,
  saveBills,
  type Bill,
  type BillStatus,
} from "@/lib/finance";

const TABS: ("all" | BillStatus)[] = ["all", "unpaid", "partial", "overdue", "paid"];
const today = new Date().toISOString().slice(0, 10);

export default function BillsPage() {
  const toast = useToast();
  const [list, setList] = useState<Bill[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"all" | BillStatus>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Bill | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setList(loadBills()); setReady(true); }, 0); return () => clearTimeout(t); }, []);
  useEffect(() => { if (ready) saveBills(list); }, [list, ready]);

  const stats = useMemo(() => {
    const outstanding = list.reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0);
    const overdue = list.filter((b) => billStatus(b) === "overdue");
    const dueSoon = list.filter((b) => { const st = billStatus(b); return (st === "unpaid" || st === "partial") && b.dueDate >= today && daysBetween(today, b.dueDate) <= 7; });
    return {
      outstanding,
      overdue: overdue.reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0),
      overdueCount: overdue.length,
      dueSoon: dueSoon.length,
      paid: list.filter((b) => billStatus(b) === "paid").length,
    };
  }, [list]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .map((b) => ({ b, st: billStatus(b) }))
      .filter(({ st }) => tab === "all" || st === tab)
      .filter(({ b }) => !q || b.vendor.toLowerCase().includes(q) || b.number.toLowerCase().includes(q) || b.category.toLowerCase().includes(q))
      .sort((a, b) => (a.b.dueDate || "").localeCompare(b.b.dueDate || ""));
  }, [list, tab, query]);

  function openAdd() { setEditing(null); setOpen(true); }
  function openEdit(b: Bill) { setEditing(b); setOpen(true); }
  function save(b: Bill) {
    setList((l) => (l.some((x) => x.id === b.id) ? l.map((x) => (x.id === b.id ? b : x)) : [b, ...l]));
    setOpen(false); setEditing(null);
    toast.success(editing ? "Bill updated" : "Bill added", `${b.vendor} · ${money(b.amount)}`);
  }
  function markPaid(id: string) { setList((l) => l.map((b) => (b.id === id ? { ...b, paidAmount: b.amount } : b))); toast.success("Marked paid", "Bill settled."); }
  function remove(id: string) { setList((l) => l.filter((b) => b.id !== id)); toast.info("Removed", "Bill deleted."); }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bills &amp; Payables</h1>
          <p className="mt-1 text-sm text-slate-500">Track vendor bills, due dates and what you owe.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Add Bill</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="fileText" label="Outstanding" value={money(stats.outstanding)} wrap="bg-slate-100 text-slate-600" />
        <Stat icon="alert" label="Overdue" value={money(stats.overdue)} wrap="bg-rose-100 text-rose-600" />
        <Stat icon="clock" label="Due in 7 days" value={stats.dueSoon} wrap="bg-amber-100 text-amber-600" />
        <Stat icon="check" label="Settled" value={stats.paid} wrap="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{t}</button>
          ))}
        </div>
        <div className="relative"><Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vendor / bill…" className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
      </div>

      {!ready ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="fileText" className="h-7 w-7" /></div><p className="mt-3 text-sm font-semibold text-slate-700">No bills here</p><button onClick={openAdd} className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Add Bill</button></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Bill</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Due</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map(({ b, st }) => {
                  const meta = BILL_STATUS[st];
                  const bal = Math.max(0, b.amount - b.paidAmount);
                  return (
                    <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3"><p className="font-medium text-slate-800">{b.number}</p><p className="text-xs text-slate-400">{b.category}</p></td>
                      <td className="px-5 py-3 text-slate-600">{b.vendor}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(b.dueDate)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{money(b.amount)}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-800">{money(bal)}</td>
                      <td className="px-5 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {st !== "paid" && <button onClick={() => markPaid(b.id)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Pay</button>}
                          <button onClick={() => openEdit(b)} aria-label="Edit" className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><Icon name="edit" className="h-4 w-4" /></button>
                          <button onClick={() => remove(b.id)} aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && <BillModal editing={editing} existing={list} onClose={() => { setOpen(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

function BillModal({ editing, existing, onClose, onSave }: { editing: Bill | null; existing: Bill[]; onClose: () => void; onSave: (b: Bill) => void }) {
  const toast = useToast();
  const [vendor, setVendor] = useState(editing?.vendor ?? "");
  const [category, setCategory] = useState(editing?.category ?? EXPENSE_CATEGORIES[0]);
  const [issueDate, setIssueDate] = useState(editing?.issueDate ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [paidAmount, setPaidAmount] = useState(editing ? String(editing.paidAmount) : "0");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const amt = Number(amount);
    if (!vendor.trim() || !amt || amt <= 0 || !dueDate) { toast.error("Incomplete", "Vendor, amount and due date are required."); return; }
    onSave({
      id: editing?.id ?? `bill-${Date.now().toString(36)}`,
      number: editing?.number ?? nextBillNumber(existing),
      vendor: vendor.trim(), category, issueDate, dueDate,
      amount: amt, paidAmount: Math.min(amt, Math.max(0, Number(paidAmount) || 0)),
      notes: notes.trim(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
  }

  const cls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between"><h2 className="text-lg font-bold">{editing ? "Edit bill" : "Add bill"}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button></div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <L label="Vendor"><input value={vendor} onChange={(e) => setVendor(e.target.value)} className={cls} placeholder="e.g. AWS" /></L>
            <L label="Category"><SearchableSelect value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} /></L>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <L label="Issue date"><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={cls} /></L>
            <L label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cls} /></L>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <L label="Amount (₹)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} placeholder="0.00" /></L>
            <L label="Paid so far (₹)"><input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className={cls} placeholder="0.00" /></L>
          </div>
          <L label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} placeholder="Reference / description" /></L>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">{editing ? "Save changes" : "Add bill"}</button>
        </div>
      </form>
    </div>
  );
}

function L({ label, children }: { label: string; children: ReactNode }) { return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>; }
function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>;
}
