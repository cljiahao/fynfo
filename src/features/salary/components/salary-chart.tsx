'use client';

import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side only.
export const SalaryChart = dynamic(
  () => import('./salary-chart-content').then((m) => m.SalaryChart),
  { ssr: false }
);
