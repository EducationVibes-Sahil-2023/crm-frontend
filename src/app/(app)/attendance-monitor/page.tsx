"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { colorBadge } from "@/lib/setup";
import { getUser } from "@/lib/auth";
import { listEmployees, loadARs, loadHolidays, loadLeaves, loadPunches, punchFromAR, saveARs, savePunches, workedHours, type ARRequest, type Punch } from "@/lib/hr";
import { evaluatePunch, format12, getUserShift } from "@/lib/shifts";
import { loadLocations, loadWorkTypes } from "@/lib/locations";
import SearchSelect from "@/components/SearchSelect";

const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

// ---------- shared time helpers ----------
function minToLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return format12(`${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
}
function lateLabel(n: number): string {
  return n <= 0 ? "" : n >= 60 ? `${Math.floor(n / 60)}h ${n % 60}m` : `${n}m`;
}
function parseDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// =================== DAILY ===================
const DAY_STATUS_STYLE: Record<string, string> = { "On time": "bg-emerald-100 text-emerald-700", Late: "bg-amber-100 text-amber-700", Absent: "bg-slate-100 text-slate-600" };
type DailyRow = { name: string; designation: string; shift: string; workType: string; color: string; location: string; checkIn?: string; checkOut?: string; status: string; lateBy: number; hours: string };

function buildDaily(): DailyRow[] {
  const types = loadWorkTypes();
  const locs = loadLocations();
  return listEmployees().map((e, i) => {
    const shift = getUserShift(e.name);
    const wt = types[i % types.length];
    const absent = i % 9 === 0;
    const [sh, sm] = shift.start.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const offset = i % 3 === 0 ? shift.graceMinutes + 5 + (i % 4) * 6 : -(i % 6);
    const [eh, em] = shift.end.split(":").map(Number);
    const checkIn = absent ? undefined : minToLabel(startMin + offset);
    const checkOut = absent ? undefined : minToLabel(eh * 60 + em - (i % 5));
    const evald = evaluatePunch(shift, checkIn);
    return {
      name: e.name, designation: e.designation, shift: shift.name, workType: wt.name, color: wt.color,
      location: wt.geofenced ? (locs[i % Math.max(1, locs.length)]?.name ?? "—") : "Remote",
      checkIn, checkOut, status: absent ? "Absent" : evald.status, lateBy: evald.lateBy,
      hours: workedHours({ date: "", checkIn, checkOut } as Punch),
    };
  });
}

// =================== MONTHLY ===================
type Code = "P" | "T" | "A" | "L" | "W" | "H" | "O" | "·";
const CODE_META: Record<Code, { cls: string; label: string }> = {
  P: { cls: "bg-emerald-500 text-white", label: "Present" },
  T: { cls: "bg-amber-500 text-white", label: "Late" },
  A: { cls: "bg-rose-500 text-white", label: "Absent" },
  L: { cls: "bg-sky-500 text-white", label: "Leave" },
  W: { cls: "bg-violet-500 text-white", label: "WFH" },
  H: { cls: "bg-indigo-400 text-white", label: "Holiday" },
  O: { cls: "bg-slate-100 text-slate-300", label: "Week off" },
  "·": { cls: "bg-slate-50 text-slate-200", label: "Upcoming" },
};

type Cell = { code: Code; date: string; login?: string; logout?: string; hours?: string; lateBy?: number; mode?: string; location?: string; note?: string };
type MonthRow = { name: string; designation: string; shift: string; cells: Cell[]; present: number; late: number; absent: number; leave: number; wfh: number; working: number };

function buildMonth(year: number, month: number) {
  const now = new Date();
  const daysIn = new Date(year, month + 1, 0).getDate();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
  const locs = loadLocations();

  const holidayName: Record<number, string> = {};
  for (const h of loadHolidays()) {
    const d = parseDate(h.date);
    if (d && d.getFullYear() === year && d.getMonth() === month) holidayName[d.getDate()] = h.name;
  }
  const leaveByName: Record<string, Record<number, string>> = {};
  for (const lv of loadLeaves()) {
    if (lv.status === "Rejected") continue;
    const from = parseDate(lv.from), to = parseDate(lv.to);
    if (!from || !to) continue;
    const map = (leaveByName[lv.employee] ??= {});
    for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
      const d = new Date(t);
      if (d.getFullYear() === year && d.getMonth() === month) map[d.getDate()] = lv.type;
    }
  }

  const dayMeta = Array.from({ length: daysIn }, (_, idx) => {
    const day = idx + 1;
    const dt = new Date(year, month, day);
    const dow = dt.getDay();
    const future = isFutureMonth || (isCurrent && day > now.getDate());
    return { day, dow, weekend: dow === 0, holiday: !!holidayName[day], future, isToday: isCurrent && day === now.getDate(), label: dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" }) };
  });
  const working = dayMeta.filter((d) => !d.weekend && !d.holiday && !d.future).length;

  const rows: MonthRow[] = listEmployees().map((e, i) => {
    const shift = getUserShift(e.name);
    const [sh, sm] = shift.start.split(":").map(Number);
    const [eh, em] = shift.end.split(":").map(Number);
    const startMin = sh * 60 + sm, endMin = eh * 60 + em;
    const leaves = leaveByName[e.name] ?? {};
    let present = 0, late = 0, absent = 0, leave = 0, wfh = 0;
    const cells: Cell[] = dayMeta.map(({ day, weekend, holiday, future, label }) => {
      const base = { date: label };
      if (future) return { ...base, code: "·" as Code, note: "Upcoming" };
      if (weekend) return { ...base, code: "O" as Code, note: "Weekly off" };
      if (holiday) return { ...base, code: "H" as Code, note: holidayName[day] ?? "Holiday" };
      if (leaves[day] != null) { leave++; return { ...base, code: "L" as Code, note: `${leaves[day]} leave` }; }
      if ((i * 7 + day) % 17 === 0) { absent++; return { ...base, code: "A" as Code, note: "No check-in recorded" }; }
      const isWfh = (i + day) % 6 === 0;
      const isLate = !isWfh && (i * 3 + day) % 9 === 0;
      const offset = isLate ? shift.graceMinutes + 5 + (i % 4) * 6 : -(day % 7);
      const login = minToLabel(startMin + offset);
      const logout = minToLabel(endMin - (day % 5));
      const hours = workedHours({ date: "", checkIn: login, checkOut: logout } as Punch);
      const mode = isWfh ? "WFH" : "Office";
      const location = isWfh ? "Remote" : (locs[i % Math.max(1, locs.length)]?.name ?? "Office");
      if (isWfh) { wfh++; present++; return { ...base, code: "W" as Code, login, logout, hours, mode, location }; }
      if (isLate) { late++; present++; return { ...base, code: "T" as Code, login, logout, hours, lateBy: evaluatePunch(shift, login).lateBy, mode, location }; }
      present++; return { ...base, code: "P" as Code, login, logout, hours, mode, location };
    });
    return { name: e.name, designation: e.designation, shift: shift.name, cells, present, late, absent, leave, wfh, working };
  });

  return { dayMeta, rows, working };
}

// =================== PAGE ===================
export default function AttendanceMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"monthly" | "daily">("monthly");
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [query, setQuery] = useState("");
  const [typeF, setTypeF] = useState("All Types");
  const [statusF, setStatusF] = useState("All");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const daily = useMemo(() => buildDaily(), []);
  const month = useMemo(() => buildMonth(cursor.y, cursor.m), [cursor]);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const typeOptions = useMemo(() => ["All Types", ...Array.from(new Set(daily.map((r) => r.workType)))], [daily]);
  const shownDaily = useMemo(() => daily.filter((r) => {
    const q = query.trim().toLowerCase();
    return (!q || r.name.toLowerCase().includes(q)) && (typeF === "All Types" || r.workType === typeF) && (statusF === "All" || r.status === statusF);
  }), [daily, query, typeF, statusF]);

  const shownMonth = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? month.rows.filter((r) => r.name.toLowerCase().includes(q)) : month.rows;
  }, [month, query]);

  const overall = useMemo(() => {
    const tot = month.rows.reduce((a, r) => ({ p: a.p + r.present, lt: a.lt + r.late, ab: a.ab + r.absent, lv: a.lv + r.leave }), { p: 0, lt: 0, ab: 0, lv: 0 });
    const cap = month.rows.length * month.working || 1;
    return { ...tot, pct: Math.round((tot.p / cap) * 100) };
  }, [month]);

  function step(d: number) {
    setCursor((c) => { const nd = new Date(c.y, c.m + d, 1); return { y: nd.getFullYear(), m: nd.getMonth() }; });
  }
  function thisMonth() {
    const d = new Date();
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }
  const isThisMonth = (() => { const d = new Date(); return cursor.y === d.getFullYear() && cursor.m === d.getMonth(); })();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-sm sm:p-6">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%),radial-gradient(circle_at_88%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="activity" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">All Attendance</h1>
              <p className="mt-0.5 text-sm text-blue-100">{view === "monthly" ? `Monthly register · ${monthLabel}` : "Today's login / logout for everyone"}</p>
            </div>
          </div>
          <div className="flex items-center rounded-xl bg-white/15 p-1 ring-1 ring-white/20 backdrop-blur">
            <button onClick={() => setView("monthly")} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${view === "monthly" ? "bg-white text-blue-700 shadow" : "text-white/90 hover:bg-white/10"}`}><Icon name="calendar" className="h-4 w-4" /> Monthly</button>
            <button onClick={() => setView("daily")} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${view === "daily" ? "bg-white text-blue-700 shadow" : "text-white/90 hover:bg-white/10"}`}><Icon name="clock" className="h-4 w-4" /> Today</button>
          </div>
        </div>

        {view === "monthly" && (
          <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3">
            <button onClick={() => step(-1)} className="rounded-lg bg-white/15 p-2 text-white ring-1 ring-white/20 hover:bg-white/25" aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg></button>
            <span className="min-w-40 text-center text-base font-bold">{monthLabel}</span>
            <button onClick={() => step(1)} className="rounded-lg bg-white/15 p-2 text-white ring-1 ring-white/20 hover:bg-white/25" aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg></button>
            {!isThisMonth && <button onClick={thisMonth} className="ml-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 hover:bg-white/25">This month</button>}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <RingStat pct={overall.pct} loading={loading} />
        <Stat icon="users" label="Employees" value={month.rows.length} tone="blue" loading={loading} />
        <Stat icon="check" label="Present" value={overall.p} tone="emerald" loading={loading} sub="man-days" />
        <Stat icon="clock" label="Late marks" value={overall.lt} tone="amber" loading={loading} />
        <Stat icon="calendar" label="On leave" value={overall.lv} tone="sky" loading={loading} />
      </div>

      {/* AR approvals (manager) */}
      <ARApprovals />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
        {view === "daily" && (
          <div className="flex items-center gap-2">
            <div className="w-44"><SearchSelect value={typeF} onChange={setTypeF} options={typeOptions} /></div>
            <div className="w-40"><SearchSelect value={statusF} onChange={setStatusF} options={["All", "On time", "Late", "Absent"]} searchable={false} /></div>
          </div>
        )}
      </div>

      {view === "monthly" ? (
        <MonthlyTable loading={loading} dayMeta={month.dayMeta} rows={shownMonth} />
      ) : (
        <DailyTable loading={loading} rows={shownDaily} />
      )}
    </div>
  );
}

const AR_STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};

function ARApprovals() {
  const toast = useToast();
  const me = getUser()?.name || "You";
  const [ars, setArs] = useState<ARRequest[]>([]);
  const [ready, setReady] = useState(false);
  const [openLog, setOpenLog] = useState(false);

  useEffect(() => { setArs(loadARs()); setReady(true); }, []);
  useEffect(() => { if (ready) saveARs(ars); }, [ars, ready]);

  const pending = ars.filter((a) => a.status === "Pending");
  const decided = ars.filter((a) => a.status !== "Pending").sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));

  function decide(ar: ARRequest, status: "Approved" | "Rejected", note?: string) {
    const at = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    setArs((list) => list.map((a) => (a.id === ar.id ? { ...a, status, decidedBy: me, decidedAt: at, managerNote: note } : a)));
    // On approval, correct the day's attendance for the applicant's own record.
    if (status === "Approved" && ar.employee === me) {
      const punches = loadPunches();
      punches[ar.date] = punchFromAR(ar);
      savePunches(punches);
    }
    if (status === "Approved") toast.success("AR approved", `${ar.employee}'s attendance for ${ar.date} was corrected.`);
    else toast.info("AR rejected", ar.employee);
  }
  function reject(ar: ARRequest) {
    const note = window.prompt("Reason for rejecting this AR (optional):") ?? undefined;
    decide(ar, "Rejected", note || undefined);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Icon name="edit" className="h-4 w-4 text-indigo-500" /> Attendance Regularisation
          {pending.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{pending.length} pending</span>}
        </p>
        {decided.length > 0 && <button onClick={() => setOpenLog((o) => !o)} className="text-xs font-semibold text-blue-600 hover:underline">{openLog ? "Hide history" : "History"}</button>}
      </div>

      {pending.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">No pending regularisation requests. 🎉</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {pending.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{a.employee.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{a.employee} <span className="font-normal text-slate-400">· {new Date(a.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })}</span></p>
                <p className="text-xs text-slate-500">{a.checkIn} – {a.checkOut} · {a.workType}</p>
                <p className="mt-0.5 text-xs text-slate-600">{a.reason}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Applied {a.appliedAt}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => decide(a, "Approved")} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Icon name="check" className="h-3.5 w-3.5" /> Approve</button>
                <button onClick={() => reject(a)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Icon name="close" className="h-3.5 w-3.5" /> Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {openLog && decided.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-200 bg-slate-50/60">
          {decided.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-700">{a.employee} · {a.date}</p><p className="truncate text-[11px] text-slate-400">{a.status} by {a.decidedBy} · {a.decidedAt}{a.managerNote ? ` · "${a.managerNote}"` : ""}</p></div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${AR_STATUS_STYLE[a.status]}`}>{a.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MonthlyTable({ loading, dayMeta, rows }: { loading: boolean; dayMeta: ReturnType<typeof buildMonth>["dayMeta"]; rows: MonthRow[] }) {
  const [hover, setHover] = useState<{ ri: number; di: number; x: number; y: number } | null>(null);
  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Skeleton className="h-72 w-full" /></div>;
  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        {(["P", "T", "A", "L", "W", "H", "O"] as Code[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-xs text-slate-600 shadow-sm">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${CODE_META[c].cls}`}>{c}</span>{CODE_META[c].label}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-scrollbar overflow-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Employee</th>
                {dayMeta.map((d) => (
                  <th key={d.day} className={`border-b border-slate-200 px-0 py-1.5 text-center ${d.isToday ? "bg-blue-50" : d.weekend || d.holiday ? "bg-slate-50" : ""}`} style={{ minWidth: 30 }}>
                    <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full font-bold ${d.isToday ? "bg-blue-600 text-white" : d.weekend || d.holiday ? "text-slate-400" : "text-slate-600"}`}>{d.day}</div>
                    <div className={`mt-0.5 text-[9px] font-medium ${d.weekend ? "text-rose-400" : "text-slate-400"}`}>{["S", "M", "T", "W", "T", "F", "S"][d.dow]}</div>
                  </th>
                ))}
                {["P", "Late", "Abs", "Lv", "Score"].map((h) => (
                  <th key={h} className="border-b border-l border-slate-200 bg-slate-50 px-2.5 py-3 text-center font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={dayMeta.length + 6} className="px-6 py-14 text-center text-sm text-slate-400">No employees match your search.</td></tr>
              ) : rows.map((r, ri) => {
                const pct = r.working ? Math.round((r.present / r.working) * 100) : 0;
                const bar = pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500";
                return (
                  <tr key={r.name} className="group">
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] group-hover:bg-slate-50">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${AVATAR_COLORS[ri % AVATAR_COLORS.length]}`}>{initials(r.name)}</span>
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{r.name}</p><p className="truncate text-[10px] text-slate-400">{r.designation}</p></div>
                      </div>
                    </td>
                    {r.cells.map((c, di) => (
                      <td
                        key={di}
                        onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHover({ ri, di, x: rect.left + rect.width / 2, y: rect.top }); }}
                        onMouseLeave={() => setHover((h) => (h && h.ri === ri && h.di === di ? null : h))}
                        className={`border-b border-slate-100 p-1 text-center group-hover:bg-slate-50/60 ${dayMeta[di].isToday ? "bg-blue-50/50" : ""}`}
                      >
                        <span className={`mx-auto flex h-6 w-6 cursor-default items-center justify-center rounded-md text-[10px] font-bold transition hover:scale-125 group-hover:scale-110 ${CODE_META[c.code].cls} ${dayMeta[di].isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}>{c.code === "·" ? "" : c.code}</span>
                      </td>
                    ))}
                    <td className="border-b border-l border-slate-100 px-2.5 py-2 text-center font-bold text-emerald-600 group-hover:bg-slate-50/60">{r.present}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center font-semibold text-amber-600 group-hover:bg-slate-50/60">{r.late || "—"}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center font-semibold text-rose-600 group-hover:bg-slate-50/60">{r.absent || "—"}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center font-semibold text-sky-600 group-hover:bg-slate-50/60">{r.leave || "—"}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 group-hover:bg-slate-50/60">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>
                        <span className="w-8 text-right text-[11px] font-bold text-slate-600">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {hover && rows[hover.ri] && <CellTooltip emp={rows[hover.ri]} cell={rows[hover.ri].cells[hover.di]} x={hover.x} y={hover.y} />}
    </div>
  );
}

function CellTooltip({ emp, cell, x, y }: { emp: MonthRow; cell: Cell; x: number; y: number }) {
  const meta = CODE_META[cell.code];
  const hasDetail = cell.login || cell.note;
  return (
    <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full" style={{ left: x, top: y - 10 }}>
      <div className="relative w-60 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{emp.name}</p>
            <p className="text-[11px] text-slate-400">{cell.date} · {emp.shift}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
        </div>
        {hasDetail && (
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
            {cell.login && <TipRow k="Login" v={cell.login} />}
            {cell.logout && <TipRow k="Logout" v={cell.logout} />}
            {cell.hours && <TipRow k="Worked" v={cell.hours} />}
            {cell.lateBy ? <TipRow k="Late by" v={lateLabel(cell.lateBy)} danger /> : null}
            {cell.mode && <TipRow k="Mode" v={cell.mode} />}
            {cell.location && <TipRow k="Location" v={cell.location} />}
            {cell.note && !cell.login && <p className="text-slate-500">{cell.note}</p>}
          </div>
        )}
        <span className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
      </div>
    </div>
  );
}

function TipRow({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{k}</span>
      <span className={`font-medium ${danger ? "text-rose-600" : "text-slate-700"}`}>{v}</span>
    </div>
  );
}

function DailyTable({ loading, rows }: { loading: boolean; rows: DailyRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="no-scrollbar max-h-[62vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Shift</th><th className="px-4 py-3">Login</th><th className="px-4 py-3">Logout</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, r) => <tr key={r} className="border-b border-slate-100">{Array.from({ length: 8 }).map((_, c) => <td key={c} className="px-4 py-4"><Skeleton className="h-3.5 w-16" /></td>)}</tr>)
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-400">No matching records.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.name} className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50">
                <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>{initials(r.name)}</span><div><p className="font-medium text-slate-800">{r.name}</p><p className="text-[11px] text-slate-500">{r.designation}</p></div></div></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${colorBadge(r.color)}`}>{r.workType}</span></td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-slate-600"><Icon name="pin" className="h-3.5 w-3.5 text-slate-400" />{r.location}</span></td>
                <td className="px-4 py-3 text-slate-500">{r.shift}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{r.checkIn ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{r.checkOut ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{r.hours}</td>
                <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${DAY_STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${r.status === "On time" ? "bg-emerald-500" : r.status === "Late" ? "bg-amber-500" : "bg-slate-400"}`} />{r.status === "Late" ? `Late ${lateLabel(r.lateBy)}` : r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone, loading, sub }: { icon: IconName; label: string; value: number | string; tone: "emerald" | "amber" | "rose" | "blue" | "sky"; loading: boolean; sub?: string }) {
  const tiles = { emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", blue: "bg-blue-50 text-blue-600", sky: "bg-sky-50 text-sky-600" };
  const text = { emerald: "text-emerald-600", amber: "text-amber-600", rose: "text-rose-600", blue: "text-blue-600", sky: "text-sky-600" };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tiles[tone]}`}><Icon name={icon} className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {loading ? <Skeleton className="mt-1 h-6 w-12" /> : <p className={`text-xl font-bold ${text[tone]}`}>{value}{sub && <span className="ml-1 text-[11px] font-normal text-slate-400">{sub}</span>}</p>}
      </div>
    </div>
  );
}

function RingStat({ pct, loading }: { pct: number; loading: boolean }) {
  const size = 52, stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = pct >= 90 ? "#10b981" : pct >= 75 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
          {!loading && <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{loading ? "" : `${pct}%`}</span>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Attendance</p>
        <p className="text-sm font-semibold text-slate-700">{loading ? <Skeleton className="h-4 w-16" /> : pct >= 90 ? "Excellent" : pct >= 75 ? "On track" : "Needs review"}</p>
      </div>
    </div>
  );
}
