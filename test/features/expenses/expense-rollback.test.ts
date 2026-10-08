import {
  buildDeleteMutationOptions,
  buildSettleMonthMutationOptions,
  buildUpsertMutationOptions,
  EXPENSE_KEY,
} from '@/features/expenses/hooks/use-expenses';
import type { ExpenseData } from '@/features/expenses/types';
import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const row = (id: string, amount = 10): ExpenseData => ({
  id,
  amount,
  date: '2026-01-01',
  type: 'food_drink',
  item: id,
  info: '',
  splitType: 'shared',
  splits: [{ person: 'A', amount: 5, settled: false }],
});
it('failed insert preserves a later successful unrelated insert', async () => {
  const qc = new QueryClient();
  qc.setQueryData(EXPENSE_KEY, [row('base')]);
  const opts = buildUpsertMutationOptions(qc);
  const failed = await opts.onMutate(row('failed'));
  await opts.onMutate(row('success'));
  opts.onError(new Error(), row('failed'), failed);
  expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.map((x) => x.id)).toEqual(
    ['success', 'base']
  );
});
it('failed earlier update preserves newer successful update to same row', async () => {
  const qc = new QueryClient();
  qc.setQueryData(EXPENSE_KEY, [row('a')]);
  const opts = buildUpsertMutationOptions(qc);
  const failed = await opts.onMutate(row('a', 20));
  await opts.onMutate(row('a', 30));
  opts.onError(new Error(), row('a', 20), failed);
  expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.[0].amount).toBe(30);
});
it('rollbacks cannot resurrect cache cleared at lock or affect replacement query', async () => {
  const qc = new QueryClient();
  qc.setQueryData(EXPENSE_KEY, [row('a')]);
  const opts = buildUpsertMutationOptions(qc);
  const context = await opts.onMutate(row('b'));
  qc.clear();
  opts.onError(new Error(), row('b'), context);
  expect(qc.getQueryData(EXPENSE_KEY)).toBeUndefined();
  qc.setQueryData(EXPENSE_KEY, [row('new-session')]);
  opts.onError(new Error(), row('b'), context);
  expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.map((x) => x.id)).toEqual(
    ['new-session']
  );
});
it('failed initially uncached insert removes its optimistic row', async () => {
  const qc = new QueryClient();
  const opts = buildUpsertMutationOptions(qc);
  const context = await opts.onMutate(row('failed'));
  opts.onError(new Error(), row('failed'), context);
  expect(qc.getQueryData(EXPENSE_KEY)).toEqual([]);
});
it('failed deletion preserves unrelated edits', async () => {
  const qc = new QueryClient();
  qc.setQueryData(EXPENSE_KEY, [row('a'), row('b')]);
  const remove = buildDeleteMutationOptions(qc);
  const context = await remove.onMutate('a');
  await buildUpsertMutationOptions(qc).onMutate(row('b', 50));
  remove.onError(new Error(), 'a', context);
  expect(
    qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.find((x) => x.id === 'b')
      ?.amount
  ).toBe(50);
  expect(
    qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.some((x) => x.id === 'a')
  ).toBe(true);
});
it('failed settlement preserves unrelated edits', async () => {
  const qc = new QueryClient();
  qc.setQueryData(EXPENSE_KEY, [row('a'), row('b')]);
  const opts = buildSettleMonthMutationOptions(qc);
  const vars = { expenseIds: ['a'], person: 'A', settled: true };
  const context = await opts.onMutate(vars);
  await buildUpsertMutationOptions(qc).onMutate(row('b', 60));
  opts.onError(new Error(), vars, context);
  expect(
    qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.find((x) => x.id === 'a')
      ?.splits[0].settled
  ).toBe(false);
  expect(
    qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.find((x) => x.id === 'b')
      ?.amount
  ).toBe(60);
});

it('multiple failed edits to the same row unwind to server value', async () => {
  const qc = new QueryClient();
  qc.setQueryData(EXPENSE_KEY, [row('a', 10)]);
  const opts = buildUpsertMutationOptions(qc);
  const first = await opts.onMutate(row('a', 20));
  const second = await opts.onMutate(row('a', 30));
  opts.onError(new Error(), row('a', 30), second);
  opts.onError(new Error(), row('a', 20), first);
  expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.[0].amount).toBe(10);
});
it('a removed query while cancel is pending cannot be recreated by optimistic write', async () => {
  const qc = new QueryClient();
  let resolveCancel: () => void = () => {};
  vi.spyOn(qc, 'cancelQueries').mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveCancel = resolve;
      })
  );
  const opts = buildUpsertMutationOptions(qc);
  const pending = opts.onMutate(row('a'));
  qc.clear();
  resolveCancel();
  await pending;
  expect(qc.getQueryData(EXPENSE_KEY)).toBeUndefined();
});

it('failed same-row edits unwind correctly when the older rejection arrives first', async () => {
  const qc = new QueryClient();
  qc.setQueryData(EXPENSE_KEY, [row('a', 10)]);
  const opts = buildUpsertMutationOptions(qc);
  const first = await opts.onMutate(row('a', 20));
  const second = await opts.onMutate(row('a', 30));
  opts.onError(new Error(), row('a', 20), first);
  opts.onError(new Error(), row('a', 30), second);
  expect(qc.getQueryData<ExpenseData[]>(EXPENSE_KEY)?.[0].amount).toBe(10);
});
