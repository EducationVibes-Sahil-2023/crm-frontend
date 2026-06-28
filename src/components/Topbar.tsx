"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { getUser, logout, type User } from "@/lib/auth";
import { initials, loadProfile, type Profile } from "@/lib/profile";
import { useToast } from "@/components/Toast";
import { loadNotifs, saveNotifs, subscribeNotifs } from "@/lib/notify";
import { isVisibleTo, loadAnnouncements, saveAnnouncements, stripHtml } from "@/lib/announcements";
import { loadConversations, loadMessages, saveConversations } from "@/lib/chat";

// A unified item shown in the navbar bell — from the notification store,
// unread announcements, or unread chat conversations.
type BellItem = {
  id: string;
  kind: "store" | "announcement" | "chat";
  refId?: string;
  icon: IconName;
  wrap: string;
  title: string;
  body: string;
  at: string; // ISO
  unread: boolean;
  href?: string;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Topbar({
  onMenu,
  onToggleCollapse,
}: {
  onMenu?: () => void;
  onToggleCollapse?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Navbar bell — merges the notification store, unread announcements and
  // unread chat messages. Live across the app + other tabs.
  const [items, setItems] = useState<BellItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => i.unread).length;
  const annUnread = items.filter((i) => i.kind === "announcement" && i.unread).length;

  function buildItems(): BellItem[] {
    const email = getUser()?.email || "";
    const a0 = new Date().toISOString();
    const store: BellItem[] = loadNotifs().map((n) => ({
      id: n.id, kind: "store", icon: n.channel === "email" ? "gmail" : n.channel === "push" ? "bell" : "message",
      wrap: n.channel === "email" ? "bg-violet-100 text-violet-600" : n.channel === "push" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500",
      title: n.title, body: n.body, at: n.at, unread: !n.read, refId: n.id,
    }));
    const anns: BellItem[] = loadAnnouncements()
      .filter((a) => isVisibleTo(a, email) && !a.reads[email])
      .map((a) => ({
        id: `ann-${a.id}`, kind: "announcement", refId: a.id, icon: "announcement", wrap: "bg-amber-100 text-amber-600",
        title: a.title, body: stripHtml(a.body).slice(0, 120), at: a.createdAt, unread: true, href: "/announcement",
      }));
    const msgs = loadMessages();
    const chats: BellItem[] = loadConversations()
      .filter((c) => c.unread > 0)
      .map((c) => {
        const last = msgs.filter((m) => m.conversationId === c.id).sort((x, y) => x.createdAt.localeCompare(y.createdAt)).at(-1);
        return {
          id: `chat-${c.id}`, kind: "chat", refId: c.id, icon: "chat", wrap: "bg-blue-100 text-blue-600",
          title: c.contact.name, body: last?.text || `${c.unread} new message${c.unread > 1 ? "s" : ""}`,
          at: last?.createdAt || a0, unread: true, href: "/chat",
        };
      });
    return [...store, ...anns, ...chats].sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  }
  const refresh = () => setItems(buildItems());

  // Read on mount and refresh whenever the profile / any source changes.
  useEffect(() => {
    const sync = () => { setUser(getUser()); setProfile(loadProfile()); };
    sync();
    refresh();
    const unsub = subscribeNotifs(refresh);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || ["nexus_announcements_v2", "nexus_chat_conversations", "nexus_chat_messages"].includes(e.key)) refresh();
    };
    window.addEventListener("profile:updated", sync);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("profile:updated", sync); window.removeEventListener("storage", onStorage); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-read the (same-tab) announcement/chat stores each time the bell opens.
  useEffect(() => {
    if (notifOpen) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  useEffect(() => {
    if (!menu && !notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menu && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu, notifOpen]);

  function markStoreRead(id: string) {
    saveNotifs(loadNotifs().map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
  function markAnnRead(id: string) {
    const email = getUser()?.email || "";
    const now = new Date().toISOString();
    saveAnnouncements(loadAnnouncements().map((a) => (a.id === id ? { ...a, reads: { ...a.reads, [email]: { readAt: a.reads[email]?.readAt ?? now } } } : a)));
  }
  function markChatRead(id: string) {
    saveConversations(loadConversations().map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }
  function openItem(item: BellItem) {
    if (item.kind === "store") markStoreRead(item.refId!);
    else if (item.kind === "announcement") markAnnRead(item.refId!);
    else if (item.kind === "chat") markChatRead(item.refId!);
    refresh();
    if (item.href) { setNotifOpen(false); router.push(item.href); }
  }
  function markAllRead() {
    saveNotifs(loadNotifs().map((n) => ({ ...n, read: true })));
    const email = getUser()?.email || "";
    const now = new Date().toISOString();
    saveAnnouncements(loadAnnouncements().map((a) => (isVisibleTo(a, email) && !a.reads[email] ? { ...a, reads: { ...a.reads, [email]: { readAt: now } } } : a)));
    saveConversations(loadConversations().map((c) => ({ ...c, unread: 0 })));
    refresh();
  }
  function clearStore() {
    saveNotifs([]);
    refresh();
  }

  async function handleLogout() {
    await logout();
    toast.info("Signed out", "You have been logged out.");
    router.replace("/login");
  }

  const name = user?.name ?? "User";

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Mobile: open drawer */}
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Icon name="menu" />
      </button>

      {/* Desktop: collapse / expand sidebar */}
      <button
        onClick={onToggleCollapse}
        className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:inline-flex"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      >
        <Icon name="menu" />
      </button>

      <div className="relative max-w-md flex-1">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          placeholder="Search accounts, leads, or deals..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* AI Assistant */}
        <Link
          href="/assistant"
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 px-2.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          aria-label="Ask Nexus AI"
          title="Ask Nexus AI"
        >
          <Icon name="ai" className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </Link>

        {/* Announcements */}
        <Link
          href="/announcement"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label={`Announcements${annUnread > 0 ? `, ${annUnread} unread` : ""}`}
          title="Announcements"
        >
          <Icon name="announcement" />
          {annUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{annUnread > 9 ? "9+" : annUnread}</span>
          )}
        </Link>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
            <Icon name="bell" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 sm:w-96">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Icon name="bell" className="h-4 w-4 text-blue-600" /> Notifications
                  {unread > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{unread} new</span>}
                </p>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs font-semibold text-blue-600 hover:underline">Mark all read</button>
                )}
              </div>

              <div className="no-scrollbar max-h-[65vh] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <Icon name="bell" className="h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm text-slate-400">You&apos;re all caught up.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {items.map((it) => (
                      <li key={it.id}>
                        <button onClick={() => openItem(it)} className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${it.unread ? "bg-blue-50/40" : ""}`}>
                          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.wrap}`}>
                            <Icon name={it.icon} className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{it.title}</p>
                              {it.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{it.body}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${it.kind === "announcement" ? "bg-amber-50 text-amber-600" : it.kind === "chat" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                                {it.kind === "announcement" ? "Announcement" : it.kind === "chat" ? "Message" : "Alert"}
                              </span>
                              · {timeAgo(it.at)}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                <span className="text-xs text-slate-400">{items.length} notification{items.length === 1 ? "" : "s"}</span>
                <button onClick={clearStore} className="text-xs font-semibold text-slate-400 hover:text-rose-600">Clear alerts</button>
              </div>
            </div>
          )}
        </div>

        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Messages">
          <Icon name="message" />
        </button>

        <div className="mx-2 hidden h-8 w-px bg-slate-200 sm:block" />

        {/* Profile menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-slate-100"
            aria-label="Open profile menu"
          >
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-900">{name}</p>
              <p className="text-xs leading-tight text-slate-500">{profile?.title ?? "Team member"}</p>
            </div>
            <Avatar name={name} avatar={profile?.avatar ?? null} />
            <Icon name="chevronDown" className={`hidden h-4 w-4 text-slate-400 transition sm:block ${menu ? "rotate-180" : ""}`} />
          </button>

          {menu && (
            <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
              <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
                <Avatar name={name} avatar={profile?.avatar ?? null} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-400">{user?.email ?? ""}</p>
                </div>
              </div>
              <div className="py-1">
                <Link href="/profile" onClick={() => setMenu(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                  <Icon name="eye" className="h-4 w-4 text-slate-400" />
                  View profile
                </Link>
                <Link href="/profile" onClick={() => setMenu(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                  <Icon name="settings" className="h-4 w-4 text-slate-400" />
                  Account settings
                </Link>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                >
                  <Icon name="logout" className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
      {initials(name)}
    </div>
  );
}

// Memoised: the navbar has no route dependency, so with stable callbacks from
// the layout it does NOT re-render when you navigate — only the content does.
export default memo(Topbar);
