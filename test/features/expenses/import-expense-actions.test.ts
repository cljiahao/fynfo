import { insertImportedExpense } from '@/features/expenses/actions/import-expense-actions';
import {
  importedExpenseSchema,
  importedExpenseValues,
  type ImportedExpenseInput,
} from '@/features/expenses/lib/import-expense';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
