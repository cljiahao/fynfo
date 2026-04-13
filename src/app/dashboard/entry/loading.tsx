import { Skeleton } from '@/components/ui/skeleton';

export default function EntryLoading() {
  return (
    <div className="max-w-content mx-auto w-full px-6 py-8">
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
        </div>

        <div className="rounded-xl border">
          <div className="flex-between border-b px-4 py-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b px-4 py-3 last:border-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 flex-1 rounded-md" />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}
