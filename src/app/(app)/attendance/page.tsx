"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { listEmployees, loadARs, loadPunches, nowTime, saveARs, savePunches, todayISO, workedHours, type ARRequest, type Punch } from "@/lib/hr";
import { defaultShift, evaluatePunch, format12, hoursLabel, type Shift } from "@/lib/shifts";
import { getPosition, loadWorkTypes, nearestLocation, type WorkType } from "@/lib/locations";
import { colorBadge } from "@/lib/setup";
import SearchSelect from "@/components/SearchSelect";
import MobileAttendance from "@/components/mobile/MobileAttendance";

const AR_STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};

function dateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  "On time": "bg-emerald-100 text-emerald-700",
  Late: "bg-amber-100 text-amber-700",
  Working: "bg-sky-100 text-sky-700",
  Absent: "bg-slate-100 text-slate-600",
};
function lateLabel(lateBy: number): string {
  if (lateBy <= 0) return "";
  const h = Math.floor(lateBy / 60);
  const m = lateBy % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
// "hh:mm AM/PM" -> minutes since midnight.
function clockMins(t?: string): number {
  if (!t) return 0;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

export default function AttendancePage() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [punches, setPunches] = useState<Record<string, Punch>>({});
  const [shift, setShift] = useState<Shift>(defaultShift);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [picking, setPicking] = useState(false);
  const [geoBusy, setGeoBusy] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [ars, setArs] = useState<ARRequest[]>([]);
  const [arOpen, setArOpen] = useState(false);
  const today = todayISO();
  const me = getUser()?.name || "You";

  useEffect(() => {
    setPunches(loadPunches());
    setArs(loadARs());
    setShift(defaultShift());
    setWorkTypes(loadWorkTypes());
    setReady(true);
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    // Reflect manager approvals made on the All-Attendance page.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "hr_punches_v1") setPunches(loadPunches());
      if (e.key === "hr_ar_v1") setArs(loadARs());
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearInterval(id); window.removeEventListener("storage", onStorage); };
  }, []);
  useEffect(() => { if (ready) savePunches(punches); }, [punches, ready]);
  useEffect(() => { if (ready) saveARs(ars); }, [ars, ready]);

  const myArs = ars.filter((a) => a.employee === me).sort((a, b) => b.date.localeCompare(a.date));

  function applyAR(draft: { date: string; checkIn: string; checkOut: string; workType: string; reason: string }) {
    const req: ARRequest = {
      id: `ar-${Date.now()}`,
      employee: me,
      date: draft.date,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      workType: draft.workType,
      reason: draft.reason,
      status: "Pending",
      appliedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    };
    setArs((l) => [req, ...l]);
    setArOpen(false);
    toast.success("AR submitted", "Sent to your manager for approval.");
  }
  function cancelAR(id: string) {
    setArs((l) => l.filter((a) => a.id !== id));
    toast.info("AR withdrawn");
  }

  const todayPunch = punches[today] ?? { date: today };
  const checkedIn = !!todayPunch.checkIn && !todayPunch.checkOut;
  const done = !!todayPunch.checkIn && !!todayPunch.checkOut;

  function startLogin() {
    if (todayPunch.checkIn) return toast.info("Already logged in", `You checked in at ${todayPunch.checkIn}.`);
    setPicking(true);
  }
  function record(type: WorkType, location?: string) {
    const time = nowTime();
    const evald = evaluatePunch(shift, time);
    setPunches((p) => ({ ...p, [today]: { date: today, checkIn: time, status: evald.status, lateBy: evald.lateBy, workType: type.name, location } }));
    setPicking(false);
    if (evald.status === "Late") toast.error("Logged in — Late", `${type.name} · ${time}, ${lateLabel(evald.lateBy)} after grace.`);
    else toast.success(`Logged in — ${type.name}`, location ? `Verified at ${location} · ${time}.` : `On time · ${time}.`);
  }
  async function pickType(type: WorkType) {
    if (!type.geofenced) return record(type);
    setGeoBusy(type.id);
    try {
      const { lat, lng } = await getPosition();
      const near = nearestLocation(lat, lng);
      if (!near) { toast.error("No locations set", "Ask the admin to add an office location first."); return; }
      if (!near.within) { toast.error("Login blocked", `You are ${near.distance.toLocaleString()} m from ${near.location.name} — must be within ${near.location.radius} m.`); return; }
      record(type, near.location.name);
    } catch {
      toast.error("Location required", `Enable location access to log in as ${type.name}.`);
    } finally {
      setGeoBusy("");
    }
  }
  function logout() {
    if (!todayPunch.checkIn) return toast.error("Not logged in", "Check in before logging out.");
    if (todayPunch.checkOut) return toast.info("Already logged out", `You checked out at ${todayPunch.checkOut}.`);
    const time = nowTime();
    setPunches((p) => ({ ...p, [today]: { ...p[today], checkOut: time } }));
    toast.success("Logged out", `Check-out recorded at ${time}.`);
  }

  // Live worked minutes today (uses the ticking clock while still working).
  const nowMins = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const workedMins = todayPunch.checkIn ? Math.max(0, (todayPunch.checkOut ? clockMins(todayPunch.checkOut) : nowMins) - clockMins(todayPunch.checkIn)) : 0;
  const shiftMins = Math.max(1, Math.round(shift.workHours * 60));
  const progress = Math.min(1, workedMins / shiftMins);
  const workedLabel = `${Math.floor(workedMins / 60)}h ${String(workedMins % 60).padStart(2, "0")}m`;

  const history = Object.values(punches).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);

  // This week (last 7 days, oldest → newest).
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const p = punches[iso];
    const mins = p?.checkIn ? Math.max(0, (p.checkOut ? clockMins(p.checkOut) : (iso === today ? nowMins : clockMins(p.checkIn))) - clockMins(p.checkIn)) : 0;
    return { iso, day: d.toLocaleDateString("en-US", { weekday: "short" })[0], date: d.getDate(), punch: p, mins, isToday: iso === today };
  });
  const weekMax = Math.max(shiftMins, ...week.map((w) => w.mins));

  // This month summary.
  const monthRows = Object.values(punches).filter((p) => p.date.startsWith(today.slice(0, 7)) && p.checkIn);
  const monthLate = monthRows.filter((p) => p.status === "Late").length;
  const monthTotalMins = monthRows.reduce((s, p) => s + (p.checkIn ? Math.max(0, (p.checkOut ? clockMins(p.checkOut) : clockMins(p.checkIn)) - clockMins(p.checkIn)) : 0), 0);
  const monthAvgMins = monthRows.length ? Math.round(monthTotalMins / monthRows.length) : 0;
  const month = {
    present: monthRows.length,
    late: monthLate,
    onTime: monthRows.length - monthLate,
    avg: `${Math.floor(monthAvgMins / 60)}h ${String(monthAvgMins % 60).padStart(2, "0")}m`,
  };

  const team = listEmployees();
  const present = team.filter((_, i) => i % 5 !== 0).length;
  const ringColor = done ? "#10b981" : todayPunch.status === "Late" ? "#f59e0b" : checkedIn ? "#3b82f6" : "#cbd5e1";

  return (
    <>
    {/* Phones: focused punch experience. Desktop keeps the full dashboard. */}
    <div className="lg:hidden">
      <MobileAttendance />
    </div>
    <div className="hidden space-y-6 lg:block">
      {/* Hero with live clock */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-7">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="clock" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Attendance</h1>
              <p className="mt-0.5 text-sm text-blue-100">{now ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "—"} · Shift {shift.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-bold tabular-nums tracking-tight">{now ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</p>
            <p className="text-xs text-blue-100">Login by {format12(shift.start)} · grace {shift.graceMinutes}m</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Punch clock card with ring */}
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="relative h-44 w-44">
            <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - progress)} className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className={`mb-1 h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : checkedIn ? "bg-blue-500 animate-pulse" : "bg-slate-300"}`} />
              <p className="text-2xl font-bold text-slate-900">{workedLabel}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{done ? "completed" : checkedIn ? "working" : "not started"}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">of {hoursLabel(shift.workHours)}</p>
            </div>
          </div>

          {todayPunch.checkIn && (
            <span className={`mt-4 rounded-full px-3 py-1 text-xs font-bold ${todayPunch.status === "Late" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {todayPunch.status === "Late" ? `Late by ${lateLabel(todayPunch.lateBy ?? 0)}` : "On time"}
            </span>
          )}

          <div className="mt-4 grid w-full grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Check in</p><p className="mt-0.5 font-bold text-slate-800">{todayPunch.checkIn ?? "—"}</p></div>
            <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Check out</p><p className="mt-0.5 font-bold text-slate-800">{todayPunch.checkOut ?? "—"}</p></div>
          </div>

          {todayPunch.workType && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="pin" className="h-3.5 w-3.5 text-slate-400" /> {todayPunch.workType}{todayPunch.location ? ` · ${todayPunch.location}` : ""}</p>
          )}

          <div className="mt-4 flex w-full gap-2">
            <button onClick={startLogin} disabled={!!todayPunch.checkIn} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40">
              <Icon name="check" className="h-4 w-4" /> Check In
            </button>
            <button onClick={logout} disabled={!checkedIn} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
              <Icon name="logout" className="h-4 w-4" /> Check Out
            </button>
          </div>
          <button onClick={() => setArOpen(true)} className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
            <Icon name="edit" className="h-3.5 w-3.5" /> Missed or wrong attendance? Apply AR
          </button>
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Team" value={String(team.length)} icon="users" tone="bg-blue-50 text-blue-600" />
            <Stat label="Present" value={String(present)} icon="check" tone="bg-emerald-50 text-emerald-600" />
            <Stat label="Away" value={String(team.length - present)} icon="visitor" tone="bg-amber-50 text-amber-600" />
            <Stat label="Shift hrs" value={hoursLabel(shift.workHours)} icon="clock" tone="bg-violet-50 text-violet-600" />
          </div>

          {/* This week bar strip */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">This week</h2>
              <span className="text-xs text-slate-400">{month.present} days this month</span>
            </div>
            <div className="flex items-end justify-between gap-2 sm:gap-4">
              {week.map((w) => {
                const h = w.mins > 0 ? Math.max(8, (w.mins / weekMax) * 100) : 0;
                const late = w.punch?.status === "Late";
                return (
                  <div key={w.iso} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end justify-center">
                      <div className="flex w-7 flex-1 items-end rounded-md bg-slate-100 sm:w-9">
                        {h > 0 && <div className={`w-full rounded-md ${late ? "bg-gradient-to-t from-amber-500 to-amber-300" : "bg-gradient-to-t from-blue-600 to-blue-400"}`} style={{ height: `${h}%` }} title={`${Math.floor(w.mins / 60)}h ${w.mins % 60}m`} />}
                      </div>
                    </div>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${w.isToday ? "bg-blue-600 text-white" : w.punch?.checkIn ? "text-slate-700" : "text-slate-300"}`}>{w.date}</div>
                    <span className="text-[10px] font-medium uppercase text-slate-400">{w.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Month summary + history */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">This month</h2>
          <div className="space-y-3">
            <SummaryRow icon="check" tone="text-emerald-600 bg-emerald-50" label="On-time days" value={String(month.onTime)} />
            <SummaryRow icon="alert" tone="text-amber-600 bg-amber-50" label="Late days" value={String(month.late)} />
            <SummaryRow icon="clock" tone="text-blue-600 bg-blue-50" label="Avg. hours / day" value={month.avg} />
            <SummaryRow icon="calendar" tone="text-violet-600 bg-violet-50" label="Days present" value={String(month.present)} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-800">My attendance — last 14 days</div>
          <div className="no-scrollbar max-h-[45vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">In</th><th className="px-6 py-3">Out</th><th className="px-6 py-3">Hours</th><th className="px-6 py-3">Status</th></tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">No punches yet. Use Check In to start.</td></tr>
                ) : (
                  history.map((p) => (
                    <tr key={p.date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-700">{dateLabel(p.date)}{p.date === today && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">Today</span>}</td>
                      <td className="px-6 py-3 text-slate-600">{p.checkIn ?? "—"}</td>
                      <td className="px-6 py-3 text-slate-600">{p.checkOut ?? "—"}</td>
                      <td className="px-6 py-3 text-slate-600">{workedHours(p)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          {p.checkIn ? (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.viaAR ? "bg-indigo-100 text-indigo-700" : STATUS_STYLE[p.status ?? (p.checkOut ? "On time" : "Working")] ?? "bg-slate-100 text-slate-600"}`}>
                              {p.viaAR ? "Regularised" : p.status === "Late" ? `Late ${lateLabel(p.lateBy ?? 0)}` : p.checkOut ? (p.status ?? "Present") : "Working"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">—</span>
                          )}
                          {p.viaAR && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600" title="Updated via approved AR">AR</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* My AR requests */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon name="edit" className="h-4 w-4 text-indigo-500" /> My AR requests</p>
          <button onClick={() => setArOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"><Icon name="folderPlus" className="h-3.5 w-3.5" /> Apply AR</button>
        </div>
        {myArs.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">No regularisation requests. If you missed a punch, apply an AR for your manager to review.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {myArs.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{dateLabel(a.date)} · <span className="text-slate-500">{a.checkIn} – {a.checkOut}</span> <span className="text-xs text-slate-400">({a.workType})</span></p>
                  <p className="truncate text-xs text-slate-500">{a.reason}</p>
                  {a.status !== "Pending" && a.decidedBy && <p className="text-[11px] text-slate-400">{a.status} by {a.decidedBy}{a.managerNote ? ` · "${a.managerNote}"` : ""}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${AR_STATUS_STYLE[a.status]}`}>{a.status}</span>
                {a.status === "Pending" && <button onClick={() => cancelAR(a.id)} className="shrink-0 text-xs font-medium text-slate-400 hover:text-rose-600">Withdraw</button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Apply AR modal */}
      {arOpen && <ApplyARModal today={today} workTypes={workTypes} onClose={() => setArOpen(false)} onSubmit={applyAR} />}

      {/* Work-type picker */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => !geoBusy && setPicking(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
              <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_80%)]" />
              <div className="relative flex items-center justify-between">
                <h3 className="text-base font-bold">How are you working today?</h3>
                <button onClick={() => !geoBusy && setPicking(false)} aria-label="Close" className="rounded-lg p-1.5 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="mb-3 text-sm text-slate-500">Geofenced modes verify you&apos;re within an office radius.</p>
              <div className="space-y-2">
                {workTypes.map((t) => (
                  <button key={t.id} onClick={() => pickType(t)} disabled={!!geoBusy} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60">
                    <span className="flex items-center gap-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorBadge(t.color)}`}>{t.name}</span>
                      {t.geofenced && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Icon name="pin" className="h-3.5 w-3.5" /> location check</span>}
                    </span>
                    {geoBusy === t.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" /> : <Icon name="chevronDown" className="h-4 w-4 -rotate-90 text-slate-300" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: IconName; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon name={icon} className="h-4 w-4" /></span>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function SummaryRow({ icon, tone, label, value }: { icon: IconName; tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon name={icon} className="h-4 w-4" /></span>
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <span className="text-base font-bold text-slate-900">{value}</span>
    </div>
  );
}

function ApplyARModal({ today, workTypes, onClose, onSubmit }: {
  today: string; workTypes: WorkType[];
  onClose: () => void;
  onSubmit: (d: { date: string; checkIn: string; checkOut: string; workType: string; reason: string }) => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [checkIn, setCheckIn] = useState("09:30");
  const [checkOut, setCheckOut] = useState("18:30");
  const [workType, setWorkType] = useState(workTypes[0]?.name ?? "Work From Office");
  const [reason, setReason] = useState("");

  function to12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${String(m).padStart(2, "0")} ${period}`;
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (date > today) return toast.error("Invalid date", "You can't regularise a future date.");
    if (checkOut <= checkIn) return toast.error("Check the times", "Check-out must be after check-in.");
    if (reason.trim().length < 5) return toast.error("Add a reason", "Tell your manager why this needs regularising.");
    onSubmit({ date, checkIn: to12(checkIn), checkOut: to12(checkOut), workType, reason: reason.trim() });
  }

  const cls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="my-6 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_80%)]" />
          <div className="relative flex items-center justify-between"><h2 className="text-lg font-bold">Apply Attendance Regularisation</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button></div>
        </div>
        <div className="space-y-4 px-6 py-6">
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Use this when you couldn&apos;t punch in/out. Your manager will approve or reject it.</p>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Date <span className="text-rose-500">*</span></label><input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Check in</label><input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Check out</label><input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={cls} /></div>
          </div>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Work mode</label><SearchSelect value={workType} onChange={setWorkType} options={workTypes.length ? workTypes.map((w) => w.name) : ["Work From Office"]} placeholder="Select work mode" /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Reason <span className="text-rose-500">*</span></label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Biometric failed / was on field visit / forgot to punch out" className={`${cls} resize-none`} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Submit AR</button>
        </div>
      </form>
    </div>
  );
}
