"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import SearchableSelect from "@/components/SearchableSelect";
import {
  effectiveStatus,
  fmtDate,
  invoiceTotal,
  loadInvoices,
  money,
  nextInvoiceNumber,
  saveInvoices,
  STATUS_META,
  STATUS_ORDER,
  subtotal,
  taxAmount,
  type Invoice,
  type InvoiceStatus,
  type LineItem,
} from "@/lib/accounts";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AccountsPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>(loadInvoices);
  const [ready, setReady] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [composer, setComposer] = useState<{ open: boolean; editing: Invoice | null }>({ open: false, editing: null });
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => { setInvoices(loadInvoices()); setReady(true); }, []);
  useEffect(() => { if (ready) saveInvoices(invoices); }, [invoices, ready]);

  const stats = useMemo(() => {
    let invoiced = 0, paid = 0, outstanding = 0, overdue = 0, overdueCount = 0;
    for (const inv of invoices) {
      const eff = effectiveStatus(inv);
      const total = invoiceTotal(inv);
      if (eff === "void" || eff === "draft") continue;
      invoiced += total;
      if (eff === "paid") paid += total;
      else outstanding += total;
      if (eff === "overdue") { overdue += total; overdueCount++; }
    }
    return { invoiced, paid, outstanding, overdue, overdueCount };
  }, [invoices]);

  // Invoiced total per month for the last 6 months.
  const chart = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ label: MONTH_ABBR[d.getMonth()], total: 0 });
    }
    for (const inv of invoices) {
      if (effectiveStatus(inv) === "void" || inv.status === "draft") continue;
      const d = new Date(inv.issueDate + "T00:00:00");
      const idx = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (idx >= 0 && idx < 6) buckets[5 - idx].total += invoiceTotal(inv);
    }
    const max = Math.max(1, ...buckets.map((b) => b.total));
    return { buckets, max };
  }, [invoices]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices
      .filter((i) => (filter === "all" ? true : effectiveStatus(i) === filter))
      .filter((i) => !q || i.number.toLowerCase().includes(q) || i.client.toLowerCase().includes(q))
      .sort((a, b) => b.number.localeCompare(a.number));
  }, [invoices, query, filter]);

  function handleSave(draft: Omit<Invoice, "id" | "createdAt">, editingId?: string) {
    if (editingId) {
      setInvoices((list) => list.map((i) => (i.id === editingId ? { ...i, ...draft, id: editingId } : i)));
      toast.success("Invoice updated", draft.number);
    } else {
      const inv: Invoice = { ...draft, id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`, createdAt: new Date().toISOString() };
      setInvoices((list) => [inv, ...list]);
      toast.success("Invoice created", inv.number);
    }
    setComposer({ open: false, editing: null });
  }
  function setStatus(id: string, status: InvoiceStatus) {
    setInvoices((list) => list.map((i) => (i.id === id ? { ...i, status } : i)));
    toast.success(`Marked ${STATUS_META[status].label}`);
  }
  function remove(id: string) {
    setInvoices((list) => list.filter((i) => i.id !== id));
    setDetailId((d) => (d === id ? null : d));
    toast.info("Invoice deleted");
  }

  const detail = detailId ? invoices.find((i) => i.id === detailId) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="revenue" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Accounts</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">Manage invoices, payments and receivables for the finance team.</p>
            </div>
          </div>
          <button onClick={() => setComposer({ open: true, editing: null })} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
            <Icon name="folderPlus" className="h-4 w-4" /> New Invoice
          </button>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total Invoiced" value={money(stats.invoiced)} />
          <Stat label="Paid" value={money(stats.paid)} />
          <Stat label="Outstanding" value={money(stats.outstanding)} />
          <Stat label="Overdue" value={money(stats.overdue)} highlight={stats.overdue > 0} sub={stats.overdueCount ? `${stats.overdueCount} invoice${stats.overdueCount > 1 ? "s" : ""}` : undefined} />
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Invoiced revenue</h2>
            <p className="text-xs text-slate-500">Last 6 months</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{money(chart.buckets.reduce((s, b) => s + b.total, 0))} total</span>
        </div>
        <div className="mt-6 flex h-40 items-end gap-3 sm:gap-6">
          {chart.buckets.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end justify-center">
                <div className="w-8 rounded-t-md bg-slate-100 sm:w-12" style={{ height: "100%" }}>
                  <div className="mt-auto w-full rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: `${(b.total / chart.max) * 100}%` }} title={money(b.total)} />
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoices or clients…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          <Pill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {STATUS_ORDER.map((s) => <Pill key={s} label={STATUS_META[s].label} dot={STATUS_META[s].dot} active={filter === s} onClick={() => setFilter(s)} />)}
        </div>
      </div>

      {/* Invoice table */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="fileText" className="h-8 w-8" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-800">No invoices</p>
          <p className="mt-1 text-sm text-slate-500">Create your first invoice to start tracking receivables.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Issued</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((inv) => {
                  const eff = effectiveStatus(inv);
                  const m = STATUS_META[eff];
                  return (
                    <tr key={inv.id} onClick={() => setDetailId(inv.id)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{inv.number}</td>
                      <td className="px-3 py-3 text-slate-700">{inv.client}</td>
                      <td className="px-3 py-3 text-slate-500">{fmtDate(inv.issueDate)}</td>
                      <td className="px-3 py-3 text-slate-500">{fmtDate(inv.dueDate)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800">{money(invoiceTotal(inv))}</td>
                      <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${m.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {composer.open && (
        <Composer editing={composer.editing} nextNumber={nextInvoiceNumber(invoices)} onClose={() => setComposer({ open: false, editing: null })} onSave={handleSave} />
      )}
      {detail && (
        <DetailDrawer
          inv={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => setComposer({ open: true, editing: detail })}
          onDelete={() => remove(detail.id)}
          onStatus={(s) => setStatus(detail.id, s)}
        />
      )}
    </div>
  );
}

// ---- bits ----

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 backdrop-blur ${highlight ? "bg-rose-500/20 ring-rose-200/40" : "bg-white/10 ring-white/20"}`}>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
      {sub && <p className="text-[11px] text-blue-100/80">{sub}</p>}
    </div>
  );
}

