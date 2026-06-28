// Real Web Push (PWA) client helpers.
//
// Flow: register the service worker -> fetch the server's VAPID public key ->
// pushManager.subscribe() with it -> POST the subscription to the backend. The
// service worker (public/sw.js) shows the notification when the push arrives.
//
// Works on Chrome/Edge/Firefox (desktop + Android) and on iOS 16.4+ when the
// app is installed to the Home Screen (standalone PWA). Native iOS/Android push
// goes through FCM via Capacitor instead — see lib/nativePush.ts.

import { apiRequest } from "@/lib/api";

export type PushSupport = "unsupported" | "permission-default" | "denied" | "granted";

export type PushState = {
  support: PushSupport;
  subscribed: boolean;
  endpoint: string | null;
};

/** Is the Web Push API available in this browser context? */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Convert a base64url VAPID key into the Uint8Array the PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  // Back the array with a concrete ArrayBuffer so it satisfies BufferSource.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ensure the service worker is registered and active, returning its registration. */
async function ready(): Promise<ServiceWorkerRegistration> {
  // PwaRegister registers /sw.js on load; make sure it's registered even if this
  // runs first, then wait for it to become active.
  await navigator.serviceWorker.register("/sw.js").catch(() => {});
  return navigator.serviceWorker.ready;
}

/** Current permission + subscription state (no prompts). */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return { support: "unsupported", subscribed: false, endpoint: null };

  const support: PushSupport =
    Notification.permission === "granted"
      ? "granted"
      : Notification.permission === "denied"
        ? "denied"
        : "permission-default";

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return { support, subscribed: !!sub, endpoint: sub?.endpoint ?? null };
  } catch {
    return { support, subscribed: false, endpoint: null };
  }
}

/** The server's VAPID public key (empty string when push isn't configured). */
async function fetchVapidPublicKey(): Promise<string> {
  const res = await apiRequest<{ enabled: boolean; publicKey: string }>("/push/vapid");
  return res?.enabled ? res.publicKey : "";
}

/**
 * Request permission (if needed), subscribe with the server VAPID key, and save
 * the subscription on the backend. Returns the new state. Throws with a useful
 * message on failure so the caller can toast it.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) throw new Error("This browser does not support web push.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Enable them in your browser settings."
        : "Notification permission was dismissed.",
    );
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    throw new Error("Push is not configured on the server (no VAPID key).");
  }

  const reg = await ready();
  // Reuse an existing subscription if present, else create one.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await apiRequest("/push/subscribe", {
    method: "POST",
    body: JSON.stringify(sub.toJSON()),
  });

  return { support: "granted", subscribed: true, endpoint: sub.endpoint };
}

/** Unsubscribe locally and remove the subscription from the backend. */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return { support: "unsupported", subscribed: false, endpoint: null };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await apiRequest("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
  }
  return { support: "permission-default", subscribed: false, endpoint: null };
}

/** Ask the server to deliver a test notification to this user's devices. */
export async function sendTestPush(): Promise<{ ok: boolean; message?: string }> {
  const res = await apiRequest<{ ok: boolean; message?: string }>("/push/test", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res ?? { ok: false };
}
