"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import DocumentItems from "@/components/DocumentItems";
import LineItemsEditor from "@/components/LineItemsEditor";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { Action, DetailModal, Empty, Field, FormModal, Hero, StatusBadge, TextInput, Toolbar } from "@/components/billing-ui";
import { useToast } from "@/components/Toast";
import {
  INVOICE_STATUS,
  PAYMENT_METHODS,
  computeTotals,
  dateOffset,
  emptyItem,
  formatDate,
  invoiceDisplayStatus,
  invoicePaid,
  loadInvoices,
  loadPayments,
  methodLabel,
  money,
  nextInvoiceNumber,
  nextPaymentNumber,
  saveInvoices,
  savePayments,
  type Invoice,
  type InvoiceStatus,
  type LineItem,
  type Payment,
  type PaymentMethod,
} from "@/lib/billing";

type StatusFilter = "all" | InvoiceStatus;

const STATUS_OPTIONS: SelectOption[] = (Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((s) => ({
  value: s,
  label: INVOICE_STATUS[s].label,
  dotClass: INVOICE_STATUS[s].dot,
}));
const FILTER_OPTIONS: SelectOption[] = [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS];
const METHOD_OPTIONS: SelectOption[] = PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }));

export default function InvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>(loadInvoices);
  const [payments, setPayments] = useState<Payment[]>(loadPayments);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  useEffect(() => {
    setInvoices(loadInvoices());
    setPayments(loadPayments());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveInvoices(invoices);
  }, [invoices, ready]);

  const stats = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    for (const inv of invoices) {
      const total = computeTotals(inv.items, inv.discountPct, inv.taxPct).total;
      const paid = invoicePaid(inv.id, payments);
      const status = invoiceDisplayStatus(inv, paid);
      billed += total;
      collected += paid;
      outstanding += Math.max(0, total - paid);
      if (status === "overdue") overdue += total - paid;
    }
    return { billed, collected, outstanding, overdue };
  }, [invoices, payments]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices
      .map((inv) => {
        const total = computeTotals(inv.items, inv.discountPct, inv.taxPct).total;
        const paid = invoicePaid(inv.id, payments);
        return { inv, total, paid, status: invoiceDisplayStatus(inv, paid) };
      })
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !q || r.inv.number.toLowerCase().includes(q) || r.inv.customer.toLowerCase().includes(q))
      .sort((a, b) => b.inv.createdAt.localeCompare(a.inv.createdAt));
  }, [invoices, payments, query, filter]);

  const active = invoices.find((x) => x.id === activeId) ?? null;

  function create(draft: Omit<Invoice, "id" | "number" | "status" | "quotationId" | "createdAt">) {
    const inv: Invoice = {
      ...draft,
      id: `i-${new Date().getTime()}`,
      number: nextInvoiceNumber(invoices),
      status: "draft",
      quotationId: null,
      createdAt: new Date().toISOString(),
    };
    setInvoices((l) => [inv, ...l]);
    setCreating(false);
    setActiveId(inv.id);
    toast.success("Invoice created", `${inv.number} saved as draft.`);
  }

  function markSent(inv: Invoice) {
    setInvoices((l) => l.map((x) => (x.id === inv.id ? { ...x, status: "sent" } : x)));
    toast.info("Invoice sent", inv.number);
  }

  function recordPayment(inv: Invoice, amount: number, method: PaymentMethod, date: string, reference: string) {
    const payment: Payment = {
      id: `p-${new Date().getTime()}`,
      number: nextPaymentNumber(payments),
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      customer: inv.customer,
      amount,
      method,
      status: "completed",
      date,
      reference,
      notes: "",
      createdAt: new Date().toISOString(),
    };
    const next = [payment, ...payments];
    setPayments(next);
    savePayments(next);
    // Move a draft to "sent" once it's partially paid.
    if (inv.status === "draft") setInvoices((l) => l.map((x) => (x.id === inv.id ? { ...x, status: "sent" } : x)));
    setPaying(null);
    toast.success("Payment recorded", `${money(amount)} against ${inv.number}.`);
  }

  function remove(inv: Invoice) {
    setInvoices((l) => l.filter((x) => x.id !== inv.id));
    setActiveId(null);
    toast.info("Invoice deleted", inv.number);
  }

  return (
    <div className="space-y-6">
      <Hero
        title="Invoices"
        subtitle="Bill customers, record payments and keep an eye on what's outstanding."
        onCreate={() => setCreating(true)}
        createLabel="New Invoice"
        stats={[
          { label: "Billed", value: money(stats.billed) },
          { label: "Collected", value: money(stats.collected) },
          { label: "Outstanding", value: money(stats.outstanding) },
          { label: "Overdue", value: money(stats.overdue) },
        ]}
      />

      <Toolbar
        query={query}
        onQuery={setQuery}
        filterValue={filter}
        onFilter={(v) => setFilter(v as StatusFilter)}
        filterOptions={FILTER_OPTIONS}
        placeholder="Search invoices…"
      />

      {rows.length === 0 ? (
        <Empty hasAny={invoices.length > 0} icon="fileText" label="invoice" onCreate={() => setCreating(true)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
            <span className="col-span-3">Invoice</span>
            <span className="col-span-3">Customer</span>
            <span className="col-span-2 text-right">Total</span>
            <span className="col-span-2 text-right">Balance</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          {rows.map(({ inv, total, paid, status }, i) => (
            <button
              key={inv.id}
              onClick={() => setActiveId(inv.id)}
              className={`grid w-full grid-cols-12 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                i > 0 ? "border-t border-slate-100" : ""
              }`}
            >
              <div className="col-span-12 flex items-center gap-2 md:col-span-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon name="fileText" className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-500">{inv.number}</p>
                  <p className="text-[11px] text-slate-400">Due {formatDate(inv.dueDate)}</p>
                </div>
              </div>
              <div className="col-span-6 truncate md:col-span-3">
                <p className="truncate text-sm font-semibold text-slate-800">{inv.customer}</p>
                <p className="truncate text-xs text-slate-400">{inv.customerEmail}</p>
              </div>
              <div className="col-span-3 text-left md:col-span-2 md:text-right">
                <p className="text-sm font-bold text-slate-900">{money(total)}</p>
              </div>
              <div className="col-span-3 text-left md:col-span-2 md:text-right">
                <p className={`text-sm font-medium ${total - paid > 0 ? "text-slate-700" : "text-emerald-600"}`}>{money(total - paid)}</p>
              </div>
              <div className="col-span-6 flex justify-start md:col-span-2 md:justify-end">
                <StatusBadge meta={INVOICE_STATUS[status]} />
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && <InvoiceForm onClose={() => setCreating(false)} onCreate={create} />}

      {active && (
        <InvoiceDetail
          inv={active}
          payments={payments.filter((p) => p.invoiceId === active.id)}
          onClose={() => setActiveId(null)}
          onMarkSent={() => markSent(active)}
          onRecord={() => setPaying(active)}
          onDelete={() => remove(active)}
        />
      )}

      {paying && (
        <RecordPaymentModal
          invoice={paying}
          balance={Math.max(
            0,
            computeTotals(paying.items, paying.discountPct, paying.taxPct).total - invoicePaid(paying.id, payments),
          )}
          methodOptions={METHOD_OPTIONS}
          onClose={() => setPaying(null)}
          onSubmit={(amount, method, date, reference) => recordPayment(paying, amount, method, date, reference)}
        />
      )}
    </div>
  );
}

// Invoice create form -----------------------------------------------------

function InvoiceForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: Omit<Invoice, "id" | "number" | "status" | "quotationId" | "createdAt">) => void;
}) {
  const toast = useToast();
  const [customer, setCustomer] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [issueDate, setIssueDate] = useState(dateOffset(0));
  const [dueDate, setDueDate] = useState(dateOffset(15));
  const [items, setItemsList] = useState<LineItem[]>([emptyItem()]);
  const [discountPct, setDiscount] = useState(0);
  const [taxPct, setTax] = useState(18);
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (customer.trim().length < 2) {
      toast.error("Add a customer", "Who is this invoice for?");
      return;
    }
    if (items.every((it) => !it.description.trim())) {
      toast.error("Add a line item", "Describe at least one item.");
      return;
    }
    onCreate({
      customer: customer.trim(),
      customerEmail: customerEmail.trim() || "—",
      items: items.filter((it) => it.description.trim() || it.unitPrice > 0),
      discountPct,
      taxPct,
      issueDate,
      dueDate,
      notes: notes.trim(),
    });
  }

  return (
    <FormModal title="New Invoice" onClose={onClose} onSubmit={submit} submitLabel="Create Invoice">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Customer" required>
          <TextInput value={customer} onChange={setCustomer} placeholder="Company or person" />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={customerEmail} onChange={setCustomerEmail} placeholder="billing@company.com" />
        </Field>
        <Field label="Issue date">
          <TextInput type="date" value={issueDate} onChange={setIssueDate} />
        </Field>
        <Field label="Due date">
          <TextInput type="date" value={dueDate} onChange={setDueDate} />
        </Field>
      </div>

      <Field label="Items" className="mt-4">
        <LineItemsEditor items={items} onItems={setItemsList} discountPct={discountPct} onDiscount={setDiscount} taxPct={taxPct} onTax={setTax} />
      </Field>

      <Field label="Notes" className="mt-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Payment terms, bank details…"
          className="no-scrollbar w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </Field>
    </FormModal>
  );
}

