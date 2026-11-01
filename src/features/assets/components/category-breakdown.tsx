'use client';

import dynamic from 'next/dynamic';

// Lazy boundary for the whole chart so recharts loads in one chunk, client-side only.
export const CategoryBreakdown = dynamic(
  () => import('./category-breakdown-content').then((m) => m.CategoryBreakdown),
  { ssr: false }
);
