"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Registers the service worker and surfaces a small "Install app" button when
// the browser reports the app is installable (Android/desktop Chrome/Edge).
export default function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (!deferred || hidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="h-9 w-9 rounded-lg" />
      <div className="text-sm">
        <p className="font-semibold text-slate-800">Install Nexus</p>
        <p className="text-xs text-slate-500">Use it like an app</p>
      </div>
      <button onClick={install} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">Install</button>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
