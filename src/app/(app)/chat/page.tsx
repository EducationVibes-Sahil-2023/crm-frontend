"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import CallModal, { type CallMode } from "@/components/CallModal";
import {
  AUTO_REPLIES,
  PRESENCE_STYLES,
  clockTime,
  dayLabel,
  initials,
  loadConversations,
  loadMessages,
  saveConversations,
  saveMessages,
  shortTime,
  type Contact,
  type Conversation,
  type Message,
} from "@/lib/chat";

type Filter = "All" | "Unread" | "Pinned";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string>("conv1");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const [call, setCall] = useState<{ contact: Contact; mode: CallMode } | null>(null);

  // localStorage is client-only — re-read on mount, then persist on change.
  useEffect(() => {
    setConversations(loadConversations());
    setMessages(loadMessages());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveConversations(conversations);
  }, [conversations, ready]);
  useEffect(() => {
    if (ready) saveMessages(messages);
  }, [messages, ready]);

  const lastByConv = useMemo(() => {
    const map: Record<string, Message | undefined> = {};
    for (const m of messages) {
      const cur = map[m.conversationId];
      if (!cur || new Date(m.createdAt) > new Date(cur.createdAt)) map[m.conversationId] = m;
    }
    return map;
  }, [messages]);

  const visibleConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => (filter === "Unread" ? c.unread > 0 : filter === "Pinned" ? c.pinned : true))
      .filter((c) => !q || c.contact.name.toLowerCase().includes(q) || c.contact.role.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const ta = lastByConv[a.id]?.createdAt ?? "";
        const tb = lastByConv[b.id]?.createdAt ?? "";
        return tb.localeCompare(ta);
      });
  }, [conversations, query, filter, lastByConv]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const thread = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === activeId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages, activeId],
  );

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  function openConversation(id: string) {
    setActiveId(id);
    setShowThreadMobile(true);
    // mark as read
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !active) return;
    const now = new Date().toISOString();
    const mine: Message = {
      id: `m-${Date.now()}`,
      conversationId: active.id,
      senderId: "me",
      text: trimmed,
      createdAt: now,
      status: "sent",
    };
    setMessages((list) => [...list, mine]);

    // Local-first demo: simulate delivery + an auto-reply.
    const replyText = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    setConversations((list) => list.map((c) => (c.id === active.id ? { ...c, typing: true } : c)));
    window.setTimeout(() => {
      setMessages((list) => list.map((m) => (m.id === mine.id ? { ...m, status: "delivered" } : m)));
    }, 600);
    window.setTimeout(() => {
      const reply: Message = {
        id: `m-${Date.now()}-r`,
        conversationId: active.id,
        senderId: active.contact.id,
        text: replyText,
        createdAt: new Date().toISOString(),
      };
      setMessages((list) =>
        list.map((m) => (m.id === mine.id ? { ...m, status: "read" as const } : m)).concat(reply),
      );
      setConversations((list) => list.map((c) => (c.id === active.id ? { ...c, typing: false } : c)));
    }, 1800);
  }

  function togglePin(id: string) {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  }

  function startCall(mode: CallMode) {
    if (active) setCall({ contact: active.contact, mode });
  }

  function endCall(durationSec: number, contact: Contact, mode: CallMode) {
    const conv = conversations.find((c) => c.contact.id === contact.id);
    if (conv && durationSec > 0) {
      const label = `${mode === "video" ? "📹 Video" : "📞 Voice"} call · ${formatCallDuration(durationSec)}`;
      setMessages((list) => [
        ...list,
        {
          id: `m-${Date.now()}-call`,
          conversationId: conv.id,
          senderId: "me",
          text: label,
          createdAt: new Date().toISOString(),
          status: "read",
        },
      ]);
    }
    setCall(null);
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
              aria-label="New chat"
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
          {(["All", "Unread", "Pinned"] as Filter[]).map((f) => {
            const activePill = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  activePill
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
          {visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Icon name="search" className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No conversations</p>
              <p className="mt-1 text-xs text-slate-400">Try a different search or filter.</p>
            </div>
          ) : (
            visibleConversations.map((c) => {
              const last = lastByConv[c.id];
              const preview = c.typing
                ? "typing…"
                : last
                  ? `${last.senderId === "me" ? "You: " : ""}${last.text}`
                  : "No messages yet";
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`group flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition ${
                    isActive ? "border-blue-600 bg-blue-50/60" : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <Avatar contact={c.contact} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
                        {c.pinned && <Icon name="pin" className="h-3 w-3 shrink-0 text-blue-500" filled />}
                        <span className="truncate">{c.contact.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {last ? shortTime(last.createdAt) : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${c.typing ? "font-medium text-blue-600" : "text-slate-500"}`}>
                        {preview}
                      </span>
                      {c.unread > 0 ? (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                          {c.unread}
                        </span>
                      ) : c.muted ? (
                        <Icon name="bell" className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      ) : null}
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
        {active ? (
          <Thread
            conversation={active}
            messages={thread}
            onBack={() => setShowThreadMobile(false)}
            onSend={send}
            onTogglePin={() => togglePin(active.id)}
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
          onClose={(dur) => endCall(dur, call.contact, call.mode)}
        />
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
  onTogglePin,
  onStartCall,
}: {
  conversation: Conversation;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
  onTogglePin: () => void;
  onStartCall: (mode: CallMode) => void;
}) {
  const { contact } = conversation;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  // Keep pinned to the newest message (and when the contact starts typing).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.typing, conversation.id]);

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
              {conversation.typing ? (
                <span className="font-medium text-blue-600">typing…</span>
              ) : (
                PRESENCE_STYLES[contact.presence].label
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <HeaderBtn icon="phone" label="Voice call" onClick={() => onStartCall("audio")} />
          <HeaderBtn icon="videoCam" label="Video call" onClick={() => onStartCall("video")} />
          <HeaderBtn
            icon="pin"
            label={conversation.pinned ? "Unpin" : "Pin"}
            active={conversation.pinned}
            onClick={onTogglePin}
          />
          <HeaderBtn icon="more" label="More" filled />
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-1 overflow-y-auto bg-slate-50/60 px-4 py-5 [background-image:radial-gradient(circle_at_1px_1px,rgb(226_232_240_/_0.6)_1px,transparent_0)] [background-size:22px_22px]"
      >
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.senderId === "me";
          const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
          // group consecutive bubbles from the same sender
          const grouped = !!prev && prev.senderId === m.senderId && !showDay;
          return (
            <div key={m.id}>
              {showDay && <DayDivider label={dayLabel(m.createdAt)} />}
              <Bubble message={m} mine={mine} grouped={grouped} contact={contact} />
            </div>
          );
        })}
        {conversation.typing && <TypingBubble contact={contact} />}
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

function TypingBubble({ contact }: { contact: Contact }) {
  return (
    <div className="mt-3 flex items-end gap-2">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${contact.avatarColor} text-[11px] font-bold text-white`}
      >
        {initials(contact.name)}
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
      style={{ animationDelay: delay, animationDuration: "1s" }}
    />
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
        Select a conversation to start chatting with your team and customers.
      </p>
    </div>
  );
}
