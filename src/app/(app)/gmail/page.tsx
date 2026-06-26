"use client";

import GmailMailbox from "@/components/GmailMailbox";
import { gmailApi } from "@/lib/gmailApi";

export default function GmailPage() {
  return <GmailMailbox client={gmailApi} returnPath="/gmail" />;
}
