// Lead-capture form definitions + channel connectors (website embed, Excel/CSV,
// webhook). Forms persist in the per-tenant database (app_store via dbStore) —
// no localStorage, no seeded demo form. Submissions flow into the shared lead
// store (see lib/leadStore).

import { dbGet, dbSet } from "@/lib/dbStore";

export type FieldType = "text" | "email" | "phone" | "textarea" | "select";

export type FormField = {
  key: string; // maps to an IntakeLead field (name/email/phone/company/city/state) or custom
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};

export type AutoAssign = {
  enabled: boolean;
  mode: "round-robin" | "specific";
  userEmail: string; // used when mode === "specific"
};

export type LeadFormDef = {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  defaults: { status: string; source: string; type: string };
  channels: { website: boolean; excel: boolean; webhook: boolean };
  webhookSecret: string;
  createdAt: string;
  submissions: number;
  // Settings
  isPublic: boolean; // auto-published / publicly reachable
  successMessage: string; // shown after a successful submission
  allowDuplicates: boolean; // insert duplicates into the DB?
  dedupeFields: string[]; // fields checked when allowDuplicates is false
  autoAssign: AutoAssign; // auto-assign captured leads to a counsellor
  notifyOnTransfer: boolean; // notify when a lead is assigned/transferred
};

// Fields available for duplicate detection.
export const DEDUPE_FIELDS = ["email", "phone", "name"] as const;

const KEY = "nexus_lead_forms";

export const DEFAULT_FIELDS: FormField[] = [
  { key: "name", label: "Full name", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "phone", required: false },
  { key: "company", label: "Company / School", type: "text", required: false },
  { key: "city", label: "City", type: "text", required: false },
];

// Lead fields a form field can map onto (the rest are stored but unmapped).
export const MAPPABLE_KEYS = ["name", "email", "phone", "company", "city", "state"] as const;

function genSecret(): string {
  let s = "whsec_";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function defaultSettings(): Pick<LeadFormDef, "isPublic" | "successMessage" | "allowDuplicates" | "dedupeFields" | "autoAssign" | "notifyOnTransfer"> {
  return {
    isPublic: true,
    successMessage: "Thank you! Your details were submitted. Our team will reach out shortly.",
    allowDuplicates: false,
    dedupeFields: ["email", "phone"],
    autoAssign: { enabled: true, mode: "round-robin", userEmail: "" },
    notifyOnTransfer: true,
  };
}

// Backfill settings on forms saved before these fields existed.
function normalizeForm(f: LeadFormDef): LeadFormDef {
  return { ...defaultSettings(), ...f, autoAssign: { ...defaultSettings().autoAssign, ...f.autoAssign } };
}

export function loadForms(): LeadFormDef[] {
  const parsed = dbGet<LeadFormDef[]>(KEY, []);
  return Array.isArray(parsed) ? parsed.map(normalizeForm) : [];
}

export function saveForms(list: LeadFormDef[]): void {
  dbSet(KEY, list);
}

export function newForm(name: string): LeadFormDef {
  return {
    id: `form-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim() || "Untitled form",
    description: "",
    fields: DEFAULT_FIELDS.map((f) => ({ ...f })),
    defaults: { status: "New", source: "Website", type: "Warm" },
    channels: { website: true, excel: true, webhook: true },
    webhookSecret: genSecret(),
    createdAt: new Date().toISOString(),
    submissions: 0,
    ...defaultSettings(),
  };
}

// Round-robin (or fixed) auto-assignment to a counsellor. `seq` is the running
// submission count so each new lead rotates to the next counsellor.
export function pickAssignee(form: LeadFormDef, seq: number, directory: { name: string; email: string }[]): string | undefined {
  if (!form.autoAssign.enabled) return undefined;
  if (form.autoAssign.mode === "specific") {
    return directory.find((u) => u.email === form.autoAssign.userEmail)?.name || undefined;
  }
  if (!directory.length) return undefined;
  return directory[seq % directory.length].name;
}

// ---- channel connectors -----------------------------------------------------

export function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://your-crm.app";
}

export function publicFormUrl(id: string): string {
  return `${origin()}/forms/${id}`;
}

export function webhookUrl(id: string): string {
  return `${origin()}/api/intake/${id}`;
}

export function embedSnippet(form: LeadFormDef): string {
  return `<!-- ${form.name} — paste before </body> -->\n<iframe\n  src="${publicFormUrl(form.id)}?embed=1"\n  style="width:100%;max-width:480px;height:560px;border:0;border-radius:16px"\n  title="${form.name}"\n  loading="lazy">\n</iframe>`;
}

export function sampleCurl(form: LeadFormDef): string {
  const body = JSON.stringify(
    { name: "Aarav Sharma", email: "aarav@example.com", phone: "+91 98765 43210", company: "Infosys", city: "Mumbai" },
    null,
    2,
  );
  return `curl -X POST "${webhookUrl(form.id)}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Webhook-Secret: ${form.webhookSecret}" \\\n  -d '${body}'`;
}

// ---- CSV / Excel parsing ----------------------------------------------------
// Accepts pasted CSV or .csv contents. Returns header + row records.

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => (rec[h] = cells[i] ?? ""));
    return rec;
  });
  return { headers, rows };
}

// Map a loose CSV/webhook record onto known lead fields by fuzzy header match.
export function recordToLead(rec: Record<string, string>): {
  name: string; email?: string; phone?: string; company?: string; city?: string; state?: string;
} {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(rec).find((h) => h === k || h.includes(k));
      if (hit && rec[hit]) return rec[hit];
    }
    return undefined;
  };
  const first = pick("first name", "firstname", "first");
  const last = pick("last name", "lastname", "last");
  const name = pick("name", "full name", "fullname") || [first, last].filter(Boolean).join(" ").trim();
  return {
    name: name || "Unknown",
    email: pick("email", "e-mail", "mail"),
    phone: pick("phone", "mobile", "contact", "number"),
    company: pick("company", "school", "organisation", "organization", "org"),
    city: pick("city", "town"),
    state: pick("state", "region"),
  };
}
