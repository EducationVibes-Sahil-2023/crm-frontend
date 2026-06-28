// Workspace team roster — the real login accounts, fetched from the backend
// (GET /api/team, available to any authenticated user). Used by Chat and any
// "pick a colleague" UI so they reflect the people who can actually sign in.

import { getToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  role?: string;
  department?: string | null;
  designation?: string | null;
  avatar?: string | null;
};

/** All active login accounts in the workspace. Empty list if offline/unauth. */
export async function listTeam(): Promise<TeamMember[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/team`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data) ? (data as TeamMember[]) : [];
  } catch {
    return [];
  }
}
