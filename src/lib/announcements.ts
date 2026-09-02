// Announcements store — normalised MySQL tables via /api/announcements, not a
// JSON blob. The scalars are columns; read receipts and comments are their own
// tables, so "who has read this" is a SQL question.
//
// Reads stay synchronous from an in-memory cache (hydrated at sign-in by
// AuthGuard) so the pages keep their current shape; writes go to the backend
// and broadcast ANNOUNCEMENTS_EVENT.

import { apiRequest } from "@/lib/api";
import { dbGet, dbSet, isStoreReady } from "@/lib/dbStore";
import { colorBadge, colorDot } from "@/lib/setup";
import { countInDepartments, findUser, listDirectory, type DirectoryUser } from "@/lib/directory";

// ---- Categories (admin-managed, dynamic) ------------------------------------

export type Category = {
  id: string;
  name: string;
  color: string; // a COLORS key from lib/setup
  createdBy: string;
  createdAt: string; // ISO or "—"
};

export const ANNOUNCEMENTS_EVENT = "nexus-announcements-changed";

function broadcast(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ANNOUNCEMENTS_EVENT));
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "general", name: "General", color: "slate", createdBy: "System", createdAt: "—" },
  { id: "product", name: "Product", color: "blue", createdBy: "System", createdAt: "—" },
  { id: "event", name: "Event", color: "violet", createdBy: "System", createdAt: "—" },
  { id: "policy", name: "Policy", color: "amber", createdBy: "System", createdAt: "—" },
  { id: "urgent", name: "Urgent", color: "rose", createdBy: "System", createdAt: "—" },
];

let categoryCache: Category[] = DEFAULT_CATEGORIES;

export function loadCategories(): Category[] {
  return categoryCache.length ? categoryCache : DEFAULT_CATEGORIES;
}

/** Replaces the whole set — the admin screen edits the list as a unit. */
export function saveCategories(list: Category[]): void {
  categoryCache = list;
  broadcast();
  void apiRequest("/announcement-categories", {
    method: "PUT",
    body: JSON.stringify({ categories: list }),
  }).catch(() => { /* offline — the cache holds it for this session */ });
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

let cache: Announcement[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

/** True once the announcements have been read from the backend at least once. */
export function announcementsReady(): boolean {
  return hydrated;
}

// Legacy app_store blobs, imported once into the new tables.
const OLD_BOARD_KEY = "nexus_announcements_v2";
const OLD_CATEGORY_KEY = "nexus_announcement_categories";
const MIGRATED_FLAG = "nexus_announcements_blob_migrated_v1";

/**
 * One-time import of the legacy blobs into the announcement tables. Only runs
 * when the tables are empty and the blob has rows, so it cannot resurrect
 * intentionally-deleted data. The flag lives in the workspace store, so this
 * happens once per workspace rather than once per browser.
 */
async function migrateBlobIfNeeded(): Promise<void> {
  try {
    if (dbGet<boolean>(MIGRATED_FLAG, false)) return;
    if (!isStoreReady()) return; // dbStore not loaded yet — retry on next hydrate

    const oldCats = dbGet<Category[]>(OLD_CATEGORY_KEY, []);
    if (Array.isArray(oldCats) && oldCats.length > 0) {
      const existing = await apiRequest<{ categories: Category[] }>("/announcement-categories");
      // The endpoint hands back defaults for an empty table; only import when the
      // stored set is genuinely different from those defaults.
      const isDefaults = (existing.categories ?? []).every((c) =>
        DEFAULT_CATEGORIES.some((d) => d.id === c.id));
      if (isDefaults) {
        await apiRequest("/announcement-categories", {
          method: "PUT",
          body: JSON.stringify({ categories: oldCats }),
        });
      }
    }

    const oldBoard = dbGet<Announcement[]>(OLD_BOARD_KEY, []);
    if (Array.isArray(oldBoard) && oldBoard.length > 0) {
      const existing = await apiRequest<{ announcements: unknown[] }>("/announcements");
      if ((existing.announcements ?? []).length === 0) {
        // Oldest first so the board keeps its original order.
        for (const a of [...oldBoard].reverse()) {
          try {
            const n = normalize(a);
            await apiRequest("/announcements", { method: "POST", body: JSON.stringify(payload(n)) });
          } catch {
            /* skip a bad row, keep importing the rest */
          }
        }
      }
    }

    dbSet(MIGRATED_FLAG, true);
  } catch {
    /* leave the flag unset so a later hydrate can retry */
  }
}

/** Pull the board from the database. Called by AuthGuard at sign-in. */
export async function hydrateAnnouncements(): Promise<void> {
  if (typeof window === "undefined") return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      await migrateBlobIfNeeded();
      const [board, cats] = await Promise.all([
        apiRequest<{ announcements: Partial<Announcement>[] }>("/announcements"),
        apiRequest<{ categories: Category[] }>("/announcement-categories"),
      ]);
      cache = (board.announcements ?? []).map(normalize);
      if (Array.isArray(cats.categories) && cats.categories.length) categoryCache = cats.categories;
    } catch {
      /* backend offline — keep whatever is cached */
    } finally {
      hydrated = true;
      hydrating = null;
      broadcast();
    }
  })();
  return hydrating;
}

