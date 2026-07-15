// Per-USER storage on top of the workspace dbStore (MySQL app_store). Namespaces
// the key by the signed-in user's id, so two users in the same workspace never
// share per-user data (profile, notification prefs, …). Reads are sync from the
// hydrated store cache; writes persist to the workspace DB via /api/store.

import { dbGet, dbSet } from "@/lib/dbStore";
import { getUser } from "@/lib/auth";

function scopedKey(key: string): string {
  const id = getUser()?.id ?? 0;
  return `${key}__u${id}`;
}

export function userGet<T>(key: string, fallback: T): T {
  return dbGet<T>(scopedKey(key), fallback);
}

export function userSet<T>(key: string, value: T): void {
  dbSet<T>(scopedKey(key), value);
}
