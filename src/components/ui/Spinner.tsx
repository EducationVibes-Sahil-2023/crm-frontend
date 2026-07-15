// Brand-coloured loading spinner. Colour follows the active theme accent
// (--accent, set by applyAppearance) with a sensible fallback.

export function Spinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-[3px] border-current border-t-transparent align-[-0.125em] ${className}`}
      style={{ width: size, height: size, color: "var(--accent, #2563eb)" }}
    />
  );
}

/** Full-area centred spinner with an optional label — for page/section loads. */
export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner size={38} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}
