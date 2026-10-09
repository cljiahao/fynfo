import { deleteSnapshot } from '@/features/assets/actions/snapshot-actions';
import { deleteDividend } from '@/features/equity/actions/dividend-actions';
import { deleteTrade } from '@/features/equity/actions/equity-actions';
import {
  deleteExpense,
  getDistinctPeople,
  settleMonthSplits,
  settleSplit,
} from '@/features/expenses/actions/expense-actions';
import { deleteGoal } from '@/features/household/actions/goal-actions';
import { deleteSalaryRecord } from '@/features/salary/actions/salary-actions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../helpers/fake-supabase';

const boundary = vi.hoisted(() => ({
  user: vi.fn(),
  personalKey: vi.fn(),
  householdKey: vi.fn(),
  server: vi.fn(),
}));
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: boundary.server,
}));
vi.mock('@/lib/keystore', () => ({ getVaultDekSession: boundary.personalKey }));
vi.mock('@/lib/household-keystore', () => ({
  getHouseholdKhSession: boundary.householdKey,
}));
let fake: ReturnType<typeof makeFakeSupabase>;
beforeEach(() => {
  vi.resetAllMocks();
  fake = makeFakeSupabase();
  boundary.user.mockResolvedValue({
    data: { user: { id: 'authenticated-user' } },
    error: null,
  });
  boundary.personalKey.mockResolvedValue(null);
  boundary.householdKey.mockResolvedValue(null);
  boundary.server.mockResolvedValue({
    ...fake.client,
    auth: { getUser: boundary.user },
  });
});

describe('authenticated financial actions still require an unlocked key session', () => {
  it.each([
    [
      'snapshot delete',
      () => deleteSnapshot('2026-10', { snapshotId: 'fixture', revision: '1' }),
    ],
    ['salary delete', () => deleteSalaryRecord('2026-10')],
    ['trade delete', () => deleteTrade('trade-fixture')],
    ['dividend delete', () => deleteDividend('dividend-fixture')],
    ['expense delete', () => deleteExpense('expense-fixture')],
    ['split settlement', () => settleSplit('expense-fixture', 'Partner', true)],
    [
      'month settlement',
      () => settleMonthSplits(['expense-fixture'], 'Partner', true),
    ],
    ['people suggestion read', () => getDistinctPeople()],
  ] as const)(
    '%s rejects without the personal vault before any financial DB access',
    async (_name, operation) => {
      await expect(operation()).rejects.toThrow('Vault is locked');
      expect(boundary.user).toHaveBeenCalledTimes(1);
      expect(boundary.personalKey).toHaveBeenCalledTimes(1);
      expect(fake.calls.from).toEqual([]);
      expect(fake.calls.rpc).toEqual([]);
    }
  );
  it('household goal deletion requires the household key even with a valid personal key', async () => {
    boundary.personalKey.mockResolvedValue(Buffer.alloc(32, 1));
    await expect(deleteGoal('goal-fixture')).rejects.toThrow(
      'Household is locked'
    );
    expect(boundary.user).toHaveBeenCalledTimes(1);
    expect(boundary.householdKey).toHaveBeenCalledTimes(1);
    expect(fake.calls.from).toEqual([]);
    expect(fake.calls.rpc).toEqual([]);
  });
});
