"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import CallModal, { type CallMode } from "@/components/CallModal";
import {
  PRESENCE_STYLES,
  clockTime,
  contactFromMember,
  dayLabel,
  initials,
  shortTime,
  type Contact,
  type Conversation,
  type Message,
} from "@/lib/chat";
import { getUser } from "@/lib/auth";
import { listTeam, type TeamMember } from "@/lib/team";
import { chatApi, type ChatMessage, type ChatThread } from "@/lib/chatApi";

type Filter = "All" | "Unread";

const OVERVIEW_POLL_MS = 5000;
const THREAD_POLL_MS = 3000;

export default function ChatPage() {
  const meId = useMemo(() => getUser()?.id ?? 0, []);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [overview, setOverview] = useState<ChatThread[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const [call, setCall] = useState<{ contact: Contact; mode: CallMode } | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a chat Contact for a user id (falls back to a generic one if the
  // person isn't in the active roster, e.g. a deactivated account).
  const contactFor = useCallback(
    (userId: number): Contact => {
      const idx = team.findIndex((t) => t.id === userId);
      if (idx >= 0) return contactFromMember(team[idx], idx);
      return { id: `u${userId}`, name: `User ${userId}`, role: "", avatarColor: "from-slate-400 to-slate-600", presence: "offline" };
    },
    [team],
  );

  // Initial load: the real workspace roster + conversation overview.
  useEffect(() => {
    let active = true;
    (async () => {
      const members = await listTeam();
      if (!active) return;
      setTeam(members.filter((m) => m.id !== meId));
      try {
        setOverview(await chatApi.overview());
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [meId]);

  // Poll the conversation overview so new incoming messages surface.
  useEffect(() => {
    const id = window.setInterval(() => {
      chatApi.overview().then(setOverview).catch(() => {});
    }, OVERVIEW_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  // Load + poll the open thread (also marks incoming as read server-side).
  useEffect(() => {
    if (activeUserId == null) return;
    let active = true;
    const load = async () => {
      try {
        const msgs = await chatApi.thread(activeUserId);
        if (active) setThread(msgs);
      } catch {
        /* keep what we have */
      }
    };
    load().then(() => {
      // First open clears unread — refresh the badge counts.
      if (active) chatApi.overview().then(setOverview).catch(() => {});
    });
    const id = window.setInterval(load, THREAD_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [activeUserId]);

  // Conversation list: people with messages, plus the freshly-opened chat.
  const conversations = useMemo(() => {
    const list = overview.map((t) => ({
      userId: t.userId,
      contact: contactFor(t.userId),
      last: { text: t.body, at: t.at, mine: t.mine } as { text: string; at: string; mine: boolean } | null,
      unread: t.unread,
    }));
    if (activeUserId != null && !list.some((c) => c.userId === activeUserId)) {
      list.unshift({ userId: activeUserId, contact: contactFor(activeUserId), last: null, unread: 0 });
    }
    return list;
  }, [overview, activeUserId, contactFor]);

  const visibleConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => (filter === "Unread" ? c.unread > 0 : true))
      .filter((c) => !q || c.contact.name.toLowerCase().includes(q) || c.contact.role.toLowerCase().includes(q))
      .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
  }, [conversations, query, filter]);

  const totalUnread = overview.reduce((n, t) => n + t.unread, 0);

  const activeContact = activeUserId != null ? contactFor(activeUserId) : null;
  const activeConversation: Conversation | null = activeContact
    ? { id: `conv-u${activeUserId}`, contact: activeContact, pinned: false, muted: false, unread: 0 }
    : null;

  // Map server messages → the UI bubble shape ("me" vs the contact).
  const uiMessages: Message[] = useMemo(
    () =>
      thread.map((m) => ({
        id: String(m.id),
        conversationId: activeConversation?.id ?? "",
        senderId: m.senderId === meId ? "me" : `u${m.senderId}`,
        text: m.body,
        createdAt: m.createdAt,
        status: m.read ? "read" : "delivered",
      })),
    [thread, meId, activeConversation?.id],
  );

  function openConversation(userId: number) {
    setActiveUserId(userId);
    setShowThreadMobile(true);
  }

  function startChatWith(m: TeamMember) {
    setActiveUserId(m.id);
    setShowThreadMobile(true);
    setNewChatOpen(false);
  }

  async function send(text: string) {
    const body = text.trim();
    if (!body || activeUserId == null) return;
    // Optimistic bubble (negative id) reconciled with the saved message.
    const temp: ChatMessage = {
      id: -Date.now(),
      senderId: meId,
      recipientId: activeUserId,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setThread((t) => [...t, temp]);
    try {
      const saved = await chatApi.send(activeUserId, body);
      setThread((t) => t.map((m) => (m.id === temp.id ? saved : m)));
      chatApi.overview().then(setOverview).catch(() => {});
    } catch (e) {
      setThread((t) => t.filter((m) => m.id !== temp.id));
      setError((e as Error).message);
    }
  }

  function startCall(mode: CallMode) {
    if (activeContact) setCall({ contact: activeContact, mode });
  }

  async function endCall(durationSec: number, mode: CallMode) {
    setCall(null);
    if (activeUserId == null || durationSec <= 0) return;
    const label = `${mode === "video" ? "📹 Video" : "📞 Voice"} call · ${formatCallDuration(durationSec)}`;
    try {
      await chatApi.send(activeUserId, label);
      setThread(await chatApi.thread(activeUserId));
      chatApi.overview().then(setOverview).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ── Conversation list ─────────────────────────────── */}
      <aside
        className={`${
          showThreadMobile ? "hidden" : "flex"
        } w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-80 lg:w-96`}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600 px-5 pb-5 pt-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_10%,white,transparent_45%),radial-gradient(circle_at_90%_90%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/25 backdrop-blur">
                <Icon name="chat" className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Messages</h1>
                <p className="text-[11px] text-blue-100">
                  {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setNewChatOpen(true)}
              aria-label="New chat"
              title="New chat"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25"
            >
              <Icon name="plus" className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-xl border-0 bg-white/15 py-2.5 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/20 backdrop-blur transition placeholder:text-white/60 focus:bg-white/25 focus:ring-2 focus:ring-white/40"
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          {(["All", "Unread"] as Filter[]).map((f) => {
            const activePill = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  activePill ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f}
                {f === "Unread" && totalUnread > 0 && (
                  <span className={`ml-1.5 ${activePill ? "text-blue-100" : "text-blue-600"}`}>{totalUnread}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="no-scrollbar flex-1 overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                <Icon name="alert" className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Couldn&apos;t load chat</p>
              <p className="mt-1 text-xs text-slate-400">{error}</p>
            </div>
          ) : !ready ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-slate-400">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <p className="mt-3 text-sm">Loading…</p>
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Icon name="chat" className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No conversations yet</p>
              <p className="mt-1 text-xs text-slate-400">Tap + to start chatting with a teammate.</p>
            </div>
          ) : (
            visibleConversations.map((c) => {
              const preview = c.last ? `${c.last.mine ? "You: " : ""}${c.last.text}` : "No messages yet";
              const isActive = c.userId === activeUserId;
              return (
                <button
                  key={c.userId}
                  onClick={() => openConversation(c.userId)}
                  className={`group flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition ${
                    isActive ? "border-blue-600 bg-blue-50/60" : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <Avatar contact={c.contact} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{c.contact.name}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{c.last ? shortTime(c.last.at) : ""}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-slate-500">{preview}</span>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Thread ────────────────────────────────────────── */}
      <section className={`${showThreadMobile ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}>
        {activeConversation ? (
          <Thread
            conversation={activeConversation}
            messages={uiMessages}
            onBack={() => setShowThreadMobile(false)}
            onSend={send}
            onStartCall={startCall}
          />
        ) : (
          <EmptyThread />
        )}
      </section>

      {call && (
        <CallModal
          contact={call.contact}
          mode={call.mode}
          onClose={(dur) => endCall(dur, call.mode)}
        />
      )}

      {newChatOpen && (
        <NewChatModal team={team} onPick={startChatWith} onClose={() => setNewChatOpen(false)} />
      )}
    </div>
  );
}

function formatCallDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Avatar({ contact }: { contact: Contact }) {
  return (
    <div className="relative shrink-0">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${contact.avatarColor} text-sm font-bold text-white shadow-sm`}
      >
        {initials(contact.name)}
      </span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${PRESENCE_STYLES[contact.presence].dot}`}
      />
    </div>
  );
}

function Thread({
  conversation,
  messages,
  onBack,
  onSend,
  onStartCall,
}: {
  conversation: Conversation;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
  onStartCall: (mode: CallMode) => void;
}) {
  const { contact } = conversation;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.id]);

  function submit() {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 md:hidden"
          >
            <Icon name="arrowLeft" className="h-5 w-5" />
          </button>
          <Avatar contact={contact} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900">{contact.name}</h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${PRESENCE_STYLES[contact.presence].dot}`} />
              {contact.role || "Team member"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <HeaderBtn icon="phone" label="Voice call" onClick={() => onStartCall("audio")} />
          <HeaderBtn icon="videoCam" label="Video call" onClick={() => onStartCall("video")} />
          <HeaderBtn icon="more" label="More" filled />
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-1 overflow-y-auto bg-slate-50/60 px-4 py-5 [background-image:radial-gradient(circle_at_1px_1px,rgb(226_232_240_/_0.6)_1px,transparent_0)] [background-size:22px_22px]"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-400">
            <Icon name="chat" className="h-8 w-8 text-slate-300" />
            <p className="mt-2">No messages yet — say hello 👋</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const mine = m.senderId === "me";
            const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const grouped = !!prev && prev.senderId === m.senderId && !showDay;
            return (
              <div key={m.id}>
                {showDay && <DayDivider label={dayLabel(m.createdAt)} />}
                <Bubble message={m} mine={mine} grouped={grouped} contact={contact} />
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-end gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/15">
          <button
            aria-label="Attach file"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
          >
            <Icon name="paperclip" className="h-5 w-5" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Type a message…"
            className="no-scrollbar max-h-32 flex-1 resize-none bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            aria-label="Emoji"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
          >
            <Icon name="smile" className="h-5 w-5" />
          </button>
          {draft.trim() ? (
            <button
              onClick={submit}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm transition hover:opacity-90 active:scale-95"
            >
              <Icon name="send" className="h-5 w-5" />
            </button>
          ) : (
            <button
              aria-label="Voice message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500 transition hover:bg-slate-300"
            >
              <Icon name="mic" className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function HeaderBtn({
  icon,
  label,
  active,
  filled,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  active?: boolean;
  filled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 transition ${
        active ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      }`}
    >
      <Icon name={icon} className="h-5 w-5" filled={filled && icon === "more"} />
    </button>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
        {label}
      </span>
    </div>
  );
}

function Bubble({
  message,
  mine,
  grouped,
  contact,
}: {
  message: Message;
  mine: boolean;
  grouped: boolean;
  contact: Contact;
}) {
  return (
    <div className={`flex items-end gap-2 ${grouped ? "mt-0.5" : "mt-3"} ${mine ? "justify-end" : "justify-start"}`}>
      {!mine &&
        (grouped ? (
          <span className="w-8 shrink-0" />
        ) : (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full bg-gradient-to-br ${contact.avatarColor} text-[11px] font-bold text-white`}
          >
            {initials(contact.name)}
          </span>
        ))}
      <div
        className={`max-w-[78%] px-3.5 py-2 sm:max-w-[65%] ${
          mine
            ? "rounded-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
            : "rounded-2xl rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
        <div className={`mt-1 flex items-center justify-end gap-1 ${mine ? "text-blue-100" : "text-slate-400"}`}>
          <span className="text-[10px]">{clockTime(message.createdAt)}</span>
          {mine && message.status && (
            <Icon
              name={message.status === "sent" ? "check" : "checkDouble"}
              className={`h-3.5 w-3.5 ${message.status === "read" ? "text-sky-200" : ""}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-slate-50/60 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
        <Icon name="chat" className="h-10 w-10" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-slate-800">Your messages</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Select a conversation to start chatting with your team.
      </p>
    </div>
  );
}

function NewChatModal({
  team,
  onPick,
  onClose,
}: {
  team: TeamMember[];
  onPick: (m: TeamMember) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? team.filter((m) => m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s))
      : team;
  }, [team, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-[8vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">New chat</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-slate-100 p-3">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
        </div>
        <div className="no-scrollbar max-h-[50vh] overflow-y-auto p-2">
          {list.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-slate-400">
              {team.length === 0
                ? "No other users yet. Create login accounts in Admin Setup → Accounts & Security."
                : "No people match your search."}
            </p>
          ) : (
            list.map((m, i) => (
              <button
                key={m.id}
                onClick={() => onPick(m)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${contactFromMember(m, i).avatarColor} text-sm font-bold text-white`}>
                  {initials(m.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{m.name}</span>
                  <span className="block truncate text-xs text-slate-500">{m.designation || m.role || m.email}</span>
                </span>
                <Icon name="chat" className="h-4 w-4 text-slate-300" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
