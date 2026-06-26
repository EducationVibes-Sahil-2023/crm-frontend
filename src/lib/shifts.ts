// Work shifts & timing — defined in Admin Setup, used by Attendance.
import { listDirectory } from "@/lib/directory";

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

const SHIFTS_KEY = "hr_shifts_v1";
const ASSIGN_KEY = "hr_shift_assignments_v1";

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
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadShifts(): Shift[] {
  const s = read<Shift[]>(SHIFTS_KEY, []);
  return Array.isArray(s) && s.length ? s : DEFAULT_SHIFTS.map((x) => ({ ...x }));
}
export function saveShifts(s: Shift[]): void {
  write(SHIFTS_KEY, s);
}

/** userName -> shiftId */
export function loadAssignments(): Record<string, string> {
  const a = read<Record<string, string>>(ASSIGN_KEY, {});
  const shifts = loadShifts();
  const valid = new Set(shifts.map((s) => s.id));
  const out: Record<string, string> = {};
  for (const u of listDirectory()) {
    const cur = a[u.name];
    out[u.name] = cur && valid.has(cur) ? cur : shifts[0]?.id ?? "";
  }
  return out;
}
export function saveAssignments(a: Record<string, string>): void {
  write(ASSIGN_KEY, a);
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
