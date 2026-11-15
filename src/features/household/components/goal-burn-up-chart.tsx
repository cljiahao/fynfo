'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side
// only. The placeholder reserves the chart's height to avoid layout shift.
export const GoalBurnUpChart = dynamic(
  () => import('./goal-burn-up-chart-content').then((m) => m.GoalBurnUpChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border p-3 sm:p-4">
        <Skeleton className="h-[220px] w-full" />
      </div>
    ),
  }
);
