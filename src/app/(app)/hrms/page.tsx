"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { getUser } from "@/lib/auth";
import {
  formatMoney,
  listEmployees,
  loadAwards,
  loadEngagement,
  loadHolidays,
  loadLeaves,
  loadMedical,
  loadPosts,
  type Award,
  type Engagement,
  type Holiday,
  type Leave,
  type MedicalClaim,
  type Post,
} from "@/lib/hr";

type Mods = {
  leaves: Leave[]; holidays: Holiday[]; awards: Award[]; posts: Post[]; engagement: Engagement[]; medical: MedicalClaim[];
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function parseDate(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? Infinity : t;
}

export default function HrmsDashboard() {
  const employees = useMemo(() => listEmployees(), []);
  const [name, setName] = useState("there");
  const [nowMs, setNowMs] = useState(0);
  const [m, setM] = useState<Mods>({ leaves: [], holidays: [], awards: [], posts: [], engagement: [], medical: [] });

  useEffect(() => {
    const u = getUser();
    if (u?.name) setName(u.name.split(" ")[0]);
    setNowMs(Date.now());
    setM({
      leaves: loadLeaves(), holidays: loadHolidays(), awards: loadAwards(),
      posts: loadPosts(), engagement: loadEngagement(), medical: loadMedical(),
    });
  }, []);

  const headcount = employees.length;
  const monthlyPayroll = employees.reduce((s, e) => s + e.ctc, 0);
  const pendingLeaves = m.leaves.filter((l) => l.status === "Pending").length;
  const pendingMedical = m.medical.filter((c) => c.status === "Pending").length;
  const nextHoliday = [...m.holidays].sort((a, b) => parseDate(a.date) - parseDate(b.date)).find((h) => parseDate(h.date) >= nowMs - 864e5);
  const upcomingEvents = m.engagement.filter((e) => parseDate(e.date) >= nowMs - 864e5).length;

  const stats: { icon: IconName; label: string; value: string; sub?: string; tone: string }[] = [
    { icon: "users", label: "Headcount", value: String(headcount), sub: "Counsellor team", tone: "bg-blue-50 text-blue-600" },
    { icon: "revenue", label: "Monthly Payroll", value: formatMoney(monthlyPayroll), sub: "Gross CTC", tone: "bg-emerald-50 text-emerald-600" },
    { icon: "calendar", label: "Pending Leaves", value: String(pendingLeaves), sub: "Awaiting approval", tone: "bg-amber-50 text-amber-600" },
    { icon: "star", label: "Next Holiday", value: nextHoliday?.name ?? "—", sub: nextHoliday?.date, tone: "bg-violet-50 text-violet-600" },
  ];

  const modules: { href: string; icon: IconName; title: string; desc: string; metric: string; grad: string }[] = [
    { href: "/attendance", icon: "clock", title: "Attendance", desc: "Punch in/out, shifts, regularisation", metric: "Live", grad: "from-sky-500 to-blue-600" },
    { href: "/leaves", icon: "calendar", title: "Leave Management", desc: "Apply, approve, track balances", metric: `${pendingLeaves} pending`, grad: "from-amber-500 to-orange-600" },
    { href: "/payroll", icon: "payment", title: "Payroll & Salary", desc: "Run payroll, salary structure", metric: formatMoney(monthlyPayroll), grad: "from-emerald-500 to-teal-600" },
    { href: "/payslips", icon: "fileText", title: "Payslips", desc: "Generate & download slips", metric: `${headcount} staff`, grad: "from-indigo-500 to-violet-600" },
    { href: "/holidays", icon: "star", title: "Holidays", desc: "Holiday calendar by year", metric: `${m.holidays.length} days`, grad: "from-violet-500 to-purple-600" },
    { href: "/policies", icon: "knowledge", title: "Policies", desc: "Company policy library", metric: "Library", grad: "from-slate-500 to-slate-700" },
    { href: "/awards", icon: "win", title: "Awards", desc: "Recognition & rewards", metric: `${m.awards.length} given`, grad: "from-rose-500 to-pink-600" },
    { href: "/engagement", icon: "chat", title: "Engagement", desc: "Events, outings, town halls", metric: `${upcomingEvents} upcoming`, grad: "from-cyan-500 to-sky-600" },
    { href: "/posts", icon: "announcement", title: "Posts / Notices", desc: "Company-wide notices", metric: `${m.posts.length} posts`, grad: "from-blue-500 to-indigo-600" },
    { href: "/medical", icon: "ticket", title: "Medical", desc: "Insurance & claims", metric: `${pendingMedical} pending`, grad: "from-red-500 to-rose-600" },
    { href: "/letters", icon: "fileText", title: "Letters", desc: "Offer & increment letters", metric: "Generate", grad: "from-teal-500 to-emerald-600" },
    { href: "/admin-setup", icon: "settings", title: "HR Setup", desc: "Shifts, locations, payroll config", metric: "Configure", grad: "from-slate-600 to-slate-800" },
  ];

  const quick: { href: string; icon: IconName; label: string }[] = [
    { href: "/leaves", icon: "calendar", label: "Apply Leave" },
    { href: "/attendance", icon: "clock", label: "Punch In/Out" },
    { href: "/payroll", icon: "payment", label: "Run Payroll" },
    { href: "/posts", icon: "announcement", label: "Post Notice" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="users" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">{greeting()}, {name}</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">Your people, automated — attendance, leave, payroll, recognition and more in one place.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20">
                <Icon name={q.icon} className="h-4 w-4" /> {q.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
              <p className="truncate text-lg font-bold leading-tight">{s.value}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{s.label}</p>
              {s.sub && <p className="truncate text-[11px] text-blue-100/80">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Automation banner */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon name="activity" className="h-4 w-4 text-blue-600" /> Automations active</p>
        {["Auto attendance from punches", "Leave balance auto-deduct", "Payroll auto-compute", "Holiday-aware approvals", "Notifications on approvals"].map((a) => (
          <span key={a} className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {a}</span>
        ))}
      </div>

      {/* Module grid */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-900">All modules</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((mod) => (
            <Link key={mod.href} href={mod.href} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white ${mod.grad}`}><Icon name={mod.icon} className="h-5 w-5" /></span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{mod.metric}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-blue-700">{mod.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{mod.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Two-column: pending approvals + notices */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Pending leave approvals" href="/leaves" linkLabel="Open">
          {m.leaves.filter((l) => l.status === "Pending").length === 0 ? (
            <Empty>No pending requests.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {m.leaves.filter((l) => l.status === "Pending").slice(0, 5).map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{l.employee.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{l.employee}</p><p className="truncate text-xs text-slate-400">{l.type} · {l.days}d · {l.from}</p></div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Latest notices" href="/posts" linkLabel="All posts">
          {m.posts.length === 0 ? <Empty>No notices yet.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {m.posts.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon name="announcement" className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{p.pinned && "📌 "}{p.title}</p><p className="line-clamp-1 text-xs text-slate-400">{p.body}</p></div>
                  <span className="shrink-0 text-[11px] text-slate-400">{p.date}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Link href={href} className="text-xs font-semibold text-blue-600 hover:underline">{linkLabel}</Link>
      </div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">{children}</p>;
}
