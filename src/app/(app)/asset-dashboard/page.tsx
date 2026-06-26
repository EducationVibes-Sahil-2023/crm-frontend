"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { assetsApi, formatMoney, STATUS_META, timeAgo, type Asset } from "@/lib/assets";
import { depreciate, loadDepreciation, loadMaintenance, maintenanceStatus, warrantyState } from "@/lib/assetSystem";

const MODULES: { href: string; icon: IconName; title: string; desc: string; grad: string }[] = [
  { href: "/asset-management", icon: "asset", title: "Asset Register", desc: "All assets, intake & verification workflow", grad: "from-blue-500 to-indigo-600" },
  { href: "/asset-assignments", icon: "briefcase", title: "Assignments", desc: "Who holds what, custody & handover", grad: "from-violet-500 to-purple-600" },
  { href: "/asset-maintenance", icon: "settings", title: "Maintenance", desc: "Schedule services, log repairs & costs", grad: "from-amber-500 to-orange-600" },
  { href: "/asset-warranty", icon: "shield", title: "Warranty & AMC", desc: "Track expiries & renewals", grad: "from-emerald-500 to-teal-600" },
  { href: "/asset-depreciation", icon: "trendUp", title: "Depreciation", desc: "Book value & schedules", grad: "from-rose-500 to-pink-600" },
  { href: "/asset-audit", icon: "activity", title: "Audit Log", desc: "Recent changes across all assets", grad: "from-slate-500 to-slate-700" },
  { href: "/inventory", icon: "inventory", title: "Inventory", desc: "Consumables & stock movements", grad: "from-cyan-500 to-sky-600" },
  { href: "/vendors", icon: "briefcase", title: "Vendors", desc: "Suppliers & service partners", grad: "from-fuchsia-500 to-purple-600" },
];

export default function AssetDashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dep = useMemo(() => loadDepreciation(), []);
  const [maintCount, setMaintCount] = useState({ open: 0, overdue: 0 });

  const load = useCallback(async () => {
    try {
      setAssets(await assetsApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const m = loadMaintenance();
      setMaintCount({
        open: m.filter((x) => maintenanceStatus(x) !== "completed").length,
        overdue: m.filter((x) => maintenanceStatus(x) === "overdue").length,
      });
      load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const k = useMemo(() => {
    const total = assets.length;
    const cost = assets.reduce((s, a) => s + Number(a.purchase_cost || 0) + Number(a.repair_cost || 0), 0);
    const book = assets.reduce((s, a) => s + depreciate(a, dep).bookValue, 0);
    const byStatus: Record<string, number> = {};
    assets.forEach((a) => (byStatus[a.status] = (byStatus[a.status] || 0) + 1));
    const byCat: Record<string, number> = {};
    assets.forEach((a) => { const c = a.category || "Uncategorized"; byCat[c] = (byCat[c] || 0) + 1; });
    const warranties = { valid: 0, expiring: 0, expired: 0, none: 0 };
    assets.forEach((a) => (warranties[warrantyState(a)] += 1));
    const assigned = assets.filter((a) => (a.owner_name || "").trim()).length;
    return { total, cost, book, byStatus, byCat, warranties, assigned };
  }, [assets, dep]);

  const recent = useMemo(
    () => [...assets].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 6),
    [assets],
  );
  const expiringList = useMemo(
    () => assets.filter((a) => ["expiring", "expired"].includes(warrantyState(a))).slice(0, 5),
    [assets],
  );
  const catRows = useMemo(() => Object.entries(k.byCat).sort((a, b) => b[1] - a[1]).slice(0, 6), [k.byCat]);
  const catMax = Math.max(1, ...catRows.map(([, n]) => n));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white shadow-sm">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%),radial-gradient(circle_at_88%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="asset" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Asset Management</h1>
              <p className="mt-1 max-w-lg text-sm text-blue-100">A complete, automated lifecycle system — intake, assignment, maintenance, warranty, depreciation and audit.</p>
            </div>
          </div>
          <Link href="/asset-management" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
            <Icon name="plus" className="h-4 w-4" /> New Asset
          </Link>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat label="Total assets" value={loading ? "…" : k.total} />
          <HeroStat label="Total cost" value={loading ? "…" : formatMoney(k.cost)} />
          <HeroStat label="Book value" value={loading ? "…" : formatMoney(k.book)} />
          <HeroStat label="Assigned" value={loading ? "…" : `${k.assigned}/${k.total}`} />
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={load} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Retry</button>
        </div>
      )}

      {/* Alert strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AlertCard icon="shield" tone="amber" title="Warranty expiring" value={k.warranties.expiring} sub="within 60 days" href="/asset-warranty" />
        <AlertCard icon="shield" tone="rose" title="Warranty expired" value={k.warranties.expired} sub="needs renewal / AMC" href="/asset-warranty" />
        <AlertCard icon="settings" tone="blue" title="Open maintenance" value={maintCount.open} sub={`${maintCount.overdue} overdue`} href="/asset-maintenance" />
      </div>

      {/* Modules */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Modules</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white ${m.grad}`}><Icon name={m.icon} className="h-5 w-5" /></span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-blue-700">{m.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Breakdown + lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* By status */}
        <Panel title="By status">
          <div className="space-y-2.5">
            {Object.keys(STATUS_META).map((s) => {
              const meta = STATUS_META[s as keyof typeof STATUS_META];
              const n = k.byStatus[s] || 0;
              const pct = k.total ? Math.round((n / k.total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600"><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span>
                    <span className="font-semibold text-slate-700">{n}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* By category */}
        <Panel title="By category">
          {catRows.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {catRows.map(([c, n]) => (
                <div key={c}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="truncate text-slate-600">{c}</span><span className="font-semibold text-slate-700">{n}</span></div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(n / catMax) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Warranty expiries */}
        <Panel title="Warranty attention" href="/asset-warranty">
          {expiringList.length === 0 ? <Empty label="All warranties healthy" /> : (
            <ul className="space-y-2">
              {expiringList.map((a) => {
                const ws = warrantyState(a);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{a.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ws === "expired" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{a.warranty_expiry}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Recent activity */}
      <Panel title="Recently updated" href="/asset-audit">
        {recent.length === 0 ? <Empty /> : (
          <div className="divide-y divide-slate-100">
            {recent.map((a) => {
              const meta = STATUS_META[a.status];
              return (
                <Link key={a.id} href="/asset-management" className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon name="asset" className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.tag || "—"} · {a.owner_name || "Unassigned"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{timeAgo(a.updated_at)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

function AlertCard({ icon, tone, title, value, sub, href }: { icon: IconName; tone: "amber" | "rose" | "blue"; title: string; value: number; sub: string; href: string }) {
  const map = { amber: "bg-amber-100 text-amber-600", rose: "bg-rose-100 text-rose-600", blue: "bg-blue-100 text-blue-600" } as const;
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${map[tone]}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
        <p className="text-xs font-medium text-slate-600">{title}</p>
        <p className="text-[11px] text-slate-400">{sub}</p>
      </div>
    </Link>
  );
}

function Panel({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {href && <Link href={href} className="text-xs font-medium text-blue-600 hover:underline">View all</Link>}
      </div>
      {children}
    </div>
  );
}

function Empty({ label = "No data yet" }: { label?: string }) {
  return <p className="py-6 text-center text-sm text-slate-400">{label}</p>;
}
