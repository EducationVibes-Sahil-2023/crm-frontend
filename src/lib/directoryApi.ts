import { getToken } from "@/lib/auth";

/**
 * Team directory (Users page) — real, per-tenant DB storage via the backend.
 * The JWT routes each request to the caller's database, so every client sees
 * only their own people. See backend Api\Directory.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type DirectoryEntry = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  role: string;
  status: string;
  bio: string;
  profile: string;
  password: string;
  linkedin: string;
  twitter: string;
  github: string;
  joiningDate: string;
  employeeId: string;
  companyCode: string;
  city: string;
  state: string;
  address: string;
  zip: string;
  extraPermissions?: Record<string, unknown>;
};

type Row = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v));

function fromApi(r: Row): DirectoryEntry {
  let extra: Record<string, unknown> | undefined;
  if (r.extra_permissions) {
    try { extra = JSON.parse(String(r.extra_permissions)); } catch { extra = undefined; }
  }
  return {
    id: r.id != null ? Number(r.id) : undefined,
    name: str(r.name), email: str(r.email), phone: str(r.phone),
    designation: str(r.designation), department: str(r.department),
    role: str(r.role), status: str(r.status) || "Active", bio: str(r.bio),
    profile: str(r.profile), password: str(r.password),
    linkedin: str(r.linkedin), twitter: str(r.twitter), github: str(r.github),
    joiningDate: str(r.joining_date), employeeId: str(r.employee_id),
    companyCode: str(r.company_code), city: str(r.city), state: str(r.state),
    address: str(r.address), zip: str(r.zip), extraPermissions: extra,
  };
}

function toApi(e: Partial<DirectoryEntry>): Row {
  const r: Row = {};
  const direct: (keyof DirectoryEntry)[] = ["name", "email", "phone", "designation", "department", "role", "status", "bio", "profile", "password", "linkedin", "twitter", "github", "city", "state", "address", "zip"];
  for (const k of direct) if (e[k] !== undefined) r[k] = e[k];
  if (e.joiningDate !== undefined) r.joining_date = e.joiningDate;
  if (e.employeeId !== undefined) r.employee_id = e.employeeId;
  if (e.companyCode !== undefined) r.company_code = e.companyCode;
  if (e.extraPermissions !== undefined) r.extra_permissions = e.extraPermissions;
  return r;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json", ...(init?.headers as Record<string, string>) });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const directoryApi = {
  list: async (): Promise<DirectoryEntry[]> => (await req<Row[]>("/directory")).map(fromApi),
  create: async (e: Omit<DirectoryEntry, "id">): Promise<DirectoryEntry> =>
    fromApi(await req<Row>("/directory", { method: "POST", body: JSON.stringify(toApi(e)) })),
  update: async (id: number, e: Partial<DirectoryEntry>): Promise<DirectoryEntry> =>
    fromApi(await req<Row>(`/directory/${id}`, { method: "PUT", body: JSON.stringify(toApi(e)) })),
  remove: (id: number): Promise<unknown> => req(`/directory/${id}`, { method: "DELETE" }),
};
