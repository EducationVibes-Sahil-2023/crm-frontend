import type { CSSProperties } from "react";

export type OptionKind =
  | "status"
  | "source"
  | "type"
  | "subStatus"
  | "department"
  | "designation"
  | "ticketCategory"
  | "ticketPriority"
  | "assetCategory"
  | "vendor";

export type SetupOption = {
  id: string;
  name: string;
  color: string; // a key from COLORS
  createdBy: string;
  createdAt: string;
};

export type SetupData = Record<OptionKind, SetupOption[]>;

export const COLORS: { key: string; label: string; dot: string; badge: string }[] = [
  { key: "slate", label: "Slate", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700" },
  { key: "blue", label: "Blue", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  { key: "sky", label: "Sky", dot: "bg-sky-500", badge: "bg-sky-100 text-sky-700" },
  { key: "indigo", label: "Indigo", dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700" },
  { key: "violet", label: "Violet", dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700" },
  { key: "emerald", label: "Emerald", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  { key: "amber", label: "Amber", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  { key: "rose", label: "Rose", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-700" },
];

export function colorBadge(key: string): string {
  return COLORS.find((c) => c.key === key)?.badge ?? "bg-slate-100 text-slate-700";
}
export function colorDot(key: string): string {
  return COLORS.find((c) => c.key === key)?.dot ?? "bg-slate-400";
}

// ── Custom-colour support ────────────────────────────────────────────────
// A colour value may be a preset KEY ("blue") or an arbitrary "#rrggbb" chosen
// from the colour picker. Tailwind can't generate classes for arbitrary hex, so
// hex colours render via the inline-style helpers below. Preset keys keep
// working with the class-based colorBadge/colorDot for existing consumers.

// Representative hex for each preset key (its Tailwind -500 shade).
const PRESET_HEX: Record<string, string> = {
  slate: "#64748b", blue: "#3b82f6", sky: "#0ea5e9", indigo: "#6366f1",
  violet: "#8b5cf6", emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e",
};

/** True when a value is a literal "#rrggbb" colour (vs a preset key). */
export function isHexColor(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test((c || "").trim());
}

/** Resolve a stored colour (preset key OR #rrggbb) to a concrete hex string. */
export function colorHex(color: string): string {
  if (isHexColor(color)) return color.trim();
  return PRESET_HEX[color] ?? PRESET_HEX.slate;
}

/** Inline style for a solid colour dot — works for presets AND custom hex. */
export function dotStyle(color: string): CSSProperties {
  return { backgroundColor: colorHex(color) };
}

/** Inline style for a soft badge (tinted background + coloured text). */
export function badgeStyle(color: string): CSSProperties {
  const hex = colorHex(color);
  return { backgroundColor: `${hex}1a`, color: hex };
}

export const KIND_LABELS: Record<OptionKind, string> = {
  status: "Status",
  source: "Source",
  type: "Type",
  subStatus: "Sub Status",
  department: "Department",
  designation: "Designation",
  ticketCategory: "Ticket Category",
  ticketPriority: "Ticket Priority",
  assetCategory: "Asset Category",
  vendor: "Vendor",
};

const STORAGE_KEY = "admin_setup_v2";

function seed(name: string, color: string): SetupOption {
  return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, color, createdBy: "System", createdAt: "—" };
}

// Lead/HR/support lookups (status, source, type, sub status, department,
// designation, ticket category & priority) start EMPTY — there is no demo data.
// The admin populates them from Admin Setup; until then the related dropdowns
// are empty. Only the inventory lookups (asset category, vendor) ship defaults.
export const DEFAULT_SETUP: SetupData = {
  status: [],
  source: [],
  type: [],
  subStatus: [],
  department: [],
  designation: [],
  ticketPriority: [],
  ticketCategory: [],
  assetCategory: [
    seed("Laptop", "blue"),
    seed("Desktop", "indigo"),
    seed("Monitor", "sky"),
    seed("Mobile", "violet"),
    seed("Furniture", "amber"),
    seed("Networking", "emerald"),
    seed("Peripheral", "slate"),
    seed("Software License", "rose"),
  ],
  vendor: [
    seed("Dell", "blue"),
    seed("HP", "sky"),
    seed("Lenovo", "rose"),
    seed("Apple", "slate"),
    seed("Amazon Business", "amber"),
    seed("Local Supplier", "emerald"),
  ],
};

function clone(data: SetupData): SetupData {
  return {
    status: data.status.map((o) => ({ ...o })),
    source: data.source.map((o) => ({ ...o })),
    type: data.type.map((o) => ({ ...o })),
    subStatus: data.subStatus.map((o) => ({ ...o })),
    department: data.department.map((o) => ({ ...o })),
    designation: data.designation.map((o) => ({ ...o })),
    ticketPriority: data.ticketPriority.map((o) => ({ ...o })),
    ticketCategory: data.ticketCategory.map((o) => ({ ...o })),
    assetCategory: data.assetCategory.map((o) => ({ ...o })),
    vendor: data.vendor.map((o) => ({ ...o })),
  };
}

export function loadSetup(): SetupData {
  if (typeof window === "undefined") return clone(DEFAULT_SETUP);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_SETUP);
    const parsed = JSON.parse(raw) as Partial<SetupData>;
    return {
      status: parsed.status ?? clone(DEFAULT_SETUP).status,
      source: parsed.source ?? clone(DEFAULT_SETUP).source,
      type: parsed.type ?? clone(DEFAULT_SETUP).type,
      subStatus: parsed.subStatus ?? clone(DEFAULT_SETUP).subStatus,
      department: parsed.department ?? clone(DEFAULT_SETUP).department,
      designation: parsed.designation ?? clone(DEFAULT_SETUP).designation,
      ticketPriority: parsed.ticketPriority ?? clone(DEFAULT_SETUP).ticketPriority,
      ticketCategory: parsed.ticketCategory ?? clone(DEFAULT_SETUP).ticketCategory,
      assetCategory: parsed.assetCategory ?? clone(DEFAULT_SETUP).assetCategory,
      vendor: parsed.vendor ?? clone(DEFAULT_SETUP).vendor,
    };
  } catch {
    return clone(DEFAULT_SETUP);
  }
}

export function saveSetup(data: SetupData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Convenience: just the names for a kind (used by Lead forms/filters). */
export function optionNames(kind: OptionKind): string[] {
  return loadSetup()[kind].map((o) => o.name);
}
