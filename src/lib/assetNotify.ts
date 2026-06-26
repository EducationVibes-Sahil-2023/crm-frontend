// In-app notification store for the asset workflow, targeted by recipient role
// (admin vs user). Local-first (localStorage) since the admin/user split is a
// front-end "View as" simulation. Also mirrors each event into the shared
// notify.ts email/push mock so those channels stay consistent.

import { loadNotifs, saveNotifs, sendEmail, sendPush } from "@/lib/notify";

export type Recipient = "admin" | "user";

export type AssetNotif = {
  id: string;
  assetId: string;
  assetName: string;
  to: Recipient;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

const KEY = "nexus_asset_notifs";

export function loadAssetNotifs(): AssetNotif[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as AssetNotif[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: AssetNotif[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore quota */
  }
}

export function unreadCount(list: AssetNotif[], to: Recipient): number {
  return list.filter((n) => n.to === to && !n.read).length;
}

/**
 * Record a workflow notification for the given recipient role and fan it out to
 * the email + push mock channels. Returns the updated list.
 */
export function pushAssetNotif(
  list: AssetNotif[],
  n: { assetId: string; assetName: string; to: Recipient; title: string; body: string },
  email?: string | null,
): AssetNotif[] {
  const entry: AssetNotif = {
    id: `an-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    at: new Date().toISOString(),
    read: false,
    ...n,
  };
  const next = [entry, ...list];
  save(next);

  // Mock email: persist into the shared notification log.
  const to = email || (n.to === "admin" ? "admin@company.com" : "user@company.com");
  saveNotifs([sendEmail([to], n.title, n.body), ...loadNotifs()]);
  // Real browser push (no-op unless permission granted).
  sendPush(n.title, n.body);

  return entry ? next : list;
}

export function markRead(list: AssetNotif[], id: string): AssetNotif[] {
  const next = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  save(next);
  return next;
}

export function markAllRead(list: AssetNotif[], to: Recipient): AssetNotif[] {
  const next = list.map((n) => (n.to === to ? { ...n, read: true } : n));
  save(next);
  return next;
}

export function clearAll(list: AssetNotif[], to: Recipient): AssetNotif[] {
  const next = list.filter((n) => n.to !== to);
  save(next);
  return next;
}
