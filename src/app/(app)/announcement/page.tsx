"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { COLORS, colorBadge, colorDot } from "@/lib/setup";
import {
  directoryDepartments,
  findUser,
  initialsOf,
  listDirectory,
  type DirectoryUser,
} from "@/lib/directory";
import {
  audienceLabel,
  audienceSize,
  categoryStyle,
  formatBytes,
  isVisibleTo,
  loadAnnouncements,
  loadCategories,
  MAX_ATTACHMENT_BYTES,
  relativeTime,
  resolveRecipients,
  saveAnnouncements,
  saveCategories,
  stripHtml,
  type Announcement,
  type Attachment,
  type Audience,
  type Category,
  type Comment,
} from "@/lib/announcements";

type Viewer = { email: string; name: string };

export default function AnnouncementPage() {
  const toast = useToast();
  const [items, setItems] = useState<Announcement[]>(loadAnnouncements);
  const [categories, setCategories] = useState<Category[]>(loadCategories);
  const [ready, setReady] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("All"); // category id or "All"
  const [viewAs, setViewAs] = useState(""); // "" = admin (you)

  const [composer, setComposer] = useState<{ open: boolean; editing: Announcement | null }>({
    open: false,
    editing: null,
  });
  const [manageCats, setManageCats] = useState(false);
  const [tracking, setTracking] = useState<Announcement | null>(null);
  const [thread, setThread] = useState<string | null>(null); // announcement id

  // The logged-in account is the admin/author.
  const admin: Viewer = useMemo(() => {
    const u = getUser();
    return { email: u?.email || "admin@nexus.com", name: u?.name || "Admin" };
  }, []);
  const viewer: Viewer = useMemo(() => {
    if (!viewAs) return admin;
    const u = findUser(viewAs);
    return u ? { email: u.email, name: u.name } : admin;
  }, [viewAs, admin]);
  const isAdminView = !viewAs;

  // localStorage is client-only — re-read on mount, then persist on change.
  useEffect(() => {
    setItems(loadAnnouncements());
    setCategories(loadCategories());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveAnnouncements(items);
  }, [items, ready]);
  useEffect(() => {
    if (ready) saveCategories(categories);
  }, [categories, ready]);

  // When previewing as a recipient, mark everything in their feed as "seen".
  useEffect(() => {
    if (isAdminView) return;
    const email = viewer.email;
    setItems((list) => {
      let changed = false;
      const next = list.map((a) => {
        if (isVisibleTo(a, email) && !a.reads[email]) {
          changed = true;
          return { ...a, reads: { ...a.reads, [email]: { readAt: new Date().toISOString() } } };
        }
        return a;
      });
      return changed ? next : list;
    });
  }, [viewAs, isAdminView, viewer.email]);

  const counts = useMemo(() => {
    const pinned = items.filter((a) => a.pinned).length;
    const engagement = items.reduce((n, a) => n + a.likes.length + a.comments.length, 0);
    return { total: items.length, pinned, engagement };
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) => (isAdminView ? true : isVisibleTo(a, viewer.email)))
      .filter((a) => (filter === "All" ? true : a.categoryId === filter))
      .filter(
        (a) =>
          !q ||
          a.title.toLowerCase().includes(q) ||
          stripHtml(a.body).toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [items, query, filter, isAdminView, viewer.email]);

  // ---- mutations ----
  function handleSave(draft: {
    title: string;
    body: string;
    categoryId: string;
    attachments: Attachment[];
    audience: Audience;
  }) {
    if (composer.editing) {
      setItems((list) => list.map((a) => (a.id === composer.editing!.id ? { ...a, ...draft } : a)));
      toast.success("Announcement updated");
    } else {
      const created: Announcement = {
        id: `a-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...draft,
        author: admin.name,
        authorEmail: admin.email,
        pinned: false,
        createdAt: new Date().toISOString(),
        reads: {},
        likes: [],
        comments: [],
      };
      setItems((list) => [created, ...list]);
      const size = audienceSize(draft.audience);
      toast.success("Announcement published", size === "all" ? "Sent to everyone." : `Sent to ~${size} people.`);
    }
    setComposer({ open: false, editing: null });
  }

  const update = (id: string, fn: (a: Announcement) => Announcement) =>
    setItems((list) => list.map((a) => (a.id === id ? fn(a) : a)));

  function toggleLike(a: Announcement) {
    const email = viewer.email;
    update(a.id, (x) => ({
      ...x,
      likes: x.likes.includes(email) ? x.likes.filter((e) => e !== email) : [...x.likes, email],
    }));
  }

  function acknowledge(a: Announcement) {
    const email = viewer.email;
    const now = new Date().toISOString();
    update(a.id, (x) => ({
      ...x,
      reads: { ...x.reads, [email]: { readAt: x.reads[email]?.readAt ?? now, acknowledgedAt: now } },
    }));
    toast.success("Acknowledged", "Thanks — your confirmation was recorded.");
  }

  function addComment(id: string, text: string) {
    const c: Comment = {
      id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      authorEmail: viewer.email,
      authorName: viewer.name,
      text,
      createdAt: new Date().toISOString(),
    };
    update(id, (x) => ({ ...x, comments: [...x.comments, c] }));
  }
  function deleteComment(id: string, commentId: string) {
    update(id, (x) => ({ ...x, comments: x.comments.filter((c) => c.id !== commentId) }));
  }

  const threadItem = thread ? items.find((a) => a.id === thread) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Hero / header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="announcement" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Announcements</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                Target updates by department or person, then track reads, acknowledgements and engagement.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setManageCats(true)}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
            >
              <Icon name="settings" className="h-4 w-4" />
              Categories
            </button>
            <button
              onClick={() => setComposer({ open: true, editing: null })}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              <Icon name="folderPlus" className="h-4 w-4" />
              New Announcement
            </button>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Stat label="Total" value={counts.total} />
            <Stat label="Pinned" value={counts.pinned} />
            <Stat label="Engagement" value={counts.engagement} />
          </div>
          <ViewAsSwitcher viewAs={viewAs} onChange={setViewAs} admin={admin} />
        </div>
      </div>

      {/* Preview banner when impersonating a recipient */}
      {!isAdminView && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Icon name="eye" className="h-4 w-4" />
          Previewing as <strong>{viewer.name}</strong> — you only see announcements targeted to them.
          <button onClick={() => setViewAs("")} className="ml-auto font-semibold text-amber-700 hover:underline">
            Exit preview
          </button>
        </div>
      )}

      {/* Toolbar: search + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search announcements…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          <FilterPill label="All" active={filter === "All"} onClick={() => setFilter("All")} />
          {categories.map((c) => (
            <FilterPill key={c.id} label={c.name} dot={colorDot(c.color)} active={filter === c.id} onClick={() => setFilter(c.id)} />
          ))}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <EmptyState
          hasAny={items.length > 0}
          onCreate={() => setComposer({ open: true, editing: null })}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((a) => (
            <Card
              key={a.id}
              a={a}
              categories={categories}
              viewer={viewer}
              isAdminView={isAdminView}
              onPin={() => update(a.id, (x) => ({ ...x, pinned: !x.pinned }))}
              onEdit={() => setComposer({ open: true, editing: a })}
              onDelete={() => { setItems((l) => l.filter((x) => x.id !== a.id)); toast.info("Announcement deleted"); }}
              onLike={() => toggleLike(a)}
              onAck={() => acknowledge(a)}
              onComments={() => setThread(a.id)}
              onTracking={() => setTracking(a)}
            />
          ))}
        </div>
      )}

      {composer.open && (
        <Composer
          editing={composer.editing}
          categories={categories}
          onClose={() => setComposer({ open: false, editing: null })}
          onSave={handleSave}
        />
      )}
      {manageCats && (
        <CategoryManager
          categories={categories}
          items={items}
          admin={admin}
          onChange={setCategories}
          onClose={() => setManageCats(false)}
        />
      )}
      {tracking && (
        <TrackingModal a={tracking} categories={categories} onClose={() => setTracking(null)} />
      )}
      {threadItem && (
        <CommentThread
          a={threadItem}
          viewer={viewer}
          onAdd={(text) => addComment(threadItem.id, text)}
          onDelete={(cid) => deleteComment(threadItem.id, cid)}
          onClose={() => setThread(null)}
        />
      )}
    </div>
  );
}

// ---- small shared bits ------------------------------------------------------

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

function FilterPill({ label, dot, active, onClick }: { label: string; dot?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white/80" : dot}`} />}
      {label}
    </button>
  );
}

