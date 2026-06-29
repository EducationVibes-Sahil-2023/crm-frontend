"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import SearchableSelect from "@/components/SearchableSelect";
import VisitorRequestForm from "@/components/VisitorRequestForm";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { listDirectory } from "@/lib/directory";
import { optionNames } from "@/lib/setup";
import {
  addCall,
  addNote,
  addReminder,
  addTransfer,
  deleteCall,
  deleteNote,
  deleteReminder,
  formatCallDuration,
  formatVisitDate,
  leadActivities,
  leadCalls,
  leadNotes,
  leadReminders,
  leadTransfers,
  loadVisitorRequests,
  logLeadActivity,
  toggleReminder,
  type ActivityKind,
  type CallDirection,
} from "@/lib/leadExtras";

export type LeadLike = {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  status: string;
  type?: string;
  source?: string;
  referenceName?: string;
  followUpDate?: string;
  connectedDate?: string;
  lastUpdated?: string;
  assignationDate?: string;
  responseTime?: string;
  totalCallCount?: number;
  callCount?: number;
  duration?: string;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  assignedTo?: string;
  custom?: Record<string, string>;
  deleted?: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  New: "bg-sky-100 text-sky-700", Contacted: "bg-amber-100 text-amber-700", Qualified: "bg-indigo-100 text-indigo-700",
  Proposal: "bg-violet-100 text-violet-700", Won: "bg-emerald-100 text-emerald-700", Lost: "bg-rose-100 text-rose-700",
};
const TYPE_STYLE: Record<string, string> = { Hot: "bg-rose-100 text-rose-700", Warm: "bg-amber-100 text-amber-700", Cold: "bg-sky-100 text-sky-700" };
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const ACTIVITY_ICON: Record<ActivityKind, IconName> = { created: "plus", note: "edit", reminder: "bell", transfer: "send", visitor: "pin", edit: "edit", status: "deals", call: "call" };
const ACTIVITY_STYLE: Record<ActivityKind, { tile: string; label: string }> = {
  created: { tile: "bg-blue-500", label: "Created" },
  note: { tile: "bg-amber-500", label: "Note" },
  reminder: { tile: "bg-violet-500", label: "Reminder" },
  transfer: { tile: "bg-indigo-500", label: "Transfer" },
  visitor: { tile: "bg-emerald-500", label: "Visit" },
  edit: { tile: "bg-slate-400", label: "Edit" },
  status: { tile: "bg-rose-500", label: "Status" },
  call: { tile: "bg-sky-500", label: "Call" },
};

function loadExtras(leadId: string) {
  return {
    notes: leadNotes(leadId),
    reminders: leadReminders(leadId),
    activities: leadActivities(leadId),
    transfers: leadTransfers(leadId),
    calls: leadCalls(leadId),
    visits: loadVisitorRequests().filter((v) => v.leadId === leadId),
  };
}

type Tab = "details" | "calls" | "notes" | "reminders" | "activity" | "transfer" | "visitor";
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "details", label: "Lead Info", icon: "leads" },
  { key: "calls", label: "Call Info", icon: "call" },
  { key: "notes", label: "Notes", icon: "edit" },
  { key: "reminders", label: "Reminders", icon: "bell" },
  { key: "activity", label: "Activity", icon: "activity" },
  { key: "transfer", label: "Transfer", icon: "send" },
  { key: "visitor", label: "Visitor", icon: "pin" },
];

