'use client';

import { HouseholdOverview } from '@/features/household';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// The surplus needs the assets barrel, which pulls the planner into the bundle.
// A render-less reporter loads lazily so that weight stays off this page's first
// load, while HouseholdOverview mounts once and keeps its tab and open editors
// when the surplus arrives.
const HouseholdSurplusReporter = dynamic(
  () => import('./household-surplus-reporter'),
  { loading: () => null }
);

export function HouseholdWithSavings() {
  const [surplus, setSurplus] = useState<number | null>(null);
  return (
    <>
      <HouseholdOverview personalSurplus={surplus} />
      <HouseholdSurplusReporter onSurplus={setSurplus} />
    </>
  );
}
