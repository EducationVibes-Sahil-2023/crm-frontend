// HRMS data layer — employees, payroll, leaves, holidays, attendance, letters.
// All client-side / localStorage, consistent with the rest of the dashboard.

import { listDirectory } from "@/lib/directory";

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
  window.localStorage.setItem(key, JSON.stringify(value));
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
const DEFAULT_LEAVES: Leave[] = [
  { id: "lv1", employee: "Diya Patel", type: "Sick", from: "Jun 18, 2026", to: "Jun 19, 2026", days: 2, reason: "Fever", status: "Pending", appliedAt: "Jun 17, 2026" },
  { id: "lv2", employee: "Vivaan Reddy", type: "Casual", from: "Jun 23, 2026", to: "Jun 23, 2026", days: 1, reason: "Personal work", status: "Approved", appliedAt: "Jun 20, 2026" },
  { id: "lv3", employee: "Ananya Nair", type: "Earned", from: "Jul 01, 2026", to: "Jul 05, 2026", days: 5, reason: "Family trip", status: "Pending", appliedAt: "Jun 21, 2026" },
  { id: "lv4", employee: "Aarav Sharma", type: "Casual", from: "Feb 10, 2026", to: "Feb 11, 2026", days: 2, reason: "Family function", status: "Approved", appliedAt: "Feb 05, 2026" },
  { id: "lv5", employee: "Diya Patel", type: "Earned", from: "Apr 14, 2026", to: "Apr 18, 2026", days: 5, reason: "Vacation", status: "Approved", appliedAt: "Apr 01, 2026" },
  // Prior-year history (so year-wise view has data to compare).
  { id: "lv6", employee: "Aarav Sharma", type: "Sick", from: "Nov 12, 2025", to: "Nov 13, 2025", days: 2, reason: "Flu", status: "Approved", appliedAt: "Nov 11, 2025" },
  { id: "lv7", employee: "Vivaan Reddy", type: "Earned", from: "Dec 22, 2025", to: "Dec 26, 2025", days: 5, reason: "Year-end break", status: "Approved", appliedAt: "Dec 10, 2025" },
  { id: "lv8", employee: "Ananya Nair", type: "Casual", from: "Aug 15, 2025", to: "Aug 15, 2025", days: 1, reason: "Personal", status: "Rejected", appliedAt: "Aug 12, 2025" },
];

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

