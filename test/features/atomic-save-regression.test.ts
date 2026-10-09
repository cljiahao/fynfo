import { beforeEach, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../helpers/fake-supabase';

let fake = makeFakeSupabase({ upsertData: { id: 'synthetic-parent' } });
vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({
    userId: 'synthetic-owner',
    dek: Buffer.alloc(32, 5),
    supabase: fake.client,
  }),
}));
beforeEach(() => {
  fake = makeFakeSupabase({ upsertData: { id: 'synthetic-parent' } });
});

it('saves a snapshot using one atomic RPC and no direct table writes', async () => {
  const { upsertSnapshot } =
    await import('@/features/assets/actions/snapshot-actions');
  await upsertSnapshot({
    id: '2026-10',
    entries: [{ category: 'savings', account: 'Synthetic', amount: 10 }],
  });
  expect(fake.calls.rpc.map((call) => call.name)).toEqual([
    'replace_asset_snapshot_if_current',
  ]);
  expect(fake.calls.from).toEqual([]);
});

it('saves an expense and its splits using one atomic RPC', async () => {
  const { upsertExpense } =
    await import('@/features/expenses/actions/expense-actions');
  await upsertExpense({
    id: 'synthetic-expense',
    date: '2026-10-09',
    type: 'food_drink',
    item: 'Synthetic',
    info: '',
    amount: 10,
    splitType: 'shared',
    splits: [{ person: 'Synthetic friend', amount: 5, settled: false }],
  });
  expect(fake.calls.rpc.map((call) => call.name)).toEqual([
    'replace_expense_record',
  ]);
  expect(fake.calls.from).toEqual([]);
});

it('replaces a relief year using one atomic RPC, including an empty replacement', async () => {
  const { upsertTaxReliefs } =
    await import('@/features/salary/actions/relief-actions');
  await upsertTaxReliefs(2026, []);
  expect(fake.calls.rpc).toEqual([
    { name: 'replace_tax_relief_year', args: { p_year: 2026, p_reliefs: [] } },
  ]);
  expect(fake.calls.from).toEqual([]);
});
