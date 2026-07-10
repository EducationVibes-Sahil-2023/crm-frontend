"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { isStoreReady, STORE_EVENT } from "@/lib/dbStore";
import {
  BUCKET_META, bucketOf, digits, dueLabel, FOLLOWUP_CATEGORIES, loadFollowUps,
  PRIORITY_META, relativeDue, saveFollowUps, snooze,
  type Bucket, type FollowUp, type FollowUpCategory, type FollowUpPriority,
} from "@/lib/followups";

const PRIORITIES: FollowUpPriority[] = ["high", "medium", "low"];
type Filter = { category: string; priority: string; status: string; date: string };

type Tab = "dashboard" | "queue" | "overdue" | "future" | "completed";
type Source = "followup" | "reminder";
type Item = { key: string; source: Source; id: string; title: string; contact: string; phone: string; due: string; priority: FollowUpPriority; category: string; status: "pending" | "done"; notes: string };

const CAT_ICON: Record<string, IconName> = { Call: "call", WhatsApp: "whatsapp", Meeting: "users", Email: "gmail", Visit: "pin", Other: "bell", Reminder: "bell" };
const fmt = (n: number) => n.toLocaleString("en-IN");

export default function FollowUpsPage() {
  const toast = useToast();
  const me = useMemo(() => getUser(), []);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>({ category: "", priority: "", status: "", date: "" });

  // Load once the database store has hydrated (so we read real saved rows, not
  // an empty cache). One-shot: we stop listening after the first load so the
  // save-on-change effect below can't ping-pong with store change events.
  useEffect(() => {
    let loaded = false;
    const load = () => {
      if (loaded || !isStoreReady()) return;
      loaded = true;
      setFollowups(loadFollowUps());
      setReady(true);
      window.removeEventListener(STORE_EVENT, load);
    };
    load();
    if (!loaded) window.addEventListener(STORE_EVENT, load);
    return () => window.removeEventListener(STORE_EVENT, load);
  }, []);
  useEffect(() => { if (ready) saveFollowUps(followups); }, [followups, ready]);

  // Only real follow-ups fetched from the database — no localStorage merge.
  const items = useMemo<Item[]>(() => [
    ...followups.map((f): Item => ({ key: `f-${f.id}`, source: "followup", id: f.id, title: f.title, contact: f.contact, phone: f.phone, due: f.due, priority: f.priority, category: f.category, status: f.status, notes: f.notes })),
  ], [followups]);

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending");
    return {
      queue: pending.length,
      overdue: pending.filter((i) => bucketOf(i.due) === "overdue").length,
      future: pending.filter((i) => ["tomorrow", "week", "later"].includes(bucketOf(i.due))).length,
      completed: items.filter((i) => i.status === "done").length,
    };
  }, [items]);

  // Apply the (real) filter bar to the list. Metrics on the Dashboard always
  // reflect ALL follow-ups; only the list tabs respect the filter.
  const filteredItems = useMemo(() => items.filter((i) =>
    (!filter.category || i.category === filter.category) &&
    (!filter.priority || i.priority === filter.priority) &&
    (!filter.status || i.status === filter.status) &&
    (!filter.date || (i.due || "").slice(0, 10) === filter.date),
  ), [items, filter]);

  function complete(item: Item) {
    setFollowups((l) => l.map((f) => (f.id === item.id ? { ...f, status: f.status === "done" ? "pending" : "done" } : f)));
  }
  function doSnooze(item: Item, days: number) {
    if (item.source !== "followup") return;
    setFollowups((l) => l.map((f) => (f.id === item.id ? { ...f, due: snooze(f.due, days), status: "pending" } : f)));
    toast.info("Snoozed", days === 1 ? "Moved to tomorrow" : `Moved ${days} days ahead`);
  }
  function remove(item: Item) {
    setFollowups((l) => l.filter((f) => f.id !== item.id));
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

      {tab !== "dashboard" && <FilterBar filter={filter} onChange={setFilter} />}

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
        !ready ? (
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        ) : (
          <DashboardTab items={items} />
        )
      ) : !ready ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : (
        <ListTab
          tab={tab}
          items={filteredItems}
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

/* ---------------- Filter bar (real follow-up fields, wired to the list) ---------------- */
function FilterBar({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const set = (patch: Partial<Filter>) => onChange({ ...filter, ...patch });
  const active = !!(filter.category || filter.priority || filter.status || filter.date);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <FBField label="Follow-up Date"><input type="date" value={filter.date} onChange={(e) => set({ date: e.target.value })} className={FB} /></FBField>
        <FBField label="Category">
          <select value={filter.category} onChange={(e) => set({ category: e.target.value })} className={FB}>
            <option value="">All categories</option>
            {FOLLOWUP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FBField>
        <FBField label="Priority">
          <select value={filter.priority} onChange={(e) => set({ priority: e.target.value })} className={FB}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </FBField>
        <FBField label="Status">
          <select value={filter.status} onChange={(e) => set({ status: e.target.value })} className={FB}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="done">Completed</option>
          </select>
        </FBField>
        <div className="flex items-end">
          <button onClick={() => onChange({ category: "", priority: "", status: "", date: "" })} disabled={!active} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Clear filters</button>
        </div>
      </div>
    </div>
  );
}
const FB = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
function FBField({ label, children }: { label: string; children: ReactNode }) { return <div><label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>{children}</div>; }

/* ---------------- Dashboard tab (computed from real follow-ups) ---------------- */
function DashboardTab({ items }: { items: Item[] }) {
  const m = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done").length;
    const pending = items.filter((i) => i.status === "pending");
    const overdue = pending.filter((i) => bucketOf(i.due) === "overdue").length;
    const dueToday = pending.filter((i) => bucketOf(i.due) === "today").length;
    const future = pending.filter((i) => ["tomorrow", "week", "later"].includes(bucketOf(i.due))).length;
    const byCategory = FOLLOWUP_CATEGORIES
      .map((c) => ({ name: c, count: items.filter((i) => i.category === c).length }))
      .filter((r) => r.count > 0);
    const byPriority = PRIORITIES
      .map((p) => ({ name: PRIORITY_META[p].label, count: items.filter((i) => i.priority === p).length }))
      .filter((r) => r.count > 0);
    return { total, done, pending: pending.length, overdue, dueToday, future, donePct: total ? Math.round((done / total) * 100) : 0, byCategory, byPriority };
  }, [items]);

  if (m.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="star" className="h-7 w-7" /></span>
        <h2 className="mt-4 text-lg font-bold text-slate-900">No follow-ups yet</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">Create your first follow-up and your live metrics will appear here — all from your database.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {m.overdue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Icon name="clock" className="h-5 w-5" /></span>
          <p className="text-sm font-semibold text-rose-700">{fmt(m.overdue)} follow-up{m.overdue === 1 ? " is" : "s are"} overdue right now</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi border="border-t-blue-500" title="Total Follow-ups" value={fmt(m.total)} sub="All time" />
        <Kpi border="border-t-amber-500" title="Pending" value={fmt(m.pending)} sub="Not completed yet" />
        <Kpi border="border-t-rose-500" title="Overdue" value={fmt(m.overdue)} sub="Past their due date" badge={m.overdue ? "Action needed" : undefined} badgeTone="bg-rose-100 text-rose-700" />
        <Kpi border="border-t-amber-500" title="Due Today" value={fmt(m.dueToday)} sub="Scheduled for today" />
        <Kpi border="border-t-indigo-500" title="Future" value={fmt(m.future)} sub="Scheduled ahead" />
        <Kpi border="border-t-emerald-500" title="Completed" value={fmt(m.done)} sub={`of ${fmt(m.total)} total`} badge={`${m.donePct}% done`} badgeTone="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarList title="By category" rows={m.byCategory} tone="bg-blue-500" />
        <BarList title="By priority" rows={m.byPriority} tone="bg-indigo-500" />
      </div>
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

function BarList({ title, rows, tone, badge, badgeTone }: { title: string; rows: { name: string; count: number }[]; tone: string; badge?: string; badgeTone?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel title={title}>
      <div className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-slate-600">{r.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100"><div className={`h-full rounded ${tone}`} style={{ width: `${(r.count / max) * 100}%` }} /></div>
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-700">{r.count}</span>
            {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeTone}`}>{badge}</span>}
          </div>
        ))}
      </div>
    </Panel>
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
            <L label="Priority"><SearchableSelect value={priority} onChange={(v) => setPriority(v as FollowUpPriority)} options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} className="w-full" /></L>
          </div>
          <L label="Type"><SearchSelect value={category} onChange={(v) => setCategory(v as FollowUpCategory)} options={[...FOLLOWUP_CATEGORIES]} /></L>
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
