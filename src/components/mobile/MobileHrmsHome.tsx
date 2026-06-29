"use client";

// Mobile (phones-only) HRMS home — the landing screen of the HRMS app. Redesigned
// for a clean, friendly, self-serve experience: a live attendance card you can act
// on, big quick actions, leave balance at a glance, pending approvals, and a tidy
// module grid. Rendered only inside `lg:hidden` on the HRMS page; desktop keeps
// its own dashboard. Reads/writes the same stores as the desktop pages.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { getUser } from "@/lib/auth";
import {
  LEAVE_BALANCE,
  LEAVE_TYPES,
  formatMoney,
  listEmployees,
  loadHolidays,
  loadLeaves,
  loadPosts,
  loadPunches,
  todayISO,
  type Holiday,
  type Leave,
  type Post,
  type Punch,
} from "@/lib/hr";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function initials(name: string): string {
  return name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}
function parseDate(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? Infinity : t;
}

const QUICK: { href: string; icon: IconName; label: string; tone: string }[] = [
  { href: "/attendance", icon: "clock", label: "Attendance", tone: "bg-sky-50 text-sky-600" },
  { href: "/leaves", icon: "calendar", label: "Apply leave", tone: "bg-amber-50 text-amber-600" },
  { href: "/payslips", icon: "fileText", label: "Payslips", tone: "bg-indigo-50 text-indigo-600" },
  { href: "/holidays", icon: "star", label: "Holidays", tone: "bg-violet-50 text-violet-600" },
];

const MODULES: { href: string; icon: IconName; label: string; tone: string }[] = [
  { href: "/attendance", icon: "clock", label: "Attendance", tone: "bg-sky-50 text-sky-600" },
  { href: "/leaves", icon: "calendar", label: "Leaves", tone: "bg-amber-50 text-amber-600" },
  { href: "/payroll", icon: "payment", label: "Payroll", tone: "bg-emerald-50 text-emerald-600" },
  { href: "/payslips", icon: "fileText", label: "Payslips", tone: "bg-indigo-50 text-indigo-600" },
  { href: "/holidays", icon: "star", label: "Holidays", tone: "bg-violet-50 text-violet-600" },
  { href: "/awards", icon: "win", label: "Awards", tone: "bg-rose-50 text-rose-600" },
  { href: "/engagement", icon: "chat", label: "Events", tone: "bg-cyan-50 text-cyan-600" },
  { href: "/medical", icon: "ticket", label: "Medical", tone: "bg-red-50 text-red-600" },
  { href: "/policies", icon: "knowledge", label: "Policies", tone: "bg-slate-100 text-slate-600" },
];

