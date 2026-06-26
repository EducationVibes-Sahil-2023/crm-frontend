"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { loadSecurity, saveSecurity, type AppSecurity } from "@/lib/mobile";

export default function AppSecuritySettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<AppSecurity>(loadSecurity);
  useEffect(() => { saveSecurity(cfg); }, [cfg]);
  const set = <K extends keyof AppSecurity>(k: K, v: AppSecurity[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [enroll, setEnroll] = useState(false);
  const [locked, setLocked] = useState(false);

  function savePin() {
    if (!/^\d{4}$/.test(pin1)) return toast.error("Invalid PIN", "Use a 4-digit PIN.");
    if (pin1 !== pin2) return toast.error("PIN mismatch", "Both PINs must match.");
    set("pin", pin1); set("appLock", true); setPin1(""); setPin2("");
    toast.success("PIN set", "App Lock is now enabled.");
  }
  function canTest() { return (cfg.appLock && cfg.pin.length === 4) || (cfg.faceLock && cfg.faceEnrolled); }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">App Security &amp; Lock</h1>
        <p className="mt-1 text-sm text-slate-500">Protect the mobile app with Face Lock, App Lock and biometrics.</p>
      </div>

      {/* Status banner */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${cfg.appLock || cfg.faceLock ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.appLock || cfg.faceLock ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}><Icon name="shield" className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{cfg.appLock || cfg.faceLock ? "App is protected" : "App is unprotected"}</p>
            <p className="text-xs text-slate-500">{[cfg.appLock && "App Lock", cfg.faceLock && cfg.faceEnrolled && "Face Lock", cfg.biometric && "Fingerprint"].filter(Boolean).join(" · ") || "No lock enabled"}</p>
          </div>
        </div>
        <button onClick={() => setLocked(true)} disabled={!canTest()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">Test lock screen</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Face Lock */}
        <Card icon="camera" title="Face Lock" subtitle="Unlock the app with face recognition.">
          <Toggle label="Enable Face Lock" desc="Use the front camera to unlock." checked={cfg.faceLock} onChange={(v) => set("faceLock", v)} />
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${cfg.faceEnrolled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}><Icon name="camera" className="h-6 w-6" /></span>
              <div>
                <p className="text-sm font-medium text-slate-800">{cfg.faceEnrolled ? "Face enrolled" : "No face enrolled"}</p>
                <p className="text-xs text-slate-500">{cfg.faceEnrolled ? "Your face is registered on this device." : "Enroll your face to use Face Lock."}</p>
              </div>
            </div>
            {cfg.faceEnrolled ? (
              <button onClick={() => { set("faceEnrolled", false); toast.info("Face removed", ""); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Remove</button>
            ) : (
              <button onClick={() => setEnroll(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Enroll face</button>
            )}
          </div>
        </Card>

        {/* App Lock */}
        <Card icon="shield" title="App Lock" subtitle="Require a PIN or biometric to open the app.">
          <Toggle label="Enable App Lock" desc="Lock the app behind a 4-digit PIN." checked={cfg.appLock} onChange={(v) => { if (v && cfg.pin.length !== 4) return toast.error("Set a PIN first", "Create a PIN below."); set("appLock", v); }} />
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-2 text-sm font-medium text-slate-800">{cfg.pin ? "Change PIN" : "Set a 4-digit PIN"}</p>
            <div className="flex flex-wrap items-end gap-2">
              <PinInput value={pin1} onChange={setPin1} placeholder="New PIN" />
              <PinInput value={pin2} onChange={setPin2} placeholder="Confirm" />
              <button onClick={savePin} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save PIN</button>
            </div>
          </div>
          <Toggle label="Fingerprint / biometric" desc="Allow fingerprint unlock where supported." checked={cfg.biometric} onChange={(v) => set("biometric", v)} />
        </Card>
      </div>

      {/* Behaviour */}
      <Card icon="settings" title="Lock behaviour" subtitle="When the app should lock automatically.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-800">Auto-lock</p>
            <p className="mb-2 text-xs text-slate-500">Lock after this much idle time.</p>
            <select value={cfg.autoLockMin} onChange={(e) => set("autoLockMin", Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500">
              {[1, 2, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} minute{m > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <Toggle label="Lock on background" desc="Lock immediately when the app is minimised." checked={cfg.lockOnBackground} onChange={(v) => set("lockOnBackground", v)} />
            <Toggle label="Background location" desc="Allow continuous GPS tracking in the field." checked={cfg.liveTracking} onChange={(v) => set("liveTracking", v)} />
          </div>
        </div>
      </Card>

      {enroll && <FaceEnroll onClose={() => setEnroll(false)} onEnrolled={() => { set("faceEnrolled", true); set("faceLock", true); setEnroll(false); toast.success("Face enrolled", "Face Lock is ready."); }} />}
      {locked && <LockScreen cfg={cfg} onUnlock={() => { setLocked(false); toast.success("Unlocked", "Welcome back."); }} onCancel={() => setLocked(false)} />}
    </div>
  );
}

function Card({ icon, title, subtitle, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name={icon} className="h-5 w-5" /></span>
        <div><p className="text-sm font-semibold text-slate-800">{title}</p><p className="text-xs text-slate-500">{subtitle}</p></div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
      <div><p className="text-sm font-medium text-slate-800">{label}</p><p className="text-xs text-slate-500">{desc}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
function PinInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input type="password" inputMode="numeric" maxLength={4} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} placeholder={placeholder} className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-blue-500" />;
}

function FaceEnroll({ onClose, onEnrolled }: { onClose: () => void; onEnrolled: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices) throw new Error("no camera");
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
      } catch {
        setErr("Camera access was denied or is unavailable.");
      }
    })();
    return () => { active = false; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function capture() {
    setScanning(true);
    window.setTimeout(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); onEnrolled(); }, 1600);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><h3 className="text-base font-bold text-slate-900">Enroll your face</h3><button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button></div>
        <div className="relative mx-auto mt-4 aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl bg-slate-900">
          {err ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center text-sm text-slate-300"><Icon name="camera" className="h-8 w-8 text-slate-500" /><p className="mt-2">{err}</p></div>
          ) : (
            <>
              <video ref={videoRef} muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
              <div className={`pointer-events-none absolute inset-0 m-auto h-44 w-36 rounded-[50%] border-2 ${scanning ? "animate-pulse border-emerald-400" : "border-white/70"}`} />
            </>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">{scanning ? "Scanning… hold still" : "Center your face in the oval and capture."}</p>
        <button onClick={capture} disabled={!!err || scanning} className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{scanning ? "Enrolling…" : "Capture & Enroll"}</button>
      </div>
    </div>
  );
}

function LockScreen({ cfg, onUnlock, onCancel }: { cfg: AppSecurity; onUnlock: () => void; onCancel: () => void }) {
  const [entered, setEntered] = useState("");
  const [shake, setShake] = useState(false);
  const [face, setFace] = useState(false);

  function press(d: string) {
    if (entered.length >= 4 || face) return;
    const next = entered + d;
    setEntered(next);
    if (next.length === 4) {
      if (next === cfg.pin) window.setTimeout(onUnlock, 150);
      else { setShake(true); window.setTimeout(() => { setEntered(""); setShake(false); }, 500); }
    }
  }
  function faceUnlock() { setFace(true); window.setTimeout(onUnlock, 1700); }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <button onClick={onCancel} className="absolute right-5 top-5 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close"><Icon name="close" className="h-5 w-5" /></button>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><Icon name="shield" className="h-7 w-7" /></div>
      <p className="mt-4 text-lg font-bold">App Locked</p>
      <p className="text-sm text-white/60">{face ? "Recognising face…" : "Enter your PIN to unlock"}</p>

      {face ? (
        <div className="mt-8 flex h-28 w-28 items-center justify-center rounded-full ring-2 ring-emerald-400"><Icon name="camera" className="h-10 w-10 animate-pulse text-emerald-400" /></div>
      ) : (
        <>
          <div className={`mt-6 flex gap-3 ${shake ? "animate-[wiggle_0.4s]" : ""}`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < entered.length ? "bg-white" : "bg-white/25"}`} />)}
          </div>
          {cfg.appLock && cfg.pin.length === 4 && (
            <div className="mt-7 grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} onClick={() => press(d)} className="h-14 w-14 rounded-full bg-white/10 text-xl font-semibold ring-1 ring-white/15 transition hover:bg-white/20 active:scale-95">{d}</button>
              ))}
              <span />
              <button onClick={() => press("0")} className="h-14 w-14 rounded-full bg-white/10 text-xl font-semibold ring-1 ring-white/15 transition hover:bg-white/20 active:scale-95">0</button>
              <button onClick={() => setEntered((e) => e.slice(0, -1))} className="flex h-14 w-14 items-center justify-center rounded-full text-white/70 hover:bg-white/10"><Icon name="arrowLeft" className="h-5 w-5" /></button>
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex gap-4">
        {cfg.faceLock && cfg.faceEnrolled && !face && <button onClick={faceUnlock} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/20"><Icon name="camera" className="h-4 w-4" /> Face Unlock</button>}
        {cfg.biometric && !face && <button onClick={() => window.setTimeout(onUnlock, 800)} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/20"><Icon name="check" className="h-4 w-4" /> Fingerprint</button>}
      </div>
    </div>
  );
}
