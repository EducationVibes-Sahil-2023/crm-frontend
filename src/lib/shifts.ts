// Work shifts & timing — defined in Admin Setup, used by Attendance.
// Persisted to normalised MySQL tables (`shifts`, `shift_assignments`) via
// /api/shifts and /api/shift-assignments — not a JSON blob, so "who is on the
// late shift" is answerable in SQL.
//
// Reads stay synchronous from an in-memory cache (hydrated at sign-in by
// AuthGuard) so the existing screens keep their shape; writes go to the backend
// and broadcast SHIFTS_EVENT.
import { apiRequest } from "@/lib/api";
import { listDirectory } from "@/lib/directory";
import { dbGet, dbSet, isStoreReady } from "@/lib/dbStore";

export type Shift = {
  id: string;
  name: string;
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
  workHours: number; // average / expected working hours (e.g. 8, 9, 6.5)
  graceMinutes: number; // late-coming grace window
};

export const DEFAULT_SHIFTS: Shift[] = [
  { id: "general", name: "General (10–6)", start: "10:00", end: "18:00", workHours: 8, graceMinutes: 15 },
  { id: "late", name: "Late (11–7)", start: "11:00", end: "19:00", workHours: 8, graceMinutes: 15 },
  { id: "early", name: "Early (8–4)", start: "08:00", end: "16:00", workHours: 8, graceMinutes: 10 },
  { id: "extended", name: "Extended (9–6)", start: "09:00", end: "18:00", workHours: 9, graceMinutes: 15 },
  { id: "half", name: "Half Day (10–4:30)", start: "10:00", end: "16:30", workHours: 6.5, graceMinutes: 10 },
];

// Legacy app_store blobs, imported once into the new tables.
const OLD_SHIFTS_KEY = "hr_shifts_v1";
const OLD_ASSIGN_KEY = "hr_shift_assignments_v1";
const MIGRATED_FLAG = "hr_shifts_blob_migrated_v1";

export const SHIFTS_EVENT = "nexus-shifts-changed";

function broadcast(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SHIFTS_EVENT));
}

let shiftCache: Shift[] = [];
let assignCache: Record<string, string> = {};
let hydrated = false;
let hydrating: Promise<void> | null = null;

/**
 * One-time import of the legacy blobs. Only runs when the tables are empty and
 * the blob has rows, so it cannot resurrect a list the admin deliberately
 * cleared. The flag lives in the workspace store, so this happens once per
 * workspace rather than once per browser.
 */
async function migrateBlobIfNeeded(): Promise<void> {
  try {
    if (dbGet<boolean>(MIGRATED_FLAG, false)) return;
    if (!isStoreReady()) return; // dbStore not loaded yet — retry on next hydrate

    const oldShifts = dbGet<Shift[]>(OLD_SHIFTS_KEY, []);
    if (Array.isArray(oldShifts) && oldShifts.length > 0) {
      const existing = await apiRequest<{ shifts: Shift[] }>("/shifts");
      if ((existing.shifts ?? []).length === 0) {
        await apiRequest("/shifts", { method: "PUT", body: JSON.stringify({ shifts: oldShifts }) });
      }
    }

    const oldAssign = dbGet<Record<string, string>>(OLD_ASSIGN_KEY, {});
    if (oldAssign && Object.keys(oldAssign).length > 0) {
      const existing = await apiRequest<{ assignments: Record<string, string> }>("/shift-assignments");
      if (Object.keys(existing.assignments ?? {}).length === 0) {
        await apiRequest("/shift-assignments", {
          method: "PUT",
          body: JSON.stringify({ assignments: oldAssign }),
        });
      }
    }

    dbSet(MIGRATED_FLAG, true);
  } catch {
    /* leave the flag unset so a later hydrate can retry */
  }
}

/** Pull shifts + assignments from the database. Called by AuthGuard at sign-in. */
export async function hydrateShifts(): Promise<void> {
  if (typeof window === "undefined") return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      await migrateBlobIfNeeded();
      const [s, a] = await Promise.all([
        apiRequest<{ shifts: Shift[] }>("/shifts"),
        apiRequest<{ assignments: Record<string, string> }>("/shift-assignments"),
      ]);
      shiftCache = Array.isArray(s.shifts) ? s.shifts : [];
      assignCache = a.assignments ?? {};
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

/** True once shifts have been read from the backend at least once. */
export function shiftsReady(): boolean {
  return hydrated;
}

export function loadShifts(): Shift[] {
  // The built-in set is the fallback for a workspace that has never configured
  // shifts — Attendance needs at least one to evaluate a punch against.
  return shiftCache.length ? shiftCache.map((x) => ({ ...x })) : DEFAULT_SHIFTS.map((x) => ({ ...x }));
}

export function saveShifts(s: Shift[]): void {
  shiftCache = s;
  broadcast();
  void apiRequest("/shifts", { method: "PUT", body: JSON.stringify({ shifts: s }) })
    .catch(() => { /* offline — the cache holds it for this session */ });
}

/** userName -> shiftId */
export function loadAssignments(): Record<string, string> {
  const shifts = loadShifts();
  const valid = new Set(shifts.map((s) => s.id));
  const out: Record<string, string> = {};
  // Everyone in the directory gets an entry; an unknown or stale shift falls
  // back to the first one so nobody is left without a schedule.
  for (const u of listDirectory()) {
    const cur = assignCache[u.name];
    out[u.name] = cur && valid.has(cur) ? cur : shifts[0]?.id ?? "";
  }
  return out;
}

export function saveAssignments(a: Record<string, string>): void {
  assignCache = a;
  broadcast();
  void apiRequest("/shift-assignments", { method: "PUT", body: JSON.stringify({ assignments: a }) })
    .catch(() => { /* offline */ });
}

/** Subscribe to shift/assignment changes. Returns an unsubscribe function. */
export function subscribeShifts(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SHIFTS_EVENT, cb);
  return () => window.removeEventListener(SHIFTS_EVENT, cb);
}

export function defaultShift(): Shift {
  return loadShifts()[0];
}
export function getShiftById(id: string): Shift | undefined {
  return loadShifts().find((s) => s.id === id);
}
export function getUserShift(name: string): Shift {
  const id = loadAssignments()[name];
  return getShiftById(id) ?? defaultShift();
}

// ---------- time helpers ----------

/** Parse "HH:MM" (24h) or "h:mm AM/PM" to minutes since midnight. */
export function toMinutes(t: string): number | null {
  if (!t) return null;
  const ampm = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (/pm/i.test(ampm[3])) h += 12;
    return h * 60 + Number(ampm[2]);
  }
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

export function format12(hhmm: string): string {
  const min = toMinutes(hhmm);
  if (min == null) return hhmm;
  const h = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm} ${period}`;
}

export function hoursLabel(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins ? `${whole}h ${mins}m` : `${whole}h`;
}

export type PunchEval = { status: "On time" | "Late" | "Absent"; lateBy: number };

/** Compare a check-in (any time format) to a shift's start + grace. */
export function evaluatePunch(shift: Shift, checkIn?: string): PunchEval {
  if (!checkIn) return { status: "Absent", lateBy: 0 };
  const inMin = toMinutes(checkIn);
  const startMin = toMinutes(shift.start);
  if (inMin == null || startMin == null) return { status: "On time", lateBy: 0 };
  const lateBy = inMin - (startMin + shift.graceMinutes);
  return lateBy > 0 ? { status: "Late", lateBy } : { status: "On time", lateBy: 0 };
}
