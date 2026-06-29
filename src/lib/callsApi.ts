// Call Tracker data — real device calls from the backend `calls` SQL table.
// Per-user and tenant-scoped on the server. Replaces the old localStorage store
// and the simulated call generator.

import { getToken } from "@/lib/auth";
import type { Call } from "@/lib/callTracker";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json", ...(init?.headers as Record<string, string>) });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const callsApi = {
  /** The signed-in user's calls, newest first. */
  list: async (): Promise<Call[]> => (await req<{ calls: Call[] }>("/calls")).calls ?? [],

  /** Log a single call (device bridge or manual entry). */
  create: async (call: Omit<Call, "id">): Promise<Call> =>
    (await req<{ call: Call }>("/calls", { method: "POST", body: JSON.stringify(call) })).call,

  /** Remove one of the caller's calls. */
  remove: (id: string): Promise<unknown> => req(`/calls/${id}`, { method: "DELETE" }),
};
