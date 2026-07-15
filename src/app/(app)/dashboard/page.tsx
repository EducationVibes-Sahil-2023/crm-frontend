"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { getUser } from "@/lib/auth";
import { loadIntakeLeads, subscribeLeads, type IntakeLead } from "@/lib/leadStore";
import { loadTasks, statusMeta, type Task } from "@/lib/tasks";

type Trend = "up" | "down" | "stable";

// Every figure on this page is derived from REAL data: leads come from the
// MySQL `leads` table (hydrated into the leadStore cache from /api/leads) and
// tasks from the tasks store. No hard-coded/mock numbers.

// A lead counts as an "admission" (converted) when its status matches these —
// the same matcher the AI assistant uses, kept in sync for consistent numbers.
const CONVERTED_RE = /won|admission|enrolled|convert|closed won/i;

const SOURCE_COLOR = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
const PIPE_COLOR = [
  "from-sky-500 to-blue-500",
  "from-blue-500 to-indigo-500",
  "from-indigo-500 to-violet-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-teal-500",
  "from-slate-400 to-slate-500",
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function fmtDue(s: string): string {
  if (!s) return "No due date";
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
/** Parse an IntakeLead display date ("Jun 28, 2026") to a Date, or null. */
function parseLeadDate(s: string | undefined): Date | null {
  const v = (s ?? "").trim();
  if (v === "" || v === "—") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function pctDelta(current: number, previous: number): { label: string; trend: Trend } {
  if (previous === 0) return current > 0 ? { label: "New", trend: "up" } : { label: "—", trend: "stable" };
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return { label: `+${change}%`, trend: "up" };
  if (change < 0) return { label: `${change}%`, trend: "down" };
  return { label: "Steady", trend: "stable" };
}

export default function DashboardPage() {
  const [name, setName] = useState("there");
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const refreshLeads = () => setLeads(loadIntakeLeads().filter((l) => !l.deleted));
    const init = () => {
      const u = getUser();
      if (u?.name) setName(u.name.split(" ")[0]);
      refreshLeads();
      setTasks(loadTasks());
      setNow(new Date());
    };
    init();
    const unsub = subscribeLeads(refreshLeads);
    const t = setTimeout(() => setLoading(false), 400);
    return () => { unsub(); clearTimeout(t); };
  }, []);

  const stats = useMemo(() => {
    const base = now ?? new Date();
    // Last-6-month buckets (enquiries + admissions per month, by created date).
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-US", { month: "short" }), enq: 0, adm: 0 };
    });
    const idxOf = new Map(months.map((m, i) => [m.key, i]));

    let converted = 0;
    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const l of leads) {
      const isConv = CONVERTED_RE.test(l.status);
      if (isConv) converted++;
      const src = l.source && l.source !== "—" ? l.source : "Unknown";
      bySource[src] = (bySource[src] || 0) + 1;
      const st = l.status && l.status !== "—" ? l.status : "Unspecified";
      byStatus[st] = (byStatus[st] || 0) + 1;
      const d = parseLeadDate(l.createdDate);
      if (d) {
        const i = idxOf.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (i != null) { months[i].enq++; if (isConv) months[i].adm++; }
      }
    }

    const total = leads.length;
    const thisMonth = months[5].enq;
    const lastMonth = months[4].enq;
    const admThis = months[5].adm;
    const admLast = months[4].adm;
    const conversion = total ? Math.round((converted / total) * 1000) / 10 : 0;
    const convSeries = months.map((m) => (m.enq ? Math.round((m.adm / m.enq) * 100) : 0));

    const sources = Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], i) => ({ name, value, color: SOURCE_COLOR[i % SOURCE_COLOR.length] }));

    const pipeline = Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([stage, value], i) => ({ stage, value, color: PIPE_COLOR[i % PIPE_COLOR.length] }));

    return {
      total, thisMonth, lastMonth, converted, admThis, admLast, conversion, convSeries,
      months, sources, pipeline,
      enqSeries: months.map((m) => m.enq),
      admSeries: months.map((m) => m.adm),
    };
  }, [leads, now]);

  if (loading) return <DashboardSkeleton />;

  const monthLabel = now ? now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "";
  const rangeLabel = now
    ? `${now.toLocaleDateString("en-IN", { month: "short" })} 1 – ${now.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`
    : "";

  const openTasks = tasks.filter((t) => t.status !== "done");
  const upcoming = [...openTasks]
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 5);

  const chartMax = Math.max(1, ...stats.months.map((m) => m.enq));
  const pipeMax = Math.max(1, ...stats.pipeline.map((p) => p.value));
  const srcTotal = stats.sources.reduce((s, x) => s + x.value, 0);

  const enqDelta = pctDelta(stats.thisMonth, stats.lastMonth);
  const admDelta = pctDelta(stats.admThis, stats.admLast);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-7">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{greeting()}, {name} 👋</h1>
            <p className="mt-1 text-sm text-blue-100">Here&apos;s your live counselling pipeline{monthLabel ? ` for ${monthLabel}` : ""}.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium ring-1 ring-white/25 backdrop-blur">
              <Icon name="calendar" className="h-4 w-4" /> {rangeLabel}
            </span>
            <Link href="/reports/leads" className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              <Icon name="trendUp" className="h-4 w-4" /> Reports
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards with sparklines — all real */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="leads" label="Total Enquiries" value={String(stats.total)} trend="up" delta={`${stats.thisMonth} this month`} sub={`${stats.total} leads in the pipeline`} spark={stats.enqSeries} />
        <StatCard icon="deals" label="New This Month" value={String(stats.thisMonth)} trend={enqDelta.trend} delta={enqDelta.label} sub={`vs ${stats.lastMonth} last month`} spark={stats.enqSeries} />
        <StatCard icon="win" label="Admissions" value={String(stats.converted)} trend={admDelta.trend} delta={admDelta.label} sub={`${stats.admThis} this month`} spark={stats.admSeries} />
        <StatCard icon="trendUp" label="Conversion Rate" value={`${stats.conversion}%`} trend="stable" delta="Enquiry → admission" sub={`${stats.converted} of ${stats.total} converted`} spark={stats.convSeries} />
      </div>

      {/* Trend + sources */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Enquiries &amp; Admissions</h2>
              <p className="text-xs text-slate-500">Last 6 months · by created date</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Enquiries</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Admissions</span>
            </div>
          </div>
          {stats.total === 0 ? (
            <EmptyBlock label="No leads yet — captured enquiries will chart here." />
          ) : (
            <div className="mt-6 flex h-56 items-end gap-3 sm:gap-6">
              {stats.months.map((p) => (
                <div key={p.key} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full flex-1 items-end justify-center gap-1">
                    <div className="w-3.5 rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 sm:w-5" style={{ height: `${(p.enq / chartMax) * 100}%` }} title={`${p.enq} enquiries`} />
                    <div className="w-3.5 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 sm:w-5" style={{ height: `${(p.adm / chartMax) * 100}%` }} title={`${p.adm} admissions`} />
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-500">{p.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead sources */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Lead sources</h2>
          <p className="text-xs text-slate-500">Where enquiries come from</p>
          {stats.sources.length === 0 ? (
            <EmptyBlock label="No sources recorded yet." />
          ) : (
            <div className="mt-5 space-y-3.5">
              {stats.sources.map((s) => {
                const pct = srcTotal ? Math.round((s.value / srcTotal) * 100) : 0;
                return (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{s.name}</span>
                      <span className="text-slate-400">{pct}% · {s.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline funnel + tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Lead pipeline</h2>
              <p className="text-xs text-slate-500">Leads by current status</p>
            </div>
            <Link href="/leads" className="text-sm font-semibold text-blue-600 hover:underline">View leads</Link>
          </div>
          {stats.pipeline.length === 0 ? (
            <EmptyBlock label="No leads to break down yet." />
          ) : (
            <div className="mt-5 space-y-3">
              {stats.pipeline.map((p) => (
                <div key={p.stage} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-slate-600" title={p.stage}>{p.stage}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                    <div className={`flex h-full items-center justify-end rounded-lg bg-gradient-to-r px-2 ${p.color}`} style={{ width: `${Math.max(8, (p.value / pipeMax) * 100)}%` }}>
                      <span className="text-xs font-bold text-white">{p.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming tasks (live) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Upcoming tasks</h2>
            <Link href="/tasks" className="text-sm font-semibold text-blue-600 hover:underline">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No open tasks 🎉</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {upcoming.map((t) => {
                const s = statusMeta(t.status);
                return (
                  <li key={t.id} className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${s.chip}`}>{s.label}</span>
                        <span className="text-xs text-slate-400">{fmtDue(t.dueDate)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
            {openTasks.length} open task{openTasks.length === 1 ? "" : "s"} · {stats.total} lead{stats.total === 1 ? "" : "s"} total
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return <p className="mt-6 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">{label}</p>;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-20">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-28" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <div className="mt-6 flex h-56 items-end gap-6">
            {["h-[70%]", "h-[90%]", "h-[55%]", "h-[40%]", "h-[65%]", "h-[80%]"].map((h, i) => (
              <Skeleton key={i} className={`flex-1 ${h}`} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Skeleton className="h-5 w-36" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2 w-full" /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, trend, delta, sub, spark,
}: {
  icon: IconName; label: string; value: string; trend: Trend; delta: string; sub: string; spark: number[];
}) {
  const badge = trend === "up" ? "bg-emerald-100 text-emerald-700" : trend === "down" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500";
  const line = trend === "up" ? "#10b981" : trend === "down" ? "#f43f5e" : "#94a3b8";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
          {trend === "up" && <Icon name="trendUp" className="h-3 w-3" />}
          {delta}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <Sparkline data={spark} color={line} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}
