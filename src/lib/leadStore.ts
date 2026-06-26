// Shared, real-time lead intake store. Captured leads (from website forms,
// Excel/CSV imports and webhooks) are written here and broadcast to any open
// CRM view via a custom event. Backed by the database (app_store) — see dbStore.

import { dbGet, dbSet } from "@/lib/dbStore";

export type IntakeChannel = "Website Form" | "Excel Import" | "Webhook" | "Manual";

// Mirrors the Leads page `Lead` shape so captured leads drop straight in.
export type IntakeLead = {
  id: string;
  deleted?: boolean;
  name: string;
  company: string;
  phone: string; // primary number
  altPhone?: string; // alternative / secondary number
  email: string;
  city: string;
  state: string;
  status: string;
  source: string;
  type: string;
  followUpDate: string;
  connectedDate: string;
  lastUpdated: string;
  assignationDate: string;
  responseTime: string;
  referenceName: string;
  totalCallCount: number;
  callCount: number;
  duration: string;
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  channel: IntakeChannel;
  formId?: string;
  assignedTo?: string; // counsellor name (auto-assignment)
};

const KEY = "nexus_intake_leads";
export const LEADS_EVENT = "nexus-leads-changed";

export function loadIntakeLeads(): IntakeLead[] {
  const list = dbGet<IntakeLead[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

function persist(list: IntakeLead[]) {
  dbSet(KEY, list);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LEADS_EVENT));
}

// Build a full IntakeLead from a partial submission + sensible defaults.
export function makeIntakeLead(
  partial: Partial<IntakeLead> & { name: string },
  channel: IntakeChannel,
  defaults?: { status?: string; source?: string; type?: string },
): IntakeLead {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  return {
    id: `intake-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: partial.name.trim() || "Unknown",
    company: partial.company?.trim() || "—",
    phone: partial.phone?.trim() || "—",
    altPhone: partial.altPhone?.trim() || "",
    email: partial.email?.trim() || "—",
    city: partial.city?.trim() || "—",
    state: partial.state?.trim() || "—",
    status: partial.status || defaults?.status || "New",
    source: partial.source || defaults?.source || channel,
    type: partial.type || defaults?.type || "Warm",
    followUpDate: "—",
    connectedDate: "—",
    lastUpdated: "just now",
    assignationDate: "—",
    responseTime: "—",
    referenceName: partial.referenceName?.trim() || channel,
    totalCallCount: 0,
    callCount: 0,
    duration: "0m",
    createdDate: today,
    updatedDate: today,
    createdBy: channel,
    channel,
    formId: partial.formId,
    assignedTo: partial.assignedTo,
  };
}

// Find an existing captured lead that matches `lead` on any of `fields`
// (e.g. ["email","phone"]). Used to prevent duplicate inserts.
export function findDuplicate(lead: IntakeLead, fields: string[]): IntakeLead | undefined {
  if (!fields.length) return undefined;
  const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
  const list = loadIntakeLeads();
  return list.find((x) =>
    fields.some((f) => {
      const a = norm((lead as unknown as Record<string, string>)[f]);
      const b = norm((x as unknown as Record<string, string>)[f]);
      return a && a !== "—" && a === b;
    }),
  );
}

// Append one captured lead and broadcast. Returns the stored lead.
export function captureLead(lead: IntakeLead): IntakeLead {
  const list = loadIntakeLeads();
  persist([lead, ...list]);
  return lead;
}

// Append many (Excel/CSV import) in one broadcast.
export function captureMany(leads: IntakeLead[]): number {
  if (!leads.length) return 0;
  const list = loadIntakeLeads();
  persist([...leads, ...list]);
  return leads.length;
}

// Subscribe to any change (same tab + cross tab). Returns an unsubscribe fn.
export function subscribeLeads(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  window.addEventListener(LEADS_EVENT, onLocal);
  return () => window.removeEventListener(LEADS_EVENT, onLocal);
}
