"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { isStoreReady, STORE_EVENT } from "@/lib/dbStore";
import { allReminders, deleteReminder, toggleReminder, type LeadReminder } from "@/lib/leadExtras";
import {
  AGING, COMPLETION_SPLIT, COUNSELLORS, CREATED_LEAST, DEPARTMENTS, FU_KPIS, GHOSTED,
  LEAD_SOURCES, LEAD_STATUSES, LOCATIONS, MISSED_TOP, PENDING_SPLIT, STATUS_VOLUME,
  type CounsellorRow, type SplitRow,
} from "@/lib/followupAnalytics";
import {
  BUCKET_META, bucketOf, digits, dueLabel, FOLLOWUP_CATEGORIES, loadFollowUps,
  PRIORITY_META, relativeDue, saveFollowUps, snooze,
  type Bucket, type FollowUp, type FollowUpCategory, type FollowUpPriority,
} from "@/lib/followups";

type Tab = "dashboard" | "queue" | "overdue" | "future" | "completed";
type Source = "followup" | "reminder";
type Item = { key: string; source: Source; id: string; title: string; contact: string; phone: string; due: string; priority: FollowUpPriority; category: string; status: "pending" | "done"; notes: string };

const CAT_ICON: Record<string, IconName> = { Call: "call", WhatsApp: "whatsapp", Meeting: "users", Email: "gmail", Visit: "pin", Other: "bell", Reminder: "bell" };
const fmt = (n: number) => n.toLocaleString("en-IN");

