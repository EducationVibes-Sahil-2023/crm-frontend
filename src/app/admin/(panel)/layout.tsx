import PlatformPrimer from "@/components/PlatformPrimer";
import AdminChrome from "./AdminChrome";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

// Server layout: fetch the saved platform config on the server and hand it to
// PlatformPrimer, which seeds the client cache BEFORE the super-admin chrome
// mounts. That way the brand logo/favicon are there on first paint — no
// default-then-real flash on (re)load. BrandHead + the store still handle live
// updates without a reload.
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  let config: unknown = null;
  try {
    const res = await fetch(`${API_BASE}/platform`, { next: { revalidate: 30 } });
    if (res.ok) config = (await res.json())?.config ?? null;
  } catch {
    /* backend offline — the client will fetch on mount as before */
  }
  return (
    <>
      <PlatformPrimer config={config} />
      <AdminChrome>{children}</AdminChrome>
    </>
  );
}
