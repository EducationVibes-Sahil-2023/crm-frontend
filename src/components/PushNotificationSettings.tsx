"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_PUSH_CONFIG,
  PUSH_EVENTS,
  generateKey,
  loadPushConfig,
  savePushConfig,
  type PushConfig,
} from "@/lib/pushConfig";

type Permission = "default" | "granted" | "denied" | "unsupported";

function readPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Permission;
}

export default function PushNotificationSettings({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<PushConfig>(loadPushConfig);
  const [permission, setPermission] = useState<Permission>(readPermission);

  useEffect(() => {
    savePushConfig(cfg);
  }, [cfg]);

  const set = <K extends keyof PushConfig>(key: K, value: PushConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const enabledEvents = PUSH_EVENTS.filter((e) => cfg.events[e.key]).length;

  async function enableInBrowser() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Unsupported", "This browser does not support notifications.");
      return;
    }
    try {
      const res = (await Notification.requestPermission()) as Permission;
      setPermission(res);
      if (res === "granted") toast.success("Enabled", "Web push is enabled in this browser.");
      else if (res === "denied") toast.error("Blocked", "Notifications are blocked for this site.");
      else toast.info("Dismissed", "Permission request was dismissed.");
    } catch {
      toast.error("Failed", "Could not request notification permission.");
    }
  }

  function sendTest() {
    if (permission !== "granted") {
      toast.error("Not allowed", "Enable notifications in this browser first.");
      return;
    }
    try {
      new Notification(cfg.defaultTitle || "CRM Enterprise", {
        body: "This is a test web push notification.",
        icon: cfg.defaultIcon || undefined,
        requireInteraction: cfg.requireInteraction,
        silent: !cfg.sound,
      });
      toast.success("Test sent", "Check your system notifications.");
    } catch {
      toast.error("Failed", "Could not display the notification.");
    }
  }

  function generateKeys() {
    setCfg((c) => ({ ...c, vapidPublicKey: generateKey(87), vapidPrivateKey: generateKey(43) }));
    toast.success("Keys generated", "A new VAPID key pair was created.");
  }

  async function copy(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.info("Copied", `${label} copied to clipboard.`);
    } catch {
      toast.error("Copy failed", "Clipboard is not available.");
    }
  }

  function reset() {
    setCfg({ ...DEFAULT_PUSH_CONFIG, events: { ...DEFAULT_PUSH_CONFIG.events } });
    toast.info("Reset", "Push settings restored to defaults.");
  }

  const permBadge: Record<Permission, string> = {
    granted: "bg-emerald-100 text-emerald-700",
    denied: "bg-rose-100 text-rose-700",
    default: "bg-amber-100 text-amber-700",
    unsupported: "bg-slate-100 text-slate-600",
  };
  const permLabel: Record<Permission, string> = {
    granted: "Granted",
    denied: "Blocked",
    default: "Not requested",
    unsupported: "Unsupported",
  };

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Web Push Notifications</p>
            <p className="text-xs text-slate-500">Configure browser push, keys, and trigger events.</p>
          </div>
          <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Reset
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Web Push Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure browser push notifications, keys, and which events trigger them.
            </p>
          </div>
          <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Reset to defaults
          </button>
        </div>
      )}

      {/* Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon name="bell" className="h-5 w-5" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-800">
                Web push
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {cfg.enabled ? "On" : "Off"}
                </span>
              </p>
              <p className="text-sm text-slate-500">
                Browser permission:{" "}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${permBadge[permission]}`}>{permLabel[permission]}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Switch checked={cfg.enabled} onChange={(v) => set("enabled", v)} label="Enable web push" />
            <button
              onClick={enableInBrowser}
              disabled={permission === "unsupported" || permission === "granted"}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Enable in this browser
            </button>
            <button
              onClick={sendTest}
              disabled={permission !== "granted"}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Send test
            </button>
          </div>
        </div>
      </div>

      {/* VAPID keys */}
      <Card title="VAPID Keys" subtitle="Used to authenticate your server with push services.">
        <div className="flex items-center justify-end">
          <button onClick={generateKeys} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Generate key pair
          </button>
        </div>
        <KeyField label="Public key" value={cfg.vapidPublicKey} onChange={(v) => set("vapidPublicKey", v)} onCopy={() => copy(cfg.vapidPublicKey, "Public key")} placeholder="BNc…" />
        <KeyField label="Private key" value={cfg.vapidPrivateKey} onChange={(v) => set("vapidPrivateKey", v)} onCopy={() => copy(cfg.vapidPrivateKey, "Private key")} placeholder="kx9…" secret />
        <div>
          <FieldLabel>Subject (contact)</FieldLabel>
          <input
            value={cfg.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="mailto:admin@example.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </Card>

      {/* Defaults */}
      <Card title="Notification Defaults" subtitle="Applied to every notification unless overridden.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Default title</FieldLabel>
            <input
              value={cfg.defaultTitle}
              onChange={(e) => set("defaultTitle", e.target.value)}
              placeholder="CRM Enterprise"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <FieldLabel>Icon URL</FieldLabel>
            <input
              value={cfg.defaultIcon}
              onChange={(e) => set("defaultIcon", e.target.value)}
              placeholder="/icon-192.png"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
        <ToggleRow label="Require interaction" desc="Keep the notification visible until the user dismisses it." checked={cfg.requireInteraction} onChange={(v) => set("requireInteraction", v)} />
        <ToggleRow label="Play sound" desc="Allow the notification to play the system sound." checked={cfg.sound} onChange={(v) => set("sound", v)} />
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

      <p className="text-xs text-slate-400">
        Note: delivering real web push requires a registered service worker and a push server using these VAPID keys. This screen stores the configuration and lets you test local browser notifications.
      </p>
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-slate-500">{children}</label>;
}

function KeyField({
  label, value, onChange, onCopy, placeholder, secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCopy: () => void;
  placeholder?: string;
  secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        {secret && (
          <button type="button" onClick={() => setShow((s) => !s)} title={show ? "Hide" : "Show"} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50">
            <Icon name="eye" className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={onCopy} title="Copy" className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50">
          <Icon name="export" className="h-4 w-4" />
        </button>
      </div>
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
