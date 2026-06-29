// HRMS data layer — employees, payroll, leaves, holidays, attendance, letters.
// All client-side / localStorage, consistent with the rest of the dashboard.

import { listDirectory } from "@/lib/directory";
import { dbGet, dbSet } from "@/lib/dbStore";

// ---------- employees ----------

export type Employee = {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  ctc: number; // monthly cost-to-company
  bank: string;
  joined: string;
};

const CTC_BY_TIER = [75000, 55000, 60000, 52000, 48000, 70000, 56000, 61000, 53000, 49000];

export function listEmployees(): Employee[] {
  return listDirectory().map((u, i) => ({
    id: `emp-${i + 1}`,
    name: u.name,
    email: u.email,
    department: u.department,
    designation: u.designation,
    ctc: CTC_BY_TIER[i % CTC_BY_TIER.length],
    bank: `XXXX${String(4000 + i * 137).slice(-4)}`,
    joined: ["Jan 12, 2021", "Mar 03, 2022", "Jul 19, 2020", "Sep 28, 2023", "Feb 14, 2022"][i % 5],
  }));
}

// ---------- helpers ----------

export function formatMoney(n: number, currency = "₹"): string {
  return `${currency}${Math.round(n).toLocaleString("en-IN")}`;
}
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
export function recentMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
// Backed by the per-tenant database (app_store) via dbStore — no browser
// localStorage, no demo seeds. Reads come from the hydrated cache (AuthGuard
// loads it before the app renders); writes persist to the DB.
function read<T>(key: string, fallback: T): T {
  return dbGet<T>(key, fallback);
}
function write<T>(key: string, value: T): void {
  dbSet<T>(key, value);
}

// ---------- payroll settings ----------

export type PayrollSettings = {
  payDay: number; // day of month salary is credited
  cutoffDay: number; // attendance cut-off day
  basicPct: number; // % of CTC
  hraPct: number; // % of basic
  pfPct: number; // % of basic
  taxPct: number; // % of gross (TDS)
  professionalTax: number; // flat amount
  requireApproval: boolean; // accounts team approval before crediting
  currency: string;
};

export const DEFAULT_PAYROLL: PayrollSettings = {
  payDay: 1, cutoffDay: 25, basicPct: 50, hraPct: 40, pfPct: 12, taxPct: 10, professionalTax: 200, requireApproval: true, currency: "₹",
};

export function loadPayrollSettings(): PayrollSettings {
  return { ...DEFAULT_PAYROLL, ...read<Partial<PayrollSettings>>("hr_payroll_settings_v1", {}) };
}
export function savePayrollSettings(s: PayrollSettings): void {
  write("hr_payroll_settings_v1", s);
}

// ---------- salary computation ----------

export type Breakdown = {
  ctc: number; basic: number; hra: number; special: number; gross: number;
  pf: number; profTax: number; tax: number; deductions: number; net: number;
};

export function computeSalary(ctc: number, s: PayrollSettings): Breakdown {
  const basic = (ctc * s.basicPct) / 100;
  const hra = (basic * s.hraPct) / 100;
  const special = Math.max(0, ctc - basic - hra);
  const gross = basic + hra + special;
  const pf = (basic * s.pfPct) / 100;
  const tax = (gross * s.taxPct) / 100;
  const profTax = s.professionalTax;
  const deductions = pf + tax + profTax;
  return { ctc, basic, hra, special, gross, pf, profTax, tax, deductions, net: gross - deductions };
}

// ---------- payslips ----------

export type PayStatus = "pending" | "approved" | "credited";

export type Payslip = Breakdown & {
  id: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  bank: string;
  month: string; // YYYY-MM
  status: PayStatus;
  generatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  creditedAt?: string;
};

export function loadPayslips(): Payslip[] {
  return read<Payslip[]>("hr_payslips_v1", []);
}
export function savePayslips(p: Payslip[]): void {
  write("hr_payslips_v1", p);
}

