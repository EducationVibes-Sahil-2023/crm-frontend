// Local-first billing module: quotations, invoices and payments. Persists to
// localStorage so it works without a backend; swap these helpers for `api`
// calls later. The three documents are cross-linked:
//   quotation --(convert)--> invoice <--(pays)-- payment

export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type DocTotals = { subtotal: number; discount: number; tax: number; total: number };

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";
export type PaymentMethod = "card" | "bank" | "cash" | "upi" | "cheque";
export type PaymentStatus = "completed" | "pending" | "failed" | "refunded";

export type Quotation = {
  id: string;
  number: string; // QUO-1001
  customer: string;
  customerEmail: string;
  items: LineItem[];
  discountPct: number;
  taxPct: number;
  status: QuotationStatus;
  issueDate: string; // yyyy-mm-dd
  expiryDate: string;
  notes: string;
  convertedInvoiceId: string | null;
  createdAt: string; // ISO
};

export type Invoice = {
  id: string;
  number: string; // INV-2001
  customer: string;
  customerEmail: string;
  items: LineItem[];
  discountPct: number;
  taxPct: number;
  status: InvoiceStatus; // stored "draft"/"sent"; paid/partial/overdue are derived
  issueDate: string;
  dueDate: string;
  notes: string;
  quotationId: string | null;
  createdAt: string;
};

export type Payment = {
  id: string;
  number: string; // PAY-3001
  invoiceId: string | null;
  invoiceNumber: string;
  customer: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: string; // yyyy-mm-dd
  reference: string;
  notes: string;
  createdAt: string;
};

