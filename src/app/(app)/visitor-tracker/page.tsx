"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";
import { captureLead, makeIntakeLead } from "@/lib/leadStore";
import {
  SOURCES,
  STATUS_META,
  formatDuration,
  initials,
  loadSessions,
  relativeTime,
  saveSessions,
  simulateLive,
  type DeviceKind,
  type VisitorSession,
  type VisitorStatus,
} from "@/lib/visitorTracker";

type StatusFilter = "all" | VisitorStatus;
type SourceFilter = "all" | string;

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All visitors" },
  ...(Object.keys(STATUS_META) as VisitorStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label, dotClass: STATUS_META[s].dot })),
];
const SOURCE_OPTIONS: SelectOption[] = [{ value: "all", label: "All sources" }, ...SOURCES.map((s) => ({ value: s, label: s }))];

const DEVICE_ICON: Record<DeviceKind, "dashboard" | "phone" | "media"> = {
  Desktop: "dashboard",
  Mobile: "phone",
  Tablet: "media",
};

export default function VisitorTrackerPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [active, setActive] = useState<VisitorSession | null>(null);

  useEffect(() => {
    setSessions(loadSessions());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveSessions(sessions);
  }, [sessions, ready]);

  // Live event stream — a new visitor lands / an active one advances every ~6s.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setSessions((s) => simulateLive(s).slice(0, 60)), 6000);
    return () => window.clearInterval(id);
  }, [live]);

  const stats = useMemo(() => {
    const activeNow = sessions.filter((s) => s.status === "Active").length;
    const converted = sessions.filter((s) => s.status === "Converted").length;
    const avg = sessions.length ? Math.round(sessions.reduce((n, s) => n + s.durationSec, 0) / sessions.length) : 0;
    return { total: sessions.length, activeNow, converted, avg };
  }, [sessions]);

  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) map.set(s.source, (map.get(s.source) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => status === "all" || s.status === status)
      .filter((s) => source === "all" || s.source === source)
      .filter(
        (s) =>
          !q ||
          s.visitorName.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.landing.toLowerCase().includes(q) ||
          s.source.toLowerCase().includes(q),
      )
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }, [sessions, status, source, query]);

  function convert(s: VisitorSession) {
    const name = s.identified ? s.visitorName : `Website Visitor (${s.city})`;
    const lead = makeIntakeLead(
      { name, email: s.email || undefined, phone: s.phone || undefined, city: s.city, state: s.country, source: s.source },
      "Website Form",
    );
    captureLead(lead);
    setSessions((list) => list.map((x) => (x.id === s.id ? { ...x, status: "Converted", convertedLeadId: lead.id } : x)));
    setActive(null);
    toast.success("Converted to lead", `${name} added to Leads from ${s.source}.`);
    logActivity(`Converted website visitor to lead: ${name}`, { category: "lead", target: name });
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="eye" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Visitor Tracker</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                See who&apos;s on your website in real time, where they came from, and turn them into leads.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLive((v) => !v)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
              live ? "bg-white text-blue-700 hover:bg-blue-50" : "bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-white/60"}`} />
            {live ? "Live" : "Paused"}
          </button>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Total visitors" value={String(stats.total)} />
          <Stat label="Active now" value={String(stats.activeNow)} />
          <Stat label="Converted" value={String(stats.converted)} />
          <Stat label="Avg. time" value={formatDuration(stats.avg)} />
        </div>
      </div>

      {/* Source breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Traffic by source</p>
        <div className="flex flex-wrap gap-2">
          {sourceBreakdown.map(([src, n]) => (
            <span key={src} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Icon name="trendUp" className="h-3.5 w-3.5 text-blue-500" />
              {src}
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">{n}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search visitor, city, page…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <SearchableSelect value={source} onChange={setSource} options={SOURCE_OPTIONS} className="w-40" />
          <SearchableSelect value={status} onChange={(v) => setStatus(v as StatusFilter)} options={STATUS_OPTIONS} className="w-44" />
        </div>
      </div>

      {/* Sessions list */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Icon name="eye" className="h-8 w-8" />
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-800">No visitors match</p>
          <p className="mt-1 text-sm text-slate-500">Try a different source, status or search.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:grid">
            <span className="col-span-3">Visitor</span>
            <span className="col-span-2">Source</span>
            <span className="col-span-3">Activity</span>
            <span className="col-span-2">Location</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          {visible.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className={`grid w-full grid-cols-12 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <div className="col-span-12 flex items-center gap-2.5 lg:col-span-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${s.identified ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-slate-300"}`}>
                  {s.identified ? initials(s.visitorName) : "?"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.visitorName}</p>
                  <p className="truncate text-[11px] text-slate-400">{s.browser} · {s.device}</p>
                </div>
              </div>
              <div className="col-span-6 lg:col-span-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s.source}</span>
              </div>
              <div className="col-span-6 lg:col-span-3">
                <p className="truncate text-xs text-slate-600">{s.pages.length} pages · {formatDuration(s.durationSec)}</p>
                <p className="truncate text-[11px] text-slate-400">Landing: {s.landing}</p>
              </div>
              <div className="col-span-6 lg:col-span-2">
                <p className="flex items-center gap-1 text-xs text-slate-600">
                  <Icon name="pin" className="h-3.5 w-3.5 text-slate-400" />
                  {s.city}
                </p>
                <p className="text-[11px] text-slate-400">{relativeTime(s.lastSeen)}</p>
              </div>
              <div className="col-span-6 flex justify-start lg:col-span-2 lg:justify-end">
                <StatusBadge status={s.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {active && <SessionDetail s={active} onClose={() => setActive(null)} onConvert={() => convert(active)} />}
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

function StatusBadge({ status }: { status: VisitorStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "Active" ? "animate-pulse" : ""} ${m.dot}`} />
      {m.label}
    </span>
  );
}

function SessionDetail({ s, onClose, onConvert }: { s: VisitorSession; onClose: () => void; onConvert: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const deviceIcon = DEVICE_ICON[s.device];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${s.identified ? "bg-white/20 ring-2 ring-white/30" : "bg-white/15"}`}>
                {s.identified ? initials(s.visitorName) : "?"}
              </span>
              <div>
                <h2 className="text-lg font-bold">{s.visitorName}</h2>
                <p className="text-xs text-blue-100">{s.source} · {s.city}, {s.country}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <Info icon={deviceIcon} label="Device" value={`${s.device} · ${s.browser}`} />
            <Info icon="clock" label="Time on site" value={formatDuration(s.durationSec)} />
            <Info icon="visitor" label="First seen" value={relativeTime(s.firstSeen)} />
            <Info icon="activity" label="Last activity" value={relativeTime(s.lastSeen)} />
          </div>

          {s.identified && (s.email || s.phone) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Contact</p>
              {s.email && <p className="text-sm text-slate-700">{s.email}</p>}
              {s.phone && <p className="text-sm text-slate-700">{s.phone}</p>}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Page journey</p>
            <ol className="relative space-y-3 pl-1">
              <span className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-slate-200" />
              {s.pages.map((p, i) => (
                <li key={`${p}-${i}`} className="relative flex items-center gap-3">
                  <span className="relative z-10 h-3.5 w-3.5 rounded-full bg-blue-500 ring-4 ring-white" />
                  <span className="text-sm text-slate-700">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          {s.status === "Converted" ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <Icon name="check" className="h-4 w-4" />
              Converted to a lead
            </div>
          ) : (
            <button onClick={onConvert} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              <Icon name="leads" className="h-4 w-4" />
              Convert to Lead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
