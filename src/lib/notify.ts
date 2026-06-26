// Notifications layer for the app: real browser push (Notification API),
// simulated email, and a persistent in-app notification center. Local-first so
// it works without a backend — swap sendEmail() for a real API call later.

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

// ---- preferences ----
export function loadPrefs(): NotifPrefs {
  if (typeof window === "undefined") return { push: false, email: true };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { push: false, email: true, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { push: false, email: true };
}
export function savePrefs(p: NotifPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// ---- in-app log ----
export function loadNotifs(): Notif[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as Notif[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function saveNotifs(list: Notif[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 100)));
    // Let the navbar (and any other listener) refresh live in this tab.
    window.dispatchEvent(new CustomEvent(NOTIFS_EVENT));
  } catch {
    /* ignore */
  }
}

export function unreadCount(list: Notif[]): number {
  return list.filter((n) => !n.read).length;
}

// Subscribe to notification changes (same tab + cross tab). Returns unsubscribe.
export function subscribeNotifs(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => { if (e.key === LOG_KEY) cb(); };
  window.addEventListener(NOTIFS_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(NOTIFS_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
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
