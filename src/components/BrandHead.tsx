"use client";

import { useEffect } from "react";
import { usePlatform } from "@/lib/platform";

// Applies the Super Admin's configured favicon to the browser tab across every
// route. Reads the platform brand and swaps the <link rel="icon"> at runtime
// (the static icon in the root layout is the build-time default/fallback).
export default function BrandHead() {
  const favicon = usePlatform().brand.favicon;

  useEffect(() => {
    if (!favicon) return;
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    const prev = links.length ? links[0].getAttribute("href") : null;
    links.forEach((l) => l.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = favicon;
    document.head.appendChild(link);
    return () => {
      link.remove();
      if (prev) {
        const restore = document.createElement("link");
        restore.rel = "icon";
        restore.href = prev;
        document.head.appendChild(restore);
      }
    };
  }, [favicon]);

  return null;
}
