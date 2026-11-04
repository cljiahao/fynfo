import { encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 7);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
const getTrades = vi.fn();
const fetchDividends = vi.fn();
const loggerError = vi.fn();

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: USER_ID, dek: DEK, supabase }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerError } }));
vi.mock('@/features/equity/actions/equity-actions', () => ({ getTrades }));
vi.mock('@/features/equity/actions/price-actions', () => ({ fetchDividends }));

const trade = (ticker: string, market?: 'SG' | 'US') => ({
  id: `t-${ticker}`,
  date: '2025-01-01',
  broker: 'Synthetic broker',
  ticker,
  market,
  action: 'buy' as const,
  shares: 1000,
  price: 1,
  fees: 0,
});

async function existingRow(ticker: string, amount: string, date: string) {
  return {
    id: `d-${ticker}-${date}`,
    ticker: await encryptPayload(ticker, DEK),
    amount: await encryptPayload(amount, DEK),
    currency: 'SGD',
    date,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  supabase = makeFakeSupabase().client;
});

describe('autoScanDividends', () => {
  it('inserts only candidates missing from the vault and reports the count', async () => {
    const fake = makeFakeSupabase({
      selectData: [await existingRow('MLT', '20', '2025-03-15')],
    });
    supabase = fake.client;
    getTrades.mockResolvedValue([trade('MLT')]);
    fetchDividends.mockResolvedValue({
      points: [
        { exDate: '2025-03-15', dpu: 0.02 },
        { exDate: '2025-09-15', dpu: 0.022 },
      ],
    });
    const { autoScanDividends } =
      await import('@/features/equity/actions/dividend-actions');

    await expect(autoScanDividends()).resolves.toEqual({ added: 1 });
    const inserted = fake.calls.insert[0] as Array<Record<string, string>>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0].date).toBe('2025-09-15');
    expect(fetchDividends).toHaveBeenCalledWith('MLT', 'SG');
  });

  it('inserts nothing when run again over the rows it created', async () => {
    const fake = makeFakeSupabase({
      selectData: [
        await existingRow('MLT', '20', '2025-03-15'),
        await existingRow('MLT', '22', '2025-09-15'),
      ],
    });
    supabase = fake.client;
    getTrades.mockResolvedValue([trade('MLT')]);
    fetchDividends.mockResolvedValue({
      points: [
        { exDate: '2025-03-15', dpu: 0.02 },
        { exDate: '2025-09-15', dpu: 0.022 },
      ],
    });
    const { autoScanDividends } =
      await import('@/features/equity/actions/dividend-actions');

    await expect(autoScanDividends()).resolves.toEqual({ added: 0 });
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('keeps scanning when one ticker fails', async () => {
    const fake = makeFakeSupabase();
    supabase = fake.client;
    getTrades.mockResolvedValue([trade('MLT'), trade('AAPL', 'US')]);
    fetchDividends.mockImplementation(async (ticker: string) => {
      if (ticker === 'AAPL') throw new Error('upstream down');
      return { points: [{ exDate: '2025-03-15', dpu: 0.02 }] };
    });
    const { autoScanDividends } =
      await import('@/features/equity/actions/dividend-actions');

    await expect(autoScanDividends()).resolves.toEqual({ added: 1 });
  });

  it('never fetches malformed tickers', async () => {
    supabase = makeFakeSupabase().client;
    getTrades.mockResolvedValue([trade('MLT'), trade('BAD TICKER!')]);
    fetchDividends.mockResolvedValue({ points: [] });
    const { autoScanDividends } =
      await import('@/features/equity/actions/dividend-actions');

    await autoScanDividends();
    expect(fetchDividends).toHaveBeenCalledTimes(1);
    expect(fetchDividends).toHaveBeenCalledWith('MLT', 'SG');
  });

  it('surfaces only an opaque error and logs the detail server-side', async () => {
    supabase = makeFakeSupabase({
      insertError: { message: 'duplicate key on equity_dividends_pkey' },
    }).client;
    getTrades.mockResolvedValue([trade('MLT')]);
    fetchDividends.mockResolvedValue({
      points: [{ exDate: '2025-03-15', dpu: 0.02 }],
    });
    const { autoScanDividends } =
      await import('@/features/equity/actions/dividend-actions');

    const failure = await autoScanDividends().catch((e: Error) => e);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Dividend scan failed');
    expect((failure as Error).message).not.toMatch(/equity_dividends/);
    expect(loggerError).toHaveBeenCalledWith(
      expect.anything(),
      'dividend auto-scan failed'
    );
  });

  it('rejects when every ticker fetch fails so the caller does not record a scan', async () => {
    supabase = makeFakeSupabase().client;
    getTrades.mockResolvedValue([trade('MLT')]);
    fetchDividends.mockRejectedValue(new Error('down'));
    const { autoScanDividends } =
      await import('@/features/equity/actions/dividend-actions');

    await expect(autoScanDividends()).rejects.toThrow('Dividend scan failed');
  });
});
