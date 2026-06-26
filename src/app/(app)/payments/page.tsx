"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { Empty, Field, FormModal, Hero, StatusBadge, TextInput, Toolbar } from "@/components/billing-ui";
import { useToast } from "@/components/Toast";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  computeTotals,
  dateOffset,
  formatDate,
  initials,
  invoicePaid,
  loadInvoices,
  loadPayments,
  methodLabel,
  money,
  nextPaymentNumber,
  savePayments,
  type Invoice,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/billing";

type StatusFilter = "all" | PaymentStatus;

const STATUS_OPTIONS: SelectOption[] = (Object.keys(PAYMENT_STATUS) as PaymentStatus[]).map((s) => ({
  value: s,
  label: PAYMENT_STATUS[s].label,
  dotClass: PAYMENT_STATUS[s].dot,
}));
const FILTER_OPTIONS: SelectOption[] = [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS];
const METHOD_OPTIONS: SelectOption[] = PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }));

export default function PaymentsPage() {
  const toast = useToast();
  const [payments, setPayments] = useState<Payment[]>(loadPayments);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setPayments(loadPayments());
    setInvoices(loadInvoices());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) savePayments(payments);
  }, [payments, ready]);

  const stats = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed");
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = completed
      .filter((p) => new Date(p.date).getTime() >= monthStart.getTime())
      .reduce((s, p) => s + p.amount, 0);
    return {
      received: completed.reduce((s, p) => s + p.amount, 0),
      thisMonth,
      count: payments.length,
      pending: payments.filter((p) => p.status === "pending").length,
    };
  }, [payments]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments
      .filter((p) => filter === "all" || p.status === filter)
      .filter(
        (p) =>
          !q ||
          p.number.toLowerCase().includes(q) ||
          p.customer.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, query, filter]);

  // Unpaid invoices available to record a payment against.
  const openInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        const total = computeTotals(inv.items, inv.discountPct, inv.taxPct).total;
        return invoicePaid(inv.id, payments) < total;
      }),
    [invoices, payments],
  );

  function create(p: Omit<Payment, "id" | "number" | "createdAt">) {
    const payment: Payment = {
      ...p,
      id: `p-${new Date().getTime()}`,
      number: nextPaymentNumber(payments),
      createdAt: new Date().toISOString(),
    };
    setPayments((l) => [payment, ...l]);
    setCreating(false);
    toast.success("Payment recorded", `${money(payment.amount)} from ${payment.customer}.`);
  }

  return (
    <div className="space-y-6">
      <Hero
        title="Payments"
        subtitle="Record and reconcile money received against your invoices."
        onCreate={() => setCreating(true)}
        createLabel="Record Payment"
        stats={[
          { label: "Total received", value: money(stats.received) },
          { label: "This month", value: money(stats.thisMonth) },
          { label: "Transactions", value: String(stats.count) },
          { label: "Pending", value: String(stats.pending) },
        ]}
      />

      <Toolbar
        query={query}
        onQuery={setQuery}
        filterValue={filter}
        onFilter={(v) => setFilter(v as StatusFilter)}
        filterOptions={FILTER_OPTIONS}
        placeholder="Search payments…"
      />

      {visible.length === 0 ? (
        <Empty hasAny={payments.length > 0} icon="payment" label="payment" onCreate={() => setCreating(true)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
            <span className="col-span-3">Payment</span>
            <span className="col-span-3">Customer</span>
            <span className="col-span-2">Invoice</span>
            <span className="col-span-2 text-right">Amount</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          {visible.map((p, i) => (
            <div
              key={p.id}
              className={`grid grid-cols-12 items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <div className="col-span-12 flex items-center gap-2 md:col-span-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Icon name="payment" className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-500">{p.number}</p>
                  <p className="text-[11px] text-slate-400">
                    {methodLabel(p.method)} · {formatDate(p.date)}
                  </p>
                </div>
              </div>
              <div className="col-span-6 flex items-center gap-2 truncate md:col-span-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
                  {initials(p.customer)}
                </span>
                <span className="truncate text-sm font-semibold text-slate-800">{p.customer}</span>
              </div>
              <div className="col-span-6 md:col-span-2">
                <span className="font-mono text-xs text-slate-500">{p.invoiceNumber || "—"}</span>
              </div>
              <div className="col-span-6 text-left md:col-span-2 md:text-right">
                <p className="text-sm font-bold text-slate-900">{money(p.amount)}</p>
                {p.reference && <p className="truncate text-[11px] text-slate-400">{p.reference}</p>}
              </div>
              <div className="col-span-6 flex justify-start md:col-span-2 md:justify-end">
                <StatusBadge meta={PAYMENT_STATUS[p.status]} />
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <PaymentForm
          openInvoices={openInvoices}
          payments={payments}
          methodOptions={METHOD_OPTIONS}
          onClose={() => setCreating(false)}
          onCreate={create}
        />
      )}
    </div>
  );
}

// Payment create form -----------------------------------------------------

function PaymentForm({
  openInvoices,
  payments,
  methodOptions,
  onClose,
  onCreate,
}: {
  openInvoices: Invoice[];
  payments: Payment[];
  methodOptions: SelectOption[];
  onClose: () => void;
  onCreate: (p: Omit<Payment, "id" | "number" | "createdAt">) => void;
}) {
  const toast = useToast();
  const [invoiceId, setInvoiceId] = useState("");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [status, setStatus] = useState<PaymentStatus>("completed");
  const [date, setDate] = useState(dateOffset(0));
  const [reference, setReference] = useState("");

  const invoiceOptions: SelectOption[] = [
    { value: "", label: "No invoice (manual)" },
    ...openInvoices.map((inv) => ({ value: inv.id, label: `${inv.number} · ${inv.customer}` })),
  ];
  const statusOptions: SelectOption[] = (Object.keys(PAYMENT_STATUS) as PaymentStatus[]).map((s) => ({
    value: s,
    label: PAYMENT_STATUS[s].label,
    dotClass: PAYMENT_STATUS[s].dot,
  }));

  function pickInvoice(id: string) {
    setInvoiceId(id);
    const inv = openInvoices.find((x) => x.id === id);
    if (inv) {
      setCustomer(inv.customer);
      const balance = computeTotals(inv.items, inv.discountPct, inv.taxPct).total - invoicePaid(inv.id, payments);
      setAmount(String(Math.max(0, balance)));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (customer.trim().length < 2) {
      toast.error("Add a customer", "Who paid?");
      return;
    }
    if (!value || value <= 0) {
      toast.error("Enter an amount", "The payment must be greater than zero.");
      return;
    }
    const inv = openInvoices.find((x) => x.id === invoiceId);
    onCreate({
      invoiceId: invoiceId || null,
      invoiceNumber: inv?.number ?? "",
      customer: customer.trim(),
      amount: value,
      method,
      status,
      date,
      reference: reference.trim(),
      notes: "",
    });
  }

  return (
    <FormModal title="Record Payment" onClose={onClose} onSubmit={submit} submitLabel="Record Payment">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Against invoice" className="sm:col-span-2">
          <SearchableSelect value={invoiceId} onChange={pickInvoice} options={invoiceOptions} placeholder="No invoice (manual)" />
        </Field>
        <Field label="Customer" required>
          <TextInput value={customer} onChange={setCustomer} placeholder="Who paid" />
        </Field>
        <Field label="Amount" required>
          <TextInput type="number" value={amount} onChange={setAmount} placeholder="0" />
        </Field>
        <Field label="Method">
          <SearchableSelect value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={methodOptions} />
        </Field>
        <Field label="Status">
          <SearchableSelect value={status} onChange={(v) => setStatus(v as PaymentStatus)} options={statusOptions} />
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
