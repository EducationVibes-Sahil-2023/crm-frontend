// Route-transition fallback for the app section. Next renders this in place of
// the page (inside the persistent layout), so the sidebar/topbar stay mounted
// and ONLY the content area shows this while the next page loads/compiles —
// making it clear that a menu click refreshes only the content, not the page.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
      <svg className="h-7 w-7 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
      <p className="text-sm">Loading…</p>
    </div>
  );
}
