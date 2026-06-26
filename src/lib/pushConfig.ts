// Web push notification configuration — managed in Admin Setup.

export const PUSH_EVENTS: { key: string; label: string; desc: string }[] = [
  { key: "newLead", label: "New lead created", desc: "When a new lead enters the pipeline" },
  { key: "leadAssigned", label: "Lead assigned", desc: "When a lead is assigned to a user" },
  { key: "taskAssigned", label: "Task assigned", desc: "When a task is assigned to someone" },
  { key: "taskDue", label: "Task due soon", desc: "Reminder shortly before a task is due" },
  { key: "userAdded", label: "User added", desc: "When a new user account is created" },
  { key: "paymentReceived", label: "Payment received", desc: "When a payment is recorded" },
  { key: "supportTicket", label: "Support ticket", desc: "When a new support ticket is raised" },
  { key: "announcement", label: "Announcement", desc: "When a company announcement is posted" },
];

export type PushConfig = {
  enabled: boolean;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string; // mailto: or url contact
  defaultTitle: string;
  defaultIcon: string;
  requireInteraction: boolean;
  sound: boolean;
  events: Record<string, boolean>;
};

export const DEFAULT_PUSH_CONFIG: PushConfig = {
  enabled: false,
  vapidPublicKey: "",
  vapidPrivateKey: "",
  subject: "mailto:admin@educationvibes.in",
  defaultTitle: "CRM Enterprise",
  defaultIcon: "/icon-192.png",
  requireInteraction: false,
  sound: true,
  events: Object.fromEntries(PUSH_EVENTS.map((e) => [e.key, true])),
};

const STORAGE_KEY = "push_config_v1";

export function loadPushConfig(): PushConfig {
  const cfg: PushConfig = { ...DEFAULT_PUSH_CONFIG, events: { ...DEFAULT_PUSH_CONFIG.events } };
  if (typeof window === "undefined") return cfg;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cfg;
    const parsed = JSON.parse(raw) as Partial<PushConfig>;
    Object.assign(cfg, parsed);
    cfg.events = { ...DEFAULT_PUSH_CONFIG.events, ...(parsed.events ?? {}) };
  } catch {
    // ignore — fall back to defaults
  }
  return cfg;
}

export function savePushConfig(cfg: PushConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// Mock VAPID-style key generator (base64url-ish). Real keys come from the server.
export function generateKey(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
