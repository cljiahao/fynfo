import {
  distributePct,
  goalMemberIds,
  goalPctsFor,
  overrideFor,
} from '@/features/household/split-utils';
import type { PlannerSplit } from '@/features/household/types';
import { describe, expect, it } from 'vitest';

const IDS = ['a', 'b', 'c', 'd'];
const sum = (map: Record<string, number>) =>
  Object.values(map).reduce((total, pct) => total + pct, 0);

describe('distributePct', () => {
  it.each([1, 2, 3, 4])('sums to 100 for %i members', (count) => {
    const result = distributePct(IDS.slice(0, count));
    expect(Object.keys(result)).toHaveLength(count);
    expect(sum(result)).toBe(100);
  });

  it('gives leftover points to the earliest members', () => {
    expect(distributePct(['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 });
    expect(distributePct(['a', 'b', 'c', 'd'])).toEqual({
      a: 25,
      b: 25,
      c: 25,
      d: 25,
    });
  });

  it('keeps every share an integer', () => {
    for (const pct of Object.values(distributePct(IDS.slice(0, 3)))) {
      expect(Number.isInteger(pct)).toBe(true);
    }
  });

  it('distributes a partial total and ignores duplicate ids', () => {
    const result = distributePct(['a', 'b', 'b', 'c'], 70);
    expect(result).toEqual({ a: 24, b: 23, c: 23 });
    expect(sum(result)).toBe(70);
  });

  it('returns nothing without members', () => {
    expect(distributePct([])).toEqual({});
  });
});

describe('goalMemberIds', () => {
  it('uses the goal members when there are any', () => {
    expect(goalMemberIds(['a', 'b', 'c'], ['b'])).toEqual(['b']);
  });

  it('treats a goal without membership rows as the whole household', () => {
    expect(goalMemberIds(['a', 'b', 'c'], undefined)).toEqual(['a', 'b', 'c']);
    expect(goalMemberIds(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});

describe('goalPctsFor', () => {
  it('defaults to an even share across the goal members', () => {
    expect(goalPctsFor(undefined, ['a', 'b', 'c'])).toEqual({
      a: 34,
      b: 33,
      c: 33,
    });
  });

  it('prefers a stored override', () => {
    const override = { a: 70, b: 30 };
    expect(goalPctsFor(override, ['a', 'b', 'c'])).toBe(override);
  });
});

describe('overrideFor', () => {
  const split = (members: string[]): PlannerSplit => ({
    members: distributePct(members),
    goalOverrides: {},
    budgetOverrides: {},
    isDefault: true,
    userId: 'a',
  });

  it('is null when the caller has nobody to split with', () => {
    expect(overrideFor(split(['a']), 50)).toBeNull();
  });

  it('keeps the two-member shape', () => {
    expect(overrideFor(split(['a', 'b']), 30)).toEqual({ a: 30, b: 70 });
  });

  it.each([
    [3, 40],
    [4, 33],
    [4, 0],
    [3, 100],
  ])('sums to 100 for %i members at %i percent', (count, pct) => {
    const result = overrideFor(split(IDS.slice(0, count)), pct);
    expect(result).not.toBeNull();
    expect(result?.a).toBe(pct);
    expect(sum(result ?? {})).toBe(100);
  });

  it('spreads the remainder across the other members only', () => {
    expect(overrideFor(split(IDS.slice(0, 4)), 40)).toEqual({
      a: 40,
      b: 20,
      c: 20,
      d: 20,
    });
  });

  it('can cover just the goal members', () => {
    expect(overrideFor(split(IDS.slice(0, 4)), 50, ['a', 'c'])).toEqual({
      a: 50,
      c: 50,
    });
  });
});
