import { getToken } from "@/lib/auth";

/**
 * Real SMTP relay client — backend holds the credentials and sends via
 * CodeIgniter's Email library. See backend Api\Smtp.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type SmtpEncryption = "tls" | "ssl" | "none";

export type SmtpConfig = {
  configured: boolean;
  host: string;
  port: number;
  username: string;
  encryption: SmtpEncryption;
  fromName: string;
  fromEmail: string;
  hasPassword: boolean;
};

export type SmtpSaveInput = {
  host: string;
  port: number;
  username: string;
  password?: string;
  encryption: SmtpEncryption;
  fromName: string;
  fromEmail: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json", ...(init?.headers as Record<string, string>) });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.messages?.error ?? data?.error ?? `SMTP API ${res.status}`);
  }
  return data as T;
}

export const smtpApi = {
  getConfig: () => req<SmtpConfig>("/smtp/config"),
  saveConfig: (cfg: SmtpSaveInput) => req<SmtpConfig>("/smtp/config", { method: "POST", body: JSON.stringify(cfg) }),
  test: (to: string) => req<{ sent: boolean }>("/smtp/test", { method: "POST", body: JSON.stringify({ to }) }),
  send: (to: string, subject: string, body: string, html = false) =>
    req<{ sent: boolean }>("/smtp/send", { method: "POST", body: JSON.stringify({ to, subject, body, html }) }),
};