export function loadAnnouncements(): Announcement[] {
  return cache.map(normalize);
}

/**
 * Persist a whole board.
 *
 * The two callers (the announcements page and the topbar bell) both hand back
 * the complete list, so this diffs against the cache and issues the matching
 * REST calls rather than replacing a blob. Engagement changes are routed to
 * their own endpoints, because a read receipt is a row in `announcement_reads`
 * now, not a key in a JSON object.
 */
export function saveAnnouncements(list: Announcement[]): void {
  const before = new Map(cache.map((a) => [a.id, a]));
  const after = list.map(normalize);
  cache = after;
  broadcast();

  const seen = new Set<string>();

  for (const a of after) {
    seen.add(a.id);
    const prev = before.get(a.id);

    if (!prev) {
      void createOnServer(a);
      continue;
    }
    if (contentChanged(prev, a)) void updateOnServer(a);

    // Read receipts added since the last save.
    for (const email of Object.keys(a.reads)) {
      if (!prev.reads[email]) {
        void apiRequest(`/announcements/${a.id}/read`, {
          method: "POST",
          body: JSON.stringify({ email, acknowledged: !!a.reads[email].acknowledgedAt }),
        }).catch(() => {});
      } else if (a.reads[email].acknowledgedAt && !prev.reads[email].acknowledgedAt) {
        void apiRequest(`/announcements/${a.id}/read`, {
          method: "POST",
          body: JSON.stringify({ email, acknowledged: true }),
        }).catch(() => {});
      }
    }

    // Comments added since the last save (server assigns the real id).
    const prevComments = new Set(prev.comments.map((c) => c.id));
    for (const c of a.comments) {
      if (!prevComments.has(c.id)) {
        void apiRequest(`/announcements/${a.id}/comments`, {
          method: "POST",
          body: JSON.stringify({ text: c.text, authorEmail: c.authorEmail, authorName: c.authorName }),
        }).catch(() => {});
      }
    }
  }

  for (const [id] of before) {
    if (!seen.has(id)) {
      void apiRequest(`/announcements/${id}`, { method: "DELETE" }).catch(() => {});
    }
  }
}

/** Fields that live on the announcements row itself (not the child tables). */
function contentChanged(a: Announcement, b: Announcement): boolean {
  return (
    a.title !== b.title ||
    a.body !== b.body ||
    a.categoryId !== b.categoryId ||
    a.pinned !== b.pinned ||
    JSON.stringify(a.audience) !== JSON.stringify(b.audience) ||
    JSON.stringify(a.attachments) !== JSON.stringify(b.attachments) ||
    JSON.stringify(a.likes) !== JSON.stringify(b.likes)
  );
}

function payload(a: Announcement) {
  return {
    title: a.title,
    body: a.body,
    categoryId: a.categoryId,
    author: a.author,
    authorEmail: a.authorEmail,
    pinned: a.pinned,
    attachments: a.attachments,
    audience: a.audience,
    likes: a.likes,
    createdAt: a.createdAt,
  };
}

async function createOnServer(a: Announcement): Promise<void> {
  try {
    const res = await apiRequest<{ announcement: Announcement }>("/announcements", {
      method: "POST",
      body: JSON.stringify(payload(a)),
    });
    // Swap the client-generated id for the row id so later edits target the row.
    const real = res.announcement?.id;
    if (real) {
      cache = cache.map((x) => (x.id === a.id ? { ...x, id: real } : x));
      broadcast();
    }
  } catch {
    /* offline — the item stays in the cache and can be retried by a later save */
  }
}

async function updateOnServer(a: Announcement): Promise<void> {
  try {
    await apiRequest(`/announcements/${a.id}`, { method: "PUT", body: JSON.stringify(payload(a)) });
  } catch {
    /* offline */
  }
}

/** Subscribe to board changes (same tab). Returns an unsubscribe function. */
export function subscribeAnnouncements(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ANNOUNCEMENTS_EVENT, cb);
  return () => window.removeEventListener(ANNOUNCEMENTS_EVENT, cb);
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