function Pill({ label, dot, active, onClick }: { label: string; dot?: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${active ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white/80" : dot}`} />}
      {label}
    </button>
  );
}

// ---- Detail drawer (invoice preview) ----

function DetailDrawer({ inv, onClose, onEdit, onDelete, onStatus }: {
  inv: Invoice; onClose: () => void; onEdit: () => void; onDelete: () => void; onStatus: (s: InvoiceStatus) => void;
}) {
  const eff = effectiveStatus(inv);
  const m = STATUS_META[eff];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="no-scrollbar flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_80%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{inv.number}</h2>
              <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onEdit} aria-label="Edit" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="edit" className="h-4 w-4" /></button>
              <button onClick={onDelete} aria-label="Delete" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="trash" className="h-4 w-4" /></button>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bill to</p><p className="mt-0.5 font-semibold text-slate-800">{inv.client}</p>{inv.clientEmail && <p className="text-xs text-slate-500">{inv.clientEmail}</p>}</div>
            <div className="text-right"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dates</p><p className="mt-0.5 text-slate-700">Issued {fmtDate(inv.issueDate)}</p><p className="text-slate-700">Due {fmtDate(inv.dueDate)}</p></div>
          </div>

          {/* Line items */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
              <tbody>
                {inv.items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{it.description || "—"}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{it.qty}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{money(it.rate)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{money(it.qty * it.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ml-auto w-full max-w-[240px] space-y-1.5 text-sm">
            <Row label="Subtotal" value={money(subtotal(inv))} />
            {inv.taxRate > 0 && <Row label={`Tax (${inv.taxRate}%)`} value={money(taxAmount(inv))} />}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Total</span><span>{money(invoiceTotal(inv))}</span></div>
          </div>

          {inv.notes && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{inv.notes}</p></div>}
        </div>

        {/* Quick status actions */}
        <div className="mt-auto border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Update status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => (
              <button key={s} onClick={() => onStatus(s)} disabled={inv.status === s} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${inv.status === s ? STATUS_META[s].chip + " ring-2 ring-offset-1 ring-blue-300" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-slate-600"><span>{label}</span><span className="font-medium text-slate-800">{value}</span></div>;
}

// ---- Composer ----

function Composer({ editing, nextNumber, onClose, onSave }: {
  editing: Invoice | null; nextNumber: string;
  onClose: () => void; onSave: (draft: Omit<Invoice, "id" | "createdAt">, editingId?: string) => void;
}) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState(editing?.number ?? nextNumber);
  const [client, setClient] = useState(editing?.client ?? "");
  const [clientEmail, setClientEmail] = useState(editing?.clientEmail ?? "");
  const [issueDate, setIssueDate] = useState(editing?.issueDate ?? today);
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? today);
  const [status, setStatus] = useState<InvoiceStatus>(editing?.status ?? "draft");
  const [taxRate, setTaxRate] = useState(editing?.taxRate ?? 0);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [items, setItems] = useState<LineItem[]>(() => editing?.items ?? [{ id: "l-1", description: "", qty: 1, rate: 0 }]);

  const sub = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const tax = sub * (taxRate / 100);
  const total = sub + tax;

  function addItem() { setItems((l) => [...l, { id: `l-${Date.now()}-${Math.floor(Math.random() * 1000)}`, description: "", qty: 1, rate: 0 }]); }
  function updateItem(id: string, patch: Partial<LineItem>) { setItems((l) => l.map((it) => (it.id === id ? { ...it, ...patch } : it))); }
  function removeItem(id: string) { setItems((l) => (l.length > 1 ? l.filter((it) => it.id !== id) : l)); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client.trim()) return toast.error("Add a client");
    if (items.every((it) => !it.description.trim())) return toast.error("Add a line item", "Describe at least one item.");
    onSave(
      { number: number.trim(), client: client.trim(), clientEmail: clientEmail.trim() || undefined, issueDate, dueDate, status, taxRate, notes: notes.trim() || undefined, items: items.filter((it) => it.description.trim() || it.rate) },
      editing?.id,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="no-scrollbar my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? "Edit Invoice" : "New Invoice"}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Invoice #"><input value={number} onChange={(e) => setNumber(e.target.value)} className={inputCls} /></Field>
            <Field label="Status">
              <SearchableSelect
                value={status}
                onChange={(v) => setStatus(v as InvoiceStatus)}
                options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
                className="w-full"
              />
            </Field>
            <Field label="Client" required><input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Corp" className={inputCls} /></Field>
            <Field label="Client email"><input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="billing@acme.com" className={inputCls} /></Field>
            <Field label="Issue date"><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} /></Field>
            <Field label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
          </div>

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Line items</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><Icon name="plus" className="h-3.5 w-3.5" /> Add row</button>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <input value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Description" className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-blue-500" />
                  <input type="number" min={0} value={it.qty} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })} className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500" title="Qty" />
                  <input type="number" min={0} step="0.01" value={it.rate} onChange={(e) => updateItem(it.id, { rate: Number(e.target.value) })} className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500" title="Rate" />
                  <span className="w-24 shrink-0 text-right text-sm font-medium text-slate-700">{money(it.qty * it.rate)}</span>
                  <button type="button" onClick={() => removeItem(it.id)} aria-label="Remove" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="close" className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <Field label="Tax rate (%)"><input type="number" min={0} step="0.1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-32 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></Field>
            <div className="w-full max-w-[240px] space-y-1.5 text-sm">
              <Row label="Subtotal" value={money(sub)} />
              {taxRate > 0 && <Row label={`Tax (${taxRate}%)`} value={money(tax)} />}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Total</span><span>{money(total)}</span></div>
            </div>
          </div>

          <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payment terms, thank-you note…" className={`${inputCls} resize-none`} /></Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{editing ? "Save Changes" : "Create Invoice"}</button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label} {required && <span className="text-rose-500">*</span>}</label>
      {children}
    </div>
  );
}
