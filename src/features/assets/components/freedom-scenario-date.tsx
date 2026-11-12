'use client';

import { useMemo, useState } from 'react';
import {
  assumptionsFromSettings,
  portfolioFromSnapshot,
} from '../hooks/use-freedom-inputs';
import { usePlannerSettings } from '../hooks/use-planner-settings';
import { useSnapshots } from '../hooks/use-snapshots';
import {
  DEFAULT_RETURN_SPREAD_PCT,
  projectFreedom,
} from '../lib/freedom-projection';
import { formatMonthLabel } from './freedom-format';

interface FreedomScenarioDateProps {
  expenses: number;
  investmentAmt: number;
  netAfterCpf: number;
  savingsAmt: number;
}

/**
 * Read-only freedom date for a hypothetical plan. It uses the live portfolio
 * and assumptions but the scenario's own spending and investing, with no
 * buffer, household or dividend effects, so it is labelled as its own basis.
 */
export function FreedomScenarioDate({
  expenses,
  investmentAmt,
  netAfterCpf,
  savingsAmt,
}: FreedomScenarioDateProps) {
  const { data: snapshots } = useSnapshots();
  const { data: settings } = usePlannerSettings();
  const [now] = useState(() => new Date());
  const latest = (snapshots ?? []).reduce<
    NonNullable<typeof snapshots>[number] | undefined
  >(
    (current, snapshot) =>
      !current || snapshot.id > current.id ? snapshot : current,
    undefined
  );
  const assumptions = assumptionsFromSettings(settings);

  const projection = useMemo(
    () =>
      projectFreedom({
        now,
        portfolio: portfolioFromSnapshot(latest),
        annualCost: expenses * 12,
        withdrawalRatePct: assumptions.withdrawalRatePct,
        realReturnPct: assumptions.realReturnPct,
        returnSpreadPct: DEFAULT_RETURN_SPREAD_PCT,
        targetYear: assumptions.targetYear,
        monthlyInvesting: investmentAmt,
        safetyRelease: null,
        householdGoalsToday: 0,
        householdGoalsMonthlyByYear: [],
        netMonthlyIncome: netAfterCpf > 0 ? netAfterCpf : null,
        savingsMonthly: savingsAmt,
        dividendAvgMonthly: null,
      }),
    [
      now,
      latest,
      expenses,
      investmentAmt,
      netAfterCpf,
      savingsAmt,
      assumptions.withdrawalRatePct,
      assumptions.realReturnPct,
      assumptions.targetYear,
    ]
  );

  if (!latest) return null;
  if (projection.status !== 'ok' && projection.status !== 'no_portfolio') {
    return null;
  }

  const { base } = projection;
  return (
    <p className="text-sm" data-testid="scenario-freedom-date">
      <span className="text-muted-foreground">
        Projected freedom date (scenario basis):{' '}
      </span>
      {base.date === null
        ? 'not reached within 60 years'
        : base.reached
          ? 'already reached'
          : formatMonthLabel(base.date)}
    </p>
  );
}
