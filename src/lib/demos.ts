// Demo bookings captured from the public landing page. Each demo gets a
// Google Meet link and a proposed slot, is stored here for the admin to review,
// and is mirrored into the CRM calendar so it shows up alongside other events.

import { loadEvents, saveEvents, ymd, type CalEvent } from "@/lib/calendar";
import { ensureSuperAdminToken } from "@/lib/superAdmin";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

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

// Backend (DB `settings` table, key platform.demos) is the source of truth.
// An in-memory cache backs the synchronous loadDemos() used by the UI.
let _cache: Demo[] | null = null;

function sortDemos(list: Demo[]): Demo[] {
  return [...list].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function loadDemos(): Demo[] {
  return _cache ? [..._cache] : [];
}

function setCache(list: Demo[]) {
  _cache = sortDemos(list);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DEMOS_EVENT));
}

// Share one in-flight request + short TTL so multiple mounts don't re-hit the API.
let _inflight: Promise<Demo[]> | null = null;
let _lastFetch = 0;
const DEMOS_TTL = 30_000;

/** Fetch booked demos from the backend (super-admin). */
export async function refreshDemos(force = false): Promise<Demo[]> {
  if (typeof window === "undefined") return [];
  if (!force && _cache && Date.now() - _lastFetch < DEMOS_TTL) return loadDemos();
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const token = await ensureSuperAdminToken();
      const res   = await fetch(`${API_BASE}/platform/demos`, { headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      const data  = res.ok ? await res.json() : null;
      const list  = Array.isArray(data?.demos) ? (data.demos as Demo[]) : [];
      setCache(list);
      _lastFetch = Date.now();
      return loadDemos();
    } catch {
      return loadDemos();
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/** Persist the whole demos list to the backend (super-admin). */
async function pushDemos(list: Demo[]): Promise<void> {
  try {
    const token = await ensureSuperAdminToken();
    await fetch(`${API_BASE}/platform/demos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ demos: list }),
    });
  } catch {
    // offline — cache already updated
  }
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
  // Optimistically update the cache, then book it on the backend (public route).
  setCache([demo, ...loadDemos()]);
  if (typeof window !== "undefined") {
    fetch(`${API_BASE}/platform/demos/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(demo),
    }).catch(() => { /* offline — booking will be re-sent if retried */ });
  }

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
  const next = loadDemos().map((d) => (d.id === id ? { ...d, status } : d));
  setCache(next);
  void pushDemos(next);
}

export function demoWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
