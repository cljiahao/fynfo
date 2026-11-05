import { Skeleton } from '@/components/ui/skeleton';

export function GoalDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-11 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-[220px] w-full rounded-xl" />
      </div>
    </div>
  );
}
