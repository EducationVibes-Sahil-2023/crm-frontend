"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import DocumentItems from "@/components/DocumentItems";
import LineItemsEditor from "@/components/LineItemsEditor";
import { type SelectOption } from "@/components/SearchableSelect";
import { Action, DetailModal, Empty, Field, FormModal, Hero, StatusBadge, TextInput, Toolbar } from "@/components/billing-ui";
import { useToast } from "@/components/Toast";
import {
  QUOTATION_STATUS,
  computeTotals,
  dateOffset,
  emptyItem,
  formatDate,
  loadInvoices,
  loadQuotations,
  money,
  nextInvoiceNumber,
  nextQuotationNumber,
  saveInvoices,
  saveQuotations,
  type Invoice,
  type LineItem,
  type Quotation,
  type QuotationStatus,
} from "@/lib/billing";

type StatusFilter = "all" | QuotationStatus;

const STATUS_OPTIONS: SelectOption[] = (Object.keys(QUOTATION_STATUS) as QuotationStatus[]).map((s) => ({
  value: s,
  label: QUOTATION_STATUS[s].label,
  dotClass: QUOTATION_STATUS[s].dot,
}));
const FILTER_OPTIONS: SelectOption[] = [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS];

export default function QuotationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Quotation[]>(loadQuotations);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadQuotations());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveQuotations(items);
  }, [items, ready]);

  const stats = useMemo(() => {
    const valueOf = (q: Quotation) => computeTotals(q.items, q.discountPct, q.taxPct).total;
    const accepted = items.filter((q) => q.status === "accepted");
    return {
      total: items.length,
      sent: items.filter((q) => q.status === "sent").length,
      accepted: accepted.length,
      value: accepted.reduce((s, q) => s + valueOf(q), 0),
    };
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((x) => filter === "all" || x.status === filter)
      .filter((x) => !q || x.number.toLowerCase().includes(q) || x.customer.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, query, filter]);

  const active = items.find((x) => x.id === activeId) ?? null;

  function create(draft: Omit<Quotation, "id" | "number" | "status" | "convertedInvoiceId" | "createdAt">) {
    const q: Quotation = {
      ...draft,
      id: `q-${new Date().getTime()}`,
      number: nextQuotationNumber(items),
      status: "draft",
      convertedInvoiceId: null,
      createdAt: new Date().toISOString(),
    };
    setItems((l) => [q, ...l]);
    setCreating(false);
    setActiveId(q.id);
    toast.success("Quotation created", `${q.number} saved as draft.`);
  }

  function setStatus(q: Quotation, status: QuotationStatus) {
    setItems((l) => l.map((x) => (x.id === q.id ? { ...x, status } : x)));
    toast.info("Status updated", `${q.number} → ${QUOTATION_STATUS[status].label}`);
  }

  function convertToInvoice(q: Quotation) {
    if (q.convertedInvoiceId) {
      toast.info("Already converted", `${q.number} has an invoice.`);
      return;
    }
    const invoices = loadInvoices();
    const invoice: Invoice = {
      id: `i-${new Date().getTime()}`,
      number: nextInvoiceNumber(invoices),
      customer: q.customer,
      customerEmail: q.customerEmail,
      items: q.items.map((it) => ({ ...it })),
      discountPct: q.discountPct,
      taxPct: q.taxPct,
      status: "draft",
      issueDate: dateOffset(0),
      dueDate: dateOffset(15),
      notes: q.notes,
      quotationId: q.id,
      createdAt: new Date().toISOString(),
    };
    saveInvoices([invoice, ...invoices]);
    setItems((l) => l.map((x) => (x.id === q.id ? { ...x, convertedInvoiceId: invoice.id, status: "accepted" } : x)));
    toast.success("Invoice created", `${invoice.number} from ${q.number}. Find it in Invoices.`);
  }

  function remove(q: Quotation) {
    setItems((l) => l.filter((x) => x.id !== q.id));
    setActiveId(null);
    toast.info("Quotation deleted", q.number);
  }

  return (
    <div className="space-y-6">
      <Hero
        title="Quotations"
        subtitle="Create, send and track price quotes — convert accepted ones to invoices."
        onCreate={() => setCreating(true)}
        createLabel="New Quotation"
        stats={[
          { label: "Total", value: String(stats.total) },
          { label: "Sent", value: String(stats.sent) },
          { label: "Accepted", value: String(stats.accepted) },
          { label: "Accepted value", value: money(stats.value) },
        ]}
      />

      <Toolbar
        query={query}
        onQuery={setQuery}
        filterValue={filter}
        onFilter={(v) => setFilter(v as StatusFilter)}
        filterOptions={FILTER_OPTIONS}
        placeholder="Search quotations…"
      />

      {visible.length === 0 ? (
        <Empty hasAny={items.length > 0} icon="quotation" label="quotation" onCreate={() => setCreating(true)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
            <span className="col-span-3">Quotation</span>
            <span className="col-span-3">Customer</span>
            <span className="col-span-2 text-right">Amount</span>
            <span className="col-span-2">Expiry</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          {visible.map((q, i) => {
            const total = computeTotals(q.items, q.discountPct, q.taxPct).total;
            return (
              <button
                key={q.id}
                onClick={() => setActiveId(q.id)}
                className={`grid w-full grid-cols-12 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                  i > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <div className="col-span-12 flex items-center gap-2 md:col-span-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Icon name="quotation" className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <p className="font-mono text-xs font-semibold text-slate-500">{q.number}</p>
                    <p className="text-[11px] text-slate-400">{formatDate(q.issueDate)}</p>
                  </div>
                </div>
                <div className="col-span-6 truncate md:col-span-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{q.customer}</p>
                  <p className="truncate text-xs text-slate-400">{q.customerEmail}</p>
                </div>
                <div className="col-span-3 text-left md:col-span-2 md:text-right">
                  <p className="text-sm font-bold text-slate-900">{money(total)}</p>
                </div>
                <div className="col-span-3 hidden text-xs text-slate-500 md:col-span-2 md:block">{formatDate(q.expiryDate)}</div>
                <div className="col-span-3 flex justify-end md:col-span-2">
                  <StatusBadge meta={QUOTATION_STATUS[q.status]} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {creating && <QuotationForm onClose={() => setCreating(false)} onCreate={create} />}

      {active && (
        <QuotationDetail
          q={active}
          onClose={() => setActiveId(null)}
          onStatus={(s) => setStatus(active, s)}
          onConvert={() => convertToInvoice(active)}
          onDelete={() => remove(active)}
        />
      )}
    </div>
  );
}

// Quotation create form ---------------------------------------------------

function QuotationForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: Omit<Quotation, "id" | "number" | "status" | "convertedInvoiceId" | "createdAt">) => void;
}) {
  const toast = useToast();
  const [customer, setCustomer] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [issueDate, setIssueDate] = useState(dateOffset(0));
  const [expiryDate, setExpiryDate] = useState(dateOffset(15));
  const [items, setItemsList] = useState<LineItem[]>([emptyItem()]);
  const [discountPct, setDiscount] = useState(0);
  const [taxPct, setTax] = useState(18);
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (customer.trim().length < 2) {
      toast.error("Add a customer", "Who is this quote for?");
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
      expiryDate,
      notes: notes.trim(),
    });
  }

  return (
    <FormModal title="New Quotation" onClose={onClose} onSubmit={submit} submitLabel="Create Quotation">
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
        <Field label="Expiry date">
          <TextInput type="date" value={expiryDate} onChange={setExpiryDate} />
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
          placeholder="Terms, validity, payment instructions…"
          className="no-scrollbar w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </Field>
    </FormModal>
  );
}

// Quotation detail --------------------------------------------------------

function QuotationDetail({
  q,
  onClose,
  onStatus,
  onConvert,
  onDelete,
}: {
  q: Quotation;
  onClose: () => void;
  onStatus: (s: QuotationStatus) => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  return (
    <DetailModal
      number={q.number}
      meta={`Issued ${formatDate(q.issueDate)} · Expires ${formatDate(q.expiryDate)}`}
      badge={QUOTATION_STATUS[q.status]}
      customer={q.customer}
      customerEmail={q.customerEmail}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">
            <Icon name="trash" className="h-4 w-4" />
            Delete
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {q.status === "draft" && <Action icon="send" label="Mark Sent" onClick={() => onStatus("sent")} />}
            {(q.status === "sent" || q.status === "draft") && (
              <>
                <Action icon="close" label="Reject" tone="rose" onClick={() => onStatus("rejected")} />
                <Action icon="check" label="Accept" tone="emerald" onClick={() => onStatus("accepted")} />
              </>
            )}
            {q.status === "accepted" && !q.convertedInvoiceId && (
              <Action icon="refresh" label="Convert to Invoice" tone="primary" onClick={onConvert} />
            )}
            {q.convertedInvoiceId && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <Icon name="check" className="h-4 w-4" />
                Invoiced
              </span>
            )}
          </div>
        </div>
      }
    >
      <DocumentItems items={q.items} discountPct={q.discountPct} taxPct={q.taxPct} />
      {q.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          <p className="text-sm text-slate-600">{q.notes}</p>
        </div>
      )}
    </DetailModal>
  );
}
