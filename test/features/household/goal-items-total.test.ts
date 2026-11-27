import { itemsTotal } from '@/features/household/lib/goal-items-total';
import type { GoalItem } from '@/features/household/types';
import { describe, expect, it } from 'vitest';

const item = (budget: number, quote: number | null): GoalItem => ({
  id: 'i',
  name: 'Item',
  budget,
  quote,
  dueDate: null,
  description: null,
  payments: [],
  paid: 0,
  remaining: budget,
  over: 0,
});

describe('itemsTotal', () => {
  it('is zero without items', () => {
    expect(itemsTotal([])).toBe(0);
  });

  it('prefers the quote over the estimate per item', () => {
    expect(itemsTotal([item(100, null), item(50, 40), item(10, 25)])).toBe(165);
  });
});
