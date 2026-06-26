// Vendors — supplier directory with details, persisted per workspace.

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

const STORAGE_KEY = "vendors_v1";

function seed(v: Omit<Vendor, "id" | "createdAt"> & { id: string }): Vendor {
  return { createdAt: "—", ...v };
}

export const DEFAULT_VENDORS: Vendor[] = [
  seed({
    id: "v-acme", name: "Acme Supplies Co.", contactPerson: "Rajesh Kumar", email: "sales@acmesupplies.in", phone: "+91 98200 11223",
    category: "Supplier", gstin: "27AABCA1234F1Z5", website: "https://acmesupplies.in", address: "Plot 12, MIDC", city: "Pune", state: "MH", zip: "411001",
    country: "India", paymentTerms: "Net 30", status: "Active", notes: "Primary stationery & hardware supplier.",
  }),
  seed({
    id: "v-brightprint", name: "BrightPrint Media", contactPerson: "Sneha Iyer", email: "hello@brightprint.in", phone: "+91 99300 44556",
    category: "Service Provider", gstin: "29AAACB5678K1Z2", website: "https://brightprint.in", address: "4 Residency Rd", city: "Bengaluru", state: "KA", zip: "560025",
    country: "India", paymentTerms: "Net 15", status: "Active", notes: "Banners, brochures, event printing.",
  }),
  seed({
    id: "v-nimbus", name: "Nimbus Cloud Pvt Ltd", contactPerson: "David Chen", email: "accounts@nimbus.io", phone: "+1 (415) 555-0192",
    category: "Service Provider", gstin: "—", website: "https://nimbus.io", address: "500 Market St", city: "San Francisco", state: "CA", zip: "94105",
    country: "USA", paymentTerms: "Net 45", status: "Inactive", notes: "Cloud hosting — contract under review.",
  }),
];

export function loadVendors(): Vendor[] {
  if (typeof window === "undefined") return DEFAULT_VENDORS.map((v) => ({ ...v }));
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VENDORS.map((v) => ({ ...v }));
    const parsed = JSON.parse(raw) as Vendor[];
    if (!Array.isArray(parsed)) return DEFAULT_VENDORS.map((v) => ({ ...v }));
    return parsed;
  } catch {
    return DEFAULT_VENDORS.map((v) => ({ ...v }));
  }
}

export function saveVendors(vendors: Vendor[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vendors));
}

export function emptyVendor(): Vendor {
  return {
    id: "", name: "", contactPerson: "", email: "", phone: "", category: VENDOR_CATEGORIES[0],
    gstin: "", website: "", address: "", city: "", state: "", zip: "", country: "India",
    paymentTerms: "Net 30", status: "Active", notes: "", createdAt: "—",
  };
}
