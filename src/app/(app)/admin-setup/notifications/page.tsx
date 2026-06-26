import { redirect } from "next/navigation";

export default function Page() {
  // Web Push now lives as a tab under Integrations.
  redirect("/admin-setup/integrations");
}
