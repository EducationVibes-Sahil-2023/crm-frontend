// Accounts add-ons: business expenses and vendor bills (accounts payable).
// localStorage-backed, consistent with billing.ts. Invoices/payments/quotations
// continue to live in billing.ts; this fills the AP / expense side.

import { computeTotals, type Invoice } from "@/lib/billing";
import { dbGet, dbSet } from "@/lib/dbStore";

// ---- helpers -----------------------------------------------------------

export function invoiceTotal(inv: Invoice): number {
  return computeTotals(inv.items, inv.discountPct, inv.taxPct).total;
}

// DB-backed (app_store via dbStore) — no localStorage.
function read<T>(key: string, fallback: T): T {
  return dbGet<T>(key, fallback);
}
function write<T>(key: string, value: T): void {
  dbSet<T>(key, value);
}
const todayIso = () => new Date().toISOString().slice(0, 10);

// ---- expenses ----------------------------------------------------------

export type ExpenseStatus = "pending" | "approved" | "paid" | "rejected";
export type Expense = {
  id: string;
  date: string; // yyyy-mm-dd
  category: string;
  vendor: string;
  description: string;
  amount: number;
  method: string;
  status: ExpenseStatus;
  notes: string;
  createdAt: string;
};

export const EXPENSE_CATEGORIES = ["Travel", "Office Supplies", "Utilities", "Marketing", "Software", "Rent", "Salaries", "Professional Fees", "Miscellaneous"];
export const EXPENSE_METHODS = ["Bank Transfer", "Card", "Cash", "UPI", "Cheque"];

export const EXPENSE_STATUS: Record<ExpenseStatus, { label: string; badge: string; dot: string }> = {
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  approved: { label: "Approved", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  paid: { label: "Paid", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

const EXP_KEY = "finance_expenses_v1";

export const loadExpenses = () => read<Expense[]>(EXP_KEY, []);
export const saveExpenses = (l: Expense[]) => write(EXP_KEY, l);

// ---- bills (accounts payable) ------------------------------------------

export type BillStatus = "unpaid" | "partial" | "paid" | "overdue";
export type Bill = {
  id: string;
  number: string; // BILL-####
  vendor: string;
  category: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  notes: string;
  createdAt: string;
};

const BILL_KEY = "finance_bills_v1";

export const loadBills = () => read<Bill[]>(BILL_KEY, []);
export const saveBills = (l: Bill[]) => write(BILL_KEY, l);

export function billStatus(b: Bill): BillStatus {
  if (b.paidAmount >= b.amount && b.amount > 0) return "paid";
  if (b.paidAmount > 0) return "partial";
  if (b.dueDate && b.dueDate < todayIso()) return "overdue";
  return "unpaid";
}

export const BILL_STATUS: Record<BillStatus, { label: string; badge: string; dot: string }> = {
  unpaid: { label: "Unpaid", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  partial: { label: "Partly Paid", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  paid: { label: "Paid", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  overdue: { label: "Overdue", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

export function nextBillNumber(l: Bill[]): string {
  const max = l.reduce((m, b) => {
    const n = Number((b.number || "").replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  return `BILL-${max + 1}`;
}

