"use client";

import { useEffect, useMemo, useState } from "react";
import { hydrateLeads, loadIntakeLeads, subscribeLeads, type IntakeLead } from "@/lib/leadStore";
import { colorDot, useSetupOptions, type SetupOption } from "@/lib/setup";
import { exportCsv } from "@/lib/reportUtils";
import { BarChart, Card, Donut, MiniTable, RankBars, ReportHeader, StatCard } from "@/components/ReportKit";

type ReportLead = {
  name: string;
  company: string;
  city: string;
  state: string;
  status: string;
  source: string;
  type: string;
  assignedTo: string;
};

// Palette used for values that have no configured colour of their own.
const PALETTE = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500",
  "bg-cyan-500", "bg-indigo-500", "bg-teal-500", "bg-pink-500", "bg-sky-500",
];

// Statuses are admin-defined (Admin Setup → Status), so the report can't assume
// any particular names. Won/lost are recognised by what the name *means*, which
// is the only thing that generalises across workspaces.
const WON_RE = /\b(won|converted|closed[\s-]?won|admitted|enrolled|joined|success(ful)?|deal\s?closed)\b/i;
const LOST_RE = /\b(lost|closed[\s-]?lost|drop(ped)?|reject(ed)?|cancel(l?ed)?|not\s?interested|junk|dead|invalid)\b/i;

const NOT_SET = "Not set";

/** Empty values arrive as "—" from the store; label them so charts read sensibly. */
function label(v: string): string {
  const s = (v ?? "").trim();
  return s === "" || s === "—" ? NOT_SET : s;
}

function intakeToReport(l: IntakeLead): ReportLead {
  return {
    name: l.name, company: l.company, city: l.city, state: l.state,
    status: label(l.status), source: label(l.source), type: label(l.type),
    assignedTo: l.assignedTo?.trim() && l.assignedTo !== "—" ? l.assignedTo : "Unassigned",
  };
}

/**
 * Order a set of values by the workspace's configured list first, then append
 * anything present in the data that isn't configured (renamed or legacy values)
 * — so no lead can be invisible just because its status was renamed.
 */
function orderedValues(configured: SetupOption[], present: string[]): string[] {
  const names = configured.map((o) => o.name);
  const extra = present.filter((v) => !names.includes(v)).sort();
  return [...names, ...extra];
}

/** A value's configured colour, falling back to a stable palette slot. */
function colorFor(configured: SetupOption[], value: string, index: number): string {
  const opt = configured.find((o) => o.name === value);
  if (opt && !opt.color.startsWith("#")) return colorDot(opt.color);
  return PALETTE[index % PALETTE.length];
}

