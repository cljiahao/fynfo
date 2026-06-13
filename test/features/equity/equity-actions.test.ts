import { encryptPayload } from '@/lib/crypto';
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
