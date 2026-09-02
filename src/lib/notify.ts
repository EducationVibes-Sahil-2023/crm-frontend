// Notifications layer for the app: browser push (Notification API), simulated
// email, and a persistent in-app notification center. Both the in-app log and
// the channel preferences persist to the per-tenant database (app_store via
// dbStore) — nothing is kept in browser storage.

import { dbGet, dbSet, STORE_EVENT } from "@/lib/dbStore";

export type NotifChannel = "push" | "email" | "app";

export type Notif = {
  id: string;
  channel: NotifChannel;
  title: string;
  body: string;
  at: string; // ISO
  read: boolean;
  taskId?: string;
};

export type NotifPrefs = { push: boolean; email: boolean };

const LOG_KEY = "nexus_notifications";
const PREFS_KEY = "nexus_notif_prefs";
export const NOTIFS_EVENT = "nexus-notifs-changed";

// ---- preferences (DB-backed via dbStore) ----
const DEFAULT_PREFS: NotifPrefs = { push: false, email: true };

export function loadPrefs(): NotifPrefs {
  return { ...DEFAULT_PREFS, ...dbGet<Partial<NotifPrefs>>(PREFS_KEY, {}) };
}
export function savePrefs(p: NotifPrefs): void {
  dbSet(PREFS_KEY, p);
}

// ---- in-app log (DB-backed via dbStore) ----
export function loadNotifs(): Notif[] {
  const parsed = dbGet<Notif[]>(LOG_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}
export function saveNotifs(list: Notif[]): void {
  dbSet(LOG_KEY, list.slice(0, 100));
  // Let the navbar (and any other listener) refresh live in this tab.
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NOTIFS_EVENT));
}

export function unreadCount(list: Notif[]): number {
  return list.filter((n) => !n.read).length;
}

// Subscribe to notification changes. Fires for edits made in this tab
// (NOTIFS_EVENT) and for anything the live store sync pulls in from the
// database — another tab, another device, or another user (STORE_EVENT).
export function subscribeNotifs(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = () => cb();
  window.addEventListener(NOTIFS_EVENT, onChange);
  window.addEventListener(STORE_EVENT, onChange);
  return () => {
    window.removeEventListener(NOTIFS_EVENT, onChange);
    window.removeEventListener(STORE_EVENT, onChange);
  };
}

// ---- browser push ----
export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
export function pushPermission(): NotificationPermission {
  return pushSupported() ? Notification.permission : "denied";
}
export async function requestPush(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
export function sendPush(title: string, body: string): void {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* some browsers throw if called outside a user gesture / SW context */
  }
}

// ---- simulated email ----
// Returns a log entry describing the (pretend) email that was sent.
export function sendEmail(to: string[], subject: string, body: string): Notif {
  return {
    id: `n-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    channel: "email",
    title: subject,
    body: `To: ${to.join(", ")} — ${body}`,
    at: new Date().toISOString(),
    read: false,
  };
}

export function notif(channel: NotifChannel, title: string, body: string, taskId?: string): Notif {
  return {
    id: `n-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    channel,
    title,
    body,
    at: new Date().toISOString(),
    read: false,
    taskId,
  };
}
