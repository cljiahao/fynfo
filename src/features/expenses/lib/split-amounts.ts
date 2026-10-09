import type { ExpenseSplitData } from '../types';

function validCents(amount: number) {
  return (
    Number.isFinite(amount) &&
    amount >= 0 &&
    Number.isSafeInteger(Math.round(amount * 100))
  );
}

export function getSplitAllocationError(
  totalAmount: number,
  splits: Pick<ExpenseSplitData, 'amount'>[]
): string | null {
  if (!validCents(totalAmount) || totalAmount <= 0) {
    return 'Enter a valid positive expense total.';
  }
  if (splits.some((split) => !validCents(split.amount))) {
    return 'Enter valid, nonnegative shares.';
  }
  const allocated = splits.reduce(
    (sum, split) => sum + Math.round(split.amount * 100),
    0
  );
  if (
    !Number.isSafeInteger(allocated) ||
    allocated > Math.round(totalAmount * 100)
  ) {
    return 'Shares exceed the expense total. Reduce a share or update the bill.';
  }
  return null;
}

export function allocateEvenSplits(
  totalAmount: number,
  splits: ExpenseSplitData[],
  paidFor: boolean
): ExpenseSplitData[] {
  const count = paidFor ? splits.length : splits.length + 1;
  const cents = validCents(totalAmount) ? Math.round(totalAmount * 100) : 0;
  if (count === 0) return [];
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  // Assign extra cents in list order; the owner's share comes last.
  return splits.map((split, index) => ({
    ...split,
    amount: (base + (index < remainder ? 1 : 0)) / 100,
  }));
}