export default function LeadDetailModal({
  lead,
  onClose,
  onEdit,
  onDelete,
  onReassign,
  onUpdate,
  canEdit = true,
  canDelete = true,
}: {
  lead: LeadLike;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReassign: (toName: string) => void;
  onUpdate?: (patch: { status?: string }) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const toast = useToast();
  const me = getUser()?.name ?? "You";
  const [tab, setTab] = useState<Tab>("details");
  const [data, setData] = useState(() => loadExtras(lead.id));
  const refresh = () => setData(loadExtras(lead.id));
  const { notes, reminders, activities, transfers, calls, visits } = data;
  const [statusOpts] = useState(() => optionNames("status"));
  const assignee = lead.assignedTo || lead.createdBy || me;
  const users = listDirectory().map((u) => u.name);

  function changeStatus(next: string) {
    if (!next || next === lead.status) return;
    const prev = lead.status;
    onUpdate?.({ status: next });
    logLeadActivity(lead.id, "status", `Status changed: ${prev} → ${next}`, me);
    refresh();
    toast.success("Status updated", `${prev} → ${next}`);
  }
  function changeAssignee(next: string) {
    if (!next || next === lead.assignedTo) return;
    addTransfer(lead.id, lead.name, assignee, next, "Quick reassign");
    onReassign(next);
    refresh();
    toast.success("Reassigned", `Lead assigned to ${next}.`);
  }

  const initials = lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const counts: Record<Tab, number> = { details: 0, calls: calls.length, notes: notes.length, reminders: reminders.length, activity: activities.length, transfer: transfers.length, visitor: visits.length };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="no-scrollbar my-6 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-6 pb-4 pt-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_18%,white,transparent_42%),radial-gradient(circle_at_88%_85%,white,transparent_38%)]" />
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>

          <div className="relative flex min-w-0 items-center gap-4 pr-10">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold shadow-inner ring-2 ring-white/40 backdrop-blur">{initials}</div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold leading-tight">{lead.name}</h2>
              <p className="truncate text-sm text-blue-100">{lead.company || lead.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {lead.type && <Badge className={`shadow-sm ${TYPE_STYLE[lead.type] ?? "bg-white/20 text-white"}`}>{lead.type}</Badge>}
                {lead.source && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90 ring-1 ring-white/20">{lead.source}</span>}
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90 ring-1 ring-white/20">{lead.email}</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {lead.phone && lead.phone !== "—" && <QuickAction href={`tel:${digits(lead.phone)}`} icon="call" label="Call" />}
            {lead.email && <QuickAction href={`mailto:${lead.email}`} icon="gmail" label="Email" />}
            {lead.phone && lead.phone !== "—" && <QuickAction href={`https://wa.me/${digits(lead.phone).replace(/^\+/, "")}`} icon="chat" label="WhatsApp" external />}
          </div>
        </div>

        {/* Control bar — editable status & assignee, changes logged to Activity */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-white px-6 py-3">
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
            <StatusControl value={lead.status} options={statusOpts} onChange={changeStatus} />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assigned</span>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_COLORS[(assignee.charCodeAt(0) + assignee.length) % AVATAR_COLORS.length]}`}>{assignee.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
            <div className="w-40"><SearchSelect value={assignee} onChange={changeAssignee} options={users} placeholder="Assign…" /></div>
          </div>
          <span className="ml-auto text-[11px] text-slate-400">Updated {lead.lastUpdated || lead.updatedDate || "—"}</span>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-3 py-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}>
                <Icon name={t.icon} className="h-4 w-4" /> {t.label}
                {counts[t.key] > 0 && <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600"}`}>{counts[t.key]}</span>}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {tab === "details" && <DetailsTab lead={lead} />}
          {tab === "calls" && <CallsTab calls={calls} onAdd={(d, sec, outcome, notes) => { addCall(lead.id, d, sec, outcome, notes, me); refresh(); toast.success("Call logged", ""); }} onDelete={(id) => { deleteCall(id); refresh(); }} />}
          {tab === "notes" && <NotesTab notes={notes} onAdd={(text) => { addNote(lead.id, text, me); refresh(); toast.success("Note added", ""); }} onDelete={(id) => { deleteNote(id); refresh(); }} />}
          {tab === "reminders" && <RemindersTab reminders={reminders} onAdd={(title, due) => { addReminder(lead.id, title, due, me); refresh(); toast.success("Reminder set", title); }} onToggle={(id) => { toggleReminder(id); refresh(); }} onDelete={(id) => { deleteReminder(id); refresh(); }} />}
          {tab === "activity" && <ActivityTab activities={activities} />}
          {tab === "transfer" && <TransferTab lead={lead} me={me} transfers={transfers} onTransfer={(to, reason) => { addTransfer(lead.id, lead.name, lead.createdBy || me, to, reason); onReassign(to); refresh(); toast.success("Lead transferred", `${lead.name} assigned to ${to}.`); }} />}
          {tab === "visitor" && <VisitorTab lead={lead} me={me} visits={visits} onCreated={refresh} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          {!lead.deleted && canDelete && <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"><Icon name="trash" className="h-4 w-4" /> Delete</button>}
          {canEdit && <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="edit" className="h-4 w-4" /> Edit Lead</button>}
        </div>
      </div>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

const STATUS_DOT: Record<string, string> = {
  New: "bg-sky-500", Contacted: "bg-amber-500", Qualified: "bg-indigo-500",
  Proposal: "bg-violet-500", Won: "bg-emerald-500", Lost: "bg-rose-500",
};

function StatusControl({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const opts = options.includes(value) ? options : [value, ...options];
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={opts.map((s) => ({ value: s, label: s, dotClass: STATUS_DOT[s] }))}
      placeholder="Status"
      className="w-36"
      buttonClassName="py-1 text-xs font-semibold"
    />
  );
}

function digits(s: string): string {
  return (s || "").replace(/[^\d+]/g, "");
}

function QuickAction({ href, icon, label, external }: { href: string; icon: IconName; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25"
    >
      <Icon name={icon} className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

function DetailsTab({ lead }: { lead: LeadLike }) {
  const location = [lead.city, lead.state].filter((x) => x && x !== "—").join(", ");
  const customEntries = lead.custom ? Object.entries(lead.custom) : [];
  return (
    <div className="space-y-5">
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat icon="call" label="Total calls" value={String(lead.totalCallCount ?? 0)} tone="blue" />
        <Stat icon="checkDouble" label="Connected" value={String(lead.callCount ?? 0)} tone="emerald" />
        <Stat icon="clock" label="Talk time" value={fmtVal(lead.duration) ?? "0m"} tone="violet" />
        <Stat icon="activity" label="Response" value={fmtVal(lead.responseTime) ?? "—"} tone="amber" />
      </div>

      <DetailSection title="Contact" icon="leads">
        <InfoCard icon="gmail" label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
        <InfoCard icon="call" label="Phone" value={lead.phone} href={lead.phone && lead.phone !== "—" ? `tel:${digits(lead.phone)}` : undefined} />
        <InfoCard icon="briefcase" label="Company" value={lead.company} />
        <InfoCard icon="pin" label="Location" value={location} />
      </DetailSection>

      <DetailSection title="Pipeline" icon="deals">
        <InfoCard icon="deals" label="Status" node={<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[lead.status] ?? "bg-slate-100 text-slate-600"}`}>{lead.status}</span>} />
        <InfoCard icon="win" label="Type" node={lead.type ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLE[lead.type] ?? "bg-slate-100 text-slate-600"}`}>{lead.type}</span> : undefined} />
        <InfoCard icon="announcement" label="Source" value={lead.source} />
        <InfoCard icon="star" label="Reference" value={lead.referenceName} />
      </DetailSection>

      <DetailSection title="Assignment & Timeline" icon="users">
        <InfoCard icon="users" label="Assigned to" value={lead.assignedTo || lead.createdBy} accent />
        <InfoCard icon="edit" label="Created by" value={lead.createdBy} />
        <InfoCard icon="calendar" label="Assigned on" value={lead.assignationDate} />
        <InfoCard icon="bell" label="Follow up" value={lead.followUpDate} />
        <InfoCard icon="phone" label="Connected on" value={lead.connectedDate} />
        <InfoCard icon="plus" label="Created on" value={lead.createdDate} />
        <InfoCard icon="refresh" label="Last updated" value={lead.lastUpdated || lead.updatedDate} />
      </DetailSection>

      {customEntries.length > 0 && (
        <DetailSection title="Additional details" icon="edit">
          {customEntries.map(([k, v]) => <InfoCard key={k} icon="fileText" label={k} value={v} />)}
        </DetailSection>
      )}
    </div>
  );
}

function fmtVal(v?: string): string | undefined {
  return v && v !== "—" ? v : undefined;
}

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: "blue" | "emerald" | "violet" | "amber" }) {
  const tiles = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tiles[tone]}`}><Icon name={icon} className="h-4 w-4" /></span>
      <p className="mt-2 truncate text-base font-bold text-slate-900">{value}</p>
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon name={icon} className="h-3.5 w-3.5 text-slate-400" /> {title}
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function InfoCard({ icon, label, value, href, node, accent }: { icon: IconName; label: string; value?: string; href?: string; node?: React.ReactNode; accent?: boolean }) {
  const has = node != null || (value && value !== "—");
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition hover:border-blue-200 hover:bg-blue-50/30 ${accent ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}><Icon name={icon} className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {node != null ? (
          <div className="mt-0.5">{node}</div>
        ) : has ? (
          href ? (
            <a href={href} className="block truncate text-sm font-medium text-blue-600 hover:underline">{value}</a>
          ) : (
            <p className="truncate text-sm font-medium text-slate-800">{value}</p>
          )
        ) : (
          <p className="text-sm text-slate-300">—</p>
        )}
      </div>
    </div>
  );
}

function NotesTab({ notes, onAdd, onDelete }: { notes: ReturnType<typeof leadNotes>; onAdd: (text: string) => void; onDelete: (id: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add a note about this lead…" className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        <div className="flex justify-end"><button onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(""); } }} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">Add note</button></div>
      </div>
      {notes.length === 0 ? <Empty>No notes yet.</Empty> : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-xl border border-slate-200 p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{n.text}</p>
              <div className="mt-1.5 flex items-center justify-between"><span className="text-xs text-slate-400">{n.by} · {n.at}</span><button onClick={() => onDelete(n.id)} className="text-xs text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100">Delete</button></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CallsTab({
  calls,
  onAdd,
  onDelete,
}: {
  calls: ReturnType<typeof leadCalls>;
  onAdd: (direction: CallDirection, durationSec: number, outcome: string, notes: string) => void;
  onDelete: (id: string) => void;
}) {
  const [direction, setDirection] = useState<CallDirection>("outgoing");
  const [minutes, setMinutes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");

  const dirStyle: Record<CallDirection, string> = {
    incoming: "bg-emerald-100 text-emerald-700",
    outgoing: "bg-blue-100 text-blue-700",
    missed: "bg-rose-100 text-rose-700",
  };
  const totalSec = calls.reduce((s, c) => s + c.durationSec, 0);

  return (
    <div className="space-y-4">
      {/* Log form */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SearchableSelect
            value={direction}
            onChange={(v) => setDirection(v as CallDirection)}
            options={[
              { value: "outgoing", label: "Outgoing" },
              { value: "incoming", label: "Incoming" },
              { value: "missed", label: "Missed" },
            ]}
          />
          <input value={minutes} onChange={(e) => setMinutes(e.target.value)} type="number" min="0" step="0.5" placeholder="Mins" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome (e.g. Interested)" className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        <div className="flex justify-end">
          <button onClick={() => { onAdd(direction, Math.round((Number(minutes) || 0) * 60), outcome.trim(), notes.trim()); setMinutes(""); setOutcome(""); setNotes(""); }} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">Log call</button>
        </div>
      </div>

      {calls.length > 0 && (
        <p className="text-xs text-slate-500">{calls.length} call{calls.length === 1 ? "" : "s"} · {formatCallDuration(totalSec)} total talk time</p>
      )}

      {calls.length === 0 ? <Empty>No calls logged yet.</Empty> : (
        <ul className="space-y-2">
          {calls.map((c) => (
            <li key={c.id} className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${dirStyle[c.direction]}`}>{c.direction}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{c.outcome || "Call"} · {formatCallDuration(c.durationSec)}</p>
                {c.notes && <p className="text-xs text-slate-500">{c.notes}</p>}
                <p className="mt-0.5 text-[11px] text-slate-400">{c.by} · {c.at}</p>
              </div>
              <button onClick={() => onDelete(c.id)} className="text-xs text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RemindersTab({ reminders, onAdd, onToggle, onDelete }: { reminders: ReturnType<typeof leadReminders>; onAdd: (title: string, due: string) => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end">
        <div className="flex-1"><label className="mb-1 block text-xs font-medium text-slate-500">Reminder</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow-up call" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <div><label className="mb-1 block text-xs font-medium text-slate-500">Due</label><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <button onClick={() => { if (title.trim() && due) { onAdd(title.trim(), due); setTitle(""); setDue(""); } }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Set</button>
      </div>
      {reminders.length === 0 ? <Empty>No reminders yet.</Empty> : (
        <ul className="space-y-2">
          {reminders.map((r) => (
            <li key={r.id} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input type="checkbox" checked={r.done} onChange={() => onToggle(r.id)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
              <div className="min-w-0 flex-1"><p className={`text-sm font-medium ${r.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{r.title}</p><p className="text-xs text-slate-400">Due {formatVisitDate(r.due)}</p></div>
              <button onClick={() => onDelete(r.id)} className="text-xs text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function splitStamp(at: string): { date: string; time: string } {
  const parts = at.split(/,\s*/);
  if (parts.length >= 3) return { date: `${parts[0]}, ${parts[1]}`, time: parts.slice(2).join(", ") };
  return { date: at, time: "" };
}

function ActivityTab({ activities }: { activities: ReturnType<typeof leadActivities> }) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500"><Icon name="activity" className="h-6 w-6" /></span>
        <p className="mt-3 text-sm font-medium text-slate-600">No activity yet</p>
        <p className="text-xs text-slate-400">Notes, calls, reminders and transfers will show up here.</p>
      </div>
    );
  }

  // Group consecutive activities by date (already newest-first).
  const groups: { date: string; items: typeof activities }[] = [];
  for (const a of activities) {
    const { date } = splitStamp(a.at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(a);
    else groups.push({ date, items: [a] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.date}>
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{g.date}</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>
          <ol className="relative space-y-3 pl-9">
            <span className="absolute left-[14px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
            {g.items.map((a) => {
              const s = ACTIVITY_STYLE[a.kind];
              const { time } = splitStamp(a.at);
              return (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-9 top-1 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm ring-4 ring-white ${s.tile}`}>
                    <Icon name={ACTIVITY_ICON[a.kind]} className="h-3.5 w-3.5" />
                  </span>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${s.tile}`}>{s.label}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{time || a.at}</span>
                    </div>
                    <p className="text-sm text-slate-700">{a.text}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ${AVATAR_COLORS[(a.by.charCodeAt(0) + a.by.length) % AVATAR_COLORS.length]}`}>
                        {a.by.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">{a.by}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function TransferTab({ lead, me, transfers, onTransfer }: { lead: LeadLike; me: string; transfers: ReturnType<typeof leadTransfers>; onTransfer: (to: string, reason: string) => void }) {
  const owner = lead.assignedTo || lead.createdBy || me;
  const users = listDirectory().map((u) => u.name).filter((n) => n !== owner);
  const [to, setTo] = useState(users[0] ?? "");
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_COLORS[(owner.charCodeAt(0) + owner.length) % AVATAR_COLORS.length]}`}>{owner.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
          Currently assigned to <strong className="text-slate-800">{owner}</strong>
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Reassign to</label><SearchSelect value={to} onChange={setTo} options={users} placeholder="Select user" /></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for transfer" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
        </div>
        <div className="mt-3 flex justify-end"><button onClick={() => to && onTransfer(to, reason.trim())} disabled={!to} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><Icon name="send" className="h-4 w-4" /> Transfer Lead</button></div>
      </div>
      {transfers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Transfer history</p>
          <ul className="space-y-2">
            {transfers.map((t) => (
              <li key={t.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-slate-700"><strong>{t.from}</strong> → <strong>{t.to}</strong></p>
                {t.reason && <p className="text-xs text-slate-500">{t.reason}</p>}
                <p className="text-xs text-slate-400">{t.at}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VisitorTab({ lead, me, visits, onCreated }: { lead: LeadLike; me: string; visits: ReturnType<typeof loadVisitorRequests>; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const STATUS: Record<string, string> = { Pending: "bg-amber-100 text-amber-700", Approved: "bg-sky-100 text-sky-700", Completed: "bg-emerald-100 text-emerald-700", Cancelled: "bg-rose-100 text-rose-700" };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Schedule a visit for this lead.</p>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> New Request</button>
      </div>
      {visits.length === 0 ? <Empty>No visitor requests for this lead.</Empty> : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{v.visitorType} · {formatVisitDate(v.dateOfVisit)}</p>
                  <p className="text-xs text-slate-500">{v.location} — {v.purpose}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Attendee: {v.attendee} · {v.address}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[v.status]}`}>{v.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <VisitorRequestForm lead={{ id: lead.id, name: lead.name }} requestedBy={me} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); onCreated(); }} />}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">{children}</div>;
}
