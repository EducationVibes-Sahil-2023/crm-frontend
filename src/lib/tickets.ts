// Local-first support ticket store. Persists to localStorage so the module is
// fully usable without a backend; swap these helpers for `api` calls later.

import type { IconName } from "@/components/icons";
import { dbGet, dbSet } from "@/lib/dbStore";

export type TicketStatus = "open" | "in_progress" | "on_hold" | "resolved" | "closed";
// Category and priority are admin-managed (see Admin Setup → Support Setup),
// so they're free-form strings resolved against the setup store at runtime.
export type TicketPriority = string;
export type TicketCategory = string;

// A file attached to a ticket or comment (base64 data URL for local-first storage).
export type Attachment = {
  id: string;
  name: string;
  type: string; // MIME type
  size: number; // bytes
  dataUrl: string;
};

// Per-file cap — base64 in localStorage grows ~33%, so keep it modest.
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// One entry in a ticket's tracking history.
export type TicketEvent = {
  id: string;
  at: string; // ISO
  type: "created" | "status" | "priority" | "assignment" | "comment";
  by: string; // actor name
  message?: string; // for comments (rich HTML)
  from?: string; // for changes
  to?: string; // for changes
  attachments?: Attachment[]; // for comments
};

export type Ticket = {
  id: string;
  number: string; // e.g. TKT-1042
  subject: string;
  description: string; // rich HTML
  requester: string;
  requesterEmail: string;
  assignee: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  tags: string[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  events: TicketEvent[];
};

// Support agents are real team members; no demo names. (UI can populate
// assignee options from the team directory.)
export const AGENTS: string[] = [];

export const STATUS_META: Record<
  TicketStatus,
  { label: string; badge: string; dot: string; step: number }
> = {
  open: { label: "Open", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", step: 0 },
  in_progress: { label: "In Progress", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", step: 1 },
  on_hold: { label: "On Hold", badge: "bg-slate-200 text-slate-600", dot: "bg-slate-400", step: 1 },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", step: 2 },
  closed: { label: "Closed", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400", step: 3 },
};

// Ordered stages used by the status tracker / stepper.
export const STATUS_FLOW: { key: TicketStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

export const EVENT_META: Record<TicketEvent["type"], { icon: IconName; tint: string }> = {
  created: { icon: "ticket", tint: "bg-blue-100 text-blue-600" },
  status: { icon: "refresh", tint: "bg-amber-100 text-amber-600" },
  priority: { icon: "alert", tint: "bg-rose-100 text-rose-600" },
  assignment: { icon: "users", tint: "bg-violet-100 text-violet-600" },
  comment: { icon: "chat", tint: "bg-slate-100 text-slate-600" },
};

const STORAGE_KEY = "nexus_tickets";

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

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function fullTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function loadTickets(): Ticket[] {
  const parsed = dbGet<Ticket[]>(STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  // Normalise tickets saved before array fields existed so consumers can
  // safely read `.length` / `.map` on them.
  return parsed.map((t) => ({
    ...t,
    attachments: Array.isArray(t.attachments) ? t.attachments : [],
    events: Array.isArray(t.events) ? t.events : [],
  }));
}

export function saveTickets(list: Ticket[]): void {
  dbSet(STORAGE_KEY, list);
}

// Next ticket number based on the current max.
export function nextTicketNumber(list: Ticket[]): string {
  const max = list.reduce((m, t) => {
    const n = parseInt(t.number.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 1037);
  return `TKT-${max + 1}`;
}

export function newEvent(e: Omit<TicketEvent, "id" | "at">): TicketEvent {
  return { id: `ev-${Date.now()}-${Math.floor(Math.random() * 10000)}`, at: new Date().toISOString(), ...e };
}

// Read a File into an Attachment (base64 data URL) for local-first storage.
export function readAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: `f-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result),
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Strip HTML tags to a plain string — used for search and previews.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function attachmentIcon(type: string): IconName {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "fileText";
}
