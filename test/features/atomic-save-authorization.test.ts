import { beforeEach, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../helpers/fake-supabase';

const state = vi.hoisted(() => ({
  authenticated: true,
  unlocked: true,
  order: [] as string[],
}));
let fake = makeFakeSupabase();
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({
    ...fake.client,
    auth: {
      getUser: async () => {
        state.order.push('identity');
        return {
          data: {
            user: state.authenticated ? { id: 'synthetic-owner' } : null,
          },
          error: null,
        };
      },
    },
  }),
}));
vi.mock('@/lib/keystore', () => ({
  getVaultDekSession: async () => {
    state.order.push('vault');
    return state.unlocked ? Buffer.alloc(32, 5) : null;
  },
}));
vi.mock('@/lib/household-keystore', () => ({ getHouseholdKhSession: vi.fn() }));
beforeEach(() => {
  fake = makeFakeSupabase();
  state.authenticated = true;
  state.unlocked = true;
  state.order = [];
});

const saves = [
  {
    name: 'snapshot',
    save: async () => {
      const { upsertSnapshot } =
        await import('@/features/assets/actions/snapshot-actions');
      return upsertSnapshot({ id: '2026-10', entries: [] });
    },
  },
  {
    name: 'expense',
    save: async () => {
      const { upsertExpense } =
        await import('@/features/expenses/actions/expense-actions');
      return upsertExpense({
        id: 'fixture',
        date: '2026-10-09',
        type: 'other',
        item: 'fixture',
        info: '',
        amount: 10,
        splitType: 'self',
        splits: [],
      });
    },
  },
  {
    name: 'relief',
    save: async () => {
      const { upsertTaxReliefs } =
        await import('@/features/salary/actions/relief-actions');
      return upsertTaxReliefs(2026, []);
    },
  },
];
it.each(saves)(
  '$name denies anonymous saves before key or database access',
  async ({ save }) => {
    state.authenticated = false;
    await expect(save()).rejects.toThrow('Unauthorized');
    expect(state.order).toEqual(['identity']);
    expect(fake.calls.rpc).toEqual([]);
    expect(fake.calls.from).toEqual([]);
  }
);
it.each(saves)(
  '$name denies a locked vault before database access',
  async ({ save }) => {
    state.unlocked = false;
    await expect(save()).rejects.toThrow('Vault is locked');
    expect(state.order).toEqual(['identity', 'vault']);
    expect(fake.calls.rpc).toEqual([]);
    expect(fake.calls.from).toEqual([]);
  }
);
it.each(saves)(
  '$name verifies identity then key before its RPC',
  async ({ save }) => {
    await save();
    expect(state.order).toEqual(['identity', 'vault']);
    expect(fake.calls.rpc).toHaveLength(1);
    expect(fake.calls.from).toEqual([]);
  }
);
