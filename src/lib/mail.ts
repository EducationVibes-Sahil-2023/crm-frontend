// Mock mailbox for the Gmail page. Persists per workspace.

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

function seed(m: Omit<Mail, "order"> & { order: number }): Mail {
  return m;
}

export const DEFAULT_MAIL: Mail[] = [
  seed({ id: "m1", folder: "inbox", fromName: "Priya Nair", fromEmail: "priya.nair@educationvibes.in", to: "you@educationvibes.in", subject: "Re: Admissions webinar follow-up", body: "Hi,\n\nThanks for joining the session yesterday. I've attached the brochure and the financial-aid checklist. Let me know a good time to discuss the next steps for the autumn intake.\n\nBest,\nPriya", date: "9:42 AM", order: 100, read: false, starred: true }),
  seed({ id: "m2", folder: "inbox", fromName: "Razorpay", fromEmail: "noreply@razorpay.com", to: "you@educationvibes.in", subject: "Payment of ₹24,000 received", body: "A payment of ₹24,000 has been successfully captured for invoice INV-2043.\n\nView the transaction in your dashboard.", date: "8:15 AM", order: 99, read: false, starred: false }),
  seed({ id: "m3", folder: "inbox", fromName: "David Chen", fromEmail: "david.chen@nimbus.io", to: "you@educationvibes.in", subject: "Cloud contract renewal", body: "Hello,\n\nOur current agreement is up for renewal next month. I'd like to walk you through the new pricing tiers — are you free Thursday afternoon?\n\nRegards,\nDavid", date: "Yesterday", order: 98, read: true, starred: false }),
  seed({ id: "m4", folder: "inbox", fromName: "Sneha Iyer", fromEmail: "hello@brightprint.in", to: "you@educationvibes.in", subject: "Brochure proof ready for review", body: "Hi team,\n\nThe proof for the new admissions brochure is ready. Please review and share any changes by EOD Friday so we can go to print.\n\nThanks,\nSneha", date: "Yesterday", order: 97, read: true, starred: true }),
  seed({ id: "m5", folder: "inbox", fromName: "Google Calendar", fromEmail: "calendar-notification@google.com", to: "you@educationvibes.in", subject: "Reminder: Counsellor sync at 3:00 PM", body: "This is a reminder for your event 'Counsellor sync' today at 3:00 PM. A Google Meet link is attached.", date: "Mar 3", order: 96, read: true, starred: false }),
  seed({ id: "m6", folder: "inbox", fromName: "Marcus Thorne", fromEmail: "marcus.thorne@educationvibes.in", to: "you@educationvibes.in", subject: "Q2 enrolment numbers", body: "Sharing the latest enrolment figures ahead of our review. We're tracking 12% above last quarter — details inside.", date: "Mar 2", order: 95, read: true, starred: false }),
  seed({ id: "s1", folder: "sent", fromName: "You", fromEmail: "you@educationvibes.in", to: "priya.nair@educationvibes.in", subject: "Welcome to the team", body: "Hi Priya,\n\nWelcome aboard! Your accounts are set up — let me know if you need anything to get started.\n\nBest", date: "Mar 1", order: 94, read: true, starred: false }),
];

export function loadMail(): Mail[] {
  if (typeof window === "undefined") return DEFAULT_MAIL.map((m) => ({ ...m }));
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MAIL.map((m) => ({ ...m }));
    const parsed = JSON.parse(raw) as Mail[];
    if (!Array.isArray(parsed)) return DEFAULT_MAIL.map((m) => ({ ...m }));
    return parsed;
  } catch {
    return DEFAULT_MAIL.map((m) => ({ ...m }));
  }
}

export function saveMail(mail: Mail[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mail));
}
