// Call tracker helpers. Real device calls are stored in the backend `calls`
// table and fetched via lib/callsApi — this module keeps only the pure logic:
// phone normalisation, formatting, and matching calls to CRM leads on either the
// lead's PRIMARY or ALTERNATIVE number.

import { loadIntakeLeads } from "@/lib/leadStore";

export type CallDirection = "incoming" | "outgoing" | "missed";
export type PhoneSide = "primary" | "alternative";

export type LeadContact = {
  id: string;
  name: string;
  company: string;
  primary: string;
  alternative: string;
};

export type Call = {
  id: string;
  number: string; // the other party's number, as it appears in the call log
  rawName: string; // device contact label, if any
  direction: CallDirection;
  at: string; // ISO timestamp
  durationSec: number;
  device: string; // the signed-in user's device number that produced this log
};

// A call that matched a CRM lead — what the tracker actually keeps.
export type TrackedCall = Call & { lead: LeadContact; side: PhoneSide };

export const DIRECTION_META: Record<CallDirection, { label: string; badge: string; dot: string; icon: "call" }> = {
  incoming: { label: "Incoming", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: "call" },
  outgoing: { label: "Outgoing", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", icon: "call" },
  missed: { label: "Missed", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", icon: "call" },
};

// Normalize a phone number to its last 10 digits so "+91 98765 43210",
// "098765 43210" and "9876543210" all compare equal.
export function normalizePhone(num: string): string {
  const digits = (num || "").replace(/\D/g, "");
  return digits.slice(-10);
}

export function formatDuration(sec: number): string {
  if (sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
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

export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

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

// ── Lead directory used for matching ───────────────────────────────
// Representative CRM leads (each with a primary + alternative number). Captured
// intake leads are merged in so real leads match too.
// No demo contacts — the directory is built only from real captured leads.
const SEED_CONTACTS: LeadContact[] = [];

export function leadContacts(): LeadContact[] {
  const intake = loadIntakeLeads()
    .filter((l) => !l.deleted && l.phone && l.phone !== "—")
    .map<LeadContact>((l) => ({
      id: l.id,
      name: l.name,
      company: l.company,
      primary: l.phone,
      alternative: l.altPhone ?? "",
    }));
  return [...intake, ...SEED_CONTACTS];
}

// Match a call's number against the lead directory (primary then alternative).
export function matchCall(number: string, contacts: LeadContact[]): { lead: LeadContact; side: PhoneSide } | null {
  const n = normalizePhone(number);
  if (!n) return null;
  for (const lead of contacts) {
    if (normalizePhone(lead.primary) === n) return { lead, side: "primary" };
    if (lead.alternative && normalizePhone(lead.alternative) === n) return { lead, side: "alternative" };
  }
  return null;
}

// Keep only calls that match a CRM lead.
export function trackedCalls(calls: Call[], contacts: LeadContact[]): TrackedCall[] {
  const out: TrackedCall[] = [];
  for (const call of calls) {
    const m = matchCall(call.number, contacts);
    if (m) out.push({ ...call, lead: m.lead, side: m.side });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
