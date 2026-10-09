import type { ExpenseData } from '@/features/expenses/types';
import * as fieldCrypto from '@/lib/crypto';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 3);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: USER_ID, dek: DEK, supabase }),
  requireDbContext: async () => ({ userId: USER_ID, supabase }),
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

const validExpense: ExpenseData = {
  id: 'exp1',
  date: '2026-06-01',
  type: 'food_drink',
  item: 'Dinner',
  info: 'team',
  amount: 40,
  splitType: 'shared',
  splits: [{ person: 'Alice', amount: 20, settled: false }],
};

beforeEach(() => {
  vi.restoreAllMocks();
  setSupabase();
});

describe('expense-actions — getExpenses', () => {
  it('returns no expenses for null data and defaults missing optional fields and splits', async () => {
    const { getExpenses } =
      await import('@/features/expenses/actions/expense-actions');
    setSupabase({ selectData: null });
    expect(await getExpenses()).toEqual([]);
    setSupabase({
      selectDataByTable: {
        expense_records: [
          {
            id: 'minimal',
            date: '2026-10-08',
            type: 'shopping',
            item: null,
            info: null,
            amount: await encryptPayload('12', DEK),
            split_type: 'self',
          },
        ],
        expense_splits: [],
      },
    });
    expect(await getExpenses()).toEqual([
      {
        id: 'minimal',
        date: '2026-10-08',
        type: 'shopping',
        item: '',
        info: '',
        amount: 12,
        splitType: 'self',
        splits: [],
      },
    ]);
  });
  it('decrypts records and their splits', async () => {
    const rows = [
      {
        id: 'exp1',
        date: '2026-06-01',
        type: 'food_drink',
        item: await encryptPayload('Dinner', DEK),
        info: await encryptPayload('team', DEK),
        amount: await encryptPayload('40', DEK),
        split_type: 'shared',
      },
    ];
    setSupabase({
      selectDataByTable: {
        expense_records: rows,
        expense_splits: [
          {
            expense_id: 'exp1',
            person: 'Alice',
            amount: await encryptPayload('20', DEK),
            settled: false,
          },
        ],
      },
    });

    const { getExpenses } =
      await import('@/features/expenses/actions/expense-actions');
    const result = await getExpenses();

    expect(result).toEqual([
      {
        id: 'exp1',
        date: '2026-06-01',
        type: 'food_drink',
        item: 'Dinner',
        info: 'team',
        amount: 40,
        splitType: 'shared',
        splits: [{ person: 'Alice', amount: 20, settled: false }],
      },
    ]);
  });

  it('throws an opaque AppError on a DB error (no DB text leaked)', async () => {
    setSupabase({ selectError: { message: 'relation "x" missing' } });
    const { getExpenses } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(getExpenses()).rejects.toThrow('expense read failed');
  });
});

describe('expense-actions — upsertExpense', () => {
  it('rejects combined shares above the bill before any database call', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(
      upsertExpense({
        ...validExpense,
        amount: 10.01,
        splits: [
          { person: 'Alex', amount: 5.01, settled: true },
          { person: 'Sam', amount: 5.01, settled: false },
        ],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.from).toHaveLength(0);
  });
  it('prepares all ciphertext before any database access', async () => {
    const fake = setSupabase();
    const encrypt = fieldCrypto.encryptPayload;
    vi.spyOn(fieldCrypto, 'encryptPayload').mockImplementation((text, key) => {
      if (text === '20') throw new Error('child encryption failed');
      return encrypt(text, key);
    });
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(upsertExpense(validExpense)).rejects.toThrow(
      'child encryption failed'
    );
    expect(fake.calls.rpc).toEqual([]);
    expect(fake.calls.from).toEqual([]);
  });
  it('encrypts fields and splits in one RPC without owner or child parent fields', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await upsertExpense(validExpense);
    expect(fake.calls.from).toEqual([]);
    expect(fake.calls.rpc).toHaveLength(1);
    const { name } = fake.calls.rpc[0];
    const args = fake.calls.rpc[0].args as Record<string, unknown>;
    expect(name).toBe('replace_expense_record');
    const row = args.p_record as Record<string, string>;
    expect(row.id).toBe('exp1');
    expect(row.date).toBe('2026-06-01T00:00:00.000Z');
    expect(row).not.toHaveProperty('user_id');
    expect(await decryptPayload(row.item, DEK)).toBe('Dinner');
    expect(await decryptPayload(row.info, DEK)).toBe('team');
    expect(await decryptPayload(row.amount, DEK)).toBe('40');
    expect(row.split_type).toBe('shared');
    const splits = args.p_splits as Array<Record<string, unknown>>;
    expect(splits[0]).not.toHaveProperty('expense_id');
    expect(splits[0].person).toBe('Alice');
    expect(splits[0].settled).toBe(false);
    expect(await decryptPayload(splits[0].amount as string, DEK)).toBe('20');
  });
  it('rejects invalid input before database access', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(
      upsertExpense({ ...validExpense, amount: 0 })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.rpc).toEqual([]);
    expect(fake.calls.from).toEqual([]);
  });
  it('clears stale splits for a self expense', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await upsertExpense({ ...validExpense, amount: 10, splitType: 'self' });
    expect(
      (fake.calls.rpc[0].args as Record<string, unknown>).p_splits
    ).toEqual([]);
  });
  it('fails closed with an opaque RPC error', async () => {
    const fake = setSupabase({
      rpcError: {
        replace_expense_record: { message: 'private constraint details' },
      },
    });
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(upsertExpense(validExpense)).rejects.toThrow(
      'expense save failed'
    );
    expect(fake.calls.from).toEqual([]);
  });
});

