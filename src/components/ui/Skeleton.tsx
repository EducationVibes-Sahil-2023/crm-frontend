// Skeleton placeholders shown while content loads. Pure presentational — safe to
// use in both server (loading.tsx) and client components.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} />;
}

/** A few lines of shimmering text; the last line is shorter. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** A generic card skeleton (avatar/title + body lines). */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}

/** A stat-tile skeleton (KPI row cards). */
export function SkeletonStat({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  );
}

/** A table skeleton with a header and N rows. */
export function SkeletonTable({ rows = 6, cols = 4, className = "" }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <div className="flex gap-4 border-b border-slate-100 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-slate-50 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3 flex-1 ${c === 0 ? "max-w-[40%]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
