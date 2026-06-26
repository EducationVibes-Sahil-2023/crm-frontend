// Inventory API client + helpers — talks to the CodeIgniter backend.
// Stock changes flow through /adjust which records a movement for traceability.

import { getToken } from "@/lib/auth";
import type { IconName } from "@/components/icons";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type MovementType = "in" | "out";

export type InventoryMovement = {
  id: string;
  item_id: string;
  type: MovementType;
  qty: string | number;
  balance_after: string | number;
  reason: string | null;
  actor: string | null;
  created_at: string;
};

export type AssignmentStatus = "issued" | "partial" | "returned";

export type InventoryAssignment = {
  id: string;
  item_id: string;
  assignee_name: string;
  assignee_email: string | null;
  qty: string | number;
  qty_returned: string | number;
  status: AssignmentStatus;
  note: string | null;
  asset_id: string | null;
  issued_by: string | null;
  issued_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  description: string | null;
  unit: string;
  quantity: string | number;
  reorder_level: string | number;
  unit_price: string | number;
  location: string | null;
  supplier: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  assigned?: number;
  movements?: InventoryMovement[];
  assignments?: InventoryAssignment[];
};

export type ItemFields = Partial<
  Pick<
    InventoryItem,
    "sku" | "name" | "category" | "description" | "unit" | "quantity"
    | "reorder_level" | "unit_price" | "location" | "supplier" | "image_url"
  >
>;

export type StockStatus = "in" | "low" | "out";

export const UNITS = ["pcs", "box", "pack", "ream", "kg", "litre", "set", "unit"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    let msg = body || res.statusText;
    try {
      const parsed = JSON.parse(body);
      msg = parsed.messages ? Object.values(parsed.messages).join(" ") : parsed.message || msg;
    } catch {
      /* keep raw */
    }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function send<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const inventoryApi = {
  list: () => request<InventoryItem[]>("/inventory"),
  get: (id: string) => request<InventoryItem>(`/inventory/${id}`),

  /** Upload a photo and return its public URL (via the media API). */
  upload: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file[]", file);
    const out = await request<{ url: string }[]>("/media/files", { method: "POST", body: form });
    return out?.[0]?.url ?? "";
  },
  create: (fields: ItemFields, actor: string) => send<InventoryItem>("/inventory", "POST", { ...fields, actor }),
  update: (id: string, fields: ItemFields) => send<InventoryItem>(`/inventory/${id}`, "PUT", fields),
  remove: (id: string) => request<unknown>(`/inventory/${id}`, { method: "DELETE" }),
  adjust: (id: string, type: MovementType, qty: number, reason: string, actor: string) =>
    send<InventoryItem>(`/inventory/${id}/adjust`, "POST", { type, qty, reason, actor }),

  assign: (
    id: string,
    payload: { assignee_name: string; assignee_email?: string; qty: number; note?: string; create_asset?: boolean },
    actor: string,
  ) => send<InventoryItem>(`/inventory/${id}/assign`, "POST", { ...payload, actor }),

  returnUnits: (assignmentId: string, qty: number | undefined, actor: string) =>
    send<InventoryItem>(`/inventory/assignments/${assignmentId}/return`, "POST", { qty, actor }),
};

export const ASSIGN_META: Record<AssignmentStatus, { label: string; badge: string }> = {
  issued: { label: "Issued", badge: "bg-blue-100 text-blue-700" },
  partial: { label: "Partly returned", badge: "bg-amber-100 text-amber-700" },
  returned: { label: "Returned", badge: "bg-emerald-100 text-emerald-700" },
};

// ---- helpers -----------------------------------------------------------

export function stockStatus(item: InventoryItem): StockStatus {
  const qty = Number(item.quantity || 0);
  const reorder = Number(item.reorder_level || 0);
  if (qty <= 0) return "out";
  if (reorder > 0 && qty <= reorder) return "low";
  return "in";
}

export const STATUS_META: Record<StockStatus, { label: string; badge: string; dot: string; icon: IconName }> = {
  in: { label: "In stock", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: "check" },
  low: { label: "Low stock", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", icon: "alert" },
  out: { label: "Out of stock", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", icon: "close" },
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function formatMoney(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? money.format(n) : "₹0";
}

export function itemValue(item: InventoryItem): number {
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso.replace(" ", "T")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso.replace(" ", "T")).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
