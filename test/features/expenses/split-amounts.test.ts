import {
  allocateEvenSplits,
  getSplitAllocationError,
} from '@/features/expenses/lib/split-amounts';
import { describe, expect, it } from 'vitest';

const people = [
  { person: 'Alex', amount: 0, settled: true },
  { person: 'Sam', amount: 0, settled: false },
  { person: 'Robin', amount: 0, settled: false },
];

describe('expense allocation in whole cents', () => {
  it.each([0.01, 0.02, 10, 10.01, 10.02, 100.99])(
    'paid-for shares add to the complete bill of %s',
    (bill) => {
      const result = allocateEvenSplits(bill, people, true);
      const cents = result.map((split) => Math.round(split.amount * 100));
      expect(cents.reduce((sum, share) => sum + share, 0)).toBe(
        Math.round(bill * 100)
      );
      expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1);
      expect(
        result.map(({ person, settled }) => ({ person, settled }))
      ).toEqual(people.map(({ person, settled }) => ({ person, settled })));
      expect(getSplitAllocationError(bill, result)).toBeNull();
    }
  );

  it('includes the owner as the last equal share', () => {
    expect(
      allocateEvenSplits(10, people.slice(0, 2), false).map(
        (split) => split.amount
      )
    ).toEqual([3.34, 3.33]);
    expect(
      allocateEvenSplits(0.01, people, false).map((split) => split.amount)
    ).toEqual([0.01, 0, 0]);
  });

  it('handles empty lists and invalid draft totals without inventing shares', () => {
    expect(allocateEvenSplits(10, [], true)).toEqual([]);
    expect(allocateEvenSplits(10, [], false)).toEqual([]);
    expect(
      allocateEvenSplits(Number.NaN, people, true).every(
        (split) => split.amount === 0
      )
    ).toBe(true);
  });

  it('accepts manual remainders and floating-point sums at cent precision', () => {
    expect(getSplitAllocationError(10, [{ amount: 3 }])).toBeNull();
    expect(
      getSplitAllocationError(0.3, [{ amount: 0.1 }, { amount: 0.2 }])
    ).toBeNull();
    expect(getSplitAllocationError(10, [])).toBeNull();
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER,
  ])('rejects invalid total %s', (total) => {
    expect(getSplitAllocationError(total, [])).toMatch(
      /positive expense total/
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
    'rejects invalid share %s',
    (amount) => {
      expect(getSplitAllocationError(10, [{ amount }])).toMatch(
        /nonnegative shares/
      );
    }
  );

  it('rejects unsafe accumulated cents even when individual amounts are safe', () => {
    const amount = Math.floor(Number.MAX_SAFE_INTEGER / 100);
    expect(getSplitAllocationError(amount, [{ amount }, { amount }])).toMatch(
      /exceed/
    );
  });
});
