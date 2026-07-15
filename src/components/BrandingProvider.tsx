"use client";

import { useEffect } from "react";
import { useBranding } from "@/lib/branding";
import { usePlatform } from "@/lib/platform";

/** Keeps the browser tab title + favicon in sync with branding. Renders nothing. */
export default function BrandingProvider() {
  const { appName, tagline, favicon } = useBranding();
  const platformName = usePlatform().brand.name || "CRM";
  useEffect(() => {
    const name = appName || platformName;
    document.title = tagline ? `${name} · ${tagline}` : name;
  }, [appName, tagline, platformName]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    // Remember the app's default favicon once, so removing a custom one restores it.
    if (link.dataset.defaultHref === undefined) link.dataset.defaultHref = link.getAttribute("href") ?? "";
    link.href = favicon || link.dataset.defaultHref;
  }, [favicon]);
  return null;
}
