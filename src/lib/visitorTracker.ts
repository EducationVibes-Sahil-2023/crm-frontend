// Website Visitor Tracker — anonymous + identified visitor sessions captured
// from the marketing site, with source/device analytics and convert-to-lead.
// Sessions persist in the per-tenant database (app_store via dbStore).

import { dbGet, dbSet } from "@/lib/dbStore";

export type VisitorStatus = "New" | "Returning" | "Active" | "Converted";
export type DeviceKind = "Desktop" | "Mobile" | "Tablet";

export type VisitorSession = {
  id: string;
  visitorName: string; // "Anonymous" until identified
  identified: boolean;
  email: string;
  phone: string;
  source: string; // Google / Direct / Facebook / LinkedIn / Referral / Email
  device: DeviceKind;
  browser: string;
  city: string;
  country: string;
  landing: string; // landing page path
  pages: string[]; // pages visited
  durationSec: number;
  firstSeen: string; // ISO
  lastSeen: string; // ISO
  status: VisitorStatus;
  convertedLeadId?: string;
};

export const STATUS_META: Record<VisitorStatus, { label: string; badge: string; dot: string }> = {
  Active: { label: "Active now", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  New: { label: "New", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  Returning: { label: "Returning", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  Converted: { label: "Converted", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
};

export const SOURCES = ["Google", "Direct", "Facebook", "LinkedIn", "Referral", "Email"];

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

export function formatDuration(sec: number): string {
  if (sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m === 0 ? `${s}s` : `${m}m ${s.toString().padStart(2, "0")}s`;
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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const KEY = "nexus_visitor_sessions";

// Per-tenant DB-backed (app_store via dbStore) — no localStorage, no seeded
// demo visitors. Real sessions are written by the tracker as they arrive.
export function loadSessions(): VisitorSession[] {
  const parsed = dbGet<VisitorSession[]>(KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveSessions(list: VisitorSession[]): void {
  dbSet(KEY, list);
}

// Simulate the live event stream: a new visitor lands or an active one advances.
const CITIES: [string, string][] = [
  ["Mumbai", "India"], ["Pune", "India"], ["Jaipur", "India"], ["Kolkata", "India"], ["Ahmedabad", "India"],
];
const LANDINGS = ["/", "/pricing", "/features", "/demo", "/offer", "/blog/crm-tips"];
const BROWSERS = ["Chrome", "Safari", "Edge", "Firefox"];
const DEVICES: DeviceKind[] = ["Desktop", "Mobile", "Tablet"];

export function simulateLive(list: VisitorSession[]): VisitorSession[] {
  // 60% chance a brand-new visitor arrives, else bump an existing active one.
  if (Math.random() < 0.6 || list.length === 0) {
    const [city, country] = CITIES[Math.floor(Math.random() * CITIES.length)];
    const landing = LANDINGS[Math.floor(Math.random() * LANDINGS.length)];
    const fresh: VisitorSession = {
      id: `vs-${Date.now().toString(36)}`,
      visitorName: "Anonymous",
      identified: false,
      email: "",
      phone: "",
      source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
      device: DEVICES[Math.floor(Math.random() * DEVICES.length)],
      browser: BROWSERS[Math.floor(Math.random() * BROWSERS.length)],
      city,
      country,
      landing,
      pages: [landing],
      durationSec: 5 + Math.floor(Math.random() * 30),
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: "Active",
    };
    return [fresh, ...list];
  }
  const idx = list.findIndex((s) => s.status === "Active");
  if (idx === -1) return list;
  const copy = [...list];
  const s = { ...copy[idx] };
  s.pages = [...s.pages, LANDINGS[Math.floor(Math.random() * LANDINGS.length)]];
  s.durationSec += 20 + Math.floor(Math.random() * 60);
  s.lastSeen = new Date().toISOString();
  copy[idx] = s;
  return copy;
}