describe('expense-actions — deleteExpense', () => {
  it('issues a scoped delete on expense_records', async () => {
    const fake = setSupabase();
    const { deleteExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await deleteExpense('exp1');
    expect(fake.calls.from).toContain('expense_records');
    expect(fake.calls.delete).toBe(1);
    expect(
      fake.calls.queries.find(
        (query) =>
          query.table === 'expense_records' && query.operation === 'delete'
      )?.eq
    ).toEqual([
      { column: 'id', value: 'exp1' },
      { column: 'user_id', value: USER_ID },
    ]);
  });

  it('surfaces an opaque error on a delete failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { deleteExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(deleteExpense('exp1')).rejects.toThrow(
      'expense delete failed'
    );
  });
});

describe('expense-actions — settleSplit', () => {
  it('updates the settled flag for one person on one expense', async () => {
    const fake = setSupabase();
    const { settleSplit } =
      await import('@/features/expenses/actions/expense-actions');
    await settleSplit('exp1', 'Alice', true);
    expect(
      fake.calls.queries.find((query) => query.operation === 'update')?.eq
    ).toEqual([
      { column: 'expense_id', value: 'exp1' },
      { column: 'person', value: 'Alice' },
    ]);
    expect(fake.calls.from).toContain('expense_splits');
    expect(fake.calls.update[0]).toEqual({ settled: true });
  });

  it('surfaces an opaque error on failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { settleSplit } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(settleSplit('exp1', 'Alice', true)).rejects.toThrow(
      'expense settle split failed'
    );
  });
});

describe('expense-actions — settleMonthSplits', () => {
  it('updates the settled flag across many expenses for one person', async () => {
    const fake = setSupabase();
    const { settleMonthSplits } =
      await import('@/features/expenses/actions/expense-actions');
    await settleMonthSplits(['exp1', 'exp2'], 'Alice', true);
    expect(
      fake.calls.queries.find((query) => query.operation === 'update')
    ).toMatchObject({
      eq: [{ column: 'person', value: 'Alice' }],
      in: [{ column: 'expense_id', values: ['exp1', 'exp2'] }],
    });
    expect(fake.calls.update[0]).toEqual({ settled: true });
  });

  it('surfaces an opaque error on failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { settleMonthSplits } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(settleMonthSplits(['exp1'], 'Alice', false)).rejects.toThrow(
      'expense settle month failed'
    );
  });
});

describe('expense-actions — getDistinctPeople', () => {
  it('dedupes and sorts split persons', async () => {
    setSupabase({
      selectDataByTable: {
        expense_splits: [
          { person: 'Bob' },
          { person: 'Alice' },
          { person: 'Alice' },
          { person: '' },
        ],
      },
    });
    const { getDistinctPeople } =
      await import('@/features/expenses/actions/expense-actions');
    expect(await getDistinctPeople()).toEqual(['Alice', 'Bob']);
  });

  it('surfaces an opaque error on a read failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { getDistinctPeople } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(getDistinctPeople()).rejects.toThrow('people read failed');
  });
});
