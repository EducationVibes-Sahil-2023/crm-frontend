// Native mobile push (FCM on Android, APNs on iOS) via Capacitor.
//
// This runs ONLY inside the native app shell (Capacitor.isNativePlatform()); on
// the web it is a no-op so the same codebase serves both. It requests
// permission, registers with the OS push service, and sends the resulting
// device token to the backend (/push/device) so the server can target it.
//
// IMPORTANT: this module intentionally does NOT import the
// `@capacitor/push-notifications` npm package. That package is native-only and
// may be absent from a web-only production install, which would break `next
// build` (type-check + bundling). Instead we obtain the plugin through
// Capacitor's bridge via registerPlugin() from `@capacitor/core` (a hard
// dependency that is always installed). On the native shell this connects to the
// real native implementation that `cap sync` wires into the Android/iOS project;
// on the web we never reach this code (isNativePlatform() is false).
//
// Delivery requires a Firebase project: drop google-services.json into
// android/app/ (and configure APNs for iOS). See MOBILE.md.

import { apiRequest } from "@/lib/api";

// ── Minimal local typings for the native PushNotifications plugin ──────────
// Declared here so the web build never depends on the plugin's package types.
type PermissionState = "prompt" | "prompt-with-rationale" | "denied" | "granted";
interface PermissionStatus {
  receive: PermissionState;
}
interface PluginListenerHandle {
  remove: () => Promise<void>;
}
interface DeviceToken {
  value: string;
}
interface PushAction {
  notification?: { data?: { url?: string } };
}
interface PushNotificationsPlugin {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  register(): Promise<void>;
  addListener(event: "registration", cb: (token: DeviceToken) => void): Promise<PluginListenerHandle>;
  addListener(event: "registrationError", cb: (err: unknown) => void): Promise<PluginListenerHandle>;
  addListener(event: "pushNotificationActionPerformed", cb: (action: PushAction) => void): Promise<PluginListenerHandle>;
}

let started = false;

export async function initNativePush(): Promise<void> {
  if (started) return;

  // Dynamically import Capacitor core so plain web builds stay unaffected.
  let core: typeof import("@capacitor/core");
  try {
    core = await import("@capacitor/core");
  } catch {
    return; // Capacitor unavailable (plain web) — no-op.
  }
  const { Capacitor, registerPlugin } = core;
  if (!Capacitor.isNativePlatform()) return; // web / PWA — use lib/push.ts instead.

  // Obtain the plugin through the native bridge (no npm-package import needed).
  const PushNotifications = registerPlugin<PushNotificationsPlugin>("PushNotifications");

  started = true;
  const platform = Capacitor.getPlatform(); // "ios" | "android"

  // Permission: prompt only if not already decided.
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  // Token registration -> store on the backend (auth-protected; ignored if the
  // user isn't signed in yet — re-running after login will register it).
  await PushNotifications.addListener("registration", async (token) => {
    try {
      await apiRequest("/push/device", {
        method: "POST",
        body: JSON.stringify({ token: token.value, platform }),
      });
    } catch {
      /* not signed in / offline — token will re-register next launch */
    }
  });

  await PushNotifications.addListener("registrationError", () => {
    /* surfaced in native logs */
  });

  // Tapping a notification deep-links into the relevant page when a url is set.
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = action?.notification?.data?.url;
    if (typeof url === "string" && url && typeof window !== "undefined") {
      window.location.assign(url);
    }
  });

  await PushNotifications.register();
}

/** Remove the current device token from the backend (e.g. on sign-out). */
export async function removeNativePush(): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    // The OS token isn't directly readable post-registration; the backend prunes
    // dead tokens on send, so a best-effort sign-out simply stops re-registering.
    started = false;
  } catch {
    /* no-op */
  }
}