export default function LeadsReportPage() {
  const [leads, setLeads] = useState<ReportLead[] | null>(null);
  const statusOpts = useSetupOptions("status");
  const typeOpts = useSetupOptions("type");
  const sourceOpts = useSetupOptions("source");

  useEffect(() => {
    // Soft-deleted leads live in the same cache (the Leads page keeps them for
    // its trash view) — a report must not count them.
    const merge = () => setLeads(loadIntakeLeads().filter((l) => !l.deleted).map(intakeToReport));
    merge();
    // Deep-linking straight to this page can beat the sign-in hydration, and
    // hydrateLeads() is a no-op once the cache is warm.
    void hydrateLeads();
    return subscribeLeads(merge);
  }, []);

  const r = useMemo(() => {
    if (!leads) return null;
    const total = leads.length;
    const count = (pred: (l: ReportLead) => boolean) => leads.filter(pred).length;

    const won = count((l) => WON_RE.test(l.status));
    const lost = count((l) => LOST_RE.test(l.status));
    const active = total - won - lost;
    const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

    const tally = (key: keyof ReportLead) => {
      const m: Record<string, number> = {};
      leads.forEach((l) => (m[l[key]] = (m[l[key]] || 0) + 1));
      return m;
    };

    const statusTally = tally("status");
    const statusOrder = orderedValues(statusOpts, Object.keys(statusTally));
    const statuses = statusOrder
      // Keep every configured status (a zero is meaningful in a funnel) but drop
      // stale values that no lead uses any more.
      .filter((s) => statusOpts.some((o) => o.name === s) || statusTally[s])
      .map((s, i) => ({ label: s, value: statusTally[s] ?? 0, color: colorFor(statusOpts, s, i) }));

    // The funnel is the pipeline on the way to a win — closed-lost isn't a stage.
    const funnel = statuses.filter((s) => !LOST_RE.test(s.label)).map((s) => ({ label: s.label, value: s.value }));

    const typeTally = tally("type");
    const types = orderedValues(typeOpts, Object.keys(typeTally))
      .filter((t) => typeTally[t])
      .map((t, i) => ({ label: t, value: typeTally[t], color: colorFor(typeOpts, t, i) }));

    const sourceTally = tally("source");
    const sources = orderedValues(sourceOpts, Object.keys(sourceTally))
      .filter((s) => sourceTally[s])
      .sort((a, b) => sourceTally[b] - sourceTally[a])
      .map((s, i) => ({ label: s, value: sourceTally[s], color: colorFor(sourceOpts, s, i) }));

    const cities = Object.entries(tally("city"))
      .filter(([c]) => label(c) !== NOT_SET)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([l, value]) => ({ label: l, value }));

    // Counsellor leaderboard: assigned count + won count.
    const byCounsellor: Record<string, { total: number; won: number }> = {};
    leads.forEach((l) => {
      const c = (byCounsellor[l.assignedTo] ||= { total: 0, won: 0 });
      c.total++;
      if (WON_RE.test(l.status)) c.won++;
    });
    const leaderboard = Object.entries(byCounsellor)
      .sort((a, b) => b[1].won - a[1].won || b[1].total - a[1].total)
      .slice(0, 8)
      .map(([name, v]) => ({ name, ...v }));

    return { total, won, active, winRate, funnel, sources, types, statuses, cities, leaderboard };
  }, [leads, statusOpts, typeOpts, sourceOpts]);

  function onExport() {
    if (!leads) return;
    exportCsv(
      "leads-report",
      leads.map((l) => ({
        Name: l.name, Company: l.company, City: l.city, State: l.state,
        Status: l.status, Source: l.source, Type: l.type, "Assigned To": l.assignedTo,
      })),
    );
  }

  if (!r) {
    return (
      <div className="space-y-6">
        <ReportHeader title="Leads Report" subtitle="Funnel, sources and counsellor performance." />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportHeader title="Leads Report" subtitle="Funnel, sources and counsellor performance." onExport={onExport} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="leads" label="Total leads" value={r.total} sub="Excludes trash" wrap="bg-blue-100 text-blue-600" />
        <StatCard icon="activity" label="Active (open)" value={r.active} wrap="bg-amber-100 text-amber-600" />
        <StatCard icon="win" label="Won" value={r.won} wrap="bg-emerald-100 text-emerald-600" />
        <StatCard icon="deals" label="Win rate" value={`${r.winRate.toFixed(0)}%`} sub="Won ÷ closed" wrap="bg-violet-100 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Pipeline funnel" subtitle="Leads by stage" className="lg:col-span-2">
          <BarChart data={r.funnel} color="bg-blue-500" />
        </Card>
        <Card title="By type" subtitle="Your lead types">
          <Donut segments={r.types} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="By source" subtitle="Where leads come from">
          <Donut segments={r.sources} />
        </Card>
        <Card title="By status">
          <RankBars rows={r.statuses} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top cities" subtitle="Lead volume by city">
          <RankBars rows={r.cities} />
        </Card>
        <Card title="Counsellor leaderboard" subtitle="Assigned leads & wins">
          <MiniTable
            columns={[
              { key: "name", label: "Counsellor" },
              { key: "total", label: "Assigned", align: "right" },
              { key: "won", label: "Won", align: "right" },
            ]}
            rows={r.leaderboard.map((c) => ({ name: c.name, total: c.total, won: c.won }))}
          />
        </Card>
      </div>
    </div>
  );
}
