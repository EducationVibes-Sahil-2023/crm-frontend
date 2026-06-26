"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import WaConversation from "@/components/WaConversation";
import { BridgeOffline, waBridge, waTime, type WaChat, type WaStatus } from "@/lib/waBridge";

const initials = (s: string) => s.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
const AVATARS = ["bg-emerald-100 text-emerald-700", "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700"];
const avatarColor = (s: string) => AVATARS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length];

export default function WhatsAppPage() {
  const toast = useToast();
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [chats, setChats] = useState<WaChat[]>([]);
  const [selected, setSelected] = useState<WaChat | null>(null);
  const [query, setQuery] = useState("");

  const pollStatus = useCallback(async () => {
    try {
      setStatus(await waBridge.status());
      setOffline(false);
    } catch (e) {
      setOffline(e instanceof BridgeOffline);
    }
  }, []);
  const loadChats = useCallback(async () => {
    try { setChats(await waBridge.chats()); } catch { /* ignore transient */ }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(pollStatus, 0);
    const t = setInterval(pollStatus, 3000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [pollStatus]);

  const ready = status?.ready;
  useEffect(() => {
    if (!ready) return;
    const t0 = setTimeout(loadChats, 0);
    const t = setInterval(loadChats, 8000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [ready, loadChats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((c) => !q || c.name.toLowerCase().includes(q) || c.number.includes(q));
  }, [chats, query]);

  async function logout() {
    if (!confirm("Disconnect WhatsApp? You'll need to scan the QR again.")) return;
    try { await waBridge.logout(); setSelected(null); setChats([]); toast.info("Disconnected", "Scan the QR to reconnect."); pollStatus(); }
    catch (e) { toast.error("Logout failed", e instanceof Error ? e.message : undefined); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 text-white shadow-sm">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%),radial-gradient(circle_at_88%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="whatsapp" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-xl font-bold leading-tight">WhatsApp</h1>
              <p className="text-xs text-emerald-50">
                {ready ? `Connected${status?.me ? ` · +${status.me}` : ""}` : offline ? "Service offline" : "Connecting…"}
              </p>
            </div>
          </div>
          {ready && (
            <button onClick={logout} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25">
              <Icon name="logout" className="h-4 w-4" /> Disconnect
            </button>
          )}
        </div>
      </div>

      {offline ? (
        <OfflineCard />
      ) : !ready ? (
        <ConnectCard status={status} />
      ) : (
        <div className="flex h-[calc(100vh-12rem)] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* chat list */}
          <div className={`flex w-full flex-col border-r border-slate-200 sm:w-80 ${selected ? "hidden sm:flex" : "flex"}`}>
            <div className="border-b border-slate-200 p-3">
              <div className="relative"><Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats…" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" /></div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No chats yet. New messages will appear here.</p>
              ) : filtered.map((c) => (
                <button key={c.id} onClick={() => setSelected(c)} className={`flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-50 ${selected?.id === c.id ? "bg-emerald-50" : ""}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(c.name || c.number)}`}>{initials(c.name || c.number)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-900">{c.name || c.number}</p><span className="shrink-0 text-[10px] text-slate-400">{waTime(c.timestamp)}</span></div>
                    <p className="truncate text-xs text-slate-500">{c.lastMessage || c.number}</p>
                  </div>
                  {c.unread > 0 && <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">{c.unread}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* conversation */}
          <div className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden sm:flex"}`}>
            {selected ? (
              <>
                <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
                  <button onClick={() => setSelected(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 sm:hidden" aria-label="Back"><Icon name="arrowLeft" className="h-5 w-5" /></button>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${avatarColor(selected.name || selected.number)}`}>{initials(selected.name || selected.number)}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{selected.name || selected.number}</p><p className="truncate text-xs text-slate-500">+{selected.number}</p></div>
                </div>
                <WaConversation chatId={selected.id} className="flex-1" />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
                <Icon name="whatsapp" className="h-12 w-12 text-emerald-200" />
                <p className="mt-2 text-sm">Select a chat to start messaging</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectCard({ status }: { status: WaStatus | null }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-12 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Link your WhatsApp</h2>
      <ol className="mt-2 max-w-sm space-y-0.5 text-center text-sm text-slate-500">
        <li>Open WhatsApp on your phone</li>
        <li>Tap <b>Settings → Linked devices → Link a device</b></li>
        <li>Scan the QR code below</li>
      </ol>
      <div className="mt-5 flex h-72 w-72 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        {status?.qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={status.qr} alt="WhatsApp QR code" className="h-64 w-64 rounded-lg bg-white p-2" />
        ) : (
          <div className="text-center text-sm text-slate-400"><div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />Generating QR…</div>
        )}
      </div>
      <p className="mt-4 max-w-md text-center text-xs text-amber-600">⚠️ Unofficial bridge — use a secondary number; WhatsApp may block accounts that automate Web.</p>
    </div>
  );
}

function OfflineCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Icon name="alert" className="h-7 w-7" /></div>
      <p className="mt-3 text-base font-semibold text-slate-900">WhatsApp service isn&apos;t running</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">Start the bridge so the CRM can connect:</p>
      <pre className="mt-3 rounded-lg bg-slate-900 px-4 py-3 text-left text-xs text-slate-100">cd whatsapp-service{"\n"}npm install{"\n"}npm start</pre>
      <p className="mt-3 text-xs text-slate-400">Then refresh. It runs on <code>http://localhost:4000</code> (set <code>NEXT_PUBLIC_WA_URL</code> to change).</p>
    </div>
  );
}
