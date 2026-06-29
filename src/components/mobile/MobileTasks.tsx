"use client";

// Mobile (phones-only) Task Management — a feed of task cards with quick
// complete toggles and status filter chips. Rendered only inside `lg:hidden` on
// the Tasks page; desktop keeps its board/list view. Reads + writes the same
// task store, so changes stay in sync with the desktop view.

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { findUser, initialsOf } from "@/lib/directory";
import {
  dueState,
  formatDue,
  loadPriorities,
  loadTasks,
  priorityMeta,
  saveTasks,
  statusMeta,
  STATUSES,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";

type Filter = "all" | TaskStatus;

const DUE_TONE: Record<string, string> = {
  overdue: "text-rose-600",
  today: "text-amber-600",
  soon: "text-blue-600",
  later: "text-slate-500",
  none: "text-slate-400",
};

export default function MobileTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setTasks(loadTasks());
    setPriorities(loadPriorities());
  }, []);

  const counts = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done").length;
    return { all: tasks.length, open };
  }, [tasks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => (filter === "all" ? true : t.status === filter))
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => {
        // Open first, then by due date (empty due last).
        if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
        return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
      });
  }, [tasks, filter, query]);

  function toggleDone(task: Task) {
    setTasks((list) => {
      const next = list.map((t) =>
        t.id === task.id
          ? { ...t, status: (t.status === "done" ? "todo" : "done") as TaskStatus, completedAt: t.status === "done" ? undefined : new Date().toISOString() }
          : t,
      );
      saveTasks(next);
      return next;
    });
  }

  return (
    <div className="space-y-3 pb-2">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold leading-tight">My Tasks</h1>
            <p className="text-xs text-blue-100">{counts.open} open · {counts.all} total</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/25"><Icon name="task" className="h-5 w-5" /></span>
        </div>
        <div className="relative mt-3">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full rounded-xl border-0 bg-white/15 py-2.5 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/20 placeholder:text-white/60 focus:bg-white/25 focus:ring-2 focus:ring-white/40"
          />
        </div>
      </section>

      {/* Status filter chips */}
      <section className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {STATUSES.map((s) => (
          <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={s.label} />
        ))}
      </section>

      {/* Task feed */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Icon name="task" className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No tasks here</p>
          <p className="text-xs text-slate-400">Try another filter.</p>
        </div>
      ) : (
        <section className="space-y-2.5">
          {visible.map((t) => {
            const sm = statusMeta(t.status);
            const pm = priorityMeta(priorities, t.priority);
            const ds = dueState(t);
            const done = t.status === "done";
            return (
              <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleDone(t)}
                    aria-label={done ? "Mark as to-do" : "Mark done"}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-400"
                    }`}
                  >
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.chip}`}>{sm.label}</span>
                      {pm && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <span className={`h-2 w-2 rounded-full ${pm.dot}`} /> {pm.name}
                        </span>
                      )}
                      {t.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${DUE_TONE[ds] ?? "text-slate-500"}`}>
                          <Icon name="calendar" className="h-3 w-3" /> {formatDue(t.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Assignee avatars */}
                  <div className="flex shrink-0 -space-x-2">
                    {t.assigneeEmails.slice(0, 3).map((email) => {
                      const u = findUser(email);
                      const label = u?.name ?? email;
                      return (
                        <span key={email} title={label} className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 ring-2 ring-white">
                          {initialsOf(label)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
