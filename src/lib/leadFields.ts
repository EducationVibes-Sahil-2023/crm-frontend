// Lead-form field configuration — which built-in fields are mandatory, plus
// admin-defined custom fields. All configurable from Admin Setup → Lead Fields.

export type LeadFieldKey =
  | "name" | "email" | "company" | "phone" | "city" | "state"
  | "status" | "source" | "type" | "referenceName";

export const LEAD_FIELDS: { key: LeadFieldKey; label: string; locked?: boolean }[] = [
  { key: "name", label: "Full Name", locked: true },
  { key: "email", label: "Email", locked: true },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone Number" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "status", label: "Status" },
  { key: "source", label: "Lead Source" },
  { key: "type", label: "Type" },
  { key: "referenceName", label: "Reference Name" },
];

/** field key -> required? */
export type LeadFieldConfig = Record<LeadFieldKey, boolean>;

export const DEFAULT_LEAD_FIELD_CONFIG: LeadFieldConfig = {
  name: true, email: true, company: false, phone: false, city: false, state: false,
  status: false, source: false, type: false, referenceName: false,
};

const CONFIG_KEY = "lead_field_config_v1";

export function loadLeadFieldConfig(): LeadFieldConfig {
  const cfg: LeadFieldConfig = { ...DEFAULT_LEAD_FIELD_CONFIG };
  if (typeof window === "undefined") return cfg;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LeadFieldConfig>;
      for (const f of LEAD_FIELDS) {
        if (typeof parsed[f.key] === "boolean") cfg[f.key] = parsed[f.key] as boolean;
      }
    }
  } catch {
    // ignore — fall back to defaults
  }
  // Locked fields are always required.
  for (const f of LEAD_FIELDS) if (f.locked) cfg[f.key] = true;
  return cfg;
}

export function saveLeadFieldConfig(cfg: LeadFieldConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// ---- Custom (admin-defined) lead fields --------------------------------

export type LeadCustomFieldType = "text" | "number" | "date" | "select";

export type LeadCustomField = {
  id: string;
  label: string;
  type: LeadCustomFieldType;
  options: string[]; // used when type === "select"
  required: boolean;
  createdAt: string;
};

const CUSTOM_KEY = "lead_custom_fields_v1";

export function loadCustomFields(): LeadCustomField[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    const parsed = raw ? (JSON.parse(raw) as LeadCustomField[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomFields(list: LeadCustomField[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

export function makeCustomField(
  label: string,
  type: LeadCustomFieldType,
  options: string[],
  required: boolean,
): LeadCustomField {
  return {
    id: `cf-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    label: label.trim(),
    type,
    options: type === "select" ? options.filter((o) => o.trim()).map((o) => o.trim()) : [],
    required,
    createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
  };
}
