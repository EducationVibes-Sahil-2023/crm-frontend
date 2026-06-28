// Native mobile push (FCM on Android, APNs on iOS) via Capacitor.
//
// This runs ONLY inside the native app shell (Capacitor.isNativePlatform()); on
// the web it is a no-op so the same codebase serves both. It requests
// permission, registers with the OS push service, and sends the resulting
// device token to the backend (/push/device) so the server can target it.
//
// Delivery requires a Firebase project: drop google-services.json into
// android/app/ (and configure APNs for iOS). See MOBILE.md.

import { apiRequest } from "@/lib/api";

let started = false;

export async function initNativePush(): Promise<void> {
  if (started) return;

  // Dynamically import so web builds never pull native plugin code and the web
  // bundle stays unaffected.
  let Capacitor: typeof import("@capacitor/core").Capacitor;
  let PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications;
  try {
    ({ Capacitor } = await import("@capacitor/core"));
    if (!Capacitor.isNativePlatform()) return; // web / PWA — use lib/push.ts instead
    ({ PushNotifications } = await import("@capacitor/push-notifications"));
  } catch {
    return; // plugin unavailable
  }

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
