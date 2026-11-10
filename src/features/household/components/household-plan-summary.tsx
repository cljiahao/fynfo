'use client';

import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole } from '@/lib/utils/currency';
import { useMemo, useState } from 'react';
import { useHouseholdPlan } from '../hooks/use-household-plan';
import { savingsCoverShare, sharedInput } from '../lib/household-joint-plan';
import {
  computeHouseholdPlan,
  householdRecommendations,
} from '../lib/household-plan';
import { HouseholdRecommendations } from './household-recommendations';

interface HouseholdPlanSummaryProps {
  /**
   * The caller's own spare savings, worked out in their browser by the page.
   * Null while unknown. It only drives one note; the joint figures ignore it.
   */
  personalSurplus?: number | null;
}

/**
 * Recommendations and monthly figures at the top of the household page. The
 * joint figures never use the caller's savings, so surplus is 0 and the shared
 * total is labelled "before your savings". The one personal note is shown only
 * when the page supplies a surplus that covers the caller's whole share.
 */
export function HouseholdPlanSummary({
  personalSurplus = null,
}: HouseholdPlanSummaryProps) {
  const plan = useHouseholdPlan();
  const { mask } = useAmountVisibility();
  const [now] = useState(() => new Date());
  const input = plan.data;

  const figures = useMemo(() => {
    if (!input || input.state !== 'ready') return null;
    const mine = computeHouseholdPlan(input, { surplus: 0, now });
    const together = computeHouseholdPlan(sharedInput(input), {
      surplus: 0,
      now,
    });
    return {
      mine: mine.monthly,
      together: together.monthly,
      recommendations: householdRecommendations(input, mine, { now }),
      covered:
        personalSurplus !== null &&
        savingsCoverShare(input, personalSurplus, now),
    };
  }, [input, now, personalSurplus]);

  if (plan.isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn&apos;t work out the plan right now.
      </p>
    );
  }
  if (plan.isLoading) {
    return (
      <p className="text-muted-foreground text-sm" aria-busy="true">
        Working out the plan...
      </p>
    );
  }
  if (!figures) return null;

  const money = (amount: number) => mask(formatSGDWhole(amount));

  return (
    <div className="space-y-3">
      <HouseholdRecommendations
        recommendations={figures.recommendations}
        now={now}
      />
      {figures.together > 0 && (
        <p className="text-sm">
          <span className="font-medium">
            Together {money(figures.together)} a month
          </span>
          <span className="text-muted-foreground">
            , before your savings. Your share {money(figures.mine)} a month.
          </span>
        </p>
      )}
      {figures.covered && (
        <p className="text-muted-foreground text-sm">
          Your savings already cover your share.
        </p>
      )}
    </div>
  );
}
