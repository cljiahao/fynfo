import { upsertExpense } from '@/features/expenses/actions/expense-actions';
import { expenseDataSchema } from '@/features/expenses/schemas';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';
const context = vi.hoisted(() => ({ requireActionContext: vi.fn() }));
vi.mock('@/lib/action-guard', () => context);
const base = {
  id: 'synthetic-date',
  date: '2026-01-01',
  type: 'food_drink' as const,
  item: 'Synthetic meal',
  info: '',
  amount: 10,
  splitType: 'self' as const,
  splits: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  context.requireActionContext.mockResolvedValue({
    userId: 'synthetic-user',
    dek: Buffer.alloc(32, 3),
    supabase: makeFakeSupabase().client,
  });
});
it.each(['2025-02-29', '2026-02-30', '2026-04-31', '2026-02-30T12:00:00.000Z'])(
  'rejects impossible calendar date %s',
  (date) => {
    expect(expenseDataSchema.safeParse({ ...base, date }).success).toBe(false);
  }
);
it.each([
  '2024-02-29',
  '2026-02-28',
  '2026-04-30',
  '2026-04-30T12:00:00.000Z',
  '2026-04-30T12:00:00+08:00',
])('preserves supported valid date %s', (date) => {
  expect(expenseDataSchema.parse({ ...base, date }).date).toBe(date);
});
it('rejects an impossible expense date before requesting an encryption/database context', async () => {
  await expect(
    upsertExpense({ ...base, date: '2026-02-30' })
  ).rejects.toMatchObject({ code: 'VALIDATION' });
  expect(context.requireActionContext).not.toHaveBeenCalled();
});
