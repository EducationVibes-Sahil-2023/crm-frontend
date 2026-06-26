// Asset management API client + helpers — talks to the CodeIgniter backend.
// Workflow: pending -> submitted -> verified | rejected (-> back to editable).

import type { IconName } from "@/components/icons";
import { getToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type AssetStatus = "pending" | "submitted" | "verified" | "rejected";
export type Role = "admin" | "user";

export type Actor = { actor: string; role: Role };

export type AssetEvent = {
  id: string;
  asset_id: string;
  type: "created" | "updated" | "submitted" | "verified" | "rejected" | "reopened" | "comment";
  actor: string | null;
  role: Role | null;
  message: string | null;
  created_at: string;
};

export type Asset = {
  id: string;
  tag: string | null;
  name: string;
  category: string | null;
  image_url: string | null;
  bill_url: string | null;
  warranty_doc_url: string | null;
  description: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  condition: string | null;
  vendor: string | null;
  owner_name: string | null;
  owner_email: string | null;
  purchase_date: string | null;
  purchase_cost: string | number;
  repair_cost: string | number;
  warranty_years: string | number;
  warranty_expiry: string | null;
  status: AssetStatus;
  reject_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  events?: AssetEvent[];
};

/** Fields the asset form edits. */
export type AssetFields = Partial<
  Pick<
    Asset,
    | "tag" | "name" | "category" | "image_url" | "description" | "serial_number" | "manufacturer"
    | "model" | "location" | "condition" | "vendor" | "owner_name" | "owner_email"
    | "purchase_date" | "purchase_cost" | "bill_url" | "repair_cost" | "warranty_years"
    | "warranty_doc_url"
  >
>;

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
      msg = parsed.messages
        ? Object.values(parsed.messages).join(" ")
        : parsed.message || msg;
    } catch {
      /* keep raw */
    }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const assetsApi = {
  list: () => request<Asset[]>("/assets"),
  get: (id: string) => request<Asset>(`/assets/${id}`),

  /** Upload an image/document and return its public URL (via the media API). */
  upload: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file[]", file);
    const out = await request<{ url: string }[]>("/media/files", { method: "POST", body: form });
    return out?.[0]?.url ?? "";
  },

  create: (fields: AssetFields, by: Actor) =>
    post<Asset>("/assets", { ...fields, ...by }),

  update: (id: string, fields: AssetFields, by: Actor) =>
    request<Asset>(`/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, ...by }),
    }),

  remove: (id: string) => request<unknown>(`/assets/${id}`, { method: "DELETE" }),

  submit: (id: string, by: Actor) => post<Asset>(`/assets/${id}/submit`, by),
  verify: (id: string, by: Actor) => post<Asset>(`/assets/${id}/verify`, by),
  reject: (id: string, reason: string, by: Actor) => post<Asset>(`/assets/${id}/reject`, { reason, ...by }),
  reopen: (id: string, by: Actor) => post<Asset>(`/assets/${id}/reopen`, by),
  comment: (id: string, message: string, by: Actor) => post<Asset>(`/assets/${id}/comments`, { message, ...by }),
};

// ---- helpers -----------------------------------------------------------

export const STATUS_META: Record<
  AssetStatus,
  { label: string; badge: string; dot: string; icon: IconName }
> = {
  pending: { label: "Awaiting info", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", icon: "edit" },
  submitted: { label: "Under review", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", icon: "eye" },
  verified: { label: "Verified", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: "check" },
  rejected: { label: "Rejected", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", icon: "close" },
};

export const EVENT_META: Record<AssetEvent["type"], { icon: IconName; wrap: string }> = {
  created: { icon: "plus", wrap: "bg-slate-100 text-slate-500" },
  updated: { icon: "edit", wrap: "bg-indigo-100 text-indigo-600" },
  submitted: { icon: "upload", wrap: "bg-blue-100 text-blue-600" },
  verified: { icon: "check", wrap: "bg-emerald-100 text-emerald-600" },
  rejected: { icon: "close", wrap: "bg-rose-100 text-rose-600" },
  reopened: { icon: "edit", wrap: "bg-amber-100 text-amber-600" },
  comment: { icon: "message", wrap: "bg-violet-100 text-violet-600" },
};

/** A user may edit asset info only while pending or rejected. */
export function userCanEdit(status: AssetStatus): boolean {
  return status === "pending" || status === "rejected";
}

/**
 * Auto-generate the next asset tag (AST-####). Tags are system-assigned, never
 * typed by a user — derived from the highest existing AST-#### in the list.
 */
export function nextAssetTag(existing: Asset[]): string {
  let max = 1000;
  for (const a of existing) {
    const m = /AST-(\d+)/i.exec(a.tag ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `AST-${max + 1}`;
}

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatMoney(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? money.format(n) : "₹0";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso.replace(" ", "T")).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
