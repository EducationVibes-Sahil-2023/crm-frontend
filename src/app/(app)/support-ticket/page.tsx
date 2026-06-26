"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import RichTextEditor from "@/components/RichTextEditor";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { colorBadge, colorDot, loadSetup } from "@/lib/setup";
import {
  AGENTS,
  EVENT_META,
  MAX_ATTACHMENT_BYTES,
  STATUS_FLOW,
  STATUS_META,
  attachmentIcon,
  formatBytes,
  fullTime,
  initials,
  loadTickets,
  newEvent,
  nextTicketNumber,
  readAttachment,
  relativeTime,
  saveTickets,
  stripHtml,
  type Attachment,
  type Ticket,
  type TicketEvent,
  type TicketStatus,
} from "@/lib/tickets";

type PriorityFilter = string; // "all" or a priority name
type PriMeta = { badge: string; dot: string; label: string; rank: number; top: boolean };

// Columns rendered on the board, in flow order.
const BOARD: TicketStatus[] = ["open", "in_progress", "on_hold", "resolved", "closed"];

const STATUS_OPTIONS: SelectOption[] = (Object.keys(STATUS_META) as TicketStatus[]).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
  dotClass: STATUS_META[s].dot,
}));
const ASSIGNEE_OPTIONS: SelectOption[] = [
  { value: "", label: "Unassigned" },
  ...AGENTS.map((a) => ({ value: a, label: a })),
];

