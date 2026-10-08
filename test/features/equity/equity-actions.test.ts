import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 4);

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

beforeEach(() => {
  setSupabase();
});

describe('equity-actions — getTrades', () => {
  it('decrypts ticker, shares, price, and fees on success', async () => {
    setSupabase({
      selectData: [
        {
          id: 'trade-1',
          date: '2026-03-01',
          broker: 'IBKR',
          ticker: await encryptPayload('AAPL', DEK),
          action: 'buy',
          shares: await encryptPayload('10', DEK),
          price: await encryptPayload('190.5', DEK),
          fees: await encryptPayload('1.2', DEK),
        },
      ],
    });
    const { getTrades } =
      await import('@/features/equity/actions/equity-actions');
    expect(await getTrades()).toEqual([
      {
        id: 'trade-1',
        date: '2026-03-01',
        broker: 'IBKR',
        ticker: 'AAPL',
        action: 'buy',
        shares: 10,
        price: 190.5,
        fees: 1.2,
        isCdp: false,
        isPO: false,
      },
    ]);
  });

  it('maps the saved is_cdp / is_po flags', async () => {
    setSupabase({
      selectData: [
        {
          id: 'trade-1',
          date: '2026-03-01',
          broker: 'DBS Vickers',
          ticker: await encryptPayload('MLT', DEK),
          action: 'buy',
          shares: await encryptPayload('1000', DEK),
          price: await encryptPayload('1.84', DEK),
          fees: await encryptPayload('0', DEK),
          is_cdp: true,
          is_po: true,
        },
      ],
    });
    const { getTrades } =
      await import('@/features/equity/actions/equity-actions');
    const [trade] = await getTrades();
    expect(trade.isCdp).toBe(true);
    expect(trade.isPO).toBe(true);
  });

  it('returns an empty array when the user has no trades', async () => {
    setSupabase({ selectData: [] });
    const { getTrades } =
      await import('@/features/equity/actions/equity-actions');
    expect(await getTrades()).toEqual([]);
  });

  // Regression (spec 032): a read error must surface as an opaque AppError, not
  // be swallowed into an empty list that masks RLS/connection failures.
  it('throws an opaque error instead of returning [] on a read failure', async () => {
    setSupabase({
      selectError: { message: 'permission denied for table equity_trades' },
    });
    const { getTrades } =
      await import('@/features/equity/actions/equity-actions');
    await expect(getTrades()).rejects.toThrow('trades read failed');
  });
});

const VALID_TRADE = {
  date: '2026-03-01',
  broker: 'IBKR',
  ticker: 'aapl',
  action: 'buy' as const,
  shares: 10,
  price: 190.5,
  fees: 1.2,
};

describe('equity-actions — createTrade', () => {
  it('persists the schema-normalized ticker for whitespace-padded input', async () => {
    const fake = setSupabase();
    const { createTrade } =
      await import('@/features/equity/actions/equity-actions');
    await createTrade({ ...VALID_TRADE, ticker: ' dbs ' });
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(decryptPayload(row.ticker, DEK)).toBe('DBS');
  });

  it('encrypts ticker/shares/price/fees (upper-cased) before insert', async () => {
    const fake = setSupabase();
    const { createTrade } =
      await import('@/features/equity/actions/equity-actions');
    await createTrade(VALID_TRADE);

    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.user_id).toBe(USER_ID);
    expect(row.action).toBe('buy');
    // ciphertext, not plaintext
    expect(row.ticker).not.toBe('AAPL');
    expect(await decryptPayload(row.ticker, DEK)).toBe('AAPL');
    expect(await decryptPayload(row.shares, DEK)).toBe('10');
    expect(await decryptPayload(row.price, DEK)).toBe('190.5');
    expect(await decryptPayload(row.fees, DEK)).toBe('1.2');
    expect(row.is_cdp).toBe(false);
    expect(row.is_po).toBe(false);
  });

  it('persists is_cdp / is_po when provided', async () => {
    const fake = setSupabase();
    const { createTrade } =
      await import('@/features/equity/actions/equity-actions');
    await createTrade({ ...VALID_TRADE, isCdp: true, isPO: true });
    const row = fake.calls.insert[0] as Record<string, unknown>;
    expect(row.is_cdp).toBe(true);
    expect(row.is_po).toBe(true);
  });

  it('rejects invalid input before any DB write', async () => {
    const fake = setSupabase();
    const { createTrade } =
      await import('@/features/equity/actions/equity-actions');
    await expect(createTrade({ ...VALID_TRADE, shares: -5 })).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('surfaces an opaque error on an insert failure', async () => {
    setSupabase({ insertError: { message: 'null value in column "user_id"' } });
    const { createTrade } =
      await import('@/features/equity/actions/equity-actions');
    await expect(createTrade(VALID_TRADE)).rejects.toThrow(
      'equity trade write failed'
    );
  });
});

describe('equity-actions — updateTrade', () => {
  it('persists the schema-normalized ticker for whitespace-padded input', async () => {
    const fake = setSupabase();
    const { updateTrade } =
      await import('@/features/equity/actions/equity-actions');
    await updateTrade('trade-1', { ...VALID_TRADE, ticker: ' dbs ' });
    const row = fake.calls.update[0] as Record<string, string>;
    expect(decryptPayload(row.ticker, DEK)).toBe('DBS');
  });

  it('encrypts fields (upper-cased ticker) before the scoped update', async () => {
    const fake = setSupabase();
    const { updateTrade } =
      await import('@/features/equity/actions/equity-actions');
    await updateTrade('trade-1', VALID_TRADE);
    expect(
      fake.calls.queries.find((query) => query.operation === 'update')?.eq
    ).toEqual([
      { column: 'id', value: 'trade-1' },
      { column: 'user_id', value: USER_ID },
    ]);

    const row = fake.calls.update[0] as Record<string, string>;
    expect(await decryptPayload(row.ticker, DEK)).toBe('AAPL');
    expect(await decryptPayload(row.shares, DEK)).toBe('10');
    expect(await decryptPayload(row.price, DEK)).toBe('190.5');
    expect(typeof row.updated_at).toBe('string');
  });

  it('rejects invalid input before any DB write', async () => {
    const fake = setSupabase();
    const { updateTrade } =
      await import('@/features/equity/actions/equity-actions');
    await expect(
      updateTrade('trade-1', { ...VALID_TRADE, price: -1 })
    ).rejects.toThrow();
    expect(fake.calls.update).toHaveLength(0);
  });

  it('surfaces an opaque error on an update failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { updateTrade } =
      await import('@/features/equity/actions/equity-actions');
    await expect(updateTrade('trade-1', VALID_TRADE)).rejects.toThrow(
      'equity trade write failed'
    );
  });
});

describe('equity-actions — deleteTrade', () => {
  it('issues a scoped delete on equity_trades', async () => {
    const fake = setSupabase();
    const { deleteTrade } =
      await import('@/features/equity/actions/equity-actions');
    await deleteTrade('trade-1');
    expect(fake.calls.from).toContain('equity_trades');
    expect(fake.calls.delete).toBe(1);
    expect(
      fake.calls.queries.find(
        (query) =>
          query.table === 'equity_trades' && query.operation === 'delete'
      )?.eq
    ).toEqual([
      { column: 'id', value: 'trade-1' },
      { column: 'user_id', value: USER_ID },
    ]);
  });

  it('surfaces an opaque error on a delete failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { deleteTrade } =
      await import('@/features/equity/actions/equity-actions');
    await expect(deleteTrade('trade-1')).rejects.toThrow(
      'equity trade write failed'
    );
  });
});
