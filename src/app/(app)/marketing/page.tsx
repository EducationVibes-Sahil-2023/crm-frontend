"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import {
  CHANNELS,
  CHANNEL_META,
  STATUS_META,
  loadMarketing,
  relativeTime,
  subscribeMarketing,
  type MarketingData,
} from "@/lib/marketing";

export default function MarketingOverviewPage() {
  const [data, setData] = useState<MarketingData>({ campaigns: [], templates: [], audiences: [] });

  useEffect(() => {
    const refresh = () => setData(loadMarketing());
    refresh();
    return subscribeMarketing(refresh);
  }, []);

  const totals = useMemo(() => {
    const cs = data.campaigns;
    const recipients = cs.reduce((s, c) => s + c.stats.recipients, 0);
    const delivered = cs.reduce((s, c) => s + c.stats.delivered, 0);
    const opened = cs.reduce((s, c) => s + c.stats.opened, 0);
    return {
      campaigns: cs.length,
      recipients,
      delivered,
      openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
      audiences: data.audiences.length,
    };
  }, [data]);

  const recent = [...data.campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-7">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="announcement" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Marketing</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                Reach your leads across WhatsApp, Email and SMS. Build audiences, save templates, and track every campaign.
              </p>
            </div>
          </div>
          <Link href="/marketing/audiences" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
            <Icon name="users" className="h-4 w-4" /> Audiences
          </Link>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Campaigns" value={String(totals.campaigns)} />
          <Stat label="Recipients" value={totals.recipients.toLocaleString("en-IN")} />
          <Stat label="Delivered" value={totals.delivered.toLocaleString("en-IN")} />
          <Stat label="Open rate" value={`${totals.openRate}%`} />
          <Stat label="Audiences" value={String(totals.audiences)} />
        </div>
      </div>

      {/* Channels */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CHANNELS.map((ch) => {
          const meta = CHANNEL_META[ch];
          const list = data.campaigns.filter((c) => c.channel === ch);
          const sent = list.filter((c) => c.status === "sent").length;
          return (
            <Link
              key={ch}
              href={`/marketing/${ch}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.badge}`}>
                  <Icon name={meta.icon} className="h-5 w-5" />
                </span>
                <Icon name="arrowLeft" className="h-4 w-4 rotate-180 text-slate-300 transition group-hover:text-blue-500" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">{meta.label}</p>
              <p className="mt-1 text-sm text-slate-500">
                {list.length} campaign{list.length === 1 ? "" : "s"} · {sent} sent
              </p>
            </Link>
          );
        })}
      </div>

      {/* Recent campaigns */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-slate-800">Recent campaigns</p>
          <Link href="/marketing/templates" className="text-sm font-semibold text-blue-600 hover:underline">Templates</Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No campaigns yet</p>
            <p className="mt-1 text-sm text-slate-400">Pick a channel above to launch your first campaign.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((c) => {
              const meta = CHANNEL_META[c.channel];
              const s = STATUS_META[c.status];
              return (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.badge}`}>
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{meta.short} · {relativeTime(c.updatedAt)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
                  </span>
                  <span className="hidden w-24 text-right text-xs text-slate-500 sm:block">
                    {c.stats.delivered.toLocaleString("en-IN")} delivered
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}
