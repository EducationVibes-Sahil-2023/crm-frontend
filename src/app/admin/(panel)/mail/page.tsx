"use client";

import { useEffect, useState } from "react";
import GmailMailbox from "@/components/GmailMailbox";
import { Skeleton } from "@/components/Skeleton";
import { createGmailClient } from "@/lib/gmailApi";
import { ensureSuperAdminToken, getSuperAdminToken } from "@/lib/superAdmin";

// Mailbox keyed to the super-admin's minted JWT (sub: super-admin) — a separate
// inbox from any tenant user, stored independently on the backend.
const superGmail = createGmailClient(getSuperAdminToken);

export default function SuperAdminMailPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    ensureSuperAdminToken().finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[72vh] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <GmailMailbox
      client={superGmail}
      returnPath="/admin/mail"
      title="Mail"
      subtitle="The platform owner's live Gmail — receive and send email from the console."
      connectTitle="Connect the platform Gmail"
      connectSubtitle="Sign in with the Google account you use to email demos, clients and leads."
    />
  );
}
