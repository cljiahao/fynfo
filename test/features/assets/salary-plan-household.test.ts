import {
  calcRecentAvgExpense,
  ceilToThousand,
  computeSalaryPlan,
  computeShortfallImpact,
  planStateLine,
  shortfallImpactMonths,
  type SalaryPlanInput,
} from '@/features/assets/lib/salary-plan';
import type { ExpenseData } from '@/features/expenses';
import { formatSGD } from '@/lib/utils/currency';
import { describe, expect, it } from 'vitest';

const base: SalaryPlanInput = {
  salary: 10000,
  expenses: 2000,
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: true,
  tithePctInput: 10,
  allowanceEnabled: false,
  allowancePctInput: 5,
  currentSavings: 0,
  currentBonds: 0,
};

// Frozen copy of the pre-household math, so "identical to today" is proven
// against the old algorithm and not against the function under test.
function legacyPlan(input: SalaryPlanInput) {
  const netAfterCpf = input.salary * 0.8;
  const expensesPct = netAfterCpf > 0 ? input.expenses / netAfterCpf : 0;
  const insurancePct = 0.05;
  const tithePct = input.titheEnabled ? input.tithePctInput / 100 : 0;
  const allowancePct = input.allowanceEnabled
    ? input.allowancePctInput / 100
    : 0;
  const emergencyFundGoal = ceilToThousand(
    input.expenses * input.emergencyMonths
  );
  const warChestGoal = ceilToThousand(input.expenses * input.warChestMonths);
  const usedPct = expensesPct + insurancePct + tithePct + allowancePct;
  const cappedPct = Math.max(1 - usedPct, 0);
  let savingsPct = 0;
  let investmentPct = 0;
  const emergencyFulfilled = input.currentSavings >= emergencyFundGoal;
  const warChestFulfilled = input.currentBonds >= warChestGoal;
  const goalsFulfilled = emergencyFulfilled && warChestFulfilled;
  const goalsNeeded = emergencyFundGoal + warChestGoal;
  const goalsFunded = input.currentSavings + input.currentBonds;
  if (netAfterCpf > 0) {
    if (!goalsFulfilled && usedPct < 1) {
      const remaining = Math.max(goalsNeeded - goalsFunded, 0);
      const average = remaining / 9;
      const cappedAmount = cappedPct * netAfterCpf;
      savingsPct = average < cappedAmount ? average / netAfterCpf : cappedPct;
    }
    investmentPct = Math.max(cappedPct - savingsPct, 0);
  }
  return {
    netAfterCpf,
    expensesPct,
    insurancePct,
    tithePct,
    allowancePct,
    savingsPct,
    investmentPct,
    emergencyFundGoal,
    warChestGoal,
    emergencyFulfilled,
    warChestFulfilled,
    goalsFulfilled,
    goalsNeeded,
    goalsFunded,
    savingsAmt: netAfterCpf * savingsPct,
    expensesAmt: input.expenses,
    insuranceAmt: netAfterCpf * insurancePct,
    investmentAmt: netAfterCpf * investmentPct,
    titheAmt: netAfterCpf * tithePct,
    allowanceAmt: netAfterCpf * allowancePct,
  };
}

const TABLE: SalaryPlanInput[] = [
  base,
  { ...base, currentSavings: 6000, currentBonds: 18000 },
  { ...base, currentSavings: 6000, currentBonds: 5000 },
  { ...base, allowanceEnabled: true, tithePctInput: 15 },
  { ...base, titheEnabled: false, expenses: 0 },
  { ...base, expenses: 9000 },
  { ...base, salary: 0 },
  { ...base, expenses: 6400, tithePctInput: 20, allowanceEnabled: true },
  { ...base, emergencyMonths: 0, warChestMonths: 0 },
];

describe('computeSalaryPlan without household inputs', () => {
  it.each(TABLE.map((input, i) => [i, input] as const))(
    'matches the legacy output for table row %i',
    (_i, input) => {
      const legacy = legacyPlan(input);
      const omitted = computeSalaryPlan(input);
      const zero = computeSalaryPlan({
        ...input,
        householdMonthlyDeduction: 0,
      });
      expect(omitted).toMatchObject(legacy);
      expect(zero).toEqual(omitted);
      expect(omitted.householdAmt).toBe(0);
    }
  );
});

