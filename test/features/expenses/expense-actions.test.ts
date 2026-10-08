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
      selectData: [
        {
          id: 'minimal',
          date: '2026-10-08',
          type: 'shopping',
          item: null,
          info: null,
          amount: await encryptPayload('12', DEK),
          split_type: 'self',
          splits: null,
        },
      ],
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
        splits: [
          {
            person: 'Alice',
            amount: await encryptPayload('20', DEK),
            settled: false,
          },
        ],
      },
    ];
    setSupabase({ selectData: rows });

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
  it('stops replacement when child deletion fails', async () => {
    const fake = setSupabase({
      upsertData: { id: 'snap-1' },
      selectError: { message: 'permission denied' },
    });
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(upsertExpense(validExpense)).rejects.toThrow(
      'expense splits delete failed'
    );
    expect(fake.calls.insert).toHaveLength(0);
  });
  it('does not delete children after a parent failure', async () => {
    const fake = setSupabase({ upsertError: { message: 'parent failed' } });
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(upsertExpense(validExpense)).rejects.toThrow();
    expect(fake.calls.delete).toBe(0);
    expect(fake.calls.insert).toHaveLength(0);
  });
  it('prepares child ciphertext before any replacement mutation', async () => {
    const fake = setSupabase({ upsertData: { id: 'snap-1' } });
    const encrypt = fieldCrypto.encryptPayload;
    vi.spyOn(fieldCrypto, 'encryptPayload').mockImplementation((text, dek) => {
      if (text === '20') throw new Error('child encryption failed');
      return encrypt(text, dek);
    });
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(upsertExpense(validExpense)).rejects.toThrow(
      'child encryption failed'
    );
    expect(fake.calls.delete).toBe(0);
    expect(fake.calls.upsert).toHaveLength(0);
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('encrypts sensitive fields and inserts encrypted splits with plaintext person', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await upsertExpense(validExpense);

    const row = fake.calls.upsert[0] as {
      item: string;
      info: string;
      amount: string;
      split_type: string;
    };
    expect(row.item).not.toBe('Dinner');
    expect(await decryptPayload(row.item, DEK)).toBe('Dinner');
    expect(await decryptPayload(row.amount, DEK)).toBe('40');
    expect(row.split_type).toBe('shared');
    expect(fake.calls.delete).toBe(1);

    const splits = fake.calls.insert[0] as Array<{
      person: string;
      amount: string;
    }>;
    expect(splits[0].person).toBe('Alice');
    expect(splits[0].amount).not.toBe('20');
    expect(await decryptPayload(splits[0].amount, DEK)).toBe('20');
  });

  it('rejects invalid input before any DB call', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    const invalid = { ...validExpense, amount: 0 };
    await expect(upsertExpense(invalid)).rejects.toThrow();
    expect(fake.calls.from).toHaveLength(0);
  });

  it('skips the splits insert for a self expense', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await upsertExpense({ ...validExpense, splitType: 'self', splits: [] });
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('surfaces an opaque error when the record upsert fails', async () => {
    setSupabase({ upsertError: { message: 'duplicate key value' } });
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(upsertExpense(validExpense)).rejects.toThrow(
      'expense upsert failed'
    );
  });

  it('surfaces an opaque error when the splits insert fails', async () => {
    setSupabase({ insertError: { message: 'value too long' } });
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    await expect(upsertExpense(validExpense)).rejects.toThrow(
      'expense splits insert failed'
    );
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
      selectData: [
        { splits: [{ person: 'Bob' }, { person: 'Alice' }] },
        { splits: [{ person: 'Alice' }] },
      ],
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
