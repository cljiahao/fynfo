import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div className="flex-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[400px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>

      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
