import { redirect } from "next/navigation";

// The Super Admin console moved to its own standalone area at /admin.
export default function Page() {
  redirect("/admin");
}
