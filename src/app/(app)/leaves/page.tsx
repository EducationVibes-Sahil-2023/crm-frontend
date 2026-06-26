"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  LEAVE_BALANCE,
  LEAVE_TYPES,
  listEmployees,
  loadLeaves,
  saveLeaves,
  type Employee,
  type Leave,
  type LeaveStatus,
} from "@/lib/hr";

const STATUS_STYLE: Record<LeaveStatus, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};

const TYPE_META: Record<string, { badge: string; bar: string; soft: string; text: string; icon: IconName }> = {
  Casual: { badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500", soft: "bg-blue-50", text: "text-blue-600", icon: "calendar" },
  Sick: { badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", soft: "bg-rose-50", text: "text-rose-600", icon: "alert" },
  Earned: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-600", icon: "win" },
  Unpaid: { badge: "bg-slate-100 text-slate-600", bar: "bg-slate-400", soft: "bg-slate-50", text: "text-slate-500", icon: "clock" },
};
const typeMeta = (t: string) => TYPE_META[t] ?? TYPE_META.Unpaid;

const AVATARS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const avatarColor = (s: string) => AVATARS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length];
const initials = (s: string) => s.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

function daysBetween(from: string, to: string): number {
  const a = new Date(from), b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}
function fmt(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function asDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function weekday(s: string): string {
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { weekday: "short" });
}
function yearOf(s: string): number {
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getFullYear();
}
function monthOf(s: string): number {
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getMonth();
}
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function LeavesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [filter, setFilter] = useState<"All" | LeaveStatus>("All");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Leave | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());

  const employees = useMemo(() => listEmployees(), []);
  const empByName = useMemo(() => new Map(employees.map((e) => [e.name, e])), [employees]);

  useEffect(() => {
    const t = setTimeout(() => { setLeaves(loadLeaves()); setLoading(false); setReady(true); }, 450);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (ready) saveLeaves(leaves); }, [leaves, ready]);

  // Years present in the data (+ current year), newest first, for the selector.
  const years = useMemo(() => {
    const set = new Set<number>(leaves.map((l) => yearOf(l.from)).filter(Boolean));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [leaves]);

  // Everything below is scoped to the selected year (by the leave's start date).
  const yearLeaves = useMemo(() => leaves.filter((l) => yearOf(l.from) === year), [leaves, year]);

  const counts = useMemo(() => ({
    All: yearLeaves.length,
    Pending: yearLeaves.filter((l) => l.status === "Pending").length,
    Approved: yearLeaves.filter((l) => l.status === "Approved").length,
    Rejected: yearLeaves.filter((l) => l.status === "Rejected").length,
  }), [yearLeaves]);

  // Approved leave days per month for the selected year (Jan→Dec).
  const monthly = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    yearLeaves.forEach((l) => { if (l.status === "Approved") arr[monthOf(l.from)] += l.days; });
    return arr;
  }, [yearLeaves]);
  const monthlyMax = Math.max(1, ...monthly);
  const totalDaysYear = monthly.reduce((a, b) => a + b, 0);

  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }, []);
  const onLeaveToday = useMemo(
    () => leaves.filter((l) => {
      if (l.status !== "Approved") return false;
      const f = asDate(l.from), t = asDate(l.to);
      return f && t && f <= today && today <= t;
    }),
    [leaves, today],
  );
  const upcoming = useMemo(() => {
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    return leaves.filter((l) => { const f = asDate(l.from); return l.status !== "Rejected" && f && f > today && f <= in30; }).length;
  }, [leaves, today]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return yearLeaves.filter((l) =>
      (filter === "All" || l.status === filter) &&
      (typeFilter === "All types" || l.type === typeFilter) &&
      (!q || l.employee.toLowerCase().includes(q) || l.type.toLowerCase().includes(q) || l.reason.toLowerCase().includes(q)),
    );
  }, [yearLeaves, filter, typeFilter, query]);

  function decide(id: string, status: LeaveStatus) {
    setLeaves((all) => all.map((l) => (l.id === id ? { ...l, status } : l)));
    setSelected((s) => (s && s.id === id ? { ...s, status } : s));
    toast[status === "Approved" ? "success" : "info"](`Leave ${status.toLowerCase()}`, "The request was updated.");
  }
  function applyLeave(l: Leave) {
    setLeaves((all) => [l, ...all]);
    setOpen(false);
    toast.success("Leave applied", `${l.days} day(s) of ${l.type} leave submitted for approval.`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leave Management</h1>
          <p className="mt-1 text-sm text-slate-500">Apply for leave, track balances and approve requests — all in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
            <button onClick={() => setYear((y) => y - 1)} aria-label="Previous year" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg></button>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border-0 bg-transparent px-1 text-sm font-semibold text-slate-800 outline-none">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setYear((y) => y + 1)} aria-label="Next year" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg></button>
          </div>
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            <Icon name="plus" className="h-4 w-4" /> Apply Leave
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="clock" label="Pending approval" value={counts.Pending} wrap="bg-amber-100 text-amber-600" hint={`In ${year}`} />
        <StatCard icon="check" label={`Approved in ${year}`} value={counts.Approved} wrap="bg-emerald-100 text-emerald-600" hint={`${totalDaysYear} day(s) taken`} />
        <StatCard icon="users" label="On leave today" value={onLeaveToday.length} wrap="bg-blue-100 text-blue-600" hint={onLeaveToday.length ? onLeaveToday.map((l) => l.employee.split(" ")[0]).slice(0, 3).join(", ") : "Everyone's in"} />
        <StatCard icon="calendar" label="Upcoming (30 days)" value={upcoming} wrap="bg-violet-100 text-violet-600" hint="Planned leaves" />
      </div>

      {/* Year-wise monthly trend */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Leaves taken by month · {year}</h2>
            <p className="text-xs text-slate-500">Approved leave days across the year</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{totalDaysYear} day(s) total</span>
        </div>
        <div className="flex items-end justify-between gap-1.5 sm:gap-3">
          {monthly.map((d, i) => {
            const h = d > 0 ? Math.max(6, (d / monthlyMax) * 100) : 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end justify-center">
                  <div className="flex w-5 flex-1 items-end rounded-md bg-slate-100 sm:w-7" title={`${d} day(s)`}>
                    {h > 0 && <div className="w-full rounded-md bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: `${h}%` }} />}
                  </div>
                </div>
                <span className="text-[10px] font-medium uppercase text-slate-400">{MONTHS_SHORT[i]}</span>
                <span className={`text-[11px] font-semibold ${d > 0 ? "text-slate-700" : "text-slate-300"}`}>{d || ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Balances */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Leave balances · {year}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LEAVE_TYPES.map((t) => {
            const used = yearLeaves.filter((l) => l.type === t && l.status === "Approved").reduce((a, l) => a + l.days, 0);
            const total = LEAVE_BALANCE[t] ?? 0;
            const remaining = Math.max(0, total - used);
            const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
            const m = typeMeta(t);
            return (
              <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${m.soft} ${m.text}`}><Icon name={m.icon} className="h-4 w-4" /></span>
                    {t}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.badge}`}>{total > 0 ? `${remaining} left` : "Unlimited"}</span>
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">{remaining}<span className="text-sm font-normal text-slate-400"> / {total || "∞"}</span></p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{used} day(s) used</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Requests */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["All", "Pending", "Approved", "Rejected"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === f ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {f}
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-36"><SearchSelect value={typeFilter} onChange={setTypeFilter} options={["All types", ...LEAVE_TYPES]} searchable={false} /></div>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-44 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
        </div>
        <div className="no-scrollbar max-h-[55vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Dates</th>
                <th className="px-6 py-3">Days</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} className="border-b border-slate-100">{Array.from({ length: 6 }).map((_, c) => <td key={c} className="px-6 py-4"><Skeleton className="h-3.5 w-20" /></td>)}</tr>
                ))
              ) : shown.length === 0 ? (
                <tr><td colSpan={6}><EmptyRows onApply={() => setOpen(true)} /></td></tr>
              ) : (
                shown.map((l) => {
                  const emp = empByName.get(l.employee);
                  const m = typeMeta(l.type);
                  return (
                    <tr key={l.id} onClick={() => setSelected(l)} className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(l.employee)}`}>{initials(l.employee)}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{l.employee}</p>
                            <p className="truncate text-xs text-slate-500">{emp ? `${emp.designation} · ${emp.department}` : `Applied ${l.appliedAt}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.badge}`}>{l.type}</span></td>
                      <td className="px-6 py-3 text-slate-600"><span className="whitespace-nowrap">{l.from}</span> <span className="text-slate-400">→</span> <span className="whitespace-nowrap">{l.to}</span></td>
                      <td className="px-6 py-3"><span className="font-medium text-slate-800">{l.days}</span></td>
                      <td className="px-6 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[l.status]}`}>{l.status}</span></td>
                      <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {l.status === "Pending" ? (
                            <>
                              <button onClick={() => decide(l.id, "Approved")} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700">Approve</button>
                              <button onClick={() => decide(l.id, "Rejected")} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Reject</button>
                            </>
                          ) : (
                            <button onClick={() => setSelected(l)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="View"><Icon name="eye" className="h-4 w-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <DetailDrawer leave={selected} emp={empByName.get(selected.employee)} onDecide={decide} onClose={() => setSelected(null)} />}
      {open && <ApplyLeave employees={employees} leaves={leaves} onClose={() => setOpen(false)} onApply={applyLeave} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function StatCard({ icon, label, value, wrap, hint }: { icon: IconName; label: string; value: ReactNode; wrap: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-2 truncate text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function DetailDrawer({ leave, emp, onDecide, onClose }: { leave: Leave; emp?: Employee; onDecide: (id: string, s: LeaveStatus) => void; onClose: () => void }) {
  const m = typeMeta(leave.type);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-bold ring-2 ring-white/40 backdrop-blur`}>{initials(leave.employee)}</span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{leave.employee}</h2>
                <p className="truncate text-sm text-blue-100">{emp ? `${emp.designation} · ${emp.department}` : "Employee"}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${m.badge}`}><Icon name={m.icon} className="h-4 w-4" /> {leave.type} Leave</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[leave.status]}`}>{leave.status}</span>
          </div>

          {/* date range card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{weekday(leave.from)}</p>
                <p className="text-sm font-semibold text-slate-900">{leave.from}</p>
              </div>
              <div className="flex flex-col items-center px-3 text-slate-400">
                <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-700">{leave.days} day{leave.days === 1 ? "" : "s"}</span>
                <Icon name="arrowLeft" className="mt-1 h-4 w-4 rotate-180" />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{weekday(leave.to)}</p>
                <p className="text-sm font-semibold text-slate-900">{leave.to}</p>
              </div>
            </div>
          </div>

          <InfoRow label="Reason" value={leave.reason || "—"} />
          {emp && <InfoRow label="Email" value={emp.email} />}
          <InfoRow label="Applied on" value={leave.appliedAt} />

          {/* timeline */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Progress</p>
            <ol className="space-y-3">
              <TimelineStep done icon="check" tone="bg-blue-100 text-blue-600" title="Request submitted" sub={`Applied ${leave.appliedAt}`} />
              <TimelineStep
                done={leave.status !== "Pending"}
                icon={leave.status === "Rejected" ? "close" : "check"}
                tone={leave.status === "Approved" ? "bg-emerald-100 text-emerald-600" : leave.status === "Rejected" ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-400"}
                title={leave.status === "Approved" ? "Approved" : leave.status === "Rejected" ? "Rejected" : "Awaiting approval"}
                sub={leave.status === "Pending" ? "Pending manager decision" : "Decision recorded"}
              />
            </ol>
          </div>
        </div>

        {leave.status === "Pending" && (
          <div className="flex gap-2 border-t border-slate-200 px-6 py-4">
            <button onClick={() => onDecide(leave.id, "Rejected")} className="flex-1 rounded-lg border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">Reject</button>
            <button onClick={() => onDecide(leave.id, "Approved")} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">Approve</button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="max-w-[60%] text-right text-sm text-slate-700">{value}</span>
    </div>
  );
}

function TimelineStep({ done, icon, tone, title, sub }: { done: boolean; icon: IconName; tone: string; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? tone : "bg-slate-100 text-slate-300"}`}><Icon name={icon} className="h-4 w-4" /></span>
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </li>
  );
}

function EmptyRows({ onApply }: { onApply: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="calendar" className="h-7 w-7" /></div>
      <p className="mt-3 text-sm font-semibold text-slate-900">No leave requests here</p>
      <p className="mt-1 text-sm text-slate-400">Requests will show up as they come in.</p>
      <button onClick={onApply} className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Apply Leave</button>
    </div>
  );
}

/* ---- Apply Leave modal ---- */

function ApplyLeave({ employees, leaves, onClose, onApply }: { employees: Employee[]; leaves: Leave[]; onClose: () => void; onApply: (l: Leave) => void }) {
  const toast = useToast();
  const [employee, setEmployee] = useState(employees[0]?.name ?? "");
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");

  const sameDay = from && to && from === to;
  const rawDays = from && to ? daysBetween(from, to) : 0;
  const days = sameDay && halfDay ? 0.5 : rawDays;

  const balance = useMemo(() => {
    const total = LEAVE_BALANCE[type] ?? 0;
    const used = leaves.filter((l) => l.employee === employee && l.type === type && l.status === "Approved").reduce((a, l) => a + l.days, 0);
    return { total, used, remaining: Math.max(0, total - used) };
  }, [type, employee, leaves]);

  const overBalance = balance.total > 0 && days > balance.remaining;
  const invalidRange = Boolean(from && to && new Date(to) < new Date(from));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) { toast.error("Pick dates", "Select both a start and end date."); return; }
    if (invalidRange) { toast.error("Invalid range", "The end date can't be before the start date."); return; }
    onApply({
      id: `lv-${Date.now().toString(36)}`,
      employee, type, from: fmt(from), to: fmt(to), days,
      reason: reason.trim(), status: "Pending",
      appliedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} noValidate className="no-scrollbar my-6 w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        {/* gradient header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Apply for Leave</h2>
              <p className="text-sm text-blue-100">Submit a new leave request for approval.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <L label="Employee">
            <SearchSelect value={employee} onChange={setEmployee} options={employees.map((e) => e.name)} placeholder="Select employee" />
          </L>

          {/* leave type cards */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Leave type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LEAVE_TYPES.map((t) => {
                const m = typeMeta(t);
                const active = type === t;
                return (
                  <button key={t} type="button" onClick={() => setType(t)} className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium transition ${active ? `border-blue-500 ${m.soft} ${m.text}` : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    <Icon name={m.icon} className="h-4 w-4" />
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <L label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateCls(invalidRange)} /></L>
            <L label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} className={dateCls(invalidRange)} /></L>
          </div>

          {sameDay && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
              Half day (0.5)
            </label>
          )}

          {/* live summary */}
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${overBalance ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
            <div>
              <p className={`font-semibold ${overBalance ? "text-rose-700" : "text-blue-700"}`}>{days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "Select dates"}</p>
              <p className={`text-xs ${overBalance ? "text-rose-500" : "text-blue-500"}`}>
                {balance.total > 0 ? `${balance.remaining} ${type} day(s) available` : `${type} leave is unpaid / unlimited`}
              </p>
            </div>
            {overBalance && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Exceeds balance</span>}
          </div>

          <L label="Reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Reason for leave…" /></L>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={!from || !to || invalidRange} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">Submit request</button>
        </div>
      </form>
    </div>
  );
}

const dateCls = (err?: boolean) =>
  `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${err ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`;

function L({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>;
}
