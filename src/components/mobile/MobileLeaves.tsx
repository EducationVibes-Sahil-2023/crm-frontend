"use client";

// Mobile (phones-only) Leave Management — balances at a glance, a one-tap apply
// sheet, and an approvals feed with inline approve / reject. Rendered only inside
// `lg:hidden` on the leaves page; reads/writes the same `hr_leaves_v1` store as
// desktop so requests and decisions stay in sync.

import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  LEAVE_BALANCE, LEAVE_TYPES, listEmployees, loadLeaves, saveLeaves,
  type Employee, type Leave, type LeaveStatus,
} from "@/lib/hr";

const STATUS_STYLE: Record<LeaveStatus, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};
const TYPE_META: Record<string, { soft: string; text: string; bar: string; icon: IconName }> = {
  Casual: { soft: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500", icon: "calendar" },
  Sick: { soft: "bg-rose-50", text: "text-rose-600", bar: "bg-rose-500", icon: "alert" },
  Earned: { soft: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500", icon: "win" },
  Unpaid: { soft: "bg-slate-50", text: "text-slate-500", bar: "bg-slate-400", icon: "clock" },
};
const typeMeta = (t: string) => TYPE_META[t] ?? TYPE_META.Unpaid;
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

type Filter = "All" | LeaveStatus;

export default function MobileLeaves() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [open, setOpen] = useState(false);
  const employees = useMemo(() => listEmployees(), []);
  const year = new Date().getFullYear();

  useEffect(() => { setLeaves(loadLeaves()); setReady(true); }, []);
  useEffect(() => { if (ready) saveLeaves(leaves); }, [leaves, ready]);

  const yearLeaves = useMemo(() => leaves.filter((l) => new Date(l.from).getFullYear() === year), [leaves, year]);
  const counts = useMemo(() => ({
    All: yearLeaves.length,
    Pending: yearLeaves.filter((l) => l.status === "Pending").length,
    Approved: yearLeaves.filter((l) => l.status === "Approved").length,
    Rejected: yearLeaves.filter((l) => l.status === "Rejected").length,
  }), [yearLeaves]);

  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }, []);
  const onLeaveToday = useMemo(() => leaves.filter((l) => {
    if (l.status !== "Approved") return false;
    const f = new Date(l.from).getTime(), t = new Date(l.to).getTime();
    return !isNaN(f) && !isNaN(t) && f <= today && today <= t + 864e5 - 1;
  }).length, [leaves, today]);

  const shown = useMemo(() => yearLeaves.filter((l) => filter === "All" || l.status === filter), [yearLeaves, filter]);

  function decide(id: string, status: LeaveStatus) {
    setLeaves((all) => all.map((l) => (l.id === id ? { ...l, status } : l)));
    toast[status === "Approved" ? "success" : "info"](`Leave ${status.toLowerCase()}`, "The request was updated.");
  }
  function applyLeave(l: Leave) {
    setLeaves((all) => [l, ...all]);
    setOpen(false);
    toast.success("Leave applied", `${l.days} day(s) of ${l.type} submitted for approval.`);
  }

  return (
    <div className="space-y-3 pb-2">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold leading-tight">Leave</h1>
            <p className="text-xs text-blue-100">{counts.Pending} pending · {onLeaveToday} on leave today</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/25"><Icon name="calendar" className="h-5 w-5" /></span>
        </div>
        <button onClick={() => setOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-blue-700 transition active:scale-95">
          <Icon name="plus" className="h-4 w-4" /> Apply for leave
        </button>
      </section>

      {/* Balances */}
      <section className="grid grid-cols-2 gap-2">
        {LEAVE_TYPES.map((t) => {
          const used = yearLeaves.filter((l) => l.type === t && l.status === "Approved").reduce((a, l) => a + l.days, 0);
          const total = LEAVE_BALANCE[t] ?? 0;
          const remaining = Math.max(0, total - used);
          const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
          const m = typeMeta(t);
          return (
            <div key={t} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${m.soft} ${m.text}`}><Icon name={m.icon} className="h-3.5 w-3.5" /></span>
                  {t}
                </span>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{total > 0 ? remaining : "∞"}<span className="text-xs font-normal text-slate-400">{total > 0 ? ` / ${total}` : ""}</span></p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${m.bar}`} style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-[10px] text-slate-400">{used} day(s) used</p>
            </div>
          );
        })}
      </section>

      {/* Filter chips */}
      <section className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {(["All", "Pending", "Approved", "Rejected"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            {f}<span className={`rounded-full px-1.5 text-[10px] font-bold ${filter === f ? "bg-white/25" : "bg-white text-slate-500"}`}>{counts[f]}</span>
          </button>
        ))}
      </section>

      {/* Requests */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Icon name="calendar" className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No leave requests</p>
          <p className="text-xs text-slate-400">Tap “Apply for leave” to add one.</p>
        </div>
      ) : (
        <section className="space-y-2.5">
          {shown.map((l) => {
            const m = typeMeta(l.type);
            return (
              <article key={l.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${m.soft} ${m.text}`}>{initials(l.employee)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{l.employee}</p>
                    <p className="truncate text-xs text-slate-500">{l.type} · {l.days}d · {l.from}{l.to !== l.from ? ` → ${l.to}` : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                </div>
                {l.reason && <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">{l.reason}</p>}
                {l.status === "Pending" && (
                  <div className="mt-2.5 flex gap-2">
                    <button onClick={() => decide(l.id, "Rejected")} className="flex-1 rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs font-semibold text-rose-700 transition active:scale-95">Reject</button>
                    <button onClick={() => decide(l.id, "Approved")} className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition active:scale-95">Approve</button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {open && <ApplyLeaveSheet employees={employees} leaves={leaves} onClose={() => setOpen(false)} onApply={applyLeave} />}
    </div>
  );
}

function ApplyLeaveSheet({ employees, leaves, onClose, onApply }: { employees: Employee[]; leaves: Leave[]; onClose: () => void; onApply: (l: Leave) => void }) {
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
    return { total, remaining: Math.max(0, total - used) };
  }, [type, employee, leaves]);
  const overBalance = balance.total > 0 && days > balance.remaining;
  const invalidRange = Boolean(from && to && new Date(to) < new Date(from));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return toast.error("Pick dates", "Select both a start and end date.");
    if (invalidRange) return toast.error("Invalid range", "The end date can't be before the start date.");
    onApply({
      id: `lv-${Date.now().toString(36)}`, employee, type, from: fmt(from), to: fmt(to), days,
      reason: reason.trim(), status: "Pending",
      appliedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    });
  }
  const cls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" />
        <div className="flex items-center justify-between px-5 pt-3">
          <h3 className="text-base font-bold text-slate-900">Apply for leave</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 pt-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Employee</label>
            <select value={employee} onChange={(e) => setEmployee(e.target.value)} className={cls}>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Leave type</label>
            <div className="grid grid-cols-4 gap-2">
              {LEAVE_TYPES.map((t) => {
                const m = typeMeta(t);
                const active = type === t;
                return (
                  <button key={t} type="button" onClick={() => setType(t)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition ${active ? `border-blue-500 ${m.soft} ${m.text}` : "border-slate-200 text-slate-600"}`}>
                    <Icon name={m.icon} className="h-4 w-4" />{t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs font-medium text-slate-500">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-500">To</label><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={cls} /></div>
          </div>
          {sameDay && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" /> Half day (0.5)
            </label>
          )}
          <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${overBalance ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
            <div>
              <p className={`font-semibold ${overBalance ? "text-rose-700" : "text-blue-700"}`}>{days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "Select dates"}</p>
              <p className={`text-[11px] ${overBalance ? "text-rose-500" : "text-blue-500"}`}>{balance.total > 0 ? `${balance.remaining} ${type} day(s) left` : `${type} is unpaid`}</p>
            </div>
            {overBalance && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Over balance</span>}
          </div>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason for leave…" className={`${cls} resize-none`} /></div>
          <button type="submit" disabled={!from || !to || invalidRange} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50">Submit request</button>
        </div>
      </form>
    </div>
  );
}
