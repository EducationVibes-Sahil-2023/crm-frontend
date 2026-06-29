// Mailbox store for the Gmail page. Persists per workspace in the per-tenant
// database (app_store via dbStore) — no localStorage, no seeded demo mail.

import { dbGet, dbSet } from "@/lib/dbStore";

export type MailFolder = "inbox" | "sent" | "drafts" | "trash";

export type Mail = {
  id: string;
  folder: MailFolder;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  date: string; // display label
  order: number; // higher = newer
  read: boolean;
  starred: boolean;
};

const STORAGE_KEY = "mail_v1";

export function loadMail(): Mail[] {
  const parsed = dbGet<Mail[]>(STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveMail(mail: Mail[]): void {
  dbSet(STORAGE_KEY, mail);
}
