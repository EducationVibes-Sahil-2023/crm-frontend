"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_PUSH_CONFIG,
  PUSH_EVENTS,
  loadPushConfig,
  savePushConfig,
  type PushConfig,
} from "@/lib/pushConfig";
import {
  disablePush,
  enablePush,
  getPushState,
  pushSupported,
  sendTestPush,
  type PushState,
} from "@/lib/push";
import { apiRequest } from "@/lib/api";

const EMPTY_STATE: PushState = { support: "unsupported", subscribed: false, endpoint: null };

export default function PushNotificationSettings({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  // Event/default preferences are still local (which events should fire a push).
  const [cfg, setCfg] = useState<PushConfig>(loadPushConfig);
  const [state, setState] = useState<PushState>(EMPTY_STATE);
  const [serverKey, setServerKey] = useState<string>("");
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    savePushConfig(cfg);
  }, [cfg]);

  // Read live subscription state + whether the server has push configured.
  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s));
    apiRequest<{ enabled: boolean; publicKey: string }>("/push/vapid")
      .then((r) => {
        if (!alive) return;
        setServerReady(!!r?.enabled);
        setServerKey(r?.publicKey ?? "");
      })
      .catch(() => alive && setServerReady(false));
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof PushConfig>(key: K, value: PushConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const enabledEvents = PUSH_EVENTS.filter((e) => cfg.events[e.key]).length;

  async function onEnable() {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      toast.success("Subscribed", "This device will now receive push notifications.");
    } catch (e) {
      toast.error("Couldn't enable", e instanceof Error ? e.message : "Failed to subscribe.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    setBusy(true);
    try {
      const next = await disablePush();
      setState(next);
      toast.info("Unsubscribed", "This device will no longer receive push notifications.");
    } catch {
      toast.error("Failed", "Could not unsubscribe this device.");
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    try {
      const res = await sendTestPush();
      if (res.ok) toast.success("Test sent", "A push notification was sent from the server.");
      else toast.info("Nothing to send", res.message || "No active subscription for this account.");
    } catch (e) {
      toast.error("Failed", e instanceof Error ? e.message : "Could not send the test push.");
    } finally {
      setBusy(false);
    }
  }

  const supported = pushSupported();
  const permLabel: Record<PushState["support"], string> = {
    granted: "Granted",
    denied: "Blocked",
    "permission-default": "Not requested",
    unsupported: "Unsupported",
  };
  const permBadge: Record<PushState["support"], string> = {
    granted: "bg-emerald-100 text-emerald-700",
    denied: "bg-rose-100 text-rose-700",
    "permission-default": "bg-amber-100 text-amber-700",
    unsupported: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-6">
      {embedded ? (
        <div>
          <p className="text-sm font-semibold text-slate-800">Web Push Notifications</p>
          <p className="text-xs text-slate-500">Subscribe this device and choose which events notify your team.</p>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Web Push Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real browser push, delivered from the server. Subscribe a device, then choose which events trigger a notification.
          </p>
        </div>
      )}

      {/* Server status */}
      {serverReady === false && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Icon name="alert" className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Push is not configured on the server yet.</p>
            <p className="text-amber-700">
              The backend has no VAPID key. It is generated automatically on first use once the
              <code className="mx-1 rounded bg-amber-100 px-1">push_subscriptions</code> migration has run
              (visit <code className="rounded bg-amber-100 px-1">/api/setup</code> after deploy), or set
              <code className="mx-1 rounded bg-amber-100 px-1">webpush.publicKey</code>/<code className="rounded bg-amber-100 px-1">webpush.privateKey</code> in the backend .env.
            </p>
          </div>
        </div>
      )}

      {/* Status + actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon name="bell" className="h-5 w-5" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-800">
                This device
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${state.subscribed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {state.subscribed ? "Subscribed" : "Not subscribed"}
                </span>
              </p>
              <p className="text-sm text-slate-500">
                Permission:{" "}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${permBadge[state.support]}`}>
                  {permLabel[state.support]}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.subscribed ? (
              <button
                onClick={onDisable}
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Unsubscribe
              </button>
            ) : (
              <button
                onClick={onEnable}
                disabled={busy || !supported || serverReady === false}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Enable on this device
              </button>
            )}
            <button
              onClick={onTest}
              disabled={busy || !state.subscribed}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Send test
            </button>
          </div>
        </div>
        {!supported && (
          <p className="mt-3 text-xs text-slate-400">
            This browser doesn&apos;t support web push. On iPhone/iPad, install the app to the Home Screen first (Safari → Share → Add to Home Screen), then open it and enable push.
          </p>
        )}
      </div>

      {/* Server VAPID key (read-only) */}
      <Card title="Server Key (VAPID)" subtitle="The public identity key the server is using. Managed server-side; the private key never leaves the backend.">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Public key</label>
          <input
            readOnly
            value={serverKey || (serverReady === null ? "Loading…" : "—")}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-600 outline-none"
          />
        </div>
      </Card>

      {/* Notification defaults */}
      <Card title="Notification Defaults" subtitle="Used as fallbacks for the title and icon shown in notifications.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Default title</label>
            <input
              value={cfg.defaultTitle}
              onChange={(e) => set("defaultTitle", e.target.value)}
              placeholder="Nexus CRM & HRMS"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Icon URL</label>
            <input
              value={cfg.defaultIcon}
              onChange={(e) => set("defaultIcon", e.target.value)}
              placeholder="/icon-192.png"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
        <ToggleRow label="Require interaction" desc="Keep the notification visible until the user dismisses it." checked={cfg.requireInteraction} onChange={(v) => set("requireInteraction", v)} />
      </Card>

      {/* Events */}
      <Card title="Notification Events" subtitle={`${enabledEvents} of ${PUSH_EVENTS.length} events enabled.`}>
        <ul className="-mx-5 -mb-1">
          {PUSH_EVENTS.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-slate-50/60">
              <div>
                <p className="font-medium text-slate-800">{e.label}</p>
                <p className="text-xs text-slate-500">{e.desc}</p>
              </div>
              <Switch checked={cfg.events[e.key]} onChange={(v) => set("events", { ...cfg.events, [e.key]: v })} label={e.label} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Push is delivered by the server using VAPID. Each browser/device subscribes individually; mobile apps use native FCM.
        </p>
        <button
          onClick={() => setCfg({ ...DEFAULT_PUSH_CONFIG, events: { ...DEFAULT_PUSH_CONFIG.events } })}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Reset event prefs
        </button>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
      <div>
        <p className="font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}
