import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 7);

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

const VALID = {
  ticker: 'mlt',
  amount: 182.4,
  currency: 'SGD' as const,
  date: '2026-05-30',
};

beforeEach(() => {
  setSupabase();
});

describe('dividend-actions — getDividends', () => {
  it('decrypts ticker and amount and maps currency/date through', async () => {
    setSupabase({
      selectData: [
        {
          id: 'd1',
          ticker: await encryptPayload('MLT', DEK),
          amount: await encryptPayload('182.4', DEK),
          currency: 'SGD',
          date: '2026-05-30',
        },
      ],
    });
    const { getDividends } =
      await import('@/features/equity/actions/dividend-actions');
    expect(await getDividends()).toEqual([
      {
        id: 'd1',
        ticker: 'MLT',
        amount: 182.4,
        currency: 'SGD',
        date: '2026-05-30',
      },
    ]);
  });

  it('throws an opaque error on a read failure', async () => {
    setSupabase({
      selectError: { message: 'permission denied for table equity_dividends' },
    });
    const { getDividends } =
      await import('@/features/equity/actions/dividend-actions');
    await expect(getDividends()).rejects.toThrow('dividends read failed');
  });
});

describe('dividend-actions — createDividend', () => {
  it('encrypts ticker (upper-cased) + amount before insert', async () => {
    const fake = setSupabase();
    const { createDividend } =
      await import('@/features/equity/actions/dividend-actions');
    await createDividend(VALID);

    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.user_id).toBe(USER_ID);
    expect(row.currency).toBe('SGD');
    expect(row.date).toBe('2026-05-30');
    expect(row.ticker).not.toBe('MLT');
    expect(await decryptPayload(row.ticker, DEK)).toBe('MLT');
    expect(await decryptPayload(row.amount, DEK)).toBe('182.4');
  });

  it('rejects invalid input before any DB write', async () => {
    const fake = setSupabase();
    const { createDividend } =
      await import('@/features/equity/actions/dividend-actions');
    await expect(createDividend({ ...VALID, amount: 0 })).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('surfaces an opaque error on an insert failure', async () => {
    setSupabase({ insertError: { message: 'null value in column "user_id"' } });
    const { createDividend } =
      await import('@/features/equity/actions/dividend-actions');
    await expect(createDividend(VALID)).rejects.toThrow(
      'dividend write failed'
    );
  });
});

describe('dividend-actions — createDividends (bulk)', () => {
  it('encrypts and inserts every row in one call', async () => {
    const fake = setSupabase();
    const { createDividends } =
      await import('@/features/equity/actions/dividend-actions');
    await createDividends([
      VALID,
      { ticker: 'fct', amount: 50, currency: 'SGD', date: '2026-06-01' },
    ]);

    expect(fake.calls.insert).toHaveLength(1);
    const rows = fake.calls.insert[0] as Array<Record<string, string>>;
    expect(rows).toHaveLength(2);
    expect(await decryptPayload(rows[0].ticker, DEK)).toBe('MLT');
    expect(await decryptPayload(rows[1].amount, DEK)).toBe('50');
  });

  it('is a no-op (no DB call) for an empty list', async () => {
    const fake = setSupabase();
    const { createDividends } =
      await import('@/features/equity/actions/dividend-actions');
    await createDividends([]);
    expect(fake.calls.from).toHaveLength(0);
  });

  it('rejects if any row is invalid, before any DB write', async () => {
    const fake = setSupabase();
    const { createDividends } =
      await import('@/features/equity/actions/dividend-actions');
    await expect(
      createDividends([VALID, { ...VALID, amount: -1 }])
    ).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('surfaces an opaque error on an insert failure', async () => {
    setSupabase({ insertError: { message: 'value too long' } });
    const { createDividends } =
      await import('@/features/equity/actions/dividend-actions');
    await expect(createDividends([VALID])).rejects.toThrow(
      'dividend write failed'
    );
  });
});

describe('dividend-actions — updateDividend', () => {
  it('encrypts fields on update', async () => {
    const fake = setSupabase();
    const { updateDividend } =
      await import('@/features/equity/actions/dividend-actions');
    await updateDividend('d1', { ...VALID, amount: 200 });
    expect(
      fake.calls.queries.find((query) => query.operation === 'update')?.eq
    ).toEqual([
      { column: 'id', value: 'd1' },
      { column: 'user_id', value: USER_ID },
    ]);
    const row = fake.calls.update[0] as Record<string, string>;
    expect(await decryptPayload(row.amount, DEK)).toBe('200');
    expect(typeof row.updated_at).toBe('string');
  });

  it('surfaces an opaque error on failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { updateDividend } =
      await import('@/features/equity/actions/dividend-actions');
    await expect(updateDividend('d1', VALID)).rejects.toThrow(
      'dividend write failed'
    );
  });
});

describe('dividend-actions — deleteDividend', () => {
  it('issues a scoped delete', async () => {
    const fake = setSupabase();
    const { deleteDividend } =
      await import('@/features/equity/actions/dividend-actions');
    await deleteDividend('d1');
    expect(fake.calls.from).toContain('equity_dividends');
    expect(fake.calls.delete).toBe(1);
    expect(
      fake.calls.queries.find(
        (query) =>
          query.table === 'equity_dividends' && query.operation === 'delete'
      )?.eq
    ).toEqual([
      { column: 'id', value: 'd1' },
      { column: 'user_id', value: USER_ID },
    ]);
  });

  it('surfaces an opaque error on failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { deleteDividend } =
      await import('@/features/equity/actions/dividend-actions');
    await expect(deleteDividend('d1')).rejects.toThrow('dividend write failed');
  });
});
