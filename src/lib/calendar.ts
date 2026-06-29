// Calendar store + date helpers. Events persist in the per-tenant database
// (app_store via dbStore) — no localStorage, no seeded demo events.

import { dbGet, dbSet } from "@/lib/dbStore";

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

export function loadEvents(): CalEvent[] {
  const parsed = dbGet<CalEvent[]>(KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveEvents(list: CalEvent[]): void {
  dbSet(KEY, list);
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
