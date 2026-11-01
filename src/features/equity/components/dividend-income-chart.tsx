'use client';

import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side only.
export const DividendIncomeChart = dynamic(
  () =>
    import('./dividend-income-chart-content').then(
      (m) => m.DividendIncomeChart
    ),
  { ssr: false }
);
