"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { loadProfile } from "@/lib/profile";
import {
  DIRECTION_META,
  clockTime,
  formatDuration,
  initials,
  leadContacts,
  relativeTime,
  trackedCalls,
  type Call,
  type CallDirection,
  type LeadContact,
  type TrackedCall,
} from "@/lib/callTracker";
import { callsApi } from "@/lib/callsApi";

type DirFilter = "all" | CallDirection;
type Tab = "calls" | "leads";

const DIR_OPTIONS: SelectOption[] = [
  { value: "all", label: "All calls" },
  { value: "incoming", label: "Incoming", dotClass: "bg-emerald-500" },
  { value: "outgoing", label: "Outgoing", dotClass: "bg-blue-500" },
  { value: "missed", label: "Missed", dotClass: "bg-rose-500" },
];

export default function CallTrackerPage() {
  const toast = useToast();
  const [device, setDevice] = useState("");
  const [hasPhone, setHasPhone] = useState(true);
  const [calls, setCalls] = useState<Call[]>([]);
  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [lastSync, setLastSyncState] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("calls");
  const [dir, setDir] = useState<DirFilter>("all");
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    const dev = p.phone || "";
    setDevice(dev);
    setHasPhone(!!dev && dev.trim() !== "" && dev !== "—");
    setContacts(leadContacts());
    // Real calls from the database (empty until the device uploads any).
    callsApi
      .list()
      .then((rows) => {
        setCalls(rows);
        setLastSyncState(new Date().toISOString());
      })
      .catch(() => setCalls([]));
  }, []);

  const tracked = useMemo(() => trackedCalls(calls, contacts), [calls, contacts]);
  const ignored = calls.length - tracked.length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracked
      .filter((c) => dir === "all" || c.direction === dir)
      .filter(
        (c) =>
          !q ||
          c.lead.name.toLowerCase().includes(q) ||
          c.lead.company.toLowerCase().includes(q) ||
          c.number.includes(q),
      );
  }, [tracked, dir, query]);

  const stats = useMemo(() => {
    const dur = tracked.reduce((s, c) => s + c.durationSec, 0);
    return {
      total: tracked.length,
      incoming: tracked.filter((c) => c.direction === "incoming").length,
      outgoing: tracked.filter((c) => c.direction === "outgoing").length,
      missed: tracked.filter((c) => c.direction === "missed").length,
      leads: new Set(tracked.map((c) => c.lead.id)).size,
      duration: dur,
    };
  }, [tracked]);

  // Group tracked calls by matched lead for the "Lead Activity" tab.
  const byLead = useMemo(() => {
    const map = new Map<string, { lead: LeadContact; calls: TrackedCall[] }>();
    for (const c of visible) {
      if (!map.has(c.lead.id)) map.set(c.lead.id, { lead: c.lead, calls: [] });
      map.get(c.lead.id)!.calls.push(c);
    }
    return Array.from(map.values()).sort((a, b) => b.calls[0].at.localeCompare(a.calls[0].at));
  }, [visible]);

  async function sync() {
    setSyncing(true);
    try {
      const rows = await callsApi.list();
      setCalls(rows);
      setLastSyncState(new Date().toISOString());
      const matched = trackedCalls(rows, contacts).length;
      toast.success("Calls refreshed", `${rows.length} call${rows.length === 1 ? "" : "s"} · ${matched} matched a lead.`);
    } catch (e) {
      toast.error("Couldn't refresh", (e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="call" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Call Tracker</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                Calls synced from your phone, automatically matched to CRM leads on their primary or alternative number.
              </p>
            </div>
          </div>
          <button
            onClick={sync}
            disabled={syncing || !hasPhone}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-60"
          >
            <Icon name="refresh" className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync calls"}
          </button>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Tracked calls" value={String(stats.total)} />
          <Stat label="Incoming" value={String(stats.incoming)} />
          <Stat label="Outgoing" value={String(stats.outgoing)} />
          <Stat label="Missed" value={String(stats.missed)} />
          <Stat label="Leads reached" value={String(stats.leads)} />
          <Stat label="Talk time" value={formatDuration(stats.duration)} />
        </div>
      </div>

      {/* Phone-number check banner */}
      {!hasPhone && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Icon name="alert" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">Add your phone number to start tracking</p>
              <p className="text-xs text-amber-700">
                We match device calls to your account by your number. Add it to your profile to enable call sync.
              </p>
            </div>
          </div>
          <Link href="/profile" className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-amber-700">
            Add number
          </Link>
        </div>
      )}

      {/* Sync status strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="phone" className="h-3.5 w-3.5 text-slate-400" />
          Device: <b className="text-slate-700">{device || "—"}</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="refresh" className="h-3.5 w-3.5 text-slate-400" />
          Last refresh: <b className="text-slate-700">{lastSync ? relativeTime(lastSync) : "never"}</b>
        </span>
        {ignored > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-slate-400">
            {ignored} non-lead call{ignored === 1 ? "" : "s"} ignored
          </span>
        )}
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <TabButton active={tab === "calls"} onClick={() => setTab("calls")} icon="call" label="Call Activity" />
          <TabButton active={tab === "leads"} onClick={() => setTab("leads")} icon="leads" label="Lead Activity" />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lead or number…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <SearchableSelect value={dir} onChange={(v) => setDir(v as DirFilter)} options={DIR_OPTIONS} className="w-40" />
        </div>
      </div>

      {/* Content */}
      {visible.length === 0 ? (
        <EmptyState hasPhone={hasPhone} />
      ) : tab === "calls" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {visible.map((c, i) => (
            <CallRow key={c.id} call={c} divider={i > 0} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {byLead.map(({ lead, calls: lc }) => (
            <LeadActivityCard key={lead.id} lead={lead} calls={lc} />
          ))}
        </div>
      )}
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

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: Parameters<typeof Icon>[0]["name"]; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
        active ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );
}

function DirectionIcon({ direction }: { direction: CallDirection }) {
  const m = DIRECTION_META[direction];
  // Arrow direction conveys in/out; missed uses a distinct rose tint + X.
  const rotate = direction === "incoming" ? "rotate-[135deg]" : direction === "outgoing" ? "-rotate-45" : "";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${m.badge}`}>
      {direction === "missed" ? <Icon name="close" className="h-4 w-4" /> : <Icon name="arrowLeft" className={`h-4 w-4 ${rotate}`} />}
    </span>
  );
}

function SideBadge({ side }: { side: "primary" | "alternative" }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        side === "primary" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
      }`}
    >
      {side === "primary" ? "Primary" : "Alt. number"}
    </span>
  );
}

function CallRow({ call: c, divider }: { call: TrackedCall; divider: boolean }) {
  const m = DIRECTION_META[c.direction];
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${divider ? "border-t border-slate-100" : ""}`}>
      <DirectionIcon direction={c.direction} />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
        {initials(c.lead.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{c.lead.name}</p>
          <SideBadge side={c.side} />
        </div>
        <p className="truncate text-xs text-slate-400">
          {c.lead.company} · {c.number}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
          {m.label}
        </span>
      </div>
      <div className="w-20 shrink-0 text-right">
        <p className="text-xs font-medium text-slate-600">{c.direction === "missed" ? "—" : formatDuration(c.durationSec)}</p>
        <p className="text-[11px] text-slate-400">{relativeTime(c.at)}</p>
      </div>
    </div>
  );
}

function LeadActivityCard({ lead, calls }: { lead: LeadContact; calls: TrackedCall[] }) {
  const total = calls.reduce((s, c) => s + c.durationSec, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
          {initials(lead.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{lead.name}</p>
          <p className="truncate text-xs text-slate-400">
            {lead.company} · {lead.primary}
            {lead.alternative ? ` / ${lead.alternative}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-800">{calls.length} calls</p>
          <p className="text-[11px] text-slate-400">{formatDuration(total)} talk time</p>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {calls.map((c) => {
          const m = DIRECTION_META[c.direction];
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <DirectionIcon direction={c.direction} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.badge}`}>{m.label}</span>
                  <SideBadge side={c.side} />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {clockTime(c.at)} · {c.number}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600">{c.direction === "missed" ? "Missed" : formatDuration(c.durationSec)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState({ hasPhone }: { hasPhone: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon name="call" className="h-8 w-8" />
      </div>
      <p className="mt-4 text-lg font-semibold text-slate-800">No tracked calls yet</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {hasPhone
          ? "Sync from your phone — only calls to or from a CRM lead's primary or alternative number appear here."
          : "Add your phone number and install the companion app to start syncing calls."}
      </p>
    </div>
  );
}
