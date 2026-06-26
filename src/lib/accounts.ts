// Local-first accounts / finance store. Persists invoices to localStorage so the
// module works without a backend; swap these helpers for `api` calls later.

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

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const SEED: Invoice[] = [
  {
    id: "inv-1", number: "INV-1024", client: "Infosys Ltd.", clientEmail: "billing@infosys.com",
    issueDate: shift(-20), dueDate: shift(-2), taxRate: 18,
    items: [{ id: "l1", description: "Enterprise CRM licence (annual)", qty: 1, rate: 900000 }, { id: "l2", description: "Onboarding & training", qty: 10, rate: 12000 }],
    status: "sent", createdAt: new Date().toISOString(),
  },
  {
    id: "inv-2", number: "INV-1023", client: "Tata Consultancy Services", clientEmail: "ap@tcs.com",
    issueDate: shift(-12), dueDate: shift(8), taxRate: 18,
    items: [{ id: "l1", description: "Consulting retainer", qty: 1, rate: 350000 }],
    status: "sent", createdAt: new Date().toISOString(),
  },
  {
    id: "inv-3", number: "INV-1022", client: "Wipro Technologies",
    issueDate: shift(-30), dueDate: shift(-15), taxRate: 0,
    items: [{ id: "l1", description: "Implementation phase 1", qty: 1, rate: 620000 }],
    status: "paid", createdAt: new Date().toISOString(),
  },
  {
    id: "inv-4", number: "INV-1025", client: "Reliance Digital",
    issueDate: shift(-1), dueDate: shift(29), taxRate: 18,
    items: [{ id: "l1", description: "API integration", qty: 40, rate: 9000 }],
    status: "draft", createdAt: new Date().toISOString(),
  },
  {
    id: "inv-5", number: "INV-1021", client: "HDFC Bank",
    issueDate: shift(-45), dueDate: shift(-30), taxRate: 18,
    items: [{ id: "l1", description: "Annual support plan", qty: 1, rate: 480000 }],
    status: "paid", createdAt: new Date().toISOString(),
  },
];

export function loadInvoices(): Invoice[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as Invoice[];
    if (!Array.isArray(parsed)) return SEED;
    return parsed.map((i) => ({ ...i, items: i.items ?? [], taxRate: i.taxRate ?? 0 }));
  } catch {
    return SEED;
  }
}

export function saveInvoices(list: Invoice[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
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