export function generatePayslips(month: string, settings: PayrollSettings): Payslip[] {
  const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  return listEmployees().map((e) => {
    const b = computeSalary(e.ctc, settings);
    return {
      ...b,
      id: `ps-${month}-${e.id}`,
      employeeId: e.id,
      employeeName: e.name,
      designation: e.designation,
      bank: e.bank,
      month,
      status: "pending" as PayStatus,
      generatedAt: stamp,
    };
  });
}

// ---------- leaves ----------

export const LEAVE_TYPES = ["Casual", "Sick", "Earned", "Unpaid"];
export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type Leave = {
  id: string;
  employee: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
};

export const LEAVE_BALANCE: Record<string, number> = { Casual: 12, Sick: 8, Earned: 15, Unpaid: 0 };

export function loadLeaves(): Leave[] {
  return read<Leave[]>("hr_leaves_v1", DEFAULT_LEAVES);
}
export function saveLeaves(l: Leave[]): void {
  write("hr_leaves_v1", l);
}
const DEFAULT_LEAVES: Leave[] = [];

// ---------- holidays ----------

// Holidays are defined per state. "All India" applies to every employee; a
// state-specific entry only shows for users in that state.
export type Holiday = {
  id: string;
  name: string;
  date: string; // display label, e.g. "Jan 26, 2026"
  iso: string; // yyyy-mm-dd — source of truth for year / sorting
  type: string; // National | Festival | Optional
  state: string; // "All India" or a specific state
};

export const ALL_INDIA = "All India";

export const INDIAN_STATES: string[] = [
  ALL_INDIA,
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
];

function isoLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function holidayYear(h: Holiday): number {
  return new Date((h.iso || h.date) + (h.iso ? "T00:00:00" : "")).getFullYear();
}

export function holidayYears(list: Holiday[]): number[] {
  return Array.from(new Set(list.map(holidayYear)))
    .filter((y) => !isNaN(y))
    .sort((a, b) => a - b);
}

export function loadHolidays(): Holiday[] {
  const list = read<Holiday[]>("hr_holidays_v1", DEFAULT_HOLIDAYS);
  // Migrate records saved before iso/state existed.
  return list.map((h) => {
    const iso = h.iso || toIso(h.date);
    return { ...h, iso, date: h.date || isoLabel(iso), type: h.type || "National", state: h.state || ALL_INDIA };
  });
}
export function saveHolidays(h: Holiday[]): void {
  write("hr_holidays_v1", h);
}

