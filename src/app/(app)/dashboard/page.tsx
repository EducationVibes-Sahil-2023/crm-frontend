"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { getUser } from "@/lib/auth";
import { loadIntakeLeads } from "@/lib/leadStore";
import { loadTasks, statusMeta, type Task } from "@/lib/tasks";

type Trend = "up" | "down" | "stable";

// ---- 2026 demo data (Indian counselling CRM) ----
const MONTHLY = [
  { m: "Jan", enq: 120, adm: 28 },
  { m: "Feb", enq: 138, adm: 31 },
  { m: "Mar", enq: 152, adm: 36 },
  { m: "Apr", enq: 144, adm: 34 },
  { m: "May", enq: 168, adm: 41 },
  { m: "Jun", enq: 156, adm: 38 },
];

const SOURCES = [
  { name: "Website", value: 38, color: "bg-blue-500" },
  { name: "Referral", value: 24, color: "bg-emerald-500" },
  { name: "Education Fair", value: 18, color: "bg-violet-500" },
  { name: "Justdial", value: 12, color: "bg-amber-500" },
  { name: "Walk-in", value: 8, color: "bg-rose-500" },
];

const PIPELINE = [
  { stage: "New Enquiry", value: 156, color: "from-sky-500 to-blue-500" },
  { stage: "Contacted", value: 112, color: "from-blue-500 to-indigo-500" },
  { stage: "Counselled", value: 68, color: "from-indigo-500 to-violet-500" },
  { stage: "Application", value: 41, color: "from-violet-500 to-purple-500" },
  { stage: "Admission", value: 28, color: "from-emerald-500 to-teal-500" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtDue(s: string): string {
  if (!s) return "No due date";
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [name, setName] = useState("Director");
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [capturedCount, setCapturedCount] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u?.name) setName(u.name.split(" ")[0]);
    setTasks(loadTasks());
    setCapturedCount(loadIntakeLeads().length);
    setNow(new Date());
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <DashboardSkeleton />;

  const monthLabel = now ? now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "June 2026";
  const rangeLabel = now
    ? `${now.toLocaleDateString("en-IN", { month: "short" })} 1 – ${now.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`
    : "Jun 1 – Jun 25, 2026";

  const newLeads = 156 + capturedCount;
  const openTasks = tasks.filter((t) => t.status !== "done");
  const upcoming = [...openTasks]
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 5);

  const chartMax = Math.max(...MONTHLY.map((m) => m.enq));
  const pipeMax = Math.max(...PIPELINE.map((p) => p.value));
  const srcTotal = SOURCES.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-7">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{greeting()}, {name} 👋</h1>
            <p className="mt-1 text-sm text-blue-100">Here&apos;s your counselling pipeline for {monthLabel}.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium ring-1 ring-white/25 backdrop-blur">
              <Icon name="calendar" className="h-4 w-4" /> {rangeLabel}
            </span>
            <button className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              <Icon name="export" className="h-4 w-4" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards with sparklines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="revenue" label="Total Revenue" value={inr(4285000)} trend="up" delta="+12%" sub="vs ₹38,23,000 last month" spark={[28, 31, 30, 35, 38, 43]} />
        <StatCard icon="leads" label="New Enquiries" value={String(newLeads)} trend="up" delta="+11%" sub="Target: 140 / month" spark={[90, 110, 130, 120, 140, 156]} />
        <StatCard icon="win" label="Admissions" value="38" trend="up" delta="+7%" sub="This month" spark={[28, 31, 36, 34, 41, 38]} />
        <StatCard icon="deals" label="Conversion Rate" value="24.4%" trend="stable" delta="Steady" sub="Enquiry → admission" spark={[22, 23, 24, 23, 25, 24]} />
      </div>

      {/* Trend + sources */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Enquiries &amp; Admissions</h2>
              <p className="text-xs text-slate-500">Monthly performance · 2026</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Enquiries</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Admissions</span>
            </div>
          </div>
          <div className="mt-6 flex h-56 items-end gap-3 sm:gap-6">
            {MONTHLY.map((p) => (
              <div key={p.m} className="flex flex-1 flex-col items-center">
                <div className="flex w-full flex-1 items-end justify-center gap-1">
                  <div className="w-3.5 rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 sm:w-5" style={{ height: `${(p.enq / chartMax) * 100}%` }} title={`${p.enq} enquiries`} />
                  <div className="w-3.5 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 sm:w-5" style={{ height: `${(p.adm / chartMax) * 100}%` }} title={`${p.adm} admissions`} />
                </div>
                <p className="mt-3 text-xs font-medium text-slate-500">{p.m}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lead sources */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Lead sources</h2>
          <p className="text-xs text-slate-500">Where enquiries come from</p>
          <div className="mt-5 space-y-3.5">
            {SOURCES.map((s) => {
              const pct = Math.round((s.value / srcTotal) * 100);
              return (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pipeline funnel + tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Admission pipeline</h2>
              <p className="text-xs text-slate-500">Enquiry to admission funnel</p>
            </div>
            <Link href="/leads" className="text-sm font-semibold text-blue-600 hover:underline">View leads</Link>
          </div>
          <div className="mt-5 space-y-3">
            {PIPELINE.map((p) => (
              <div key={p.stage} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-slate-600">{p.stage}</span>
                <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                  <div className={`flex h-full items-center justify-end rounded-lg bg-gradient-to-r px-2 ${p.color}`} style={{ width: `${(p.value / pipeMax) * 100}%` }}>
                    <span className="text-xs font-bold text-white">{p.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
            {openTasks.length} open task{openTasks.length === 1 ? "" : "s"} · {capturedCount} new lead{capturedCount === 1 ? "" : "s"} captured
          </p>
        </div>
      </div>
    </div>
  );
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
