"use client";

import { useEffect, useMemo, useState } from "react";
import { loadIntakeLeads, subscribeLeads, type IntakeLead } from "@/lib/leadStore";
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

// Status order used by the funnel/breakdown charts.
const STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

const STATUS_COLOR: Record<string, string> = {
  New: "bg-sky-500", Contacted: "bg-amber-500", Qualified: "bg-indigo-500", Proposal: "bg-violet-500", Won: "bg-emerald-500", Lost: "bg-rose-500",
};
const TYPE_COLOR: Record<string, string> = { Hot: "bg-rose-500", Warm: "bg-amber-500", Cold: "bg-sky-500" };
const SOURCE_COLOR = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
const FUNNEL = ["New", "Contacted", "Qualified", "Proposal", "Won"];

function intakeToReport(l: IntakeLead): ReportLead {
  return {
    name: l.name, company: l.company, city: l.city, state: l.state,
    status: l.status, source: l.source, type: l.type,
    assignedTo: l.assignedTo || "Unassigned",
  };
}

export default function LeadsReportPage() {
  const [leads, setLeads] = useState<ReportLead[] | null>(null);

  useEffect(() => {
    const merge = () => setLeads([...loadIntakeLeads().map(intakeToReport)]);
    merge();
    return subscribeLeads(merge);
  }, []);

  const r = useMemo(() => {
    if (!leads) return null;
    const total = leads.length;
    const count = (pred: (l: ReportLead) => boolean) => leads.filter(pred).length;

    const won = count((l) => l.status === "Won");
    const lost = count((l) => l.status === "Lost");
    const active = total - won - lost;
    const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

    const funnel = FUNNEL.map((s) => ({ label: s, value: count((l) => l.status === s) }));

    const tally = (key: keyof ReportLead) => {
      const m: Record<string, number> = {};
      leads.forEach((l) => (m[l[key]] = (m[l[key]] || 0) + 1));
      return m;
    };

    const sources = Object.entries(tally("source"))
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: SOURCE_COLOR[i % SOURCE_COLOR.length] }));

    const types = Object.entries(tally("type")).map(([label, value]) => ({
      label, value, color: TYPE_COLOR[label] ?? "bg-slate-400",
    }));

    const statuses = STATUSES.map((s) => ({ label: s, value: count((l) => l.status === s), color: STATUS_COLOR[s] }));

    const cities = Object.entries(tally("city"))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));

    // Counsellor leaderboard: assigned count + won count.
    const byCounsellor: Record<string, { total: number; won: number }> = {};
    leads.forEach((l) => {
      const c = (byCounsellor[l.assignedTo] ||= { total: 0, won: 0 });
      c.total++;
      if (l.status === "Won") c.won++;
    });
    const leaderboard = Object.entries(byCounsellor)
      .sort((a, b) => b[1].won - a[1].won || b[1].total - a[1].total)
      .slice(0, 8)
      .map(([name, v]) => ({ name, ...v }));

    return { total, won, active, winRate, funnel, sources, types, statuses, cities, leaderboard };
  }, [leads]);

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
        <StatCard icon="leads" label="Total leads" value={r.total} wrap="bg-blue-100 text-blue-600" />
        <StatCard icon="activity" label="Active (open)" value={r.active} wrap="bg-amber-100 text-amber-600" />
        <StatCard icon="win" label="Won" value={r.won} wrap="bg-emerald-100 text-emerald-600" />
        <StatCard icon="deals" label="Win rate" value={`${r.winRate.toFixed(0)}%`} sub="Won ÷ closed" wrap="bg-violet-100 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Pipeline funnel" subtitle="Leads by stage" className="lg:col-span-2">
          <BarChart data={r.funnel} color="bg-blue-500" />
        </Card>
        <Card title="By type" subtitle="Hot / Warm / Cold">
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
