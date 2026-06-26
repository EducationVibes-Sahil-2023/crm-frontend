// Admin API client for real login accounts (backed by the CI4 `users` table).
// Distinct from lib/accounts.ts (CRM company accounts).

import { getToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type Account = {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  phone: string | null;
  department: string | null;
  designation: string | null;
  avatar: string | null;
  twofa_enabled: boolean;
  created_at: string | null;
};

export type AccountInput = {
  name: string;
  email: string;
  username?: string;
  password?: string;
  role?: string;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  active?: boolean;
};

export const ROLE_OPTIONS = ["Administrator", "Manager", "Counsellor", "Member", "Viewer"];

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const accountsApi = {
  list: () => req<Account[]>("/users"),
  create: (body: AccountInput) => req<Account>("/users", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<AccountInput>) => req<Account>(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number) => req<{ id: number }>(`/users/${id}`, { method: "DELETE" }),
  activate: (id: number) => req<Account>(`/users/${id}/activate`, { method: "POST" }),
  deactivate: (id: number) => req<Account>(`/users/${id}/deactivate`, { method: "POST" }),
  resetTwofa: (id: number) => req<Account>(`/users/${id}/reset-2fa`, { method: "POST" }),
};

export function qrUrl(otpauthUri: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=0&data=${encodeURIComponent(otpauthUri)}`;
}
