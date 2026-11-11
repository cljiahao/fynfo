import {
  computeFreedomLevers,
  projectFreedom,
  visibleFreedomLevers,
  type FreedomInput,
  type LeverContext,
} from '@/features/assets/lib/freedom-projection';
import { averageMonthlyTTM, expenseCoverage } from '@/features/equity';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 0, 15);

function input(overrides: Partial<FreedomInput> = {}): FreedomInput {
  return {
    now: NOW,
    portfolio: 180_000,
    annualCost: 36_000,
    withdrawalRatePct: 4,
    realReturnPct: 0,
    returnSpreadPct: 0,
    targetYear: null,
    monthlyInvesting: 3_000,
    safetyRelease: null,
    householdGoalsToday: 0,
    householdGoalsMonthlyByYear: [],
    netMonthlyIncome: null,
    savingsMonthly: 0,
    dividendAvgMonthly: null,
    ...overrides,
  };
}

const NO_CONTEXT: LeverContext = {
  surplusAfterEarmark: 0,
  expenseDriftPct: null,
  expensesAnnual: null,
  householdGoalEnds: [],
};

describe('projectFreedom compounding', () => {
  // r_m = 1% a month, so the annual real return is 1.01^12 - 1.
  const monthly1pct = (1.01 ** 12 - 1) * 100;
  const compounding = (annualCost: number) =>
    input({
      portfolio: 0,
      annualCost,
      withdrawalRatePct: 10,
      realReturnPct: monthly1pct,
      monthlyInvesting: 100,
    });

  it('matches the hand-computed balances 100, 201, 303.01, 406.0401', () => {
    // F = annualCost / 0.10; each target sits just under a month-end balance.
    expect(projectFreedom(compounding(10)).base.months).toBe(1);
    expect(projectFreedom(compounding(20.1)).base.months).toBe(2);
    expect(projectFreedom(compounding(30.3)).base.months).toBe(3);
    expect(projectFreedom(compounding(30.302)).base.months).toBe(4);
    const four = projectFreedom(compounding(40.6));
    expect(four.base.months).toBe(4);
    expect(four.yearly[0]?.endBalance).toBeCloseTo(406.0401, 6);
    expect(four.yearly[0]?.invested).toBe(400);
  });
});

describe('projectFreedom worked example (r = 0)', () => {
  it('needs 240 months at a flat 3,000', () => {
    const p = projectFreedom(input());
    expect(p.freedomNumber).toBe(900_000);
    expect(p.progressPct).toBeCloseTo(20, 10);
    expect(p.base.months).toBe(240);
    expect(p.base.date).toBe('2046-01');
  });

  it('needs 360 months at a flat 2,000', () => {
    expect(projectFreedom(input({ monthlyInvesting: 2_000 })).base.months).toBe(
      360
    );
  });
});

describe('range ordering', () => {
  it('orders low >= base >= high', () => {
    const p = projectFreedom(
      input({ realReturnPct: 4, returnSpreadPct: 2, monthlyInvesting: 2_000 })
    );
    expect(p.low.months).not.toBeNull();
    expect(p.low.months as number).toBeGreaterThanOrEqual(
      p.base.months as number
    );
    expect(p.base.months as number).toBeGreaterThanOrEqual(
      p.high.months as number
    );
  });

  it('floors the low return at 0', () => {
    const p = projectFreedom(input({ realReturnPct: 1, returnSpreadPct: 2 }));
    expect(p.low.months).toBe(240);
  });

  it('lets a non-reached low run sit after a reached base run', () => {
    const p = projectFreedom(
      input({ realReturnPct: 6, returnSpreadPct: 6, capMonths: 200 })
    );
    expect(p.low.months).toBeNull();
    expect(p.base.months).not.toBeNull();
    expect(p.high.months).not.toBeNull();
  });
});

