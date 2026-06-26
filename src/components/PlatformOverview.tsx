"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { PLANS, PLAN_PRICE, PLAN_STYLE, STATUS_STYLE, fmtMoney, loadTenants, mrr, planCounts, type Tenant } from "@/lib/tenants";
import { loadDemos, demoWhen, type Demo } from "@/lib/demos";

const PLAN_HEX: Record<string, string> = { Free: "#94a3b8", Starter: "#0ea5e9", Pro: "#2563eb", Enterprise: "#7c3aed" };

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export default function PlatformOverview() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);

  useEffect(() => {
    const t = setTimeout(() => { setTenants(loadTenants()); setDemos(loadDemos()); setLoading(false); }, 400);
    return () => clearTimeout(t);
  }, []);

  const stats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((t) => t.status === "Active").length,
    trial: tenants.filter((t) => t.status === "Trial").length,
    suspended: tenants.filter((t) => t.status === "Suspended").length,
    users: tenants.reduce((s, t) => s + t.users, 0),
    storage: tenants.reduce((s, t) => s + t.storageGb, 0),
    mrr: mrr(tenants),
  }), [tenants]);
  const counts = useMemo(() => planCounts(tenants), [tenants]);
  const recent = useMemo(() => [...tenants].slice(0, 5), [tenants]);
  const maxPlan = Math.max(1, ...PLANS.map((p) => counts[p]));

  // Per-plan client count + monthly recurring revenue (active workspaces only).
  const planStats = useMemo(() => PLANS.map((p) => ({
    plan: p,
    count: counts[p],
    revenue: tenants.filter((t) => t.plan === p && t.status === "Active").length * PLAN_PRICE[p],
  })), [tenants, counts]);

  // Status split for the donut, with any non-standard statuses bucketed as "Other".
  const statusSplit = useMemo(() => {
    const other = stats.total - stats.active - stats.trial - stats.suspended;
    return [
      { label: "Active", value: stats.active, color: "#10b981" },
      { label: "On trial", value: stats.trial, color: "#f59e0b" },
      { label: "Suspended", value: stats.suspended, color: "#f43f5e" },
      ...(other > 0 ? [{ label: "Other", value: other, color: "#94a3b8" }] : []),
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-500 p-7 text-white shadow-lg shadow-indigo-500/25">
        <div className="nx-blob pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="nx-blob pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-400/30 blur-3xl" style={{ animationDelay: "3s" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"><Icon name="shield" className="h-7 w-7" /></div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-white/20"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> All systems operational</span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Platform Overview</h1>
              <p className="mt-0.5 text-sm text-indigo-100">Manage all client workspaces, databases & billing in one place.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/clients" className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-lg shadow-indigo-900/20 transition hover:-translate-y-0.5"><Icon name="users" className="h-4 w-4" /> Manage Clients</Link>
            <Link href="/admin/settings" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"><Icon name="settings" className="h-4 w-4" /> Settings</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="briefcase" label="Total clients" value={stats.total} tone="blue" loading={loading} />
        <Stat icon="check" label="Active" value={stats.active} tone="emerald" loading={loading} />
        <Stat icon="clock" label="On trial" value={stats.trial} tone="amber" loading={loading} />
        <Stat icon="revenue" label="MRR" value={fmtMoney(stats.mrr)} tone="violet" loading={loading} />
        <Stat icon="users" label="Total users" value={stats.users.toLocaleString()} tone="blue" loading={loading} />
        <Stat icon="asset" label="Databases" value={stats.total} tone="slate" loading={loading} />
        <Stat icon="inventory" label="Storage used" value={`${stats.storage} GB`} tone="amber" loading={loading} />
        <Stat icon="alert" label="Suspended" value={stats.suspended} tone="rose" loading={loading} />
      </div>

      {/* Charts: client-status donut + plan distribution & revenue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Status donut */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">Client status</p>
          <p className="text-xs text-slate-400">Across all workspaces</p>
          {loading ? (
            <div className="mt-5 flex justify-center"><Skeleton className="h-[168px] w-[168px] rounded-full" /></div>
          ) : (
            <>
              <div className="mt-5"><Donut data={statusSplit} total={stats.total} /></div>
              <div className="mt-6 space-y-2.5">
                {statusSplit.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="flex-1 text-slate-600">{s.label}</span>
                    <span className="font-semibold text-slate-900">{s.value}</span>
                    <span className="w-9 text-right text-xs text-slate-400">{pct(s.value, stats.total)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Plan distribution & revenue */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Plans &amp; revenue</p>
              <p className="text-xs text-slate-400">Clients per plan and monthly recurring revenue</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-extrabold tracking-tight text-slate-900">{loading ? "—" : fmtMoney(stats.mrr)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total MRR</p>
            </div>
          </div>

          {loading ? <Skeleton className="mt-5 h-44 w-full" /> : (
            <>
              {/* Stacked distribution bar */}
              <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
                {PLANS.map((p) => counts[p] > 0 ? (
                  <div key={p} title={`${p}: ${counts[p]}`} style={{ width: `${pct(counts[p], stats.total)}%`, backgroundColor: PLAN_HEX[p] }} />
                ) : null)}
              </div>
              {/* Per-plan rows */}
              <div className="mt-6 space-y-3.5">
                {planStats.map((ps) => (
                  <div key={ps.plan} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: PLAN_HEX[ps.plan] }}>{ps.count}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{ps.plan}</span>
                        <span className="text-slate-500"><span className="font-semibold text-slate-700">{fmtMoney(ps.revenue)}</span>/mo</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(ps.count / maxPlan) * 100}%`, backgroundColor: PLAN_HEX[ps.plan] }} />
                      </div>
                    </div>
                    <span className="w-9 text-right text-xs font-medium text-slate-400">{pct(ps.count, stats.total)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent clients + upcoming demos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon name="briefcase" className="h-4 w-4 text-indigo-600" /> Recent clients</p>
            <Link href="/admin/clients" className="text-xs font-semibold text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-5 py-3"><Skeleton className="h-9 w-9 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-2.5 w-24" /></div></div>)
            ) : recent.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No clients yet.</p>
            ) : recent.map((t) => (
              <Link key={t.id} href="/admin/clients" className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white">{t.company.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{t.company}</p>
                  <p className="truncate font-mono text-[11px] text-slate-400">{t.subdomain}.crm-cloud.app</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PLAN_STYLE[t.plan]}`}>{t.plan}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[t.status]}`}>{t.status}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Demos booked from the landing page — with Google Meet links */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon name="calendar" className="h-4 w-4 text-indigo-600" /> Upcoming demos</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{demos.filter((d) => d.status !== "cancelled").length} booked</span>
          </div>
          {loading ? (
            <div className="space-y-2 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : demos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">No demos booked yet. They show up here when visitors book one from the landing page.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {demos.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">{d.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{d.name} <span className="font-normal text-slate-400">· {d.company}</span></p>
                    <p className="truncate text-[11px] text-slate-400">{demoWhen(d.scheduledAt)} · {d.email}</p>
                  </div>
                  <a href={d.meetLink} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100"><Icon name="videoCam" className="h-3.5 w-3.5" /> Join</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Lightweight SVG donut — no chart lib. Segments are stroked arcs around a ring.
function Donut({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const size = 168, stroke = 18, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {total > 0 && data.filter((d) => d.value > 0).map((d) => {
          const len = (d.value / total) * c;
          const seg = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />
          );
          acc += len;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-extrabold tracking-tight text-slate-900">{total}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Clients</p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone, loading }: { icon: IconName; label: string; value: number | string; tone: "blue" | "emerald" | "amber" | "violet" | "rose" | "slate"; loading: boolean }) {
  const grad: Record<string, string> = {
    blue: "from-blue-500 to-indigo-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    violet: "from-violet-500 to-fuchsia-600",
    rose: "from-rose-500 to-red-600",
    slate: "from-slate-600 to-slate-800",
  };
  const glow: Record<string, string> = {
    blue: "shadow-blue-500/20", emerald: "shadow-emerald-500/20", amber: "shadow-amber-500/20",
    violet: "shadow-violet-500/20", rose: "shadow-rose-500/20", slate: "shadow-slate-500/20",
  };
  return (
    <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <span className={`absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${grad[tone]} opacity-[0.07] transition group-hover:scale-150`} />
      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${grad[tone]} ${glow[tone]}`}><Icon name={icon} className="h-[22px] w-[22px]" /></span>
      <div className="relative min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {loading ? <Skeleton className="mt-1 h-6 w-12" /> : <p className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>}
      </div>
    </div>
  );
}
