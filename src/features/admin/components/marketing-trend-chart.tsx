'use client';

import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side only.
export const MarketingTrendChart = dynamic(
  () =>
    import('./marketing-trend-chart-content').then(
      (m) => m.MarketingTrendChart
    ),
  { ssr: false }
);
