import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div>
        <Skeleton className="h-9 w-28" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>

      <div className="rounded-xl border p-6">
        <Skeleton className="mb-6 h-6 w-40" />
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-10 w-24 rounded-md" />
      </div>
    </div>
  );
}
