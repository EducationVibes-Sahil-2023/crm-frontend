// Synthetic analytics for the Follow-up Tracker dashboard (counsellor
// accountability, aging, lead-status volume, ghosted leads, KPIs).
// Deterministic so the dashboard is stable across renders.

export type CounsellorRow = {
  name: string; assigned: number; completed: number; pending: number; overdue: number;
  customer: number; callback: number; funnel: number; prospect: number;
  pct: number; status: "On track" | "At risk" | "Critical";
};

export type StatusVolume = { name: string; total: number; completed: number; color: string };
export type AgingRow = { label: string; value: number; tag: string; tone: string };
export type SplitRow = { type: string; done: number; total: number; color: string };
export type GhostLead = { name: string; by: string; phone: string; type: string; typeBadge: string; attempts: number; ago: string; connected: boolean };

export const FU_KPIS = {
  totalDue: 196,
  completed: 109,
  scheduled: 305,
  donePct: 36,
  overdue: 1442,
  overdueBreak: { prospect: 400, funnel: 660, callback: 381 },
  prospectPending: 97,
  funnelPending: 69,
  callbackPending: 30,
  teamRate: 36,
  teamTarget: 85,
  ghosted: 21,
  future: 1289,
};

const NAMES = [
  "Shaik Karimulla", "Malothu Vamshi", "Mahima EV", "Roushan Srivastava", "Putti Podhwini",
  "Akhil Eaga", "Grishma Varsha Naidu", "Prajwal Kose", "Pradumya Banke", "Gauri Chavan",
  "Esha Karajgikar", "Amruta Ghule", "Subhash Bhargava", "Tanu Shree", "Navin Solanki", "Rajat Bangde",
];

// Deterministic counsellor rows.
export const COUNSELLORS: CounsellorRow[] = NAMES.map((name, i) => {
  const assigned = 1 + ((i * 3) % 8);
  const overdue = i % 4 === 0 ? 0 : (i % 5);
  const pending = i % 3 === 0 ? 0 : 1 + (i % 2);
  const completed = Math.max(0, assigned - pending - (overdue > assigned ? 0 : 0) - (i % 2));
  const pct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const status: CounsellorRow["status"] = pct >= 90 ? "On track" : pct >= 50 ? "At risk" : "Critical";
  return {
    name, assigned, completed: Math.min(assigned, completed), pending, overdue,
    customer: i % 6 === 0 ? 1 : 0,
    callback: i % 2,
    funnel: i % 3,
    prospect: i % 4 === 0 ? 1 : 0,
    pct, status,
  };
});

export const STATUS_VOLUME: StatusVolume[] = [
  { name: "Customer", total: 0, completed: 0, color: "bg-emerald-500" },
  { name: "Fresh Lead", total: 19, completed: 7, color: "bg-teal-500" },
  { name: "Cold Lead", total: 96, completed: 31, color: "bg-sky-500" },
  { name: "Warm Lead", total: 143, completed: 56, color: "bg-amber-500" },
  { name: "Hot Lead", total: 15, completed: 5, color: "bg-rose-500" },
  { name: "Not Reachable", total: 11, completed: 1, color: "bg-slate-400" },
  { name: "Dead Lead", total: 5, completed: 1, color: "bg-slate-600" },
  { name: "TBD", total: 6, completed: 4, color: "bg-violet-500" },
  { name: "Future Intake", total: 6, completed: 4, color: "bg-indigo-500" },
  { name: "Opportunity", total: 2, completed: 2, color: "bg-fuchsia-500" },
];

export const AGING: AgingRow[] = [
  { label: "Due today", value: 195, tag: "Due", tone: "bg-amber-100 text-amber-700" },
  { label: "1 day overdue", value: 202, tag: "Urgent", tone: "bg-orange-100 text-orange-700" },
  { label: "2 days overdue", value: 180, tag: "Critical", tone: "bg-rose-100 text-rose-700" },
  { label: "3 days overdue", value: 122, tag: "Escalate", tone: "bg-rose-100 text-rose-700" },
  { label: "4+ days overdue", value: 2088, tag: "Lost?", tone: "bg-rose-200 text-rose-800" },
];

export const MISSED_TOP: { name: string; count: number }[] = [
  { name: "Gauri Chavan", count: 25 }, { name: "Esha Karajgikar", count: 21 }, { name: "Amruta Ghule", count: 20 },
  { name: "Subhash Bhargava", count: 17 }, { name: "Tanu Shree", count: 14 },
];
export const CREATED_LEAST: { name: string; count: number }[] = [
  { name: "Prayju Lallu", count: 1 }, { name: "Naman Khede", count: 1 }, { name: "Ragala Sudheer", count: 1 },
  { name: "Sayandeep Das", count: 1 }, { name: "Sneha Sao", count: 1 },
];

