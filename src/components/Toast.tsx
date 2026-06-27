"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; title: string; message?: string };

type ToastContextValue = {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, type, title, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  // Memoised so consumers' `useToast()` keeps a stable identity — otherwise every
  // toast re-render would re-fire effects that depend on it.
  const value = useMemo<ToastContextValue>(() => ({
    toast,
    success: (title, message) => toast("success", title, message),
    error: (title, message) => toast("error", title, message),
    info: (title, message) => toast("info", title, message),
  }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const STYLES: Record<
  ToastType,
  { ring: string; iconWrap: string; bar: string; icon: ReactNode }
> = {
  success: {
    ring: "ring-emerald-100",
    iconWrap: "bg-emerald-100 text-emerald-600",
    bar: "bg-emerald-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  error: {
    ring: "ring-red-100",
    iconWrap: "bg-red-100 text-red-600",
    bar: "bg-red-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    ),
  },
  info: {
    ring: "ring-blue-100",
    iconWrap: "bg-blue-100 text-blue-600",
    bar: "bg-blue-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = STYLES[toast.type];
  return (
    <div
      role="status"
      className={`animate-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl bg-white p-4 shadow-2xl ring-1 ${s.ring}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} />
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.iconWrap}`}>
        {s.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-sm text-slate-500">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 text-slate-400 transition hover:text-slate-600"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