describe('household schedule', () => {
  const household = (byYear: number[]) =>
    input({
      monthlyInvesting: 2_000,
      householdGoalsToday: 1_000,
      householdGoalsMonthlyByYear: byYear,
    });

  it('moves the 24-month example from 240 to 248', () => {
    const p = projectFreedom(household([1_000, 1_000]));
    expect(p.base.months).toBe(248);
    expect(p.householdMovesMonths).toBe(8);
  });

  it('moves the date less when the goals end sooner', () => {
    const p = projectFreedom(household([1_000]));
    expect(p.base.months).toBe(244);
    expect(p.householdMovesMonths).toBe(4);
  });

  it('reports null when a run is not reached', () => {
    const p = projectFreedom({ ...household([1_000]), capMonths: 100 });
    expect(p.householdMovesMonths).toBeNull();
  });

  it('reads an empty series with zero goals as a flat run (240 months at 3,000, 360 at 2,000)', () => {
    const flat3000 = projectFreedom(
      input({ householdGoalsToday: 0, householdGoalsMonthlyByYear: [] })
    );
    expect(flat3000.base.months).toBe(240);
    expect(flat3000.householdMovesMonths).toBe(0);
    const flat2000 = projectFreedom(
      input({
        monthlyInvesting: 2_000,
        householdGoalsToday: 0,
        householdGoalsMonthlyByYear: [],
      })
    );
    expect(flat2000.base.months).toBe(360);
    expect(flat2000.householdMovesMonths).toBe(0);
  });

  it('reads years missing from a short series as 0 (the [1,000] case gives 244)', () => {
    const p = projectFreedom(household([1_000]));
    expect(p.base.months).toBe(244);
  });
});

describe('safety release', () => {
  it('adds the released savings from the funded month', () => {
    const p = projectFreedom(
      input({ safetyRelease: { monthly: 1_000, fromMonth: 61 } })
    );
    // 60 * 3,000 = 180,000 -> 360,000; then 4,000 a month: 540,000 / 4,000 = 135.
    expect(p.base.months).toBe(195);
  });
});

describe('edge runs', () => {
  it('never reaches with zero investing', () => {
    const p = projectFreedom(input({ monthlyInvesting: 0 }));
    expect(p.base.months).toBeNull();
    expect(p.base.date).toBeNull();
    expect(p.base.reached).toBe(false);
  });

  it('never reaches with negative investing', () => {
    expect(
      projectFreedom(input({ monthlyInvesting: -500 })).base.months
    ).toBeNull();
  });

  it('is reached at month 0 when the portfolio covers the freedom number', () => {
    const p = projectFreedom(input({ portfolio: 900_000 }));
    expect(p.base).toEqual({ months: 0, date: '2026-01', reached: true });
    expect(p.progressPct).toBe(100);
    expect(p.yearly).toEqual([]);
  });

  it('caps progress at 100', () => {
    expect(projectFreedom(input({ portfolio: 2_000_000 })).progressPct).toBe(
      100
    );
  });

  it('reports a date for exactly 720 months and null beyond', () => {
    const edge = (monthlyInvesting: number) =>
      projectFreedom(
        input({ portfolio: 0, annualCost: 2_880, monthlyInvesting })
      );
    expect(edge(100).base.months).toBe(720);
    expect(edge(100).base.date).toBe('2086-01');
    expect(edge(99).base.months).toBeNull();
    expect(edge(99).yearly).toHaveLength(61);
  });

  it('lists the base case per calendar year up to the reached year', () => {
    const p = projectFreedom(input());
    expect(p.yearly[0]).toEqual({
      year: 2026,
      invested: 33_000,
      endBalance: 213_000,
    });
    expect(p.yearly.at(-1)?.endBalance).toBe(900_000);
    expect(p.yearly.at(-1)?.year).toBe(2046);
  });

  it('flags a zero-portfolio run with no_portfolio but still projects', () => {
    const p = projectFreedom(input({ portfolio: 0 }));
    expect(p.status).toBe('no_portfolio');
    expect(p.base.months).toBe(300);
  });
});

describe('statuses', () => {
  it('no assumptions when return or withdrawal rate is null', () => {
    expect(projectFreedom(input({ realReturnPct: null })).status).toBe(
      'no_assumptions'
    );
    const p = projectFreedom(input({ withdrawalRatePct: null }));
    expect(p.status).toBe('no_assumptions');
    expect(p.freedomNumber).toBeNull();
    expect(p.base.months).toBeNull();
  });

  it('no expenses when annual cost is not positive', () => {
    expect(projectFreedom(input({ annualCost: 0 })).status).toBe('no_expenses');
    expect(projectFreedom(input({ annualCost: -5 })).status).toBe(
      'no_expenses'
    );
  });

  it('invalid for non-finite inputs and a withdrawal rate of 0 or less', () => {
    expect(projectFreedom(input({ portfolio: Number.NaN })).status).toBe(
      'invalid'
    );
    expect(projectFreedom(input({ annualCost: Infinity })).status).toBe(
      'invalid'
    );
    expect(projectFreedom(input({ withdrawalRatePct: 0 })).status).toBe(
      'invalid'
    );
    expect(projectFreedom(input({ withdrawalRatePct: -1 })).status).toBe(
      'invalid'
    );
  });
});

