"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { DEMOS_EVENT, demoWhen, loadDemos, refreshDemos, setDemoStatus, type Demo, type DemoStatus } from "@/lib/demos";
import { loadPlatform } from "@/lib/platform";
import { createGmailClient, type GmailClient, type GmailStatus, type CalendarEvent } from "@/lib/gmailApi";
import { getSuperAdminToken } from "@/lib/superAdmin";

const STATUS_STYLE: Record<DemoStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700 line-through",
};
const DAY = ["S", "M", "T", "W", "T", "F", "S"];

// Google Calendar events carry no color from the API, so we color-code them by a
// category inferred from the event title — giving each event type a distinct hue.
type EventCat = { key: string; label: string; chip: string; dot: string; tile: string };
const EVENT_CATS: EventCat[] = [
  { key: "demo", label: "Demo", chip: "bg-blue-100 text-blue-700", dot: "bg-blue-500", tile: "border-blue-100 bg-blue-50 text-blue-700" },
  { key: "meeting", label: "Meeting", chip: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500", tile: "border-indigo-100 bg-indigo-50 text-indigo-700" },
  { key: "call", label: "Call", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-500", tile: "border-amber-100 bg-amber-50 text-amber-700" },
  { key: "interview", label: "Interview", chip: "bg-fuchsia-100 text-fuchsia-700", dot: "bg-fuchsia-500", tile: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700" },
  { key: "review", label: "Review", chip: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500", tile: "border-cyan-100 bg-cyan-50 text-cyan-700" },
  { key: "event", label: "Event", chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500", tile: "border-teal-100 bg-teal-50 text-teal-700" },
];
function eventCat(summary: string): EventCat {
  const s = (summary || "").toLowerCase();
  if (/\bdemo\b/.test(s)) return EVENT_CATS[0];
  if (/(meeting|sync|standup|stand-up|1:1|catch ?up|huddle|kick ?off)/.test(s)) return EVENT_CATS[1];
  if (/(call|phone|dial)/.test(s)) return EVENT_CATS[2];
  if (/(interview|screening)/.test(s)) return EVENT_CATS[3];
  if (/(review|retro|feedback)/.test(s)) return EVENT_CATS[4];
  return EVENT_CATS[5];
}

function dParts(iso: string) {
  const d = new Date(iso);
  return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate(), time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) };
}

function gWhen(e: CalendarEvent): string {
  if (!e.start) return "";
  const d = new Date(e.start);
  if (isNaN(d.getTime())) return e.start;
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", ...(e.allDay ? {} : { hour: "2-digit", minute: "2-digit" }) });
}

function gTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function DemosManager() {
  const toast = useToast();
  const [demos, setDemos] = useState<Demo[]>(loadDemos);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState<Demo | null>(null);
  const [compose, setCompose] = useState<Demo | null>(null);

  // Google connection (Gmail OAuth, super-admin token) for Calendar + Meet.
  const gmail = useMemo<GmailClient>(() => createGmailClient(getSuperAdminToken), []);
  const [gstatus, setGstatus] = useState<GmailStatus | null>(null);
  const [gevents, setGevents] = useState<CalendarEvent[]>([]);
  const [gbusy, setGbusy] = useState(false);
  const [gselected, setGselected] = useState<CalendarEvent | null>(null);

  const refreshGoogle = useCallback(async () => {
    let s: GmailStatus;
    try {
      s = await gmail.status();
    } catch {
      setGstatus({ configured: false, connected: false, email: "" });
      return;
    }
    setGstatus(s);
    if (!s.connected) { setGevents([]); return; }
    // A token authorized before the Calendar scope was added will 403 here —
    // the user just clicks Reconnect to grant calendar access.
    try {
      // Fetch only the selected month so navigating months shows the right events.
      const timeMin = new Date(cursor.y, cursor.m, 1).toISOString();
      const timeMax = new Date(cursor.y, cursor.m + 1, 1).toISOString();
      setGevents(await gmail.calendarEvents({ timeMin, timeMax, max: 250 }));
    } catch {
      setGevents([]);
    }
  }, [gmail, cursor]);

  useEffect(() => {
    const refresh = () => setDemos(loadDemos());
    refreshDemos().then(refresh).catch(() => {}); // pull from the backend on mount
    window.addEventListener(DEMOS_EVENT, refresh);
    return () => { window.removeEventListener(DEMOS_EVENT, refresh); };
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async loader; all setState runs after an await
  useEffect(() => { refreshGoogle(); }, [refreshGoogle]);

  // Returning from Google consent (?connected=1|0).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = new URLSearchParams(window.location.search).get("connected");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async refetch after returning from Google consent
    if (c === "1") { toast.success("Google connected", "Your calendar is now synced."); refreshGoogle(); }
    else if (c === "0") { toast.error("Connection failed", "Couldn't connect your Google account."); }
    if (c) window.history.replaceState(null, "", window.location.pathname);
  }, [refreshGoogle, toast]);

  async function connectGoogle() {
    setGbusy(true);
    try {
      const { url } = await gmail.authUrl("/admin/demos");
      window.location.href = url;
    } catch (e) {
      toast.error("Couldn't start Google connect", (e as Error).message);
      setGbusy(false);
    }
  }

  async function disconnectGoogle() {
    await gmail.disconnect().catch(() => {});
    setGstatus((s) => (s ? { ...s, connected: false, email: "" } : s));
    setGevents([]);
    toast.info("Disconnected", "Google account disconnected from the calendar.");
  }

  async function addToGoogle(d: Demo) {
    if (!gstatus?.connected) return;
    setGbusy(true);
    try {
      const start = new Date(d.scheduledAt);
      const end = new Date(start.getTime() + 30 * 60000);
      await gmail.createCalendarEvent({
        summary: `Demo: ${d.company !== "—" ? d.company : d.name}`,
        description: `Product demo with ${d.name} (${d.email}, ${d.phone}).`,
        start: start.toISOString(),
        end: end.toISOString(),
        attendees: d.email && d.email !== "—" ? [d.email] : [],
      });
      await refreshGoogle();
      toast.success("Added to Google Calendar", "Event created with a Google Meet link.");
    } catch (e) {
      toast.error("Couldn't add to Google Calendar", (e as Error).message);
    } finally {
      setGbusy(false);
    }
  }

  function changeStatus(d: Demo, status: DemoStatus) {
    setDemoStatus(d.id, status);
    setDemos(loadDemos());
    setSelected((s) => (s && s.id === d.id ? { ...s, status } : s));
    toast.success("Demo updated", `${d.name}'s demo marked ${status}.`);
  }

  const now = new Date();
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const byDay = useMemo(() => {
    const map: Record<number, Demo[]> = {};
    for (const d of demos) {
      const p = dParts(d.scheduledAt);
      if (p.y === cursor.y && p.m === cursor.m) (map[p.day] ??= []).push(d);
    }
    return map;
  }, [demos, cursor]);

  // Google Calendar events grouped onto the calendar grid for the current month.
  const gByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const e of gevents) {
      if (!e.start) continue;
      const d = new Date(e.start);
      if (!isNaN(d.getTime()) && d.getFullYear() === cursor.y && d.getMonth() === cursor.m) (map[d.getDate()] ??= []).push(e);
    }
    return map;
  }, [gevents, cursor]);

  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];

  const upcoming = useMemo(() => {
    const today = new Date(new Date().toDateString());
    return demos.filter((d) => d.status !== "cancelled" && new Date(d.scheduledAt) >= today);
  }, [demos]);
  const stats = { total: demos.length, scheduled: demos.filter((d) => d.status === "scheduled").length, completed: demos.filter((d) => d.status === "completed").length };

  function step(n: number) { setCursor((c) => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-6 shadow-lg shadow-violet-500/20">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/70"><Icon name="videoCam" className="h-3.5 w-3.5" /> Super Admin</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Demo Meetings</h1>
            <p className="mt-1 text-sm text-white/75">Schedule, track and follow up on every product demo in one place.</p>
          </div>
          <div className="flex items-center rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur-sm">
            <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === "calendar" ? "bg-white text-violet-700 shadow-sm" : "text-white/80 hover:bg-white/10"}`}><Icon name="calendar" className="h-4 w-4" /> Calendar</button>
            <button onClick={() => setView("list")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === "list" ? "bg-white text-violet-700 shadow-sm" : "text-white/80 hover:bg-white/10"}`}><Icon name="list" className="h-4 w-4" /> List</button>
          </div>
        </div>
        {/* Stat pills */}
        <div className="relative mt-5 grid grid-cols-3 gap-3">
          {([
            { label: "Scheduled", value: stats.scheduled, icon: "clock" as const },
            { label: "Completed", value: stats.completed, icon: "check" as const },
            { label: "Total", value: stats.total, icon: "videoCam" as const },
          ]).map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white"><Icon name={s.icon} className="h-4 w-4" /></span>
              <div>
                <p className="text-2xl font-bold leading-none text-white">{s.value}</p>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-white/70">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Google connection */}
      {gstatus && (
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${gstatus.connected ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50" : gstatus.configured ? "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50" : "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50"}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${gstatus.connected ? "bg-emerald-100 text-emerald-600" : gstatus.configured ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}><Icon name="gmail" className="h-5 w-5" /></span>
          {gstatus.connected ? (
            <>
              <p className="text-sm font-medium text-slate-700">Connected as <span className="font-semibold">{gstatus.email}</span>{gevents.length === 0 ? " · click Reconnect to grant Calendar access" : " · Calendar synced"}</p>
              <div className="ml-auto flex gap-2">
                <button onClick={refreshGoogle} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Refresh</button>
                <button onClick={connectGoogle} disabled={gbusy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Reconnect</button>
                <button onClick={disconnectGoogle} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Disconnect</button>
              </div>
            </>
          ) : gstatus.configured ? (
            <>
              <p className="text-sm text-slate-700">Connect Google to sync demos to your calendar and create Meet links.</p>
              <button onClick={connectGoogle} disabled={gbusy} className="ml-auto rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{gbusy ? "Connecting…" : "Connect Google Calendar"}</button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-700">Google isn&apos;t configured yet — add your Google OAuth credentials to enable Calendar + Gmail.</p>
              <a href="/admin/mail" className="ml-auto rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700">Set up Google</a>
            </>
          )}
        </div>
      )}

      {view === "calendar" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-bold text-slate-800">{monthLabel}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => step(-1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg></button>
              <button onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Today</button>
              <button onClick={() => step(1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY.map((d, i) => <div key={i} className={`py-2 text-center text-[11px] font-bold uppercase tracking-wide ${i === 0 || i === 6 ? "text-violet-400" : "text-slate-400"}`}>{d}</div>)}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-[92px] rounded-xl bg-slate-50/50" />;
              const isToday = cursor.y === now.getFullYear() && cursor.m === now.getMonth() && day === now.getDate();
              const isWeekend = i % 7 === 0 || i % 7 === 6;
              const demoList = byDay[day] ?? [];
              const gList = gByDay[day] ?? [];
              const total = demoList.length + gList.length;
              const items = [
                ...demoList.map((d) => ({ t: "demo" as const, d })),
                ...gList.map((e) => ({ t: "g" as const, e })),
              ].slice(0, 3);
              return (
                <div key={i} className={`group min-h-[92px] rounded-xl border p-1.5 transition ${isToday ? "border-violet-300 bg-violet-50/60 ring-1 ring-violet-200" : isWeekend ? "border-slate-100 bg-slate-50/40 hover:border-slate-200" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/60"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-violet-600 text-white" : "text-slate-500"}`}>{day}</span>
                    {total > 0 && <span className="text-[9px] font-bold text-slate-300">{total}</span>}
                  </div>
                  <div className="space-y-1">
                    {items.map((it, k) => it.t === "demo" ? (
                      <button key={`d-${it.d.id}`} onClick={() => setSelected(it.d)} className={`flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium shadow-sm transition hover:brightness-95 ${STATUS_STYLE[it.d.status]}`}>
                        <Icon name="videoCam" className="h-3 w-3 shrink-0" /> <span className="truncate">{dParts(it.d.scheduledAt).time} {it.d.company !== "—" ? it.d.company : it.d.name}</span>
                      </button>
                    ) : (
                      <button key={`g-${it.e.id}-${k}`} onClick={() => setGselected(it.e)} className={`flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium shadow-sm transition hover:brightness-95 ${eventCat(it.e.summary).chip}`}>
                        <Icon name="calendar" className="h-3 w-3 shrink-0" /> <span className="truncate">{it.e.allDay ? "" : gTime(it.e.start) + " "}{it.e.summary}</span>
                      </button>
                    ))}
                    {total > 3 && <p className="px-1 text-[10px] font-medium text-slate-400">+{total - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend — what each colour means */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Demos</span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Scheduled</span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completed</span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Cancelled</span>
            <span className="mx-1 hidden h-3.5 w-px bg-slate-200 sm:block" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Calendar</span>
            {EVENT_CATS.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} /> {c.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-5 py-3.5"><p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon name="list" className="h-4 w-4 text-violet-500" /> Upcoming demos</p><span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">{upcoming.length}</span></div>
          <div className="divide-y divide-slate-100">
            {demos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300"><Icon name="calendar" className="h-6 w-6" /></span>
                <p className="text-sm text-slate-400">No demos booked yet. They appear here when visitors book from the landing page.</p>
              </div>
            ) : demos.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-sm">{(d.company !== "—" ? d.company : d.name).slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{d.company !== "—" ? d.company : d.name} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[d.status]}`}>{d.status}</span></p>
                  <p className="truncate text-xs text-slate-500">{d.name} · {d.email}</p>
                </div>
                <span className="text-xs text-slate-500">{demoWhen(d.scheduledAt)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCompose(d)} title="Send Gmail" className="rounded-md p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600"><Icon name="gmail" className="h-[18px] w-[18px]" /></button>
                  <a href={d.meetLink} target="_blank" rel="noreferrer" title="Join Meet" className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Icon name="videoCam" className="h-[18px] w-[18px]" /></a>
                  <button onClick={() => setSelected(d)} title="Details" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="eye" className="h-[18px] w-[18px]" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Google Calendar — upcoming events from the connected account */}
      {gstatus?.connected && gevents.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><Icon name="calendar" className="h-4 w-4" /></span> Google Calendar — upcoming</p>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{gevents.length} events</span>
          </div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {gevents.map((e) => {
              const dt = e.start ? new Date(e.start) : null;
              const valid = dt && !isNaN(dt.getTime());
              const cat = eventCat(e.summary);
              return (
                <button key={e.id} onClick={() => setGselected(e)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50">
                  <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border leading-none ${cat.tile}`}>
                    {valid ? <>
                      <span className="text-[9px] font-bold uppercase tracking-wide">{dt!.toLocaleDateString("en-US", { month: "short" })}</span>
                      <span className="text-base font-bold">{dt!.getDate()}</span>
                    </> : <Icon name="calendar" className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{e.summary} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cat.chip}`}>{cat.label}</span></p>
                    <p className="truncate text-xs text-slate-500">{gWhen(e)}{e.location ? ` · ${e.location}` : ""}</p>
                  </div>
                  {e.meetLink && <a href={e.meetLink} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"><Icon name="videoCam" className="h-3.5 w-3.5" /> Join Meet</a>}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {gselected && <GoogleEventDetail event={gselected} onClose={() => setGselected(null)} />}
      {selected && <DemoDetail demo={selected} googleConnected={!!gstatus?.connected} onClose={() => setSelected(null)} onStatus={(s) => changeStatus(selected, s)} onGmail={() => { setCompose(selected); setSelected(null); }} onAddGoogle={() => addToGoogle(selected)} />}
      {compose && <GmailCompose demo={compose} client={gmail} connected={!!gstatus?.connected} onClose={() => setCompose(null)} onSent={() => { setCompose(null); toast.success("Email sent", `Demo invite emailed to ${compose.email} via Gmail.`); }} />}
    </div>
  );
}

function DemoDetail({ demo: d, googleConnected, onClose, onStatus, onGmail, onAddGoogle }: { demo: Demo; googleConnected: boolean; onClose: () => void; onStatus: (s: DemoStatus) => void; onGmail: () => void; onAddGoogle: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div><h2 className="text-lg font-bold text-slate-900">{d.company !== "—" ? d.company : d.name}</h2><p className="text-xs text-slate-500">{demoWhen(d.scheduledAt)}</p></div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2 px-6 py-4 text-sm">
          <Row icon="users" v={d.name} />
          <Row icon="gmail" v={d.email} />
          <Row icon="call" v={d.phone} />
          <a href={d.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-blue-600 hover:underline"><Icon name="videoCam" className="h-4 w-4 shrink-0 text-blue-500" /> {d.meetLink}</a>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onGmail} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="gmail" className="h-4 w-4" /> Send Gmail</button>
          {googleConnected && <button onClick={onAddGoogle} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"><Icon name="calendar" className="h-4 w-4" /> Add to Google Calendar</button>}
          <a href={d.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon name="videoCam" className="h-4 w-4" /> Join Meet</a>
          {d.status !== "completed" && <button onClick={() => onStatus("completed")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">Mark done</button>}
          {d.status !== "cancelled" && <button onClick={() => onStatus("cancelled")} className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">Cancel</button>}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, v }: { icon: Parameters<typeof Icon>[0]["name"]; v: string }) {
  return <div className="flex items-center gap-2 text-slate-700"><Icon name={icon} className="h-4 w-4 shrink-0 text-slate-400" /> {v}</div>;
}

function GoogleEventDetail({ event: e, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const ends = e.end && !e.allDay ? ` – ${gTime(e.end)}` : "";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(ev) => ev.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-100"><Icon name="calendar" className="h-3.5 w-3.5" /> Google Calendar</p>
            <h2 className="mt-0.5 truncate text-lg font-bold">{e.summary}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2.5 px-6 py-4 text-sm">
          <Row icon="clock" v={`${gWhen(e)}${ends}${e.allDay ? " · All day" : ""}`} />
          {e.status && <Row icon="check" v={`Status: ${e.status}`} />}
          {e.location && <Row icon="pin" v={e.location} />}
          {e.organizer && <Row icon="users" v={`Organizer: ${e.organizer}`} />}
          {(e.attendees?.length ?? 0) > 0 && (
            <div className="flex items-start gap-2 text-slate-700">
              <Icon name="users" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Attendees ({e.attendees!.length})</p><p className="break-words">{e.attendees!.join(", ")}</p></div>
            </div>
          )}
          {e.description && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs whitespace-pre-wrap text-slate-600">{e.description}</div>
          )}
          {e.meetLink && (
            <a href={e.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-blue-600 hover:underline"><Icon name="videoCam" className="h-4 w-4 shrink-0 text-blue-500" /> {e.meetLink}</a>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-6 py-4">
          {e.meetLink && <a href={e.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="videoCam" className="h-4 w-4" /> Join Meet</a>}
          {e.htmlLink && <a href={e.htmlLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon name="export" className="h-4 w-4" /> Open in Google Calendar</a>}
        </div>
      </div>
    </div>
  );
}

function GmailCompose({ demo: d, client, connected, onClose, onSent }: { demo: Demo; client: GmailClient; connected: boolean; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const brand = loadPlatform().brand.name || "Nexus CRM";
  const when = demoWhen(d.scheduledAt);
  const [subject, setSubject] = useState(`Your ${brand} demo — ${when}`);
  const [body, setBody] = useState(
    `Hi ${d.name},\n\nThanks for booking a demo of ${brand}! Here are your meeting details:\n\n📅 ${when}\n🔗 Join Google Meet: ${d.meetLink}\n\nWe'll walk you through the platform and answer any questions. Looking forward to it!\n\n— The ${brand} Team`,
  );
  const [sending, setSending] = useState(false);
  const mailto = `mailto:${d.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function doSend() {
    if (!connected) {
      // No Gmail connection — fall back to the user's mail app.
      window.location.href = mailto;
      onSent();
      return;
    }
    setSending(true);
    try {
      await client.send(d.email, subject, body);
      onSent();
    } catch (e) {
      toast.error("Gmail send failed", (e as Error).message);
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-rose-500 to-red-600 px-5 py-3.5 text-white">
          <p className="flex items-center gap-2 text-sm font-bold"><Icon name="gmail" className="h-5 w-5" /> Send via Gmail</p>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm"><span className="text-slate-400">To</span><span className="font-medium text-slate-800">{d.email}</span></div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border-b border-slate-100 pb-2 text-sm font-medium outline-none" placeholder="Subject" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="w-full resize-none rounded-lg text-sm outline-none" placeholder="Message" />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <a href={mailto} className="text-xs font-medium text-slate-400 hover:text-slate-600">{connected ? "Open in mail app instead" : "Connect Google to send in-app"}</a>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={doSend} disabled={sending} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Icon name="send" className="h-4 w-4" /> {sending ? "Sending…" : connected ? "Send via Gmail" : "Send"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
