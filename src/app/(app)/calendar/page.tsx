"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { COLORS, colorBadge, colorDot } from "@/lib/setup";
import { loadPriorities, loadTasks, priorityMeta, type Priority } from "@/lib/tasks";
import {
  categoryColor,
  EVENT_CATEGORIES,
  fmtRange,
  fmtTime,
  isToday,
  loadEvents,
  MONTHS,
  monthMatrix,
  parseYmd,
  sameDay,
  saveEvents,
  WEEKDAYS,
  weekDays,
  ymd,
  type CalEvent,
} from "@/lib/calendar";

type View = "month" | "week" | "agenda";

// A unified item the grid/lists render: a real event or a (read-only) task.
type DisplayEvent = {
  id: string;
  title: string;
  date: string;
  dot: string;
  chip: string;
  timeLabel: string;
  sortKey: string;
  kind: "event" | "task";
  event?: CalEvent;
};

export default function CalendarPage() {
  const toast = useToast();
  const [events, setEvents] = useState<CalEvent[]>(loadEvents);
  const [priorities, setPriorities] = useState<Priority[]>(loadPriorities);
  const [tasks, setTasks] = useState<ReturnType<typeof loadTasks>>([]);
  const [ready, setReady] = useState(false);

  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date()); // month/week anchor
  const [selected, setSelected] = useState(() => new Date());
  const [showTasks, setShowTasks] = useState(true);
  const [composer, setComposer] = useState<{ open: boolean; editing: CalEvent | null; date: string }>({ open: false, editing: null, date: ymd(new Date()) });

  useEffect(() => {
    setEvents(loadEvents());
    setPriorities(loadPriorities());
    setTasks(loadTasks());
    setReady(true);
  }, []);
  useEffect(() => { if (ready) saveEvents(events); }, [events, ready]);

  // Build display items keyed by date string.
  const byDate = useMemo(() => {
    const map = new Map<string, DisplayEvent[]>();
    const push = (d: DisplayEvent) => {
      const arr = map.get(d.date) ?? [];
      arr.push(d);
      map.set(d.date, arr);
    };
    for (const e of events) {
      push({
        id: e.id, title: e.title, date: e.date,
        dot: colorDot(e.color), chip: colorBadge(e.color),
        timeLabel: e.allDay ? "All day" : fmtTime(e.start),
        sortKey: e.allDay ? "00:00" : e.start ?? "23:59",
        kind: "event", event: e,
      });
    }
    if (showTasks) {
      for (const t of tasks) {
        if (!t.dueDate || t.status === "done") continue;
        const meta = priorityMeta(priorities, t.priority);
        push({
          id: `task-${t.id}`, title: t.title, date: t.dueDate,
          dot: meta.dot, chip: meta.chip, timeLabel: "Task due",
          sortKey: "23:58", kind: "task",
        });
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return map;
  }, [events, tasks, priorities, showTasks]);

  const monthEventsCount = useMemo(
    () => events.filter((e) => { const d = parseYmd(e.date); return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth(); }).length,
    [events, cursor],
  );

  function go(delta: number) {
    const d = new Date(cursor);
    if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setCursor(d);
  }
  function goToday() {
    const now = new Date();
    setCursor(now);
    setSelected(now);
  }

  function openCreate(date: string) {
    setComposer({ open: true, editing: null, date });
  }
  function saveEvent(draft: Omit<CalEvent, "id">, editingId?: string) {
    if (editingId) {
      setEvents((list) => list.map((e) => (e.id === editingId ? { ...e, ...draft, id: editingId } : e)));
      toast.success("Event updated");
    } else {
      const e: CalEvent = { ...draft, id: `e-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
      setEvents((list) => [...list, e]);
      toast.success("Event added", e.title);
    }
    setComposer({ open: false, editing: null, date: draft.date });
  }
  function deleteEvent(id: string) {
    setEvents((list) => list.filter((e) => e.id !== id));
    toast.info("Event deleted");
  }

  const headerLabel = view === "week"
    ? weekRangeLabel(cursor)
    : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const selectedItems = byDate.get(ymd(selected)) ?? [];

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-7">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="calendar" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{headerLabel}</h1>
              <p className="mt-0.5 text-sm text-blue-100">{monthEventsCount} event{monthEventsCount === 1 ? "" : "s"} this month</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg bg-white/10 ring-1 ring-white/25 backdrop-blur">
              <button onClick={() => go(-1)} aria-label="Previous" className="rounded-l-lg p-2.5 hover:bg-white/15"><Icon name="arrowLeft" className="h-4 w-4" /></button>
              <button onClick={goToday} className="border-x border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/15">Today</button>
              <button onClick={() => go(1)} aria-label="Next" className="rounded-r-lg p-2.5 hover:bg-white/15"><Icon name="arrowLeft" className="h-4 w-4 rotate-180" /></button>
            </div>
            <button onClick={() => openCreate(ymd(selected))} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              <Icon name="folderPlus" className="h-4 w-4" /> New Event
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
          Show task due dates
        </label>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <ViewBtn active={view === "month"} onClick={() => setView("month")} icon="grid" label="Month" />
          <ViewBtn active={view === "week"} onClick={() => setView("week")} icon="list" label="Week" />
          <ViewBtn active={view === "agenda"} onClick={() => setView("agenda")} icon="task" label="Agenda" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        {/* Main calendar */}
        <div className="min-w-0">
          {view === "month" && (
            <MonthGrid cursor={cursor} selected={selected} byDate={byDate} onSelect={setSelected} onCreate={openCreate} onOpen={(ev) => setComposer({ open: true, editing: ev, date: ev.date })} />
          )}
          {view === "week" && (
            <WeekGrid cursor={cursor} selected={selected} byDate={byDate} onSelect={setSelected} onCreate={openCreate} onOpen={(ev) => setComposer({ open: true, editing: ev, date: ev.date })} />
          )}
          {view === "agenda" && (
            <Agenda cursor={cursor} byDate={byDate} onOpen={(ev) => setComposer({ open: true, editing: ev, date: ev.date })} />
          )}
        </div>

        {/* Selected day panel */}
        <DayPanel date={selected} items={selectedItems} onCreate={() => openCreate(ymd(selected))} onOpen={(ev) => setComposer({ open: true, editing: ev, date: ev.date })} />
      </div>

      {composer.open && (
        <EventComposer
          editing={composer.editing}
          defaultDate={composer.date}
          onClose={() => setComposer({ open: false, editing: null, date: composer.date })}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}
    </div>
  );
}

// ---- shared bits ----

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon name={icon} className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EventDot({ item, onOpen }: { item: DisplayEvent; onOpen: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (item.kind === "event") onOpen(); }}
      title={`${item.title} · ${item.timeLabel}`}
      className={`flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${item.chip} ${item.kind === "task" ? "opacity-90" : "hover:brightness-95"}`}
    >
      {item.kind === "task" ? <Icon name="task" className="h-2.5 w-2.5 shrink-0" /> : <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />}
      <span className="truncate">{item.title}</span>
    </button>
  );
}

// ---- Month grid ----

function MonthGrid({ cursor, selected, byDate, onSelect, onCreate, onOpen }: {
  cursor: Date; selected: Date; byDate: Map<string, DisplayEvent[]>;
  onSelect: (d: Date) => void; onCreate: (date: string) => void; onOpen: (ev: CalEvent) => void;
}) {
  const cells = monthMatrix(cursor.getFullYear(), cursor.getMonth());
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const today = isToday(d);
          const isSel = sameDay(d, selected);
          const items = byDate.get(ymd(d)) ?? [];
          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              onDoubleClick={() => onCreate(ymd(d))}
              className={`group relative min-h-[104px] border-b border-r border-slate-100 p-1.5 text-left transition last:border-r-0 [&:nth-child(7n)]:border-r-0 ${inMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/50"} ${isSel ? "ring-2 ring-inset ring-blue-500" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${today ? "bg-blue-600 text-white" : inMonth ? "text-slate-700" : "text-slate-400"}`}>{d.getDate()}</span>
                <span onClick={(e) => { e.stopPropagation(); onCreate(ymd(d)); }} className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600 group-hover:flex"><Icon name="folderPlus" className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((it) => <EventDot key={it.id} item={it} onOpen={() => it.event && onOpen(it.event)} />)}
                {items.length > 3 && <span className="block px-1.5 text-[10px] font-medium text-slate-400">+{items.length - 3} more</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Week grid ----

function WeekGrid({ cursor, selected, byDate, onSelect, onCreate, onOpen }: {
  cursor: Date; selected: Date; byDate: Map<string, DisplayEvent[]>;
  onSelect: (d: Date) => void; onCreate: (date: string) => void; onOpen: (ev: CalEvent) => void;
}) {
  const days = weekDays(cursor);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const items = byDate.get(ymd(d)) ?? [];
        const today = isToday(d);
        const isSel = sameDay(d, selected);
        return (
          <div key={ymd(d)} onClick={() => onSelect(d)} className={`flex min-h-[180px] cursor-pointer flex-col rounded-xl border bg-white p-2.5 shadow-sm transition hover:shadow-md ${isSel ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"}`}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{WEEKDAYS[d.getDay()]}</p>
                <p className={`text-lg font-bold ${today ? "text-blue-600" : "text-slate-700"}`}>{d.getDate()}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onCreate(ymd(d)); }} aria-label="Add event" className="rounded p-1 text-slate-300 hover:bg-blue-50 hover:text-blue-600"><Icon name="folderPlus" className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {items.length === 0 ? <p className="text-[11px] text-slate-300">—</p> : items.map((it) => <EventDot key={it.id} item={it} onOpen={() => it.event && onOpen(it.event)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Agenda ----

function Agenda({ cursor, byDate, onOpen }: { cursor: Date; byDate: Map<string, DisplayEvent[]>; onOpen: (ev: CalEvent) => void }) {
  // All days in the cursor's month that have items, in order.
  const days: { date: Date; items: DisplayEvent[] }[] = [];
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(year, month, day);
    const items = byDate.get(ymd(d)) ?? [];
    if (items.length) days.push({ date: d, items });
  }

  if (days.length === 0) return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="calendar" className="h-8 w-8" /></div>
      <p className="mt-4 text-lg font-semibold text-slate-800">Nothing scheduled</p>
      <p className="mt-1 text-sm text-slate-500">No events or task due dates this month.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {days.map(({ date, items }) => (
        <div key={ymd(date)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={`flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 ${isToday(date) ? "bg-blue-50" : "bg-slate-50"}`}>
            <span className={`flex h-9 w-9 flex-col items-center justify-center rounded-lg text-center ${isToday(date) ? "bg-blue-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
              <span className="text-sm font-bold leading-none">{date.getDate()}</span>
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{WEEKDAYS[date.getDay()]}, {MONTHS[date.getMonth()].slice(0, 3)} {date.getDate()}</p>
              <p className="text-xs text-slate-400">{items.length} item{items.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <ul className="divide-y divide-slate-50">
            {items.map((it) => (
              <li key={it.id}>
                <button onClick={() => it.event && onOpen(it.event)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${it.dot}`} />
                  <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{it.timeLabel}</span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-800">{it.title}</span>
                  {it.kind === "task" && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Task</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---- Selected day panel ----

function DayPanel({ date, items, onCreate, onOpen }: { date: Date; items: DisplayEvent[]; onCreate: () => void; onOpen: (ev: CalEvent) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{WEEKDAYS[date.getDay()]}</p>
          <p className="text-2xl font-bold text-slate-900">{MONTHS[date.getMonth()].slice(0, 3)} {date.getDate()}</p>
        </div>
        <button onClick={onCreate} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"><Icon name="folderPlus" className="h-3.5 w-3.5" /> Add</button>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
            <Icon name="calendar" className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No events</p>
          </div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="overflow-hidden rounded-xl border border-slate-100">
              <button onClick={() => it.event && onOpen(it.event)} className={`flex w-full items-start gap-2.5 p-2.5 text-left transition ${it.kind === "event" ? "hover:bg-slate-50" : "cursor-default"}`}>
                <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${it.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{it.title}</p>
                  <p className="text-xs text-slate-400">{it.timeLabel}{it.event?.location ? ` · ${it.event.location}` : ""}</p>
                </div>
                {it.kind === "task" && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Task</span>}
              </button>
              {it.event?.meetLink && (
                <a href={it.event.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 border-t border-slate-100 bg-blue-50/40 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50">
                  <Icon name="videoCam" className="h-3.5 w-3.5" /> Join Google Meet
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Event composer ----

function EventComposer({ editing, defaultDate, onClose, onSave, onDelete }: {
  editing: CalEvent | null; defaultDate: string;
  onClose: () => void; onSave: (draft: Omit<CalEvent, "id">, editingId?: string) => void; onDelete: (id: string) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [start, setStart] = useState(editing?.start ?? "09:00");
  const [end, setEnd] = useState(editing?.end ?? "10:00");
  const [category, setCategory] = useState(editing?.category ?? "Meeting");
  const [color, setColor] = useState(editing?.color ?? categoryColor("Meeting"));
  const [location, setLocation] = useState(editing?.location ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  function pickCategory(name: string) {
    setCategory(name);
    setColor(categoryColor(name));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return toast.error("Add a title", "Use at least 2 characters.");
    if (!date) return toast.error("Pick a date");
    if (!allDay && start && end && end <= start) return toast.error("Check the times", "End must be after start.");
    onSave(
      { title: title.trim(), date, allDay, start: allDay ? undefined : start, end: allDay ? undefined : end, category, color, location: location.trim() || undefined, description: description.trim() || undefined },
      editing?.id,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="no-scrollbar my-6 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? "Edit Event" : "New Event"}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Title <span className="text-rose-500">*</span></label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Team standup" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Category</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map((c) => (
                <button key={c.name} type="button" onClick={() => pickCategory(c.name)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === c.name ? colorBadge(c.color) + " ring-2 ring-offset-1 ring-blue-300" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colorDot(c.color)}`} />{c.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button key={c.key} type="button" onClick={() => setColor(c.key)} aria-label={c.label} className={`h-6 w-6 rounded-full ${c.dot} ring-2 ring-offset-1 transition ${color === c.key ? "ring-slate-400" : "ring-transparent"}`} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
            {!allDay && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Start</label>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">End</label>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
            All day
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, link or address" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Notes</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Agenda or details…" className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          {editing && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{fmtRange(editing)} · {editing.category}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {editing ? (
            <button type="button" onClick={() => { onDelete(editing.id); onClose(); }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
              <Icon name="trash" className="h-4 w-4" /> Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{editing ? "Save" : "Add Event"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function weekRangeLabel(cursor: Date): string {
  const days = weekDays(cursor);
  const a = days[0], b = days[6];
  if (a.getMonth() === b.getMonth()) return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${a.getFullYear()}`;
  return `${MONTHS[a.getMonth()].slice(0, 3)} ${a.getDate()} – ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getDate()}`;
}