export default function MobileHrmsHome() {
  const employees = useMemo(() => listEmployees(), []);
  const [name, setName] = useState("there");
  const [role, setRole] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [punch, setPunch] = useState<Punch | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const u = getUser();
    if (u?.name) setName(u.name.split(" ")[0]);
    setRole(u?.designation || u?.role || "Team member");
    setAvatar(u?.avatar ?? null);
    setLeaves(loadLeaves());
    setHolidays(loadHolidays());
    setPosts(loadPosts());
    setPunch(loadPunches()[todayISO()] ?? null);
    setNow(Date.now());
  }, []);

  const pendingLeaves = leaves.filter((l) => l.status === "Pending");
  const nextHoliday = [...holidays].sort((a, b) => parseDate(a.date) - parseDate(b.date)).find((h) => parseDate(h.date) >= now - 864e5);
  const monthlyPayroll = employees.reduce((s, e) => s + e.ctc, 0);

  // Total remaining paid-leave balance for the at-a-glance chip.
  const leaveLeft = useMemo(() => {
    const year = new Date().getFullYear();
    let total = 0;
    for (const t of LEAVE_TYPES) {
      const cap = LEAVE_BALANCE[t] ?? 0;
      if (cap <= 0) continue;
      const used = leaves
        .filter((l) => l.type === t && l.status === "Approved" && new Date(l.from).getFullYear() === year)
        .reduce((a, l) => a + l.days, 0);
      total += Math.max(0, cap - used);
    }
    return total;
  }, [leaves]);

  const checkedIn = !!punch?.checkIn && !punch?.checkOut;
  const done = !!punch?.checkIn && !!punch?.checkOut;
  const attState = done ? "done" : checkedIn ? "in" : "out";

  return (
    <div className="space-y-3 pb-2">
      {/* Greeting + date */}
      <div className="flex items-center gap-3 px-0.5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-slate-200" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white">{initials(name)}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">{greeting()}, {name}</p>
          <p className="truncate text-xs text-slate-500">{role}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </div>

      {/* Live attendance card */}
      <Link
        href="/attendance"
        className="block overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-300" : checkedIn ? "bg-emerald-300 animate-pulse" : "bg-white/50"}`} />
            <p className="text-sm font-semibold">
              {attState === "done" ? "Day complete" : attState === "in" ? "You're checked in" : "Not checked in yet"}
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/25">
            {attState === "out" ? "Check in →" : "View →"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-100">Check in</p>
            <p className="text-sm font-bold">{punch?.checkIn ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-100">Check out</p>
            <p className="text-sm font-bold">{punch?.checkOut ?? "—"}</p>
          </div>
        </div>
      </Link>

      {/* Quick actions */}
      <section className="grid grid-cols-4 gap-2">
        {QUICK.map((q) => (
          <Link key={q.label} href={q.href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 shadow-sm transition active:scale-95">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${q.tone}`}>
              <Icon name={q.icon} className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-semibold text-slate-700">{q.label}</span>
          </Link>
        ))}
      </section>

      {/* At-a-glance tiles */}
      <section className="grid grid-cols-3 gap-2">
        <StatTile label="My leave left" value={String(leaveLeft)} sub="days" icon="calendar" tone="text-emerald-600" />
        <StatTile label="Team" value={String(employees.length)} sub="people" icon="users" tone="text-blue-600" />
        <StatTile label="Pending" value={String(pendingLeaves.length)} sub="approvals" icon="clock" tone="text-amber-600" />
      </section>

      {/* Pending leave approvals */}
      <FeedCard title="Pending approvals" href="/leaves" linkLabel="Review">
        {pendingLeaves.length === 0 ? (
          <Empty text="Nothing waiting on you 🎉" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendingLeaves.slice(0, 4).map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{initials(l.employee)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{l.employee}</p>
                  <p className="truncate text-xs text-slate-500">{l.type} · {l.days}d · {l.from}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>
              </li>
            ))}
          </ul>
        )}
      </FeedCard>

      {/* Next holiday + payroll snapshot */}
      <section className="grid grid-cols-2 gap-2">
        <Link href="/holidays" className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition active:scale-95">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Icon name="star" className="h-3.5 w-3.5" /> Next holiday</p>
          {nextHoliday ? (
            <>
              <p className="mt-1.5 truncate text-sm font-bold text-slate-800">{nextHoliday.name}</p>
              <p className="text-xs text-slate-500">{nextHoliday.date}</p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-slate-400">None scheduled</p>
          )}
        </Link>
        <Link href="/payroll" className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition active:scale-95">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Icon name="payment" className="h-3.5 w-3.5" /> Monthly payroll</p>
          <p className="mt-1.5 truncate text-sm font-bold text-slate-800">{formatMoney(monthlyPayroll)}</p>
          <p className="text-xs font-medium text-blue-600">Run payroll →</p>
        </Link>
      </section>

      {/* Module grid */}
      <FeedCard title="All HRMS tools">
        <div className="grid grid-cols-3 gap-2">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 py-3 transition active:scale-95">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${m.tone}`}>
                <Icon name={m.icon} className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-medium text-slate-600">{m.label}</span>
            </Link>
          ))}
        </div>
      </FeedCard>

      {/* Latest notices */}
      {posts.length > 0 && (
        <FeedCard title="Latest notices" href="/posts" linkLabel="All">
          <ul className="divide-y divide-slate-100">
            {posts.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon name="announcement" className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.pinned && "📌 "}{p.title}</p>
                  <p className="line-clamp-1 text-xs text-slate-500">{p.body}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">{p.date}</span>
              </li>
            ))}
          </ul>
        </FeedCard>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, icon, tone = "text-blue-600" }: { label: string; value: string; sub: string; icon: IconName; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <Icon name={icon} className={`mx-auto h-4 w-4 ${tone}`} />
      <p className="mt-1 text-xl font-bold leading-none text-slate-900">{value}</p>
      <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{sub}</p>
      <p className="mt-0.5 text-[10px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function FeedCard({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {href && <Link href={href} className="text-xs font-semibold text-blue-600">{linkLabel ?? "View"}</Link>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-slate-400">{text}</p>;
}