function ViewAsSwitcher({ viewAs, onChange, admin }: { viewAs: string; onChange: (v: string) => void; admin: Viewer }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = viewAs ? findUser(viewAs)?.name ?? "User" : `${admin.name} (admin)`;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return listDirectory().filter((u) => !t || u.name.toLowerCase().includes(t) || u.department.toLowerCase().includes(t)).slice(0, 40);
  }, [q]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
      >
        <Icon name="eye" className="h-4 w-4" />
        <span className="max-w-[160px] truncate">View as: {current}</span>
        <Icon name="chevronDown" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl">
            <div className="relative mb-1">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people…"
                className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${!viewAs ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-50"}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">{initialsOf(admin.name)}</span>
              {admin.name} (admin — sees all)
            </button>
            <div className="no-scrollbar mt-1 max-h-60 overflow-y-auto">
              {filtered.map((u) => (
                <button
                  key={u.email}
                  onClick={() => { onChange(u.email); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${viewAs === u.email ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{initialsOf(u.name)}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{u.name}</span>
                    <span className="block truncate text-xs text-slate-400">{u.department}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function fileIcon(type: string): IconName {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "fileText";
}

// ---- Card -------------------------------------------------------------------

function Card({
  a,
  categories,
  viewer,
  isAdminView,
  onPin,
  onEdit,
  onDelete,
  onLike,
  onAck,
  onComments,
  onTracking,
}: {
  a: Announcement;
  categories: Category[];
  viewer: Viewer;
  isAdminView: boolean;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLike: () => void;
  onAck: () => void;
  onComments: () => void;
  onTracking: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const cat = categoryStyle(categories, a.categoryId);
  const liked = a.likes.includes(viewer.email);
  const acknowledged = !!a.reads[viewer.email]?.acknowledgedAt;
  const readCount = Object.keys(a.reads).length;
  const ackCount = Object.values(a.reads).filter((r) => r.acknowledgedAt).length;

  return (
    <div className={`group relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${a.pinned ? "border-blue-200 ring-1 ring-blue-100" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cat.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} />
            {cat.name}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500" title="Audience">
            <Icon name="users" className="h-3 w-3" />
            {audienceLabel(a.audience)}
          </span>
          {a.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600">
              <Icon name="pin" className="h-3 w-3" /> Pinned
            </span>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} aria-label="Actions" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <Icon name="more" className="h-5 w-5" filled />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <MenuItem icon="eye" label="View tracking" onClick={() => { onTracking(); setMenu(false); }} />
                <MenuItem icon="pin" label={a.pinned ? "Unpin" : "Pin to top"} onClick={() => { onPin(); setMenu(false); }} />
                <MenuItem icon="edit" label="Edit" onClick={() => { onEdit(); setMenu(false); }} />
                <MenuItem icon="trash" label="Delete" danger onClick={() => { onDelete(); setMenu(false); }} />
              </div>
            </>
          )}
        </div>
      </div>

      <h3 className="mt-3 text-base font-semibold text-slate-900">{a.title}</h3>
      <div className="announcement-body mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: a.body }} />

      {a.attachments.length > 0 && <AttachmentList items={a.attachments} />}

      {/* Author + time */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{initialsOf(a.author)}</span>
          <span className="text-xs font-medium text-slate-600">{a.author}</span>
        </div>
        <span className="text-xs text-slate-400">{relativeTime(a.createdAt)}</span>
      </div>

      {/* Engagement bar */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${liked ? "bg-rose-50 text-rose-600" : "text-slate-500 hover:bg-slate-50"}`}
        >
          <HeartIcon filled={liked} className="h-4 w-4" />
          {a.likes.length > 0 && a.likes.length}
          <span className={a.likes.length > 0 ? "sr-only" : ""}>Like</span>
        </button>
        <button onClick={onComments} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50">
          <Icon name="chat" className="h-4 w-4" />
          {a.comments.length > 0 ? a.comments.length : "Comment"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {isAdminView ? (
            <button onClick={onTracking} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100">
              <Icon name="eye" className="h-3.5 w-3.5" />
              {readCount} read · {ackCount} ack
            </button>
          ) : acknowledged ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
              <Icon name="task" className="h-3.5 w-3.5" /> Acknowledged
            </span>
          ) : (
            <button onClick={onAck} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">
              <Icon name="task" className="h-3.5 w-3.5" /> Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HeartIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.5 1.1-1a5.5 5.5 0 0 0 0-7.9z" />
    </svg>
  );
}

function AttachmentList({ items }: { items: Attachment[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((f) => {
        const isImg = f.type.startsWith("image/");
        return (
          <a key={f.id} href={f.dataUrl} download={f.name} title={`${f.name} · ${formatBytes(f.size)}`} className="flex max-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-2.5 text-xs transition hover:border-blue-300 hover:bg-blue-50">
            {isImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.dataUrl} alt={f.name} className="h-7 w-7 shrink-0 rounded object-cover" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white text-slate-500">
                <Icon name={fileIcon(f.type)} className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-700">{f.name}</span>
              <span className="block text-[10px] text-slate-400">{formatBytes(f.size)}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

function MenuItem({ icon, label, danger, onClick }: { icon: IconName; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"}`}>
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );
}

function EmptyState({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon name="announcement" className="h-8 w-8" />
      </div>
      <p className="mt-4 text-lg font-semibold text-slate-800">{hasAny ? "Nothing here" : "No announcements yet"}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{hasAny ? "No announcements match this view, search or filter." : "Post your first update to keep the team in the loop."}</p>
      {!hasAny && (
        <button onClick={onCreate} className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <Icon name="folderPlus" className="h-4 w-4" /> New Announcement
        </button>
      )}
    </div>
  );
}

// ---- Modal shell ------------------------------------------------------------

function Modal({ title, onClose, children, footer, max = "max-w-xl" }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; max?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className={`no-scrollbar my-6 w-full ${max} overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5`}>
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>
        {children}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Composer ---------------------------------------------------------------

function Composer({
  editing,
  categories,
  onClose,
  onSave,
}: {
  editing: Announcement | null;
  categories: Category[];
  onClose: () => void;
  onSave: (draft: { title: string; body: string; categoryId: string; attachments: Attachment[]; audience: Audience }) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? categories[0]?.id ?? "general");
  const [attachments, setAttachments] = useState<Attachment[]>(editing?.attachments ?? []);
  const [audience, setAudience] = useState<Audience>(editing?.audience ?? { kind: "everyone" });
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = editing?.body ?? "";
  }, [editing]);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }
  function addLink() {
    const url = window.prompt("Link URL", "https://");
    if (url) exec("createLink", url);
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error("File too large", `"${file.name}" exceeds ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
        continue;
      }
      try {
        const dataUrl = await readAsDataUrl(file);
        next.push({ id: `f-${Date.now()}-${Math.floor(Math.random() * 100000)}`, name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl });
      } catch {
        toast.error("Couldn't attach", file.name);
      }
    }
    if (next.length) setAttachments((a) => [...a, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const html = editorRef.current?.innerHTML ?? "";
    if (title.trim().length < 3) return toast.error("Add a title", "Use at least 3 characters.");
    if (stripHtml(html).length < 5) return toast.error("Add some details", "The message body is too short.");
    if (audience.kind === "custom" && audience.departments.length === 0 && audience.userEmails.length === 0)
      return toast.error("Pick an audience", "Choose departments or people, or send to everyone.");
    onSave({ title: title.trim(), body: html, categoryId, attachments, audience });
  }

  const size = audienceSize(audience);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="no-scrollbar my-6 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? "Edit Announcement" : "New Announcement"}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Title <span className="text-rose-500">*</span></label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Office closed for the holidays" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? colorBadge(c.color) + " ring-2 ring-offset-1 ring-blue-300" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${colorDot(c.color)}`} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audience */}
          <AudiencePicker audience={audience} onChange={setAudience} size={size} />

          {/* Rich text editor */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Message <span className="text-rose-500">*</span></label>
            <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
                <ToolBtn label="Bold" onClick={() => exec("bold")}><span className="font-bold">B</span></ToolBtn>
                <ToolBtn label="Italic" onClick={() => exec("italic")}><span className="italic">I</span></ToolBtn>
                <ToolBtn label="Underline" onClick={() => exec("underline")}><span className="underline">U</span></ToolBtn>
                <Divider />
                <ToolBtn label="Bulleted list" onClick={() => exec("insertUnorderedList")}><Icon name="list" className="h-4 w-4" /></ToolBtn>
                <ToolBtn label="Numbered list" onClick={() => exec("insertOrderedList")}><span className="text-[11px] font-semibold">1.</span></ToolBtn>
                <Divider />
                <ToolBtn label="Add link" onClick={addLink}><span className="text-xs font-semibold underline">Link</span></ToolBtn>
                <ToolBtn label="Clear formatting" onClick={() => exec("removeFormat")}><span className="text-[11px] font-semibold">T×</span></ToolBtn>
              </div>
              <div ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder="Write the announcement details…" className="announcement-body announcement-editor min-h-[140px] max-h-72 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-slate-700 outline-none" />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-500">Attachments {attachments.length > 0 && <span className="text-slate-400">· {attachments.length}</span>}</label>
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                <Icon name="upload" className="h-3.5 w-3.5" /> Add files
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </div>
            {attachments.length === 0 ? (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-5 text-center transition hover:border-blue-400 hover:bg-blue-50/40">
                <Icon name="upload" className="h-5 w-5 text-slate-400" />
                <span className="text-xs text-slate-500">Click to attach files <span className="text-slate-400">(up to {formatBytes(MAX_ATTACHMENT_BYTES)} each)</span></span>
              </button>
            ) : (
              <ul className="space-y-2">
                {attachments.map((f) => {
                  const isImg = f.type.startsWith("image/");
                  return (
                    <li key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      {isImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.dataUrl} alt={f.name} className="h-9 w-9 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white text-slate-500"><Icon name={fileIcon(f.type)} className="h-4 w-4" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">{f.name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(f.size)}</p>
                      </div>
                      <button type="button" onClick={() => setAttachments((a) => a.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`} className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                        <Icon name="close" className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{editing ? "Save Changes" : "Publish"}</button>
        </div>
      </form>
    </div>
  );
}

function AudiencePicker({ audience, onChange, size }: { audience: Audience; onChange: (a: Audience) => void; size: number | "all" }) {
  const [q, setQ] = useState("");
  const depts = directoryDepartments();
  const custom = audience.kind === "custom" ? audience : { kind: "custom" as const, departments: [], userEmails: [] };

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return listDirectory().filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)).slice(0, 6);
  }, [q]);

  function toggleDept(d: string) {
    const set = new Set(custom.departments);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange({ kind: "custom", departments: [...set], userEmails: custom.userEmails });
  }
  function addUser(u: DirectoryUser) {
    if (custom.userEmails.includes(u.email)) return;
    onChange({ kind: "custom", departments: custom.departments, userEmails: [...custom.userEmails, u.email] });
    setQ("");
  }
  function removeUser(email: string) {
    onChange({ kind: "custom", departments: custom.departments, userEmails: custom.userEmails.filter((e) => e !== email) });
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">Audience</label>
      <div className="flex gap-2">
        <SegBtn active={audience.kind === "everyone"} onClick={() => onChange({ kind: "everyone" })} icon="users" label="Everyone" />
        <SegBtn active={audience.kind === "custom"} onClick={() => onChange(custom)} icon="leads" label="Departments & people" />
      </div>

      {audience.kind === "custom" && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Departments</p>
            <div className="flex flex-wrap gap-1.5">
              {depts.map((d) => {
                const on = custom.departments.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggleDept(d)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${on ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Specific people</p>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search and add a person…" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-blue-500" />
            </div>
            {matches.length > 0 && (
              <div className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {matches.map((u) => (
                  <button key={u.email} type="button" onClick={() => addUser(u)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{initialsOf(u.name)}</span>
                    <span className="min-w-0"><span className="block truncate text-slate-700">{u.name}</span><span className="block truncate text-xs text-slate-400">{u.department}</span></span>
                  </button>
                ))}
              </div>
            )}
            {custom.userEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {custom.userEmails.map((e) => {
                  const u = findUser(e);
                  return (
                    <span key={e} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                      {u?.name ?? e}
                      <button type="button" onClick={() => removeUser(e)} aria-label="Remove"><Icon name="close" className="h-3 w-3 text-slate-400 hover:text-rose-500" /></button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        <Icon name="users" className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-slate-400" />
        {size === "all" ? "Visible to everyone in the directory" : `Reaches about ${size} ${size === 1 ? "person" : "people"}`}
      </p>
    </div>
  );
}

function SegBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="flex h-7 min-w-[28px] items-center justify-center rounded px-1.5 text-slate-600 transition hover:bg-slate-200">
      {children}
    </button>
  );
}
function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-slate-200" />;
}

// ---- Category manager -------------------------------------------------------

function CategoryManager({
  categories,
  items,
  admin,
  onChange,
  onClose,
}: {
  categories: Category[];
  items: Announcement[];
  admin: Viewer;
  onChange: (c: Category[]) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return toast.error("Already exists", `"${trimmed}" is already a category.`);
    const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
    onChange([...categories, { id, name: trimmed, color, createdBy: admin.name, createdAt: new Date().toISOString() }]);
    setName("");
    toast.success("Category added", trimmed);
  }
  function remove(c: Category) {
    const used = items.filter((a) => a.categoryId === c.id).length;
    if (used > 0) return toast.error("Category in use", `${used} announcement${used > 1 ? "s" : ""} still use "${c.name}".`);
    onChange(categories.filter((x) => x.id !== c.id));
  }

  return (
    <Modal title="Manage Categories" onClose={onClose} footer={<button onClick={onClose} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Done</button>}>
      <div className="space-y-5 px-6 py-6">
        <form onSubmit={add} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">New category</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maintenance" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Colour</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c.key} type="button" onClick={() => setColor(c.key)} aria-label={c.label} className={`h-7 w-7 rounded-full ${c.dot} ring-2 ring-offset-2 transition ${color === c.key ? "ring-slate-400" : "ring-transparent"}`} />
              ))}
            </div>
          </div>
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Icon name="folderPlus" className="h-4 w-4" /> Add category
          </button>
        </form>

        <ul className="space-y-2">
          {categories.map((c) => {
            const used = items.filter((a) => a.categoryId === c.id).length;
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${colorBadge(c.color)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colorDot(c.color)}`} /> {c.name}
                </span>
                <span className="text-xs text-slate-400">{used} announcement{used === 1 ? "" : "s"}</span>
                <span className="ml-auto text-xs text-slate-400">by {c.createdBy}</span>
                <button onClick={() => remove(c)} aria-label={`Delete ${c.name}`} className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

// ---- Tracking ---------------------------------------------------------------

function TrackingModal({ a, categories, onClose }: { a: Announcement; categories: Category[]; onClose: () => void }) {
  const [tab, setTab] = useState<"read" | "pending" | "acks" | "likes">("read");
  const cat = categoryStyle(categories, a.categoryId);
  const recipients = useMemo(() => resolveRecipients(a), [a]);
  const total = recipients.length;
  const readEmails = new Set(Object.keys(a.reads));
  const readBy = recipients.filter((u) => readEmails.has(u.email));
  const pending = recipients.filter((u) => !readEmails.has(u.email));
  const ackBy = recipients.filter((u) => a.reads[u.email]?.acknowledgedAt);
  const likedBy = a.likes.map((e) => findUser(e)).filter(Boolean) as DirectoryUser[];

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const list =
    tab === "read" ? readBy : tab === "pending" ? pending : tab === "acks" ? ackBy : likedBy;

  return (
    <Modal title="Announcement Tracking" onClose={onClose} max="max-w-lg" footer={<button onClick={onClose} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Close</button>}>
      <div className="px-6 py-5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cat.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} /> {cat.name}
        </span>
        <h3 className="mt-2 text-base font-semibold text-slate-900">{a.title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">Audience: {audienceLabel(a.audience)} · {total} recipients</p>

        {/* Summary bars */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Read" value={readBy.length} pct={pct(readBy.length)} color="bg-blue-500" />
          <Metric label="Acknowledged" value={ackBy.length} pct={pct(ackBy.length)} color="bg-emerald-500" />
          <Metric label="Likes" value={a.likes.length} pct={pct(a.likes.length)} color="bg-rose-500" />
          <Metric label="Comments" value={a.comments.length} pct={pct(a.comments.length)} color="bg-violet-500" />
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 border-b border-slate-200">
          <Tab active={tab === "read"} onClick={() => setTab("read")} label={`Read (${readBy.length})`} />
          <Tab active={tab === "pending"} onClick={() => setTab("pending")} label={`Pending (${pending.length})`} />
          <Tab active={tab === "acks"} onClick={() => setTab("acks")} label={`Acked (${ackBy.length})`} />
          <Tab active={tab === "likes"} onClick={() => setTab("likes")} label={`Likes (${likedBy.length})`} />
        </div>

        <ul className="no-scrollbar mt-3 max-h-64 space-y-1 overflow-y-auto">
          {list.length === 0 ? (
            <li className="py-6 text-center text-sm text-slate-400">Nobody here yet.</li>
          ) : (
            list.map((u) => {
              const r = a.reads[u.email];
              const when = tab === "acks" && r?.acknowledgedAt ? r.acknowledgedAt : tab === "read" && r?.readAt ? r.readAt : null;
              return (
                <li key={u.email} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{initialsOf(u.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-700">{u.name}</span>
                    <span className="block truncate text-xs text-slate-400">{u.department}</span>
                  </span>
                  {when && <span className="shrink-0 text-xs text-slate-400">{relativeTime(when)}</span>}
                  {tab === "pending" && <span className="shrink-0 text-xs text-amber-500">Not seen</span>}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Modal>
  );
}

function Metric({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-sm font-bold text-slate-800">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-slate-400">{pct}% of audience</p>
    </div>
  );
}

function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition ${active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
      {label}
    </button>
  );
}

// ---- Comments ---------------------------------------------------------------

function CommentThread({ a, viewer, onAdd, onDelete, onClose }: { a: Announcement; viewer: Viewer; onAdd: (text: string) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const sorted = [...a.comments].sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  }

  return (
    <Modal title="Comments" onClose={onClose} max="max-w-lg">
      <div className="px-6 py-5">
        <h3 className="text-sm font-semibold text-slate-900">{a.title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{a.comments.length} comment{a.comments.length === 1 ? "" : "s"}</p>

        <ul className="no-scrollbar mt-4 max-h-72 space-y-3 overflow-y-auto">
          {sorted.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-400">No comments yet — start the conversation.</li>
          ) : (
            sorted.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{initialsOf(c.authorName)}</span>
                <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{c.authorName}</span>
                    <span className="text-xs text-slate-400">{relativeTime(c.createdAt)}</span>
                    {c.authorEmail === viewer.email && (
                      <button onClick={() => onDelete(c.id)} aria-label="Delete comment" className="ml-auto rounded p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600">{c.text}</p>
                </div>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={submit} className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{initialsOf(viewer.name)}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
            rows={1}
            placeholder={`Comment as ${viewer.name}…`}
            className="min-h-[40px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <button type="submit" disabled={!text.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40">Send</button>
        </form>
      </div>
    </Modal>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
