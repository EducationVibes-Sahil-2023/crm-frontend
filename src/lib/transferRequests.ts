// Lead transfer requests — a manager-approval workflow for reassigning a lead
// from one counsellor to another. Persisted to the per-tenant database
// (app_store via dbStore).

import { dbGet, dbSet } from "@/lib/dbStore";

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

export function loadTransferRequests(): TransferRequest[] {
  const parsed = dbGet<TransferRequest[]>(KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveTransferRequests(list: TransferRequest[]): void {
  dbSet(KEY, list);
}

export function newTransferId(): string {
  return `tr-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}
