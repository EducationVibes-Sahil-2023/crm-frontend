// Local-first task tracker store. Persists to localStorage so the module works
// without a backend; swap these helpers for `api` calls later.

import { colorBadge, colorDot } from "@/lib/setup";

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
// A priority is identified by its id; the set is user-managed (see below).
export type TaskPriority = string;

export const STATUSES: { key: TaskStatus; label: string; accent: string; dot: string; chip: string }[] = [
  { key: "todo", label: "To Do", accent: "bg-slate-400", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
  { key: "in_progress", label: "In Progress", accent: "bg-blue-500", dot: "bg-blue-500", chip: "bg-blue-100 text-blue-700" },
  { key: "review", label: "Review", accent: "bg-violet-500", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-700" },
  { key: "done", label: "Done", accent: "bg-emerald-500", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
];

export function statusMeta(key: TaskStatus) {
  return STATUSES.find((s) => s.key === key) ?? STATUSES[0];
}

// ---- Priorities (user-managed, with colour) ---------------------------------

export type Priority = {
  id: string;
  name: string;
  color: string; // a COLORS key from lib/setup
  createdBy: string;
  createdAt: string; // ISO or "—"
};

const PRIORITY_KEY = "nexus_task_priorities";

// Ordered low → urgent. ids match the original hardcoded values so existing
// tasks keep their priority after the upgrade.
const DEFAULT_PRIORITIES: Priority[] = [
  { id: "low", name: "Low", color: "slate", createdBy: "System", createdAt: "—" },
  { id: "medium", name: "Medium", color: "sky", createdBy: "System", createdAt: "—" },
  { id: "high", name: "High", color: "amber", createdBy: "System", createdAt: "—" },
  { id: "urgent", name: "Urgent", color: "rose", createdBy: "System", createdAt: "—" },
];

export function loadPriorities(): Priority[] {
  if (typeof window === "undefined") return DEFAULT_PRIORITIES;
  try {
    const raw = window.localStorage.getItem(PRIORITY_KEY);
    if (!raw) {
      window.localStorage.setItem(PRIORITY_KEY, JSON.stringify(DEFAULT_PRIORITIES));
      return DEFAULT_PRIORITIES;
    }
    const parsed = JSON.parse(raw) as Priority[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PRIORITIES;
  } catch {
    return DEFAULT_PRIORITIES;
  }
}

export function savePriorities(list: Priority[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRIORITY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// Look up display metadata for a priority id within a given set.
export function priorityMeta(priorities: Priority[], id: TaskPriority) {
  const p = priorities.find((x) => x.id === id) ?? priorities[0];
  return {
    id: p?.id ?? "low",
    name: p?.name ?? "—",
    chip: colorBadge(p?.color ?? "slate"),
    dot: colorDot(p?.color ?? "slate"),
  };
}

export type TaskComment = {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type ActivityKind = "created" | "status" | "assign" | "priority" | "due" | "comment" | "edit";

export type Activity = {
  id: string;
  kind: ActivityKind;
  actorName: string;
  message: string;
  at: string; // ISO
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeEmails: string[];
  createdByName: string;
  createdByEmail: string;
  dueDate: string; // yyyy-mm-dd or ""
  createdAt: string; // ISO
  tags: string[];
  comments: TaskComment[];
  activity: Activity[];
  completedAt?: string;
};

const KEY = "nexus_tasks_v1";

function iso(daysFromNow: number): string {
  return new Date(2026, 5, 24 + daysFromNow).toISOString();
}
function due(daysFromNow: number): string {
  const d = new Date(2026, 5, 24 + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const SEED: Task[] = [
  {
    id: "t-1",
    title: "Proposal review: Infosys Ltd.",
    description: "Review the enterprise proposal draft and add pricing tiers before sending to the client.",
    status: "in_progress",
    priority: "high",
    assigneeEmails: ["aarav.sharma@educationvibes.in"],
    createdByName: "Admin",
    createdByEmail: "admin@nexus.com",
    dueDate: due(0),
    createdAt: iso(-2),
    tags: ["Admissions", "Proposal"],
    comments: [],
    activity: [{ id: "a1", kind: "created", actorName: "Admin", message: "created this task", at: iso(-2) }],
  },
  {
    id: "t-2",
    title: "Follow-up: Tata Consultancy",
    description: "Call the procurement lead and confirm the contract start date.",
    status: "todo",
    priority: "medium",
    assigneeEmails: ["diya.patel@educationvibes.in"],
    createdByName: "Admin",
    createdByEmail: "admin@nexus.com",
    dueDate: due(1),
    createdAt: iso(-1),
    tags: ["Follow-up"],
    comments: [],
    activity: [{ id: "a2", kind: "created", actorName: "Admin", message: "created this task", at: iso(-1) }],
  },
  {
    id: "t-3",
    title: "Update CRM pipeline data",
    description: "Clean stale leads and re-stage this quarter's enquiries.",
    status: "review",
    priority: "low",
    assigneeEmails: ["vivaan.reddy@educationvibes.in", "ananya.nair@educationvibes.in"],
    createdByName: "Admin",
    createdByEmail: "admin@nexus.com",
    dueDate: due(3),
    createdAt: iso(-3),
    tags: ["Data"],
    comments: [],
    activity: [{ id: "a3", kind: "created", actorName: "Admin", message: "created this task", at: iso(-3) }],
  },
  {
    id: "t-4",
    title: "Onboard new counsellor",
    description: "Set up accounts, share the playbook and schedule intro calls.",
    status: "done",
    priority: "medium",
    assigneeEmails: ["aditya.iyer@educationvibes.in"],
    createdByName: "Admin",
    createdByEmail: "admin@nexus.com",
    dueDate: due(-1),
    createdAt: iso(-5),
    completedAt: iso(-1),
    tags: ["Onboarding"],
    comments: [],
    activity: [
      { id: "a4", kind: "created", actorName: "Admin", message: "created this task", at: iso(-5) },
      { id: "a5", kind: "status", actorName: "Admin", message: "marked it Done", at: iso(-1) },
    ],
  },
];

export function loadTasks(): Task[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as Task[];
    if (!Array.isArray(parsed)) return SEED;
    return parsed.map((t) => ({
      ...t,
      assigneeEmails: t.assigneeEmails ?? [],
      tags: t.tags ?? [],
      comments: t.comments ?? [],
      activity: t.activity ?? [],
    }));
  } catch {
    return SEED;
  }
}

export function saveTasks(list: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// ---- date helpers -----------------------------------------------------------

export type DueState = "none" | "overdue" | "today" | "soon" | "later";

export function dueState(task: Task): DueState {
  if (task.status === "done" || !task.dueDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(task.dueDate + "T00:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 2) return "soon";
  return "later";
}

export function formatDue(dateStr: string): string {
  if (!dateStr) return "No due date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function makeActivity(kind: ActivityKind, actorName: string, message: string): Activity {
  return { id: `act-${Date.now()}-${Math.floor(Math.random() * 100000)}`, kind, actorName, message, at: new Date().toISOString() };
}
