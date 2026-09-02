import { useEffect, useState, type CSSProperties } from "react";

import { dbGet, dbSet } from "@/lib/dbStore";

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

// The lists live in MySQL now (per-workspace, via /api/config). We keep a
// synchronous in-memory cache (mirrors leadStore) so the many callers of
// loadSetup()/optionNames() stay sync; hydrateSetup() fills it from the API at
// sign-in, and setSetupKind() keeps it fresh after edits. Lists that have no
// Config controller yet fall back to the workspace store (app_store); nothing
// is mirrored into the browser.
export const SETUP_EVENT = "setup:changed";
// Lists that are DB-backed by the Config controller (vendor has its own table).
const DB_KINDS: OptionKind[] = ["status", "source", "type", "subStatus", "department", "designation", "ticketCategory", "ticketPriority", "assetCategory"];

let cache: SetupData | null = null;

function broadcast() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SETUP_EVENT));
}

// Base layer for the lists that aren't served by the Config controller — read
// from and written to the workspace database via dbStore.
function readBase(): SetupData {
  const p = dbGet<Partial<SetupData>>(STORAGE_KEY, {});
  const d = clone(DEFAULT_SETUP);
  (Object.keys(d) as OptionKind[]).forEach((k) => { if (p[k]) d[k] = p[k]!.map((o) => ({ ...o })); });
  return d;
}

function writeBase(data: SetupData): void {
  dbSet(STORAGE_KEY, data);
}

/** Pull every DB-backed list from the workspace API into the cache (sign-in). */
export async function hydrateSetup(): Promise<void> {
  if (typeof window === "undefined") return;
  const base = readBase();
  try {
    const { listConfig } = await import("@/lib/configApi");
    const results = await Promise.all(
      DB_KINDS.map((k) => listConfig(k).then((items) => [k, items] as const).catch(() => null)),
    );
    for (const r of results) {
      if (!r) continue;
      const [k, items] = r;
      base[k] = items.map((it) => ({ id: it.id, name: it.name, color: it.color || "slate", createdBy: "—", createdAt: "—" }));
    }
    cache = base;
    writeBase(base);
    broadcast();
  } catch {
    cache = base;
  }
}

/** Update one list in the cache (called after an edit). */
export function setSetupKind(kind: OptionKind, items: SetupOption[]): void {
  const c = cache ?? readBase();
  c[kind] = items.map((o) => ({ ...o }));
  cache = c;
  writeBase(c);
  broadcast();
}

export function loadSetup(): SetupData {
  if (!cache) cache = readBase();
  return clone(cache);
}

/** Kept for back-compat — writes the whole set to the cache + local mirror. */
export function saveSetup(data: SetupData): void {
  cache = clone(data);
  writeBase(data);
  broadcast();
}

/** Convenience: just the names for a kind (used by Lead forms/filters). */
export function optionNames(kind: OptionKind): string[] {
  return loadSetup()[kind].map((o) => o.name);
}

/** Live names for a kind — re-renders when the setup lists change. */
export function useSetupNames(kind: OptionKind): string[] {
  const [names, setNames] = useState<string[]>(() => optionNames(kind));
  useEffect(() => {
    const read = () => setNames(optionNames(kind));
    read();
    window.addEventListener(SETUP_EVENT, read);
    return () => window.removeEventListener(SETUP_EVENT, read);
  }, [kind]);
  return names;
}
