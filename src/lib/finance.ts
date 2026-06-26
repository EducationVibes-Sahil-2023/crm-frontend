// Accounts add-ons: business expenses and vendor bills (accounts payable).
// localStorage-backed, consistent with billing.ts. Invoices/payments/quotations
// continue to live in billing.ts; this fills the AP / expense side.

import { computeTotals, type Invoice } from "@/lib/billing";

// ---- helpers -----------------------------------------------------------

export function invoiceTotal(inv: Invoice): number {
  return computeTotals(inv.items, inv.discountPct, inv.taxPct).total;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
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
const SEED_EXPENSES: Expense[] = [
  { id: "exp-1", date: "2026-06-03", category: "Software", vendor: "Adobe", description: "Creative Cloud annual", amount: 54000, method: "Card", status: "paid", notes: "", createdAt: "2026-06-03" },
  { id: "exp-2", date: "2026-06-10", category: "Travel", vendor: "IndiGo", description: "Client visit — Mumbai", amount: 12800, method: "Card", status: "approved", notes: "Reimbursable", createdAt: "2026-06-10" },
  { id: "exp-3", date: "2026-06-18", category: "Office Supplies", vendor: "Staples", description: "Stationery restock", amount: 7400, method: "UPI", status: "pending", notes: "", createdAt: "2026-06-18" },
  { id: "exp-4", date: "2026-06-21", category: "Utilities", vendor: "BESCOM", description: "Electricity — June", amount: 18600, method: "Bank Transfer", status: "paid", notes: "", createdAt: "2026-06-21" },
];

export const loadExpenses = () => read<Expense[]>(EXP_KEY, SEED_EXPENSES);
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
const SEED_BILLS: Bill[] = [
  { id: "bill-1", number: "BILL-1001", vendor: "WeWork", category: "Rent", issueDate: "2026-06-01", dueDate: "2026-06-30", amount: 145000, paidAmount: 0, notes: "Office rent — June", createdAt: "2026-06-01" },
  { id: "bill-2", number: "BILL-1002", vendor: "AWS", category: "Software", issueDate: "2026-06-05", dueDate: "2026-06-20", amount: 38200, paidAmount: 38200, notes: "Cloud hosting", createdAt: "2026-06-05" },
  { id: "bill-3", number: "BILL-1003", vendor: "Tata Tele", category: "Utilities", issueDate: "2026-05-28", dueDate: "2026-06-12", amount: 9600, paidAmount: 0, notes: "Internet & telephony", createdAt: "2026-05-28" },
  { id: "bill-4", number: "BILL-1004", vendor: "Justdial", category: "Marketing", issueDate: "2026-06-15", dueDate: "2026-07-15", amount: 25000, paidAmount: 10000, notes: "Lead ads", createdAt: "2026-06-15" },
];

export const loadBills = () => read<Bill[]>(BILL_KEY, SEED_BILLS);
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

