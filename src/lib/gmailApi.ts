import { getToken } from "@/lib/auth";

/**
 * Real Gmail integration client — talks to the CodeIgniter backend, which holds
 * the OAuth tokens and proxies the Gmail REST API. See backend Api\Gmail.
 *
 * createGmailClient() lets different sessions supply their own bearer: regular
 * users use their login JWT (gmailApi), the super-admin console uses its minted
 * JWT (sub: super-admin), so each gets an isolated mailbox on the backend.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type GmailStatus = { configured: boolean; connected: boolean; email: string };
export type GmailListItem = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
};
export type GmailMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
};

export type GmailConfig = { configured: boolean; clientId: string; redirectUri: string; hasSecret: boolean };

export type GmailClient = {
  status: () => Promise<GmailStatus>;
  getConfig: () => Promise<GmailConfig>;
  saveConfig: (cfg: { clientId: string; clientSecret?: string; redirectUri?: string }) => Promise<GmailConfig>;
  authUrl: (returnPath?: string) => Promise<{ url: string }>;
  messages: (max?: number) => Promise<GmailListItem[]>;
  message: (id: string) => Promise<GmailMessage>;
  send: (to: string, subject: string, body: string) => Promise<{ sent: boolean }>;
  calendarEvents: (opts?: { max?: number; timeMin?: string; timeMax?: string }) => Promise<CalendarEvent[]>;
  createCalendarEvent: (e: { summary: string; start: string; end: string; description?: string; attendees?: string[] }) => Promise<CalendarEvent & { created: boolean }>;
  disconnect: () => Promise<{ disconnected: boolean }>;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  meetLink: string;
  htmlLink: string;
  location: string;
  description?: string;
  organizer?: string;
  status?: string;
  attendees?: string[];
};

export function createGmailClient(tokenProvider: () => string | null): GmailClient {
  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers({ "Content-Type": "application/json", ...(init?.headers as Record<string, string>) });
    const token = tokenProvider();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gmail API ${res.status}: ${body || res.statusText}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  return {
    status: () => req<GmailStatus>("/gmail/status"),
    getConfig: () => req<GmailConfig>("/gmail/config"),
    saveConfig: (cfg: { clientId: string; clientSecret?: string; redirectUri?: string }) =>
      req<GmailConfig>("/gmail/config", { method: "POST", body: JSON.stringify(cfg) }),
    authUrl: (returnPath?: string) =>
      req<{ url: string }>(`/gmail/auth-url${returnPath ? `?return=${encodeURIComponent(returnPath)}` : ""}`),
    messages: (max = 20) => req<GmailListItem[]>(`/gmail/messages?max=${max}`),
    message: (id: string) => req<GmailMessage>(`/gmail/message/${encodeURIComponent(id)}`),
    send: (to: string, subject: string, body: string) =>
      req<{ sent: boolean }>("/gmail/send", { method: "POST", body: JSON.stringify({ to, subject, body }) }),
    calendarEvents: (opts) => {
      const q = new URLSearchParams({ max: String(opts?.max ?? 250) });
      if (opts?.timeMin) q.set("timeMin", opts.timeMin);
      if (opts?.timeMax) q.set("timeMax", opts.timeMax);
      return req<CalendarEvent[]>(`/gmail/calendar?${q.toString()}`);
    },
    createCalendarEvent: (e) => req<CalendarEvent & { created: boolean }>("/gmail/calendar", { method: "POST", body: JSON.stringify(e) }),
    disconnect: () => req<{ disconnected: boolean }>("/gmail/disconnect", { method: "POST" }),
  };
}

/** Default client for regular logged-in users. */
export const gmailApi = createGmailClient(getToken);
