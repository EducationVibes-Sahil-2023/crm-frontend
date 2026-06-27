import PlatformSettings from "@/components/PlatformSettings";
import SuperAdminCredentials from "@/components/SuperAdminCredentials";

export default function Page() {
  return (
    <div className="space-y-8">
      <PlatformSettings />
      <SuperAdminCredentials />
    </div>
  );
}
