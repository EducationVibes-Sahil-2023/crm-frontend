// WhatsApp "click-to-chat" layer — free & safe. No automation, no login:
// we only build official https://wa.me deep links and keep a local message log
// + reusable templates + custom contacts. Nothing here can get a number banned.

import { listDirectory } from "@/lib/directory";
import { getUser } from "@/lib/auth";

export type WaContactType = "team" | "custom";
export type WaContact = {
  id: string;
  name: string;
  phone: string; // display form, e.g. "+91 98xxxxxx"
  type: WaContactType;
  subtitle?: string; // designation · department, or note
};

export type WaTemplate = { id: string; title: string; body: string };
export type WaLog = { id: string; contactId: string; name: string; phone: string; text: string; at: string };

// ---- phone helpers -----------------------------------------------------

/** Strip to digits and assume India (+91) for bare 10-digit numbers. */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  if (d.startsWith("0")) d = "91" + d.replace(/^0+/, "");
  return d;
}
export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw).length >= 11;
}
export function waLink(phone: string, text: string): string {
  const d = normalizePhone(phone);
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${d}${q}`;
}
export function applyTemplate(body: string, contactName: string): string {
  const first = (contactName || "").trim().split(/\s+/)[0] || "there";
  return body.replace(/\{name\}/gi, first).replace(/\{firstName\}/gi, first);
}

// ---- team contacts (from the shared directory + signed-in admin) --------

export function teamContacts(): WaContact[] {
  const list: WaContact[] = listDirectory().map((u, i) => ({
    id: `team-${i}`,
    name: u.name,
    // Deterministic demo number (same scheme as the Users page).
    phone: `+91 ${String(70000 + (i % 29999)).padStart(5, "0")} ${String(10000 + ((i * 7) % 89999)).padStart(5, "0")}`,
    type: "team",
    subtitle: `${u.designation} · ${u.department}`,
  }));
  const me = getUser();
  if (me?.name) {
    list.unshift({ id: "team-admin", name: me.name, phone: "+91 90000 00000", type: "team", subtitle: "Administrator" });
  }
  return list;
}

// ---- localStorage stores ----------------------------------------------

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

const TPL_KEY = "wa_templates_v1";
const CONTACT_KEY = "wa_contacts_v1";
const LOG_KEY = "wa_logs_v1";

const SEED_TEMPLATES: WaTemplate[] = [
  { id: "t-hi", title: "Greeting", body: "Hi {name}, this is the team at EducationVibes. How can we help you today?" },
  { id: "t-follow", title: "Follow-up", body: "Hi {name}, just following up on our last conversation. Do you have any questions?" },
  { id: "t-counsel", title: "Counselling invite", body: "Hi {name}, we'd love to schedule a free counselling session for you. When are you available?" },
  { id: "t-docs", title: "Document request", body: "Hi {name}, could you please share your documents so we can proceed with your admission?" },
  { id: "t-payment", title: "Payment reminder", body: "Hi {name}, a gentle reminder that your payment is due. Let us know if you need any help." },
];

export const loadTemplates = () => read<WaTemplate[]>(TPL_KEY, SEED_TEMPLATES);
export const saveTemplates = (l: WaTemplate[]) => write(TPL_KEY, l);

export const loadContacts = () => read<WaContact[]>(CONTACT_KEY, []);
export const saveContacts = (l: WaContact[]) => write(CONTACT_KEY, l);

export const loadLogs = () => read<WaLog[]>(LOG_KEY, []);
export const saveLogs = (l: WaLog[]) => write(LOG_KEY, l.slice(0, 500));

export function logMessage(list: WaLog[], contact: { id: string; name: string; phone: string }, text: string): WaLog[] {
  const entry: WaLog = {
    id: `wa-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
    contactId: contact.id,
    name: contact.name,
    phone: contact.phone,
    text,
    at: new Date().toISOString(),
  };
  const next = [entry, ...list];
  saveLogs(next);
  return next;
}

export function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; }
}
