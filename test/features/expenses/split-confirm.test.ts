import {
  applySplitSettlement,
  resolveSplitConfirm,
} from '@/features/expenses/lib/utils';
import type { ExpenseData } from '@/features/expenses/types';
import { describe, expect, it } from 'vitest';

const baseRow: ExpenseData = {
  id: 'exp_existing_1',
  date: '2026-06-01',
  type: 'food_drink',
  item: 'Dinner',
  info: '',
  amount: 40,
  splitType: 'shared',
  splits: [],
};

const newSplits = [
  { person: 'Alice', amount: 20, settled: false },
  { person: 'Bob', amount: 20, settled: false },
];

describe('resolveSplitConfirm', () => {
  it('persists split edits on an existing, valid row (regression: splits were lost on confirm)', () => {
    const { next, shouldSave } = resolveSplitConfirm(baseRow, false, newSplits);

    expect(shouldSave).toBe(true);
    expect(next.splits).toEqual(newSplits);
    expect(next.id).toBe('exp_existing_1');
  });

  it('stages but does not persist a new (unsaved) row — keeps the Enter/blur path', () => {
    const newRow: ExpenseData = { ...baseRow, id: '' };
    const { next, shouldSave } = resolveSplitConfirm(newRow, true, newSplits);

    expect(shouldSave).toBe(false);
    expect(next.splits).toEqual(newSplits);
    expect(next.id).not.toBe('');
  });

  it('does not persist an existing row that is still invalid (no positive amount)', () => {
    const invalid: ExpenseData = { ...baseRow, amount: 0 };
    const { shouldSave } = resolveSplitConfirm(invalid, false, newSplits);

    expect(shouldSave).toBe(false);
  });

  it('does not persist an existing row with no date', () => {
    const invalid: ExpenseData = { ...baseRow, date: '' };
    const { shouldSave } = resolveSplitConfirm(invalid, false, newSplits);

    expect(shouldSave).toBe(false);
  });
});

describe('applySplitSettlement', () => {
  const shared = (id: string): ExpenseData => ({
    ...baseRow,
    id,
    splits: [
      { person: 'Alice', amount: 20, settled: false },
      { person: 'Bob', amount: 20, settled: false },
    ],
  });

  it('flips settled only on the matched person within the matched ids', () => {
    const list = [shared('a'), shared('b')];
    const next = applySplitSettlement(list, ['a'], 'Alice', true);

    expect(next[0].splits).toEqual([
      { person: 'Alice', amount: 20, settled: true },
      { person: 'Bob', amount: 20, settled: false },
    ]);
    // 'b' untouched
    expect(next[1].splits).toEqual(list[1].splits);
  });

  it('settles a person across many ids (month case)', () => {
    const list = [shared('a'), shared('b'), shared('c')];
    const next = applySplitSettlement(list, ['a', 'c'], 'Bob', true);

    expect(next.map((e) => e.splits[1].settled)).toEqual([true, false, true]);
  });

  it('does not mutate the input list or rows', () => {
    const list = [shared('a')];
    const before = structuredClone(list);
    applySplitSettlement(list, ['a'], 'Alice', true);

    expect(list).toEqual(before);
  });
});
