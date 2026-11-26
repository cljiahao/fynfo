import {
  distributePct,
  goalMemberIds,
  goalPctsFor,
  parsePctMap,
  pctMapToText,
  pctRemainder,
  seedPctsFor,
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

  it('assigns leftover points the same way for any input order', () => {
    const expected = { a: 34, b: 33, c: 33 };
    expect(distributePct(['c', 'a', 'b'])).toEqual(expected);
    expect(distributePct(['b', 'c', 'a'])).toEqual(expected);
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

describe('parsePctMap', () => {
  it.each([1, 2, 3, 4])('accepts an even split of %i members', (count) => {
    const ids = IDS.slice(0, count);
    const text = pctMapToText(distributePct(ids), ids);
    const parsed = parsePctMap(text, ids);
    expect(parsed).not.toBeNull();
    expect(sum(parsed ?? {})).toBe(100);
  });

  it('rejects totals other than 100 and invalid entries', () => {
    expect(parsePctMap({ a: '60', b: '30' }, ['a', 'b'])).toBeNull();
    expect(parsePctMap({ a: '60', b: '50' }, ['a', 'b'])).toBeNull();
    expect(parsePctMap({ a: '50', b: '' }, ['a', 'b'])).toBeNull();
    expect(parsePctMap({ a: '12.5', b: '87.5' }, ['a', 'b'])).toBeNull();
  });
});

describe('pctRemainder', () => {
  it('shows what is left, negative when over', () => {
    expect(pctRemainder({ a: '30', b: '20', c: '' }, ['a', 'b', 'c'])).toBe(50);
    expect(pctRemainder({ a: '80', b: '40' }, ['a', 'b'])).toBe(-20);
  });
});

describe('seedPctsFor', () => {
  const split = (members: Record<string, number>, isDefault: boolean) =>
    ({
      members,
      goalOverrides: {},
      budgetOverrides: {},
      isDefault,
      userId: 'a',
    }) as PlannerSplit;

  it('uses the saved household default when it covers the goal members', () => {
    expect(seedPctsFor(split({ a: 70, b: 30 }, false), ['a', 'b'])).toEqual({
      a: 70,
      b: 30,
    });
  });

  it('falls back to an even share otherwise', () => {
    expect(seedPctsFor(split({ a: 70, b: 30 }, true), ['a', 'b'])).toEqual({
      a: 50,
      b: 50,
    });
    expect(seedPctsFor(split({ a: 70, b: 30 }, false), ['a'])).toEqual({
      a: 100,
    });
  });
});
