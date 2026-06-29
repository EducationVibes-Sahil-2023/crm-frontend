import { getToken } from "@/lib/auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type Task = {
  id: string;
  title: string;
  is_done: string; // "0" | "1"
  created_at: string;
  updated_at: string;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json", ...(init?.headers as Record<string, string>) });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// Raw lead row as returned by the backend `leads` table (snake_case). Mapping
// to/from the camelCase IntakeLead used across the app lives in lib/leadStore.
export type LeadRow = {
  id: string;
  custom?: Record<string, string> | Record<string, never>;
  [k: string]: unknown;
};

export const api = {
  health: () => request<{ status: string; database: string }>("/health"),
  listTasks: () => request<Task[]>("/tasks"),

  // ---- Leads (normalised `leads` table via /api/leads) ----
  listLeads: (params?: Record<string, string | number>) => {
    const qs = params
      ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : "";
    return request<{ leads: LeadRow[] }>(`/leads${qs}`).then((r) => r.leads);
  },
  createLead: (data: Record<string, unknown>) =>
    request<{ lead: LeadRow }>("/leads", { method: "POST", body: JSON.stringify(data) }).then((r) => r.lead),
  updateLead: (id: string, data: Record<string, unknown>) =>
    request<{ lead: LeadRow }>(`/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }).then((r) => r.lead),
  deleteLead: (id: string) => request<{ id: number }>(`/leads/${id}`, { method: "DELETE" }),
};
