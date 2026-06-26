// Demo bookings captured from the public landing page. Each demo gets a
// Google Meet link and a proposed slot, is stored here for the admin to review,
// and is mirrored into the CRM calendar so it shows up alongside other events.

import { loadEvents, saveEvents, ymd, type CalEvent } from "@/lib/calendar";

export type DemoStatus = "scheduled" | "completed" | "cancelled";

export type Demo = {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  scheduledAt: string; // ISO
  meetLink: string;
  status: DemoStatus;
  createdAt: string; // ISO
};

const KEY = "nexus_demos_v1";
export const DEMOS_EVENT = "nexus-demos-changed";

function genMeetCode(): string {
  const a = "abcdefghijklmnopqrstuvwxyz";
  const pick = (n: number) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join("");
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

/** Next weekday at 11:00 AM. */
function nextSlot(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sun → Mon
  d.setHours(11, 0, 0, 0);
  return d;
}

export function loadDemos(): Demo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Demo[]) : [];
    return Array.isArray(list) ? list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) : [];
  } catch {
    return [];
  }
}

function persist(list: Demo[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(DEMOS_EVENT));
}

/** Book a demo: store it, generate a Meet link + slot, and mirror to the calendar. */
export function addDemo(input: { name: string; email: string; company?: string; phone?: string }): Demo {
  const slot = nextSlot();
  const demo: Demo = {
    id: `demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: input.name.trim() || "Guest",
    email: input.email.trim(),
    company: (input.company ?? "").trim() || "—",
    phone: (input.phone ?? "").trim() || "—",
    scheduledAt: slot.toISOString(),
    meetLink: `https://meet.google.com/${genMeetCode()}`,
    status: "scheduled",
    createdAt: new Date().toISOString(),
  };
  persist([demo, ...loadDemos()]);

  // Mirror into the CRM calendar.
  const event: CalEvent = {
    id: `cal-${demo.id}`,
    title: `Demo: ${demo.company !== "—" ? demo.company : demo.name}`,
    date: ymd(slot),
    start: "11:00",
    end: "11:30",
    allDay: false,
    color: "blue",
    category: "Meeting",
    location: "Google Meet",
    meetLink: demo.meetLink,
    description: `Product demo with ${demo.name}${demo.company !== "—" ? ` (${demo.company})` : ""}. ${demo.email} · ${demo.phone}`,
  };
  try {
    saveEvents([event, ...loadEvents().filter((e) => e.id !== event.id)]);
  } catch {
    /* calendar mirror is best-effort */
  }
  return demo;
}

export function setDemoStatus(id: string, status: DemoStatus): void {
  persist(loadDemos().map((d) => (d.id === id ? { ...d, status } : d)));
}

export function demoWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
