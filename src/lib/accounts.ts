// Accounts / finance store. Invoices persist in the per-tenant database
// (app_store via dbStore) — no localStorage, no demo seeds.

import { dbGet, dbSet } from "@/lib/dbStore";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export type LineItem = {
  id: string;
  description: string;
  qty: number;
  rate: number; // per-unit amount
};

export type Invoice = {
  id: string;
  number: string; // e.g. INV-1024
  client: string;
  clientEmail?: string;
  issueDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  items: LineItem[];
  taxRate: number; // percent
  status: InvoiceStatus;
  notes?: string;
  createdAt: string; // ISO
};

export const STATUS_META: Record<InvoiceStatus, { label: string; chip: string; dot: string }> = {
  draft: { label: "Draft", chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  sent: { label: "Sent", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  paid: { label: "Paid", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  overdue: { label: "Overdue", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  void: { label: "Void", chip: "bg-slate-100 text-slate-400 line-through", dot: "bg-slate-300" },
};

export const STATUS_ORDER: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];

// ---- money + totals ---------------------------------------------------------

export function money(n: number): string {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

export function subtotal(inv: Invoice): number {
  return inv.items.reduce((s, it) => s + it.qty * it.rate, 0);
}
export function taxAmount(inv: Invoice): number {
  return subtotal(inv) * (inv.taxRate / 100);
}
export function invoiceTotal(inv: Invoice): number {
  return subtotal(inv) + taxAmount(inv);
}

// A "sent" invoice past its due date is effectively overdue.
export function effectiveStatus(inv: Invoice): InvoiceStatus {
  if (inv.status === "sent" && inv.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(inv.dueDate + "T00:00:00") < today) return "overdue";
  }
  return inv.status;
}

// ---- store ------------------------------------------------------------------

const KEY = "nexus_invoices_v1";

export function loadInvoices(): Invoice[] {
  const parsed = dbGet<Invoice[]>(KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((i) => ({ ...i, items: i.items ?? [], taxRate: i.taxRate ?? 0 }));
}

export function saveInvoices(list: Invoice[]): void {
  dbSet(KEY, list);
}

// Next invoice number based on the highest existing INV-#### value.
export function nextInvoiceNumber(list: Invoice[]): string {
  let max = 1000;
  for (const i of list) {
    const m = /INV-(\d+)/.exec(i.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `INV-${max + 1}`;
}

export function fmtDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
