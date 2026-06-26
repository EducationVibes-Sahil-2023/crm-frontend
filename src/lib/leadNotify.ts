// Fires notifications when a lead is captured: real browser push (if enabled),
// a simulated email to the CRM owner, and an in-app notification-center entry.
// Shared by the Forms module and the public form page so every channel alerts
// the CRM the same way.

import { getUser } from "@/lib/auth";
import {
  loadNotifs,
  loadPrefs,
  notif,
  pushPermission,
  saveNotifs,
  sendEmail,
  sendPush,
  type Notif,
} from "@/lib/notify";
import type { IntakeLead } from "@/lib/leadStore";

export function notifyNewLead(lead: IntakeLead): void {
  const prefs = loadPrefs();
  const owner = getUser()?.email || "admin@nexus.com";
  const title = `New lead: ${lead.name}`;
  const body = `${lead.name}${lead.company && lead.company !== "—" ? ` (${lead.company})` : ""} via ${lead.channel}. ${lead.email !== "—" ? lead.email : ""}`.trim();

  const entries: Notif[] = [];
  if (prefs.push && pushPermission() === "granted") {
    sendPush(title, body);
    entries.push(notif("push", title, body, lead.id));
  }
  if (prefs.email) {
    entries.push({ ...sendEmail([owner], title, body), taskId: lead.id });
  }
  if (entries.length === 0) entries.push(notif("app", title, body, lead.id));

  saveNotifs([...entries, ...loadNotifs()].slice(0, 100));
}

// Fired when a captured lead is auto-assigned/transferred to a counsellor.
export function notifyLeadTransferred(lead: IntakeLead): void {
  if (!lead.assignedTo) return;
  const prefs = loadPrefs();
  const title = `Lead assigned to ${lead.assignedTo}`;
  const body = `${lead.name} (${lead.channel}) was auto-assigned to ${lead.assignedTo}.`;
  const entries: Notif[] = [];
  if (prefs.push && pushPermission() === "granted") {
    sendPush(title, body);
    entries.push(notif("push", title, body, lead.id));
  }
  entries.push(notif("app", title, body, lead.id));
  saveNotifs([...entries, ...loadNotifs()].slice(0, 100));
}