// ── Status metadata ────────────────────────────────────────────────
export const QUOTATION_STATUS: Record<QuotationStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Draft", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  sent: { label: "Sent", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  accepted: { label: "Accepted", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  expired: { label: "Expired", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Draft", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  sent: { label: "Sent", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  partial: { label: "Partially Paid", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  paid: { label: "Paid", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  overdue: { label: "Overdue", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; badge: string; dot: string }> = {
  completed: { label: "Completed", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  failed: { label: "Failed", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  refunded: { label: "Refunded", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
];

export function methodLabel(m: PaymentMethod): string {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
}

// ── Money + dates ──────────────────────────────────────────────────
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function money(n: number): string {
  return inr.format(isFinite(n) ? n : 0);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// yyyy-mm-dd offset from today (negative = past).
export function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isPast(iso: string): boolean {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

// ── Line-item math ─────────────────────────────────────────────────
export function lineTotal(item: LineItem): number {
  return (item.quantity || 0) * (item.unitPrice || 0);
}

export function computeTotals(items: LineItem[], discountPct: number, taxPct: number): DocTotals {
  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const discount = (subtotal * (discountPct || 0)) / 100;
  const taxBase = subtotal - discount;
  const tax = (taxBase * (taxPct || 0)) / 100;
  return { subtotal, discount, tax, total: taxBase + tax };
}

export function emptyItem(): LineItem {
  return { id: `li-${Date.now()}-${Math.floor(Math.random() * 100000)}`, description: "", quantity: 1, unitPrice: 0 };
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// ── Derived invoice state ──────────────────────────────────────────
export function invoicePaid(invoiceId: string, payments: Payment[]): number {
  return payments
    .filter((p) => p.invoiceId === invoiceId && p.status === "completed")
    .reduce((s, p) => s + p.amount, 0);
}

export function invoiceDisplayStatus(inv: Invoice, paid: number): InvoiceStatus {
  const total = computeTotals(inv.items, inv.discountPct, inv.taxPct).total;
  if (paid >= total && total > 0) return "paid";
  if (paid > 0) return "partial";
  if (inv.status === "draft") return "draft";
  if (isPast(inv.dueDate)) return "overdue";
  return "sent";
}

// ── Storage ────────────────────────────────────────────────────────
const QUO_KEY = "nexus_quotations";
const INV_KEY = "nexus_invoices";
const PAY_KEY = "nexus_payments";

function li(description: string, quantity: number, unitPrice: number): LineItem {
  return { id: `li-${description.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, description, quantity, unitPrice };
}

function seedQuotations(): Quotation[] {
  return [
    {
      id: "q1",
      number: "QUO-1004",
      customer: "Acme Corp",
      customerEmail: "billing@acmecorp.com",
      items: [li("Enterprise plan — annual", 1, 240000), li("Onboarding & setup", 1, 35000)],
      discountPct: 10,
      taxPct: 18,
      status: "sent",
      issueDate: dateOffset(-3),
      expiryDate: dateOffset(12),
      notes: "Valid for 15 days. Includes priority support.",
      convertedInvoiceId: null,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: "q2",
      number: "QUO-1003",
      customer: "Globex Ltd",
      customerEmail: "accounts@globex.io",
      items: [li("Pro plan — 25 seats", 25, 1200), li("Data migration", 1, 18000)],
      discountPct: 0,
      taxPct: 18,
      status: "accepted",
      issueDate: dateOffset(-10),
      expiryDate: dateOffset(5),
      notes: "",
      convertedInvoiceId: "i1",
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: "q3",
      number: "QUO-1002",
      customer: "Nimbus Co",
      customerEmail: "hello@nimbus.co",
      items: [li("Starter plan — annual", 1, 60000)],
      discountPct: 5,
      taxPct: 18,
      status: "draft",
      issueDate: dateOffset(-1),
      expiryDate: dateOffset(14),
      notes: "",
      convertedInvoiceId: null,
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      id: "q4",
      number: "QUO-1001",
      customer: "BrightPath",
      customerEmail: "meera@brightpath.in",
      items: [li("Consulting — 40 hrs", 40, 2500)],
      discountPct: 0,
      taxPct: 18,
      status: "rejected",
      issueDate: dateOffset(-30),
      expiryDate: dateOffset(-15),
      notes: "",
      convertedInvoiceId: null,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];
}

function seedInvoices(): Invoice[] {
  return [
    {
      id: "i1",
      number: "INV-2003",
      customer: "Globex Ltd",
      customerEmail: "accounts@globex.io",
      items: [li("Pro plan — 25 seats", 25, 1200), li("Data migration", 1, 18000)],
      discountPct: 0,
      taxPct: 18,
      status: "sent",
      issueDate: dateOffset(-9),
      dueDate: dateOffset(6),
      notes: "Net 15. Bank transfer preferred.",
      quotationId: "q2",
      createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    },
    {
      id: "i2",
      number: "INV-2002",
      customer: "Acme Corp",
      customerEmail: "billing@acmecorp.com",
      items: [li("Enterprise plan — annual", 1, 240000)],
      discountPct: 0,
      taxPct: 18,
      status: "sent",
      issueDate: dateOffset(-40),
      dueDate: dateOffset(-10),
      notes: "",
      quotationId: null,
      createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    },
    {
      id: "i3",
      number: "INV-2001",
      customer: "Stark Industries",
      customerEmail: "ap@stark.com",
      items: [li("Custom integration", 1, 150000), li("Annual support", 1, 45000)],
      discountPct: 5,
      taxPct: 18,
      status: "sent",
      issueDate: dateOffset(-20),
      dueDate: dateOffset(10),
      notes: "",
      quotationId: null,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
  ];
}

function seedPayments(): Payment[] {
  return [
    {
      id: "p1",
      number: "PAY-3002",
      invoiceId: "i3",
      invoiceNumber: "INV-2001",
      customer: "Stark Industries",
      amount: 100000,
      method: "bank",
      status: "completed",
      date: dateOffset(-5),
      reference: "NEFT-88231",
      notes: "Part payment",
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: "p2",
      number: "PAY-3001",
      invoiceId: "i2",
      invoiceNumber: "INV-2002",
      customer: "Acme Corp",
      amount: 283200,
      method: "card",
      status: "completed",
      date: dateOffset(-38),
      reference: "ch_1Nxxxx",
      notes: "",
      createdAt: new Date(Date.now() - 38 * 86400000).toISOString(),
    },
  ];
}

function load<T>(key: string, seed: () => T[]): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const seeded = seed();
      window.localStorage.setItem(key, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, list: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

export const loadQuotations = () => load<Quotation>(QUO_KEY, seedQuotations);
export const saveQuotations = (l: Quotation[]) => save(QUO_KEY, l);
export const loadInvoices = () => load<Invoice>(INV_KEY, seedInvoices);
export const saveInvoices = (l: Invoice[]) => save(INV_KEY, l);
export const loadPayments = () => load<Payment>(PAY_KEY, seedPayments);
export const savePayments = (l: Payment[]) => save(PAY_KEY, l);

function nextNumber(list: { number: string }[], prefix: string, start: number): string {
  const max = list.reduce((m, x) => {
    const n = parseInt(x.number.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, start - 1);
  return `${prefix}-${max + 1}`;
}

export const nextQuotationNumber = (l: Quotation[]) => nextNumber(l, "QUO", 1001);
export const nextInvoiceNumber = (l: Invoice[]) => nextNumber(l, "INV", 2001);
export const nextPaymentNumber = (l: Payment[]) => nextNumber(l, "PAY", 3001);
