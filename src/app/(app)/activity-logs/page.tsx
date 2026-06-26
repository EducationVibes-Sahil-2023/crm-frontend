"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  CATEGORY_META,
  activityUsers,
  clearActivities,
  dayKey,
  loadActivities,
  relativeTime,
  type Activity,
  type ActivityCategory,
} from "@/lib/activity";

const CATEGORIES: (ActivityCategory | "all")[] = ["all", "auth", "lead", "setup", "media", "task", "user"];

export default function ActivityLogsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Activity[]>([]);
  const [user, setUser] = useState("All Users");
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setItems(loadActivities());
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const users = useMemo(() => ["All Users", ...activityUsers(items)], [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) => user === "All Users" || a.user === user)
      .filter((a) => category === "all" || a.category === category)
      .filter((a) => !q || a.action.toLowerCase().includes(q) || (a.target ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [items, user, category, query]);

  // Group by day for the pipeline stages.
  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of filtered) {
      const key = dayKey(a.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayCount = items.filter((a) => new Date(a.at).toDateString() === today).length;
    return {
      total: items.length,
      today: todayCount,
      users: new Set(items.map((a) => a.user)).size,
      categories: new Set(items.map((a) => a.category)).size,
    };
  }, [items]);

  function handleClear() {
    clearActivities();
    setItems([]);
    toast.info("Activity cleared", "All activity log entries were removed.");
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="activity" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Activity Logs</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                A live pipeline of everything happening across your workspace.
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
          >
            <Icon name="trash" className="h-4 w-4" />
            Clear log
          </button>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Total events" value={stats.total} />
          <Stat label="Today" value={stats.today} />
          <Stat label="Active users" value={stats.users} />
          <Stat label="Categories" value={stats.categories} />
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">User</label>
            <select
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {users.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Search</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actions or targets…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        <div className="no-scrollbar mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => {
            const active = category === c;
            const label = c === "all" ? "All" : CATEGORY_META[c].label;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c !== "all" && (
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : CATEGORY_META[c].dot}`} />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pipeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <div className="space-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Icon name="activity" className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No activity found</p>
            <p className="mt-1 text-sm text-slate-400">Try a different user, category or search.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Continuous pipeline rail */}
            <div className="absolute bottom-3 left-5 top-3 w-0.5 bg-gradient-to-b from-blue-400 via-slate-200 to-transparent" />

            <div className="space-y-2">
              {groups.map(([day, entries], gi) => (
                <div key={day} className="space-y-2">
                  {/* Stage junction */}
                  <div className="relative flex items-center gap-4 py-1">
                    <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md ring-4 ring-white">
                      <Icon name="calendar" className="h-[18px] w-[18px]" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{gi === 0 ? "Latest" : day}</span>
                      {gi === 0 && <span className="text-xs font-medium text-slate-400">· {day}</span>}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {entries.length} {entries.length === 1 ? "event" : "events"}
                      </span>
                    </div>
                  </div>

                  {/* Event nodes */}
                  {entries.map((a) => (
                    <EventNode key={a.id} activity={a} />
                  ))}
                </div>
              ))}

              {/* Pipeline origin cap */}
              <div className="relative flex items-center gap-4 pt-1">
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white text-slate-300">
                  <Icon name="more" className="h-4 w-4" filled />
                </span>
                <span className="text-xs font-medium text-slate-400">Start of recorded activity</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventNode({ activity: a }: { activity: Activity }) {
  const meta = CATEGORY_META[a.category];
  return (
    <div className="group relative flex items-stretch gap-4">
      {/* Node marker on the rail */}
      <span
        className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-white transition group-hover:scale-105 ${meta.badge}`}
      >
        <Icon name={meta.icon} className="h-[18px] w-[18px]" />
      </span>

      {/* Connector + card */}
      <div className="relative mb-1 flex-1">
        {/* horizontal tie-in to the rail */}
        <span className="absolute -left-4 top-5 h-0.5 w-4 bg-slate-200 transition group-hover:bg-blue-300" />

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition group-hover:border-blue-200 group-hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-[11px] font-bold text-white">
                {initials(a.user)}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug text-slate-800">
                  <span className="font-semibold text-slate-900">{a.user}</span> {a.action}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  {a.target && (
                    <span className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      <Icon name="briefcase" className="h-3 w-3 shrink-0" />
                      <span className="truncate">{a.target}</span>
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-slate-300">{a.id.slice(0, 12)}</span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-slate-600" title={new Date(a.at).toLocaleString()}>
                {clockTime(a.at)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{relativeTime(a.at)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
