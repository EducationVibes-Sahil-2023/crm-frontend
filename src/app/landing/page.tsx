import { redirect } from "next/navigation";

// The landing page now lives at "/". Keep this path working by redirecting.
export default function Page() {
  redirect("/");
}
