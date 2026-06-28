// Real 1:1 chat — backend-persisted messages between workspace users.
// Tenant-scoped on the server (a client and their users only see each other;
// the platform super-admin never appears). Replaces the old local-first store.

import { getToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

/** A message as stored on the server (user ids, not "me"). */
export type ChatMessage = {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  createdAt: string;
  read: boolean;
};

/** One entry per person you've exchanged messages with. */
export type ChatThread = {
  userId: number;
  body: string;
  at: string;
  mine: boolean;
  unread: number;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json", ...(init?.headers as Record<string, string>) });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const chatApi = {
  /** Conversation list data: last message + unread count per contact. */
  overview: async (): Promise<ChatThread[]> =>
    (await req<{ threads: ChatThread[] }>("/chat/overview")).threads ?? [],

  /** Full thread with one user (also marks their messages to me as read). */
  thread: async (withUserId: number): Promise<ChatMessage[]> =>
    (await req<{ messages: ChatMessage[] }>(`/chat/messages?with=${withUserId}`)).messages ?? [],

  /** Send a message to a user; returns the stored message. */
  send: async (to: number, body: string): Promise<ChatMessage> =>
    (await req<{ message: ChatMessage }>("/chat/messages", { method: "POST", body: JSON.stringify({ to, body }) })).message,
};