describe('range and cap validation', () => {
  it.each([
    ['negative spread', { returnSpreadPct: -1 }],
    ['real return of -100', { realReturnPct: -100 }],
    ['real return below -100', { realReturnPct: -150 }],
    ['non-finite capMonths', { capMonths: Number.NaN }],
    ['infinite capMonths', { capMonths: Infinity }],
    ['non-finite targetYear', { targetYear: Number.NaN }],
  ])('is invalid for %s', (_label, override) => {
    const p = projectFreedom(input(override));
    expect(p.status).toBe('invalid');
    expect(p.base.months).toBeNull();
  });
});

describe('target year', () => {
  it('is null without a target and compares the base date otherwise', () => {
    expect(projectFreedom(input()).onTrackForTarget).toBeNull();
    expect(projectFreedom(input({ targetYear: 2046 })).onTrackForTarget).toBe(
      true
    );
    expect(projectFreedom(input({ targetYear: 2045 })).onTrackForTarget).toBe(
      false
    );
    expect(
      projectFreedom(input({ targetYear: 2060, monthlyInvesting: 0 }))
        .onTrackForTarget
    ).toBe(false);
  });
});

describe('savings rate and dividend coverage', () => {
  it('computes the savings rate from investing plus savings over net income', () => {
    const p = projectFreedom(
      input({
        monthlyInvesting: 2_000,
        savingsMonthly: 500,
        netMonthlyIncome: 5_000,
      })
    );
    expect(p.savingsRatePct).toBeCloseTo(50, 10);
  });

  it('is null without a positive net income', () => {
    expect(projectFreedom(input()).savingsRatePct).toBeNull();
    expect(
      projectFreedom(input({ netMonthlyIncome: 0 })).savingsRatePct
    ).toBeNull();
  });

  it('matches expenseCoverage times 100 against living cost', () => {
    const avg = averageMonthlyTTM(1_200);
    const p = projectFreedom(input({ dividendAvgMonthly: avg }));
    expect(p.dividendCoveragePct).toBeCloseTo(
      (expenseCoverage(avg, 36_000 / 12) as number) * 100,
      10
    );
    expect(projectFreedom(input()).dividendCoveragePct).toBeNull();
  });
});

describe('now is an input', () => {
  it('shifts only the dates when now changes', () => {
    const a = projectFreedom(input({ now: new Date(2026, 0, 15) }));
    const b = projectFreedom(input({ now: new Date(2027, 5, 3) }));
    expect(b.base.months).toBe(a.base.months);
    expect(a.base.date).toBe('2046-01');
    expect(b.base.date).toBe('2047-06');
    expect(b.yearly[0]?.year).toBe(2027);
    expect(b.yearly).toHaveLength(a.yearly.length);
  });
});

