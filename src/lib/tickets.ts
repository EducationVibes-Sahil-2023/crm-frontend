// Local-first support ticket store. Persists to localStorage so the module is
// fully usable without a backend; swap these helpers for `api` calls later.

import type { IconName } from "@/components/icons";

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

export const AGENTS = ["Aarav Mehta", "Priya Sharma", "Rohan Verma", "Sara Khan"];

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

function mins(n: number): number {
  return n * 60_000;
}

function seed(): Ticket[] {
  const now = Date.now();
  const at = (offset: number) => new Date(now - offset).toISOString();

  const tickets: Ticket[] = [
    {
      id: "t1",
      number: "TKT-1042",
      subject: "Export downloads an empty CSV file",
      description:
        "<p>When I click <strong>Export</strong> on the Leads page, the browser downloads a CSV with only the header row — all the data rows are missing. Happens on Chrome and Edge.</p>",
      requester: "Priya Sharma",
      requesterEmail: "priya@acmecorp.com",
      assignee: "Aarav Mehta",
      status: "in_progress",
      priority: "High",
      category: "Bug",
      tags: ["export", "leads"],
      attachments: [],
      createdAt: at(mins(180)),
      updatedAt: at(mins(12)),
      events: [
        { id: "e1", at: at(mins(180)), type: "created", by: "Priya Sharma" },
        { id: "e2", at: at(mins(150)), type: "assignment", by: "System", to: "Aarav Mehta" },
        { id: "e3", at: at(mins(140)), type: "status", by: "Aarav Mehta", from: "open", to: "in_progress" },
        {
          id: "e4",
          at: at(mins(12)),
          type: "comment",
          by: "Aarav Mehta",
          message: "<p>Reproduced it — the export filter is being applied twice. Pushing a fix today.</p>",
        },
      ],
    },
    {
      id: "t2",
      number: "TKT-1041",
      subject: "Invoice charged twice this month",
      description: "<p>Our card was charged <strong>two times</strong> for the May subscription. Please refund the duplicate.</p>",
      requester: "Sara Khan",
      requesterEmail: "sara@globex.io",
      assignee: "Priya Sharma",
      status: "open",
      priority: "Urgent",
      category: "Billing",
      tags: ["payment", "refund"],
      attachments: [],
      createdAt: at(mins(95)),
      updatedAt: at(mins(95)),
      events: [{ id: "e5", at: at(mins(95)), type: "created", by: "Sara Khan" }],
    },
    {
      id: "t3",
      number: "TKT-1040",
      subject: "Add dark mode to the dashboard",
      description: "<p>Would love a dark theme for late-night work. The white background is hard on the eyes.</p>",
      requester: "Vikram Nair",
      requesterEmail: "vikram@nimbus.co",
      assignee: null,
      status: "on_hold",
      priority: "Low",
      category: "Feature Request",
      tags: ["ui", "theme"],
      attachments: [],
      createdAt: at(mins(60 * 26)),
      updatedAt: at(mins(60 * 5)),
      events: [
        { id: "e6", at: at(mins(60 * 26)), type: "created", by: "Vikram Nair" },
        { id: "e7", at: at(mins(60 * 5)), type: "status", by: "Sara Khan", from: "open", to: "on_hold" },
      ],
    },
    {
      id: "t4",
      number: "TKT-1039",
      subject: "Cannot reset my password",
      description: "<p>The reset link in the email returns a 'token expired' error even when I click it immediately.</p>",
      requester: "Rahul Bose",
      requesterEmail: "rahul@example.com",
      assignee: "Rohan Verma",
      status: "resolved",
      priority: "Medium",
      category: "Technical",
      tags: ["auth"],
      attachments: [],
      createdAt: at(mins(60 * 50)),
      updatedAt: at(mins(60 * 30)),
      events: [
        { id: "e8", at: at(mins(60 * 50)), type: "created", by: "Rahul Bose" },
        { id: "e9", at: at(mins(60 * 48)), type: "assignment", by: "System", to: "Rohan Verma" },
        { id: "e10", at: at(mins(60 * 40)), type: "status", by: "Rohan Verma", from: "open", to: "in_progress" },
        {
          id: "e11",
          at: at(mins(60 * 30)),
          type: "comment",
          by: "Rohan Verma",
          message: "<p>Extended the token TTL to 30 minutes. Please try again — should be sorted now.</p>",
        },
        { id: "e12", at: at(mins(60 * 30)), type: "status", by: "Rohan Verma", from: "in_progress", to: "resolved" },
      ],
    },
    {
      id: "t5",
      number: "TKT-1038",
      subject: "Onboarding call no-show",
      description: "<p>We missed our scheduled onboarding call. Can we reschedule for next week?</p>",
      requester: "Meera Iyer",
      requesterEmail: "meera@brightpath.in",
      assignee: "Aarav Mehta",
      status: "closed",
      priority: "Low",
      category: "General",
      tags: ["onboarding"],
      attachments: [],
      createdAt: at(mins(60 * 96)),
      updatedAt: at(mins(60 * 72)),
      events: [
        { id: "e13", at: at(mins(60 * 96)), type: "created", by: "Meera Iyer" },
        { id: "e14", at: at(mins(60 * 80)), type: "status", by: "Aarav Mehta", from: "open", to: "resolved" },
        { id: "e15", at: at(mins(60 * 72)), type: "status", by: "Aarav Mehta", from: "resolved", to: "closed" },
      ],
    },
  ];
  return tickets;
}

export function loadTickets(): Ticket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seed();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Ticket[];
    if (!Array.isArray(parsed)) return [];
    // Normalise tickets saved before array fields existed so consumers can
    // safely read `.length` / `.map` on them.
    return parsed.map((t) => ({
      ...t,
      attachments: Array.isArray(t.attachments) ? t.attachments : [],
      events: Array.isArray(t.events) ? t.events : [],
    }));
  } catch {
    return [];
  }
}

export function saveTickets(list: Ticket[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
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
