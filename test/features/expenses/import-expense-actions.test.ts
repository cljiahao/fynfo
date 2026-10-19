import {
  insertImportedExpense,
  insertImportedExpenses,
} from '@/features/expenses/actions/import-expense-actions';
import {
  importedExpenseSchema,
  importedExpenseValues,
  type ImportedExpenseInput,
} from '@/features/expenses/lib/import-expense';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const key = Buffer.alloc(32, 7);
const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('@/lib/action-guard', () => ({ requireActionContext: mocks.context }));
const input: ImportedExpenseInput = {
  id: 'a3610806-7c64-4a2a-9a3d-1842d82c993d',
  date: '2026-10-01',
  type: 'groceries',
  description: 'Invented Market',
  cents: 1230,
  bank: 'uob',
  period: { from: '2026-10-01', to: '2026-10-31' },
  suggestedClassification: 'expense',
  classification: 'expense',
  source: [{ page: 1, line: 3, text: '01 OCT ORIGINAL MARKET SGD 12.30' }],
};
beforeEach(() => vi.clearAllMocks());
function setup(options: Parameters<typeof makeFakeSupabase>[0] = {}) {
  const fake = makeFakeSupabase(options);
  mocks.context.mockResolvedValue({
    userId: 'synthetic-owner',
    dek: key,
    supabase: fake.client,
  });
  return fake;
}
async function savedRows(changes: Record<string, unknown> = {}) {
  const value = importedExpenseValues(input);
  return {
    expense_records: [
      {
        id: value.id,
        date: `${value.date}T00:00:00.000Z`,
        type: value.type,
        item: await encryptPayload(value.item, key),
        info: await encryptPayload(value.info, key),
        amount: await encryptPayload(String(value.amount), key),
        split_type: 'self',
        ...changes,
      },
    ],
    expense_splits: [],
  };
}
describe('insert-only import boundary', () => {
  it.each([
    '01 OCT REFUND SGD 12.30',
    '01 OCT MARKET SGD 12.30 CR',
    '01 OCT MARKET SGD -12.30',
    '01 OCT MARKET SGD (12.30)',
    '01 OCT TOTAL BALANCE SGD 12.30',
  ])('rejects positive override of source restriction: %s', async (text) => {
    const fake = setup();
    expect(
      (
        await insertImportedExpense({
          ...input,
          source: [{ page: 1, line: 3, text }],
        })
      ).status
    ).toBe('not_saved');
    expect(fake.calls.insert).toEqual([]);
  });
  it('encrypts fields after the owner/vault gate and never upserts, updates or writes splits', async () => {
    const fake = setup();
    expect(await insertImportedExpense(input)).toEqual({
      id: input.id,
      status: 'confirmed',
    });
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.user_id).toBe('synthetic-owner');
    expect(row.split_type).toBe('self');
    expect(await decryptPayload(row.item, key)).toBe(input.description);
    expect(await decryptPayload(row.info, key)).toContain('ORIGINAL MARKET');
    expect(await decryptPayload(row.amount, key)).toBe('12.3');
    expect(fake.calls.from).toEqual(['expense_records']);
    expect(fake.calls.upsert).toEqual([]);
    expect(fake.calls.rpc).toEqual([]);
    expect(fake.calls.update).toEqual([]);
  });
  it.each([
    { ...input, cents: 0 },
    { ...input, cents: 12.3 },
    { ...input, cents: Infinity },
    { ...input, cents: 1_000_000_000_001 },
    { ...input, date: '2026-02-30' },
    { ...input, date: '2026-11-01' },
    { ...input, classification: 'refund' },
    { ...input, description: ' ' },
    { ...input, description: 'x'.repeat(4097) },
    { ...input, user_id: 'other' },
    { ...input, source: [] },
    { ...input, source: [{ page: 101, line: 1, text: 'x' }] },
    {
      ...input,
      source: Array.from({ length: 33 }, () => ({
        page: 1,
        line: 1,
        text: 'x',
      })),
    },
    {
      ...input,
      source: Array.from({ length: 5 }, () => ({
        page: 1,
        line: 1,
        text: '界'.repeat(4096),
      })),
    },
    { ...input, period: { from: '2026-10-31', to: '2026-10-01' } },
  ])(
    'rejects invalid/unsupported envelope without DB access',
    async (invalid) => {
      const fake = setup();
      expect(importedExpenseSchema.safeParse(invalid).success).toBe(false);
      expect((await insertImportedExpense(invalid)).status).toBe('not_saved');
      expect(mocks.context).not.toHaveBeenCalled();
      expect(fake.calls.from).toEqual([]);
    }
  );
  it('confirms exact same-ID conflict only from decrypted authoritative owned reads', async () => {
    const fake = setup({
      insertError: { code: '23505', message: 'private DB text' },
      selectDataByTable: await savedRows(),
    });
    expect(await insertImportedExpense(input)).toEqual({
      id: input.id,
      status: 'confirmed',
    });
    expect(
      fake.calls.queries.find((query) => query.operation === 'read')?.eq
    ).toContainEqual({ column: 'user_id', value: 'synthetic-owner' });
    expect(fake.calls.insert).toHaveLength(1);
    expect(fake.calls.update).toEqual([]);
  });
  it('freezes a changed same-ID record without overwrite', async () => {
    const fake = setup({
      insertError: { code: '23505', message: 'conflict' },
      selectDataByTable: await savedRows({
        item: await encryptPayload('Changed elsewhere', key),
      }),
    });
    expect((await insertImportedExpense(input)).status).toBe('conflict');
    expect(fake.calls.update).toEqual([]);
    expect(fake.calls.rpc).toEqual([]);
  });
  it('keeps missing, failed, malformed and undecryptable authoritative reads unconfirmed', async () => {
    for (const options of [
      { selectDataByTable: { expense_records: [], expense_splits: [] } },
      { selectError: { message: 'secret read error' } },
      { selectDataByTable: await savedRows({ item: 'bad ciphertext' }) },
    ]) {
      setup({
        insertError: { code: '23505', message: 'secret conflict' },
        ...options,
      });
      expect((await insertImportedExpense(input)).status).toBe('unconfirmed');
    }
  });
  it.each(['23502', '23503', '23514', '42501'])(
    'classifies definite transaction rejection %s without leaking detail',
    async (code) => {
      setup({ insertError: { code, message: 'sensitive DB details' } });
      expect(await insertImportedExpense(input)).toEqual({
        id: input.id,
        status: 'not_saved',
      });
    }
  );
  it.each(['57014', 'PGRST000', undefined])(
    'leaves uncertain errors unconfirmed',
    async (code) => {
      setup({ insertError: { code, message: 'sensitive DB details' } });
      expect(await insertImportedExpense(input)).toEqual({
        id: input.id,
        status: 'unconfirmed',
      });
    }
  );
  it('an unavailable vault prevents any insert', async () => {
    const fake = setup();
    mocks.context.mockRejectedValue(new Error('vault unavailable'));
    expect((await insertImportedExpense(input)).status).toBe('not_saved');
    expect(fake.calls.insert).toEqual([]);
  });
  it('a thrown transport after dispatch is unconfirmed', async () => {
    setup();
    mocks.context.mockResolvedValue({
      userId: 'synthetic',
      dek: key,
      supabase: {
        from: () => ({
          insert: () => {
            throw new Error('lost transport');
          },
        }),
      },
    });
    expect((await insertImportedExpense(input)).status).toBe('unconfirmed');
  });
});