describe('computeSalaryPlan with household inputs', () => {
  it('treats the monthly deduction as an expense-like slice', () => {
    const p = computeSalaryPlan({
      ...base,
      currentSavings: 6000,
      currentBonds: 18000,
      householdMonthlyDeduction: 800,
    });
    expect(p.householdPct).toBeCloseTo(0.1);
    expect(p.householdAmt).toBe(800);
    expect(p.investmentPct).toBeCloseTo(0.5);
  });

  it.each(TABLE.map((input, i) => [i, input] as const))(
    'ignores a stored householdReserve for table row %i',
    (_i, input) => {
      expect(computeSalaryPlan({ ...input, householdReserve: 5000 })).toEqual(
        computeSalaryPlan(input)
      );
    }
  );

  it('no longer pauses investment or redirects surplus to savings', () => {
    const p = computeSalaryPlan({
      ...base,
      currentSavings: 6000,
      currentBonds: 18000,
      householdReserve: 5000,
    });
    expect(p.savingsPct).toBe(0);
    expect(p.investmentPct).toBeCloseTo(0.6);
  });

  it('drops the reserve and pause outputs', () => {
    const p = computeSalaryPlan({ ...base, householdReserve: 5000 });
    expect(p).not.toHaveProperty('investmentPaused');
    expect(p).not.toHaveProperty('householdReserve');
    expect(p).not.toHaveProperty('savingsTarget');
    expect(p).not.toHaveProperty('savingsGap');
  });

  it('reports a shortfall and zeroes savings and investment', () => {
    const p = computeSalaryPlan({
      ...base,
      expenses: 5000,
      householdMonthlyDeduction: 2000,
    });
    // net 8000 - 5000 - 400 - 800 - 0 - 2000 = -200
    expect(p.householdShortfallAmt).toBeCloseTo(200);
    expect(p.savingsAmt).toBe(0);
    expect(p.investmentAmt).toBe(0);
  });

  it('reports the full deficit when expenses alone exceed take-home', () => {
    const p = computeSalaryPlan({ ...base, expenses: 9000 });
    // net 8000 - 9000 - 400 - 800 = -2200, with no household deduction
    expect(p.householdAmt).toBe(0);
    expect(p.householdShortfallAmt).toBeCloseTo(2200);
    expect(p.savingsAmt).toBe(0);
    expect(p.investmentAmt).toBe(0);
  });

  it('has no shortfall when money is left over', () => {
    expect(computeSalaryPlan(base).householdShortfallAmt).toBe(0);
  });
});

describe('planStateLine', () => {
  it('uses the legacy goal wording without a household', () => {
    const p = computeSalaryPlan(base);
    expect(planStateLine(p)).toBe(
      `Savings ${formatSGD(24000)} short of emergency + war chest (${formatSGD(24000)})`
    );
  });

  it('words the goals gap with a household deduction and no pause', () => {
    const p = computeSalaryPlan({
      ...base,
      currentSavings: 30000,
      currentBonds: 0,
      householdMonthlyDeduction: 800,
    });
    expect(planStateLine(p)).toBe(
      `Savings ${formatSGD(0)} short of emergency + war chest (${formatSGD(24000)})`
    );
  });

  it('reports the monthly investment when investing', () => {
    const p = computeSalaryPlan({
      ...base,
      currentSavings: 6000,
      currentBonds: 18000,
    });
    expect(planStateLine(p)).toBe(`Investing ${formatSGD(4800)} a month`);
  });
});

describe('computeShortfallImpact', () => {
  it('projects savings and months of expenses covered', () => {
    const r = computeShortfallImpact({
      shortfallPerMonth: 500,
      monthsHorizon: 24,
      currentSavings: 20000,
      expenses: 2500,
      emergencyMonths: 6,
    });
    expect(r.projectedSavings).toBe(8000);
    expect(r.monthsCovered).toBeCloseTo(3.2);
    expect(r.emergencyMonths).toBe(6);
  });

  it('floors covered months at 0 when savings run out', () => {
    const r = computeShortfallImpact({
      shortfallPerMonth: 1000,
      monthsHorizon: 24,
      currentSavings: 5000,
      expenses: 2000,
      emergencyMonths: 6,
    });
    expect(r.projectedSavings).toBe(-19000);
    expect(r.monthsCovered).toBe(0);
  });

  it('returns 0 months when expenses are 0', () => {
    expect(
      computeShortfallImpact({
        shortfallPerMonth: 0,
        monthsHorizon: 24,
        currentSavings: 100,
        expenses: 0,
        emergencyMonths: 6,
      }).monthsCovered
    ).toBe(0);
  });
});

