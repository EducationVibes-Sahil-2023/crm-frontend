import type { IconName } from "@/components/icons";

export type ActivityCategory =
  | "auth"
  | "lead"
  | "setup"
  | "media"
  | "task"
  | "user"
  | "system";

export type Activity = {
  id: string;
  user: string;
  action: string;
  category: ActivityCategory;
  target?: string;
  at: string; // ISO timestamp
};

export const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; icon: IconName; badge: string; dot: string }
> = {
  auth: { label: "Auth", icon: "logout", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  lead: { label: "Lead", icon: "leads", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  setup: { label: "Setup", icon: "settings", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  media: { label: "Media", icon: "media", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  task: { label: "Task", icon: "task", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  user: { label: "User", icon: "users", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  system: { label: "System", icon: "dashboard", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

const STORAGE_KEY = "activity_log_v1";
const MAX = 500;

function seed(): Activity[] {
  const now = Date.now();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  const mk = (offset: number, user: string, action: string, category: ActivityCategory, target?: string): Activity => ({
    id: `seed-${offset}-${user}`,
    user,
    action,
    category,
    target,
    at: new Date(now - offset).toISOString(),
  });
  return [
    mk(4 * min, "Administrator", "Signed in", "auth"),
    mk(35 * min, "Administrator", 'Created lead "Acme Corp"', "lead", "Acme Corp"),
    mk(2 * hr, "Administrator", 'Added Status "VIP"', "setup"),
    mk(3 * hr, "S. Patel", "Signed in", "auth"),
    mk(4 * hr, "S. Patel", "Uploaded 3 files", "media", "Q4 Assets"),
    mk(5 * hr, "S. Patel", 'Deleted lead "Globex"', "lead", "Globex"),
    mk(1 * day, "R. Gomez", "Signed in", "auth"),
    mk(1 * day + 2 * hr, "R. Gomez", "Completed task review", "task"),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

export function loadActivities(): Activity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seed();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as Activity[];
  } catch {
    return [];
  }
}

/** Append an activity entry. Safe to call from anywhere on the client. */
export function logActivity(
  action: string,
  opts: { category?: ActivityCategory; target?: string; user?: string } = {},
): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadActivities();
    const entry: Activity = {
      id: `a-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      user: opts.user ?? readUserName(),
      action,
      category: opts.category ?? "system",
      target: opts.target,
      at: new Date().toISOString(),
    };
    const next = [entry, ...list].slice(0, MAX);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore logging failures */
  }
}

export function clearActivities(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export function activityUsers(list: Activity[]): string[] {
  return Array.from(new Set(list.map((a) => a.user))).sort();
}

function readUserName(): string {
  try {
    const raw = window.localStorage.getItem("nexus_user");
    if (raw) return (JSON.parse(raw) as { name?: string }).name ?? "Unknown";
  } catch {
    /* noop */
  }
  return "System";
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
