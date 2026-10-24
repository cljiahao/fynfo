import { beforeEach, describe, expect, it, vi } from 'vitest';

const reached = vi.hoisted(() => vi.fn());

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: reached,
  requireDbContext: reached,
  requireHouseholdContext: reached,
}));

const NOT_UUID = 'not-a-uuid';
const BAD_RECORD_ID = "x' or '1'='1";
const VALID_UUID = '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b';
const INVALID = /invalid input/;

type Case = [label: string, call: () => Promise<unknown>];

async function cases(): Promise<Case[]> {
  const equity = await import('@/features/equity/actions/equity-actions');
  const dividend = await import('@/features/equity/actions/dividend-actions');
  const expense = await import('@/features/expenses/actions/expense-actions');
  const salary = await import('@/features/salary/actions/salary-actions');
  const relief = await import('@/features/salary/actions/relief-actions');
  const spending =
    await import('@/features/household/actions/spending-actions');
  const goals = await import('@/features/household/actions/goal-actions');

  const trade = {
    date: '2026-01-01',
    broker: 'DBS',
    ticker: 'D05.SI',
    action: 'BUY',
    shares: 1,
    price: 1,
    fees: 0,
  } as never;
  const div = {
    ticker: 'D05.SI',
    amount: 1,
    currency: 'SGD',
    date: '2026-01-01',
  } as never;

  return [
    ['updateTrade', () => equity.updateTrade(BAD_RECORD_ID, trade)],
    ['deleteTrade', () => equity.deleteTrade(BAD_RECORD_ID)],
    ['updateDividend', () => dividend.updateDividend(BAD_RECORD_ID, div)],
    ['deleteDividend', () => dividend.deleteDividend(BAD_RECORD_ID)],
    ['deleteExpense', () => expense.deleteExpense(BAD_RECORD_ID)],
    ['settleSplit id', () => expense.settleSplit(BAD_RECORD_ID, 'Al', true)],
    ['settleSplit person', () => expense.settleSplit('e1', '', true)],
    [
      'settleMonthSplits empty',
      () => expense.settleMonthSplits([], 'Al', true),
    ],
    [
      'settleMonthSplits unbounded',
      () =>
        expense.settleMonthSplits(
          Array.from({ length: 2001 }, (_, i) => `e${i}`),
          'Al',
          true
        ),
    ],
    [
      'settleMonthSplits bad id',
      () => expense.settleMonthSplits(['ok', BAD_RECORD_ID], 'Al', true),
    ],
    ['getSalaryRecord', () => salary.getSalaryRecord('2026-13')],
    ['deleteSalaryRecord', () => salary.deleteSalaryRecord('abc')],
    ['getTaxReliefs', () => relief.getTaxReliefs(Number.NaN)],
    ['getTaxReliefs negative', () => relief.getTaxReliefs(-1)],
    ['deleteSpace', () => spending.deleteSpace(NOT_UUID)],
    ['deleteSpending', () => spending.deleteSpending(NOT_UUID)],
    ['deleteGoal', () => goals.deleteGoal(NOT_UUID)],
    ['deleteGoalItem', () => goals.deleteGoalItem(NOT_UUID)],
    ['deleteItemPayment', () => goals.deleteItemPayment(NOT_UUID)],
  ];
}

describe('server-action input boundary', () => {
  beforeEach(() => {
    reached.mockReset();
    reached.mockRejectedValue(new Error('guard reached'));
  });

  it('rejects malformed input before the auth guard or Supabase is reached', async () => {
    for (const [label, call] of await cases()) {
      await expect(call(), label).rejects.toThrow(INVALID);
    }
    expect(reached).not.toHaveBeenCalled();
  });

  it('lets well-formed ids through to the guard', async () => {
    const spending =
      await import('@/features/household/actions/spending-actions');
    const expense = await import('@/features/expenses/actions/expense-actions');
    await expect(spending.deleteSpace(VALID_UUID)).rejects.toThrow(
      'guard reached'
    );
    await expect(expense.deleteExpense('cm1x9legacyid')).rejects.toThrow(
      'guard reached'
    );
    expect(reached).toHaveBeenCalledTimes(2);
  });
});
