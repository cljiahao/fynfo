'use client';

import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side only.
export const ExpenseChart = dynamic(
  () => import('./expense-chart-content').then((m) => m.ExpenseChart),
  { ssr: false }
);
