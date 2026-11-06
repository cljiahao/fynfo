'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Lazy boundary so recharts loads client-side only; the placeholder reserves the
// chart's height to avoid layout shift.
export const DividendMonthlyChart = dynamic(
  () =>
    import('./dividend-monthly-chart-content').then(
      (m) => m.DividendMonthlyChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full" />,
  }
);
