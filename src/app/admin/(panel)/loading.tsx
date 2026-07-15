import { Skeleton, SkeletonStat, SkeletonTable } from "@/components/ui/Skeleton";

// Route-transition skeleton for the super-admin console — renders inside the
// admin shell (sidebar/topbar stay mounted) while the next page loads.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
