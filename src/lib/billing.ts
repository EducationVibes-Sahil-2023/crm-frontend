// Billing module: quotations, invoices and payments. Persisted to the
// per-tenant database (app_store via dbStore) — no localStorage, no demo seeds.
// The three documents are cross-linked:
//   quotation --(convert)--> invoice <--(pays)-- payment

import { dbGet, dbSet } from "@/lib/dbStore";

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

function load<T>(key: string): T[] {
  const parsed = dbGet<T[]>(key, []);
  return Array.isArray(parsed) ? parsed : [];
}

function save<T>(key: string, list: T[]): void {
  dbSet(key, list);
}

export const loadQuotations = () => load<Quotation>(QUO_KEY);
export const saveQuotations = (l: Quotation[]) => save(QUO_KEY, l);
export const loadInvoices = () => load<Invoice>(INV_KEY);
export const saveInvoices = (l: Invoice[]) => save(INV_KEY, l);
export const loadPayments = () => load<Payment>(PAY_KEY);
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