export default function SupportTicketPage() {
  const toast = useToast();
  const me = getUser()?.name || "You";
  const [tickets, setTickets] = useState<Ticket[]>(loadTickets);
  const [setup, setSetup] = useState(loadSetup);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);

  useEffect(() => {
    setTickets(loadTickets());
    setSetup(loadSetup());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveTickets(tickets);
  }, [tickets, ready]);

  // Admin-managed category + priority options.
  const cats = setup.ticketCategory;
  const pris = setup.ticketPriority;
  const maxRank = pris.length - 1;

  const priMeta = useMemo(() => {
    const map: Record<string, PriMeta> = {};
    pris.forEach((p, i) =>
      (map[p.name] = { badge: colorBadge(p.color), dot: colorDot(p.color), label: p.name, rank: i, top: i === maxRank }),
    );
    return map;
  }, [pris, maxRank]);

  const getPri = (name: string): PriMeta =>
    priMeta[name] ?? { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400", label: name, rank: -1, top: false };

  const categoryOptions: SelectOption[] = useMemo(
    () => cats.map((c) => ({ value: c.name, label: c.name, dotClass: colorDot(c.color) })),
    [cats],
  );
  const priorityOptions: SelectOption[] = useMemo(
    () => pris.map((p) => ({ value: p.name, label: p.name, dotClass: colorDot(p.color) })),
    [pris],
  );
  const priorityFilterOptions: SelectOption[] = [{ value: "all", label: "All priorities" }, ...priorityOptions];

  const counts = useMemo(() => {
    const by = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;
    const topName = pris[maxRank]?.name;
    return {
      total: tickets.length,
      open: by("open"),
      in_progress: by("in_progress"),
      resolved: by("resolved"),
      urgent: tickets.filter((t) => t.priority === topName && t.status !== "closed").length,
    };
  }, [tickets, pris, maxRank]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
      .filter(
        (t) =>
          !q ||
          t.subject.toLowerCase().includes(q) ||
          t.number.toLowerCase().includes(q) ||
          t.requester.toLowerCase().includes(q) ||
          stripHtml(t.description).toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [tickets, query, priorityFilter]);

  const active = tickets.find((t) => t.id === activeId) ?? null;

  function createTicket(draft: {
    subject: string;
    description: string;
    requester: string;
    requesterEmail: string;
    category: string;
    priority: string;
    assignee: string | null;
    attachments: Attachment[];
  }) {
    const now = new Date().toISOString();
    const events: TicketEvent[] = [newEvent({ type: "created", by: draft.requester })];
    if (draft.assignee) events.push(newEvent({ type: "assignment", by: me, to: draft.assignee }));
    const ticket: Ticket = {
      id: `t-${new Date(now).getTime()}`,
      number: nextTicketNumber(tickets),
      ...draft,
      status: "open",
      tags: [],
      createdAt: now,
      updatedAt: now,
      events,
    };
    setTickets((list) => [ticket, ...list]);
    setCreating(false);
    setActiveId(ticket.id);
    toast.success("Ticket created", `${ticket.number} is now open.`);
  }

  // Apply a partial change to a ticket plus a tracking event.
  function patch(id: string, changes: Partial<Ticket>, event: TicketEvent) {
    setTickets((list) =>
      list.map((t) =>
        t.id === id ? { ...t, ...changes, updatedAt: event.at, events: [...t.events, event] } : t,
      ),
    );
  }

  function changeStatus(t: Ticket, to: TicketStatus, silent = false) {
    if (t.status === to) return;
    patch(t.id, { status: to }, newEvent({ type: "status", by: me, from: t.status, to }));
    if (!silent) toast.info("Status updated", `${t.number} → ${STATUS_META[to].label}`);
  }

  function changePriority(t: Ticket, to: string) {
    if (t.priority === to) return;
    patch(t.id, { priority: to }, newEvent({ type: "priority", by: me, from: t.priority, to }));
  }

  function changeAssignee(t: Ticket, to: string | null) {
    if (t.assignee === to) return;
    patch(t.id, { assignee: to }, newEvent({ type: "assignment", by: me, to: to ?? "Unassigned" }));
  }

  function addComment(t: Ticket, message: string, attachments: Attachment[]) {
    patch(t.id, {}, newEvent({ type: "comment", by: me, message, attachments }));
  }

  function onDrop(status: TicketStatus) {
    const t = tickets.find((x) => x.id === dragId);
    setOverCol(null);
    setDragId(null);
    if (t && t.status !== status) {
      changeStatus(t, status, true);
      toast.success("Ticket moved", `${t.number} → ${STATUS_META[status].label}`);
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
              <Icon name="ticket" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Support Tickets</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                Drag cards across the board to update status — click any card to track it.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <Icon name="plus" className="h-4 w-4" />
            New Ticket
          </button>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Total" value={counts.total} />
          <Stat label="Open" value={counts.open} />
          <Stat label="In Progress" value={counts.in_progress} />
          <Stat label="Resolved" value={counts.resolved} />
          <Stat label={pris[maxRank]?.name ?? "Urgent"} value={counts.urgent} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <SearchableSelect
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={priorityFilterOptions}
          className="w-full sm:w-48"
        />
      </div>

      {/* Kanban board */}
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {BOARD.map((status) => {
          const cards = visible.filter((t) => t.status === status);
          return (
            <Column
              key={status}
              status={status}
              count={cards.length}
              over={overCol === status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overCol !== status) setOverCol(status);
              }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(status);
              }}
            >
              {cards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                  Drop tickets here
                </p>
              ) : (
                cards.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    pri={getPri(t.priority)}
                    dragging={dragId === t.id}
                    onOpen={() => setActiveId(t.id)}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", t.id);
                      setDragId(t.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                  />
                ))
              )}
            </Column>
          );
        })}
      </div>

      {creating && (
        <CreateModal
          categoryOptions={categoryOptions}
          priorityOptions={priorityOptions}
          defaultCategory={cats[0]?.name ?? ""}
          defaultPriority={(pris.find((p) => p.name === "Medium") ?? pris[0])?.name ?? ""}
          onClose={() => setCreating(false)}
          onCreate={createTicket}
        />
      )}

      {active && (
        <DetailModal
          ticket={active}
          pri={getPri(active.priority)}
          priorityOptions={priorityOptions}
          onClose={() => setActiveId(null)}
          onStatus={(to) => changeStatus(active, to)}
          onPriority={(to) => changePriority(active, to)}
          onAssign={(to) => changeAssignee(active, to)}
          onComment={(msg, files) => addComment(active, msg, files)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

// ── Board column ───────────────────────────────────────────────────
function Column({
  status,
  count,
  over,
  children,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  status: TicketStatus;
  count: number;
  over: boolean;
  children: React.ReactNode;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const m = STATUS_META[status];
  return (
    <div className="flex w-72 shrink-0 flex-col sm:w-80">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
          <h3 className="text-sm font-bold text-slate-700">{m.label}</h3>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{count}</span>
        </div>
      </div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`no-scrollbar flex max-h-[calc(100dvh-20rem)] flex-1 flex-col gap-2.5 overflow-y-auto rounded-2xl border-2 p-2.5 transition ${
          over ? "border-blue-400 bg-blue-50/70" : "border-transparent bg-slate-100/70"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Ticket card ────────────────────────────────────────────────────
function TicketCard({
  ticket: t,
  pri,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  ticket: Ticket;
  pri: PriMeta;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const comments = t.events.filter((e) => e.type === "comment").length;
  const attachCount = t.attachments.length + t.events.reduce((n, e) => n + (e.attachments?.length ?? 0), 0);
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`group cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md active:cursor-grabbing ${
        dragging ? "rotate-1 opacity-50 ring-2 ring-blue-400" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-slate-400">{t.number}</span>
        <PriorityBadge pri={pri} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{t.subject}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{t.category}</span>
        {t.tags.slice(0, 1).map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            #{tag}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {attachCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="paperclip" className="h-3.5 w-3.5" />
              {attachCount}
            </span>
          )}
          {comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="chat" className="h-3.5 w-3.5" />
              {comments}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {relativeTime(t.updatedAt)}
          </span>
        </div>
        <Assignee name={t.assignee} />
      </div>
    </article>
  );
}

function PriorityBadge({ pri }: { pri: PriMeta }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pri.badge}`}>
      {pri.top && <Icon name="alert" className="h-3 w-3" />}
      {pri.label}
    </span>
  );
}

function Assignee({ name }: { name: string | null }) {
  if (!name)
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-300">
        <Icon name="plus" className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span
      title={name}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white"
    >
      {initials(name)}
    </span>
  );
}

// ── Status tracker (pipeline stepper) ──────────────────────────────
function StatusStepper({ status }: { status: TicketStatus }) {
  const cur = STATUS_META[status].step;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status tracker</p>
        {status === "on_hold" && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">On Hold</span>
        )}
      </div>
      <div className="flex items-center">
        {STATUS_FLOW.map((s, i) => {
          const done = i < cur;
          const activeStep = i === cur;
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                    done
                      ? "bg-emerald-500 text-white"
                      : activeStep
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-white text-slate-400 ring-1 ring-slate-200"
                  }`}
                >
                  {done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`mt-1.5 whitespace-nowrap text-[11px] font-medium ${
                    done || activeStep ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <span className={`mx-1 mb-5 h-0.5 flex-1 rounded ${i < cur ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Attachment chips ───────────────────────────────────────────────
function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove?: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((f) => {
        const isImg = f.type.startsWith("image/");
        return (
          <div
            key={f.id}
            className="flex max-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-2 text-xs"
          >
            {isImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.dataUrl} alt={f.name} className="h-7 w-7 shrink-0 rounded object-cover" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white text-slate-500">
                <Icon name={attachmentIcon(f.type)} className="h-4 w-4" />
              </span>
            )}
            <a href={f.dataUrl} download={f.name} className="min-w-0" title={`${f.name} · ${formatBytes(f.size)}`}>
              <span className="block truncate font-medium text-slate-700">{f.name}</span>
              <span className="block text-[10px] text-slate-400">{formatBytes(f.size)}</span>
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label={`Remove ${f.name}`}
                className="rounded p-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tracking timeline ──────────────────────────────────────────────
function EventTimeline({ events }: { events: TicketEvent[] }) {
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <div className="relative pl-1">
      <div className="absolute bottom-2 left-[19px] top-2 w-0.5 bg-slate-200" />
      <ul className="space-y-4">
        {ordered.map((e) => {
          const meta = EVENT_META[e.type];
          return (
            <li key={e.id} className="relative flex gap-3">
              <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${meta.tint}`}>
                <Icon name={meta.icon} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm text-slate-700">{describe(e)}</p>
                {e.message && (
                  <div
                    className="announcement-body mt-1.5 rounded-lg rounded-tl-sm bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"
                    dangerouslySetInnerHTML={{ __html: e.message }}
                  />
                )}
                {e.attachments && e.attachments.length > 0 && <AttachmentList items={e.attachments} />}
                <p className="mt-1 text-[11px] text-slate-400" title={fullTime(e.at)}>
                  {e.by} · {relativeTime(e.at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function describe(e: TicketEvent): React.ReactNode {
  switch (e.type) {
    case "created":
      return "opened this ticket";
    case "comment":
      return <span className="font-semibold text-slate-900">{e.by} commented</span>;
    case "status":
      return (
        <>
          changed status from <b>{statusLabel(e.from)}</b> to <b>{statusLabel(e.to)}</b>
        </>
      );
    case "priority":
      return (
        <>
          set priority from <b>{e.from}</b> to <b>{e.to}</b>
        </>
      );
    case "assignment":
      return (
        <>
          assigned to <b>{e.to}</b>
        </>
      );
  }
}

function statusLabel(key?: string): string {
  if (!key) return "—";
  return STATUS_META[key as TicketStatus]?.label ?? key;
}

// ── Detail modal popup ─────────────────────────────────────────────
function DetailModal({
  ticket: t,
  pri,
  priorityOptions,
  onClose,
  onStatus,
  onPriority,
  onAssign,
  onComment,
}: {
  ticket: Ticket;
  pri: PriMeta;
  priorityOptions: SelectOption[];
  onClose: () => void;
  onStatus: (to: TicketStatus) => void;
  onPriority: (to: string) => void;
  onAssign: (to: string | null) => void;
  onComment: (msg: string, files: Attachment[]) => void;
}) {
  const toast = useToast();
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    const next: Attachment[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error("File too large", `"${file.name}" exceeds ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
        continue;
      }
      try {
        next.push(await readAttachment(file));
      } catch {
        toast.error("Couldn't attach", file.name);
      }
    }
    if (next.length) setFiles((f) => [...f, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function sendReply() {
    if (!stripHtml(reply) && files.length === 0) return;
    onComment(reply, files);
    setReply("");
    setFiles([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
                <span className="font-mono">{t.number}</span>
                <span>·</span>
                <span>{t.category}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-700 ${pri.badge}`}>{pri.label}</span>
              </div>
              <h2 className="mt-1 truncate text-lg font-bold">{t.subject}</h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          {/* Quick controls (searchable) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Control label="Status">
              <SearchableSelect value={t.status} onChange={(v) => onStatus(v as TicketStatus)} options={STATUS_OPTIONS} />
            </Control>
            <Control label="Priority">
              <SearchableSelect value={t.priority} onChange={onPriority} options={priorityOptions} />
            </Control>
            <Control label="Assignee">
              <SearchableSelect
                value={t.assignee ?? ""}
                onChange={(v) => onAssign(v || null)}
                options={ASSIGNEE_OPTIONS}
                placeholder="Unassigned"
              />
            </Control>
          </div>

          {/* Status tracker */}
          <StatusStepper status={t.status} />

          {/* Requester + description */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-sm font-bold text-white">
                {initials(t.requester)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{t.requester}</p>
                <p className="truncate text-xs text-slate-400">{t.requesterEmail}</p>
              </div>
              <span className="ml-auto text-xs text-slate-400" title={fullTime(t.createdAt)}>
                {relativeTime(t.createdAt)}
              </span>
            </div>
            <div
              className="announcement-body mt-3 text-sm leading-relaxed text-slate-600"
              dangerouslySetInnerHTML={{ __html: t.description }}
            />
            <AttachmentList items={t.attachments} />
            {t.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    <Icon name="tag" className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tracking history */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Activity &amp; tracking</p>
            <EventTimeline events={t.events} />
          </div>
        </div>

        {/* Reply composer (rich text + attachments) */}
        <div className="space-y-2 border-t border-slate-200 bg-white p-4">
          <RichTextEditor
            key={t.events.length}
            onChange={setReply}
            placeholder="Write a reply or internal note…"
            minHeight={72}
          />
          <AttachmentList items={files} onRemove={(id) => setFiles((f) => f.filter((x) => x.id !== id))} />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <Icon name="paperclip" className="h-3.5 w-3.5" />
              Attach
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
            <button
              onClick={sendReply}
              disabled={!stripHtml(reply) && files.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              <Icon name="send" className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}

// ── Create modal ───────────────────────────────────────────────────
function CreateModal({
  categoryOptions,
  priorityOptions,
  defaultCategory,
  defaultPriority,
  onClose,
  onCreate,
}: {
  categoryOptions: SelectOption[];
  priorityOptions: SelectOption[];
  defaultCategory: string;
  defaultPriority: string;
  onClose: () => void;
  onCreate: (draft: {
    subject: string;
    description: string;
    requester: string;
    requesterEmail: string;
    category: string;
    priority: string;
    assignee: string | null;
    attachments: Attachment[];
  }) => void;
}) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [requester, setRequester] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [priority, setPriority] = useState(defaultPriority);
  const [assignee, setAssignee] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const firstRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    const next: Attachment[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error("File too large", `"${file.name}" exceeds ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
        continue;
      }
      try {
        next.push(await readAttachment(file));
      } catch {
        toast.error("Couldn't attach", file.name);
      }
    }
    if (next.length) setFiles((f) => [...f, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 4) {
      toast.error("Add a subject", "Use at least 4 characters.");
      return;
    }
    if (requester.trim().length < 2) {
      toast.error("Add the requester", "Who is this ticket for?");
      return;
    }
    onCreate({
      subject: subject.trim(),
      description: stripHtml(description) ? description : "<p>No description provided.</p>",
      requester: requester.trim(),
      requesterEmail: requesterEmail.trim() || "—",
      category,
      priority,
      assignee: assignee || null,
      attachments: files,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">New Support Ticket</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label="Subject" required>
            <input
              ref={firstRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>

          <Field label="Description">
            <RichTextEditor onChange={setDescription} placeholder="Add any details that will help resolve this faster…" />
          </Field>

          {/* Attachments */}
          <Field label="Attachments">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-4 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
            >
              <Icon name="upload" className="h-5 w-5 text-slate-400" />
              <span className="text-xs text-slate-500">
                Click to attach files <span className="text-slate-400">(up to {formatBytes(MAX_ATTACHMENT_BYTES)} each)</span>
              </span>
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
            <AttachmentList items={files} onRemove={(id) => setFiles((f) => f.filter((x) => x.id !== id))} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Requester" required>
              <input
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                placeholder="Customer name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Category">
              <SearchableSelect value={category} onChange={setCategory} options={categoryOptions} placeholder="Select…" />
            </Field>
            <Field label="Priority">
              <SearchableSelect value={priority} onChange={setPriority} options={priorityOptions} placeholder="Select…" />
            </Field>
            <Field label="Assignee">
              <SearchableSelect value={assignee} onChange={setAssignee} options={ASSIGNEE_OPTIONS} placeholder="Unassigned" />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Create Ticket
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
