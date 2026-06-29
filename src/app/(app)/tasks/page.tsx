"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import MobileTasks from "@/components/mobile/MobileTasks";
import { getUser } from "@/lib/auth";
import { findUser, initialsOf, listDirectory } from "@/lib/directory";
import { COLORS, colorBadge, colorDot } from "@/lib/setup";
import {
  dueState,
  formatDue,
  loadPriorities,
  loadTasks,
  makeActivity,
  priorityMeta,
  relativeTime,
  savePriorities,
  saveTasks,
  statusMeta,
  STATUSES,
  type Priority,
  type Task,
  type TaskComment,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import {
  loadNotifs,
  loadPrefs,
  notif,
  pushPermission,
  pushSupported,
  requestPush,
  saveNotifs,
  savePrefs,
  sendEmail,
  sendPush,
  type Notif,
  type NotifPrefs,
} from "@/lib/notify";

type Actor = { email: string; name: string };
type View = "board" | "list";

export default function TasksPage() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [priorities, setPriorities] = useState<Priority[]>(loadPriorities);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [prefs, setPrefs] = useState<NotifPrefs>({ push: false, email: true });
  const [ready, setReady] = useState(false);

  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [fAssignee, setFAssignee] = useState("all");
  const [fPriority, setFPriority] = useState<"all" | TaskPriority>("all");

  const [composer, setComposer] = useState<{ open: boolean; editing: Task | null }>({ open: false, editing: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [managePriorities, setManagePriorities] = useState(false);

  const me: Actor = useMemo(() => {
    const u = getUser();
    return { email: u?.email || "admin@nexus.com", name: u?.name || "Admin" };
  }, []);

  useEffect(() => {
    setTasks(loadTasks());
    setPriorities(loadPriorities());
    setNotifs(loadNotifs());
    setPrefs(loadPrefs());
    setReady(true);
  }, []);
  useEffect(() => { if (ready) savePriorities(priorities); }, [priorities, ready]);
  useEffect(() => { if (ready) saveTasks(tasks); }, [tasks, ready]);
  useEffect(() => { if (ready) saveNotifs(notifs); }, [notifs, ready]);
  useEffect(() => { if (ready) savePrefs(prefs); }, [prefs, ready]);

  // ---- notifications dispatch ----
  function dispatch(title: string, body: string, taskId: string, recipients: string[]) {
    const entries: Notif[] = [];
    if (prefs.push && pushPermission() === "granted") {
      sendPush(title, body);
      entries.push(notif("push", title, body, taskId));
    }
    if (prefs.email && recipients.length) {
      entries.push({ ...sendEmail(recipients, title, body), taskId });
    }
    if (entries.length === 0) entries.push(notif("app", title, body, taskId));
    setNotifs((prev) => [...entries, ...prev].slice(0, 100));
  }

  function names(emails: string[]): string {
    const list = emails.map((e) => findUser(e)?.name ?? e);
    if (list.length === 0) return "nobody";
    if (list.length <= 2) return list.join(" & ");
    return `${list[0]}, ${list[1]} +${list.length - 2}`;
  }

  // ---- mutations ----
  function update(id: string, fn: (t: Task) => Task) {
    setTasks((list) => list.map((t) => (t.id === id ? fn(t) : t)));
  }

  function handleSave(draft: {
    title: string; description: string; status: TaskStatus; priority: TaskPriority;
    assigneeEmails: string[]; dueDate: string; tags: string[];
  }) {
    if (composer.editing) {
      const prev = composer.editing;
      update(prev.id, (t) => ({ ...t, ...draft, activity: [...t.activity, makeActivity("edit", me.name, "edited the task")] }));
      const added = draft.assigneeEmails.filter((e) => !prev.assigneeEmails.includes(e));
      if (added.length) dispatch(`Assigned: ${draft.title}`, `${me.name} assigned you to "${draft.title}".`, prev.id, added);
      toast.success("Task updated");
    } else {
      const id = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const task: Task = {
        id, ...draft,
        createdByName: me.name, createdByEmail: me.email,
        createdAt: new Date().toISOString(),
        comments: [],
        activity: [makeActivity("created", me.name, "created this task")],
      };
      setTasks((list) => [task, ...list]);
      if (draft.assigneeEmails.length)
        dispatch(`New task: ${draft.title}`, `${me.name} assigned you "${draft.title}".`, id, draft.assigneeEmails);
      toast.success("Task created", draft.assigneeEmails.length ? `Notified ${names(draft.assigneeEmails)}.` : undefined);
    }
    setComposer({ open: false, editing: null });
  }

  function moveStatus(id: string, status: TaskStatus) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    const meta = statusMeta(status);
    update(id, (x) => ({
      ...x, status,
      completedAt: status === "done" ? new Date().toISOString() : undefined,
      activity: [...x.activity, makeActivity("status", me.name, `moved it to ${meta.label}`)],
    }));
    if (t.assigneeEmails.length)
      dispatch(`Task ${meta.label}: ${t.title}`, `${me.name} moved "${t.title}" to ${meta.label}.`, id, t.assigneeEmails);
  }

  function setPriority(id: string, priority: TaskPriority) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.priority === priority) return;
    update(id, (x) => ({ ...x, priority, activity: [...x.activity, makeActivity("priority", me.name, `set priority to ${priorityMeta(priorities, priority).name}`)] }));
  }

  function setDue(id: string, dueDate: string) {
    update(id, (x) => ({ ...x, dueDate, activity: [...x.activity, makeActivity("due", me.name, dueDate ? `set due date to ${formatDue(dueDate)}` : "cleared the due date")] }));
  }

  function setAssignees(id: string, emails: string[]) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    update(id, (x) => ({ ...x, assigneeEmails: emails, activity: [...x.activity, makeActivity("assign", me.name, `updated assignees (${emails.length})`)] }));
    const added = emails.filter((e) => !t.assigneeEmails.includes(e));
    if (added.length) dispatch(`Assigned: ${t.title}`, `${me.name} assigned you "${t.title}".`, id, added);
  }

  function addComment(id: string, text: string) {
    const c: TaskComment = { id: `c-${Date.now()}`, authorEmail: me.email, authorName: me.name, text, createdAt: new Date().toISOString() };
    const t = tasks.find((x) => x.id === id);
    update(id, (x) => ({ ...x, comments: [...x.comments, c], activity: [...x.activity, makeActivity("comment", me.name, "commented")] }));
    if (t) dispatch(`New comment: ${t.title}`, `${me.name}: ${text.slice(0, 80)}`, id, t.assigneeEmails.filter((e) => e !== me.email));
  }

  function remove(id: string) {
    setTasks((list) => list.filter((t) => t.id !== id));
    setDetailId((d) => (d === id ? null : d));
    toast.info("Task deleted");
  }

  // ---- push permission ----
  async function enablePush() {
    const perm = await requestPush();
    if (perm === "granted") {
      setPrefs((p) => ({ ...p, push: true }));
      sendPush("Push enabled", "You'll get task notifications here.");
      toast.success("Push notifications on");
    } else {
      toast.error("Push blocked", "Allow notifications in your browser settings.");
    }
  }

  // ---- derived ----
  const assigneeOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => t.assigneeEmails.forEach((e) => set.add(e)));
    return [...set].map((e) => ({ email: e, name: findUser(e)?.name ?? e }));
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (fPriority !== "all" && t.priority !== fPriority) return false;
      if (fAssignee !== "all" && !t.assigneeEmails.includes(fAssignee)) return false;
      if (q && !(t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tg) => tg.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [tasks, query, fPriority, fAssignee]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => dueState(t) === "overdue").length;
    return { total, inProgress, done, overdue, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const unread = notifs.filter((n) => !n.read).length;
  const detail = detailId ? tasks.find((t) => t.id === detailId) ?? null : null;

  return (
    <>
      {/* Phones: card-feed task list. Desktop keeps the board / list views. */}
      <div className="lg:hidden">
        <MobileTasks />
      </div>
      <div className="hidden space-y-6 lg:block">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="task" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Task Tracker</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">Plan, assign and track your team&apos;s work — with push &amp; email notifications.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setManagePriorities(true)} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20">
              <Icon name="settings" className="h-4 w-4" />
              <span className="hidden sm:inline">Priorities</span>
            </button>
            <button onClick={() => setNotifOpen(true)} className="relative flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20">
              <Icon name="bell" className="h-4 w-4" />
              {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">{unread}</span>}
            </button>
            <button onClick={() => setComposer({ open: true, editing: null })} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              <Icon name="folderPlus" className="h-4 w-4" /> New Task
            </button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={stats.total} />
          <Stat label="In Progress" value={stats.inProgress} />
          <Stat label="Overdue" value={stats.overdue} highlight={stats.overdue > 0} />
          <Stat label="Completion" value={`${stats.pct}%`} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <Select value={fPriority} onChange={(v) => setFPriority(v as "all" | TaskPriority)} options={[{ value: "all", label: "All priorities" }, ...priorities.map((p) => ({ value: p.id, label: p.name }))]} />
          <Select value={fAssignee} onChange={setFAssignee} options={[{ value: "all", label: "All assignees" }, ...assigneeOptions.map((a) => ({ value: a.email, label: a.name }))]} />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <ViewBtn active={view === "board"} onClick={() => setView("board")} icon="grid" label="Board" />
          <ViewBtn active={view === "list"} onClick={() => setView("list")} icon="list" label="List" />
        </div>
      </div>

      {view === "board" ? (
        <Board tasks={filtered} priorities={priorities} onMove={moveStatus} onOpen={setDetailId} />
      ) : (
        <ListView tasks={filtered} priorities={priorities} onOpen={setDetailId} onMove={moveStatus} />
      )}

      {composer.open && (
        <Composer editing={composer.editing} priorities={priorities} onClose={() => setComposer({ open: false, editing: null })} onSave={handleSave} />
      )}
      {detail && (
        <DetailDrawer
          task={detail}
          priorities={priorities}
          onClose={() => setDetailId(null)}
          onEdit={() => setComposer({ open: true, editing: detail })}
          onDelete={() => remove(detail.id)}
          onStatus={(s) => moveStatus(detail.id, s)}
          onPriority={(p) => setPriority(detail.id, p)}
          onDue={(d) => setDue(detail.id, d)}
          onAssignees={(e) => setAssignees(detail.id, e)}
          onComment={(text) => addComment(detail.id, text)}
        />
      )}
      {managePriorities && (
        <PriorityManager
          priorities={priorities}
          tasks={tasks}
          me={me}
          onChange={setPriorities}
          onClose={() => setManagePriorities(false)}
        />
      )}
      {notifOpen && (
        <NotifCenter
          notifs={notifs} prefs={prefs}
          onClose={() => setNotifOpen(false)}
          onMarkAll={() => setNotifs((list) => list.map((n) => ({ ...n, read: true })))}
          onClear={() => setNotifs([])}
          onEnablePush={enablePush}
          onToggleEmail={() => setPrefs((p) => ({ ...p, email: !p.email }))}
          onTogglePush={() => prefs.push ? setPrefs((p) => ({ ...p, push: false })) : enablePush()}
          onOpenTask={(id) => { setNotifOpen(false); setDetailId(id); }}
        />
      )}
    </div>
    </>
  );
}

// ---- header bits ----

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-2 ring-1 backdrop-blur ${highlight ? "bg-rose-500/20 ring-rose-200/40" : "bg-white/10 ring-white/20"}`}>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <SearchableSelect value={value} onChange={onChange} options={options} className="w-44" />;
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon name={icon} className="h-4 w-4" /> {label}
    </button>
  );
}

// ---- Board (drag & drop) ----

function Board({ tasks, priorities, onMove, onOpen }: { tasks: Task[]; priorities: Priority[]; onMove: (id: string, s: TaskStatus) => void; onOpen: (id: string) => void }) {
  const [over, setOver] = useState<TaskStatus | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map((col) => {
        const items = tasks.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) onMove(id, col.key); setOver(null); }}
            className={`flex flex-col rounded-2xl border bg-slate-50/70 transition ${over === col.key ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"}`}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
            </div>
            <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 px-3 pb-3">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">Drop tasks here</p>
              ) : (
                items.map((t) => <TaskCard key={t.id} task={t} priorities={priorities} onOpen={() => onOpen(t.id)} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, priorities, onOpen }: { task: Task; priorities: Priority[]; onOpen: () => void }) {
  const p = priorityMeta(priorities, task.priority);
  const ds = dueState(task);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onOpen}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} /> {p.name}
        </span>
        {ds !== "none" && <DueBadge task={task} />}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800">{task.title}</p>
      {task.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>}
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tg) => <span key={tg} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{tg}</span>)}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <Avatars emails={task.assigneeEmails} />
        <div className="flex items-center gap-2 text-slate-400">
          {task.comments.length > 0 && <span className="flex items-center gap-1 text-xs"><Icon name="chat" className="h-3.5 w-3.5" />{task.comments.length}</span>}
        </div>
      </div>
    </div>
  );
}

