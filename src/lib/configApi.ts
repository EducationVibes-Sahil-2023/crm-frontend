// Lead-setup / lookup lists — DB-backed CRUD against /api/config/:kind.
// Workspace-scoped: the client JWT (tenant claim) points the backend at the
// caller's own database, so every workspace has its own status/source/type/…

import { getToken } from "@/lib/auth";
import type { OptionKind } from "@/lib/setup";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type ConfigItem = { id: string; name: string; color: string; sortOrder: number };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers as Record<string, string>) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const listConfig = (kind: OptionKind) => req<{ items: ConfigItem[] }>(`/config/${kind}`).then((d) => d.items);
export const createConfig = (kind: OptionKind, body: { name: string; color?: string }) => req<ConfigItem>(`/config/${kind}`, { method: "POST", body: JSON.stringify(body) });
export const updateConfig = (kind: OptionKind, id: string, patch: { name?: string; color?: string; sortOrder?: number }) => req<ConfigItem>(`/config/${kind}/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteConfig = (kind: OptionKind, id: string) => req<{ ok: true }>(`/config/${kind}/${id}`, { method: "DELETE" });
export const reorderConfig = (kind: OptionKind, ids: string[]) => req<{ ok: true }>(`/config/${kind}/reorder`, { method: "POST", body: JSON.stringify({ ids }) });
