"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { DEMOS_EVENT, loadDemos, type Demo } from "@/lib/demos";
import { createGmailClient, type GmailListItem } from "@/lib/gmailApi";
import { getSuperAdminToken } from "@/lib/superAdmin";

// Timestamp of the last time the super admin opened/cleared the bell. Anything
// newer than this counts toward the unread badge.
const SEEN_KEY = "nexus_admin_notif_seen_v1";
const GMAIL_POLL_MS = 45_000;

type Notif = {
  id: string;
  kind: "demo" | "gmail";
  title: string;
  subtitle: string;
  ts: number;
  href: string;
};

function loadSeen(): number {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(SEEN_KEY));
  return Number.isFinite(raw) ? raw : 0;
}

function tsOf(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function ago(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? "yesterday" : `${day}d ago`;
}

export default function SuperAdminNotifications() {
  const gmail = useMemo(() => createGmailClient(getSuperAdminToken), []);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [emails, setEmails] = useState<GmailListItem[]>([]);
  const [seen, setSeen] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Demos live in localStorage and broadcast on change.
  useEffect(() => {
    setSeen(loadSeen());
    const refresh = () => setDemos(loadDemos());
    refresh();
    window.addEventListener(DEMOS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DEMOS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Poll the super-admin mailbox for unread messages. Stays silent if Gmail
  // isn't connected/configured yet.
  const pollGmail = useCallback(async () => {
    try {
      const list = await gmail.messages(15);
      setEmails(list.filter((m) => m.unread));
    } catch {
      setEmails([]);
    }
  }, [gmail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async poll; setState runs after await
    pollGmail();
    const id = window.setInterval(pollGmail, GMAIL_POLL_MS);
    return () => window.clearInterval(id);
  }, [pollGmail]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const notifs = useMemo<Notif[]>(() => {
    const demoNotifs: Notif[] = demos.map((d) => ({
      id: `demo-${d.id}`,
      kind: "demo",
      title: `New demo — ${d.company !== "—" ? d.company : d.name}`,
      subtitle: `${d.name} · ${d.email}`,
      ts: tsOf(d.createdAt),
      href: "/admin/demos",
    }));
    const mailNotifs: Notif[] = emails.map((m) => ({
      id: `gmail-${m.id}`,
      kind: "gmail",
      title: `New email — ${m.from.replace(/<.*>/, "").trim() || m.from}`,
      subtitle: m.subject || m.snippet,
      ts: tsOf(m.date),
      href: "/admin/mail",
    }));
    return [...demoNotifs, ...mailNotifs].sort((a, b) => b.ts - a.ts).slice(0, 20);
  }, [demos, emails]);

  const unread = useMemo(() => notifs.filter((n) => n.ts > seen).length, [notifs, seen]);

  function markAllRead() {
    const now = Date.now();
    setSeen(now);
    window.localStorage.setItem(SEEN_KEY, String(now));
  }

  function toggle() {
    setOpen((o) => {
      // Opening the panel clears the badge.
      if (!o && unread > 0) markAllRead();
      return !o;
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
      >
        <Icon name="bell" className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            {notifs.length > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Icon name="bell" className="h-5 w-5" />
                </span>
                <p className="mt-2 text-sm font-medium text-slate-500">You&apos;re all caught up</p>
                <p className="text-xs text-slate-400">New demos and emails show up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {notifs.map((n) => {
                  const isNew = n.ts > seen;
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 ${isNew ? "bg-indigo-50/40" : ""}`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.kind === "demo" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"}`}>
                          <Icon name={n.kind === "demo" ? "calendar" : "gmail"} className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">{n.title}</span>
                          <span className="block truncate text-xs text-slate-500">{n.subtitle}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">{ago(n.ts)}</span>
                        </span>
                        {isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
