import {
  formatLever,
  freedomSummary,
  monthsByYear,
  validateAssumptions,
} from '@/features/assets/components/freedom-format';
import type { FreedomProjection } from '@/features/assets/lib/freedom-projection';
import { describe, expect, it } from 'vitest';

const run = (date: string | null, months: number | null = 10) => ({
  months: date === null ? null : months,
  date,
  reached: months === 0 && date !== null,
});

function projection(over: Partial<FreedomProjection>): FreedomProjection {
  return {
    status: 'ok',
    freedomNumber: 1_000_000,
    progressPct: 40.4,
    low: run('2045-03'),
    base: run('2043-03'),
    high: run('2041-03'),
    onTrackForTarget: null,
    savingsRatePct: null,
    dividendCoveragePct: null,
    householdMovesMonths: null,
    yearly: [],
    ...over,
  };
}

const identity = (text: string) => text;
const masked = () => '***';

describe('freedomSummary', () => {
  it('gives a range from the high to the low run', () => {
    expect(freedomSummary(projection({}))).toBe(
      '40% of the way. On track for 2041 to 2045.'
    );
  });

  it('says "around" when both ends share a year', () => {
    expect(
      freedomSummary(projection({ low: run('2043-09'), high: run('2043-01') }))
    ).toBe('40% of the way. On track for around 2043.');
  });

  it('handles runs that are not reached', () => {
    expect(
      freedomSummary(
        projection({ high: run(null), base: run(null), low: run(null) })
      )
    ).toBe('40% of the way. Not reached within 60 years at this pace.');
    expect(freedomSummary(projection({ low: run(null) }))).toBe(
      '40% of the way. From 2041; the low case is not reached within 60 years.'
    );
  });

  it('says so when the portfolio already covers costs', () => {
    expect(freedomSummary(projection({ base: run('2026-11', 0) }))).toBe(
      'Your portfolio already covers your living costs at your assumptions.'
    );
  });

  it('leads with the empty portfolio', () => {
    expect(
      freedomSummary(projection({ status: 'no_portfolio', progressPct: 0 }))
    ).toMatch(/^No invested portfolio yet\. On track for/);
  });

  it('covers the states without a projection', () => {
    expect(freedomSummary(projection({ status: 'no_assumptions' }))).toMatch(
      /^Add your return and withdrawal assumptions/
    );
    expect(freedomSummary(projection({ status: 'no_expenses' }))).toBe(
      'Add expenses to set a freedom number.'
    );
    expect(freedomSummary(projection({ status: 'invalid' }))).toMatch(
      /unavailable/
    );
  });
});

describe('formatLever', () => {
  it('formats each lever kind with masked amounts', () => {
    expect(
      formatLever(
        { kind: 'extra-monthly', amount: 500, monthsEarlier: 1 },
        identity
      )
    ).toBe('Investing $500 more a month brings your date forward 1 month.');
    expect(
      formatLever(
        { kind: 'extra-monthly', amount: 500, monthsEarlier: 7 },
        masked
      )
    ).toBe('Investing *** more a month brings your date forward 7 months.');
    expect(
      formatLever(
        { kind: 'expense-drift', driftPct: 14.6, monthsLater: 3 },
        masked
      )
    ).toBe(
      'Spending is 15% above your 12-month average. If it stays there, your date moves back 3 months.'
    );
    expect(
      formatLever({ kind: 'emergency-surplus', amount: 2400 }, masked)
    ).toBe(
      'Your emergency fund is *** above target, available to invest if you choose.'
    );
  });

  it('words the drift lever from what was compared', () => {
    const lever = {
      kind: 'expense-drift' as const,
      driftPct: 14.6,
      monthsLater: 3,
    };
    expect(formatLever(lever, identity, true)).toBe(
      'Your 12-month spending is 15% above the expenses entered in the planner. If it stays there, your date moves back 3 months.'
    );
    expect(formatLever(lever, identity, false)).toContain(
      'above your 12-month average'
    );
  });

  it('uses the name as given, so masking is the caller job', () => {
    const lever = {
      kind: 'household-goal-ends' as const,
      goalId: 'g1',
      name: '***',
      endMonth: '2027-06',
      extraInvesting: 300,
    };
    expect(formatLever(lever, masked)).toBe(
      'Household goal *** ends in Jun 2027; your investing rises by *** a month after.'
    );
  });
});

describe('monthsByYear', () => {
  it('splits the months after now by calendar year', () => {
    const counts = monthsByYear(new Date(2026, 10, 12), 15);
    expect(counts.get(2026)).toBe(1);
    expect(counts.get(2027)).toBe(12);
    expect(counts.get(2028)).toBe(2);
  });
});

describe('validateAssumptions', () => {
  const draft = { realReturn: '4', withdrawalRate: '3.5', targetYear: '2040' };

  it('parses valid values', () => {
    expect(validateAssumptions(draft, 2026).value).toEqual({
      realReturnPct: 4,
      withdrawalRatePct: 3.5,
      targetYear: 2040,
    });
  });

  it('treats blank as unset', () => {
    expect(
      validateAssumptions(
        { realReturn: '', withdrawalRate: ' ', targetYear: '' },
        2026
      ).value
    ).toEqual({
      realReturnPct: null,
      withdrawalRatePct: null,
      targetYear: null,
    });
  });

  it.each([
    [{ realReturn: '12.1' }, 'realReturn'],
    [{ realReturn: '-1' }, 'realReturn'],
    [{ withdrawalRate: '0.5' }, 'withdrawalRate'],
    [{ withdrawalRate: '10.5' }, 'withdrawalRate'],
    [{ targetYear: '2025' }, 'targetYear'],
    [{ targetYear: '2087' }, 'targetYear'],
    [{ targetYear: '2040.5' }, 'targetYear'],
    [{ realReturn: 'abc' }, 'realReturn'],
  ])('rejects %j', (patch, field) => {
    const result = validateAssumptions({ ...draft, ...patch }, 2026);
    expect(result.value).toBeNull();
    expect(result.errors).toHaveProperty(field);
  });
});
