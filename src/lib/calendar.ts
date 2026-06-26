// Local-first calendar store + date helpers. Persists events to localStorage so
// the module works without a backend; swap these helpers for `api` calls later.

export type CalEvent = {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  start?: string; // "HH:MM" (omitted when allDay)
  end?: string; // "HH:MM"
  allDay: boolean;
  color: string; // a COLORS key from lib/setup
  category: string;
  location?: string;
  description?: string;
  meetLink?: string; // Google Meet URL (e.g. demo bookings)
};

export const EVENT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Meeting", color: "blue" },
  { name: "Deadline", color: "rose" },
  { name: "Reminder", color: "amber" },
  { name: "Personal", color: "violet" },
  { name: "Holiday", color: "emerald" },
];

export function categoryColor(name: string): string {
  return EVENT_CATEGORIES.find((c) => c.name === name)?.color ?? "blue";
}

const KEY = "nexus_calendar_events";

const SEED: CalEvent[] = [
  { id: "e1", title: "Weekly sales sync", date: ymd(new Date()), start: "10:00", end: "10:45", allDay: false, color: "blue", category: "Meeting", location: "Zoom" },
  { id: "e2", title: "Client demo: Infosys Ltd.", date: shift(2), start: "14:00", end: "15:00", allDay: false, color: "blue", category: "Meeting", location: "Meeting Room A" },
  { id: "e3", title: "Proposal deadline", date: shift(3), allDay: true, color: "rose", category: "Deadline" },
  { id: "e4", title: "1:1 with manager", date: shift(-1), start: "16:30", end: "17:00", allDay: false, color: "violet", category: "Personal" },
  { id: "e5", title: "Company holiday", date: shift(5), allDay: true, color: "emerald", category: "Holiday" },
  { id: "e6", title: "Submit expense report", date: shift(1), start: "09:00", allDay: false, color: "amber", category: "Reminder" },
];

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export function loadEvents(): CalEvent[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as CalEvent[];
    return Array.isArray(parsed) ? parsed : SEED;
  } catch {
    return SEED;
  }
}

export function saveEvents(list: CalEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// ---- date helpers -----------------------------------------------------------

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

// 6x7 grid of Date cells covering the month (with leading/trailing days).
export function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// The 7 days of the week containing `date` (Sunday start).
export function weekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function fmtTime(hhmm?: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

export function fmtRange(e: CalEvent): string {
  if (e.allDay) return "All day";
  if (e.start && e.end) return `${fmtTime(e.start)} – ${fmtTime(e.end)}`;
  return fmtTime(e.start);
}
