'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side
// only. The placeholder reserves the chart's height to avoid layout shift.
export const GoalContributionsChart = dynamic(
  () =>
    import('./goal-contributions-chart-content').then(
      (m) => m.GoalContributionsChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full" />,
  }
);
