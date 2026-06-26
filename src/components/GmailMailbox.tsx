"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import type { GmailClient, GmailStatus, GmailListItem, GmailMessage } from "@/lib/gmailApi";

const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const colorFor = (s: string) => AVATAR_COLORS[((s.charCodeAt(0) || 0) + (s.charCodeAt(1) || 0)) % AVATAR_COLORS.length];
const initials = (name: string) => (name.trim() || "?").split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

/** Split a "Display Name <addr@host>" header into { name, email }. */
function parseAddr(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

/** Gmail's RFC date → short relative-ish label. */
function shortDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

type ComposeState = { to: string; subject: string; body: string } | null;

export default function GmailMailbox({
  client,
  returnPath = "/gmail",
  title = "Gmail",
  subtitle = "Your live Gmail inbox — receive and send real email.",
  connectTitle = "Connect your Gmail",
  connectSubtitle = "Sign in with Google to receive all your mail here and send email directly from the CRM.",
}: {
  client: GmailClient;
  returnPath?: string;
  title?: string;
  subtitle?: string;
  connectTitle?: string;
  connectSubtitle?: string;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [list, setList] = useState<GmailListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [compose, setCompose] = useState<ComposeState>(null);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);

  const connected = !!status?.connected;

  const loadInbox = useCallback(async () => {
    setListLoading(true);
    try {
      setList(await client.messages(30));
    } catch {
      toast.error("Couldn't load inbox", "Check your Gmail connection and try again.");
    } finally {
      setListLoading(false);
    }
  }, [client, toast]);

  // Initial: handle the OAuth return flag, then load status (+ inbox if connected).
  useEffect(() => {
    let active = true;
    (async () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const flag = params.get("connected");
        if (flag === "1") toast.success("Gmail connected", "Your inbox is now syncing.");
        else if (flag === "0") toast.error("Connection failed", "Google didn't grant access. Try connecting again.");
        if (flag !== null) window.history.replaceState({}, "", window.location.pathname);
      }
      try {
        const s = await client.status();
        if (!active) return;
        setStatus(s);
        if (s.connected) await loadInbox();
      } catch {
        if (active) setStatus({ configured: false, connected: false, email: "" });
      }
    })();
    return () => { active = false; };
  }, [client, toast, loadInbox]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => m.subject.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q));
  }, [list, query]);

  async function connect() {
    setConnecting(true);
    try {
      const { url } = await client.authUrl(returnPath);
      window.location.href = url;
    } catch (e) {
      toast.error("Can't start Gmail connect", e instanceof Error && e.message.includes("503") ? "Gmail isn't configured on the server yet." : "Please try again.");
      setConnecting(false);
    }
  }

  async function disconnect() {
    try {
      await client.disconnect();
      setStatus({ configured: status?.configured ?? true, connected: false, email: "" });
      setList([]);
      setSelected(null);
      toast.info("Gmail disconnected", "Your account was unlinked.");
    } catch {
      toast.error("Couldn't disconnect", "Please try again.");
    }
  }

  async function openMail(id: string) {
    setOpeningId(id);
    try {
      const full = await client.message(id);
      setSelected(full);
      setList((l) => l.map((m) => (m.id === id ? { ...m, unread: false } : m)));
    } catch {
      toast.error("Couldn't open message", "Please try again.");
    } finally {
      setOpeningId(null);
    }
  }

  function openCompose(prefill?: Partial<{ to: string; subject: string }>) {
    setCompose({ to: prefill?.to ?? "", subject: prefill?.subject ?? "", body: "" });
  }

  async function sendCompose() {
    if (!compose) return;
    if (!compose.to.trim()) return toast.error("Add a recipient", "Enter at least one email address.");
    setSending(true);
    try {
      await client.send(compose.to.trim(), compose.subject.trim() || "(no subject)", compose.body);
      toast.success("Email sent", `Delivered to ${compose.to.trim()} via Gmail.`);
      setCompose(null);
    } catch {
      toast.error("Send failed", "The message wasn't sent. Reconnect Gmail and retry.");
    } finally {
      setSending(false);
    }
  }

  const loadingStatus = status === null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge loading={loadingStatus} connected={connected} account={status?.email ?? ""} />
          {connected && (
            <button onClick={disconnect} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Connect / not-configured states */}
      {!loadingStatus && !connected && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
            <Icon name="gmail" className="h-7 w-7 text-rose-500" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{connectTitle}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{connectSubtitle}</p>
          </div>
          {status?.configured === false ? (
            <p className="mx-auto max-w-md rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Gmail isn&apos;t configured on the server yet. Add your Google OAuth Client ID &amp; secret to the backend
              <span className="font-mono"> .env</span> (<span className="font-mono">google.clientId</span> / <span className="font-mono">google.clientSecret</span>).
            </p>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {connecting ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="gmail" className="h-4 w-4" />}
              {connecting ? "Redirecting to Google…" : "Connect Gmail"}
            </button>
          )}
        </div>
      )}

      {/* Mail client (only when connected) */}
      {connected && (
        <div className="flex h-[72vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Folder rail */}
          <div className="hidden w-48 shrink-0 flex-col border-r border-slate-200 p-3 sm:flex">
            <button
              onClick={() => openCompose()}
              className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Icon name="edit" className="h-4 w-4" /> Compose
            </button>
            <nav className="space-y-0.5">
              <span className="flex w-full items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                <Icon name="gmail" className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Inbox</span>
                {list.filter((m) => m.unread).length > 0 && (
                  <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">{list.filter((m) => m.unread).length}</span>
                )}
              </span>
            </nav>
            <p className="mt-auto px-3 text-[11px] leading-relaxed text-slate-400">Signed in as<br /><span className="font-medium text-slate-500">{status?.email}</span></p>
          </div>

          {/* List */}
          <div className={`flex w-full flex-col border-r border-slate-200 sm:w-96 ${selected ? "hidden md:flex" : "flex"}`}>
            <div className="flex items-center gap-2 border-b border-slate-200 p-3">
              <div className="relative flex-1">
                <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inbox" className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-blue-500 focus:bg-white" />
              </div>
              <button onClick={loadInbox} title="Refresh" className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50">
                <Icon name="refresh" className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto">
              {listLoading && list.length === 0 ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex gap-3 border-b border-slate-100 p-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">{query ? "No matching mail." : "Your inbox is empty."}</div>
              ) : (
                filtered.map((m) => {
                  const who = parseAddr(m.from);
                  return (
                    <button
                      key={m.id}
                      onClick={() => openMail(m.id)}
                      className={`flex w-full items-start gap-3 border-b border-slate-100 p-3 text-left transition hover:bg-slate-50 ${selected?.id === m.id ? "bg-blue-50/60" : ""}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorFor(who.name)}`}>
                        {initials(who.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${m.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{who.name}</p>
                          <span className="shrink-0 text-[11px] text-slate-400">{shortDate(m.date)}</span>
                        </div>
                        <p className={`truncate text-sm ${m.unread ? "font-semibold text-slate-800" : "text-slate-600"}`}>{m.subject}</p>
                        <p className="truncate text-xs text-slate-400">{m.snippet}</p>
                      </div>
                      {openingId === m.id && <Icon name="refresh" className="mt-1 h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />}
                      {m.unread && openingId !== m.id && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Reading pane */}
          <div className={`flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}>
            {selected ? (
              <ReadingPane
                mail={selected}
                onBack={() => setSelected(null)}
                onReply={() => openCompose({ to: parseAddr(selected.from).email, subject: `Re: ${selected.subject}` })}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
                <Icon name="gmail" className="h-12 w-12 text-slate-300" />
                <p className="mt-3 text-sm">Select a conversation to read</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose */}
      {compose && (
        <Compose
          state={compose}
          sending={sending}
          onChange={setCompose}
          onClose={() => setCompose(null)}
          onSend={sendCompose}
          from={status?.email ?? ""}
        />
      )}
    </div>
  );
}

function ConnectionBadge({ loading, connected, account }: { loading: boolean; connected: boolean; account: string }) {
  if (loading) return <Skeleton className="h-7 w-40 rounded-full" />;
  return connected ? (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Connected{account ? ` · ${account}` : ""}
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Not connected
    </span>
  );
}

function ReadingPane({ mail, onBack, onReply }: { mail: GmailMessage; onBack: () => void; onReply: () => void }) {
  const who = parseAddr(mail.from);
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-3">
        <button onClick={onBack} title="Back" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden">
          <Icon name="arrowLeft" className="h-4 w-4" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onReply} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Icon name="send" className="h-3.5 w-3.5" /> Reply
          </button>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto p-5">
        <h2 className="text-lg font-bold text-slate-900">{mail.subject}</h2>
        <div className="mt-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${colorFor(who.name)}`}>{initials(who.name)}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{who.name} <span className="font-normal text-slate-400">&lt;{who.email}&gt;</span></p>
            <p className="text-xs text-slate-500">to {mail.to || "me"}{mail.date ? ` · ${shortDate(mail.date)}` : ""}</p>
          </div>
        </div>
        <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{mail.body || "(This message has no plain-text content.)"}</div>
      </div>
    </>
  );
}

function Compose({ state, sending, onChange, onClose, onSend, from }: { state: { to: string; subject: string; body: string }; sending: boolean; onChange: (s: { to: string; subject: string; body: string }) => void; onClose: () => void; onSend: () => void; from: string }) {
  return (
    <div className="fixed bottom-0 right-4 z-50 flex w-full max-w-md flex-col rounded-t-xl border border-slate-300 bg-white shadow-2xl sm:right-6">
      <div className="flex items-center justify-between rounded-t-xl bg-slate-800 px-4 py-2.5 text-white">
        <p className="text-sm font-semibold">New Message</p>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-white/10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex flex-col gap-0 p-3">
        {from && <p className="border-b border-slate-100 px-1 py-2 text-xs text-slate-400">From: {from}</p>}
        <input value={state.to} onChange={(e) => onChange({ ...state, to: e.target.value })} placeholder="To" className="border-b border-slate-100 px-1 py-2 text-sm outline-none" />
        <input value={state.subject} onChange={(e) => onChange({ ...state, subject: e.target.value })} placeholder="Subject" className="border-b border-slate-100 px-1 py-2 text-sm outline-none" />
        <textarea value={state.body} onChange={(e) => onChange({ ...state, body: e.target.value })} rows={8} placeholder="Write your message…" className="resize-none px-1 py-2 text-sm outline-none" />
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 p-3">
        <button onClick={onSend} disabled={sending} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          <Icon name={sending ? "refresh" : "send"} className={`h-4 w-4 ${sending ? "animate-spin" : ""}`} /> {sending ? "Sending…" : "Send"}
        </button>
        <button onClick={onClose} title="Discard" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Icon name="trash" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
