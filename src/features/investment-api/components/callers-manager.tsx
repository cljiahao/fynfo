'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useCallers } from '../hooks/use-callers';
import { CreateCallerDialog } from './callers-dialogs';
import { CallersList } from './callers-list';

// Client component: owns the TanStack Query read and the mutation dialogs.
export function CallersManager() {
  const { data, isPending, isError } = useCallers();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateCallerDialog />
      </div>
      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <p role="alert" className="text-destructive text-sm">
          Could not load API callers. Unlock your vault and try again.
        </p>
      ) : (
        <CallersList callers={data} />
      )}
    </div>
  );
}
