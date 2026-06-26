// Client for the standalone WhatsApp bridge service (whatsapp-service/).
// Configure the URL with NEXT_PUBLIC_WA_URL (defaults to http://localhost:4000).

const BASE = process.env.NEXT_PUBLIC_WA_URL ?? "http://localhost:4000";

export type WaStatus = { ready: boolean; qr: string | null; me: string | null; error?: string | null };
export type WaChat = { id: string; name: string; number: string; unread: number; timestamp: number; lastMessage: string };
export type WaMessage = { id: string; body: string; fromMe: boolean; timestamp: number; type: string; hasMedia: boolean };

export class BridgeOffline extends Error {}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new BridgeOffline("WhatsApp service is not running. Start it with `npm start` in whatsapp-service/.");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || `Bridge error ${res.status}`);
  return data as T;
}

export const waBridge = {
  base: BASE,
  status: () => j<WaStatus>("/api/status"),
  chats: () => j<WaChat[]>("/api/chats"),
  messages: (chatId: string) => j<{ chatId: string; name: string; messages: WaMessage[] }>(`/api/messages/${encodeURIComponent(chatId)}`),
  contact: (phone: string) => j<{ chatId: string; name: string; messages: WaMessage[] }>(`/api/contact/${encodeURIComponent(phone)}`),
  send: (phone: string, message: string) => j<{ ok: boolean; message: WaMessage }>("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  }),
  logout: () => j<{ ok: boolean }>("/api/logout", { method: "POST" }),
};

export function waTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