describe('computeFreedomLevers', () => {
  const ctx = (over: Partial<LeverContext> = {}): LeverContext => ({
    ...NO_CONTEXT,
    ...over,
  });

  it('extra-monthly: step is the larger of 100 and 10 percent, rounded to 50', () => {
    const levers = computeFreedomLevers(input(), ctx());
    expect(levers).toEqual([
      { kind: 'extra-monthly', amount: 300, monthsEarlier: 21 },
    ]);
    const small = computeFreedomLevers(
      input({ monthlyInvesting: 500, annualCost: 3_600, portfolio: 0 }),
      ctx()
    );
    expect(small[0]).toMatchObject({ kind: 'extra-monthly', amount: 100 });
  });

  it('extra-monthly: does not fire when already reached or under one month', () => {
    expect(computeFreedomLevers(input({ portfolio: 900_000 }), ctx())).toEqual(
      []
    );
    expect(computeFreedomLevers(input({ portfolio: 897_000 }), ctx())).toEqual(
      []
    );
  });

  it('expense-drift fires above 10 percent only', () => {
    const drift = (pct: number) =>
      computeFreedomLevers(
        input(),
        ctx({ expenseDriftPct: pct, expensesAnnual: 30_000 })
      ).find((l) => l.kind === 'expense-drift');
    expect(drift(10)).toBeUndefined();
    // Cost 36,000 + 30,000 * 11% = 39,300 -> F 982,500 -> 802,500 / 3,000 -> 268 months, 28 later.
    expect(drift(11)).toEqual({
      kind: 'expense-drift',
      driftPct: 11,
      monthsLater: 28,
    });
  });

  it('expense-drift scales the expenses portion only', () => {
    // Cost 36,000 + 30,000 * 20% = 42,000 -> F 1,050,000 -> 870,000 / 3,000 = 290 months, 50 later.
    const lever = computeFreedomLevers(
      input(),
      ctx({ expenseDriftPct: 20, expensesAnnual: 30_000 })
    ).find((l) => l.kind === 'expense-drift');
    expect(lever).toMatchObject({ driftPct: 20, monthsLater: 50 });
  });

  it.each([null, 0, -1, Number.NaN])(
    'expense-drift does not fire when expensesAnnual is %s',
    (expensesAnnual) => {
      const levers = computeFreedomLevers(
        input(),
        ctx({ expenseDriftPct: 20, expensesAnnual })
      );
      expect(levers.some((l) => l.kind === 'expense-drift')).toBe(false);
    }
  );

  it('emergency-surplus is measured net of the household earmark', () => {
    // Savings and bonds sit 3,000 above the funds' targets.
    const net = (earmark: number) => 3_000 - earmark;
    const fire = (earmark: number) =>
      computeFreedomLevers(
        input(),
        ctx({ surplusAfterEarmark: net(earmark) })
      ).find((l) => l.kind === 'emergency-surplus');
    expect(fire(2_500)).toBeUndefined();
    expect(fire(1_500)).toEqual({ kind: 'emergency-surplus', amount: 1_500 });
    expect(fire(1_410)).toEqual({ kind: 'emergency-surplus', amount: 1_500 });
    expect(fire(3_500)).toBeUndefined();
  });

  it('household-goal-ends respects the 60-month window and soonest-first order', () => {
    const goal = (goalId: string, endMonth: string, extra = 100) => ({
      goalId,
      name: `Goal ${goalId}`,
      endMonth,
      extraInvesting: extra,
    });
    const levers = computeFreedomLevers(
      input(),
      ctx({
        householdGoalEnds: [
          goal('late', '2031-01'),
          goal('past', '2025-12'),
          goal('far', '2031-02'),
          goal('soon', '2026-03', -50),
        ],
      })
    ).filter((l) => l.kind === 'household-goal-ends');
    expect(levers.map((l) => l.goalId)).toEqual(['soon', 'late']);
    expect(levers[0]?.extraInvesting).toBe(0);
  });

  it('household-goal-ends passes the goal name through the mask', () => {
    const levers = computeFreedomLevers(
      input(),
      ctx({
        householdGoalEnds: [
          {
            goalId: 'g',
            name: 'Holiday',
            endMonth: '2027-01',
            extraInvesting: 400,
          },
        ],
      }),
      { maskName: (n) => '*'.repeat(n.length) }
    );
    expect(levers.find((l) => l.kind === 'household-goal-ends')).toMatchObject({
      name: '*******',
      extraInvesting: 400,
    });
  });

  it('orders by months moved then listed order, and trims to three', () => {
    const levers = computeFreedomLevers(
      input(),
      ctx({
        expenseDriftPct: 11,
        expensesAnnual: 30_000,
        surplusAfterEarmark: 1_590,
        householdGoalEnds: [
          {
            goalId: 'g',
            name: 'Holiday',
            endMonth: '2027-01',
            extraInvesting: 400,
          },
        ],
      })
    );
    expect(levers.map((l) => l.kind)).toEqual([
      'expense-drift',
      'extra-monthly',
      'emergency-surplus',
      'household-goal-ends',
    ]);
    const { shown, rest } = visibleFreedomLevers(levers);
    expect(shown).toHaveLength(3);
    expect(rest.map((l) => l.kind)).toEqual(['household-goal-ends']);
  });

  it('returns nothing when no lever triggers or the projection is not ok', () => {
    expect(computeFreedomLevers(input({ portfolio: 900_000 }), ctx())).toEqual(
      []
    );
    expect(
      computeFreedomLevers(
        input({ monthlyInvesting: 0 }),
        ctx({ surplusAfterEarmark: 5_000 })
      )
    ).toEqual([]);
    expect(
      computeFreedomLevers(
        input({ realReturnPct: null }),
        ctx({ surplusAfterEarmark: 5_000 })
      )
    ).toEqual([]);
  });

  it('never names an asset, fund or platform', () => {
    const levers = computeFreedomLevers(
      input(),
      ctx({
        expenseDriftPct: 20,
        expensesAnnual: 30_000,
        surplusAfterEarmark: 5_000,
        householdGoalEnds: [
          {
            goalId: 'g',
            name: 'Holiday',
            endMonth: '2027-01',
            extraInvesting: 400,
          },
        ],
      })
    );
    expect(JSON.stringify(levers)).not.toMatch(
      /stock|etf|fund|bond|crypto|platform|broker/i
    );
  });
});
