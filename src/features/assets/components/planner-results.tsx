'use client';

import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side only.
export const PlannerResults = dynamic(
  () => import('./planner-results-content').then((m) => m.PlannerResults),
  { ssr: false }
);
