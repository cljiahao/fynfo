'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side
// only. The placeholder reserves the chart's height to avoid layout shift.
export const ExpenseChart = dynamic(
  () => import('./expense-chart-content').then((m) => m.ExpenseChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[336px] w-full sm:h-[446px]" />,
  }
);
