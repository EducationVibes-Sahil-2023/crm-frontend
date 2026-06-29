// Announcements store. Persisted to the per-tenant database (app_store via
// dbStore) — no localStorage, no seeded demo announcements.

import { colorBadge, colorDot } from "@/lib/setup";
import { countInDepartments, findUser, listDirectory, type DirectoryUser } from "@/lib/directory";
import { dbGet, dbSet } from "@/lib/dbStore";

// ---- Categories (admin-managed, dynamic) ------------------------------------

export type Category = {
  id: string;
  name: string;
  color: string; // a COLORS key from lib/setup
  createdBy: string;
  createdAt: string; // ISO or "—"
};

const CATEGORY_KEY = "nexus_announcement_categories";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "general", name: "General", color: "slate", createdBy: "System", createdAt: "—" },
  { id: "product", name: "Product", color: "blue", createdBy: "System", createdAt: "—" },
  { id: "event", name: "Event", color: "violet", createdBy: "System", createdAt: "—" },
  { id: "policy", name: "Policy", color: "amber", createdBy: "System", createdAt: "—" },
  { id: "urgent", name: "Urgent", color: "rose", createdBy: "System", createdAt: "—" },
];

export function loadCategories(): Category[] {
  const parsed = dbGet<Category[]>(CATEGORY_KEY, DEFAULT_CATEGORIES);
  return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CATEGORIES;
}

export function saveCategories(list: Category[]): void {
  dbSet(CATEGORY_KEY, list);
}

export function categoryStyle(categories: Category[], id: string) {
  const c = categories.find((x) => x.id === id);
  return {
    name: c?.name ?? "General",
    badge: colorBadge(c?.color ?? "slate"),
    dot: colorDot(c?.color ?? "slate"),
  };
}

// ---- Attachments ------------------------------------------------------------

export type Attachment = {
  id: string;
  name: string;
  type: string; // MIME type
  size: number; // bytes
  dataUrl: string; // base64 data URL (local-first storage)
};

// Max size we accept per file before warning the user — base64 in localStorage
// grows ~33%, so keep it modest.
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Audience targeting -----------------------------------------------------

// "everyone" → all users; "custom" → union of the chosen departments and the
// explicitly added users.
export type Audience =
  | { kind: "everyone" }
  | { kind: "custom"; departments: string[]; userEmails: string[] };

export function audienceSize(a: Audience): number | "all" {
  if (a.kind === "everyone") return "all";
  const fromDepts = countInDepartments(a.departments);
  // Add explicit users not already covered by a chosen department.
  const set = new Set(a.departments);
  const extra = a.userEmails.filter((e) => {
    const u = findUser(e);
    return !u || !set.has(u.department);
  }).length;
  return fromDepts + extra;
}

export function audienceLabel(a: Audience): string {
  if (a.kind === "everyone") return "Everyone";
  const parts: string[] = [];
  if (a.departments.length) parts.push(`${a.departments.length} dept${a.departments.length > 1 ? "s" : ""}`);
  if (a.userEmails.length) parts.push(`${a.userEmails.length} user${a.userEmails.length > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "No one yet";
}

// Resolve an announcement's audience to the concrete list of recipients —
// used by the tracking view to compute read/pending breakdowns.
export function resolveRecipients(a: Announcement): DirectoryUser[] {
  const all = listDirectory();
  if (a.audience.kind === "everyone") return all;
  const depts = new Set(a.audience.departments);
  const emails = new Set(a.audience.userEmails);
  return all.filter((u) => depts.has(u.department) || emails.has(u.email));
}

// Is this announcement visible to the given viewer?
export function isVisibleTo(a: Announcement, viewerEmail: string): boolean {
  if (a.audience.kind === "everyone") return true;
  if (a.audience.userEmails.includes(viewerEmail)) return true;
  const u = findUser(viewerEmail);
  return !!u && a.audience.departments.includes(u.department);
}

// ---- Engagement / tracking --------------------------------------------------

export type ReadReceipt = {
  readAt: string; // ISO
  acknowledgedAt?: string; // ISO, set when the user explicitly acknowledges
};

export type Comment = {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string; // ISO
};

export type Announcement = {
  id: string;
  title: string;
  body: string; // rich HTML produced by the editor
  categoryId: string;
  author: string;
  authorEmail: string;
  pinned: boolean;
  createdAt: string; // ISO
  attachments: Attachment[];
  audience: Audience;
  reads: Record<string, ReadReceipt>; // keyed by viewer email
  likes: string[]; // viewer emails
  comments: Comment[];
};

// ---- Store ------------------------------------------------------------------

const KEY = "nexus_announcements_v2";

function normalize(a: Partial<Announcement>): Announcement {
  return {
    id: a.id ?? `a-${Math.random().toString(36).slice(2)}`,
    title: a.title ?? "",
    body: a.body ?? "",
    categoryId: a.categoryId ?? "general",
    author: a.author ?? "Unknown",
    authorEmail: a.authorEmail ?? "",
    pinned: a.pinned ?? false,
    createdAt: a.createdAt ?? new Date(0).toISOString(),
    attachments: a.attachments ?? [],
    audience: a.audience ?? { kind: "everyone" },
    reads: a.reads ?? {},
    likes: a.likes ?? [],
    comments: a.comments ?? [],
  };
}

export function loadAnnouncements(): Announcement[] {
  const parsed = dbGet<Announcement[]>(KEY, []);
  return Array.isArray(parsed) ? parsed.map(normalize) : [];
}

export function saveAnnouncements(list: Announcement[]): void {
  dbSet(KEY, list);
}

// ---- Misc helpers -----------------------------------------------------------

// Strip HTML tags to a plain string — used for search and the card preview.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Compact relative time ("just now", "3h ago", "2d ago", else a date).
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
