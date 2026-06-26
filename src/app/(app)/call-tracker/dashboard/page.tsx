"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";

// ---- deterministic seeded sample data (Indian sales/counselling team) ----
function mulberry(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry(20260625);

const FIRST = ["Anand", "Rajat", "Aravind", "Mayuri", "Pooja", "Samay", "Esha", "Babasaheb", "Malothu", "Shadab", "Gargee", "Rohit", "Pooja", "Sakshi", "Navin", "Chaitanya", "Shai", "Gauri", "Sneha", "Ishika", "Mahima", "Rajesh", "Pradumya", "Mangesh", "Raj", "Subhash", "Harsh", "Akhil", "Ved", "Kajkumar", "Kajal", "Putt", "Shaik", "Naman", "Stuti", "Nishita", "Vandana", "Mohammed", "Dhiraj", "Tanu", "Deepak", "Nitin", "Shraddha", "Shaily"];
const LAST = ["Borkar", "Bangde", "Reddy", "Sisware", "Nagdev", "Wahane", "Karajgkar", "Gavali", "Vamshi", "Sayyed", "Deshpande", "Shinde", "Lalu", "Khurana", "Solanki", "Chaudhari", "Patil", "Chavan", "Naik", "Neogi", "Iyer", "Yadav", "Banke", "Shinde", "Raghuvanshi", "Bhargava", "Sawane", "Eaga", "Agrawal", "Kashid", "Baviskar", "Padhwani", "Karimulla", "Khede", "Pradhan", "Gupta", "Mujumdar", "Waseem", "Patil", "Sahani", "Kumbhar", "Chopra", "Ghorpade", "Sisodia"];
const DEPTS = ["Admissions", "Counselling", "Tele-calling", "Support"];

type Rep = {
  id: number; name: string; dept: string;
  calls: number; unique: number; connected: number; avgSec: number;
  talkMins: number; fresh: number; freshConnected: number; freshTalkMins: number; connectPct: number;
};

const REPS: Rep[] = Array.from({ length: 44 }, (_, i) => {
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`;
  const calls = 30 + Math.floor(rand() * 430);
  const unique = Math.max(10, Math.floor(calls * (0.55 + rand() * 0.35)));
  const connected = Math.max(1, Math.floor(calls * (0.18 + rand() * 0.4)));
  const avgSec = 40 + Math.floor(rand() * 260);
  const talkMins = Math.round((connected * avgSec) / 60);
  const fresh = Math.floor(rand() * 40);
  const freshConnected = Math.floor(fresh * rand());
  const freshTalkMins = Math.round((freshConnected * avgSec) / 60);
  const connectPct = calls ? Math.round((connected / calls) * 100) : 0;
  return { id: i, name, dept: DEPTS[i % DEPTS.length], calls, unique, connected, avgSec, talkMins, fresh, freshConnected, freshTalkMins, connectPct };
}).sort((a, b) => b.calls - a.calls);

const TOTAL_CALLS = REPS.reduce((s, r) => s + r.calls, 0);
const TOTAL_UNIQUE = REPS.reduce((s, r) => s + r.unique, 0);
const TOTAL_CONNECTED = REPS.reduce((s, r) => s + r.connected, 0);
const TOTAL_TALK_MINS = REPS.reduce((s, r) => s + r.talkMins, 0);
const CONNECT_RATE = Math.round((TOTAL_CONNECTED / TOTAL_CALLS) * 100);
const AVG_SEC = Math.round((TOTAL_TALK_MINS * 60) / TOTAL_CONNECTED);

const HOURS = ["8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm"];
const HOURLY = HOURS.map((h, i) => ({ h, leads: i < 2 || i > 11 ? 60 + Math.floor(rand() * 200) : 280 + Math.floor(rand() * 640) }));

const STATUS = [
  { name: "Cold Lead", value: 1110, color: "bg-fuchsia-500" },
  { name: "Warm Lead", value: 760, color: "bg-orange-500" },
  { name: "Not Reachable", value: 1170, color: "bg-slate-700" },
  { name: "Connected", value: 760, color: "bg-emerald-500" },
  { name: "Busy", value: 320, color: "bg-amber-500" },
  { name: "Follow Up", value: 295, color: "bg-blue-500" },
  { name: "Switched Off", value: 150, color: "bg-rose-500" },
  { name: "Wrong No.", value: 95, color: "bg-violet-500" },
  { name: "Converted", value: 72, color: "bg-teal-500" },
];

const TREND = ["Jun 18", "Jun 19", "Jun 20", "Jun 21", "Jun 22", "Jun 23", "Jun 24"].map((d, i) => ({
  d, leads: 850 + Math.floor(rand() * 850), avgSec: 150 + Math.floor(rand() * 200) + (i > 3 ? 120 : 0),
}));

function hm(mins: number) { return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`; }
function ms(sec: number) { return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`; }
const initials = (s: string) => s.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const FILTERS = {
  date: ["Today", "Yesterday", "Last 7 days", "This month", "Jun 25, 2026"],
  source: ["All sources", "Website", "Justdial", "Referral", "Education Fair", "Walk-in"],
  status: ["All status", "New", "Cold Lead", "Warm Lead", "Connected", "Follow Up", "Converted"],
  dept: ["All departments", ...DEPTS],
  location: ["All locations", "Mumbai", "Pune", "Bengaluru", "Delhi", "Remote"],
};

export default function CallTrackerDashboard() {
  const [dept, setDept] = useState("All departments");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All sources");
  const [status, setStatus] = useState("All status");
  const [date, setDate] = useState("Today");
  const [location, setLocation] = useState("All locations");
  const [showDefaulters, setShowDefaulters] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REPS.filter((r) => (dept === "All departments" || r.dept === dept) && (!q || r.name.toLowerCase().includes(q)) && (!showDefaulters || r.connectPct < 35));
  }, [dept, query, showDefaulters]);

  const topCalls = [...REPS].sort((a, b) => b.calls - a.calls).slice(0, 5);
  const leastCalls = [...REPS].sort((a, b) => a.calls - b.calls).slice(0, 5);
  const topTalk = [...REPS].sort((a, b) => b.talkMins - a.talkMins).slice(0, 5);
  const leastTalk = [...REPS].sort((a, b) => a.talkMins - b.talkMins).slice(0, 5);
  const topRate = [...REPS].sort((a, b) => b.connectPct - a.connectPct).slice(0, 5);
  const leastRate = [...REPS].sort((a, b) => a.connectPct - b.connectPct).slice(0, 5);
  const hourMax = Math.max(...HOURLY.map((h) => h.leads));
  const statusMax = Math.max(...STATUS.map((s) => s.value));
  const top3Hours = [...HOURLY].sort((a, b) => b.leads - a.leads).slice(0, 3);
  const top3Status = [...STATUS].sort((a, b) => b.value - a.value).slice(0, 3);
  const attempts = REPS.slice(0, 16);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-sm sm:p-6">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="call" className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold">Sales Call Tracker</h1>
              <p className="text-sm text-blue-100">Real-time call analytics across the team</p>
            </div>
          </div>
          <Link href="/call-tracker" className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"><Icon name="list" className="h-4 w-4" /> Call Log</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <Filter label="Update Date"><SearchSelect value={date} onChange={setDate} options={FILTERS.date} /></Filter>
        <Filter label="Lead Source"><SearchSelect value={source} onChange={setSource} options={FILTERS.source} /></Filter>
        <Filter label="Lead Status"><SearchSelect value={status} onChange={setStatus} options={FILTERS.status} /></Filter>
        <Filter label="Department"><SearchSelect value={dept} onChange={setDept} options={FILTERS.dept} /></Filter>
        <Filter label="Office Location"><SearchSelect value={location} onChange={setLocation} options={FILTERS.location} /></Filter>
        <Filter label="Search rep">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name…" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </Filter>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon="call" tone="bg-blue-50 text-blue-600" label="Total Calls" value={TOTAL_CALLS.toLocaleString("en-IN")} delta="+6%" up />
        <Kpi icon="users" tone="bg-violet-50 text-violet-600" label="Unique Calls" value={TOTAL_UNIQUE.toLocaleString("en-IN")} delta="+3%" up />
        <Kpi icon="clock" tone="bg-amber-50 text-amber-600" label="Avg Duration" value={ms(AVG_SEC)} delta="-2%" />
        <Kpi icon="trendUp" tone="bg-emerald-50 text-emerald-600" label="Connect Rate" value={`${CONNECT_RATE}% (${TOTAL_CONNECTED.toLocaleString("en-IN")})`} delta="+4%" up />
        <Kpi icon="phone" tone="bg-rose-50 text-rose-600" label="Total Talk Time" value={hm(TOTAL_TALK_MINS)} delta="+1%" up />
      </div>

      {/* Hourly distribution */}
      <Panel title="Hourly call distribution" subtitle="Office hours · 8 AM – 9 PM">
        <div className="flex gap-4">
          <div className="flex h-52 flex-1 items-end gap-1.5 sm:gap-2.5">
            {HOURLY.map((h) => {
              const top = top3Hours.includes(h);
              return (
                <div key={h.h} className="flex flex-1 flex-col items-center">
                  <span className="mb-1 text-[10px] font-semibold text-slate-500">{h.leads}</span>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div className={`w-full max-w-[26px] rounded-t-md ${top ? "bg-gradient-to-t from-blue-600 to-blue-400" : "bg-blue-100"}`} style={{ height: `${(h.leads / hourMax) * 100}%` }} />
                  </div>
                  <span className="mt-1.5 text-[10px] text-slate-400">{h.h}</span>
                </div>
              );
            })}
          </div>
          <div className="hidden w-40 shrink-0 rounded-xl bg-slate-50 p-3 sm:block">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Top 3 hours</p>
            <ul className="mt-2 space-y-2">
              {top3Hours.map((h, i) => (
                <li key={h.h} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">{i + 1}</span>{h.h}</span><span className="font-semibold text-slate-900">{h.leads}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      {/* Calls by lead status */}
      <Panel title="Calls by lead status" subtitle="Volume of calls per status">
        <div className="flex gap-4">
          <div className="flex h-52 flex-1 items-end gap-1.5 sm:gap-3">
            {STATUS.map((s) => (
              <div key={s.name} className="flex flex-1 flex-col items-center">
                <span className="mb-1 text-[10px] font-semibold text-slate-500">{s.value}</span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div className={`w-full max-w-[34px] rounded-t-md ${s.color}`} style={{ height: `${(s.value / statusMax) * 100}%` }} />
                </div>
                <span className="mt-1.5 max-w-full truncate text-center text-[9px] text-slate-400" title={s.name}>{s.name}</span>
              </div>
            ))}
          </div>
          <div className="hidden w-40 shrink-0 rounded-xl bg-slate-50 p-3 sm:block">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Top 3 status</p>
            <ul className="mt-2 space-y-2">
              {top3Status.map((s) => (
                <li key={s.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-700"><span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />{s.name}</span><span className="font-semibold text-slate-900">{s.value}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      {/* Top 5 / Least 5 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RankPanel title="Top 5 · Calls Made" reps={topCalls} metric={(r) => r.calls} fmt={(v) => String(v)} color="bg-blue-500" />
        <RankPanel title="Top 5 · Talk Time" reps={topTalk} metric={(r) => r.talkMins} fmt={hm} color="bg-emerald-500" />
        <RankPanel title="Top 5 · Connect Rate" reps={topRate} metric={(r) => r.connectPct} fmt={(v) => `${v}%`} color="bg-amber-500" />
        <RankPanel title="Least 5 · Calls Made" reps={leastCalls} metric={(r) => r.calls} fmt={(v) => String(v)} color="bg-slate-400" muted />
        <RankPanel title="Least 5 · Talk Time" reps={leastTalk} metric={(r) => r.talkMins} fmt={hm} color="bg-slate-400" muted />
        <RankPanel title="Least 5 · Connect Rate" reps={leastRate} metric={(r) => r.connectPct} fmt={(v) => `${v}%`} color="bg-rose-400" muted />
      </div>

      {/* 7-day trend */}
      <Panel title="7-day call duration trend" subtitle="Avg duration and lead count">
        <TrendChart data={TREND} />
      </Panel>

      {/* Attempts vs connects */}
      <Panel title="Call attempts vs connects" subtitle="Per rep (top 16 by volume)">
        <div className="flex h-48 items-end gap-1.5 overflow-x-auto sm:gap-3">
          {attempts.map((r) => {
            const max = Math.max(...attempts.map((x) => x.calls));
            return (
              <div key={r.id} className="flex min-w-[26px] flex-1 flex-col items-center">
                <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                  <div className="w-2.5 rounded-t bg-blue-200" style={{ height: `${(r.calls / max) * 100}%` }} title={`${r.calls} attempts`} />
                  <div className="w-2.5 rounded-t bg-emerald-500" style={{ height: `${(r.connected / max) * 100}%` }} title={`${r.connected} connects`} />
                </div>
                <span className="mt-1.5 max-w-[48px] truncate text-[9px] text-slate-400" title={r.name}>{r.name.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-200" /> Attempts</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Connects</span>
        </div>
      </Panel>

      {/* Rep performance table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <p className="text-sm font-semibold text-slate-800">Rep performance · today <span className="text-slate-400">({rows.length})</span></p>
          <button onClick={() => setShowDefaulters((s) => !s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${showDefaulters ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}>
            {showDefaulters ? "Showing defaulters" : "Defaulters"}
          </button>
        </div>
        <div className="no-scrollbar max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-3 py-3 text-right">Calls</th>
                <th className="px-3 py-3 text-right">Unique</th>
                <th className="px-3 py-3 text-right">Connected</th>
                <th className="px-3 py-3 text-right">Talk time</th>
                <th className="px-3 py-3 text-right">Avg dur</th>
                <th className="px-3 py-3 text-right">Fresh</th>
                <th className="px-3 py-3 text-right">Fresh conn.</th>
                <th className="px-3 py-3 text-right">Connect %</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">No reps match the filters.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">{initials(r.name)}</span>
                      <div className="min-w-0"><p className="truncate font-medium text-slate-800">{r.name}</p><p className="text-[11px] text-slate-400">{r.dept}</p></div>
                      {i < 3 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">#{i + 1}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{r.calls}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.unique}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.connected}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{hm(r.talkMins)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{ms(r.avgSec)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.fresh}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.freshConnected}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${r.connectPct >= 50 ? "bg-emerald-100 text-emerald-700" : r.connectPct >= 35 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{r.connectPct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>{children}</div>;
}

function Kpi({ icon, tone, label, value, delta, up }: { icon: IconName; tone: string; label: string; value: string; delta: string; up?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon name={icon} className="h-4 w-4" /></span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{delta}</span>
      </div>
      <p className="mt-3 truncate text-xl font-bold text-slate-900" title={value}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4"><h2 className="text-base font-semibold text-slate-900">{title}</h2>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</div>
      {children}
    </div>
  );
}

function RankPanel({ title, reps, metric, fmt, color, muted }: { title: string; reps: Rep[]; metric: (r: Rep) => number; fmt: (v: number) => string; color: string; muted?: boolean }) {
  const max = Math.max(1, ...reps.map(metric));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className={`text-sm font-semibold ${muted ? "text-slate-500" : "text-slate-900"}`}>{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {reps.map((r) => {
          const v = metric(r);
          return (
            <li key={r.id} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-slate-600" title={r.name}>{r.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${(v / max) * 100}%` }} /></div>
              <span className="w-14 shrink-0 text-right font-semibold text-slate-800">{fmt(v)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrendChart({ data }: { data: { d: string; leads: number; avgSec: number }[] }) {
  const W = 720, H = 200, padL = 8, padR = 8, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const leadMax = Math.max(...data.map((d) => d.leads));
  const durMax = Math.max(...data.map((d) => d.avgSec));
  const x = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const yDur = (v: number) => padT + innerH - (v / durMax) * innerH;
  const line = data.map((d, i) => `${x(i)},${yDur(d.avgSec)}`).join(" ");
  const area = `${padL},${padT + innerH} ${line} ${padL + innerW},${padT + innerH}`;
  const barW = innerW / data.length * 0.4;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ct-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity="0.25" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
        </defs>
        {/* lead-count bars */}
        {data.map((d, i) => {
          const h = (d.leads / leadMax) * innerH;
          return <rect key={i} x={x(i) - barW / 2} y={padT + innerH - h} width={barW} height={h} rx="3" className="fill-slate-100" />;
        })}
        <polygon points={area} fill="url(#ct-area)" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={yDur(d.avgSec)} r="3.5" className="fill-white" stroke="#2563eb" strokeWidth="2" />)}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[11px] text-slate-400">
        {data.map((d) => <span key={d.d}>{d.d}</span>)}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Lead count</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-blue-500" /> Avg duration</span>
      </div>
    </div>
  );
}