function DueBadge({ task }: { task: Task }) {
  const ds = dueState(task);
  const cls = ds === "overdue" ? "bg-rose-100 text-rose-700" : ds === "today" ? "bg-amber-100 text-amber-700" : ds === "soon" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500";
  const label = ds === "overdue" ? `Overdue · ${formatDue(task.dueDate)}` : ds === "today" ? "Due today" : formatDue(task.dueDate);
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}><Icon name="calendar" className="h-3 w-3" />{label}</span>;
}

function Avatars({ emails }: { emails: string[] }) {
  if (emails.length === 0) return <span className="text-[11px] italic text-slate-400">Unassigned</span>;
  const shown = emails.slice(0, 3);
  return (
    <div className="flex -space-x-1.5">
      {shown.map((e) => {
        const u = findUser(e);
        return <span key={e} title={u?.name ?? e} className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[9px] font-bold text-white ring-2 ring-white">{initialsOf(u?.name ?? e)}</span>;
      })}
      {emails.length > 3 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white">+{emails.length - 3}</span>}
    </div>
  );
}

// ---- List view ----

function ListView({ tasks, priorities, onOpen, onMove }: { tasks: Task[]; priorities: Priority[]; onOpen: (id: string) => void; onMove: (id: string, s: TaskStatus) => void }) {
  if (tasks.length === 0) return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="task" className="h-8 w-8" /></div>
      <p className="mt-4 text-lg font-semibold text-slate-800">No tasks match</p>
      <p className="mt-1 text-sm text-slate-500">Adjust your search or filters.</p>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Task</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Priority</th>
            <th className="px-3 py-3">Assignees</th>
            <th className="px-3 py-3">Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const p = priorityMeta(priorities, t.priority);
            return (
              <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{t.title}</p>
                  {t.tags.length > 0 && <p className="mt-0.5 text-xs text-slate-400">{t.tags.join(" · ")}</p>}
                </td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <SearchableSelect
                    value={t.status}
                    onChange={(v) => onMove(t.id, v as TaskStatus)}
                    options={STATUSES.map((o) => ({ value: o.key, label: o.label }))}
                  />
                </td>
                <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />{p.name}</span></td>
                <td className="px-3 py-3"><Avatars emails={t.assigneeEmails} /></td>
                <td className="px-3 py-3">{dueState(t) !== "none" ? <DueBadge task={t} /> : <span className="text-xs text-slate-400">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Composer ----

function Composer({ editing, priorities, onClose, onSave }: {
  editing: Task | null; priorities: Priority[]; onClose: () => void;
  onSave: (d: { title: string; description: string; status: TaskStatus; priority: TaskPriority; assigneeEmails: string[]; dueDate: string; tags: string[] }) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(editing?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(editing?.priority ?? priorities.find((p) => p.id === "medium")?.id ?? priorities[0]?.id ?? "medium");
  const [assignees, setAssignees] = useState<string[]>(editing?.assigneeEmails ?? []);
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [tagsInput, setTagsInput] = useState((editing?.tags ?? []).join(", "));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return toast.error("Add a title", "Use at least 3 characters.");
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({ title: title.trim(), description: description.trim(), status, priority, assigneeEmails: assignees, dueDate, tags });
  }

  return (
    <ModalShell title={editing ? "Edit Task" : "New Task"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Title <span className="text-rose-500">*</span></label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Prepare Q3 sales deck" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Add details, links or acceptance criteria…" className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Status</label>
              <SearchableSelect value={status} onChange={(v) => setStatus(v as TaskStatus)} options={STATUSES.map((s) => ({ value: s.key, label: s.label }))} className="w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Priority</label>
            <div className="flex flex-wrap gap-2">
              {priorities.map((p) => (
                <button key={p.id} type="button" onClick={() => setPriority(p.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${priority === p.id ? colorBadge(p.color) + " ring-2 ring-offset-1 ring-blue-300" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colorDot(p.color)}`} />{p.name}
                </button>
              ))}
            </div>
          </div>
          <AssigneePicker assignees={assignees} onChange={setAssignees} />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Tags <span className="text-slate-400">(comma separated)</span></label>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Sales, Urgent, Q3" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          {assignees.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Icon name="bell" className="h-3.5 w-3.5" /> {assignees.length} assignee{assignees.length > 1 ? "s" : ""} will be notified on save.
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{editing ? "Save Changes" : "Create Task"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function AssigneePicker({ assignees, onChange }: { assignees: string[]; onChange: (e: string[]) => void }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return listDirectory().filter((u) => u.name.toLowerCase().includes(t) || u.department.toLowerCase().includes(t)).filter((u) => !assignees.includes(u.email)).slice(0, 6);
  }, [q, assignees]);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">Assignees</label>
      {assignees.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {assignees.map((e) => {
            const u = findUser(e);
            return (
              <span key={e} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[9px] font-bold text-white">{initialsOf(u?.name ?? e)}</span>
                {u?.name ?? e}
                <button type="button" onClick={() => onChange(assignees.filter((x) => x !== e))} aria-label="Remove"><Icon name="close" className="h-3 w-3 text-slate-400 hover:text-rose-500" /></button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search and assign a person…" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-2 text-sm outline-none focus:border-blue-500" />
        {matches.length > 0 && (
          <div className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {matches.map((u) => (
              <button key={u.email} type="button" onClick={() => { onChange([...assignees, u.email]); setQ(""); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{initialsOf(u.name)}</span>
                <span className="min-w-0"><span className="block truncate text-slate-700">{u.name}</span><span className="block truncate text-xs text-slate-400">{u.department}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Detail drawer ----

function DetailDrawer({ task, priorities, onClose, onEdit, onDelete, onStatus, onPriority, onDue, onAssignees, onComment }: {
  task: Task; priorities: Priority[]; onClose: () => void; onEdit: () => void; onDelete: () => void;
  onStatus: (s: TaskStatus) => void; onPriority: (p: TaskPriority) => void; onDue: (d: string) => void;
  onAssignees: (e: string[]) => void; onComment: (text: string) => void;
}) {
  const [tab, setTab] = useState<"details" | "activity">("details");
  const [comment, setComment] = useState("");
  const s = statusMeta(task.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="no-scrollbar flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onEdit} aria-label="Edit" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="edit" className="h-4 w-4" /></button>
              <button onClick={onDelete} aria-label="Delete" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="trash" className="h-4 w-4" /></button>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
            </div>
          </div>
          <h2 className="relative mt-3 text-lg font-bold">{task.title}</h2>
          <p className="relative mt-0.5 text-xs text-blue-100">Created by {task.createdByName} · {relativeTime(task.createdAt)}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 px-6">
          <DTab active={tab === "details"} onClick={() => setTab("details")} label="Details" />
          <DTab active={tab === "activity"} onClick={() => setTab("activity")} label={`Activity (${task.activity.length})`} />
        </div>

        {tab === "details" ? (
          <div className="space-y-5 px-6 py-5">
            {task.description && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{task.description}</p>}

            <div className="grid grid-cols-2 gap-4">
              <Prop label="Status">
                <SearchableSelect value={task.status} onChange={(v) => onStatus(v as TaskStatus)} options={STATUSES.map((o) => ({ value: o.key, label: o.label }))} className="w-full" />
              </Prop>
              <Prop label="Priority">
                <SearchableSelect value={task.priority} onChange={(v) => onPriority(v as TaskPriority)} options={priorities.map((o) => ({ value: o.id, label: o.name }))} className="w-full" />
              </Prop>
              <Prop label="Due date">
                <input type="date" value={task.dueDate} onChange={(e) => onDue(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none" />
              </Prop>
              <Prop label="Tags">
                <div className="flex flex-wrap gap-1 pt-1">{task.tags.length ? task.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{t}</span>) : <span className="text-xs text-slate-400">None</span>}</div>
              </Prop>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Assignees</p>
              <AssigneePicker assignees={task.assigneeEmails} onChange={onAssignees} />
            </div>

            {/* Comments */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Comments ({task.comments.length})</p>
              <ul className="space-y-3">
                {task.comments.length === 0 ? <li className="text-sm text-slate-400">No comments yet.</li> : task.comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{initialsOf(c.authorName)}</span>
                    <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-800">{c.authorName}</span><span className="text-xs text-slate-400">{relativeTime(c.createdAt)}</span></div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => { e.preventDefault(); const t = comment.trim(); if (t) { onComment(t); setComment(""); } }} className="mt-3 flex items-end gap-2">
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const t = comment.trim(); if (t) { onComment(t); setComment(""); } } }} rows={1} placeholder="Write a comment…" className="min-h-[40px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                <button type="submit" disabled={!comment.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40">Send</button>
              </form>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5">
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {[...task.activity].reverse().map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[23px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 ring-4 ring-white" />
                  <p className="text-sm text-slate-700"><strong>{a.actorName}</strong> {a.message}</p>
                  <p className="text-xs text-slate-400">{relativeTime(a.at)}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>{children}</div>;
}
function DTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`-mb-px border-b-2 px-1 py-3 text-sm font-semibold transition ${active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{label}</button>;
}

// ---- Notification center ----

function NotifCenter({ notifs, prefs, onClose, onMarkAll, onClear, onEnablePush, onToggleEmail, onTogglePush, onOpenTask }: {
  notifs: Notif[]; prefs: NotifPrefs; onClose: () => void; onMarkAll: () => void; onClear: () => void;
  onEnablePush: () => void; onToggleEmail: () => void; onTogglePush: () => void; onOpenTask: (id: string) => void;
}) {
  const perm = pushSupported() ? pushPermission() : "denied";
  const channelIcon: Record<Notif["channel"], IconName> = { push: "bell", email: "gmail", app: "message" };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="no-scrollbar flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Icon name="bell" className="h-5 w-5 text-blue-600" /> Notifications</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button>
        </div>

        {/* Settings */}
        <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Delivery</p>
          <Toggle icon="bell" label="Browser push" sub={!pushSupported() ? "Not supported" : perm === "denied" ? "Blocked in browser" : prefs.push ? "On" : "Off"} on={prefs.push && perm === "granted"} onClick={onTogglePush} disabled={!pushSupported() || perm === "denied"} />
          <Toggle icon="gmail" label="Email notifications" sub={prefs.email ? "On" : "Off"} on={prefs.email} onClick={onToggleEmail} />
          {pushSupported() && perm === "default" && (
            <button onClick={onEnablePush} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Enable browser push</button>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 text-xs">
          <span className="text-slate-400">{notifs.length} notification{notifs.length === 1 ? "" : "s"}</span>
          <div className="flex gap-3">
            <button onClick={onMarkAll} className="font-semibold text-blue-600 hover:underline">Mark all read</button>
            <button onClick={onClear} className="font-semibold text-slate-400 hover:text-slate-600">Clear</button>
          </div>
        </div>

        <ul className="flex-1 divide-y divide-slate-100">
          {notifs.length === 0 ? (
            <li className="flex flex-col items-center justify-center py-16 text-center"><Icon name="bell" className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-400">You&apos;re all caught up.</p></li>
          ) : (
            notifs.map((n) => (
              <li key={n.id}>
                <button onClick={() => n.taskId && onOpenTask(n.taskId)} className={`flex w-full gap-3 px-5 py-3 text-left transition hover:bg-slate-50 ${n.read ? "" : "bg-blue-50/40"}`}>
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.channel === "email" ? "bg-violet-100 text-violet-600" : n.channel === "push" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                    <Icon name={channelIcon[n.channel]} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><span className="uppercase tracking-wide">{n.channel}</span> · {relativeTime(n.at)}</p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Toggle({ icon, label, sub, on, onClick, disabled }: { icon: IconName; label: string; sub: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200"><Icon name={icon} className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400">{sub}</p></div>
      <button onClick={onClick} disabled={disabled} aria-pressed={on} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue-600" : "bg-slate-300"} ${disabled ? "opacity-40" : ""}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

// ---- Modal shell ----

// ---- Priority manager (user-created priorities + colours) ----

function PriorityManager({ priorities, tasks, me, onChange, onClose }: {
  priorities: Priority[]; tasks: Task[]; me: Actor; onChange: (p: Priority[]) => void; onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("indigo");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (priorities.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return toast.error("Already exists", `"${trimmed}" is already a priority.`);
    const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
    onChange([...priorities, { id, name: trimmed, color, createdBy: me.name, createdAt: new Date().toISOString() }]);
    setName("");
    toast.success("Priority added", trimmed);
  }
  function remove(p: Priority) {
    if (priorities.length <= 1) return toast.error("Keep at least one", "You need at least one priority.");
    const used = tasks.filter((t) => t.priority === p.id).length;
    if (used > 0) return toast.error("Priority in use", `${used} task${used > 1 ? "s" : ""} still use "${p.name}".`);
    onChange(priorities.filter((x) => x.id !== p.id));
  }

  return (
    <ModalShell title="Manage Priorities" onClose={onClose}>
      <div className="space-y-5 px-6 py-6">
        <form onSubmit={add} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">New priority</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Critical, Blocker, P1" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Colour</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c.key} type="button" onClick={() => setColor(c.key)} aria-label={c.label} title={c.label} className={`h-7 w-7 rounded-full ${c.dot} ring-2 ring-offset-2 transition ${color === c.key ? "ring-slate-400" : "ring-transparent"}`} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${colorBadge(color)}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${colorDot(color)}`} /> {name.trim() || "Preview"}
            </span>
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Icon name="folderPlus" className="h-4 w-4" /> Add priority
            </button>
          </div>
        </form>

        <ul className="space-y-2">
          {priorities.map((p) => {
            const used = tasks.filter((t) => t.priority === p.id).length;
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${colorBadge(p.color)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colorDot(p.color)}`} /> {p.name}
                </span>
                <span className="text-xs text-slate-400">{used} task{used === 1 ? "" : "s"}</span>
                <span className="ml-auto text-xs text-slate-400">by {p.createdBy}</span>
                <button onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <button onClick={onClose} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Done</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="no-scrollbar my-6 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
