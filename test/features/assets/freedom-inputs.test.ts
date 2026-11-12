import type { PlannerValues } from '@/features/assets/components/salary-planner';
import {
  assumptionsFromSettings,
  buildFreedomInput,
  buildLeverContext,
  computeExpenseDriftPct,
  portfolioFromSnapshot,
} from '@/features/assets/hooks/use-freedom-inputs';
import { describe, expect, it } from 'vitest';

const planner: PlannerValues = {
  investmentAmount: 1000,
  emergencyFundGoal: 10_000,
  warChestGoal: 20_000,
  householdEarmark: 1000,
  expenses: 3000,
  savingsAmt: 500,
  netAfterCpf: 8000,
  bufferAmt: 300,
  budgetsMonthly: 200,
  goalsMonthly: 400,
  householdGoalsMonthlyByYear: [400, 100],
  householdGoalEnds: [],
  householdIncluded: true,
  expenseDriftPct: 12,
  expensesOverridden: false,
  safetyRelease: { monthly: 500, fromMonth: 4 },
};

const snapshot = {
  id: '2026-10',
  entries: [
    { category: 'stocks' as const, account: 'a', amount: 1000 },
    { category: 'etf' as const, account: 'b', amount: 2000 },
    { category: 'crypto' as const, account: 'c', amount: 300 },
    { category: 'pension' as const, account: 'cpf', amount: 90_000 },
    { category: 'savings' as const, account: 's', amount: 40_000 },
    { category: 'bonds' as const, account: 'b', amount: 2000 },
  ],
};

describe('computeExpenseDriftPct', () => {
  it('compares the last month with the average when no override is set', () => {
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: { average: 1000, monthsUsed: 6 },
        lastMonth: 1200,
      })
    ).toBeCloseTo(20);
  });

  it('compares the average with an override when one is set', () => {
    expect(
      computeExpenseDriftPct({
        override: 800,
        recentAvg: { average: 1000, monthsUsed: 6 },
        lastMonth: 5000,
      })
    ).toBeCloseTo(25);
  });

  it('needs three months of history and positive figures', () => {
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: { average: 1000, monthsUsed: 2 },
        lastMonth: 2000,
      })
    ).toBeNull();
    expect(
      computeExpenseDriftPct({
        override: 0,
        recentAvg: { average: 1000, monthsUsed: 6 },
        lastMonth: 2000,
      })
    ).toBeNull();
  });
});

describe('freedom inputs', () => {
  it('counts only investment categories as the portfolio', () => {
    expect(portfolioFromSnapshot(snapshot)).toBe(3300);
    expect(portfolioFromSnapshot(undefined)).toBe(0);
  });

  it('builds the projection input from the planner figures', () => {
    const input = buildFreedomInput({
      planner,
      snapshot,
      assumptions: {
        realReturnPct: 4,
        withdrawalRatePct: 3.5,
        targetYear: null,
      },
      dividendAvgMonthly: null,
      now: new Date(2026, 10, 12),
    });
    expect(input.annualCost).toBe(12 * (3000 + 300 + 200));
    expect(input.portfolio).toBe(3300);
    expect(input.monthlyInvesting).toBe(1000);
    expect(input.householdGoalsToday).toBe(400);
    expect(input.householdGoalsMonthlyByYear).toEqual([400, 100]);
    expect(input.netMonthlyIncome).toBe(8000);
    expect(input.returnSpreadPct).toBe(2);
  });

  it('builds the lever context with the earmark taken out of the surplus', () => {
    expect(buildLeverContext(planner, snapshot)).toMatchObject({
      surplusAfterEarmark: 42_000 - 10_000 - 20_000 - 1000,
      expenseDriftPct: 12,
      expensesAnnual: 36_000,
    });
  });

  it('reads absent settings as unset', () => {
    expect(assumptionsFromSettings(null)).toEqual({
      realReturnPct: null,
      withdrawalRatePct: null,
      targetYear: null,
    });
  });
});
