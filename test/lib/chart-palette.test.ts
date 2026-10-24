import { CATEGORIES, CATEGORY_COLORS } from '@/features/assets/constants';
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_COLORS,
} from '@/features/expenses/constants';
import { chartColor, chartColors } from '@/lib/chart-palette';
import { describe, expect, it } from 'vitest';

describe('chart palette', () => {
  it('references theme tokens instead of literal colours', () => {
    expect(chartColor(3)).toBe('var(--cat-3)');
    expect(chartColors({ a: 1, b: 14 })).toEqual({
      a: 'var(--cat-1)',
      b: 'var(--cat-14)',
    });
  });

  it('gives every expense type and asset category its own slot', () => {
    const expense = EXPENSE_TYPES.map((t) => EXPENSE_TYPE_COLORS[t]);
    const asset = CATEGORIES.map((c) => CATEGORY_COLORS[c]);
    expect(new Set(expense).size).toBe(EXPENSE_TYPES.length);
    expect(new Set(asset).size).toBe(CATEGORIES.length);
  });
});
