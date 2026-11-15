import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the loaded page: header, summary card, then items and chart/activity. */
export function GoalDetailSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-8 lg:gap-y-8">
        <Skeleton className="h-72 w-full rounded-xl lg:col-start-1 lg:row-span-2" />
        <Skeleton className="h-[220px] w-full rounded-xl lg:col-start-2" />
        <Skeleton className="h-40 w-full rounded-xl lg:col-start-2" />
      </div>
    </div>
  );
}
