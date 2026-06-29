"use client";

// Mobile (phones-only) Attendance — a focused punch experience: a big progress
// ring with one-tap Check In / Check Out, today's status, a week strip and recent
// history. Rendered only inside `lg:hidden` on the attendance page; reads/writes
// the same `hr_punches_v1` store as desktop so the two stay in sync.

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import {
  loadARs, loadPunches, nowTime, saveARs, savePunches, todayISO, workedHours,
  type ARRequest, type Punch,
} from "@/lib/hr";
import { defaultShift, evaluatePunch, format12, hoursLabel, type Shift } from "@/lib/shifts";
import { getPosition, loadWorkTypes, nearestLocation, type WorkType } from "@/lib/locations";
import { colorBadge } from "@/lib/setup";

function clockMins(t?: string): number {
  if (!t) return 0;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}
function lateLabel(lateBy: number): string {
  if (lateBy <= 0) return "";
  const h = Math.floor(lateBy / 60);
  const m = lateBy % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function dateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
}

export default function MobileAttendance() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [punches, setPunches] = useState<Record<string, Punch>>({});
  const [shift, setShift] = useState<Shift>(defaultShift);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [picking, setPicking] = useState(false);
  const [geoBusy, setGeoBusy] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [ars, setArs] = useState<ARRequest[]>([]);
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
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { if (ready) savePunches(punches); }, [punches, ready]);
  useEffect(() => { if (ready) saveARs(ars); }, [ars, ready]);

  const todayPunch = punches[today] ?? { date: today };
  const checkedIn = !!todayPunch.checkIn && !todayPunch.checkOut;
  const done = !!todayPunch.checkIn && !!todayPunch.checkOut;

  function record(type: WorkType, location?: string) {
    const time = nowTime();
    const evald = evaluatePunch(shift, time);
    setPunches((p) => ({ ...p, [today]: { date: today, checkIn: time, status: evald.status, lateBy: evald.lateBy, workType: type.name, location } }));
    setPicking(false);
    if (evald.status === "Late") toast.error("Checked in — Late", `${type.name} · ${time}, ${lateLabel(evald.lateBy)} after grace.`);
    else toast.success(`Checked in — ${type.name}`, location ? `Verified at ${location} · ${time}.` : `On time · ${time}.`);
  }
  async function pickType(type: WorkType) {
    if (!type.geofenced) return record(type);
    setGeoBusy(type.id);
    try {
      const { lat, lng } = await getPosition();
      const near = nearestLocation(lat, lng);
      if (!near) { toast.error("No locations set", "Ask the admin to add an office location first."); return; }
      if (!near.within) { toast.error("Check-in blocked", `You're ${near.distance.toLocaleString()} m from ${near.location.name} — must be within ${near.location.radius} m.`); return; }
      record(type, near.location.name);
    } catch {
      toast.error("Location required", `Enable location to check in as ${type.name}.`);
    } finally {
      setGeoBusy("");
    }
  }
  function startCheckIn() {
    if (todayPunch.checkIn) return toast.info("Already checked in", `You checked in at ${todayPunch.checkIn}.`);
    setPicking(true);
  }
  function checkOut() {
    if (!todayPunch.checkIn) return toast.error("Not checked in", "Check in before checking out.");
    if (todayPunch.checkOut) return toast.info("Already checked out", `You checked out at ${todayPunch.checkOut}.`);
    const time = nowTime();
    setPunches((p) => ({ ...p, [today]: { ...p[today], checkOut: time } }));
    toast.success("Checked out", `Recorded at ${time}.`);
  }

  // Live worked minutes today.
  const nowMins = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const workedMins = todayPunch.checkIn ? Math.max(0, (todayPunch.checkOut ? clockMins(todayPunch.checkOut) : nowMins) - clockMins(todayPunch.checkIn)) : 0;
  const shiftMins = Math.max(1, Math.round(shift.workHours * 60));
  const progress = Math.min(1, workedMins / shiftMins);
  const workedLabel = `${Math.floor(workedMins / 60)}h ${String(workedMins % 60).padStart(2, "0")}m`;
  const ringColor = done ? "#10b981" : todayPunch.status === "Late" ? "#f59e0b" : checkedIn ? "#3b82f6" : "#cbd5e1";
  const R = 52, C = 2 * Math.PI * R;

  // This week (last 7 days).
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const p = punches[iso];
    const mins = p?.checkIn ? Math.max(0, (p.checkOut ? clockMins(p.checkOut) : (iso === today ? nowMins : clockMins(p.checkIn))) - clockMins(p.checkIn)) : 0;
    return { iso, day: d.toLocaleDateString("en-US", { weekday: "short" })[0], date: d.getDate(), punch: p, mins, isToday: iso === today };
  });
  const weekMax = Math.max(shiftMins, ...week.map((w) => w.mins));

  // Month summary.
  const monthRows = Object.values(punches).filter((p) => p.date.startsWith(today.slice(0, 7)) && p.checkIn);
  const monthLate = monthRows.filter((p) => p.status === "Late").length;

  const history = Object.values(punches).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const myArs = ars.filter((a) => a.employee === me).sort((a, b) => b.date.localeCompare(a.date));

  function applyAR(draft: { date: string; checkIn: string; checkOut: string; workType: string; reason: string }) {
    setArs((l) => [{
      id: `ar-${Date.now()}`, employee: me, date: draft.date, checkIn: draft.checkIn, checkOut: draft.checkOut,
      workType: draft.workType, reason: draft.reason, status: "Pending",
      appliedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    }, ...l]);
    toast.success("AR submitted", "Sent to your manager for approval.");
  }
  const [arOpen, setArOpen] = useState(false);

  return (
    <div className="space-y-3 pb-2">
      {/* Live clock header */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-3 text-white shadow-sm">
        <div>
          <p className="text-xs text-blue-100">{now ? now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "—"}</p>
          <p className="text-[11px] text-blue-200">Shift {shift.name} · in by {format12(shift.start)}</p>
        </div>
        <p className="font-mono text-2xl font-bold tabular-nums">{now ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</p>
      </div>

      {/* Punch ring + actions */}
      <section className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`mb-1 h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : checkedIn ? "animate-pulse bg-blue-500" : "bg-slate-300"}`} />
            <p className="text-2xl font-bold text-slate-900">{workedLabel}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{done ? "completed" : checkedIn ? "working" : "not started"}</p>
            <p className="text-[10px] text-slate-400">of {hoursLabel(shift.workHours)}</p>
          </div>
        </div>

        {todayPunch.checkIn && (
          <span className={`mt-3 rounded-full px-3 py-1 text-xs font-bold ${todayPunch.status === "Late" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {todayPunch.status === "Late" ? `Late by ${lateLabel(todayPunch.lateBy ?? 0)}` : "On time"}
          </span>
        )}

        <div className="mt-4 grid w-full grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Check in</p><p className="mt-0.5 font-bold text-slate-800">{todayPunch.checkIn ?? "—"}</p></div>
          <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Check out</p><p className="mt-0.5 font-bold text-slate-800">{todayPunch.checkOut ?? "—"}</p></div>
        </div>

        {todayPunch.workType && (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="pin" className="h-3.5 w-3.5 text-slate-400" /> {todayPunch.workType}{todayPunch.location ? ` · ${todayPunch.location}` : ""}</p>
        )}

        <div className="mt-4 flex w-full gap-2">
          <button onClick={startCheckIn} disabled={!!todayPunch.checkIn} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-40">
            <Icon name="check" className="h-4 w-4" /> Check In
          </button>
          <button onClick={checkOut} disabled={!checkedIn} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 transition active:scale-95 disabled:opacity-40">
            <Icon name="logout" className="h-4 w-4" /> Check Out
          </button>
        </div>
        <button onClick={() => setArOpen(true)} className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-blue-600">
          <Icon name="edit" className="h-3.5 w-3.5" /> Missed a punch? Apply AR
        </button>
      </section>

      {/* This week */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">This week</h2>
          <span className="text-xs text-slate-400">{monthRows.length} days · {monthLate} late this month</span>
        </div>
        <div className="flex items-end justify-between gap-1.5">
          {week.map((w) => {
            const h = w.mins > 0 ? Math.max(8, (w.mins / weekMax) * 100) : 0;
            const late = w.punch?.status === "Late";
            return (
              <div key={w.iso} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end justify-center">
                  <div className="flex w-5 flex-1 items-end rounded-md bg-slate-100">
                    {h > 0 && <div className={`w-full rounded-md ${late ? "bg-gradient-to-t from-amber-500 to-amber-300" : "bg-gradient-to-t from-blue-600 to-blue-400"}`} style={{ height: `${h}%` }} />}
                  </div>
                </div>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${w.isToday ? "bg-blue-600 text-white" : w.punch?.checkIn ? "text-slate-700" : "text-slate-300"}`}>{w.date}</span>
                <span className="text-[9px] font-medium uppercase text-slate-400">{w.day}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent history */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">Recent attendance</div>
        {history.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No punches yet. Tap Check In to start.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((p) => (
              <li key={p.date} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{dateLabel(p.date)}{p.date === today && <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">Today</span>}</p>
                  <p className="text-xs text-slate-400">{p.checkIn ?? "—"} → {p.checkOut ?? "—"} · {workedHours(p)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.viaAR ? "bg-indigo-100 text-indigo-700" : p.status === "Late" ? "bg-amber-100 text-amber-700" : p.checkOut ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                  {p.viaAR ? "AR" : p.status === "Late" ? "Late" : p.checkOut ? "Present" : "Working"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* My AR requests */}
      {myArs.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">My AR requests</div>
          <ul className="divide-y divide-slate-100">
            {myArs.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{dateLabel(a.date)} · {a.checkIn}–{a.checkOut}</p>
                  <p className="truncate text-xs text-slate-400">{a.reason}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.status === "Pending" ? "bg-amber-100 text-amber-700" : a.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Work-type picker */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={() => !geoBusy && setPicking(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" />
            <div className="px-5 pt-3">
              <h3 className="text-base font-bold text-slate-900">How are you working today?</h3>
              <p className="mt-0.5 text-xs text-slate-500">Geofenced modes verify you&apos;re within an office radius.</p>
              <div className="mt-4 space-y-2">
                {workTypes.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No work modes configured. Ask your admin to add them in HR Setup.</p>
                ) : workTypes.map((t) => (
                  <button key={t.id} onClick={() => pickType(t)} disabled={!!geoBusy} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition active:scale-[0.98] disabled:opacity-60">
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

      {arOpen && <ApplyARSheet today={today} workTypes={workTypes} onClose={() => setArOpen(false)} onSubmit={(d) => { applyAR(d); setArOpen(false); }} />}
    </div>
  );
}

function ApplyARSheet({ today, workTypes, onClose, onSubmit }: {
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
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" />
        <div className="flex items-center justify-between px-5 pt-3">
          <h3 className="text-base font-bold text-slate-900">Apply Regularisation</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 pt-4">
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Use this when you couldn&apos;t punch in/out. Your manager approves or rejects it.</p>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Date</label><input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Check in</label><input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Check out</label><input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={cls} /></div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Work mode</label>
            <select value={workType} onChange={(e) => setWorkType(e.target.value)} className={cls}>
              {(workTypes.length ? workTypes.map((w) => w.name) : ["Work From Office"]).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-500">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Biometric failed / forgot to punch out" className={`${cls} resize-none`} /></div>
          <button type="submit" className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition active:scale-95">Submit AR</button>
        </div>
      </form>
    </div>
  );
}