// Parse a display label like "Nov 08, 2026" back to yyyy-mm-dd.
function toIso(label: string): string {
  const d = new Date(label);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_HOLIDAYS: Holiday[] = [];

// ---------- attendance (punch in / out for the current user) ----------

export type Punch = { date: string; checkIn?: string; checkOut?: string; status?: string; lateBy?: number; workType?: string; location?: string; viaAR?: boolean };
export function loadPunches(): Record<string, Punch> {
  return read<Record<string, Punch>>("hr_punches_v1", {});
}
export function savePunches(p: Record<string, Punch>): void {
  write("hr_punches_v1", p);
}
export function nowTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ---------- attendance regularisation (AR) ----------
// When someone misses or mis-punches attendance they raise an AR with a reason.
// A manager approves/rejects; on approval the day's attendance is corrected.

export type ARStatus = "Pending" | "Approved" | "Rejected";
export type ARRequest = {
  id: string;
  employee: string;
  date: string; // yyyy-mm-dd to regularise
  checkIn?: string; // requested "hh:mm AM/PM"
  checkOut?: string;
  workType: string;
  reason: string;
  status: ARStatus;
  appliedAt: string; // display date
  decidedBy?: string;
  decidedAt?: string;
  managerNote?: string;
};

const DEFAULT_ARS: ARRequest[] = [];

export function loadARs(): ARRequest[] {
  return read<ARRequest[]>("hr_ar_v1", DEFAULT_ARS);
}
export function saveARs(a: ARRequest[]): void {
  write("hr_ar_v1", a);
}

// Build the corrected punch from an approved AR.
export function punchFromAR(ar: ARRequest): Punch {
  return {
    date: ar.date,
    checkIn: ar.checkIn,
    checkOut: ar.checkOut,
    workType: ar.workType,
    status: "Regularised",
    lateBy: 0,
    viaAR: true,
  };
}
/** Worked hours between two "hh:mm AM/PM" strings, as a label. */
export function workedHours(p: Punch): string {
  if (!p.checkIn || !p.checkOut) return "—";
  const parse = (t: string) => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 0;
    let h = Number(m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + Number(m[2]);
  };
  const mins = Math.max(0, parse(p.checkOut) - parse(p.checkIn));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ---------- letters ----------

export type LetterKind = "offer" | "increment";
export type Letter = {
  id: string;
  kind: LetterKind;
  employee: string;
  designation: string;
  department: string;
  ctc: number;
  effectiveDate: string;
  prevCtc?: number;
  createdAt: string;
};
export function loadLetters(): Letter[] {
  return read<Letter[]>("hr_letters_v1", []);
}
export function saveLetters(l: Letter[]): void {
  write("hr_letters_v1", l);
}

// ---------- policies ----------

export type Policy = { id: string; title: string; category: string; summary: string; updated: string };
export function loadPolicies(): Policy[] {
  return read<Policy[]>("hr_policies_v1", DEFAULT_POLICIES);
}
export function savePolicies(p: Policy[]): void {
  write("hr_policies_v1", p);
}
const DEFAULT_POLICIES: Policy[] = [];

// ---------- awards / recognition ----------

export type Award = { id: string; employee: string; title: string; category: string; note: string; date: string };
export function loadAwards(): Award[] {
  return read<Award[]>("hr_awards_v1", DEFAULT_AWARDS);
}
export function saveAwards(a: Award[]): void {
  write("hr_awards_v1", a);
}
export const AWARD_CATEGORIES = ["Star Performer", "Team Player", "Innovation", "Long Service", "Spot Award"];
const DEFAULT_AWARDS: Award[] = [];

// ---------- posts / notices ----------

export type Post = { id: string; title: string; body: string; category: string; pinned: boolean; author: string; date: string };
export function loadPosts(): Post[] {
  return read<Post[]>("hr_posts_v1", DEFAULT_POSTS);
}
export function savePosts(p: Post[]): void {
  write("hr_posts_v1", p);
}
export const POST_CATEGORIES = ["Notice", "Celebration", "Update", "Reminder"];
const DEFAULT_POSTS: Post[] = [];

// ---------- engagement (events & activities) ----------

export type Engagement = { id: string; title: string; type: string; date: string; location: string; going: string[] };
export function loadEngagement(): Engagement[] {
  return read<Engagement[]>("hr_engagement_v1", DEFAULT_ENGAGEMENT);
}
export function saveEngagement(e: Engagement[]): void {
  write("hr_engagement_v1", e);
}
export const ENGAGEMENT_TYPES = ["Team Outing", "Town Hall", "Workshop", "Celebration", "Wellness"];
const DEFAULT_ENGAGEMENT: Engagement[] = [];

// ---------- medical (claims & insurance) ----------

export type MedicalStatus = "Pending" | "Approved" | "Rejected";
export type MedicalClaim = { id: string; employee: string; type: string; amount: number; claimDate: string; status: MedicalStatus; note: string };
export function loadMedical(): MedicalClaim[] {
  return read<MedicalClaim[]>("hr_medical_v1", DEFAULT_MEDICAL);
}
export function saveMedical(m: MedicalClaim[]): void {
  write("hr_medical_v1", m);
}
export const MEDICAL_TYPES = ["Consultation", "Hospitalisation", "Pharmacy", "Diagnostics", "Dental", "Vision"];
export const MEDICAL_COVER = 200000; // annual insurance cover per employee
const DEFAULT_MEDICAL: MedicalClaim[] = [];
