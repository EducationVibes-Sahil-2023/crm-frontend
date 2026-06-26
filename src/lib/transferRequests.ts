// Lead transfer requests — a manager-approval workflow for reassigning a lead
// from one counsellor to another. Local-first (localStorage); swap for API later.

export type TransferStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export type TransferRequest = {
  id: string;
  leadId?: string;
  leadName: string;
  fromUser: string; // current owner
  toUser: string; // requested new owner
  reason: string;
  status: TransferStatus;
  requestedBy: string;
  requestedAt: string; // ISO
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
};

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; badge: string; dot: string }> = {
  Pending: { label: "Pending", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  Approved: { label: "Approved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  Rejected: { label: "Rejected", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  Cancelled: { label: "Cancelled", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

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

const KEY = "nexus_transfer_requests";

function iso(minsAgo: number): string {
  return new Date(Date.now() - minsAgo * 60000).toISOString();
}

function seed(): TransferRequest[] {
  return [
    {
      id: "tr-1",
      leadName: "Acme Corp — Rahul Bose",
      fromUser: "Diya Patel",
      toUser: "Aarav Sharma",
      reason: "Lead is in Aarav's territory and speaks his regional language.",
      status: "Pending",
      requestedBy: "Diya Patel",
      requestedAt: iso(40),
    },
    {
      id: "tr-2",
      leadName: "Globex — Meera Iyer",
      fromUser: "Vivaan Reddy",
      toUser: "Ananya Nair",
      reason: "Going on leave next week, handing over active deals.",
      status: "Approved",
      requestedBy: "Vivaan Reddy",
      requestedAt: iso(60 * 20),
      decidedBy: "Administrator",
      decidedAt: iso(60 * 18),
      decisionNote: "Approved — smooth handover.",
    },
    {
      id: "tr-3",
      leadName: "Nimbus — Kabir Mehta",
      fromUser: "Aditya Iyer",
      toUser: "Ishaan Gupta",
      reason: "Requesting transfer, but Aditya is already engaged with the client.",
      status: "Rejected",
      requestedBy: "Ishaan Gupta",
      requestedAt: iso(60 * 30),
      decidedBy: "Administrator",
      decidedAt: iso(60 * 28),
      decisionNote: "Owner already in active conversation — keep as is.",
    },
  ];
}

export function loadTransferRequests(): TransferRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const seeded = seed();
      window.localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as TransferRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTransferRequests(list: TransferRequest[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function newTransferId(): string {
  return `tr-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}
