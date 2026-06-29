// Shared helpers for the Asset Management system — warranty status,
// depreciation maths, and a DB-backed maintenance log.
// Builds on the asset register data layer in @/lib/assets.

import type { Asset } from "@/lib/assets";
import { dbGet, dbSet } from "@/lib/dbStore";

// ---- warranty / AMC ----------------------------------------------------

export type WarrantyState = "none" | "expired" | "expiring" | "valid";

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function warrantyState(a: Asset, withinDays = 60): WarrantyState {
  if (!a.warranty_expiry) return "none";
  const d = daysUntil(a.warranty_expiry);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d <= withinDays) return "expiring";
  return "valid";
}

export const WARRANTY_META: Record<WarrantyState, { label: string; badge: string; dot: string }> = {
  valid: { label: "Under warranty", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  expiring: { label: "Expiring soon", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  expired: { label: "Expired", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  none: { label: "No warranty", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

// ---- depreciation (straight-line) --------------------------------------

export type DepreciationSettings = { lifeYears: number; salvagePct: number };
export const DEFAULT_DEPRECIATION: DepreciationSettings = { lifeYears: 5, salvagePct: 0 };
const DEP_KEY = "asset_depreciation_v1";

export function loadDepreciation(): DepreciationSettings {
  return { ...DEFAULT_DEPRECIATION, ...dbGet<Partial<DepreciationSettings>>(DEP_KEY, {}) };
}
export function saveDepreciation(s: DepreciationSettings): void {
  dbSet(DEP_KEY, s);
}

export type Depreciation = {
  cost: number;
  salvage: number;
  annual: number;
  elapsedYears: number;
  accumulated: number;
  bookValue: number;
  pct: number; // 0..1 depreciated
};

export function depreciate(a: Asset, s: DepreciationSettings): Depreciation {
  const cost = Number(a.purchase_cost || 0);
  const salvage = (cost * s.salvagePct) / 100;
  const life = Math.max(0.5, s.lifeYears);
  const annual = (cost - salvage) / life;
  let elapsedYears = 0;
  if (a.purchase_date) {
    const d = new Date(a.purchase_date.replace(" ", "T"));
    if (!isNaN(d.getTime())) elapsedYears = Math.max(0, (Date.now() - d.getTime()) / (365.25 * 86400000));
  }
  const accumulated = Math.min(cost - salvage, annual * elapsedYears);
  const bookValue = Math.max(salvage, cost - accumulated);
  const pct = cost > 0 ? accumulated / cost : 0;
  return { cost, salvage, annual, elapsedYears, accumulated, bookValue, pct };
}

// ---- maintenance log ---------------------------------------------------

export type MaintenanceType = "Preventive" | "Repair" | "Inspection" | "Upgrade" | "Calibration";
export const MAINTENANCE_TYPES: MaintenanceType[] = ["Preventive", "Repair", "Inspection", "Upgrade", "Calibration"];
export type MaintenanceStatus = "scheduled" | "completed" | "overdue";

export type Maintenance = {
  id: string;
  assetId: string;
  assetName: string;
  type: MaintenanceType;
  scheduled: string; // yyyy-mm-dd
  completed: string | null;
  cost: number;
  vendor: string;
  notes: string;
  createdAt: string;
};

const MNT_KEY = "asset_maintenance_v1";

export function loadMaintenance(): Maintenance[] {
  const parsed = dbGet<Maintenance[]>(MNT_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}
export function saveMaintenance(list: Maintenance[]): void {
  dbSet(MNT_KEY, list.slice(0, 500));
}

export function maintenanceStatus(m: Maintenance): MaintenanceStatus {
  if (m.completed) return "completed";
  const d = daysUntil(m.scheduled);
  if (d !== null && d < 0) return "overdue";
  return "scheduled";
}

export const MNT_STATUS_META: Record<MaintenanceStatus, { label: string; badge: string; dot: string }> = {
  scheduled: { label: "Scheduled", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  completed: { label: "Completed", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  overdue: { label: "Overdue", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};
