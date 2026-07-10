"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { callsApi, type CallAnalytics, type CallRange, type CallRep } from "@/lib/callsApi";

// All figures on this page are computed live from the backend `calls` table via
// /api/calls/analytics — no seeded/simulated data, no localStorage.

const HOUR_LABELS = ["12am", "1am", "2am", "3am", "4am", "5am", "6am", "7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm", "10pm", "11pm"];
const OFFICE_HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am … 9pm

const DIRECTION_META = [
  { key: "incoming" as const, name: "Incoming", color: "bg-emerald-500" },
  { key: "outgoing" as const, name: "Outgoing", color: "bg-blue-500" },
  { key: "missed" as const, name: "Missed", color: "bg-rose-500" },
];

const RANGE_OPTIONS: { label: string; value: CallRange }[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7d" },
  { label: "This month", value: "month" },
  { label: "All time", value: "all" },
];

function hm(sec: number) {
  const mins = Math.round(sec / 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
function ms(sec: number) {
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;
}
const initials = (s: string) => s.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function CallTrackerDashboard() {
  const [range, setRange] = useState<CallRange>("today");
  const [dept, setDept] = useState("All departments");
  const [query, setQuery] = useState("");
  const [showDefaulters, setShowDefaulters] = useState(false);

  const [data, setData] = useState<CallAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    callsApi
      .analytics(range)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [range]);

  const reps = useMemo(() => data?.reps ?? [], [data]);
  const totals = data?.totals;

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "Today";

  // Departments present in the live data drive the department filter.
  const deptOptions = useMemo(() => {
    const set = new Set(reps.map((r) => r.dept).filter((d) => d && d !== "—"));
    return ["All departments", ...Array.from(set).sort()];
  }, [reps]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reps.filter(
      (r) =>
        (dept === "All departments" || r.dept === dept) &&
        (!q || r.name.toLowerCase().includes(q)) &&
        (!showDefaulters || r.connectPct < 35),
    );
  }, [reps, dept, query, showDefaulters]);

  const topCalls = [...reps].sort((a, b) => b.calls - a.calls).slice(0, 5);
  const leastCalls = [...reps].sort((a, b) => a.calls - b.calls).slice(0, 5);
  const topTalk = [...reps].sort((a, b) => b.talkSec - a.talkSec).slice(0, 5);
  const leastTalk = [...reps].sort((a, b) => a.talkSec - b.talkSec).slice(0, 5);
  const topRate = [...reps].sort((a, b) => b.connectPct - a.connectPct).slice(0, 5);
  const leastRate = [...reps].sort((a, b) => a.connectPct - b.connectPct).slice(0, 5);

  const hourly = useMemo(
    () => OFFICE_HOURS.map((h) => ({ h, label: HOUR_LABELS[h], calls: data?.hourly[h] ?? 0 })),
    [data],
  );
  const hourMax = Math.max(1, ...hourly.map((h) => h.calls));
  const top3Hours = [...hourly].sort((a, b) => b.calls - a.calls).slice(0, 3);

  const dirData = DIRECTION_META.map((d) => ({ ...d, value: data?.direction[d.key] ?? 0 }));
  const dirMax = Math.max(1, ...dirData.map((d) => d.value));

  const trend = data?.trend ?? [];
  const attempts = reps.slice(0, 16);

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
              <p className="text-sm text-blue-100">Live call analytics across the team</p>
            </div>
          </div>
          <Link href="/call-tracker" className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"><Icon name="list" className="h-4 w-4" /> Call Log</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3">
        <Filter label="Date range">
          <SearchSelect value={rangeLabel} onChange={(l) => setRange(RANGE_OPTIONS.find((r) => r.label === l)?.value ?? "today")} options={RANGE_OPTIONS.map((r) => r.label)} />
        </Filter>
        <Filter label="Department"><SearchSelect value={dept} onChange={setDept} options={deptOptions} /></Filter>
        <Filter label="Search rep">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name…" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </Filter>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{error}</div>
      ) : loading && !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-sm text-slate-400">Loading call analytics…</div>
      ) : totals && totals.calls === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="call" className="h-8 w-8" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-800">No calls in this period</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Once your team syncs calls from their phones, live analytics for {rangeLabel.toLowerCase()} appear here.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi icon="call" tone="bg-blue-50 text-blue-600" label="Total Calls" value={(totals?.calls ?? 0).toLocaleString("en-IN")} />
            <Kpi icon="users" tone="bg-violet-50 text-violet-600" label="Unique Numbers" value={(totals?.unique ?? 0).toLocaleString("en-IN")} />
            <Kpi icon="clock" tone="bg-amber-50 text-amber-600" label="Avg Duration" value={ms(totals?.avgSec ?? 0)} />
            <Kpi icon="trendUp" tone="bg-emerald-50 text-emerald-600" label="Connect Rate" value={`${totals?.connectRate ?? 0}% (${(totals?.connected ?? 0).toLocaleString("en-IN")})`} />
            <Kpi icon="phone" tone="bg-rose-50 text-rose-600" label="Total Talk Time" value={hm(totals?.talkSec ?? 0)} />
          </div>

          {/* Hourly distribution */}
          <Panel title="Hourly call distribution" subtitle="Office hours · 8 AM – 9 PM">
            <div className="flex gap-4">
              <div className="flex h-52 flex-1 items-end gap-1.5 sm:gap-2.5">
                {hourly.map((h) => {
                  const top = top3Hours.includes(h) && h.calls > 0;
                  return (
                    <div key={h.h} className="flex flex-1 flex-col items-center">
                      <span className="mb-1 text-[10px] font-semibold text-slate-500">{h.calls}</span>
                      <div className="flex w-full flex-1 items-end justify-center">
                        <div className={`w-full max-w-[26px] rounded-t-md ${top ? "bg-gradient-to-t from-blue-600 to-blue-400" : "bg-blue-100"}`} style={{ height: `${(h.calls / hourMax) * 100}%` }} />
                      </div>
                      <span className="mt-1.5 text-[10px] text-slate-400">{h.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="hidden w-40 shrink-0 rounded-xl bg-slate-50 p-3 sm:block">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Top 3 hours</p>
                <ul className="mt-2 space-y-2">
                  {top3Hours.map((h, i) => (
                    <li key={h.h} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">{i + 1}</span>{h.label}</span><span className="font-semibold text-slate-900">{h.calls}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>

          {/* Calls by direction */}
          <Panel title="Calls by direction" subtitle="Incoming, outgoing and missed volume">
            <div className="flex gap-4">
              <div className="flex h-52 flex-1 items-end gap-3">
                {dirData.map((s) => (
                  <div key={s.key} className="flex flex-1 flex-col items-center">
                    <span className="mb-1 text-[10px] font-semibold text-slate-500">{s.value}</span>
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div className={`w-full max-w-[64px] rounded-t-md ${s.color}`} style={{ height: `${(s.value / dirMax) * 100}%` }} />
                    </div>
                    <span className="mt-1.5 text-center text-[11px] text-slate-500">{s.name}</span>
                  </div>
                ))}
              </div>
              <div className="hidden w-40 shrink-0 rounded-xl bg-slate-50 p-3 sm:block">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Breakdown</p>
                <ul className="mt-2 space-y-2">
                  {dirData.map((s) => (
                    <li key={s.key} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-700"><span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />{s.name}</span><span className="font-semibold text-slate-900">{s.value}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>

          {/* Top 5 / Least 5 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RankPanel title="Top 5 · Calls Made" reps={topCalls} metric={(r) => r.calls} fmt={(v) => String(v)} color="bg-blue-500" />
            <RankPanel title="Top 5 · Talk Time" reps={topTalk} metric={(r) => r.talkSec} fmt={hm} color="bg-emerald-500" />
            <RankPanel title="Top 5 · Connect Rate" reps={topRate} metric={(r) => r.connectPct} fmt={(v) => `${v}%`} color="bg-amber-500" />
            <RankPanel title="Least 5 · Calls Made" reps={leastCalls} metric={(r) => r.calls} fmt={(v) => String(v)} color="bg-slate-400" muted />
            <RankPanel title="Least 5 · Talk Time" reps={leastTalk} metric={(r) => r.talkSec} fmt={hm} color="bg-slate-400" muted />
            <RankPanel title="Least 5 · Connect Rate" reps={leastRate} metric={(r) => r.connectPct} fmt={(v) => `${v}%`} color="bg-rose-400" muted />
          </div>

          {/* 7-day trend */}
          <Panel title="7-day call trend" subtitle="Daily call count and average duration">
            <TrendChart data={trend} />
          </Panel>

          {/* Attempts vs connects */}
          <Panel title="Call attempts vs connects" subtitle="Per rep (top 16 by volume)">
            {attempts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No rep activity yet.</p>
            ) : (
              <>
                <div className="flex h-48 items-end gap-1.5 overflow-x-auto sm:gap-3">
                  {attempts.map((r) => {
                    const max = Math.max(1, ...attempts.map((x) => x.calls));
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
              </>
            )}
          </Panel>

          {/* Rep performance table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
              <p className="text-sm font-semibold text-slate-800">Rep performance · {rangeLabel.toLowerCase()} <span className="text-slate-400">({rows.length})</span></p>
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
                    <th className="px-3 py-3 text-right">Missed</th>
                    <th className="px-3 py-3 text-right">Talk time</th>
                    <th className="px-3 py-3 text-right">Avg dur</th>
                    <th className="px-3 py-3 text-right">Connect %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No reps match the filters.</td></tr>
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
                      <td className="px-3 py-2.5 text-right text-slate-600">{r.missed}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{hm(r.talkSec)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{ms(r.avgSec)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${r.connectPct >= 50 ? "bg-emerald-100 text-emerald-700" : r.connectPct >= 35 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{r.connectPct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>{children}</div>;
}

function Kpi({ icon, tone, label, value }: { icon: IconName; tone: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon name={icon} className="h-4 w-4" /></span>
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

function RankPanel({ title, reps, metric, fmt, color, muted }: { title: string; reps: CallRep[]; metric: (r: CallRep) => number; fmt: (v: number) => string; color: string; muted?: boolean }) {
  const max = Math.max(1, ...reps.map(metric));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className={`text-sm font-semibold ${muted ? "text-slate-500" : "text-slate-900"}`}>{title}</h3>
      {reps.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">No data yet.</p>
      ) : (
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
      )}
    </div>
  );
}

function TrendChart({ data }: { data: { date: string; calls: number; avgSec: number }[] }) {
  const W = 720, H = 200, padL = 8, padR = 8, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const leadMax = Math.max(1, ...data.map((d) => d.calls));
  const durMax = Math.max(1, ...data.map((d) => d.avgSec));
  const x = (i: number) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const yDur = (v: number) => padT + innerH - (v / durMax) * innerH;
  const line = data.map((d, i) => `${x(i)},${yDur(d.avgSec)}`).join(" ");
  const area = `${padL},${padT + innerH} ${line} ${padL + innerW},${padT + innerH}`;
  const barW = (innerW / Math.max(1, data.length)) * 0.4;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ct-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity="0.25" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
        </defs>
        {/* call-count bars */}
        {data.map((d, i) => {
          const h = (d.calls / leadMax) * innerH;
          return <rect key={i} x={x(i) - barW / 2} y={padT + innerH - h} width={barW} height={h} rx="3" className="fill-slate-100" />;
        })}
        <polygon points={area} fill="url(#ct-area)" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={yDur(d.avgSec)} r="3.5" className="fill-white" stroke="#2563eb" strokeWidth="2" />)}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[11px] text-slate-400">
        {data.map((d) => <span key={d.date}>{d.date}</span>)}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Call count</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-blue-500" /> Avg duration</span>
      </div>
    </div>
  );
}
