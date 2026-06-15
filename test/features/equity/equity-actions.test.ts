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
      },
    ]);
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

describe('equity-actions — deleteTrade', () => {
  it('issues a scoped delete on equity_trades', async () => {
    const fake = setSupabase();
    const { deleteTrade } =
      await import('@/features/equity/actions/equity-actions');
    await deleteTrade('trade-1');
    expect(fake.calls.from).toContain('equity_trades');
    expect(fake.calls.delete).toBe(1);
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