// Invoice detail ----------------------------------------------------------

function InvoiceDetail({
  inv,
  payments,
  onClose,
  onMarkSent,
  onRecord,
  onDelete,
}: {
  inv: Invoice;
  payments: Payment[];
  onClose: () => void;
  onMarkSent: () => void;
  onRecord: () => void;
  onDelete: () => void;
}) {
  const total = computeTotals(inv.items, inv.discountPct, inv.taxPct).total;
  const paid = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const balance = total - paid;
  const status = invoiceDisplayStatus(inv, paid);

  return (
    <DetailModal
      number={inv.number}
      meta={`Issued ${formatDate(inv.issueDate)} · Due ${formatDate(inv.dueDate)}`}
      badge={INVOICE_STATUS[status]}
      customer={inv.customer}
      customerEmail={inv.customerEmail}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">
            <Icon name="trash" className="h-4 w-4" />
            Delete
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {inv.status === "draft" && <Action icon="send" label="Mark Sent" onClick={onMarkSent} />}
            {balance > 0 ? (
              <Action icon="payment" label="Record Payment" tone="primary" onClick={onRecord} />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <Icon name="check" className="h-4 w-4" />
                Fully paid
              </span>
            )}
          </div>
        </div>
      }
    >
      <DocumentItems
        items={inv.items}
        discountPct={inv.discountPct}
        taxPct={inv.taxPct}
        extra={[
          { label: "Paid", value: `−${money(paid)}`, tone: "emerald" },
          { label: "Balance due", value: money(balance), strong: true },
        ]}
      />

      {payments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Payments</p>
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Icon name="payment" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{money(p.amount)}</p>
                    <p className="text-[11px] text-slate-400">
                      {methodLabel(p.method)} · {formatDate(p.date)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-slate-400">{p.number}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inv.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          <p className="text-sm text-slate-600">{inv.notes}</p>
        </div>
      )}
    </DetailModal>
  );
}

// Record payment modal ----------------------------------------------------

function RecordPaymentModal({
  invoice,
  balance,
  methodOptions,
  onClose,
  onSubmit,
}: {
  invoice: Invoice;
  balance: number;
  methodOptions: SelectOption[];
  onClose: () => void;
  onSubmit: (amount: number, method: PaymentMethod, date: string, reference: string) => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [date, setDate] = useState(dateOffset(0));
  const [reference, setReference] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter an amount", "The payment must be greater than zero.");
      return;
    }
    onSubmit(value, method, date, reference.trim());
  }

  return (
    <FormModal title={`Record Payment · ${invoice.number}`} onClose={onClose} onSubmit={submit} submitLabel="Record Payment">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-500">Balance due</span>
        <span className="text-base font-bold text-slate-900">{money(balance)}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amount" required>
          <TextInput type="number" value={amount} onChange={setAmount} placeholder="0" />
        </Field>
        <Field label="Method">
          <SearchableSelect value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={methodOptions} />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={setDate} />
        </Field>
        <Field label="Reference">
          <TextInput value={reference} onChange={setReference} placeholder="Txn ID / cheque no." />
        </Field>
      </div>
    </FormModal>
  );
}
