"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { waBridge, waTime, type WaMessage } from "@/lib/waBridge";

/**
 * A WhatsApp-style conversation for one peer (by chatId or phone).
 * Polls the bridge for new messages and lets you send.
 */
export default function WaConversation({
  chatId,
  phone,
  className = "",
}: {
  chatId?: string;
  phone?: string;
  className?: string;
}) {
  const toast = useToast();
  const identifier = chatId || phone || "";
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!identifier) return;
    try {
      const res = chatId ? await waBridge.messages(chatId) : await waBridge.contact(phone!);
      setMessages(res.messages);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [chatId, phone, identifier]);

  useEffect(() => {
    const run = () => { setLoading(true); setMessages([]); load(); };
    const t0 = setTimeout(run, 0);
    const t = setInterval(load, 4000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send() {
    const msg = text.trim();
    if (!msg || !identifier) return;
    setSending(true);
    try {
      await waBridge.send(identifier, msg);
      setText("");
      await load();
    } catch (e) {
      toast.error("Send failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {/* messages */}
      <div className="flex-1 space-y-1.5 overflow-y-auto bg-[#efeae2] p-4 [background-image:radial-gradient(#0000000a_1px,transparent_1px)] [background-size:18px_18px]">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="mx-auto max-w-xs rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-600">{error}</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm ${m.fromMe ? "bg-[#d9fdd3] text-slate-800" : "bg-white text-slate-800"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body || (m.hasMedia ? "📎 Media" : "")}</p>
                <p className="mt-0.5 text-right text-[10px] text-slate-400">{waTime(m.timestamp)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
        >
          <Icon name="send" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
