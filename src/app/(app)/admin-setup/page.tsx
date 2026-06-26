import { redirect } from "next/navigation";

export default function AdminSetupIndex() {
  redirect("/admin-setup/status");
}