describe('grouped insert-only import', () => {
  const second = { ...input, id: '6712c00e-90cd-44f7-9d55-4dd4e55044b3' };
  it('authenticates once and encrypts multiple purchases in one insert', async () => {
    const fake = setup();
    expect(await insertImportedExpenses([input, second])).toEqual([
      { id: input.id, status: 'confirmed' },
      { id: second.id, status: 'confirmed' },
    ]);
    expect(mocks.context).toHaveBeenCalledTimes(1);
    expect(fake.calls.insert).toHaveLength(1);
    const records = fake.calls.insert[0] as Record<string, string>[];
    expect(records).toHaveLength(2);
    for (const record of records) {
      expect(record.user_id).toBe('synthetic-owner');
      expect(decryptPayload(record.item, key)).toBe(input.description);
      expect(decryptPayload(record.amount, key)).toBe('12.3');
    }
    expect(fake.calls.upsert).toHaveLength(0);
    expect(fake.calls.update).toHaveLength(0);
  });
  it.each(
    [[input, input], Array(21).fill(input), [{ ...input, cents: -1 }], []].map(
      (rows) => [rows]
    )
  )('rejects malformed or oversized groups before auth %#', async (rows) => {
    const fake = setup();
    expect(await insertImportedExpenses(rows)).toEqual([]);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(fake.calls.insert).toHaveLength(0);
  });
  it('reconciles identical IDs after atomic rejection, leaving absent rows safely retryable', async () => {
    const fake = setup({
      insertError: { code: '23505', message: 'private' },
      selectDataByTable: await savedRows(),
    });
    expect(await insertImportedExpenses([input, second])).toEqual([
      { id: input.id, status: 'confirmed' },
      { id: second.id, status: 'not_saved' },
    ]);
    expect(fake.calls.insert).toHaveLength(1);
    expect(fake.calls.update).toHaveLength(0);
  });
  it('never overwrites a changed retained ID', async () => {
    setup({
      insertError: { code: '23505', message: 'private' },
      selectDataByTable: await savedRows({
        item: encryptPayload('Changed', key),
      }),
    });
    expect(await insertImportedExpenses([input])).toEqual([
      { id: input.id, status: 'conflict' },
    ]);
  });
  it.each(['23502', '23503', '23514', '42501'])(
    'reports definite rejection %s without DB detail',
    async (code) => {
      setup({ insertError: { code, message: 'private' } });
      expect(await insertImportedExpenses([input])).toEqual([
        { id: input.id, status: 'not_saved', reason: 'rejected' },
      ]);
    }
  );
  it.each(['57014', 'PGRST000'])('keeps %s unconfirmed', async (code) => {
    setup({ insertError: { code, message: 'private' } });
    expect(await insertImportedExpenses([input])).toEqual([
      { id: input.id, status: 'unconfirmed' },
    ]);
  });
  it('returns a fixed access hint without dispatching if the vault is unavailable', async () => {
    const fake = setup();
    mocks.context.mockRejectedValue(new Error('private'));
    expect(await insertImportedExpenses([input])).toEqual([
      { id: input.id, status: 'not_saved', reason: 'access' },
    ]);
    expect(fake.calls.insert).toHaveLength(0);
  });
});

