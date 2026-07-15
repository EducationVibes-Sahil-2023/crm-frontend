"use client";

import { primePlatform, type PlatformConfig } from "@/lib/platform";

// Seeds the platform cache from a server-fetched config before the app paints,
// so the brand logo/favicon show on first render instead of flashing the default
// and swapping in after the client fetch. Rendered ABOVE the guarded UI so it
// runs immediately on page load; priming is idempotent (guarded in the store).
export default function PlatformPrimer({ config }: { config: unknown }) {
  primePlatform((config ?? null) as Partial<PlatformConfig> | null);
  return null;
}
