"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { formatDate, money } from "@/lib/billing";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  EXPENSE_STATUS,
  loadExpenses,
  saveExpenses,
  type Expense,
  type ExpenseStatus,
} from "@/lib/finance";

const TABS: ("all" | ExpenseStatus)[] = ["all", "pending", "approved", "paid", "rejected"];
const monthKey = (iso: string) => (iso || "").slice(0, 7);
const thisMonth = new Date().toISOString().slice(0, 7);

export default function ExpensesPage() {
  const toast = useToast();
  const [list, setList] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"all" | ExpenseStatus>("all");
  const [cat, setCat] = useState("All categories");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setList(loadExpenses()); setReady(true); }, 0); return () => clearTimeout(t); }, []);
  useEffect(() => { if (ready) saveExpenses(list); }, [list, ready]);

  const stats = useMemo(() => {
    const active = list.filter((e) => e.status !== "rejected");
    return {
      total: active.reduce((s, e) => s + e.amount, 0),
      month: active.filter((e) => monthKey(e.date) === thisMonth).reduce((s, e) => s + e.amount, 0),
      pending: list.filter((e) => e.status === "pending").length,
      paid: list.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0),
    };
  }, [list]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((e) => tab === "all" || e.status === tab)
      .filter((e) => cat === "All categories" || e.category === cat)
      .filter((e) => !q || e.vendor.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [list, tab, cat, query]);

  function openAdd() { setEditing(null); setOpen(true); }
  function openEdit(e: Expense) { setEditing(e); setOpen(true); }
  function save(e: Expense) {
    setList((l) => (l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [e, ...l]));
    setOpen(false); setEditing(null);
    toast.success(editing ? "Expense updated" : "Expense added", `${e.category} · ${money(e.amount)}`);
  }
  function remove(id: string) { setList((l) => l.filter((x) => x.id !== id)); toast.info("Removed", "Expense deleted."); }
  function setStatus(id: string, status: ExpenseStatus) { setList((l) => l.map((x) => (x.id === id ? { ...x, status } : x))); }

  const catOptions: SelectOption[] = ["All categories", ...EXPENSE_CATEGORIES].map((c) => ({ value: c, label: c }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">Record and approve business spend across categories.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Add Expense</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="revenue" label="Total (active)" value={money(stats.total)} wrap="bg-slate-100 text-slate-600" />
        <Stat icon="calendar" label="This month" value={money(stats.month)} wrap="bg-blue-100 text-blue-600" />
        <Stat icon="check" label="Paid" value={money(stats.paid)} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="clock" label="Pending" value={stats.pending} wrap="bg-amber-100 text-amber-600" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44"><SearchableSelect value={cat} onChange={setCat} options={catOptions} /></div>
          <div className="relative"><Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-48 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
        </div>
      </div>

      {!ready ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : rows.length === 0 ? (
        <EmptyBox onAdd={openAdd} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Date</th><th className="px-5 py-3">Vendor / Description</th><th className="px-5 py-3">Category</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((e) => {
                  const meta = EXPENSE_STATUS[e.status];
                  return (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-600">{formatDate(e.date)}</td>
                      <td className="px-5 py-3"><p className="font-medium text-slate-800">{e.vendor || "—"}</p><p className="text-xs text-slate-400">{e.description || "—"}</p></td>
                      <td className="px-5 py-3 text-slate-600">{e.category}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-800">{money(e.amount)}</td>
                      <td className="px-5 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {e.status === "pending" && <button onClick={() => setStatus(e.id, "approved")} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">Approve</button>}
                          {e.status === "approved" && <button onClick={() => setStatus(e.id, "paid")} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Mark paid</button>}
                          <button onClick={() => openEdit(e)} aria-label="Edit" className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><Icon name="edit" className="h-4 w-4" /></button>
                          <button onClick={() => remove(e.id)} aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
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

      {open && <ExpenseModal editing={editing} onClose={() => { setOpen(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

function ExpenseModal({ editing, onClose, onSave }: { editing: Expense | null; onClose: () => void; onSave: (e: Expense) => void }) {
  const toast = useToast();
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(editing?.category ?? EXPENSE_CATEGORIES[0]);
  const [vendor, setVendor] = useState(editing?.vendor ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [method, setMethod] = useState(editing?.method ?? EXPENSE_METHODS[0]);
  const [status, setStatus] = useState<ExpenseStatus>(editing?.status ?? "pending");

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter amount", "Amount must be greater than zero."); return; }
    onSave({
      id: editing?.id ?? `exp-${Date.now().toString(36)}`,
      date, category, vendor: vendor.trim(), description: description.trim(), amount: amt, method,
      status, notes: editing?.notes ?? "",
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
  }

  const cls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between"><h2 className="text-lg font-bold">{editing ? "Edit expense" : "Add expense"}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button></div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <L label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} /></L>
            <L label="Amount (₹)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} placeholder="0.00" /></L>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <L label="Category"><SearchableSelect value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} /></L>
            <L label="Paid via"><SearchableSelect value={method} onChange={setMethod} options={EXPENSE_METHODS.map((m) => ({ value: m, label: m }))} /></L>
          </div>
          <L label="Vendor"><input value={vendor} onChange={(e) => setVendor(e.target.value)} className={cls} placeholder="e.g. Adobe" /></L>
          <L label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className={cls} placeholder="What was this for?" /></L>
          <L label="Status"><SearchableSelect value={status} onChange={(v) => setStatus(v as ExpenseStatus)} options={(["pending", "approved", "paid", "rejected"] as ExpenseStatus[]).map((s) => ({ value: s, label: EXPENSE_STATUS[s].label }))} /></L>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">{editing ? "Save changes" : "Add expense"}</button>
        </div>
      </form>
    </div>
  );
}

function L({ label, children }: { label: string; children: ReactNode }) { return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>; }
function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>;
}
function EmptyBox({ onAdd }: { onAdd: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="payment" className="h-7 w-7" /></div><p className="mt-3 text-sm font-semibold text-slate-700">No expenses yet</p><button onClick={onAdd} className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Add Expense</button></div>;
}