export default function FollowUpsPage() {
  const toast = useToast();
  const me = useMemo(() => getUser(), []);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [reminders, setReminders] = useState<LeadReminder[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [open, setOpen] = useState(false);

  // Load once the database store has hydrated (so we read real saved rows, not
  // an empty cache). One-shot: we stop listening after the first load so the
  // save-on-change effect below can't ping-pong with store change events.
  useEffect(() => {
    let loaded = false;
    const load = () => {
      if (loaded || !isStoreReady()) return;
      loaded = true;
      setFollowups(loadFollowUps());
      setReminders(allReminders());
      setReady(true);
      window.removeEventListener(STORE_EVENT, load);
    };
    load();
    if (!loaded) window.addEventListener(STORE_EVENT, load);
    return () => window.removeEventListener(STORE_EVENT, load);
  }, []);
  useEffect(() => { if (ready) saveFollowUps(followups); }, [followups, ready]);

  const items = useMemo<Item[]>(() => [
    ...followups.map((f): Item => ({ key: `f-${f.id}`, source: "followup", id: f.id, title: f.title, contact: f.contact, phone: f.phone, due: f.due, priority: f.priority, category: f.category, status: f.status, notes: f.notes })),
    ...reminders.map((r): Item => ({ key: `r-${r.id}`, source: "reminder", id: r.id, title: r.title, contact: "", phone: "", due: r.due, priority: "medium", category: "Reminder", status: r.done ? "done" : "pending", notes: "" })),
  ], [followups, reminders]);

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending");
    return {
      queue: pending.length,
      overdue: pending.filter((i) => bucketOf(i.due) === "overdue").length,
      future: pending.filter((i) => ["tomorrow", "week", "later"].includes(bucketOf(i.due))).length,
      completed: items.filter((i) => i.status === "done").length,
    };
  }, [items]);

  function complete(item: Item) {
    if (item.source === "followup") setFollowups((l) => l.map((f) => (f.id === item.id ? { ...f, status: f.status === "done" ? "pending" : "done" } : f)));
    else { toggleReminder(item.id); setReminders(allReminders()); }
  }
  function doSnooze(item: Item, days: number) {
    if (item.source !== "followup") return;
    setFollowups((l) => l.map((f) => (f.id === item.id ? { ...f, due: snooze(f.due, days), status: "pending" } : f)));
    toast.info("Snoozed", days === 1 ? "Moved to tomorrow" : `Moved ${days} days ahead`);
  }
  function remove(item: Item) {
    if (item.source === "followup") setFollowups((l) => l.filter((f) => f.id !== item.id));
    else { deleteReminder(item.id); setReminders(allReminders()); }
    toast.info("Removed", "Follow-up deleted.");
  }
  function save(f: FollowUp) {
    setFollowups((l) => (l.some((x) => x.id === f.id) ? l.map((x) => (x.id === f.id ? f : x)) : [f, ...l]));
    setOpen(false); setEditing(null);
    toast.success(editing ? "Follow-up updated" : "Follow-up added", f.title);
  }

  const TABS: { key: Tab; label: string; icon: IconName; count?: number; tone?: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: "grid" },
    { key: "queue", label: "Follow-up queue", icon: "list", count: counts.queue, tone: "text-blue-600" },
    { key: "overdue", label: "Follow-up Overdue", icon: "alert", count: counts.overdue, tone: "text-rose-600" },
    { key: "future", label: "Follow-up Future", icon: "calendar", count: counts.future, tone: "text-indigo-600" },
    { key: "completed", label: "Follow-up completed", icon: "check", count: counts.completed, tone: "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Icon name="star" className="h-5 w-5" /></span>
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Follow-up Tracker</h1></div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> New Follow-up</button>
      </div>

      <FilterBar />

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            <Icon name={t.icon} className="h-4 w-4" /> {t.label}
            {t.count !== undefined && <span className={`rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold ${t.tone}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <DashboardTab />
      ) : !ready ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : (
        <ListTab
          tab={tab}
          items={items}
          onComplete={complete}
          onSnooze={doSnooze}
          onEdit={(id) => { const f = followups.find((x) => x.id === id); if (f) { setEditing(f); setOpen(true); } }}
          onDelete={remove}
        />
      )}

      {open && <FollowUpModal editing={editing} by={me?.name ?? "You"} onClose={() => { setOpen(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

/* ---------------- Filter bar ---------------- */
function FilterBar() {
  const toast = useToast();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
        <FBField label="Follow-up Date"><input type="date" className={FB} /></FBField>
        <FBSelect label="Lead Sources" options={["Lead Source", ...LEAD_SOURCES]} />
        <FBSelect label="Lead Status" options={["Lead Status", ...LEAD_STATUSES]} />
        <FBSelect label="Department" options={["Department", ...DEPARTMENTS]} />
        <FBSelect label="Office Location" options={["Location", ...LOCATIONS]} />
        <FBSelect label="Assign" options={["Assign", ...COUNSELLORS.map((c) => c.name)]} />
        <div className="flex items-end gap-2">
          <button onClick={() => toast.success("Filters applied", "Showing matching follow-ups")} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Apply</button>
          <button onClick={() => toast.info("Refreshed", "Data reloaded")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Icon name="refresh" className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
const FB = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
function FBField({ label, children }: { label: string; children: ReactNode }) { return <div><label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>{children}</div>; }
function FBSelect({ label, options }: { label: string; options: string[] }) {
  return <FBField label={label}><select className={FB}>{options.map((o) => <option key={o}>{o}</option>)}</select></FBField>;
}

/* ---------------- Dashboard tab ---------------- */
function DashboardTab() {
  const k = FU_KPIS;
  return (
    <div className="space-y-5">
      {/* overdue alert */}
      <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Icon name="clock" className="h-5 w-5" /></span>
        <div>
          <p className="text-sm font-semibold text-rose-700">{fmt(k.overdue)} follow-ups are overdue right now</p>
          <p className="text-xs text-rose-500">Prospect: {k.overdueBreak.prospect} · Funnel: {k.overdueBreak.funnel} · Callback: {k.overdueBreak.callback}</p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi border="border-t-rose-500" title="Total Due" value={fmt(k.totalDue)} sub="Across all counsellors" />
        <Kpi border="border-t-emerald-500" title="Completed" value={fmt(k.completed)} sub={`of ${k.scheduled} scheduled`} badge={`${k.donePct}% done`} badgeTone="bg-emerald-100 text-emerald-700" />
        <Kpi border="border-t-rose-500" title="Overdue Till Now" value={fmt(k.overdue)} sub="Not actioned yet" badge="▲ Critical" badgeTone="bg-rose-100 text-rose-700" />
        <Kpi border="border-t-blue-500" title="Prospect Pending" value={fmt(k.prospectPending)} sub="Customer: 0 · Warm Lead: 87 · Hot Lead: 10" />
        <Kpi border="border-t-blue-500" title="Funnel Pending" value={fmt(k.funnelPending)} sub="Cold Lead: 67 · Future Intake: 2" />
        <Kpi border="border-t-amber-500" title="Callback Pending" value={fmt(k.callbackPending)} sub="Fresh Lead: 12 · Not Reachable: 10" />
        <Kpi border="border-t-rose-500" title="Team Completion Rate" value={`${k.teamRate}%`} sub={`Target: ${k.teamTarget}%`} badge="▼ Below target" badgeTone="bg-rose-100 text-rose-700" />
        <Kpi border="border-t-slate-400" title="Ghosted / No Response" value={fmt(k.ghosted)} sub="3+ attempts, no reply" badge="Review needed" badgeTone="bg-slate-100 text-slate-600" />
        <Kpi border="border-t-indigo-500" title="Future Follow-ups" value={fmt(k.future)} sub="Scheduled ahead" />
      </div>

      <CounsellorTable />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VolumeChart />
        <AgingChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarList title="Missed Follow-ups — Top 5 most missed" rows={MISSED_TOP} tone="bg-rose-500" badge="High" badgeTone="bg-rose-100 text-rose-700" />
        <BarList title="Least 5 — created follow-ups" rows={CREATED_LEAST} tone="bg-emerald-500" badge="Low" badgeTone="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SplitGrid title="Completion Split — by Lead Type" rows={COMPLETION_SPLIT} />
        <SplitGrid title="Pending / Overdue Split — by Lead Type" rows={PENDING_SPLIT} />
      </div>

      <GhostedTable />
    </div>
  );
}

function Kpi({ title, value, sub, badge, badgeTone, border }: { title: string; value: string; sub: string; badge?: string; badgeTone?: string; border: string }) {
  return (
    <div className={`rounded-2xl border border-t-4 ${border} border-slate-200 bg-white p-4 shadow-sm`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTone}`}>{badge}</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function CounsellorTable() {
  const [f, setF] = useState<"all" | CounsellorRow["status"]>("all");
  const counts = useMemo(() => ({
    all: COUNSELLORS.length,
    "On track": COUNSELLORS.filter((c) => c.status === "On track").length,
    "At risk": COUNSELLORS.filter((c) => c.status === "At risk").length,
    Critical: COUNSELLORS.filter((c) => c.status === "Critical").length,
  }), []);
  const rows = COUNSELLORS.filter((c) => f === "all" || c.status === f);
  const chip = (s: CounsellorRow["status"]) => s === "On track" ? "bg-emerald-100 text-emerald-700" : s === "At risk" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  const pctChip = (p: number) => p >= 90 ? "bg-emerald-100 text-emerald-700" : p >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Counsellor Follow-up Workload &amp; Accountability</h3>
        <div className="flex items-center gap-1.5 text-xs">
          {([["all", `All ${counts.all}`], ["On track", `${counts["On track"]} On track`], ["At risk", `${counts["At risk"]} At risk`], ["Critical", `${counts.Critical} Critical`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setF(key as typeof f)} className={`rounded-full px-2.5 py-1 font-medium transition ${f === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>{["Counsellor", "Assigned", "Completed", "Pending", "Overdue", "Customer", "Callback", "Funnel", "Prospect", "Completed %", "Status"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.assigned}</td>
                <td className="px-4 py-2.5 font-medium text-emerald-600">{c.completed}</td>
                <td className={`px-4 py-2.5 font-medium ${c.pending ? "text-rose-600" : "text-slate-400"}`}>{c.pending}</td>
                <td className="px-4 py-2.5">{c.overdue ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">{c.overdue}</span> : <span className="text-slate-400">0</span>}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.customer || 0}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.callback || 0}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.funnel || 0}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.prospect || 0}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pctChip(c.pct)}`}>{c.pct}%</span></td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip(c.status)}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VolumeChart() {
  const max = Math.max(1, ...STATUS_VOLUME.map((s) => s.total));
  return (
    <Panel title="Follow-up Volume by Lead Status">
      <div className="flex flex-wrap gap-x-3 gap-y-1 pb-3 text-[11px] text-slate-500">
        {STATUS_VOLUME.map((s) => <span key={s.name} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${s.color}`} />{s.name} ({s.total})</span>)}
      </div>
      <div className="flex h-44 items-end gap-2">
        {STATUS_VOLUME.map((s) => (
          <div key={s.name} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-40 w-full max-w-[28px] items-end">
              <div className="relative w-full overflow-hidden rounded-t bg-slate-100" style={{ height: `${(s.total / max) * 100}%` }} title={`${s.name}: ${s.completed}/${s.total}`}>
                <div className={`absolute bottom-0 w-full ${s.color}`} style={{ height: s.total ? `${(s.completed / s.total) * 100}%` : "0%" }} />
              </div>
            </div>
            <span className="w-full truncate text-center text-[9px] text-slate-400" title={s.name}>{s.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AgingChart() {
  const max = Math.max(1, ...AGING.map((a) => a.value));
  return (
    <Panel title="Overdue Aging Analysis">
      <div className="space-y-3">
        {AGING.map((a) => (
          <div key={a.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-slate-600">{a.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded bg-gradient-to-r from-rose-400 to-rose-600" style={{ width: `${(a.value / max) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-700">{fmt(a.value)}</span>
            <span className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${a.tone}`}>{a.tag}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BarList({ title, rows, tone, badge, badgeTone }: { title: string; rows: { name: string; count: number }[]; tone: string; badge: string; badgeTone: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel title={title}>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-slate-600">{r.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100"><div className={`h-full rounded ${tone}`} style={{ width: `${(r.count / max) * 100}%` }} /></div>
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-700">{r.count}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeTone}`}>{badge}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SplitGrid({ title, rows }: { title: string; rows: SplitRow[] }) {
  return (
    <Panel title={title}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((r) => {
          const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
          return (
            <div key={r.type} className="rounded-lg border border-slate-200 p-2.5">
              <p className="flex items-center gap-1.5 truncate text-xs font-medium text-slate-700"><span className={`h-2 w-2 rounded-sm ${r.color}`} />{r.type}</p>
              <p className="mt-1 text-[11px] text-slate-500">{fmt(r.done)}/{fmt(r.total)} done</p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${r.color}`} style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function GhostedTable() {
  const toast = useToast();
  function exportCsv() {
    const head = ["Name", "Owner", "Type", "Attempts", "Last contact"];
    const lines = GHOSTED.map((g) => [g.name, g.by, g.type, String(g.attempts), g.connected ? g.ago : "Not Connected"]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "ghosted-leads.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("Exported", "ghosted-leads.csv downloaded");
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Ghosted Leads — no response after 3+ attempts</h3>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Icon name="download" className="h-3.5 w-3.5" /> Export Excel</button>
      </div>
      <div className="divide-y divide-slate-100">
        {GHOSTED.map((g) => (
          <div key={g.name + g.phone} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{g.name}</p>
              <p className="truncate text-xs text-slate-400">{g.by}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${g.typeBadge}`}>{g.type}</span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">{g.attempts} attempts</span>
            <span className={`w-24 text-right text-xs ${g.connected ? "text-slate-500" : "text-rose-500"}`}>{g.connected ? g.ago : "Not Connected"}</span>
            <a href={`https://wa.me/${digits(g.phone)}`} target="_blank" rel="noopener" className="rounded-md p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600" title="WhatsApp"><Icon name="whatsapp" className="h-4 w-4" /></a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>{children}</div>;
}

/* ---------------- List tabs ---------------- */
const TAB_BUCKETS: Record<Exclude<Tab, "dashboard" | "completed">, Bucket[]> = {
  queue: ["overdue", "today", "tomorrow", "week", "later", "none"],
  overdue: ["overdue"],
  future: ["tomorrow", "week", "later"],
};

function ListTab({ tab, items, onComplete, onSnooze, onEdit, onDelete }: {
  tab: Tab; items: Item[];
  onComplete: (i: Item) => void; onSnooze: (i: Item, d: number) => void; onEdit: (id: string) => void; onDelete: (i: Item) => void;
}) {
  if (tab === "completed") {
    const done = items.filter((i) => i.status === "done").sort((a, b) => (b.due || "").localeCompare(a.due || ""));
    if (done.length === 0) return <EmptyList />;
    return <div className="space-y-2">{done.map((it) => <Row key={it.key} item={it} done onComplete={() => onComplete(it)} onSnooze={() => {}} onEdit={() => {}} onDelete={() => onDelete(it)} />)}</div>;
  }
  const buckets = TAB_BUCKETS[tab as Exclude<Tab, "dashboard" | "completed">];
  const pending = items.filter((i) => i.status === "pending");
  const grouped = buckets.map((bk) => ({ bk, list: pending.filter((i) => bucketOf(i.due) === bk).sort((a, b) => (a.due || "9").localeCompare(b.due || "9")) })).filter((g) => g.list.length > 0);
  if (grouped.length === 0) return <EmptyList />;
  return (
    <div className="space-y-5">
      {grouped.map(({ bk, list }) => (
        <div key={bk}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BUCKET_META[bk].badge}`}><span className={`h-1.5 w-1.5 rounded-full ${BUCKET_META[bk].dot}`} />{BUCKET_META[bk].label}</span>
            <span className="text-xs font-semibold text-slate-400">{list.length}</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          <div className="space-y-2">{list.map((it) => <Row key={it.key} item={it} onComplete={() => onComplete(it)} onSnooze={(d) => onSnooze(it, d)} onEdit={() => onEdit(it.id)} onDelete={() => onDelete(it)} />)}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyList() {
  return <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="bell" className="h-7 w-7" /></div><p className="mt-3 text-sm font-semibold text-slate-700">Nothing here</p><p className="mt-1 text-sm text-slate-400">You&apos;re all caught up.</p></div>;
}

function Row({ item, done, onComplete, onSnooze, onEdit, onDelete }: { item: Item; done?: boolean; onComplete: () => void; onSnooze: (days: number) => void; onEdit: () => void; onDelete: () => void }) {
  const pm = PRIORITY_META[item.priority];
  const overdue = !done && bucketOf(item.due) === "overdue";
  const catIcon = CAT_ICON[item.category] ?? "bell";
  return (
    <div className={`group flex items-center gap-3 rounded-xl border border-l-4 border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md ${done ? "opacity-70" : BUCKET_META[bucketOf(item.due)].accent}`}>
      <button onClick={onComplete} aria-label={done ? "Mark pending" : "Mark done"} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-500"}`}><Icon name="check" className="h-3.5 w-3.5" /></button>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${pm.badge}`}><Icon name={catIcon} className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{item.title}</p>
        <p className="truncate text-xs text-slate-500">{item.contact && <span>{item.contact} · </span>}{item.category}{item.source === "reminder" && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-medium text-slate-500">Lead</span>}</p>
      </div>
      {item.due && <span className={`hidden shrink-0 text-xs font-medium sm:block ${overdue ? "text-rose-600" : "text-slate-500"}`} title={dueLabel(item.due)}>{relativeDue(item.due)}</span>}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        {item.phone && <a href={`https://wa.me/${digits(item.phone)}`} target="_blank" rel="noopener" title="WhatsApp" className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Icon name="whatsapp" className="h-4 w-4" /></a>}
        {item.phone && <a href={`tel:${digits(item.phone)}`} title="Call" className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Icon name="call" className="h-4 w-4" /></a>}
        {!done && item.source === "followup" && <>
          <button onClick={() => onSnooze(1)} title="Snooze 1 day" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="clock" className="h-4 w-4" /></button>
          <button onClick={onEdit} title="Edit" className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Icon name="edit" className="h-4 w-4" /></button>
        </>}
        <button onClick={onDelete} title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function FollowUpModal({ editing, by, onClose, onSave }: { editing: FollowUp | null; by: string; onClose: () => void; onSave: (f: FollowUp) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [contact, setContact] = useState(editing?.contact ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [due, setDue] = useState(editing?.due ?? "");
  const [priority, setPriority] = useState<FollowUpPriority>(editing?.priority ?? "medium");
  const [category, setCategory] = useState<FollowUpCategory>(editing?.category ?? "Call");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Add a title", "Describe what to follow up on."); return; }
    onSave({ id: editing?.id ?? `fu-${Date.now().toString(36)}`, title: title.trim(), contact: contact.trim(), phone: phone.trim(), due, priority, category, status: editing?.status ?? "pending", notes: notes.trim(), createdBy: editing?.createdBy ?? by, createdAt: editing?.createdAt ?? new Date().toISOString(), completedAt: editing?.completedAt });
  }
  const cls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%)]" />
          <div className="relative flex items-center justify-between"><h2 className="text-lg font-bold">{editing ? "Edit follow-up" : "New follow-up"}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button></div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <L label="What to follow up on"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={cls} placeholder="e.g. Call back about admission" /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Contact"><input value={contact} onChange={(e) => setContact(e.target.value)} className={cls} placeholder="Lead / person" /></L>
            <L label="Phone (optional)"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} placeholder="+91 98765 43210" /></L>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <L label="Due date & time"><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={cls} /></L>
            <L label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as FollowUpPriority)} className={cls}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></L>
          </div>
          <L label="Type"><select value={category} onChange={(e) => setCategory(e.target.value as FollowUpCategory)} className={cls}>{FOLLOWUP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></L>
          <L label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${cls} resize-none`} placeholder="Anything to remember…" /></L>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">{editing ? "Save changes" : "Add follow-up"}</button>
        </div>
      </form>
    </div>
  );
}
function L({ label, children }: { label: string; children: ReactNode }) { return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>; }
