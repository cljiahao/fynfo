import { monthsUntil } from '@/features/household/lib/goal-stats';
import {
  budgetShare,
  defaultShare,
  goalShare,
  type CommitmentSplit,
} from '@/features/household/lib/household-commitment';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 10, 4);

const split: CommitmentSplit = {
  members: { me: 60, partner: 40 },
  goalOverrides: { g1: { me: 25 } },
  budgetOverrides: { b1: { me: 80 } },
};

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

describe('split shares', () => {
  it('uses the member default, falling back to 50%', () => {
    expect(defaultShare(split, 'me')).toBeCloseTo(0.6);
    expect(defaultShare(split, 'stranger')).toBe(0.5);
  });

  it('prefers a goal or budget override over the default', () => {
    expect(goalShare(split, 'g1', 'me')).toBeCloseTo(0.25);
    expect(goalShare(split, 'other', 'me')).toBeCloseTo(0.6);
    expect(budgetShare(split, 'b1', 'me')).toBeCloseTo(0.8);
    expect(budgetShare(split, 'other', 'me')).toBeCloseTo(0.6);
  });
});
