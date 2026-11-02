'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side
// only. The placeholder reserves the chart's height to avoid layout shift.
export const AssetLineChart = dynamic(
  () => import('./asset-bar-chart-content').then((m) => m.AssetLineChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[400px] w-full" />,
  }
);
