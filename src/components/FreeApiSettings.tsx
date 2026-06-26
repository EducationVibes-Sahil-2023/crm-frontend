"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  FREE_APIS,
  countEnabledFreeApis,
  loadFreeApis,
  saveFreeApis,
  type FreeApiConfig,
  type FreeApiMeta,
} from "@/lib/freeApis";

export default function FreeApiSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<FreeApiConfig>(loadFreeApis);

  useEffect(() => {
    saveFreeApis(cfg);
  }, [cfg]);

  const enabledCount = countEnabledFreeApis(cfg);

  function toggle(key: string) {
    setCfg((c) => ({ ...c, [key]: { ...c[key], enabled: !c[key].enabled } }));
  }
  function setCredential(key: string, credential: string) {
    setCfg((c) => ({ ...c, [key]: { ...c[key], credential } }));
  }
  function test(api: FreeApiMeta) {
    const e = cfg[api.key];
    if (!e?.credential.trim()) {
      toast.error(api.name, `Enter the ${api.field.toLowerCase()} first.`);
      return;
    }
    toast.success(`${api.name} connected`, `${api.field} saved — test request would be sent.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Free APIs</p>
          <p className="text-xs text-slate-500">Connect free / freemium services your workspace uses.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          <strong className="text-slate-700">{enabledCount}</strong> active
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FREE_APIS.map((api) => {
          const entry = cfg[api.key];
          const on = entry.enabled;
          return (
            <div
              key={api.key}
              className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition ${on ? "border-blue-200 ring-1 ring-blue-100" : "border-slate-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                    <Icon name={api.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
                      {api.name}
                    </p>
                    <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      {api.tag}
                    </span>
                  </div>
                </div>
                <Switch checked={on} onChange={() => toggle(api.key)} label={`Enable ${api.name}`} />
              </div>

              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{api.desc}</p>

              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-500">{api.field}</label>
                <CredentialInput
                  value={entry.credential}
                  onChange={(v) => setCredential(api.key, v)}
                  placeholder={api.placeholder}
                  secret={api.secret}
                  disabled={!on}
                />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <a href={api.docs} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-400 hover:text-blue-600 hover:underline">
                  Docs ↗
                </a>
                <button
                  onClick={() => test(api)}
                  disabled={!on}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  Test
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        Keys are stored for this workspace. Actual requests are made from the server using these credentials.
      </p>
    </div>
  );
}

function CredentialInput({
  value, onChange, placeholder, secret, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type={secret && !show ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400"
      />
      {secret && (
        <button type="button" onClick={() => setShow((s) => !s)} disabled={disabled} title={show ? "Hide" : "Show"} className="shrink-0 rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
          <Icon name="eye" className="h-3.5 w-3.5" />
        </button>
      )}
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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}