describe('calcRecentAvgExpense', () => {
  const NOW = new Date(2026, 10, 15);
  const exp = (over: Partial<ExpenseData>): ExpenseData => ({
    id: 'x',
    date: '2026-10-01',
    type: 'food_drink',
    item: '',
    info: '',
    amount: 0,
    splitType: 'self',
    splits: [],
    ...over,
  });

  it('returns 0 for no data', () => {
    expect(calcRecentAvgExpense(undefined, NOW)).toEqual({
      average: 0,
      monthsUsed: 0,
    });
    expect(calcRecentAvgExpense([], NOW)).toEqual({
      average: 0,
      monthsUsed: 0,
    });
  });

  it('excludes the current month', () => {
    const r = calcRecentAvgExpense(
      [
        exp({ date: '2026-10-05', amount: 100 }),
        exp({ date: '2026-11-02', amount: 9999 }),
      ],
      NOW
    );
    expect(r).toEqual({ average: 100, monthsUsed: 1 });
  });

  it('honours an explicit 6 month window', () => {
    const r = calcRecentAvgExpense(
      [
        exp({ date: '2026-04-30', amount: 5000 }),
        exp({ date: '2026-05-01', amount: 100 }),
        exp({ date: '2026-10-31', amount: 300 }),
      ],
      NOW,
      6
    );
    expect(r).toEqual({ average: 400 / 6, monthsUsed: 6 });
  });

  it('defaults to the last 12 full months', () => {
    const r = calcRecentAvgExpense(
      [
        exp({ date: '2025-10-31', amount: 5000 }),
        exp({ date: '2025-11-01', amount: 100 }),
        exp({ date: '2026-10-31', amount: 300 }),
      ],
      NOW
    );
    expect(r).toEqual({ average: 400 / 12, monthsUsed: 12 });
  });

  it('divides by 12 when more than 12 months of data exist', () => {
    const data = Array.from({ length: 15 }, (_, i) =>
      exp({
        date: new Date(2025, 7 + i, 5).toISOString().slice(0, 10),
        amount: 120,
      })
    );
    const r = calcRecentAvgExpense(data, NOW);
    expect(r).toEqual({ average: 120, monthsUsed: 12 });
  });

  it('divides by 3 when the first expense is 3 full months back', () => {
    const r = calcRecentAvgExpense(
      [
        exp({ date: '2026-08-10', amount: 300 }),
        exp({ date: '2026-09-10', amount: 300 }),
        exp({ date: '2026-10-10', amount: 300 }),
      ],
      NOW
    );
    expect(r).toEqual({ average: 300, monthsUsed: 3 });
  });

  it('counts a gap month inside the range as zero', () => {
    const r = calcRecentAvgExpense(
      [
        exp({ date: '2026-08-10', amount: 100 }),
        exp({ date: '2026-08-20', amount: 200 }),
        exp({ date: '2026-10-10', amount: 600 }),
      ],
      NOW
    );
    expect(r).toEqual({ average: 300, monthsUsed: 3 });
  });

  it('subtracts other people portions of shared expenses', () => {
    const r = calcRecentAvgExpense(
      [
        exp({
          date: '2026-09-10',
          amount: 100,
          splitType: 'shared',
          splits: [{ person: 'A', amount: 40, settled: false }],
        }),
      ],
      NOW
    );
    expect(r).toEqual({ average: 30, monthsUsed: 2 });
  });

  it('ignores insurance and honours a custom window', () => {
    const r = calcRecentAvgExpense(
      [
        exp({ date: '2026-10-10', amount: 500, type: 'insurance' }),
        exp({ date: '2026-08-10', amount: 100 }),
        exp({ date: '2026-10-10', amount: 300 }),
      ],
      NOW,
      1
    );
    expect(r).toEqual({ average: 300, monthsUsed: 1 });
  });

  it('crosses a year boundary', () => {
    const r = calcRecentAvgExpense(
      [
        exp({ date: '2025-12-15', amount: 100 }),
        exp({ date: '2025-11-15', amount: 900 }),
      ],
      new Date(2026, 0, 10)
    );
    expect(r).toEqual({ average: 500, monthsUsed: 2 });
  });
});

describe('expense buffer', () => {
  it('defaults to no buffer and leaves the plan unchanged', () => {
    const plan = computeSalaryPlan(base);
    expect(plan.bufferAmt).toBe(0);
    expect(plan.bufferPct).toBe(0);
    expect(plan).toEqual(computeSalaryPlan({ ...base, expenseBufferPct: 0 }));
  });

  it('deducts the buffer after expenses without merging it into them', () => {
    const plain = computeSalaryPlan(base);
    const plan = computeSalaryPlan({ ...base, expenseBufferPct: 10 });
    expect(plan.expensesAmt).toBe(2000);
    expect(plan.bufferAmt).toBe(200);
    expect(plan.bufferPct).toBeCloseTo(200 / 8000);
    expect(plan.emergencyFundGoal).toBe(plain.emergencyFundGoal);
    expect(plan.investmentAmt + plan.savingsAmt).toBeCloseTo(
      plain.investmentAmt + plain.savingsAmt - 200
    );
  });

  it('counts an over-large buffer toward the shortfall', () => {
    const plan = computeSalaryPlan({
      ...base,
      salary: 3000,
      expenses: 2000,
      expenseBufferPct: 50,
    });
    expect(plan.householdShortfallAmt).toBeGreaterThan(0);
    expect(plan.savingsAmt).toBe(0);
  });

  it('ignores a negative buffer', () => {
    expect(computeSalaryPlan({ ...base, expenseBufferPct: -5 }).bufferAmt).toBe(
      0
    );
  });
});

describe('shortfallImpactMonths', () => {
  it.each([
    [2, 2],
    [12, 12],
    [30, 12],
    [null, 12],
    [0, 1],
    [-5, 1],
    [NaN, 12],
  ])('binding %s months projects over %s months', (binding, expected) => {
    expect(shortfallImpactMonths(binding)).toBe(expected);
  });
});
