'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side
// only. The placeholder reserves the chart's height to avoid layout shift.
export const CategoryBreakdown = dynamic(
  () => import('./category-breakdown-content').then((m) => m.CategoryBreakdown),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[236px] w-full" />,
  }
);
