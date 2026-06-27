// Fresh-workspace cleanup.
//
// Several modules are still local-first: they keep their records in
// localStorage and SEED sample/demo rows the first time their key is missing
// (`if (!raw) … seed()`). That means a brand-new client workspace shows fake
// leads, tasks, transfers, follow-ups, announcements, invoices, etc. even
// though the backend database is empty.
//
// This runs once per browser (gated by a version flag) and writes an empty
// array `"[]"` into each demo DATA key. Because the seeders only fire when the
// key is ABSENT, an existing `"[]"` makes every loader return an empty list —
// so the UI reflects the empty database. Anything the user creates later
// overwrites the `"[]"` normally.
//
// Only record/data keys are listed here. Config, lookups, preferences, branding
// and auth keys (priorities, categories, statuses, fields, roles, appearance,
// token, …) are intentionally left untouched so the app keeps working.
//
// Bump SEED_RESET_VERSION after adding new keys to force a re-clear.

const SEED_RESET_VERSION = "1";
const FLAG_KEY = "nexus_seed_reset";

// Demo/sample record stores (all array-backed) that should start empty.
const DEMO_DATA_KEYS: string[] = [
  // CRM
  "nexus_announcements_v2", // announcements
  "nexus_transfer_requests", // lead transfer requests
  "followups_v1", // follow-up tracker
  "nexus_lead_forms", // sample lead-capture form
  "nexus_calls", // call tracker log
  "nexus_visitor_sessions", // visitor tracker (analytics)
  "lead_visitor_requests_v1", // lead visitor requests
  // Work
  "nexus_tasks_v1", // task management
  "nexus_calendar_events", // calendar
  "nexus_tickets", // support tickets
  "activity_log_v1", // activity log
  // Finance
  "nexus_invoices_v1", // accounts invoices
  "nexus_quotations", // quotations
  "nexus_invoices", // invoices (billing)
  "nexus_payments", // payments
  "finance_expenses_v1", // expenses
  "finance_bills_v1", // bills
  "vendors_v1", // vendors
  // Communications
  "nexus_chat_conversations", // team chat
  "nexus_chat_messages",
  "mail_v1", // mailbox sample
  "wa_logs_v1", // whatsapp message log
];

/**
 * Blank out demo seed data so a fresh workspace starts empty. Idempotent and
 * safe to call on every load — it no-ops once the current version has run.
 */
export function clearDemoSeedData(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FLAG_KEY) === SEED_RESET_VERSION) return;
    for (const key of DEMO_DATA_KEYS) {
      window.localStorage.setItem(key, "[]");
    }
    window.localStorage.setItem(FLAG_KEY, SEED_RESET_VERSION);
  } catch {
    /* localStorage unavailable (private mode/quota) — ignore */
  }
}

// Run as a top-level side effect at import time, before any page component
// renders and reads its store, so the very first paint already reflects the
// empty workspace.
clearDemoSeedData();
