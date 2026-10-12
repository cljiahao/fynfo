import { expenseDataSchema } from '../schemas';
import type { ExpenseData } from '../types';
import { generateId } from './utils';

export function createReuseDraft(
  source: ExpenseData,
  today: string
): ExpenseData {
  const parsed = expenseDataSchema.parse(source);
  if (parsed.splitType !== 'self')
    throw new Error('Only self expenses can be reused');
  const freshId = generateId();
  return {
    id: freshId === source.id ? freshId + '_reuse' : freshId,
    date: today,
    type: source.type,
    item: source.item,
    info: source.info,
    amount: source.amount,
    splitType: 'self',
    splits: [],
  };
}

/** Compare saved values, allowing the server's calendar-date timestamp encoding. */
export function sameExpenseValues(a: ExpenseData, b: ExpenseData): boolean {
  return (
    a.id === b.id &&
    a.date.slice(0, 10) === b.date.slice(0, 10) &&
    a.type === b.type &&
    a.item === b.item &&
    a.info === b.info &&
    a.amount === b.amount &&
    a.splitType === b.splitType &&
    a.splits.length === b.splits.length &&
    a.splits.every((split, index) => {
      const other = b.splits[index];
      return (
        split.person === other.person &&
        split.amount === other.amount &&
        split.settled === other.settled
      );
    })
  );
}