afterEach(() => vi.useRealTimers());
it('releases an unavailable auth request without ever dispatching after a late auth response', async () => {
  vi.useFakeTimers();
  const fake = setup();
  let finish!: (context: unknown) => void;
  mocks.context.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const result = insertImportedExpenses([input]);
  await vi.advanceTimersByTimeAsync(8_000);
  expect(await result).toEqual([
    { id: input.id, status: 'not_saved', reason: 'access' },
  ]);
  finish({ userId: 'synthetic-owner', dek: key, supabase: fake.client });
  await Promise.resolve();
  expect(fake.calls.insert).toHaveLength(0);
});
it('releases a hung insert as unconfirmed, never definite rejection', async () => {
  vi.useFakeTimers();
  mocks.context.mockResolvedValue({
    userId: 'synthetic-owner',
    dek: key,
    supabase: { from: () => ({ insert: () => new Promise(() => {}) }) },
  });
  const result = insertImportedExpenses([input]);
  await vi.advanceTimersByTimeAsync(8_000);
  expect(await result).toEqual([{ id: input.id, status: 'unconfirmed' }]);
});

it('bounds hung expense-history reads on the server so later reads can proceed', async () => {
  vi.useFakeTimers();
  const { getExpenses } =
    await import('@/features/expenses/actions/expense-actions');
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    range() {
      return new Promise(() => {});
    },
  };
  mocks.context.mockResolvedValue({
    userId: 'synthetic-owner',
    dek: key,
    supabase: { from: () => builder },
  });
  const result = expect(getExpenses()).rejects.toThrow('Request timed out');
  await vi.advanceTimersByTimeAsync(15_000);
  await result;
  setup({ selectData: [] });
  expect(await getExpenses()).toEqual([]);
});
