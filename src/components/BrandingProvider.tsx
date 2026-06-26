"use client";

import { useEffect } from "react";
import { useBranding } from "@/lib/branding";

/** Keeps the browser tab title in sync with the configured CRM name. Renders nothing. */
export default function BrandingProvider() {
  const { appName, tagline } = useBranding();
  useEffect(() => {
    document.title = tagline ? `${appName} · ${tagline}` : appName;
  }, [appName, tagline]);
  return null;
}
