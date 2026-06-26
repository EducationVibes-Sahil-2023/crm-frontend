"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import {
  AUTO_REPLIES,
  PRESENCE_STYLES,
  clockTime,
  initials,
  loadConversations,
  loadMessages,
  saveConversations,
  saveMessages,
  shortTime,
  type Conversation,
  type Message,
} from "@/lib/chat";

export default function ChatWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conversation[]>(loadConversations);
  const [msgs, setMsgs] = useState<Message[]>(loadMessages);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Live-sync with the full Chat page / other tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || ["nexus_chat_conversations", "nexus_chat_messages"].includes(e.key)) {
        setConvs(loadConversations());
        setMsgs(loadMessages());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Auto-scroll the open thread to the latest message.
  useEffect(() => {
    if (activeId) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, msgs.length, open]);

  // Don't show the floating widget on the full Chat page.
  if (pathname?.startsWith("/chat")) return null;

  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);
  const active = convs.find((c) => c.id === activeId) ?? null;
  const thread = activeId ? msgs.filter((m) => m.conversationId === activeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  const lastOf = (id: string) => msgs.filter((m) => m.conversationId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);

  function openConv(id: string) {
    setActiveId(id);
    setConvs((cs) => {
      const next = cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c));
      saveConversations(next);
      return next;
    });
  }

  function send() {
    const t = text.trim();
    if (!t || !active) return;
    const id = active.id;
    const contactId = active.contact.id;
    const mine: Message = { id: `m-${Date.now()}`, conversationId: id, senderId: "me", text: t, createdAt: new Date().toISOString(), status: "sent" };
    setMsgs((prev) => { const next = [...prev, mine]; saveMessages(next); return next; });
    setText("");
    const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    window.setTimeout(() => {
      setMsgs((prev) => {
        const next = [...prev, { id: `m-${Date.now()}`, conversationId: id, senderId: contactId, text: reply, createdAt: new Date().toISOString() } as Message];
        saveMessages(next);
        return next;
      });
    }, 1300);
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {/* Panel */}
      {open && (
        <div className="flex h-[520px] max-h-[72vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
          {active ? (
            <Thread
              conv={active}
              messages={thread}
              text={text}
              setText={setText}
              onSend={send}
              onBack={() => setActiveId(null)}
              onClose={() => setOpen(false)}
              endRef={endRef}
            />
          ) : (
            <>
              {/* Header */}
              <div className="relative flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-white">
                <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%)]" />
                <div className="relative">
                  <p className="text-base font-bold">Messages</p>
                  <p className="text-xs text-blue-100">{totalUnread > 0 ? `${totalUnread} unread` : "You're all caught up"}</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="relative rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="chevronDown" className="h-5 w-5" /></button>
              </div>
              {/* List */}
              <div className="no-scrollbar flex-1 overflow-y-auto">
                {convs.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-400">No conversations yet.</p>
                ) : (
                  [...convs].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map((c) => {
                    const last = lastOf(c.id);
                    return (
                      <button key={c.id} onClick={() => openConv(c.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50">
                        <span className="relative shrink-0">
                          <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${c.contact.avatarColor} text-sm font-semibold text-white`}>{initials(c.contact.name)}</span>
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${PRESENCE_STYLES[c.contact.presence].dot}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm ${c.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{c.contact.name}</span>
                            <span className="shrink-0 text-[11px] text-slate-400">{last ? shortTime(last.createdAt) : ""}</span>
                          </span>
                          <span className="flex items-center justify-between gap-2">
                            <span className={`truncate text-xs ${c.unread ? "font-semibold text-slate-700" : "text-slate-500"}`}>{last ? (last.senderId === "me" ? "You: " : "") + last.text : c.contact.role}</span>
                            {c.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <button onClick={() => { setOpen(false); router.push("/chat"); }} className="border-t border-slate-100 py-2.5 text-center text-sm font-semibold text-blue-600 hover:bg-slate-50">Open full chat</button>
            </>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 active:scale-95"
      >
        <Icon name={open ? "close" : "chat"} className="h-6 w-6" />
        {!open && totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{totalUnread > 9 ? "9+" : totalUnread}</span>
        )}
        {!open && totalUnread > 0 && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-blue-500/40" />}
      </button>
    </div>
  );
}

function Thread({
  conv, messages, text, setText, onSend, onBack, onClose, endRef,
}: {
  conv: Conversation;
  messages: Message[];
  text: string;
  setText: (v: string) => void;
  onSend: () => void;
  onBack: () => void;
  onClose: () => void;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="relative flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-2.5 text-white">
        <button onClick={onBack} aria-label="Back" className="rounded-lg p-1.5 hover:bg-white/15"><Icon name="arrowLeft" className="h-5 w-5" /></button>
        <span className="relative">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${conv.contact.avatarColor} text-xs font-semibold text-white ring-2 ring-white/40`}>{initials(conv.contact.name)}</span>
          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-blue-600 ${PRESENCE_STYLES[conv.contact.presence].dot}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{conv.contact.name}</p>
          <p className="truncate text-[11px] text-blue-100">{PRESENCE_STYLES[conv.contact.presence].label}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
      </div>

      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === "me";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-white text-slate-700"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{clockTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white"
        />
        <button onClick={onSend} disabled={!text.trim()} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40">
          <Icon name="send" className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
