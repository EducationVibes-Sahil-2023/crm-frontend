// Chat store. Conversations + messages persist in the per-tenant database
// (app_store via dbStore) — no localStorage, no seeded demo chats. Contacts are
// real team members (see mergeTeamConversations).

import { dbGet, dbSet } from "@/lib/dbStore";

export type Presence = "online" | "away" | "offline";

export type Contact = {
  id: string;
  name: string;
  role: string; // job title / context line
  avatarColor: string; // tailwind gradient classes, e.g. "from-blue-500 to-indigo-600"
  presence: Presence;
};

export type Message = {
  id: string;
  conversationId: string;
  // "me" = the signed-in user; otherwise the contact id.
  senderId: string;
  text: string;
  createdAt: string; // ISO
  // delivery state for messages I sent
  status?: "sent" | "delivered" | "read";
};

export type Conversation = {
  id: string;
  contact: Contact;
  pinned: boolean;
  muted: boolean;
  unread: number;
  // typing indicator (purely cosmetic for the local-first demo)
  typing?: boolean;
};

export const PRESENCE_STYLES: Record<Presence, { dot: string; label: string }> = {
  online: { dot: "bg-emerald-500", label: "Active now" },
  away: { dot: "bg-amber-400", label: "Away" },
  offline: { dot: "bg-slate-300", label: "Offline" },
};

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// Compact clock time for message bubbles ("09:42").
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Relative time for the conversation list ("now", "5m", "3h", "Mon", "12 Jun").
export function shortTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Day separator label ("Today", "Yesterday", "Monday, 12 June").
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

const CONV_KEY = "nexus_chat_conversations";
const MSG_KEY = "nexus_chat_messages";

// ---- real team members → chat contacts ----

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-sky-600",
];

type TeamLike = { id: number; name: string; role?: string; designation?: string | null; department?: string | null };

/** Stable contact id for a login account. */
export function contactIdFor(userId: number): string {
  return `u${userId}`;
}

/** Map a real login account to a chat Contact. */
export function contactFromMember(m: TeamLike, idx = 0): Contact {
  return {
    id: contactIdFor(m.id),
    name: m.name,
    role: m.designation || m.role || m.department || "Team member",
    avatarColor: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
    presence: "online",
  };
}

/**
 * Merge real team members into the conversation list so every colleague is
 * shown and chattable. Existing conversations (with their messages, pins, unread
 * counts) are preserved; only missing people are appended as empty chats.
 */
export function mergeTeamConversations(existing: Conversation[], members: TeamLike[]): Conversation[] {
  const have = new Set(existing.map((c) => c.contact.id));
  const additions: Conversation[] = [];
  members.forEach((m, i) => {
    const contact = contactFromMember(m, i);
    if (!have.has(contact.id)) {
      additions.push({ id: `conv-${contact.id}`, contact, pinned: false, muted: false, unread: 0 });
    }
  });
  return [...existing, ...additions];
}

export function loadConversations(): Conversation[] {
  const parsed = dbGet<Conversation[]>(CONV_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveConversations(list: Conversation[]): void {
  dbSet(CONV_KEY, list);
}

export function loadMessages(): Message[] {
  const parsed = dbGet<Message[]>(MSG_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveMessages(list: Message[]): void {
  dbSet(MSG_KEY, list);
}
