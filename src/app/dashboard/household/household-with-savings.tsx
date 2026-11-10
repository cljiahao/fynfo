'use client';

import { HouseholdOverview } from '@/features/household';
import dynamic from 'next/dynamic';

// The surplus needs the assets barrel, which pulls the planner into the bundle.
// Loading it lazily keeps that weight off this page's first load; the overview
// renders at once and gains the "savings already cover" line when it arrives.
const HouseholdSurplusOverview = dynamic(
  () => import('./household-surplus-overview'),
  { loading: () => <HouseholdOverview personalSurplus={null} /> }
);

export function HouseholdWithSavings() {
  return <HouseholdSurplusOverview />;
}
