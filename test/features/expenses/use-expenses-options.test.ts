import {
  buildDeleteMutationOptions,
  buildSettleMonthMutationOptions,
  buildSettleSplitMutationOptions,
  buildUpsertMutationOptions,
} from '@/features/expenses/hooks/use-expenses';
import type { ExpenseData } from '@/features/expenses/types';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const EXPENSE_KEY = ['expenses'];
const PEOPLE_KEY = ['expense-people'];

const row = (id: string, amount: number): ExpenseData => ({
  id,
  date: '2026-06-01',
  type: 'food_drink',
  item: id,
  info: '',
  amount,
  splitType: 'self',
  splits: [],
});

const shared = (id: string): ExpenseData => ({
  ...row(id, 40),
  splitType: 'shared',
  splits: [{ person: 'Alice', amount: 20, settled: false }],
});

describe('buildUpsertMutationOptions', () => {
  it('does NOT refetch the expense list on settle (regression: full re-decrypt per add)', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);

    const opts = buildUpsertMutationOptions(qc);
    await opts.onSettled();

    const invalidatedKeys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(PEOPLE_KEY);
    expect(invalidatedKeys).not.toContainEqual(EXPENSE_KEY);
  });

  it('optimistically inserts a new row into the cache on mutate', async () => {
    const qc = new QueryClient();
    qc.setQueryData(EXPENSE_KEY, [row('a', 10)]);

    const opts = buildUpsertMutationOptions(qc);
    const ctx = await opts.onMutate(row('b', 20));

    const cached = qc.getQueryData<ExpenseData[]>(EXPENSE_KEY);
    expect(cached?.map((e) => e.id)).toEqual(['b', 'a']);
    expect(ctx?.patches.map((e) => e.id)).toEqual(['b']);
  });

  it('rolls the affected row back on error', async () => {
    const qc = new QueryClient();
    const previous = [row('a', 10)];
    qc.setQueryData(EXPENSE_KEY, previous);

    const opts = buildUpsertMutationOptions(qc);
    const context = await opts.onMutate(row('b', 20));
    opts.onError(new Error('boom'), row('b', 20), context);

    expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)).toEqual(previous);
  });
});

describe('buildDeleteMutationOptions', () => {
  it('optimistically removes the row and refreshes only PEOPLE_KEY (no expense re-decrypt)', async () => {
    const qc = new QueryClient();
    qc.setQueryData(EXPENSE_KEY, [row('a', 10), row('b', 20)]);
    const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);

    const opts = buildDeleteMutationOptions(qc);
    const ctx = await opts.onMutate('a');
    await opts.onSettled();

    expect(
      qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.map((e) => e.id)
    ).toEqual(['b']);
    expect(ctx?.patches.map((e) => e.before?.id)).toEqual(['a']);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toContainEqual(PEOPLE_KEY);
    expect(keys).not.toContainEqual(EXPENSE_KEY);
  });

  it('rolls back the deleted row on error', async () => {
    const qc = new QueryClient();
    const previous = [row('a', 10)];
    qc.setQueryData(EXPENSE_KEY, previous);

    const opts = buildDeleteMutationOptions(qc);
    const context = await opts.onMutate('a');
    opts.onError(new Error('x'), 'a', context);

    expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)).toEqual(previous);
  });
});

describe('settle mutation options', () => {
  it('optimistically flips settled and never invalidates (split + month)', async () => {
    for (const build of [
      buildSettleSplitMutationOptions,
      buildSettleMonthMutationOptions,
    ]) {
      const qc = new QueryClient();
      qc.setQueryData(EXPENSE_KEY, [shared('a'), shared('b')]);
      const spy = vi
        .spyOn(qc, 'invalidateQueries')
        .mockResolvedValue(undefined);

      const opts = build(qc);
      await opts.onMutate({
        expenseIds: ['a'],
        person: 'Alice',
        settled: true,
      });

      const cached = qc.getQueryData<ExpenseData[]>(EXPENSE_KEY);
      expect(cached?.[0].splits[0].settled).toBe(true);
      expect(cached?.[1].splits[0].settled).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('rolls back the settle on error', async () => {
    const qc = new QueryClient();
    const previous = [shared('a')];
    qc.setQueryData(EXPENSE_KEY, previous);
    const opts = buildSettleSplitMutationOptions(qc);
    const vars = { expenseIds: ['a'], person: 'Alice', settled: true };
    const context = await opts.onMutate(vars);

    opts.onError(
      new Error('x'),
      { expenseIds: ['a'], person: 'Alice', settled: true },
      context
    );

    expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)).toEqual(previous);
  });
});
