// Per-lead notes, reminders, activity timeline, transfers, and lead visitor requests.
// Persisted to the per-tenant database (app_store via dbStore) — no localStorage.

import { dbGet, dbSet } from "@/lib/dbStore";

export type LeadNote = { id: string; leadId: string; text: string; by: string; at: string };
export type LeadReminder = { id: string; leadId: string; title: string; due: string; done: boolean; by: string; at: string };
export type ActivityKind = "created" | "note" | "reminder" | "transfer" | "visitor" | "edit" | "status" | "call";
export type LeadActivity = { id: string; leadId: string; kind: ActivityKind; text: string; by: string; at: string };
export type LeadTransfer = { id: string; leadId: string; leadName: string; from: string; to: string; reason: string; at: string };
export type CallDirection = "incoming" | "outgoing" | "missed";
export type LeadCall = { id: string; leadId: string; direction: CallDirection; durationSec: number; outcome: string; notes: string; by: string; at: string };
export type VisitorStatus = "Pending" | "Approved" | "Completed" | "Cancelled";
export type VisitorRequest = {
  id: string;
  leadId?: string;
  leadName: string;
  dateOfVisit: string; // ISO datetime-local value
  location: string;
  visitorType: string;
  attendee: string;
  address: string;
  purpose: string;
  requestedBy: string;
  status: VisitorStatus;
  at: string;
};

export const VISITOR_TYPES = ["Walk-in", "Scheduled Visit", "Field Visit", "Product Demo", "Document Collection", "Site Inspection"];

// Per-tenant DB-backed (app_store via dbStore) — no localStorage, no seeds.
function read<T>(key: string, fallback: T): T {
  return dbGet<T>(key, fallback);
}
function write<T>(key: string, value: T): void {
  dbSet<T>(key, value);
}
function nowStamp(): string {
  return new Date().toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
const rid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

// ---------- notes ----------
const NOTES = "lead_notes_v1";
export function leadNotes(leadId: string): LeadNote[] {
  return read<LeadNote[]>(NOTES, []).filter((n) => n.leadId === leadId).sort((a, b) => b.id.localeCompare(a.id));
}
export function addNote(leadId: string, text: string, by: string): LeadNote {
  const note: LeadNote = { id: rid("note"), leadId, text, by, at: nowStamp() };
  write(NOTES, [note, ...read<LeadNote[]>(NOTES, [])]);
  logLeadActivity(leadId, "note", `Note added: "${truncate(text)}"`, by);
  return note;
}
export function deleteNote(id: string): void {
  write(NOTES, read<LeadNote[]>(NOTES, []).filter((n) => n.id !== id));
}

// ---------- reminders ----------
const REM = "lead_reminders_v1";
export function leadReminders(leadId: string): LeadReminder[] {
  return read<LeadReminder[]>(REM, []).filter((r) => r.leadId === leadId).sort((a, b) => a.due.localeCompare(b.due));
}
export function allReminders(): LeadReminder[] {
  return read<LeadReminder[]>(REM, []);
}
export function addReminder(leadId: string, title: string, due: string, by: string): LeadReminder {
  const rem: LeadReminder = { id: rid("rem"), leadId, title, due, done: false, by, at: nowStamp() };
  write(REM, [rem, ...read<LeadReminder[]>(REM, [])]);
  logLeadActivity(leadId, "reminder", `Reminder set: "${title}"`, by);
  return rem;
}
export function toggleReminder(id: string): void {
  write(REM, read<LeadReminder[]>(REM, []).map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
}
export function deleteReminder(id: string): void {
  write(REM, read<LeadReminder[]>(REM, []).filter((r) => r.id !== id));
}

// ---------- activities ----------
const ACT = "lead_activities_v1";
export function leadActivities(leadId: string): LeadActivity[] {
  return read<LeadActivity[]>(ACT, []).filter((a) => a.leadId === leadId).sort((a, b) => b.id.localeCompare(a.id));
}
export function logLeadActivity(leadId: string, kind: ActivityKind, text: string, by: string): void {
  const act: LeadActivity = { id: rid("act"), leadId, kind, text, by, at: nowStamp() };
  write(ACT, [act, ...read<LeadActivity[]>(ACT, [])]);
}

// ---------- calls ----------
const CALLS = "lead_calls_v1";
export function leadCalls(leadId: string): LeadCall[] {
  return read<LeadCall[]>(CALLS, []).filter((c) => c.leadId === leadId).sort((a, b) => b.id.localeCompare(a.id));
}
export function addCall(
  leadId: string,
  direction: CallDirection,
  durationSec: number,
  outcome: string,
  notes: string,
  by: string,
): LeadCall {
  const call: LeadCall = { id: rid("call"), leadId, direction, durationSec, outcome, notes, by, at: nowStamp() };
  write(CALLS, [call, ...read<LeadCall[]>(CALLS, [])]);
  logLeadActivity(leadId, "call", `${direction[0].toUpperCase() + direction.slice(1)} call — ${outcome || "logged"}`, by);
  return call;
}
export function deleteCall(id: string): void {
  write(CALLS, read<LeadCall[]>(CALLS, []).filter((c) => c.id !== id));
}
export function formatCallDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ---------- transfers ----------
const TR = "lead_transfers_v1";
export function leadTransfers(leadId: string): LeadTransfer[] {
  return read<LeadTransfer[]>(TR, []).filter((t) => t.leadId === leadId).sort((a, b) => b.id.localeCompare(a.id));
}
export function addTransfer(leadId: string, leadName: string, from: string, to: string, reason: string): LeadTransfer {
  const t: LeadTransfer = { id: rid("tr"), leadId, leadName, from, to, reason, at: nowStamp() };
  write(TR, [t, ...read<LeadTransfer[]>(TR, [])]);
  logLeadActivity(leadId, "transfer", `Transferred from ${from} to ${to}`, from);
  return t;
}

// ---------- visitor requests ----------
const VR = "lead_visitor_requests_v1";
export function loadVisitorRequests(): VisitorRequest[] {
  return read<VisitorRequest[]>(VR, DEFAULT_VISITOR_REQUESTS);
}
export function saveVisitorRequests(list: VisitorRequest[]): void {
  write(VR, list);
}
export function addVisitorRequest(input: Omit<VisitorRequest, "id" | "status" | "at">): VisitorRequest {
  const req: VisitorRequest = { ...input, id: rid("vr"), status: "Pending", at: nowStamp() };
  write(VR, [req, ...loadVisitorRequests()]);
  if (input.leadId) logLeadActivity(input.leadId, "visitor", `Visitor request created for ${formatVisitDate(input.dateOfVisit)}`, input.requestedBy);
  return req;
}

export function formatVisitDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const DEFAULT_VISITOR_REQUESTS: VisitorRequest[] = [];
