"use client";

import { useEffect } from "react";
import { initNativePush } from "@/lib/nativePush";

/**
 * Native-shell glue. Renders nothing; on first mount inside the Capacitor app it
 * configures the status bar, hides the splash screen, wires the Android hardware
 * back button to the SPA history, and initialises native push. On the web every
 * branch is skipped (Capacitor.isNativePlatform() is false), so this is inert in
 * a normal browser/PWA.
 */
export default function MobileBridge() {
  useEffect(() => {
    let cleanup = () => {};

    (async () => {
      let isNative = false;
      try {
        const { Capacitor } = await import("@capacitor/core");
        isNative = Capacitor.isNativePlatform();
      } catch {
        return;
      }
      if (!isNative) return;

      // Status bar — match the brand blue, dark icons off (white content).
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Dark }); // light text on dark bar
        await StatusBar.setBackgroundColor({ color: "#2563eb" });
      } catch {
        /* status-bar plugin missing — ignore */
      }

      // Hide the splash once the web app is interactive.
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        /* splash plugin missing — ignore */
      }

      // Android hardware back button: navigate SPA history, or exit at the root.
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
        cleanup = () => {
          handle.remove();
        };
      } catch {
        /* app plugin missing — ignore */
      }

      // Native push (FCM/APNs) registration.
      await initNativePush();
    })();

    return () => cleanup();
  }, []);

  return null;
}
