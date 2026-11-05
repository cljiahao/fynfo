import { monthsUntil } from '@/features/household/lib/goal-stats';
import {
  computeHouseholdCommitment,
  type CommitmentGoal,
  type CommitmentSplit,
} from '@/features/household/lib/household-commitment';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 10, 4);
const ME = 'me';
const PARTNER = 'partner';

const split = (
  mePct = 60,
  goalOverrides: CommitmentSplit['goalOverrides'] = {}
): CommitmentSplit => ({
  members: { [ME]: mePct, [PARTNER]: 100 - mePct },
  goalOverrides,
});

const goal = (
  over: Partial<CommitmentGoal> & { id: string }
): CommitmentGoal => ({
  remaining: 1000,
  targetDate: '2027-01-15',
  ...over,
});

const run = (
  goals: CommitmentGoal[],
  opts: {
    budgets?: number[];
    split?: CommitmentSplit;
    horizonMonths?: number;
  } = {}
) =>
  computeHouseholdCommitment({
    goals,
    budgets: opts.budgets ?? [],
    split: opts.split ?? split(),
    callerUserId: ME,
    horizonMonths: opts.horizonMonths ?? 24,
    now: NOW,
  });

describe('monthsUntil', () => {
  it('rounds partial months up and floors at 1', () => {
    expect(monthsUntil('2026-12-04', NOW)).toBe(1);
    expect(monthsUntil('2026-12-05', NOW)).toBe(2);
    expect(monthsUntil('2026-11-04', NOW)).toBe(1);
  });

  it('returns null once the date has passed', () => {
    expect(monthsUntil('2026-11-03', NOW)).toBeNull();
  });
});

describe('computeHouseholdCommitment', () => {
  it('puts a goal due exactly at the horizon in the reserve', () => {
    const r = run([goal({ id: 'g', targetDate: '2028-11-04' })]);
    expect(r.goals[0].bucket).toBe('reserve');
    expect(r.reserve).toBeCloseTo(600);
    expect(r.monthlyDeduction).toBe(0);
  });

  it('puts a goal inside the horizon in the reserve', () => {
    const r = run([goal({ id: 'g', targetDate: '2027-06-01' })]);
    expect(r.goals[0].bucket).toBe('reserve');
    expect(r.reserve).toBeCloseTo(600);
  });

  it('paces a goal one day beyond the horizon over its months left', () => {
    const r = run([goal({ id: 'g', targetDate: '2028-11-05' })]);
    expect(r.goals[0].bucket).toBe('pace');
    expect(r.reserve).toBe(0);
    expect(r.monthlyDeduction).toBeCloseTo(600 / 25);
  });

  it('reserves an overdue goal in full with no monthly spike', () => {
    const r = run([goal({ id: 'g', targetDate: '2026-09-01' })]);
    expect(r.goals[0].bucket).toBe('reserve');
    expect(r.reserve).toBeCloseTo(600);
    expect(r.monthlyDeduction).toBe(0);
  });

  it('counts each goal in exactly one bucket', () => {
    const r = run([
      goal({ id: 'a', targetDate: '2027-02-01', remaining: 1000 }),
      goal({ id: 'b', targetDate: '2031-02-01', remaining: 4800 }),
    ]);
    const a = r.goals.find((g) => g.goalId === 'a');
    const b = r.goals.find((g) => g.goalId === 'b');
    expect(a?.bucket).toBe('reserve');
    expect(b?.bucket).toBe('pace');
    expect(r.reserve).toBeCloseTo(600);
    expect(r.monthlyDeduction).toBeCloseTo(b?.amount ?? -1);
    expect(r.reserve + r.monthlyDeduction).toBeCloseTo(
      (a?.amount ?? 0) + (b?.amount ?? 0)
    );
  });

  it('excludes undated and funded goals with a reason', () => {
    const r = run([
      goal({ id: 'n', targetDate: null }),
      goal({ id: 'f', remaining: 0 }),
      goal({ id: 'neg', remaining: -50 }),
    ]);
    expect(r.reserve).toBe(0);
    expect(r.monthlyDeduction).toBe(0);
    expect(r.excluded).toEqual([
      { goalId: 'n', reason: 'no-date' },
      { goalId: 'f', reason: 'funded' },
      { goalId: 'neg', reason: 'funded' },
    ]);
    expect(r.goals.every((g) => g.bucket === 'excluded')).toBe(true);
  });

  it('applies a per-goal override, including 100 and 0', () => {
    const r = run(
      [goal({ id: 'all' }), goal({ id: 'none' }), goal({ id: 'dflt' })],
      {
        split: split(60, {
          all: { [ME]: 100, [PARTNER]: 0 },
          none: { [ME]: 0, [PARTNER]: 100 },
        }),
      }
    );
    expect(r.goals.map((g) => g.amount)).toEqual([1000, 0, 600]);
    expect(r.reserve).toBeCloseTo(1600);
  });

  it('uses the default split for budgets, never a goal override', () => {
    const r = run([goal({ id: 'g', targetDate: null })], {
      budgets: [200, 300],
      split: split(60, { g: { [ME]: 10, [PARTNER]: 90 } }),
    });
    expect(r.budgets).toEqual({
      monthlyTotal: 500,
      share: 0.6,
      monthlyShare: 300,
    });
    expect(r.monthlyDeduction).toBeCloseTo(300);
  });

  it('adds budget share on top of goal pace', () => {
    const r = run(
      [goal({ id: 'g', targetDate: '2031-11-04', remaining: 6000 })],
      {
        budgets: [100],
      }
    );
    expect(r.monthlyDeduction).toBeCloseTo((0.6 * 6000) / 60 + 60);
  });

  it('falls back to a 50/50 share when the caller is not in the split', () => {
    const r = run([goal({ id: 'g' })], {
      split: { members: { x: 70, y: 30 }, goalOverrides: {} },
    });
    expect(r.reserve).toBeCloseTo(500);
  });

  it('keeps money unrounded', () => {
    const r = run([goal({ id: 'g', remaining: 100 })], {
      split: split(33),
    });
    expect(r.reserve).toBeCloseTo(33);
    const r2 = run(
      [goal({ id: 'g', remaining: 100, targetDate: '2031-11-04' })],
      {
        split: split(33),
      }
    );
    expect(r2.monthlyDeduction).toBe((0.33 * 100) / 60);
  });
});
