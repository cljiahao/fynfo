import { Skeleton } from '@/components/ui/skeleton';

export default function ExpensesLoading() {
  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div className="flex-between">
        <div>
          <Skeleton className="h-9 w-36" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>

      <Skeleton className="h-20 w-full rounded-xl" />

      <div className="rounded-xl border">
        <div className="flex-between border-b px-4 py-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
