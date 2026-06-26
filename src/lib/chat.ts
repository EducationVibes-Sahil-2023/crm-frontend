// Local-first chat store. Persists conversations + messages to localStorage so
// the module works without a backend; swap these helpers for `api`/websocket
// calls later.

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

const CONTACTS: Contact[] = [
  { id: "c1", name: "Aarav Mehta", role: "Sales Lead", avatarColor: "from-blue-500 to-indigo-600", presence: "online" },
  { id: "c2", name: "Priya Sharma", role: "Customer · Acme Corp", avatarColor: "from-rose-500 to-pink-600", presence: "online" },
  { id: "c3", name: "Design Team", role: "5 members", avatarColor: "from-violet-500 to-purple-600", presence: "away" },
  { id: "c4", name: "Rohan Verma", role: "Support Agent", avatarColor: "from-emerald-500 to-teal-600", presence: "offline" },
  { id: "c5", name: "Sara Khan", role: "Customer · Globex", avatarColor: "from-amber-500 to-orange-600", presence: "away" },
  { id: "c6", name: "Vikram Nair", role: "Account Manager", avatarColor: "from-cyan-500 to-sky-600", presence: "online" },
];

function iso(minsAgo: number): string {
  return new Date(Date.now() - minsAgo * 60000).toISOString();
}

const SEED_CONVERSATIONS: Conversation[] = [
  { id: "conv1", contact: CONTACTS[0], pinned: true, muted: false, unread: 0, typing: true },
  { id: "conv2", contact: CONTACTS[1], pinned: true, muted: false, unread: 2 },
  { id: "conv3", contact: CONTACTS[2], pinned: false, muted: true, unread: 0 },
  { id: "conv4", contact: CONTACTS[3], pinned: false, muted: false, unread: 0 },
  { id: "conv5", contact: CONTACTS[4], pinned: false, muted: false, unread: 1 },
  { id: "conv6", contact: CONTACTS[5], pinned: false, muted: false, unread: 0 },
];

const SEED_MESSAGES: Message[] = [
  // conv1 — Aarav
  { id: "m1", conversationId: "conv1", senderId: "c1", text: "Hey! Did you get a chance to review the Q3 pipeline targets?", createdAt: iso(1450) },
  { id: "m2", conversationId: "conv1", senderId: "me", text: "Yes — just went through them. The enterprise segment looks really strong 🔥", createdAt: iso(1440), status: "read" },
  { id: "m3", conversationId: "conv1", senderId: "c1", text: "Agreed. I think we can push the forecast up by 12%.", createdAt: iso(35) },
  { id: "m4", conversationId: "conv1", senderId: "c1", text: "Sending over the deck now so you can take a look before the all-hands.", createdAt: iso(33) },
  { id: "m5", conversationId: "conv1", senderId: "me", text: "Perfect, thanks! I'll add my notes and share back.", createdAt: iso(30), status: "read" },

  // conv2 — Priya
  { id: "m10", conversationId: "conv2", senderId: "c2", text: "Hi, we're seeing a small issue with the export feature.", createdAt: iso(120) },
  { id: "m11", conversationId: "conv2", senderId: "me", text: "Sorry to hear that! Can you tell me what happens when you click export?", createdAt: iso(118), status: "read" },
  { id: "m12", conversationId: "conv2", senderId: "c2", text: "It downloads an empty CSV. Happens on both Chrome and Edge.", createdAt: iso(8) },
  { id: "m13", conversationId: "conv2", senderId: "c2", text: "Could you take a look today? It's blocking our month-end report 🙏", createdAt: iso(6) },

  // conv3 — Design Team
  { id: "m20", conversationId: "conv3", senderId: "c3", text: "New dashboard mockups are in Figma — link in the channel.", createdAt: iso(300) },
  { id: "m21", conversationId: "conv3", senderId: "me", text: "Love the new sidebar direction 👏", createdAt: iso(295), status: "delivered" },

  // conv4 — Rohan
  { id: "m30", conversationId: "conv4", senderId: "me", text: "Can you pick up ticket #4821 when you're back online?", createdAt: iso(600), status: "delivered" },
  { id: "m31", conversationId: "conv4", senderId: "c4", text: "Sure thing, I'll grab it first thing tomorrow.", createdAt: iso(560) },

  // conv5 — Sara
  { id: "m40", conversationId: "conv5", senderId: "c5", text: "Thanks for the quick turnaround on the quotation!", createdAt: iso(90) },
  { id: "m41", conversationId: "conv5", senderId: "c5", text: "One question — does the price include onboarding?", createdAt: iso(15) },

  // conv6 — Vikram
  { id: "m50", conversationId: "conv6", senderId: "c6", text: "Renewal call is confirmed for Friday at 3 PM.", createdAt: iso(220) },
  { id: "m51", conversationId: "conv6", senderId: "me", text: "Great, I've added it to the calendar 📅", createdAt: iso(215), status: "read" },
];

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return SEED_CONVERSATIONS;
  try {
    const raw = window.localStorage.getItem(CONV_KEY);
    if (!raw) {
      window.localStorage.setItem(CONV_KEY, JSON.stringify(SEED_CONVERSATIONS));
      return SEED_CONVERSATIONS;
    }
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : SEED_CONVERSATIONS;
  } catch {
    return SEED_CONVERSATIONS;
  }
}

export function saveConversations(list: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONV_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadMessages(): Message[] {
  if (typeof window === "undefined") return SEED_MESSAGES;
  try {
    const raw = window.localStorage.getItem(MSG_KEY);
    if (!raw) {
      window.localStorage.setItem(MSG_KEY, JSON.stringify(SEED_MESSAGES));
      return SEED_MESSAGES;
    }
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed : SEED_MESSAGES;
  } catch {
    return SEED_MESSAGES;
  }
}

export function saveMessages(list: Message[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MSG_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// Canned replies so the demo feels alive when you send a message.
export const AUTO_REPLIES = [
  "Got it, thanks! 👍",
  "Sounds good — let me check and get back to you.",
  "Perfect, that works for me.",
  "Appreciate the update!",
  "Let me loop in the team and confirm.",
  "On it — will share an update shortly.",
];
