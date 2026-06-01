import type { ExpenseData } from '@/features/expenses/types';
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
  setSupabase();
});

describe('expense-actions — getExpenses', () => {
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
    expect(row.item).not.toBe('Dinner'); // ciphertext, not plaintext
    expect(await decryptPayload(row.item, DEK)).toBe('Dinner');
    expect(await decryptPayload(row.amount, DEK)).toBe('40');
    expect(row.split_type).toBe('shared');
    expect(fake.calls.delete).toBe(1); // stale splits cleared

    const splits = fake.calls.insert[0] as Array<{
      person: string;
      amount: string;
    }>;
    expect(splits[0].person).toBe('Alice'); // person is plaintext by design
    expect(splits[0].amount).not.toBe('20');
    expect(await decryptPayload(splits[0].amount, DEK)).toBe('20');
  });

  it('rejects invalid input before any DB call', async () => {
    const fake = setSupabase();
    const { upsertExpense } =
      await import('@/features/expenses/actions/expense-actions');
    const invalid = { ...validExpense, amount: 0 }; // amount must be positive
    await expect(upsertExpense(invalid)).rejects.toThrow();
    expect(fake.calls.from).toHaveLength(0);
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
});