export const COMPLETION_SPLIT: SplitRow[] = [
  { type: "Customer", done: 0, total: 0, color: "bg-emerald-500" },
  { type: "Fresh Lead", done: 7, total: 19, color: "bg-teal-500" },
  { type: "Cold Lead", done: 31, total: 98, color: "bg-sky-500" },
  { type: "Warm Lead", done: 56, total: 143, color: "bg-amber-500" },
  { type: "Hot Lead", done: 5, total: 15, color: "bg-rose-500" },
  { type: "Not Reachable", done: 1, total: 11, color: "bg-slate-400" },
  { type: "Dead Lead", done: 1, total: 5, color: "bg-slate-600" },
  { type: "TBD", done: 4, total: 6, color: "bg-violet-500" },
  { type: "Future Intake", done: 4, total: 6, color: "bg-indigo-500" },
  { type: "EC complete", done: 0, total: 0, color: "bg-cyan-500" },
  { type: "DNP", done: 0, total: 0, color: "bg-slate-400" },
  { type: "Opportunity", done: 2, total: 2, color: "bg-fuchsia-500" },
];

export const PENDING_SPLIT: SplitRow[] = [
  { type: "Cold Lead", done: 3622, total: 4121, color: "bg-sky-500" },
  { type: "Warm Lead", done: 4217, total: 4583, color: "bg-amber-500" },
  { type: "Dead Lead", done: 2571, total: 2783, color: "bg-slate-600" },
  { type: "Future Intake", done: 892, total: 1047, color: "bg-indigo-500" },
  { type: "Not Reachable", done: 1803, total: 1881, color: "bg-slate-400" },
  { type: "DNP", done: 538, total: 573, color: "bg-slate-400" },
  { type: "Hot Lead", done: 230, total: 262, color: "bg-rose-500" },
  { type: "Fresh Lead", done: 115, total: 143, color: "bg-teal-500" },
  { type: "TBD", done: 113, total: 138, color: "bg-violet-500" },
  { type: "Customer", done: 320, total: 332, color: "bg-emerald-500" },
  { type: "Opportunity", done: 63, total: 66, color: "bg-fuchsia-500" },
  { type: "EC complete", done: 37, total: 37, color: "bg-cyan-500" },
];

export const GHOSTED: GhostLead[] = [
  { name: "Arzoo chauhan", by: "Shrey Pathak · 9278632230", phone: "9278632230", type: "Cold Lead", typeBadge: "bg-sky-100 text-sky-700", attempts: 5, ago: "42 days ago", connected: true },
  { name: "Sameeksha", by: "Gauri Chavan · 9920389226", phone: "9920389226", type: "Warm Lead", typeBadge: "bg-amber-100 text-amber-700", attempts: 4, ago: "49 days ago", connected: true },
  { name: "Safoora chaudhary", by: "Navin Solanki · 7666930636", phone: "7666930636", type: "Future Intake", typeBadge: "bg-indigo-100 text-indigo-700", attempts: 4, ago: "45 days ago", connected: true },
  { name: "Shubham Bilgaye", by: "Gauri Chavan · 7387433033", phone: "7387433033", type: "Not Reachable", typeBadge: "bg-slate-100 text-slate-600", attempts: 6, ago: "Not Connected", connected: false },
  { name: "saniya", by: "Rajat Bangde · 8879465003", phone: "8879465003", type: "Cold Lead", typeBadge: "bg-sky-100 text-sky-700", attempts: 6, ago: "1 day ago", connected: true },
  { name: "Sahadev Jagadale", by: "Gauri Chavan · 9860540581", phone: "9860540581", type: "Cold Lead", typeBadge: "bg-sky-100 text-sky-700", attempts: 7, ago: "38 days ago", connected: true },
  { name: "Sayali Mahajan", by: "Gauri Chavan · 7977293314", phone: "7977293314", type: "Not Reachable", typeBadge: "bg-slate-100 text-slate-600", attempts: 22, ago: "Not Connected", connected: false },
  { name: "Sachin Pawar", by: "Gauri Chavan · 7776800500", phone: "7776800500", type: "Warm Lead", typeBadge: "bg-amber-100 text-amber-700", attempts: 5, ago: "61 days ago", connected: true },
  { name: "Kishor Godage", by: "Gauri Chavan · 9604907191", phone: "9604907191", type: "Fresh Lead", typeBadge: "bg-teal-100 text-teal-700", attempts: 4, ago: "Not Connected", connected: false },
];

export const LEAD_SOURCES = ["Website", "Referral", "Social", "Email", "Cold Call", "Walk-in"];
export const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
export const DEPARTMENTS = ["Counselling", "Admissions", "Sales", "Support"];
export const LOCATIONS = ["Mumbai", "Pune", "Bengaluru", "Delhi", "Hyderabad"];
