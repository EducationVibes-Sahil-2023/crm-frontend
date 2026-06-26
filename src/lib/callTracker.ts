// Local-first call tracker. Simulates the companion mobile app: it "syncs" the
// device call log and keeps only the calls that match a CRM lead — on either the
// lead's PRIMARY or ALTERNATIVE number. Swap the sync + stores for the real
// mobile-app upload + API later; the matching logic stays the same.

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
const SEED_CONTACTS: LeadContact[] = [
  { id: "lc1", name: "Aarav Sharma", company: "Infosys", primary: "+91 98765 43210", alternative: "+91 90011 22334" },
  { id: "lc2", name: "Diya Patel", company: "TCS", primary: "+91 99000 11223", alternative: "+91 81234 56789" },
  { id: "lc3", name: "Vivaan Reddy", company: "Wipro", primary: "+91 98111 22333", alternative: "" },
  { id: "lc4", name: "Ananya Nair", company: "Zoho", primary: "+91 97777 88899", alternative: "+91 73456 12390" },
  { id: "lc5", name: "Kabir Mehta", company: "Acme Corp", primary: "+91 90909 80808", alternative: "+91 91234 00000" },
];

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

// ── Storage: install time, calls, last sync ────────────────────────
const CALLS_KEY = "nexus_calls";
const INSTALL_KEY = "nexus_call_install_at";
const SYNC_KEY = "nexus_call_last_sync";

function iso(minsAgo: number): string {
  return new Date(Date.now() - minsAgo * 60000).toISOString();
}

// Installation time — set once, the moment tracking begins.
export function getInstallTime(): string {
  if (typeof window === "undefined") return new Date().toISOString();
  let v = window.localStorage.getItem(INSTALL_KEY);
  if (!v) {
    v = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(); // pretend installed 3 days ago
    window.localStorage.setItem(INSTALL_KEY, v);
  }
  return v;
}

export function getLastSync(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SYNC_KEY);
}

function setLastSync(): void {
  if (typeof window !== "undefined") window.localStorage.setItem(SYNC_KEY, new Date().toISOString());
}

function seedCalls(device: string): Call[] {
  return [
    { id: "call-1", number: "+91 98765 43210", rawName: "Aarav S", direction: "outgoing", at: iso(40), durationSec: 215, device },
    { id: "call-2", number: "9001122334", rawName: "", direction: "incoming", at: iso(95), durationSec: 64, device }, // Aarav alt
    { id: "call-3", number: "+91 99000 11223", rawName: "Diya", direction: "missed", at: iso(160), durationSec: 0, device },
    { id: "call-4", number: "081234 56789", rawName: "", direction: "incoming", at: iso(220), durationSec: 410, device }, // Diya alt
    { id: "call-5", number: "+91 98111 22333", rawName: "Vivaan", direction: "outgoing", at: iso(300), durationSec: 132, device },
    { id: "call-6", number: "+91 90909 80808", rawName: "Kabir", direction: "outgoing", at: iso(620), durationSec: 78, device },
    { id: "call-7", number: "+91 91234 00000", rawName: "", direction: "missed", at: iso(700), durationSec: 0, device }, // Kabir alt
    // Unmatched (not a CRM lead) — these are ignored by the tracker.
    { id: "call-8", number: "+91 88888 77777", rawName: "Pizza", direction: "incoming", at: iso(130), durationSec: 33, device },
    { id: "call-9", number: "+91 70000 00001", rawName: "Unknown", direction: "missed", at: iso(500), durationSec: 0, device },
  ];
}

export function loadCalls(device: string): Call[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CALLS_KEY);
    if (!raw) {
      const seeded = seedCalls(device);
      window.localStorage.setItem(CALLS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Call[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCalls(list: Call[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CALLS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// Simulate the mobile app pushing newly-logged calls since the last sync.
// Returns the merged list and how many new calls came in.
export function syncCalls(existing: Call[], device: string): { calls: Call[]; added: number } {
  const contacts = leadContacts();
  // Pull a couple of recent calls from the device log — bias toward CRM leads.
  const pool = contacts.slice(0, 4);
  const dirs: CallDirection[] = ["incoming", "outgoing", "missed"];
  const howMany = 1 + Math.floor(Math.random() * 2);
  const fresh: Call[] = [];
  for (let k = 0; k < howMany; k++) {
    const lead = pool[Math.floor(Math.random() * pool.length)];
    const useAlt = lead.alternative && Math.random() > 0.6;
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    fresh.push({
      id: `call-${Date.now()}-${k}`,
      number: useAlt ? lead.alternative : lead.primary,
      rawName: lead.name,
      direction: dir,
      at: new Date(Date.now() - k * 60000).toISOString(),
      durationSec: dir === "missed" ? 0 : 30 + Math.floor(Math.random() * 400),
      device,
    });
  }
  const calls = [...fresh, ...existing];
  saveCalls(calls);
  setLastSync();
  return { calls, added: fresh.length };
}
