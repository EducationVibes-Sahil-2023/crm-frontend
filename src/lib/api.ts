import { getToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type Task = {
  id: string;
  title: string;
  is_done: string; // "0" | "1"
  created_at: string;
  updated_at: string;
};

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

export const api = {
  health: () => request<{ status: string; database: string }>("/health"),
  listTasks: () => request<Task[]>("/tasks"),
};
