'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Lazy boundary so recharts stays out of the initial bundle; the placeholder
// reserves the donut's height to avoid layout shift.
export const PlannerDonut = dynamic(
  () => import('./planner-donut-content').then((m) => m.PlannerDonut),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full" />,
  }
);