function hol(name: string, iso: string, type: string, state: string): Holiday {
  return { id: `h-${iso}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, iso, date: isoLabel(iso), type, state };
}

const DEFAULT_HOLIDAYS: Holiday[] = [
  // 2026 — national / festival (All India)
  hol("New Year's Day", "2026-01-01", "Optional", ALL_INDIA),
  hol("Republic Day", "2026-01-26", "National", ALL_INDIA),
  hol("Holi", "2026-03-04", "Festival", ALL_INDIA),
  hol("Independence Day", "2026-08-15", "National", ALL_INDIA),
  hol("Gandhi Jayanti", "2026-10-02", "National", ALL_INDIA),
  hol("Diwali", "2026-11-08", "Festival", ALL_INDIA),
  hol("Christmas", "2026-12-25", "Festival", ALL_INDIA),
  // 2026 — state specific
  hol("Pongal", "2026-01-15", "Festival", "Tamil Nadu"),
  hol("Gudi Padwa", "2026-03-19", "Festival", "Maharashtra"),
  hol("Maharashtra Day", "2026-05-01", "National", "Maharashtra"),
  hol("Onam", "2026-08-26", "Festival", "Kerala"),
  hol("Durga Puja", "2026-10-19", "Festival", "West Bengal"),
  hol("Karnataka Rajyotsava", "2026-11-01", "National", "Karnataka"),
  hol("Chhath Puja", "2026-11-15", "Festival", "Bihar"),
  // 2025 — a few so the year selector has history
  hol("Republic Day", "2025-01-26", "National", ALL_INDIA),
  hol("Holi", "2025-03-14", "Festival", ALL_INDIA),
  hol("Independence Day", "2025-08-15", "National", ALL_INDIA),
  hol("Karnataka Rajyotsava", "2025-11-01", "National", "Karnataka"),
  hol("Diwali", "2025-10-20", "Festival", ALL_INDIA),
];

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

const DEFAULT_ARS: ARRequest[] = [
  { id: "ar1", employee: "Diya Patel", date: "2026-06-23", checkIn: "09:35 AM", checkOut: "06:30 PM", workType: "Work From Office", reason: "Biometric failed at the gate; security can confirm entry time.", status: "Pending", appliedAt: "Jun 24, 2026" },
  { id: "ar2", employee: "Vivaan Reddy", date: "2026-06-22", checkIn: "10:00 AM", checkOut: "07:00 PM", workType: "Field Work", reason: "On a campus visit all day, could not punch in.", status: "Pending", appliedAt: "Jun 23, 2026" },
];

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
const DEFAULT_POLICIES: Policy[] = [
  { id: "p1", title: "Leave Policy", category: "Leave", summary: "Entitlements, accrual and approval rules for casual, sick and earned leave.", updated: "Apr 01, 2026" },
  { id: "p2", title: "Attendance & Working Hours", category: "Attendance", summary: "Office hours, punch-in/out, regularisation (AR) and remote-work guidelines.", updated: "Apr 01, 2026" },
  { id: "p3", title: "Code of Conduct", category: "Compliance", summary: "Expected professional behaviour, anti-harassment and disciplinary process.", updated: "Mar 10, 2026" },
  { id: "p4", title: "Payroll & Reimbursement", category: "Payroll", summary: "Salary structure, pay cycle, payslips and expense reimbursement.", updated: "Apr 01, 2026" },
];

// ---------- awards / recognition ----------

export type Award = { id: string; employee: string; title: string; category: string; note: string; date: string };
export function loadAwards(): Award[] {
  return read<Award[]>("hr_awards_v1", DEFAULT_AWARDS);
}
export function saveAwards(a: Award[]): void {
  write("hr_awards_v1", a);
}
export const AWARD_CATEGORIES = ["Star Performer", "Team Player", "Innovation", "Long Service", "Spot Award"];
const DEFAULT_AWARDS: Award[] = [
  { id: "aw1", employee: "Aarav Sharma", title: "Counsellor of the Month", category: "Star Performer", note: "Highest admissions conversion in May.", date: "Jun 01, 2026" },
  { id: "aw2", employee: "Diya Patel", title: "Going the Extra Mile", category: "Team Player", note: "Covered weekend enquiry desk.", date: "May 20, 2026" },
  { id: "aw3", employee: "Ananya Nair", title: "5 Years of Service", category: "Long Service", note: "Half a decade with the team!", date: "Apr 15, 2026" },
];

// ---------- posts / notices ----------

export type Post = { id: string; title: string; body: string; category: string; pinned: boolean; author: string; date: string };
export function loadPosts(): Post[] {
  return read<Post[]>("hr_posts_v1", DEFAULT_POSTS);
}
export function savePosts(p: Post[]): void {
  write("hr_posts_v1", p);
}
export const POST_CATEGORIES = ["Notice", "Celebration", "Update", "Reminder"];
const DEFAULT_POSTS: Post[] = [
  { id: "po1", title: "Office closed for Diwali", body: "The office will remain closed on Nov 8 for Diwali. Wishing everyone a safe and joyful festival!", category: "Notice", pinned: true, author: "HR Team", date: "Jun 22, 2026" },
  { id: "po2", title: "Welcome our new counsellors", body: "Please join us in welcoming two new members to the counselling team this month.", category: "Celebration", pinned: false, author: "HR Team", date: "Jun 18, 2026" },
];

// ---------- engagement (events & activities) ----------

export type Engagement = { id: string; title: string; type: string; date: string; location: string; going: string[] };
export function loadEngagement(): Engagement[] {
  return read<Engagement[]>("hr_engagement_v1", DEFAULT_ENGAGEMENT);
}
export function saveEngagement(e: Engagement[]): void {
  write("hr_engagement_v1", e);
}
export const ENGAGEMENT_TYPES = ["Team Outing", "Town Hall", "Workshop", "Celebration", "Wellness"];
const DEFAULT_ENGAGEMENT: Engagement[] = [
  { id: "en1", title: "Quarterly Town Hall", type: "Town Hall", date: "Jul 04, 2026", location: "Main Hall", going: ["Aarav Sharma", "Diya Patel"] },
  { id: "en2", title: "Monsoon Team Outing", type: "Team Outing", date: "Jul 19, 2026", location: "Lonavala", going: ["Vivaan Reddy"] },
  { id: "en3", title: "Mindfulness Wellness Session", type: "Wellness", date: "Jun 30, 2026", location: "Online", going: [] },
];

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
const DEFAULT_MEDICAL: MedicalClaim[] = [
  { id: "md1", employee: "Diya Patel", type: "Consultation", amount: 1500, claimDate: "Jun 12, 2026", status: "Approved", note: "GP visit" },
  { id: "md2", employee: "Vivaan Reddy", type: "Diagnostics", amount: 3200, claimDate: "Jun 19, 2026", status: "Pending", note: "Blood panel" },
];
