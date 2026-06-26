// Follow-up tracker — standalone reminders/follow-ups with due-date buckets.
// localStorage-backed. The tracker page also merges in existing per-lead
// reminders from leadExtras so nothing slips through the cracks.

export type FollowUpPriority = "low" | "medium" | "high";
export type FollowUpStatus = "pending" | "done";
export const FOLLOWUP_CATEGORIES = ["Call", "WhatsApp", "Meeting", "Email", "Visit", "Other"] as const;
export type FollowUpCategory = (typeof FOLLOWUP_CATEGORIES)[number];

export type FollowUp = {
  id: string;
  title: string;
  contact: string;
  phone: string;
  due: string; // datetime-local "yyyy-mm-ddTHH:mm" or "yyyy-mm-dd"
  priority: FollowUpPriority;
  category: FollowUpCategory;
  status: FollowUpStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
};

export type Bucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export const BUCKET_META: Record<Bucket, { label: string; badge: string; dot: string; accent: string }> = {
  overdue: { label: "Overdue", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", accent: "border-l-rose-500" },
  today: { label: "Due today", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", accent: "border-l-amber-500" },
  tomorrow: { label: "Tomorrow", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", accent: "border-l-blue-500" },
  week: { label: "This week", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500", accent: "border-l-indigo-500" },
  later: { label: "Later", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400", accent: "border-l-slate-300" },
  none: { label: "No date", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-300", accent: "border-l-slate-200" },
};

export const PRIORITY_META: Record<FollowUpPriority, { label: string; badge: string; dot: string }> = {
  high: { label: "High", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  medium: { label: "Medium", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  low: { label: "Low", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

function dayDiff(due: string): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function bucketOf(due: string): Bucket {
  const diff = dayDiff(due);
  if (diff === null) return "none";
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "later";
}

export function dueLabel(due: string): string {
  if (!due) return "No date";
  const d = new Date(due);
  if (isNaN(d.getTime())) return due;
  const hasTime = due.includes("T") && !due.endsWith("T00:00");
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return hasTime ? `${date}, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : date;
}

export function relativeDue(due: string): string {
  const diff = dayDiff(due);
  if (diff === null) return "";
  if (diff < -1) return `${Math.abs(diff)} days ago`;
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `In ${diff} days`;
  return dueLabel(due);
}

// ---- store -------------------------------------------------------------

const KEY = "followups_v1";
function todayAt(offsetDays: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${hhmm}`;
}

let SEED: FollowUp[] | null = null;
function seed(): FollowUp[] {
  if (SEED) return SEED;
  SEED = [
    { id: "fu-1", title: "Call back about MBA program", contact: "Aarav Sharma", phone: "+91 98765 43210", due: todayAt(-2, "11:00"), priority: "high", category: "Call", status: "pending", notes: "Interested in weekend batch.", createdBy: "System", createdAt: "" },
    { id: "fu-2", title: "Send fee structure on WhatsApp", contact: "Diya Patel", phone: "+91 91234 56780", due: todayAt(0, "16:30"), priority: "high", category: "WhatsApp", status: "pending", notes: "", createdBy: "System", createdAt: "" },
    { id: "fu-3", title: "Counselling session", contact: "Vivaan Reddy", phone: "+91 99887 76655", due: todayAt(1, "10:00"), priority: "medium", category: "Meeting", status: "pending", notes: "Bring brochure.", createdBy: "System", createdAt: "" },
    { id: "fu-4", title: "Follow up on document submission", contact: "Ananya Nair", phone: "", due: todayAt(4, "12:00"), priority: "medium", category: "Email", status: "pending", notes: "", createdBy: "System", createdAt: "" },
    { id: "fu-5", title: "Quarterly check-in", contact: "Kabir Khanna", phone: "", due: todayAt(15, "15:00"), priority: "low", category: "Call", status: "pending", notes: "", createdBy: "System", createdAt: "" },
  ];
  return SEED;
}

export function loadFollowUps(): FollowUp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as FollowUp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function saveFollowUps(list: FollowUp[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

export function snooze(due: string, days: number): string {
  const base = due && !isNaN(new Date(due).getTime()) ? new Date(due) : new Date();
  base.setDate(base.getDate() + days);
  const hhmm = due.includes("T") ? due.split("T")[1] : "09:00";
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}T${hhmm}`;
}

export function digits(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return d;
}
