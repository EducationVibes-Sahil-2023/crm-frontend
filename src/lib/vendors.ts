// Vendors — supplier directory, persisted to the normalised MySQL `vendors`
// table via /api/vendors. Reads stay synchronous from an in-memory cache
// (hydrated once at sign-in by AuthGuard); writes persist to the backend and
// broadcast VENDORS_EVENT so open views refresh.

import { apiRequest } from "@/lib/api";
import { dbGet, isStoreReady } from "@/lib/dbStore";

export type Vendor = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  category: string;
  gstin: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  paymentTerms: string;
  status: string; // Active | Inactive
  notes: string;
  createdAt: string;
};

export const VENDOR_CATEGORIES = ["Supplier", "Service Provider", "Manufacturer", "Distributor", "Contractor", "Wholesaler"];
export const PAYMENT_TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 45", "Net 60"];
export const VENDOR_STATUSES = ["Active", "Inactive"];

export const VENDORS_EVENT = "nexus-vendors-changed";
const OLD_BLOB_KEY = "vendors_v1"; // legacy app_store blob (pre-migration)
const MIGRATED_FLAG = "nexus_vendors_blob_migrated_v1";

type VendorRow = Record<string, unknown> & { id: string };

let cache: Vendor[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

function broadcast() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VENDORS_EVENT));
}
function isServerId(id: string): boolean {
  return /^\d+$/.test(id);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(dt: unknown): string {
  if (!dt) return "—";
  const d = new Date(String(dt).replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

function fromRow(r: VendorRow): Vendor {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    contactPerson: String(r.contact_person ?? ""),
    email: String(r.email ?? ""),
    phone: String(r.phone ?? ""),
    category: String(r.category ?? VENDOR_CATEGORIES[0]),
    gstin: String(r.gstin ?? ""),
    website: String(r.website ?? ""),
    address: String(r.address ?? ""),
    city: String(r.city ?? ""),
    state: String(r.state ?? ""),
    zip: String(r.zip ?? ""),
    country: String(r.country ?? "India"),
    paymentTerms: String(r.payment_terms ?? "Net 30"),
    status: String(r.status ?? "Active"),
    notes: String(r.notes ?? ""),
    createdAt: fmtDate(r.created_at),
  };
}

function toRow(v: Vendor): Record<string, unknown> {
  return {
    name: v.name,
    contact_person: v.contactPerson,
    email: v.email,
    phone: v.phone,
    category: v.category,
    gstin: v.gstin,
    website: v.website,
    address: v.address,
    city: v.city,
    state: v.state,
    zip: v.zip,
    country: v.country,
    payment_terms: v.paymentTerms,
    status: v.status,
    notes: v.notes,
  };
}

/** Load the vendors table into the cache. Runs once (call from AuthGuard). */
export async function hydrateVendors(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (hydrated && !force) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      await migrateBlobIfNeeded();
      const res = await apiRequest<{ vendors: VendorRow[] }>("/vendors");
      cache = (res.vendors ?? []).map(fromRow);
    } catch {
      /* backend offline — keep cache */
    } finally {
      hydrated = true;
      hydrating = null;
      broadcast();
    }
  })();
  return hydrating;
}

/** One-time import of the legacy app_store blob into the vendors table. */
async function migrateBlobIfNeeded(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    if (!isStoreReady()) return;
    const blob = dbGet<Vendor[]>(OLD_BLOB_KEY, []);
    if (Array.isArray(blob) && blob.length > 0) {
      const existing = await apiRequest<{ vendors: VendorRow[] }>("/vendors");
      if ((existing.vendors ?? []).length === 0) {
        for (const v of blob) {
          try {
            await apiRequest("/vendors", { method: "POST", body: JSON.stringify(toRow(v)) });
          } catch {
            /* skip a bad row */
          }
        }
      }
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    /* retry on a later hydrate */
  }
}

export function loadVendors(): Vendor[] {
  return cache;
}

/** Create a vendor; resolves to the stored row (with its real id). */
export async function addVendor(v: Vendor): Promise<Vendor> {
  const res = await apiRequest<{ vendor: VendorRow }>("/vendors", { method: "POST", body: JSON.stringify(toRow(v)) });
  const saved = fromRow(res.vendor);
  cache = [saved, ...cache];
  broadcast();
  return saved;
}

/** Update a vendor by id. */
export async function updateVendor(id: string, v: Vendor): Promise<void> {
  cache = cache.map((x) => (x.id === id ? { ...v, id } : x)); // optimistic
  broadcast();
  if (!isServerId(id)) return;
  const res = await apiRequest<{ vendor: VendorRow }>(`/vendors/${id}`, { method: "PUT", body: JSON.stringify(toRow(v)) });
  cache = cache.map((x) => (x.id === id ? fromRow(res.vendor) : x));
  broadcast();
}

/** Delete a vendor by id. */
export async function removeVendor(id: string): Promise<void> {
  cache = cache.filter((x) => x.id !== id);
  broadcast();
  if (isServerId(id)) await apiRequest(`/vendors/${id}`, { method: "DELETE" }).catch(() => {});
}

export function subscribeVendors(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = () => cb();
  window.addEventListener(VENDORS_EVENT, h);
  return () => window.removeEventListener(VENDORS_EVENT, h);
}

export function emptyVendor(): Vendor {
  return {
    id: "", name: "", contactPerson: "", email: "", phone: "", category: VENDOR_CATEGORIES[0],
    gstin: "", website: "", address: "", city: "", state: "", zip: "", country: "India",
    paymentTerms: "Net 30", status: "Active", notes: "", createdAt: "—",
  };
}
