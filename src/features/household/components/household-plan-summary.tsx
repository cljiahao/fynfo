'use client';

import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole } from '@/lib/utils/currency';
import { useMemo, useState } from 'react';
import { useHouseholdPlan } from '../hooks/use-household-plan';
import {
  computeHouseholdPlan,
  householdRecommendations,
  type HouseholdPlanInput,
} from '../lib/household-plan';
import { HouseholdRecommendations } from './household-recommendations';

function sharedInput(input: HouseholdPlanInput) {
  return {
    goals: input.goals.map((goal) => ({ ...goal, share: 1 })),
    budgets: input.budgets.map((budget) => ({ ...budget, share: 1 })),
  };
}

/**
 * Recommendations and monthly figures at the top of the household page. The
 * page never has the caller's savings, so surplus is 0: no "covered" or
 * "shortfall" notes, and the shared total is labelled "before your savings".
 */
export function HouseholdPlanSummary() {
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
    };
  }, [input, now]);

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
    </div>
  );
}
